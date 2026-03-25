// TaxVista Synthetic Test Runner
// Run: node tests/run_synthetic_tests.js
//
// Tests calculateMetrics + trend/phase logic against 8 synthetic scenarios.
// Does NOT touch UI, parser, or PDF rendering.

import { readFileSync } from "fs";
import { calculateMetrics } from "../src/utils/calculateMetrics.js";

const scenarios = JSON.parse(readFileSync(new URL("./synthetic_scenarios.json", import.meta.url), "utf-8")).scenarios;

// ─── Helpers ────────────────────────────────────────────────────────────────

const fmtD = (v) => v != null ? "$" + Math.round(v).toLocaleString() : "—";
const fmtP = (v) => v != null ? (v * 100).toFixed(1) + "%" : "—";
const pad  = (s, n) => String(s).padEnd(n);
const padr = (s, n) => String(s).padStart(n);

let totalPass = 0;
let totalFail = 0;

function check(label, actual, expected, tolerance = 0.001) {
  if (typeof expected === "string") {
    const pass = actual === expected;
    console.log(`  ${pass ? "✓" : "✗"} ${label}: "${actual}" ${pass ? "" : `(expected "${expected}")`}`);
    if (pass) totalPass++; else totalFail++;
    return pass;
  }
  if (expected === null || expected === undefined) {
    const pass = actual == null;
    console.log(`  ${pass ? "✓" : "✗"} ${label}: ${actual} ${pass ? "(null as expected)" : "(expected null)"}`);
    if (pass) totalPass++; else totalFail++;
    return pass;
  }
  const pass = Math.abs(actual - expected) <= tolerance;
  console.log(`  ${pass ? "✓" : "✗"} ${label}: ${typeof actual === "number" ? actual.toFixed(4) : actual} ${pass ? "" : `(expected ${expected.toFixed(4)})`}`);
  if (pass) totalPass++; else totalFail++;
  return pass;
}

function checkSignal(label, signal, expectedLabel, expectedLevel) {
  const labelOk = signal?.label === expectedLabel;
  const levelOk = signal?.level === expectedLevel;
  const pass = labelOk && levelOk;
  console.log(`  ${pass ? "✓" : "✗"} ${label}: "${signal?.label}" [${signal?.level}] ${pass ? "" : `(expected "${expectedLabel}" [${expectedLevel}])`}`);
  if (pass) totalPass++; else totalFail++;
  return pass;
}

function checkContains(label, text, substring) {
  const pass = text != null && text.toLowerCase().includes(substring.toLowerCase());
  console.log(`  ${pass ? "✓" : "✗"} ${label}: ${pass ? "found" : "NOT FOUND"} "${substring}"`);
  if (pass) totalPass++; else totalFail++;
  return pass;
}

// ─── Phase classification (mirrors TaxVista_Step1.jsx logic) ────────────────

function classifyPhase(cagr, lowBase, taxRateDelta, latestDE) {
  if (cagr == null) return null;
  if (lowBase && cagr > 0.12) return "Early Income Expansion";
  if (cagr > 0.12) return "Accelerated Growth";
  if (cagr > 0.04) return "Steady Accumulation";
  if (cagr >= 0.02) return "Stable Growth";
  if (cagr >= 0)   return "Income Plateau";
  return "Income Contraction";
}

// ─── Run one scenario ──────────────────────────────────────────────────────

