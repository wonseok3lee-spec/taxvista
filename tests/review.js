#!/usr/bin/env node
// tests/review.js — plausibility review of calculateMetrics() + the multi-year narrative layer
// against an INDEPENDENT reference calculator (tests/reference-tax.js).
//
//   node tests/review.js            # prints the full review to stdout
//   node tests/review.js --json     # also dumps machine-readable results to stdout (last line)
//
// What is compared and why it matters (see review-report.md "Scope and limits"):
//   • calculateMetrics() does NOT compute tax. totalTax, taxableIncome, AGI and totalIncome are
//     user-entered 1040 lines passed straight through. So "engine totalTax vs reference" is only
//     informative for inputs the app ships itself (the 6 landing-page demo cases): a mismatch
//     there is a demo-data problem, not an engine computation error.
//   • For fuzz-selected households the reference is used to BUILD internally consistent inputs
//     (standard deduction for the year, bracket + preferential-rate tax) so that the derived
//     metrics and the narrative text are reviewed on realistic numbers. The generator's own
//     random tax is kept alongside to show how far an unchecked Line 24 can drift.
//   • Tolerance for a tax comparison: max($50, 2% of the band's upper edge). The $50 covers the
//     IRS tax-table step; 2% covers rounding and small credits.

import { fileURLToPath } from "node:url";
import path from "node:path";
import { DEFAULT_SEED, DEFAULT_N, generatePopulation, toCollected, EDGE_CASES, runHousehold } from "./fuzz.js";
import { loadDemoCases, collectYears, runPipeline, collectNarrative, runValidation, YEAR_OPTIONS, MOST_RECENT_TAX_YEAR, HIGH_INCOME_THRESHOLD } from "./app-mirror.js";
import { referenceYear, taxBand, PARAMS, SOURCES, hasParams, standardDeduction, preferentialTax, seTax, ficaTax } from "./reference-tax.js";

const fmtD = (v) => v == null ? "—" : (v < 0 ? "-$" : "$") + Math.round(Math.abs(v)).toLocaleString();
const fmtP = (v) => v == null ? "—" : (v * 100).toFixed(1) + "%";
const pad = (s, n) => String(s).padEnd(n);
const padr = (s, n) => String(s).padStart(n);

// ── 1. Case selection ───────────────────────────────────────────────────────
function latestTotal(h) { return h.years[h.years.length - 1].summary.totalIncome; }
function bucketsFor(h) {
  const b = [];
  const n = h.years.length;
  const lt = latestTotal(h);
  const hasNR = h.forms.some(f => f === "1040-NR");
  const allNR = h.forms.every(f => f === "1040-NR");
  const transition = h.forms.some((f, i) => i > 0 && h.forms[i - 1] === "1040-NR" && f === "1040");
  const loss = h.years.some(y => (y.income.capitalGains ?? 0) < 0 || (y.income.additionalIncome ?? 0) < 0);
  if (h.profile === "zero-income" && h.years.some(y => y.summary.totalIncome === 0)) b.push("zero-income");
  if (h.years.some(y => y.summary.totalIncome < 0)) b.push("negative-total");
  if (h.features.includes("cap-gain-spike")) b.push("cap-gain-spike");
  if (h.profile === "income-collapse" && n > 1) b.push("income-collapse");
  if (h.profile === "very-high") b.push("very-high");
  if (transition) b.push("nr-transition");
  if (allNR) b.push(n > 1 ? "nr-only/multi" : "nr-only/single");
  if (loss && !hasNR) b.push(n > 1 ? "loss/multi" : "loss/single");
  if (!hasNR && !loss) {
    const band = lt < 40000 ? "low" : lt < 150000 ? "middle" : "high";
    b.push(`${band}/${n > 1 ? "multi" : "single"}`);
  }
  return b;
}
const QUOTAS = {
  "zero-income": 1, "negative-total": 1, "cap-gain-spike": 1, "income-collapse": 1, "very-high": 1,
  "nr-transition": 3, "nr-only/single": 1, "nr-only/multi": 2,
  "loss/single": 2, "loss/multi": 4,
  "low/single": 2, "low/multi": 3, "middle/single": 2, "middle/multi": 4, "high/single": 2, "high/multi": 4,
};

function selectFuzzCases(population) {
  const filled = Object.fromEntries(Object.keys(QUOTAS).map(k => [k, 0]));
  const chosen = [];
  for (const h of population) {
    const bs = bucketsFor(h);
    const slot = bs.find(k => filled[k] < QUOTAS[k]);
    if (!slot) continue;
    filled[slot]++;
    chosen.push({ h, stratum: slot });
    if (Object.keys(QUOTAS).every(k => filled[k] >= QUOTAS[k])) break;
  }
  return { chosen, filled };
}

