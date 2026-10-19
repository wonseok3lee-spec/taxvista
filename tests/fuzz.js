#!/usr/bin/env node
// tests/fuzz.js — deterministic, seeded robustness fuzz for calculateMetrics() and the
// multi-year pipeline that wraps it (mirrored in tests/app-mirror.js).
//
//   node tests/fuzz.js                 # default seed, 5,000 households
//   node tests/fuzz.js --seed 42       # different seed
//   node tests/fuzz.js --n 500         # fewer households
//   node tests/fuzz.js --show-skips    # print skip reasons per case
//
// Exit code: 1 if ANY valid-tier assertion fails, else 0. Warned-tier and malformed-tier
// results are reported but never affect the exit code. Nothing is fixed here.
//
// ───────────────────────────── INPUT CONTRACT (as observed) ─────────────────────────────
// calculateMetrics(data, compare?) is called by TaxVista_Step1.jsx runAnalysis() with:
//   data = {
//     year: number, isNR: boolean,
//     income: { wages, interest, dividends, socialSecurity, capitalGains, additionalIncome },  // number | null
//     adjustments: { totalAdjustments }, deductions: { itemized },                            // number | null (unused by engine)
//     summary: { totalIncome, adjustedGrossIncome, taxableIncome, totalTax },                 // number (required by wizard)
//   }
//   compare = undefined for the first year, else { priorETR, priorDE, priorATM, priorIncome, priorCapGains, avgETR?, avgDE? }
// Every field is produced by parseNum(): a finite number or null (blank). The wizard requires
// totalIncome / agi / taxableIncome / totalTax to be non-null (canAnalyze) and only WARNS about
// taxable > AGI, negative tax, and negative wages/interest/dividends/otherIncome — it still runs
// the analysis. Negative otherIncome is used by the shipped "re-investor" demo, so it is treated
// as VALID here despite the warning. Capital loss on Line 7 is at most −$3,000 (IRS Topic 409).
//
// Tiers:
//   valid     — contract-conforming inputs (generator invariants enforced + hand-written edges)
//   warned    — reachable through the UI but trigger a validation warning
//   malformed — not reachable through the UI (wrong types, missing objects, NaN)
//
// ───────────────────────────── ASSERTIONS AND WHEN THEY APPLY ────────────────────────────
// A1  No exception from calculateMetrics / pipeline.            valid: always. warned: always.
//                                                               malformed: recorded, not failed.
// A2  Every numeric leaf of the output is finite; no string     valid + warned: always.
//     contains "NaN"/"undefined"/"Infinity".
// A3  Required output keys present with the right type; null    valid: always. Null rules
//     ONLY where the contract allows: ratio X/Y is null iff Y    derived from the engine's
//     is 0/null (totalIncome, agi, taxableIncome respectively);  documented guards and
//     incomeBreakdown.* null iff the clipped-parts sum is 0.     CLAUDE.md §1.1 formulas.
// A4  Composition percentages sum to 100%. The documented        valid: only when the clipped
//     denominator is the sum of the five components each         parts sum > 0; otherwise
//     clipped at 0 (calculateMetrics.js:9-30) — NOT              SKIPPED (all pcts are null by
//     summary.totalIncome — so the identity holds exactly        contract). Tolerance 1e-9:
//     whenever that sum is positive, regardless of losses.       the engine does no rounding
//                                                               (UI rounds to 0.1% later).
// A5  0 <= taxableIncome <= max(0, AGI). Line 15 is "-0- if      The engine does not emit
//     zero or less", so taxable is non-negative on the form.     taxableIncome; it passes it
//     Checked (a) on generated inputs (generator invariant) and  through. So A5 is checked on
//     (b) on the derived outputs that encode it: taxableRatio    the derived ratios, valid tier
//     <= 1 when AGI > 0 and deductionEfficiency >= 0 when        only, skipped when AGI <= 0
//     totalIncome > 0 and AGI >= 0.                              or totalIncome <= 0.
// A6  totalTax >= 0: Line 24 is a non-negative liability (the    Checked on derived outputs:
//     wizard warns on negatives). Derived: afterTaxIncome <=     valid tier always; sign checks
//     totalIncome; taxToIncome >= 0 if totalIncome > 0;          skipped when the denominator
//     effectiveTaxRate >= 0 if taxableIncome > 0.                is <= 0.
// A7  Formula conformance to CLAUDE.md §1.1, recomputed from     valid: always (expected values
//     INPUT (never from engine output), rel. tol 1e-12.          come from the spec + input).
// A8  Structural invariants: falseSignals sorted by severity,    valid: always.
//     primarySignal === falseSignals[0] ?? null, healthScore an
//     integer in [0,100] with matching label/color, signal labels
//     from the known set, summary items {text, metric}.
// A9  Multi-year pipeline (mirror): incomeCagr/afterTaxCagr/     valid: always (single-year
//     taxRateDelta finite-or-null; every narrative string clean. households exercise the
//                                                               null paths).

import { fileURLToPath } from "node:url";
import path from "node:path";
import { calculateMetrics } from "../src/utils/calculateMetrics.js";
import { YEAR_OPTIONS, runPipeline, collectNarrative } from "./app-mirror.js";

export const DEFAULT_SEED = 20261018;
export const DEFAULT_N = 5000;

// ── Seeded RNG (mulberry32) ─────────────────────────────────────────────────
export function makeRng(seed) {
  let a = seed >>> 0;
  const next = () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    int: (lo, hi) => lo + Math.floor(next() * (hi - lo + 1)),
    uniform: (lo, hi) => lo + next() * (hi - lo),
    chance: (p) => next() < p,
    pick: (arr) => arr[Math.floor(next() * arr.length)],
  };
}