function runScenario(scenario) {
  console.log(`\n${"═".repeat(60)}`);
  console.log(`SCENARIO ${scenario.id}: ${scenario.name}`);
  console.log(`${scenario.description}`);
  console.log(`Form: ${scenario.formType} | Years: ${scenario.years.length}`);
  console.log(`${"─".repeat(60)}`);

  // Sort by year (ascending)
  const years = [...scenario.years].sort((a, b) => a.year - b.year);

  // Build data objects and compute metrics with cross-year comparison
  const dataObjects = years.map(y => ({
    year: y.year,
    isNR: scenario.formType === "1040-NR",
    income: {
      wages:            y.wages ?? 0,
      capitalGains:     y.capitalGains ?? 0,
      dividends:        y.dividends ?? 0,
      interest:         y.interest ?? 0,
      additionalIncome: y.scheduleC ?? 0,  // Schedule C flows through additionalIncome
    },
    summary: {
      totalIncome:          y.income,
      adjustedGrossIncome:  y.agi,
      taxableIncome:        y.taxable,
      totalTax:             y.tax,
    },
  }));

  const metricsArr = [];
  for (let i = 0; i < dataObjects.length; i++) {
    const compare = {};
    if (i > 0 && metricsArr[i - 1]) {
      compare.priorETR = metricsArr[i - 1].effectiveTaxRate;
      compare.priorDE  = metricsArr[i - 1].deductionEfficiency;
      compare.priorATM = metricsArr[i - 1].afterTaxMargin;
    }
    const prev = metricsArr.slice(0, i);
    if (prev.length > 0) {
      const etrVals = prev.map(m => m.effectiveTaxRate).filter(v => v != null);
      const deVals  = prev.map(m => m.deductionEfficiency).filter(v => v != null);
      if (etrVals.length > 0) compare.avgETR = etrVals.reduce((s, v) => s + v, 0) / etrVals.length;
      if (deVals.length > 0)  compare.avgDE  = deVals.reduce((s, v) => s + v, 0) / deVals.length;
    }
    metricsArr.push(calculateMetrics(dataObjects[i], Object.keys(compare).length > 0 ? compare : undefined));
  }

  // ── Print year-by-year table ──
  console.log(`\n  ${pad("Year", 6)}${padr("Income", 10)}${padr("ETR", 8)}${padr("Tax/Inc", 8)}${padr("DedEff", 8)}${padr("ATM", 8)}${padr("AGI/Inc", 8)}`);
  console.log(`  ${"-".repeat(54)}`);
  for (let i = 0; i < years.length; i++) {
    const y = years[i];
    const m = metricsArr[i];
    console.log(`  ${pad(y.year, 6)}${padr(fmtD(y.income), 10)}${padr(fmtP(m.effectiveTaxRate), 8)}${padr(fmtP(m.taxToIncome), 8)}${padr(fmtP(m.deductionEfficiency), 8)}${padr(fmtP(m.afterTaxMargin), 8)}${padr(fmtP(m.agiRatio), 8)}`);
  }

  // ── Compute CAGR, delta, phase ──
  const first = years[0];
  const last  = years[years.length - 1];
  const mFirst = metricsArr[0];
  const mLast  = metricsArr[metricsArr.length - 1];
  const nYrs  = years.length - 1;
  const lowBase = first.income < 10000;

  const incomeCagr = nYrs > 0 && first.income > 0 && last.income > 0
    ? Math.pow(last.income / first.income, 1 / nYrs) - 1 : null;

  const firstAT = first.income - first.tax;
  const lastAT  = last.income - last.tax;
  const afterTaxCagr = nYrs > 0 && firstAT > 0 && lastAT > 0
    ? Math.pow(lastAT / firstAT, 1 / nYrs) - 1 : null;

  const taxRateDelta = mFirst.taxToIncome != null && mLast.taxToIncome != null
    ? mLast.taxToIncome - mFirst.taxToIncome : null;

  const phase = classifyPhase(incomeCagr ?? afterTaxCagr, lowBase, taxRateDelta, mLast.deductionEfficiency);

  console.log(`\n  Trend metrics:`);
  if (lowBase) {
    console.log(`  Income CAGR: Low base (first year ${fmtD(first.income)} < $10K — suppressed)`);
  } else {
    console.log(`  Income CAGR: ${incomeCagr != null ? (incomeCagr * 100).toFixed(1) + "%" : "—"}`);
  }
  console.log(`  After-tax CAGR: ${lowBase ? "Low base (suppressed)" : afterTaxCagr != null ? (afterTaxCagr * 100).toFixed(1) + "%" : "—"}`);
  console.log(`  Tax rate delta: ${taxRateDelta != null ? (taxRateDelta > 0 ? "+" : "") + (taxRateDelta * 100).toFixed(1) + " percentage points" : "—"}`);
  console.log(`  Phase: ${phase}`);

  // ── Signal tags for latest year ──
  const latestSignals = mLast.insights.signals;
  console.log(`\n  Signal tags (${last.year}):`);
  for (const [key, sig] of Object.entries(latestSignals)) {
    if (sig) console.log(`    ${pad(key + ":", 12)} ${sig.label} [${sig.level}]`);
  }

  // ── Insight text for latest year ──
  const latestSummary = mLast.insights.summary;
  if (latestSummary && latestSummary.length > 0) {
    console.log(`\n  Insight text (${last.year}):`);
    for (const item of latestSummary) {
      const text = typeof item === "string" ? item : item.text;
      console.log(`    → ${text}`);
    }
  }

  // ── Income composition (latest year) ──
  const lb = mLast.incomeBreakdown;
  console.log(`\n  Income composition (${last.year}):`);
  console.log(`    Wages: ${fmtP(lb.wagesPct)}, CapGains: ${fmtP(lb.capitalGainsPct)}, Dividends: ${fmtP(lb.dividendsPct)}, Interest: ${fmtP(lb.interestPct)}, Other: ${fmtP(lb.otherPct)}`);

  console.log(`\n  VALIDATION:`);

  return {
    scenario, years, metricsArr, mFirst, mLast,
    incomeCagr, afterTaxCagr, taxRateDelta, lowBase, phase,
    latestSignals, latestSummary,
  };
}