// Rebuild a fuzz household's reported lines so they are consistent with the reference
// (standard deduction for the year, bracket + preferential tax). Income components are kept
// exactly as the engine would see them (including omitted/null optional fields).
function referenceConsistent(h) {
  const selfEmployed = h.profile === "self-employed";
  const years = h.years.map(y => {
    const t = y._true;
    const year = y.year;
    if (!hasParams(year)) return { ...structuredClone(y), _rawTax: y.summary.totalTax, _unverified: true };
    // A generator amount that merely "looks like" a standard deduction becomes the real standard
    // deduction for the year; a genuinely itemized amount is kept if it beats the standard one.
    const STD_LIKE = [12550, 12950, 13850, 14600, 15000, 15750];
    const std = standardDeduction(year, false);
    const ded = y.isNR ? t.deductions : (STD_LIKE.includes(t.deductions) ? std : Math.max(std, t.deductions));
    const total = y.summary.totalIncome;
    const agi = y.summary.adjustedGrossIncome;
    const taxable = Math.max(0, Math.round(agi - ded));
    const pref = Math.max(0, t.capitalGains) + Math.max(0, t.dividends);
    const se = selfEmployed ? seTax(t.other, t.wages, year) : null;
    const tax = Math.round(preferentialTax(taxable, pref, year) + (se?.total ?? 0));
    const copy = structuredClone(y);
    copy.deductions = { itemized: y.deductions.itemized == null ? null : ded };
    copy.summary = { totalIncome: total, adjustedGrossIncome: agi, taxableIncome: taxable, totalTax: tax };
    copy._true = { ...t, deductions: ded };
    copy._rawTax = y.summary.totalTax;
    return copy;
  });
  return { ...h, years, selfEmployed };
}

function buildCases() {
  const cases = [];
  // Demo cases — exactly what loadDemoCase() feeds runAnalysis()
  for (const d of loadDemoCases()) {
    const collected = collectYears(d.years, d.forms, d.data);
    cases.push({
      id: `demo:${d.id}`, group: "demo", label: `${d.label} — ${d.summary}`, stratum: "demo",
      forms: d.years.map(y => d.forms[y]), collected, selfEmployed: d.id === "freelancer",
      validationWarnings: runValidation(d.years, d.forms, d.data),
      reported: collected.map(c => ({ deductions: c.deductions.itemized, adjustments: c.adjustments.totalAdjustments })),
    });
  }
  // Fuzz-stratified cases
  const population = generatePopulation(DEFAULT_SEED, DEFAULT_N);
  const { chosen, filled } = selectFuzzCases(population);
  for (const { h, stratum } of chosen) {
    const hc = referenceConsistent(h);
    cases.push({
      id: `fuzz:${h.id}`, group: "fuzz", label: `profile=${h.profile}`, stratum,
      forms: h.forms, collected: toCollected(hc), selfEmployed: hc.selfEmployed,
      rawTax: hc.years.map(y => y._rawTax), truth: hc.years.map(y => y._true), validationWarnings: [],
      reported: hc.years.map(y => ({ deductions: y._true.deductions, adjustments: y._true.adjustments })),
    });
  }
  // A few hand-written edges that the strata above cannot produce from reference-consistent data
  for (const e of EDGE_CASES.filter(e => ["E02-zero-eci-with-nec-tax-NR", "E03-negative-total-income-schC-loss", "E04-negative-prior-then-positive", "E23-only-social-security-field"].includes(e.id))) {
    cases.push({ id: `edge:${e.id}`, group: "edge", label: e.id, stratum: "edge", forms: e.forms, collected: toCollected(e), selfEmployed: false, validationWarnings: [], reported: e.years.map(y => ({ deductions: y.deductions.itemized, adjustments: y.adjustments.totalAdjustments })) });
  }
  return { cases, population, filled };
}