// ── Generator ───────────────────────────────────────────────────────────────
export const PROFILES = [
  "zero-income", "low-wage", "middle-wage", "high-wage", "very-high", "investor",
  "capital-loss", "self-employed", "business-loss", "nr-student", "nr-transition",
  "retiree-like", "volatile", "flat", "sparse-optional", "cap-gain-spike", "income-collapse",
];
const STD_LIKE_DEDUCTIONS = [12550, 12950, 13850, 14600, 15000, 15750]; // amounts a user might type; year-agnostic on purpose

const r2 = (v) => Math.round(v * 100) / 100;

function pickYears(rng, n) {
  const opts = [...YEAR_OPTIONS].sort((a, b) => a - b);
  if (rng.chance(0.7)) { const start = rng.int(0, opts.length - n); return opts.slice(start, start + n); }
  const pool = [...opts]; const out = [];
  while (out.length < n) out.push(pool.splice(rng.int(0, pool.length - 1), 1)[0]);
  return out.sort((a, b) => a - b);
}

// Generator-random (NOT reference-derived) tax: a plausible-looking fraction of taxable income.
function randomTax(rng, taxable) {
  if (taxable <= 0) return 0;
  const rate = taxable < 12000 ? rng.uniform(0.08, 0.11)
    : taxable < 50000 ? rng.uniform(0.09, 0.14)
    : taxable < 100000 ? rng.uniform(0.12, 0.19)
    : taxable < 200000 ? rng.uniform(0.16, 0.24)
    : rng.uniform(0.22, 0.34);
  return Math.round(taxable * rate);
}

export function generateHousehold(rng, idx) {
  const profile = rng.pick(PROFILES);
  const nYears = rng.int(1, 5);
  const years = pickYears(rng, nYears);
  const useCents = rng.chance(0.08);
  const money = (v) => (useCents ? r2(v) : Math.round(v));

  // Form per year
  let forms;
  if (profile === "nr-student") forms = years.map(() => "1040-NR");
  else if (profile === "nr-transition") { const k = rng.int(1, Math.max(1, nYears - 1)); forms = years.map((_, i) => (i < k ? "1040-NR" : "1040")); }
  else forms = years.map(() => (rng.chance(0.08) ? "1040-NR" : "1040"));

  // Base income trajectory
  let base;
  switch (profile) {
    case "zero-income": base = 0; break;
    case "low-wage": base = rng.uniform(1000, 35000); break;
    case "middle-wage": base = rng.uniform(35000, 120000); break;
    case "high-wage": base = rng.uniform(120000, 400000); break;
    case "very-high": base = rng.uniform(400000, 5000000); break;
    case "nr-student": base = rng.uniform(0, 40000); break;
    case "nr-transition": base = rng.uniform(3000, 30000); break;
    case "retiree-like": base = rng.uniform(20000, 90000); break;
    case "income-collapse": base = rng.uniform(60000, 300000); break;
    default: base = rng.uniform(5000, 250000);
  }
  const growth = () => {
    switch (profile) {
      case "volatile": return rng.uniform(0.4, 2.5);
      case "nr-transition": return rng.uniform(1.2, 2.5);
      case "flat": return rng.uniform(0.98, 1.02);
      case "income-collapse": return rng.uniform(0.3, 0.6);
      default: return rng.uniform(0.85, 1.35);
    }
  };
  const spikeYear = profile === "cap-gain-spike" && nYears > 1 ? rng.int(1, nYears - 1) : -1;
  const lossYear = profile === "capital-loss" || profile === "business-loss" ? rng.int(0, nYears - 1) : -1;

  const features = new Set();
  const yearsData = [];
  let level = base;
  for (let i = 0; i < years.length; i++) {
    const year = years[i];
    const isNR = forms[i] === "1040-NR";
    if (i > 0) level = level * growth();
    if (profile === "zero-income" && rng.chance(0.7)) level = 0;
    if (profile === "retiree-like" && i >= 1 && rng.chance(0.6)) level = level * 0.5;

    let wages, interest, dividends, capitalGains, other;
    const invest = profile === "investor" ? rng.uniform(0.3, 0.9) : rng.uniform(0, 0.08);
    wages = profile === "self-employed" || profile === "business-loss" ? level * rng.uniform(0, 0.5)
      : profile === "retiree-like" && i >= 1 ? 0
      : level * (1 - invest);
    interest = level * invest * rng.uniform(0, 0.3);
    dividends = level * invest * rng.uniform(0, 0.5);
    capitalGains = level * invest * rng.uniform(0, 0.5);
    other = profile === "self-employed" ? level * rng.uniform(0.5, 1.0)
      : profile === "retiree-like" && i >= 1 ? level * rng.uniform(0.3, 0.9)
      : level * rng.uniform(0, 0.05);
    if (i === spikeYear) { capitalGains = level * rng.uniform(0.6, 2.0); features.add("cap-gain-spike"); }
    if (i === lossYear && profile === "capital-loss") { capitalGains = -rng.uniform(1, 3000); features.add("capital-loss"); }
    if (i === lossYear && profile === "business-loss") { other = -rng.uniform(2000, Math.max(2001, level * 1.5)); features.add("negative-other"); }
    if (profile === "zero-income" && level === 0) { wages = interest = dividends = capitalGains = other = 0; features.add("zero-income"); }
    if (profile === "sparse-optional" || rng.chance(0.15)) {
      // Nothing to do here — sparse handling below sets fields to null.
    }
    wages = money(wages); interest = money(interest); dividends = money(dividends); capitalGains = money(capitalGains); other = money(other);
    if (capitalGains < -3000) capitalGains = -3000;

    // Reported totals are computed from the TRUE components (a user who skips an optional field
    // still reports the form's Line 9).
    const totalIncome = money(wages + interest + dividends + capitalGains + other);
    const adjustments = rng.chance(0.6) ? 0 : money(rng.uniform(0, Math.min(8000, Math.max(0, totalIncome * 0.1))));
    const agi = money(totalIncome - adjustments);
    const deductions = isNR ? (rng.chance(0.7) ? 0 : money(rng.uniform(0, 5000)))
      : rng.chance(0.8) ? rng.pick(STD_LIKE_DEDUCTIONS) : money(rng.uniform(15000, 40000));
    const taxableIncome = Math.max(0, money(agi - deductions));
    let totalTax = randomTax(rng, taxableIncome);
    if (profile === "self-employed" && other > 0) totalTax += Math.round(other * rng.uniform(0.10, 0.15));
    if (isNR && rng.chance(0.3)) { totalTax += Math.round(rng.uniform(0, 3000)); features.add("nec-tax"); }
    if (useCents) totalTax = r2(totalTax + rng.uniform(0, 0.99));

    if (totalIncome === 0) features.add("zero-income");
    if (totalIncome < 0) features.add("negative-total-income");
    if (totalIncome > 250000) features.add("high-income");
    if (other < 0) features.add("negative-other");
    if (capitalGains < 0) features.add("capital-loss");
    if (isNR) features.add("1040-NR");

    // Optional-field omission (parseNum("") → null). Required fields are never null in this tier.
    const sparse = profile === "sparse-optional" ? 0.6 : 0.12;
    const maybe = (v) => (rng.chance(sparse) ? null : v);
    const income = {
      wages: maybe(wages), interest: maybe(interest), dividends: maybe(dividends),
      socialSecurity: null, capitalGains: maybe(capitalGains), additionalIncome: maybe(other),
    };
    if (["wages", "interest", "dividends", "capitalGains", "additionalIncome"].some(k => income[k] === null)) features.add("missing-optional");

    yearsData.push({
      year, isNR, income,
      adjustments: { totalAdjustments: maybe(adjustments) },
      deductions: { itemized: maybe(deductions) },
      summary: { totalIncome, adjustedGrossIncome: agi, taxableIncome, totalTax },
      _true: { wages, interest, dividends, capitalGains, other, adjustments, deductions }, // generator truth (not passed to the engine)
    });
  }

  return { id: `H${idx}`, index: idx, tier: "valid", profile, forms, years: yearsData, features: [...features] };
}