// ─── Scenario-specific validations ──────────────────────────────────────────

function validateS1(ctx) {
  const { mLast, lowBase, phase, latestSignals, latestSummary, metricsArr, years } = ctx;

  // Low-base flag
  check("Low-base triggered", lowBase, true);

  // Phase
  check("Phase", phase, "Early Income Expansion");

  // 2025 ETR = 11000 / 73000
  check("2025 ETR (tax/taxable)", mLast.effectiveTaxRate, 11000 / 73000, 0.002);

  // 2025 deduction efficiency = (77000-73000)/80000
  check("2025 deduction efficiency", mLast.deductionEfficiency, (77000 - 73000) / 80000, 0.002);

  // 2023 ETR = 4000/36000
  check("2023 ETR", metricsArr[2].effectiveTaxRate, 4000 / 36000, 0.002);

  // 2023 deduction efficiency = (38000-36000)/40000
  check("2023 deduction efficiency", metricsArr[2].deductionEfficiency, (38000 - 36000) / 40000, 0.002);

  // Signal checks
  // ETR = 11000/73000 = 15.07% → exceeds 15% threshold → "Tax: moderate"
  checkSignal("tax signal", latestSignals.tax, "Tax: moderate", "mid");
  checkSignal("deduction signal", latestSignals.deduction, "Low deductions", "low");
  checkSignal("margin signal", latestSignals.margin, "Strong take-home", "high");

  // Insight text must contain comparison (not generic)
  if (latestSummary?.length > 0) {
    const allText = latestSummary.map(s => typeof s === "string" ? s : s.text).join(" ");
    checkContains("Insight references a number", allText, "%");
  }
}

function validateS2(ctx) {
  const { mLast, phase, incomeCagr, latestSignals } = ctx;

  // CAGR ~3.4%
  check("Income CAGR ~3.4%", incomeCagr, Math.pow(80000 / 70000, 1 / 4) - 1, 0.005);

  // Phase: CAGR 3.4% is in 2-4% band → "Stable Growth"
  check("Phase", phase, "Stable Growth");

  // 2025 ETR = 9000/60100
  check("2025 ETR", mLast.effectiveTaxRate, 9000 / 60100, 0.002);

  // 2025 deduction efficiency = (75000-60100)/80000
  check("2025 deduction efficiency", mLast.deductionEfficiency, (75000 - 60100) / 80000, 0.002);

  // Signals
  checkSignal("margin signal", latestSignals.margin, "Strong take-home", "high");
}

function validateS3(ctx) {
  const { mLast, latestSignals } = ctx;

  // 2025 ETR = 60000/195000
  check("2025 ETR", mLast.effectiveTaxRate, 60000 / 195000, 0.002);

  // 2025 deduction efficiency = (198000-195000)/200000
  check("2025 deduction efficiency", mLast.deductionEfficiency, (198000 - 195000) / 200000, 0.002);

  // Signals: "High tax burden" (ETR > 25%)
  checkSignal("tax signal", latestSignals.tax, "High tax burden", "low");
  checkSignal("deduction signal", latestSignals.deduction, "Low deductions", "low");
  checkSignal("agi signal", latestSignals.agi, "Few income adjustments", "low");
}

function validateS4(ctx) {
  const { mLast, latestSignals } = ctx;

  // Income composition
  check("2025 wages%", mLast.incomeBreakdown.wagesPct, 40000 / 110000, 0.005);
  check("2025 capGains%", mLast.incomeBreakdown.capitalGainsPct, 40000 / 110000, 0.005);
  check("2025 dividends%", mLast.incomeBreakdown.dividendsPct, 30000 / 110000, 0.005);

  // 2025 ETR = 11500/90000 = 12.8%
  check("2025 ETR", mLast.effectiveTaxRate, 11500 / 90000, 0.002);

  // ETR 12.8% is < 15% → "Tax-efficient"
  checkSignal("tax signal", latestSignals.tax, "Tax-efficient", "high");
  checkSignal("margin signal", latestSignals.margin, "Strong take-home", "high");
}

function validateS5(ctx) {
  const { mLast, incomeCagr, phase, latestSignals } = ctx;

  // CAGR = (50000/90000)^(1/4) - 1
  const expectedCagr = Math.pow(50000 / 90000, 1 / 4) - 1;
  check("Income CAGR", incomeCagr, expectedCagr, 0.005);

  // Phase
  check("Phase", phase, "Income Contraction");

  // 2025 ETR = 4500/33000
  check("2025 ETR", mLast.effectiveTaxRate, 4500 / 33000, 0.002);

  // Signals
  checkSignal("tax signal", latestSignals.tax, "Tax-efficient", "high");
}