// ── 2/3. Reference comparison per year ──────────────────────────────────────
function compareYear(c, y, m, i) {
  const year = y.year;
  const inc = y.income, s = y.summary;
  const reportedDed = c.reported[i]?.deductions ?? null;
  const verified = hasParams(year);
  // For fuzz cases the engine may see omitted (null) optional fields; the reference band must use
  // the generator's true components, exactly as the reported Line 24 was built from them.
  const tr = c.truth?.[i];
  const cgT = tr ? tr.capitalGains : (inc.capitalGains ?? 0);
  const divT = tr ? tr.dividends : (inc.dividends ?? 0);
  const otherT = tr ? tr.other : (inc.additionalIncome ?? 0);
  const wagesT = tr ? tr.wages : (inc.wages ?? 0);
  const pref = Math.max(0, cgT) + Math.max(0, divT);
  const se = c.selfEmployed && verified ? seTax(otherT, wagesT, year) : null;
  const ref = referenceYear({ year, isNR: y.isNR, wages: inc.wages, interest: inc.interest, dividends: inc.dividends, capitalGains: inc.capitalGains, otherIncome: inc.additionalIncome, socialSecurity: inc.socialSecurity, adjustments: c.reported[i]?.adjustments ?? 0, deductions: reportedDed, selfEmployed: c.selfEmployed });
  const std = verified ? standardDeduction(year, y.isNR) : null;
  const band = verified ? taxBand(s.taxableIncome, pref, year, se) : null;
  const tol = band ? Math.max(50, 0.02 * band.high) : null;
  const out = { year, form: y.isNR ? "1040-NR" : "1040", verified, std, reportedDed, band, tol, issues: [] };

  // Components → total (what the composition chart is based on vs what the engine divides by)
  const partsEntered = ["wages", "interest", "dividends", "capitalGains", "additionalIncome", "socialSecurity"].reduce((a, k) => a + (inc[k] ?? 0), 0);
  out.componentGap = s.totalIncome - partsEntered;
  if (Math.abs(out.componentGap) > 1) out.issues.push({ rule: "C6-components-vs-total", class: c.group === "demo" ? "demo-data" : "input", msg: `entered components sum to ${fmtD(partsEntered)} but Line 9 total is ${fmtD(s.totalIncome)} (gap ${fmtD(out.componentGap)}) — composition % are of the parts, not of total income` });
  if ((inc.socialSecurity ?? 0) > 0) out.issues.push({ rule: "C7-social-security-excluded", class: "engine-simplification", msg: `socialSecurity ${fmtD(inc.socialSecurity)} is ${fmtP(inc.socialSecurity / s.totalIncome)} of total income but is excluded from the composition denominator (calculateMetrics.js:12-19)` });

  if (!verified) { out.issues.push({ rule: "C0-unverified-year", class: "reference-uncertainty", msg: `no verified IRS parameters for ${year}` }); return out; }

  // C1 taxable arithmetic: Line 15 = max(0, Line 11 − Line 12 − Line 13); with no Line 13 data, taxable should be ≤ agi − deductions.
  if (reportedDed != null) {
    const expectedTaxable = Math.max(0, s.adjustedGrossIncome - reportedDed);
    out.taxableExpected = expectedTaxable;
    const diff = s.taxableIncome - expectedTaxable;
    if (Math.abs(diff) > 1) out.issues.push({ rule: "C1-taxable-arithmetic", class: c.group === "demo" ? "demo-data" : "input", msg: `taxable ${fmtD(s.taxableIncome)} ≠ AGI − deductions ${fmtD(expectedTaxable)} (diff ${fmtD(diff)})` });
  }
  // C2 deduction vs standard deduction for the year (1040 only)
  if (!y.isNR && reportedDed != null) {
    if (reportedDed < std - 0.5) out.issues.push({ rule: "C2-deduction-below-standard", class: c.group === "demo" ? "demo-data" : "input", msg: `reported deduction ${fmtD(reportedDed)} is below the ${year} single standard deduction ${fmtD(std)} (${SOURCES[PARAMS[year].sources.stdDeduction.split(" ")[0]]?.doc ?? PARAMS[year].sources.stdDeduction})` });
    else if (Math.abs(reportedDed - std) < 0.5) out.dedStatus = "equals standard";
    else out.dedStatus = `above standard (+${fmtD(reportedDed - std)})`;
    if (reportedDed > std + 0.5) {
      const otherYearStd = Object.entries(PARAMS).find(([yy, p]) => Number(yy) !== year && (Math.abs(p.stdDeduction - reportedDed) < 0.5 || (p.stdDeductionAgedUnmarriedAddl && Math.abs(p.stdDeduction + p.stdDeductionAgedUnmarriedAddl - reportedDed) < 0.5)));
      if (otherYearStd) out.issues.push({ rule: "C2b-deduction-from-other-year", class: c.group === "demo" ? "demo-data" : "input", msg: `reported deduction ${fmtD(reportedDed)} equals the ${otherYearStd[0]} standard deduction${Math.abs(otherYearStd[1].stdDeduction - reportedDed) < 0.5 ? "" : " (65+)"}, not ${year}'s ${fmtD(std)}` });
    }
  }
  if (y.isNR && reportedDed != null && reportedDed > 0 && [12550, 12950, 13850, 14600, 15000, 15750].includes(reportedDed)) out.issues.push({ rule: "C2c-NR-standard-deduction", class: "input", msg: `1040-NR year reports a standard-deduction-sized amount ${fmtD(reportedDed)}; nonresidents cannot claim the standard deduction (${SOURCES.nra_tax.url})` });

  // C3 tax vs reference band on the REPORTED taxable income
  const tax = s.totalTax;
  const lo = band.low - tol, hi = band.high + tol;
  out.taxInBand = tax >= lo && tax <= hi;
  out.taxDiff = tax < lo ? tax - band.low : tax > hi ? tax - band.high : 0;
  if (!out.taxInBand) out.issues.push({ rule: "C3-tax-outside-band", class: c.group === "demo" ? "demo-data" : "input", msg: `Line 24 ${fmtD(tax)} is outside the reference band [${fmtD(band.low)}, ${fmtD(band.high)}] ±${fmtD(tol)} for taxable ${fmtD(s.taxableIncome)} (${fmtD(out.taxDiff)} beyond edge)` });
  // C4 effective rate — engine value vs reference-derived range
  if (m.effectiveTaxRate != null && s.taxableIncome > 0) {
    out.etrBand = [band.low / s.taxableIncome, band.high / s.taxableIncome];
    const inRange = m.effectiveTaxRate >= (band.low - tol) / s.taxableIncome && m.effectiveTaxRate <= (band.high + tol) / s.taxableIncome;
    if (!inRange) out.issues.push({ rule: "C4-etr-outside-band", class: "follows-C3", msg: `engine ETR ${fmtP(m.effectiveTaxRate)} vs reference range ${fmtP(out.etrBand[0])}–${fmtP(out.etrBand[1])}` });
  }
  // C5 take-home: engine identity + the FICA-inclusive figure the reference can compute
  const fica = ficaTax(inc.wages ?? 0, year);
  out.fica = fica.total;
  out.takeHomeAfterFica = s.totalIncome - tax - fica.total;
  if (Math.abs(m.afterTaxIncome - (s.totalIncome - tax)) > 0.005) out.issues.push({ rule: "C5-takehome-identity", class: "engine-bug", msg: `afterTaxIncome ${m.afterTaxIncome} ≠ totalIncome − totalTax ${s.totalIncome - tax}` });
  if (fica.total > 0) out.issues.push({ rule: "C5b-fica-omitted", class: "intentional-simplification", msg: `take-home ${fmtD(m.afterTaxIncome)} ignores employee FICA ${fmtD(fica.total)} (${fmtP(fica.total / s.totalIncome)} of income) → ${fmtD(out.takeHomeAfterFica)} after FICA` });
  // Reference-from-components (what a consistent return would show)
  out.ref = ref;
  if (c.group === "fuzz" && c.rawTax) {
    const raw = c.rawTax[i];
    out.rawTax = raw;
    out.rawTaxInBand = raw >= lo && raw <= hi;
  }
  return out;
}