// Generator invariants for the valid tier (A5/A6 on inputs + wizard-accepted shapes).
export function generatorInvariantViolations(h) {
  const v = [];
  for (const y of h.years) {
    const s = y.summary;
    for (const k of ["totalIncome", "adjustedGrossIncome", "taxableIncome", "totalTax"]) if (typeof s[k] !== "number" || !Number.isFinite(s[k])) v.push(`${y.year}: ${k} not a finite number`);
    if (s.taxableIncome < 0 || s.taxableIncome > Math.max(0, s.adjustedGrossIncome) + 0.005) v.push(`${y.year}: taxable outside [0, max(0,AGI)]`);
    if (s.totalTax < 0) v.push(`${y.year}: negative tax`);
    const adj = y._true?.adjustments ?? y.adjustments?.totalAdjustments ?? 0;
    if (Math.abs(s.totalIncome - adj - s.adjustedGrossIncome) > 1) v.push(`${y.year}: AGI ≠ total − adjustments`);
    for (const k of ["wages", "interest", "dividends"]) if (y.income[k] != null && y.income[k] < 0) v.push(`${y.year}: negative ${k}`);
    if (y.income.capitalGains != null && y.income.capitalGains < -3000) v.push(`${y.year}: capital loss beyond Line 7 limit`);
  }
  return v;
}

// Strip generator-only fields before handing to the engine (exactly what runAnalysis would pass).
export function toCollected(h) {
  return h.years.map(({ _true, ...rest }) => structuredClone(rest));
}

// ── Hand-written VALID edge cases ───────────────────────────────────────────
const Y = (year, isNR, inc, sum, extra = {}) => ({
  year, isNR,
  income: { wages: null, interest: null, dividends: null, socialSecurity: null, capitalGains: null, additionalIncome: null, ...inc },
  adjustments: { totalAdjustments: extra.adjustments ?? null },
  deductions: { itemized: extra.deductions ?? null },
  summary: { totalIncome: sum[0], adjustedGrossIncome: sum[1], taxableIncome: sum[2], totalTax: sum[3] },
});
const [Y0, Y1, Y2, Y3, Y4] = [...YEAR_OPTIONS].sort((a, b) => a - b); // oldest → newest