function validateS6(ctx) {
  const { mLast } = ctx;

  // 2025 ETR = 2700/37100
  check("2025 ETR", mLast.effectiveTaxRate, 2700 / 37100, 0.002);

  // 2025 after-tax margin = (65000-2700)/65000
  check("2025 after-tax margin", mLast.afterTaxMargin, (65000 - 2700) / 65000, 0.002);

  // Tax-efficient (ETR ~7.3%)
  checkSignal("tax signal", mLast.insights.signals.tax, "Tax-efficient", "high");
  checkSignal("margin signal", mLast.insights.signals.margin, "Strong take-home", "high");
}

function validateS7(ctx) {
  const { mLast } = ctx;

  // 2025 deduction efficiency = (94000-79900)/110000 = 12.8%
  check("2025 deduction efficiency", mLast.deductionEfficiency, (94000 - 79900) / 110000, 0.002);

  // 2025 ETR = 14500/79900 = 18.1%
  check("2025 ETR", mLast.effectiveTaxRate, 14500 / 79900, 0.002);

  // AGI ratio = 94000/110000 = 85.5% → "Some income adjustments" (< 0.9)
  check("2025 AGI ratio", mLast.agiRatio, 94000 / 110000, 0.002);
  checkSignal("agi signal", mLast.insights.signals.agi, "Some income adjustments", "mid");

  // Deduction > 10% → "Average deductions"
  checkSignal("deduction signal", mLast.insights.signals.deduction, "Average deductions", "mid");
}

function validateS8(ctx) {
  const { mLast } = ctx;

  // 2025 ETR = 6200/49000
  check("2025 ETR", mLast.effectiveTaxRate, 6200 / 49000, 0.002);

  // 2025 deduction efficiency = (58000-49000)/58000
  check("2025 deduction efficiency", mLast.deductionEfficiency, (58000 - 49000) / 58000, 0.002);

  // Interest is significant portion
  check("2025 interest%", mLast.incomeBreakdown.interestPct, 8000 / 58000, 0.005);

  checkSignal("tax signal", mLast.insights.signals.tax, "Tax-efficient", "high");
}

// ─── Cross-scenario insight uniqueness check ────────────────────────────────

function crossScenarioCheck(allContexts) {
  console.log(`\n${"═".repeat(60)}`);
  console.log("CROSS-SCENARIO: Insight Uniqueness Check");
  console.log(`${"─".repeat(60)}`);

  const allInsightTexts = [];
  for (const ctx of allContexts) {
    const texts = (ctx.latestSummary || []).map(s => typeof s === "string" ? s : s.text);
    allInsightTexts.push({ id: ctx.scenario.id, name: ctx.scenario.name, texts });
  }

  // Check pairwise for identical sentences
  let dupeCount = 0;
  for (let i = 0; i < allInsightTexts.length; i++) {
    for (let j = i + 1; j < allInsightTexts.length; j++) {
      const shared = allInsightTexts[i].texts.filter(t => allInsightTexts[j].texts.includes(t));
      if (shared.length > 0) {
        for (const s of shared) {
          console.log(`  ⚠ Duplicate between ${allInsightTexts[i].id} and ${allInsightTexts[j].id}:`);
          console.log(`    "${s.substring(0, 80)}..."`);
          dupeCount++;
        }
      }
    }
  }
  if (dupeCount === 0) {
    console.log("  ✓ No duplicate insight sentences across scenarios");
    totalPass++;
  } else {
    console.log(`  ✗ ${dupeCount} duplicate(s) found`);
    totalFail++;
  }

  // Check that every insight contains a number
  console.log(`\n  Insight specificity (every insight must contain a number):`);
  for (const { id, name, texts } of allInsightTexts) {
    for (const t of texts) {
      const hasNumber = /\d/.test(t);
      if (!hasNumber) {
        console.log(`  ✗ ${id} (${name}): insight without number: "${t.substring(0, 60)}..."`);
        totalFail++;
      }
    }
  }
  console.log("  ✓ Specificity check complete");
  totalPass++;
}

// ─── Main ───────────────────────────────────────────────────────────────────

const validators = { S1: validateS1, S2: validateS2, S3: validateS3, S4: validateS4, S5: validateS5, S6: validateS6, S7: validateS7, S8: validateS8 };

const allContexts = [];
for (const scenario of scenarios) {
  const ctx = runScenario(scenario);
  const validator = validators[scenario.id];
  if (validator) validator(ctx);
  allContexts.push(ctx);
}

crossScenarioCheck(allContexts);

console.log(`\n${"═".repeat(60)}`);
console.log(`RESULTS: ${totalPass} passed, ${totalFail} failed`);
console.log(`${"═".repeat(60)}\n`);

process.exit(totalFail > 0 ? 1 : 0);