// ── 4/5. Narrative and plausibility rules ───────────────────────────────────
const OVERCLAIM_PHRASES = [
  "Increase pre-tax contributions immediately",
  "Shift future income toward tax-advantaged sources",
  "Without optimization, this leakage will compound",
  "Without adjustment, taxes will scale faster than income growth",
  "taxed at 0–20% vs ordinary rates of 22–37%",
  "Mega Backdoor Roth",
  "Backdoor Roth IRA",
  "max 401k ($23,500 in 2025)",
  "HSA if eligible ($4,300 single)",
  "Verify W-4",
  "withholding review",
  "Over-withholding",
  "verify withholding is accurate",
  "itemizing (if eligible) is the only lever",
  "Review whether itemizing would beat the standard deduction",
  "will continue to compress without structural changes",
  "this diversification will reduce effective tax burden over time",
];

function reviewNarrative(c, p) {
  const flags = [];
  const F = (rule, msg, surface) => flags.push({ rule, msg, surface });
  const narr = collectNarrative(p);
  const results = p.results, metrics = p.metrics;
  const last = results[results.length - 1], mLast = metrics[metrics.length - 1];
  const first = results[0];
  const hasNR = results.some(r => r.isNR);
  const latestNR = last.isNR;
  const latestWages = last.income.wages ?? 0;
  const texts = narr.map(n => n.text);

  // N1 — numbers quoted in insight text must equal the engine's metrics
  metrics.forEach((m, i) => {
    for (const it of m.insights?.summary ?? []) {
      const t = it.text;
      const etrM = t.match(/^Effective tax rate: ([\d.]+)%/);
      if (etrM && m.effectiveTaxRate != null && etrM[1] !== (m.effectiveTaxRate * 100).toFixed(1)) F("N1-text-number-mismatch", `${results[i].year}: text says ETR ${etrM[1]}% but metric is ${fmtP(m.effectiveTaxRate)}`, "insights.summary");
      const retM = t.match(/retaining ([\d.]+)% of total income/);
      if (retM && m.afterTaxMargin != null && retM[1] !== (m.afterTaxMargin * 100).toFixed(1)) F("N1-text-number-mismatch", `${results[i].year}: text says retaining ${retM[1]}% but margin is ${fmtP(m.afterTaxMargin)}`, "insights.summary");
      const deM = t.match(/Below-AGI deduction ratio: ([\d.]+)%/);
      if (deM && m.deductionEfficiency != null && deM[1] !== (m.deductionEfficiency * 100).toFixed(1)) F("N1-text-number-mismatch", `${results[i].year}: text says DE ${deM[1]}% but metric is ${fmtP(m.deductionEfficiency)}`, "insights.summary");
      // N2 — direction words vs actual prior-year delta
      const dirM = t.match(/, (up|down) ([\d.]+) percentage points from/);
      if (dirM && i > 0 && m.effectiveTaxRate != null && metrics[i - 1].effectiveTaxRate != null) {
        const delta = m.effectiveTaxRate - metrics[i - 1].effectiveTaxRate;
        if ((dirM[1] === "up") !== (delta > 0)) F("N2-direction-contradiction", `${results[i].year}: text says "${dirM[1]}" but ETR delta is ${(delta * 100).toFixed(2)}pp`, "insights.summary");
      }
    }
    // N3 — contradictory signal tags (CLAUDE.md §5)
    const sg = m.insights?.signals ?? {};
    if (sg.tax?.label === "High tax burden" && sg.deduction?.label === "Strong deductions") F("N3-contradictory-tags", `${results[i].year}: "High tax burden" and "Strong deductions" in the same year`, "signals");
    if (sg.tax?.label === "Tax-efficient" && sg.margin?.label === "High tax drag") F("N3-contradictory-tags", `${results[i].year}: "Tax-efficient" with "High tax drag"`, "signals");
    // N3b — document says Tax-efficient < 10% (CLAUDE.md §4) but the engine uses < 15%
    if (sg.tax?.label === "Tax-efficient" && m.effectiveTaxRate != null && m.effectiveTaxRate >= 0.10) F("N3b-doc-threshold-mismatch", `${results[i].year}: ETR ${fmtP(m.effectiveTaxRate)} tagged "Tax-efficient" (CLAUDE.md §4 says < 10%; code uses < 15%)`, "signals");
    if (sg.tax?.label === "Tax: moderate" && m.effectiveTaxRate != null && m.effectiveTaxRate >= 0.20) F("N3b-doc-threshold-mismatch", `${results[i].year}: ETR ${fmtP(m.effectiveTaxRate)} tagged "Tax: moderate" (CLAUDE.md §4 band is 10–20%; code uses 15–25%)`, "signals");
    // P6 — false-signal sanity
    const prior = i > 0 ? results[i - 1] : null;
    for (const fs of m.falseSignals ?? []) {
      if (fs.flag === "INCOME_COLLAPSE" && prior && results[i].summary.totalIncome >= prior.summary.totalIncome) F("P6-signal-sign", `${results[i].year}: INCOME_COLLAPSE raised although income went ${fmtD(prior.summary.totalIncome)} → ${fmtD(results[i].summary.totalIncome)} (prior income ${prior.summary.totalIncome < 0 ? "negative" : "not greater"})`, "falseSignals");
      if (fs.flag === "FALSE_EFFICIENCY" && prior && results[i].summary.totalIncome >= prior.summary.totalIncome) F("P6-signal-sign", `${results[i].year}: FALSE_EFFICIENCY raised although income did not fall`, "falseSignals");
      if (fs.flag === "ONE_TIME_EVENT" && (results[i].income.capitalGains ?? 0) <= 0) F("P6-signal-sign", `${results[i].year}: ONE_TIME_EVENT without a positive capital gain`, "falseSignals");
    }
    // P4 — ratio ranges
    if (m.deductionEfficiency != null && (m.deductionEfficiency < 0 || m.deductionEfficiency > 1)) F("P4-ratio-range", `${results[i].year}: deductionEfficiency ${fmtP(m.deductionEfficiency)} outside [0,1]`, "metrics");
    if (m.taxableRatio != null && m.taxableRatio > 1) F("P4-ratio-range", `${results[i].year}: taxableRatio ${fmtP(m.taxableRatio)} > 100%`, "metrics");
    if (m.afterTaxMargin != null && m.afterTaxMargin > 1) F("P4-ratio-range", `${results[i].year}: afterTaxMargin ${fmtP(m.afterTaxMargin)} > 100%`, "metrics");
    if (m.afterTaxIncome != null && m.afterTaxIncome > results[i].summary.totalIncome) F("P1-takehome-gt-gross", `${results[i].year}: take-home ${fmtD(m.afterTaxIncome)} > gross ${fmtD(results[i].summary.totalIncome)}`, "metrics");
    if (m.afterTaxIncome != null && m.afterTaxIncome < 0) F("P1b-takehome-negative", `${results[i].year}: take-home ${fmtD(m.afterTaxIncome)} is negative (tax ${fmtD(results[i].summary.totalTax)} on income ${fmtD(results[i].summary.totalIncome)})`, "metrics");
    if (results[i].summary.totalIncome < 0 && (m.agiRatio != null || m.taxToIncome != null)) F("P5-negative-income-ratios", `${results[i].year}: ratios computed on negative total income (agiRatio ${fmtP(m.agiRatio)}, Tax/Income ${fmtP(m.taxToIncome)}, DE ${fmtP(m.deductionEfficiency)}, margin ${fmtP(m.afterTaxMargin)})`, "metrics");
    if (results[i].summary.totalIncome === 0 && results[i].summary.totalTax > 0) F("P5b-zero-income-with-tax", `${results[i].year}: tax ${fmtD(results[i].summary.totalTax)} on zero income → ETR/Tax-Income null, take-home negative, signals all null, health ${m.healthScore} "${m.healthLabel}"`, "metrics");
    // Health label vs burden
    if ((m.healthLabel === "Strong" || m.healthLabel === "Stable") && m.effectiveTaxRate != null && m.effectiveTaxRate > 0.25) F("P7-health-vs-burden", `${results[i].year}: health "${m.healthLabel}" (${m.healthScore}) with ETR ${fmtP(m.effectiveTaxRate)}`, "health");
  });

  // Trend-level rules
  if (results.length > 1) {
    const incomeGrowth = first.summary.totalIncome ? (last.summary.totalIncome - first.summary.totalIncome) / first.summary.totalIncome : null;
    const taxGrowth = first.summary.totalTax ? (last.summary.totalTax - first.summary.totalTax) / first.summary.totalTax : null;
    for (const t of p.overriddenInsights.map(x => x.text)) {
      if (t.startsWith("Tax obligation is growing in line with income") && ((incomeGrowth != null && incomeGrowth < 0) || (taxGrowth != null && taxGrowth < 0))) F("N4-growing-when-declining", `trend text says tax is "growing in line with income" but income change is ${fmtP(incomeGrowth)} and tax change is ${fmtP(taxGrowth)}`, "trendInsights");
      if (t.startsWith("After-tax income is growing slower than gross income") && incomeGrowth != null && incomeGrowth < 0) F("N4-growing-when-declining", `trend text says after-tax income is "growing slower" but gross income fell ${fmtP(incomeGrowth)}`, "trendInsights");
    }
    if (p.strategyPhase) {
      const ph = p.strategyPhase.phase;
      if (ph === "Income Contraction" && last.summary.totalIncome > first.summary.totalIncome) F("P8-phase-contradiction", `phase "${ph}" although income rose ${fmtD(first.summary.totalIncome)} → ${fmtD(last.summary.totalIncome)} (incomeCagr ${p.incomeCagr}, afterTaxCagr ${p.afterTaxCagr})`, "strategyPhase");
      if ((ph === "Accelerated Growth" || ph === "Steady Accumulation") && last.summary.totalIncome < first.summary.totalIncome) F("P8-phase-contradiction", `phase "${ph}" although income fell ${fmtD(first.summary.totalIncome)} → ${fmtD(last.summary.totalIncome)}`, "strategyPhase");
      if (p.lowBase) for (const t of [...p.strategyPhase.characteristics, p.strategyPhase.note, p.strategyPhase.implication]) if (/\d+(\.\d+)?% annualized/.test(t)) F("N5-lowbase-percent-leak", `growth % shown in strategy text despite low-base suppression: "${t.slice(0, 90)}"`, "strategyPhase");
    }
    for (const t of p.strategyTab?.dragBullets ?? []) if (/\$-|\(-\d|-\d+%/.test(t)) F("N6-negative-absorption", `drag bullet with negative absorbed amount: "${t.slice(0, 120)}"`, "strategy.dragBullets");
    if (p.strategyTab) for (const t of p.strategyTab.incomeBullets) if (p.lowBase === false && /Year-over-year/.test(t) && results.some(r => r.summary.totalIncome <= 0)) F("N7-yoy-on-nonpositive-base", `YoY % computed through a zero/negative income year: "${t.slice(0, 120)}"`, "strategy.incomeBullets");
  }
  // N8 — advice that cannot apply to the case type
  const joined = texts.join("\n");
  if (latestNR) {
    for (const ph of ["standard deduction", "Standard Deduction", "401k", "IRA", "HSA", "Backdoor Roth"]) if (joined.includes(ph)) { F("N8-advice-not-applicable-NR", `latest year is 1040-NR but narrative mentions "${ph}" (nonresidents cannot claim the standard deduction; retirement/HSA eligibility differs)`, "narrative"); break; }
  }
  if (latestWages === 0 && (last.income.wages != null) && /W-4|withholding/i.test(joined)) F("N8-advice-not-applicable-noW2", `latest year has $0 wages but narrative recommends a W-4/withholding review`, "narrative");
  if (latestWages === 0 && (last.income.wages != null) && /401k|Mega Backdoor/.test(joined)) F("N8-advice-not-applicable-noW2", `latest year has $0 wages but narrative recommends 401k contributions`, "narrative");
  if (last.summary.totalIncome <= 0 && joined.length) {
    for (const n of narr) if (n.year === last.year && n.surface === "yearInsight.etr") F("N8-zero-income-label", `zero/negative-income year labelled "${n.text}"`, "yearInsight");
  }
  // N9 — overclaim inventory
  const over = OVERCLAIM_PHRASES.filter(ph => joined.includes(ph));
  if (over.length) F("N9-overclaim-phrases", over.join(" | "), "narrative");
  // N10 — hard-coded 2025 limits shown for other years
  if (/\$23,500 in 2025|\$4,300 single/.test(joined) && last.year !== 2025) F("N10-stale-year-limits", `2025 contribution limits quoted for a ${last.year} analysis`, "narrative");
  // N11 — tax-growth text with "as earnings entered higher marginal brackets" when ETR actually fell
  if (p.taxRateDelta != null && p.taxRateDelta < 0 && /entered higher marginal brackets/.test(joined)) F("N11-bracket-claim-vs-rate", `text claims earnings "entered higher marginal brackets" but effective rate fell ${(p.taxRateDelta * 100).toFixed(1)}pp first→last`, "trendInsights");
  // N12 — NR transition sentence claims "expanded your taxable base" — check whether taxable/income actually rose at that year
  if (p.nrTransitionYear) {
    const idx = results.findIndex(r => r.year === p.nrTransitionYear);
    const prev = results[idx - 1], cur = results[idx];
    if (prev && cur && metrics[idx].taxableRatio != null && metrics[idx - 1].taxableRatio != null && metrics[idx].taxableRatio < metrics[idx - 1].taxableRatio) F("N12-nr-transition-claim", `NR→1040 text says the transition "expanded your taxable base" but taxable/AGI fell from ${fmtP(metrics[idx - 1].taxableRatio)} to ${fmtP(metrics[idx].taxableRatio)} (standard deduction became available)`, "nrTransition");
  }
  return flags;
}

// ── Population sweep (raw generator inputs, all 5,000 households) ───────────
function populationSweep(population) {
  const counts = {}; const examples = {};
  const hit = (rule, id, msg) => { counts[rule] = (counts[rule] ?? 0) + 1; if (!examples[rule]) examples[rule] = `${id}: ${msg}`; };
  let yearRows = 0, rawOutside = 0;
  for (const h of population) {
    const res = runHousehold(h);
    if (!res.pipeline) continue;
    const p = res.pipeline;
    const fakeCase = { group: "fuzz", id: h.id, reported: h.years.map(y => ({ deductions: y._true.deductions, adjustments: y._true.adjustments })), selfEmployed: h.profile === "self-employed" };
    const flags = reviewNarrative(fakeCase, p);
    for (const f of flags) if (!f.rule.startsWith("N9") && !f.rule.startsWith("N3b") && !f.rule.startsWith("C5b")) hit(f.rule, h.id, f.msg);
    p.results.forEach((y, i) => {
      if (!hasParams(y.year)) return;
      yearRows++;
      const inc = y.income; const s = y.summary;
      const pref = Math.max(0, inc.capitalGains ?? 0) + Math.max(0, inc.dividends ?? 0);
      const se = h.profile === "self-employed" ? seTax(inc.additionalIncome ?? 0, inc.wages ?? 0, y.year) : null;
      const band = taxBand(s.taxableIncome, pref, y.year, se);
      const tol = Math.max(50, 0.02 * band.high);
      if (s.totalTax < band.low - tol || s.totalTax > band.high + tol) rawOutside++;
    });
  }
  return { counts, examples, yearRows, rawOutside };
}

// ── Main ────────────────────────────────────────────────────────────────────
function main() {
  const wantJson = process.argv.includes("--json");
  const { cases, population, filled } = buildCases();
  console.log(`TaxVista plausibility review — ${cases.length} cases (${cases.filter(c => c.group === "demo").length} demo, ${cases.filter(c => c.group === "fuzz").length} fuzz-stratified, ${cases.filter(c => c.group === "edge").length} edge); fuzz seed ${DEFAULT_SEED}`);
  console.log(`Year window: ${[...YEAR_OPTIONS].sort().join(", ")} (MOST_RECENT_TAX_YEAR = ${MOST_RECENT_TAX_YEAR}); verified reference years: ${Object.keys(PARAMS).join(", ")}`);
  console.log(`Strata filled: ${JSON.stringify(filled)}`);
  console.log("\nReference parameters (single filer):");
  for (const [y, p] of Object.entries(PARAMS)) console.log(`  ${y}: std ${fmtD(p.stdDeduction)}${p.stdDeductionPreOBBB ? ` (pre-OBBB ${fmtD(p.stdDeductionPreOBBB)})` : ""}, brackets ${p.brackets.map(b => `${(b[1] * 100).toFixed(0)}%≤${b[0] === Infinity ? "∞" : fmtD(b[0])}`).join(" ")}, LTCG 0%≤${fmtD(p.cgZeroRateMax)} 15%≤${fmtD(p.cg15RateMax)}, SS wage base ${fmtD(p.ssWageBase)}  [${Object.values(p.sources).join("; ")}]`);
  console.log("  Sources: " + Object.entries(SOURCES).map(([k, s]) => `${k} → ${s.url}`).join("\n           "));

  const all = [];
  const ruleIndex = {};
  const addRule = (rule, cid, msg) => { (ruleIndex[rule] ??= []).push({ cid, msg }); };

  for (const c of cases) {
    const p = runPipeline(c.collected);
    const cmp = p.results.map((y, i) => compareYear(c, y, p.metrics[i], i));
    const flags = reviewNarrative(c, p);
    const narr = collectNarrative(p);
    all.push({ c, p, cmp, flags, narr });

    console.log(`\n${"═".repeat(100)}\nCASE ${c.id}  [${c.group} / ${c.stratum}]  ${c.label}`);
    if (c.validationWarnings.length) console.log(`  App validation warnings on load: ${c.validationWarnings.join(" | ")}`);
    console.log(`  ${pad("year", 5)}${pad("form", 8)}${padr("total", 11)}${padr("AGI", 11)}${padr("ded", 9)}${padr("taxable", 11)}${padr("tax", 10)}${padr("ETR", 8)}${padr("Tax/Inc", 8)}${padr("DE", 7)}${padr("ATM", 7)}${padr("ref band", 22)}${padr("FICA", 9)}  health / signals`);
    p.results.forEach((y, i) => {
      const m = p.metrics[i]; const k = cmp[i]; const s = y.summary;
      const band = k.band ? `${fmtD(k.band.low)}–${fmtD(k.band.high)}${k.taxInBand ? " ✓" : " ✗"}` : "n/a";
      const sig = Object.values(m.insights.signals).filter(Boolean).map(x => x.label).join(", ");
      console.log(`  ${pad(y.year, 5)}${pad(k.form, 8)}${padr(fmtD(s.totalIncome), 11)}${padr(fmtD(s.adjustedGrossIncome), 11)}${padr(fmtD(k.reportedDed), 9)}${padr(fmtD(s.taxableIncome), 11)}${padr(fmtD(s.totalTax), 10)}${padr(fmtP(m.effectiveTaxRate), 8)}${padr(fmtP(m.taxToIncome), 8)}${padr(fmtP(m.deductionEfficiency), 7)}${padr(fmtP(m.afterTaxMargin), 7)}${padr(band, 22)}${padr(fmtD(k.fica), 9)}  ${m.healthScore} ${m.healthLabel}${m.primarySignal ? ` [${m.primarySignal.flag}]` : ""} | ${sig}`);
      if (c.group === "fuzz" && k.rawTax != null) console.log(`        generator's raw tax was ${fmtD(k.rawTax)} (${k.rawTaxInBand ? "inside" : "OUTSIDE"} band) — replaced by reference-consistent ${fmtD(s.totalTax)} for this review`);
    });
    console.log(`  Trend: incomeCagr ${fmtP(p.incomeCagr)}, afterTaxCagr ${fmtP(p.afterTaxCagr)}, taxRateDelta ${p.taxRateDelta == null ? "—" : (p.taxRateDelta * 100).toFixed(1) + "pp"}, lowBase ${p.lowBase}, phase ${p.strategyPhase?.phase ?? "—"}, headline "${p.strategyTab?.headline}"`);
    const compIssues = cmp.flatMap(k => k.issues.map(x => ({ ...x, year: k.year })));
    if (compIssues.length) { console.log("  Reference comparison:"); for (const x of compIssues) { console.log(`    [${x.rule}] (${x.class}) ${x.year}: ${x.msg}`); addRule(x.rule, c.id, `${x.year}: ${x.msg}`); } }
    if (flags.length) { console.log("  Narrative / plausibility flags:"); for (const f of flags) { console.log(`    [${f.rule}] ${f.msg}`); addRule(f.rule, c.id, f.msg); } }
    console.log("  Narrative as rendered (latest year + trend):");
    for (const n of narr) if (n.year == null || n.year === p.results[p.results.length - 1].year) console.log(`    · ${n.surface}: ${n.text}`);
  }

  console.log(`\n${"═".repeat(100)}\nAGGREGATE — rule → #cases (case ids)`);
  for (const [rule, hits] of Object.entries(ruleIndex).sort()) {
    const ids = [...new Set(hits.map(h => h.cid))];
    console.log(`  ${pad(rule, 34)} ${padr(ids.length, 3)}  ${ids.slice(0, 12).join(", ")}${ids.length > 12 ? ", …" : ""}`);
  }
  const overclaimCounts = {};
  for (const a of all) for (const f of a.flags) if (f.rule === "N9-overclaim-phrases") for (const ph of f.msg.split(" | ")) overclaimCounts[ph] = (overclaimCounts[ph] ?? 0) + 1;
  console.log("\nOverclaim / advice phrase inventory (cases containing the phrase):");
  for (const [ph, n] of Object.entries(overclaimCounts).sort((a, b) => b[1] - a[1])) console.log(`  ${padr(n, 3)}  "${ph}"`);

  console.log(`\n${"═".repeat(100)}\nPOPULATION SWEEP — plausibility rules over all ${population.length} raw generated households`);
  const sweep = populationSweep(population);
  console.log(`  year-rows with verified params: ${sweep.yearRows}; generator's random Line 24 outside the reference band: ${sweep.rawOutside} (${(100 * sweep.rawOutside / sweep.yearRows).toFixed(1)}%) — the app raised no warning on any of them (it has no tax-vs-taxable plausibility check)`);
  for (const [rule, n] of Object.entries(sweep.counts).sort()) console.log(`  ${pad(rule, 34)} ${padr(n, 5)}  e.g. ${sweep.examples[rule]}`);

  if (wantJson) console.log("\nJSON " + JSON.stringify({ cases: all.map(a => ({ id: a.c.id, group: a.c.group, stratum: a.c.stratum, cmp: a.cmp, flags: a.flags })), sweep }));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