export const EDGE_CASES = [
  { id: "E01-all-zero-single", years: [Y(Y4, false, { wages: 0, interest: 0, dividends: 0, capitalGains: 0, additionalIncome: 0 }, [0, 0, 0, 0])] },
  { id: "E02-zero-eci-with-nec-tax-NR", years: [Y(Y4, true, { wages: 0 }, [0, 0, 0, 450])] },
  { id: "E03-negative-total-income-schC-loss", years: [Y(Y4, false, { wages: 12000, additionalIncome: -40000 }, [-28000, -28000, 0, 0])] },
  { id: "E04-negative-prior-then-positive", years: [Y(Y3, false, { wages: 5000, additionalIncome: -30000 }, [-25000, -25000, 0, 0]), Y(Y4, false, { wages: 90000 }, [90000, 90000, 75400, 11800])] },
  { id: "E05-taxable-zero-positive-tax", years: [Y(Y4, true, { wages: 2000 }, [2000, 2000, 0, 600])] },
  { id: "E06-max-capital-loss-tiny-income", years: [Y(Y3, false, { wages: 20000, capitalGains: -1000 }, [19000, 19000, 4400, 440]), Y(Y4, false, { wages: 8000, capitalGains: -3000 }, [5000, 5000, 0, 0])] },
  { id: "E07-very-high-income", years: [Y(Y3, false, { wages: 3000000, dividends: 500000, capitalGains: 1500000 }, [5000000, 5000000, 4985400, 1650000]), Y(Y4, false, { wages: 3200000, dividends: 600000, capitalGains: 100000 }, [3900000, 3900000, 3884250, 1300000])] },
  { id: "E08-all-optional-null", years: [Y(Y4, false, {}, [60000, 60000, 45400, 5200])] },
  { id: "E09-identical-years", years: [Y(Y2, false, { wages: 50000 }, [50000, 50000, 36150, 4100]), Y(Y3, false, { wages: 50000 }, [50000, 50000, 36150, 4100]), Y(Y4, false, { wages: 50000 }, [50000, 50000, 36150, 4100])] },
  { id: "E10-five-year-all-NR", years: [Y0, Y1, Y2, Y3, Y4].map((y, i) => Y(y, true, { wages: 10000 + i * 15000 }, [10000 + i * 15000, 10000 + i * 15000, 10000 + i * 15000, Math.round((10000 + i * 15000) * 0.12)])) },
  { id: "E11-lowbase-boundary-9999-vs-10000", years: [Y(Y3, false, { wages: 9999 }, [9999, 9999, 0, 0]), Y(Y4, false, { wages: 10000 }, [10000, 10000, 0, 0])] },
  { id: "E12-high-income-threshold-250000", years: [Y(Y3, false, { wages: 250000 }, [250000, 250000, 235400, 52000]), Y(Y4, false, { wages: 250001 }, [250001, 250001, 235401, 52001])] },
  { id: "E13-cap-gain-spike-then-normal", years: [Y(Y2, false, { wages: 90000, capitalGains: 2000 }, [92000, 92000, 77400, 12000]), Y(Y3, false, { wages: 92000, capitalGains: 70000 }, [162000, 162000, 147400, 28000]), Y(Y4, false, { wages: 95000, capitalGains: 1500 }, [96500, 96500, 81900, 12900])] },
  { id: "E14-prior-income-zero-then-positive", years: [Y(Y3, false, { wages: 0 }, [0, 0, 0, 0]), Y(Y4, false, { wages: 48000 }, [48000, 48000, 33400, 3700])] },
  { id: "E15-cents", years: [Y(Y3, false, { wages: 51234.56, interest: 12.34 }, [51246.90, 51246.90, 36646.90, 4123.45]), Y(Y4, false, { wages: 53210.99, interest: 15.01 }, [53226.00, 53226.00, 38626.00, 4388.12])] },
  { id: "E16-NR-no-deductions-taxable-equals-agi", years: [Y(Y4, true, { wages: 45000, interest: 300 }, [45300, 45300, 45300, 5600])] },
  { id: "E17-negative-after-tax-first-year-NR", years: [Y(Y3, true, { wages: 1000 }, [1000, 1000, 1000, 4000]), Y(Y4, true, { wages: 40000 }, [40000, 40000, 40000, 4800])] },
  { id: "E18-non-consecutive-years", years: [Y(Y0, false, { wages: 40000 }, [40000, 40000, 27450, 3050]), Y(Y4, false, { wages: 70000 }, [70000, 70000, 54250, 7100])] },
  { id: "E19-rental-loss-like-demo", years: [Y(Y3, false, { wages: 98000, interest: 350, dividends: 250, capitalGains: 0, additionalIncome: -8000 }, [90600, 90600, 76000, 11800]), Y(Y4, false, { wages: 107000, interest: 500, dividends: 400, capitalGains: 0, additionalIncome: 5000 }, [112900, 112900, 98300, 16700])] },
  { id: "E20-income-collapse-70pct", years: [Y(Y3, false, { wages: 200000 }, [200000, 200000, 185400, 40000]), Y(Y4, false, { wages: 50000 }, [50000, 50000, 35400, 4000])] },
  { id: "E21-tax-equals-taxable", years: [Y(Y4, false, { wages: 30000 }, [30000, 30000, 15400, 15400])] },
  { id: "E22-adjustments-exceed-income", years: [Y(Y4, false, { wages: 5000 }, [5000, -2000, 0, 0], { adjustments: 7000 })] },
  { id: "E23-only-social-security-field", years: [Y(Y4, false, { wages: 0, socialSecurity: 22000, additionalIncome: 24000 }, [46000, 46000, 30300, 3300])] },
  { id: "E24-single-year-NR-then-1040-same-income", years: [Y(Y3, true, { wages: 60000 }, [60000, 60000, 60000, 8500]), Y(Y4, false, { wages: 60000 }, [60000, 60000, 45400, 5200])] },
].map((c, i) => ({ ...c, index: `E${i + 1}`, tier: "valid", profile: "edge", forms: c.years.map(y => (y.isNR ? "1040-NR" : "1040")), features: ["edge"] }));

// ── WARNED tier: reachable through the UI with a validation warning ────────
export const WARNED_CASES = [
  { id: "W01-taxable-exceeds-agi", years: [Y(Y4, false, { wages: 60000 }, [60000, 60000, 65000, 7000])] },
  { id: "W02-negative-tax-refundable-credits", years: [Y(Y4, false, { wages: 25000 }, [25000, 25000, 10400, -1200])] },
  { id: "W03-negative-wages", years: [Y(Y4, false, { wages: -5000, additionalIncome: 20000 }, [15000, 15000, 400, 40])] },
  { id: "W04-agi-mismatch", years: [Y(Y4, false, { wages: 80000 }, [80000, 50000, 35400, 4000], { adjustments: 0 })] },
  { id: "W05-capital-loss-beyond-3000", years: [Y(Y4, false, { wages: 40000, capitalGains: -50000 }, [-10000, -10000, 0, 0])] },
  { id: "W06-negative-interest-and-dividends", years: [Y(Y4, false, { wages: 40000, interest: -300, dividends: -200 }, [39500, 39500, 24900, 2700])] },
  { id: "W07-negative-tax-and-negative-income-two-years", years: [Y(Y3, false, { wages: 0, additionalIncome: -5000 }, [-5000, -5000, 0, -800]), Y(Y4, false, { wages: 30000 }, [30000, 30000, 15400, -300])] },
  { id: "W08-taxable-exceeds-agi-negative-DE", years: [Y(Y3, false, { wages: 50000 }, [50000, 50000, 35400, 4000]), Y(Y4, false, { wages: 52000 }, [52000, 52000, 60000, 9000])] },
].map((c, i) => ({ ...c, index: `W${i + 1}`, tier: "warned", profile: "warned", forms: c.years.map(y => (y.isNR ? "1040-NR" : "1040")), features: ["warned"] }));

// ── MALFORMED tier: not reachable through the UI ────────────────────────────
export const MALFORMED_CASES = [
  { id: "M01-missing-summary", data: { year: Y4, isNR: false, income: { wages: 1 } } },
  { id: "M02-missing-income", data: { year: Y4, isNR: false, summary: { totalIncome: 1, adjustedGrossIncome: 1, taxableIncome: 1, totalTax: 0 } } },
  { id: "M03-empty-object", data: {} },
  { id: "M04-null-data", data: null },
  { id: "M05-string-numbers", data: { year: Y4, isNR: false, income: { wages: "50000", interest: "100" }, summary: { totalIncome: "50100", adjustedGrossIncome: "50100", taxableIncome: "35500", totalTax: "4000" } } },
  { id: "M06-NaN-required", data: { year: Y4, isNR: false, income: { wages: 1000 }, summary: { totalIncome: NaN, adjustedGrossIncome: 1000, taxableIncome: 0, totalTax: 0 } } },
  { id: "M07-undefined-required", data: { year: Y4, isNR: false, income: { wages: 1000 }, summary: { totalIncome: undefined, adjustedGrossIncome: undefined, taxableIncome: undefined, totalTax: undefined } } },
  { id: "M08-infinity", data: { year: Y4, isNR: false, income: { wages: Infinity }, summary: { totalIncome: Infinity, adjustedGrossIncome: Infinity, taxableIncome: Infinity, totalTax: 1 } } },
  { id: "M09-huge-overflow", data: { year: Y4, isNR: false, income: { wages: 1e308, additionalIncome: 1e308 }, summary: { totalIncome: 1e308, adjustedGrossIncome: 1e308, taxableIncome: 1e308, totalTax: 1e307 } } },
  { id: "M10-booleans", data: { year: Y4, isNR: false, income: { wages: true }, summary: { totalIncome: true, adjustedGrossIncome: true, taxableIncome: true, totalTax: false } } },
  { id: "M11-NaN-capital-gains", data: { year: Y4, isNR: false, income: { wages: 1000, capitalGains: NaN }, summary: { totalIncome: 1000, adjustedGrossIncome: 1000, taxableIncome: 0, totalTax: 0 } } },
  { id: "M12-compare-NaN", data: { year: Y4, isNR: false, income: { wages: 50000 }, summary: { totalIncome: 50000, adjustedGrossIncome: 50000, taxableIncome: 35400, totalTax: 4000 } }, compare: { priorETR: NaN, priorDE: NaN, priorIncome: NaN, priorCapGains: NaN } },
  { id: "M13-compare-strings", data: { year: Y4, isNR: false, income: { wages: 50000 }, summary: { totalIncome: 50000, adjustedGrossIncome: 50000, taxableIncome: 35400, totalTax: 4000 } }, compare: { priorETR: "0.1", priorDE: "0.2", priorIncome: "40000", priorCapGains: "0" } },
  { id: "M14-negative-zero", data: { year: Y4, isNR: false, income: { wages: -0 }, summary: { totalIncome: -0, adjustedGrossIncome: -0, taxableIncome: -0, totalTax: -0 } } },
  { id: "M15-array-income", data: { year: Y4, isNR: false, income: [], summary: { totalIncome: 1000, adjustedGrossIncome: 1000, taxableIncome: 0, totalTax: 0 } } },
];

// ── Assertion machinery ─────────────────────────────────────────────────────
const KNOWN_FLAGS = new Set(["FALSE_EFFICIENCY", "LOSS_DISTORTION", "INCOME_COLLAPSE", "DEDUCTION_ILLUSION", "TRUE_OPTIMIZATION", "ONE_TIME_EVENT"]);
const SEVERITY_ORDER = ["CRITICAL", "HIGH", "MEDIUM", "POSITIVE"];
const KNOWN_LABELS = new Set([
  "Few income adjustments", "Some income adjustments", "Well-structured income",
  "High tax burden", "Tax: moderate", "Tax-efficient",
  "Strong deductions", "Average deductions", "Low deductions",
  "Strong take-home", "Moderate take-home", "High tax drag",
  "⚠ Loss-driven", "⚠ Income-driven", "⚠ Contraction", "⚠ Contraction-driven",
]);
const BAD_TEXT = /NaN|undefined|Infinity/;

function walkNumbers(obj, pathStr, out) {
  if (obj == null) return;
  if (typeof obj === "number") { if (!Number.isFinite(obj)) out.push(`${pathStr} = ${obj}`); return; }
  if (typeof obj === "string") { if (BAD_TEXT.test(obj)) out.push(`${pathStr} contains bad token: "${obj.slice(0, 80)}"`); return; }
  if (Array.isArray(obj)) { obj.forEach((v, i) => walkNumbers(v, `${pathStr}[${i}]`, out)); return; }
  if (typeof obj === "object") for (const [k, v] of Object.entries(obj)) walkNumbers(v, `${pathStr}.${k}`, out);
}

const approxEq = (a, b, rel = 1e-12) => Math.abs(a - b) <= rel * Math.max(1, Math.abs(a), Math.abs(b));

export function checkYear(d, m, tier) {
  const fails = []; const skips = [];
  const F = (a, msg) => fails.push({ assertion: a, message: msg });
  const S = (a, why) => skips.push({ assertion: a, reason: why });

  // A2
  const bad = []; walkNumbers(m, "out", bad);
  for (const b of bad) F("A2-finite", b);
  if (tier !== "valid") return { fails, skips };

  const { totalIncome, adjustedGrossIncome: agi, taxableIncome, totalTax } = d.summary;
  const inc = d.income;
  const clip = (v) => Math.max(v ?? 0, 0);
  const partsSum = clip(inc.wages) + clip(inc.capitalGains) + clip(inc.interest) + clip(inc.dividends) + clip(inc.additionalIncome);

  // A3 — shape and null rules
  const requiredKeys = ["incomeBreakdown", "taxRate", "afterTaxIncome", "agiRatio", "taxableRatio", "effectiveTaxRate", "taxToIncome", "deductionEfficiency", "afterTaxMargin", "isLossDriven", "falseSignals", "primarySignal", "healthScore", "healthLabel", "healthColor", "insights"];
  for (const k of requiredKeys) if (!(k in m)) F("A3-shape", `missing output key ${k}`);
  const nullIff = (name, value, denomIsZero) => {
    if (denomIsZero) { if (value !== null) F("A3-null", `${name} should be null (denominator 0) but is ${value}`); }
    else if (typeof value !== "number") F("A3-null", `${name} should be a number but is ${JSON.stringify(value)}`);
  };
  // Contract (since the loss-year fix): ratios over total income are null unless totalIncome > 0.
  nullIff("agiRatio", m.agiRatio, !(totalIncome > 0));
  nullIff("taxableRatio", m.taxableRatio, !(agi > 0));
  nullIff("effectiveTaxRate", m.effectiveTaxRate, !taxableIncome);
  nullIff("taxToIncome", m.taxToIncome, !(totalIncome > 0));
  nullIff("deductionEfficiency", m.deductionEfficiency, !(totalIncome > 0));
  nullIff("afterTaxMargin", m.afterTaxMargin, !(totalIncome > 0));
  if (typeof m.afterTaxIncome !== "number") F("A3-null", `afterTaxIncome should be a number (inputs non-null) but is ${m.afterTaxIncome}`);
  if (!Object.is(m.taxRate, m.taxToIncome)) F("A3-shape", `taxRate (${m.taxRate}) !== taxToIncome (${m.taxToIncome})`);
  for (const k of ["wagesPct", "capitalGainsPct", "interestPct", "dividendsPct", "otherPct"]) nullIff(`incomeBreakdown.${k}`, m.incomeBreakdown?.[k], partsSum === 0);
  if (typeof m.isLossDriven !== "boolean") F("A3-shape", `isLossDriven not boolean: ${m.isLossDriven}`);

  // A4 — composition
  if (partsSum > 0) {
    const b = m.incomeBreakdown;
    const sum = (b.wagesPct ?? 0) + (b.capitalGainsPct ?? 0) + (b.interestPct ?? 0) + (b.dividendsPct ?? 0) + (b.otherPct ?? 0);
    if (Math.abs(sum - 1) > 1e-9) F("A4-composition", `composition sums to ${sum} (parts sum ${partsSum})`);
    for (const [k, v] of Object.entries(b)) if (typeof v === "number" && (v < 0 || v > 1 + 1e-12)) F("A4-composition", `${k} out of [0,1]: ${v}`);
  } else S("A4-composition", "all clipped income components are 0 → percentages are null by contract");

  // A5 — taxable within [0, max(0, AGI)] via derived ratios
  if (agi > 0 && typeof m.taxableRatio === "number") {
    if (m.taxableRatio < 0 || m.taxableRatio > 1 + 1e-12) F("A5-taxable-range", `taxableRatio ${m.taxableRatio} implies taxable outside [0, AGI]`);
  } else S("A5-taxable-range", agi > 0 ? "taxableRatio null" : "AGI <= 0 → ratio sign is not meaningful");
  if (totalIncome > 0 && agi >= 0 && typeof m.deductionEfficiency === "number") {
    if (m.deductionEfficiency < -1e-12) F("A5-taxable-range", `deductionEfficiency ${m.deductionEfficiency} < 0 implies taxable > AGI`);
  } else S("A5-deduction-sign", "totalIncome <= 0 or AGI < 0 → sign not meaningful");

  // A6 — non-negative liability, derived
  if (typeof m.afterTaxIncome === "number" && m.afterTaxIncome > totalIncome + 1e-9) F("A6-tax-nonneg", `afterTaxIncome ${m.afterTaxIncome} > totalIncome ${totalIncome}`);
  if (totalIncome > 0) { if (m.taxToIncome < 0) F("A6-tax-nonneg", `taxToIncome negative: ${m.taxToIncome}`); } else S("A6-taxToIncome-sign", "totalIncome <= 0");
  if (taxableIncome > 0) { if (m.effectiveTaxRate < 0) F("A6-tax-nonneg", `effectiveTaxRate negative: ${m.effectiveTaxRate}`); } else S("A6-etr-sign", "taxableIncome = 0 → ETR null by contract");

  // A7 — formula conformance (expected from INPUT + CLAUDE.md §1.1)
  const exp = {
    afterTaxIncome: totalIncome - totalTax,
    effectiveTaxRate: taxableIncome ? totalTax / taxableIncome : null,
    taxToIncome: totalIncome > 0 ? totalTax / totalIncome : null,
    afterTaxMargin: totalIncome > 0 ? (totalIncome - totalTax) / totalIncome : null,
    agiRatio: totalIncome > 0 ? agi / totalIncome : null,
    taxableRatio: agi > 0 ? taxableIncome / agi : null,
    deductionEfficiency: totalIncome > 0 ? (agi - taxableIncome) / totalIncome : null,
  };
  for (const [k, e] of Object.entries(exp)) {
    const a = m[k];
    if (e === null) continue; // null rule already covered by A3
    if (typeof a !== "number" || !approxEq(a, e)) F("A7-formula", `${k}: engine ${a} vs spec ${e}`);
  }
  if (partsSum > 0) {
    const b = m.incomeBreakdown;
    const expB = { wagesPct: clip(inc.wages) / partsSum, capitalGainsPct: clip(inc.capitalGains) / partsSum, interestPct: clip(inc.interest) / partsSum, dividendsPct: clip(inc.dividends) / partsSum, otherPct: clip(inc.additionalIncome) / partsSum };
    for (const [k, e] of Object.entries(expB)) if (!approxEq(b[k], e, 1e-9)) F("A7-formula", `incomeBreakdown.${k}: engine ${b[k]} vs spec ${e}`);
  }

  // A8 — structure
  if (!Array.isArray(m.falseSignals)) F("A8-structure", "falseSignals not an array");
  else {
    let lastRank = -1;
    for (const s of m.falseSignals) {
      if (!KNOWN_FLAGS.has(s.flag)) F("A8-structure", `unknown flag ${s.flag}`);
      const rank = SEVERITY_ORDER.indexOf(s.severity);
      if (rank < 0) F("A8-structure", `unknown severity ${s.severity}`);
      if (rank < lastRank) F("A8-structure", `falseSignals not sorted by severity at ${s.flag}`);
      lastRank = Math.max(lastRank, rank);
      if (typeof s.override !== "string" || !s.override) F("A8-structure", `flag ${s.flag} has no override text`);
    }
    const expPrimary = m.falseSignals[0] ?? null;
    if (m.primarySignal !== expPrimary) F("A8-structure", "primarySignal !== falseSignals[0] ?? null");
  }
  if (!Number.isInteger(m.healthScore) || m.healthScore < 0 || m.healthScore > 100) F("A8-structure", `healthScore ${m.healthScore} not an integer in [0,100]`);
  const expLabel = m.healthScore >= 80 ? "Strong" : m.healthScore >= 60 ? "Stable" : m.healthScore >= 40 ? "Moderate" : m.healthScore >= 20 ? "At Risk" : "Critical";
  if (m.healthLabel !== expLabel) F("A8-structure", `healthLabel ${m.healthLabel} inconsistent with score ${m.healthScore}`);
  const expColor = m.healthScore >= 80 ? "positive" : m.healthScore >= 60 ? "neutral" : m.healthScore >= 40 ? "caution" : "danger";
  if (m.healthColor !== expColor) F("A8-structure", `healthColor ${m.healthColor} inconsistent with score ${m.healthScore}`);
  const sig = m.insights?.signals;
  if (!sig || typeof sig !== "object") F("A8-structure", "insights.signals missing");
  else for (const k of ["agi", "tax", "deduction", "margin"]) {
    if (!(k in sig)) { F("A8-structure", `signals.${k} missing`); continue; }
    const s = sig[k];
    if (s === null) continue;
    if (!KNOWN_LABELS.has(s.label)) F("A8-structure", `signals.${k} unknown label "${s.label}"`);
    if (!["low", "mid", "high"].includes(s.level)) F("A8-structure", `signals.${k} bad level ${s.level}`);
  }
  const sum = m.insights?.summary;
  if (sum !== null && !Array.isArray(sum)) F("A8-structure", "insights.summary must be null or array");
  if (Array.isArray(sum)) {
    if (sum.length === 0) F("A8-structure", "insights.summary is an empty array (contract: null when empty)");
    for (const it of sum) if (typeof it?.text !== "string" || !it.text || typeof it.metric !== "string") F("A8-structure", `bad summary item ${JSON.stringify(it)}`);
  }
  return { fails, skips };
}

export function checkPipeline(p) {
  const fails = [];
  const F = (a, msg) => fails.push({ assertion: a, message: msg });
  for (const k of ["incomeCagr", "afterTaxCagr", "taxRateDelta"]) {
    const v = p[k];
    if (v !== null && (typeof v !== "number" || !Number.isFinite(v))) F("A9-pipeline", `${k} = ${v}`);
  }
  const bad = [];
  walkNumbers({ strategyPhase: p.strategyPhase, trend: p.overriddenInsights, strategyTab: p.strategyTab, yearInsights: p.yearInsights, why: p.whyBullets, overview: p.overviewSentence }, "pipeline", bad);
  for (const b of bad) F("A9-pipeline", b);
  for (const n of collectNarrative(p)) if (typeof n.text !== "string" || !n.text.trim()) F("A9-pipeline", `empty narrative at ${n.surface}`);
  return fails;
}

// Run one household end to end. Returns { exception, yearResults, pipelineFails, metrics }.
export function runHousehold(h) {
  const collected = toCollected(h);
  try {
    const p = runPipeline(collected);
    const yearResults = p.results.map((d, i) => ({ year: d.year, ...checkYear(d, p.metrics[i], h.tier) }));
    const pipelineFails = h.tier === "valid" ? checkPipeline(p) : [];
    return { exception: null, yearResults, pipelineFails, metrics: p.metrics, pipeline: p };
  } catch (e) {
    return { exception: e, yearResults: [], pipelineFails: [], metrics: null, pipeline: null };
  }
}

export function generatePopulation(seed, n) {
  const rng = makeRng(seed);
  const out = [];
  for (let i = 0; i < n; i++) out.push(generateHousehold(rng, i));
  return out;
}

// ── Main ────────────────────────────────────────────────────────────────────
function parseArgs(argv) {
  const o = { seed: DEFAULT_SEED, n: DEFAULT_N, showSkips: false };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--seed") o.seed = Number(argv[++i]);
    else if (argv[i] === "--n") o.n = Number(argv[++i]);
    else if (argv[i] === "--show-skips") o.showSkips = true;
    else if (/^\d+$/.test(argv[i])) o.seed = Number(argv[i]);
  }
  if (!Number.isInteger(o.seed)) throw new Error("seed must be an integer");
  return o;
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  const t0 = Date.now();
  console.log(`TaxVista fuzz — seed ${opts.seed}, ${opts.n} generated households + ${EDGE_CASES.length} edge + ${WARNED_CASES.length} warned + ${MALFORMED_CASES.length} malformed`);
  console.log(`Year window (MOST_RECENT_TAX_YEAR logic): ${[...YEAR_OPTIONS].sort().join(", ")}`);

  const population = generatePopulation(opts.seed, opts.n);
  const counts = { generated: 0, passed: 0, failed: 0, skippedAssertions: {}, invariantRejected: 0 };
  const coverage = { byFormMix: {}, byYears: {}, byProfile: {}, byFeature: {} };
  const bump = (o, k) => { o[k] = (o[k] ?? 0) + 1; };
  const validFailures = [];

  const runValidTier = (h, label) => {
    counts.generated++;
    const inv = generatorInvariantViolations(h);
    if (inv.length) { counts.invariantRejected++; validFailures.push({ h, label, generatorInvariant: inv }); return; }
    const mix = h.forms.every(f => f === "1040") ? "all-1040" : h.forms.every(f => f === "1040-NR") ? "all-1040-NR" : "mixed";
    bump(coverage.byFormMix, mix); bump(coverage.byYears, h.years.length); bump(coverage.byProfile, h.profile);
    for (const f of h.features) bump(coverage.byFeature, f);
    const res = runHousehold(h);
    const fails = [];
    if (res.exception) fails.push({ year: null, assertion: "A1-exception", message: String(res.exception?.stack ?? res.exception) });
    for (const yr of res.yearResults) {
      for (const f of yr.fails) fails.push({ year: yr.year, ...f });
      for (const s of yr.skips) bump(counts.skippedAssertions, `${s.assertion}: ${s.reason}`);
    }
    for (const f of res.pipelineFails) fails.push({ year: null, ...f });
    if (fails.length) { counts.failed++; validFailures.push({ h, label, fails, metrics: res.metrics }); }
    else counts.passed++;
  };

  population.forEach(h => runValidTier(h, "generated"));
  EDGE_CASES.forEach(h => runValidTier(h, "edge"));

  // Warned tier
  const warnedResults = [];
  for (const h of WARNED_CASES) {
    const res = runHousehold(h);
    const issues = [];
    if (res.exception) issues.push(`A1-exception: ${res.exception.message}`);
    for (const yr of res.yearResults) for (const f of yr.fails) issues.push(`${yr.year} ${f.assertion}: ${f.message}`);
    warnedResults.push({ h, issues, metrics: res.metrics });
  }

  // Malformed tier
  const malformedResults = [];
  for (const c of MALFORMED_CASES) {
    let outcome, detail = "";
    try {
      const m = calculateMetrics(c.data, c.compare);
      const bad = []; walkNumbers(m, "out", bad);
      outcome = bad.length ? "accepted-with-NaN/Infinity" : "accepted-clean";
      detail = bad.slice(0, 6).join("; ");
    } catch (e) { outcome = "throws"; detail = `${e.constructor.name}: ${e.message}`; }
    malformedResults.push({ id: c.id, outcome, detail });
  }

  // ── Report ──
  console.log("\n══════════════ VALID-TIER FAILURES ══════════════");
  if (validFailures.length === 0) console.log("(none)");
  for (const vf of validFailures) {
    console.log(`\n--- seed=${opts.seed} case=${vf.h.id} (${vf.label}, profile=${vf.h.profile}, years=${vf.h.years.map(y => y.year).join("/")}, forms=${vf.h.forms.join("/")})`);
    if (vf.generatorInvariant) { console.log(`  GENERATOR INVARIANT VIOLATED (case excluded): ${vf.generatorInvariant.join("; ")}`); continue; }
    for (const f of vf.fails) console.log(`  [${f.assertion}]${f.year ? ` year ${f.year}` : ""}: ${f.message}`);
    console.log("  INPUT:  " + JSON.stringify(toCollected(vf.h)));
    console.log("  OUTPUT: " + JSON.stringify(vf.metrics));
  }

  console.log("\n══════════════ WARNED-TIER RESULTS (UI warns but still analyzes; informational) ══════════════");
  for (const w of warnedResults) {
    console.log(`${w.h.id}: ${w.issues.length ? w.issues.join(" | ") : "no finiteness issues"}`);
  }

  console.log("\n══════════════ MALFORMED-TIER RESULTS (not reachable from UI; informational) ══════════════");
  for (const m of malformedResults) console.log(`${m.id}: ${m.outcome}${m.detail ? " — " + m.detail : ""}`);

  console.log("\n══════════════ COUNTS ══════════════");
  console.log(`generated (incl. edge): ${counts.generated}`);
  console.log(`passed:                 ${counts.passed}`);
  console.log(`failed:                 ${counts.failed}`);
  console.log(`generator-rejected:     ${counts.invariantRejected}`);
  console.log(`warned tier:            ${warnedResults.length} cases, ${warnedResults.filter(w => w.issues.length).length} with finiteness/exception issues`);
  console.log(`malformed tier:         ${malformedResults.length} cases — ${["throws", "accepted-clean", "accepted-with-NaN/Infinity"].map(k => `${k}: ${malformedResults.filter(m => m.outcome === k).length}`).join(", ")}`);
  console.log("skipped assertions by reason (per year-case):");
  for (const [k, v] of Object.entries(counts.skippedAssertions).sort()) console.log(`  ${String(v).padStart(6)}  ${k}`);

  console.log("\n══════════════ COVERAGE ══════════════");
  console.log("by form mix:   " + JSON.stringify(coverage.byFormMix));
  console.log("by # of years: " + JSON.stringify(Object.fromEntries(Object.entries(coverage.byYears).sort())));
  console.log("by profile:    " + JSON.stringify(coverage.byProfile));
  console.log("by feature:    " + JSON.stringify(coverage.byFeature));
  console.log(`\nDone in ${Date.now() - t0} ms. Exit code ${counts.failed ? 1 : 0}.`);
  process.exit(counts.failed ? 1 : 0);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
