// tests/app-mirror.js
// Node-side mirror of the multi-year / narrative logic that lives inside the React component
// src/TaxVista_Step1.jsx. The component cannot be imported in Node (JSX + React state), so the
// pure parts are ported here VERBATIM, with the source line range noted on each block
// (line numbers as of commit 75511ba). calculateMetrics itself is imported from src/ — only the
// orchestration around it is mirrored. If TaxVista_Step1.jsx changes, re-sync this file.
//
// DEMO_CASES are NOT copied: they are extracted from the JSX source text at runtime so the
// review always sees the landing-page data as it actually is.

import { readFileSync } from "node:fs";
import { calculateMetrics, HIGH_INCOME_THRESHOLD } from "../src/utils/calculateMetrics.js";

export { HIGH_INCOME_THRESHOLD };

const JSX_URL = new URL("../src/TaxVista_Step1.jsx", import.meta.url);

// ── Year window (TaxVista_Step1.jsx ~1458–1462) ─────────────────────────────
export function mostRecentTaxYear(today = new Date()) {
  const curYear = today.getFullYear();
  const march1 = new Date(curYear, 2, 1);
  return today >= march1 ? curYear - 1 : curYear - 2;
}
export const MOST_RECENT_TAX_YEAR = mostRecentTaxYear();
export const YEAR_OPTIONS = Array.from({ length: 5 }, (_, i) => MOST_RECENT_TAX_YEAR - i);

// ── parseNum (JSX 1515–1519) ────────────────────────────────────────────────
export function parseNum(v) {
  if (v == null || v === "") return null;
  const n = parseFloat(String(v).replace(/[$,\s]/g, ""));
  return isNaN(n) ? null : n;
}

// ── DEMO_CASES extraction (JSX 1709–1769) ───────────────────────────────────
function buildDemoCase(id, label, summary, entries) {
  const forms = {};
  const data = {};
  entries.forEach(({ offset, form, fields }) => {
    const y = MOST_RECENT_TAX_YEAR - offset;
    forms[y] = form;
    data[y] = fields;
  });
  const years = entries.map(e => MOST_RECENT_TAX_YEAR - e.offset).sort((a, b) => a - b);
  return { id, label, summary, years, forms, data };
}

export function loadDemoCases() {
  const src = readFileSync(JSX_URL, "utf8");
  const start = src.indexOf("const DEMO_CASES = [");
  const end = src.indexOf("// ─── MAIN COMPONENT", start);
  if (start < 0 || end < 0) throw new Error("DEMO_CASES block not found in TaxVista_Step1.jsx — update app-mirror.js");
  let literal = src.slice(start + "const DEMO_CASES = ".length, end).trim();
  if (literal.endsWith(";")) literal = literal.slice(0, -1);
  // The literal is project source (not user input); it only references buildDemoCase.
  return new Function("buildDemoCase", "MOST_RECENT_TAX_YEAR", `"use strict"; return (${literal});`)(buildDemoCase, MOST_RECENT_TAX_YEAR);
}

// ── Wizard cross-validation (JSX 1897–1935) ─────────────────────────────────
export function runValidation(years, forms, data) {
  const warns = [];
  for (const y of years) {
    const d = data[y];
    if (!d) continue;
    const ti = parseNum(d.totalIncome);
    const adj = parseNum(d.adjustments) ?? 0;
    const agi = parseNum(d.agi);
    if (ti != null && agi != null && Math.abs(ti - adj - agi) > 1) warns.push(`${y}: Total Income - Adjustments ≠ AGI`);
    const taxableIncome = parseNum(d.taxableIncome);
    if (agi != null && taxableIncome != null && taxableIncome > agi) warns.push(`${y}: Taxable Income > AGI`);
    const totalTax = parseNum(d.totalTax);
    if (totalTax != null && totalTax < 0) warns.push(`${y}: Total Tax negative`);
    for (const [key, label] of [["wages", "W-2 Wages"], ["interest", "Taxable Interest"], ["dividends", "Ordinary Dividends"]]) {
      const v = parseNum(d[key]);
      if (v != null && v < 0) warns.push(`${y}: ${label} (${v}) can't be negative`);
    }
  }
  return warns;
}

// ── runAnalysis: wizard strings → collected objects (JSX 1940–1966) ─────────
export function collectYears(years, forms, data) {
  const collected = years.map(y => {
    const d = data[y] ?? {};
    const isNR = forms[y] === "1040-NR";
    return {
      year: y,
      isNR,
      income: {
        wages:            parseNum(d.wages),
        interest:         parseNum(d.interest),
        dividends:        parseNum(d.dividends),
        socialSecurity:   parseNum(d.socialSec),
        capitalGains:     parseNum(d.capitalGains),
        additionalIncome: parseNum(d.otherIncome),
      },
      adjustments: { totalAdjustments: parseNum(d.adjustments) },
      deductions:  { itemized: parseNum(d.deductions) },
      summary: {
        totalIncome:          parseNum(d.totalIncome),
        adjustedGrossIncome:  parseNum(d.agi),
        taxableIncome:        parseNum(d.taxableIncome),
        totalTax:             parseNum(d.totalTax),
      },
    };
  });
  collected.sort((a, b) => a.year - b.year);
  return collected;
}

// ── Metrics loop with cross-year compare (JSX 1967–1989) ────────────────────
export function runMetrics(collected) {
  const computedMetrics = [];
  for (let i = 0; i < collected.length; i++) {
    const compare = {};
    if (i > 0 && computedMetrics[i - 1]) {
      compare.priorETR    = computedMetrics[i - 1].effectiveTaxRate;
      compare.priorDE     = computedMetrics[i - 1].deductionEfficiency;
      compare.priorATM    = computedMetrics[i - 1].afterTaxMargin;
      compare.priorIncome   = collected[i - 1].summary?.totalIncome ?? null;
      compare.priorCapGains = collected[i - 1].income?.capitalGains ?? null;
    }
    const prev = computedMetrics.slice(0, i);
    if (prev.length > 0) {
      const etrVals = prev.map(m => m.effectiveTaxRate).filter(v => v != null);
      const deVals  = prev.map(m => m.deductionEfficiency).filter(v => v != null);
      if (etrVals.length > 0) compare.avgETR = etrVals.reduce((s, v) => s + v, 0) / etrVals.length;
      if (deVals.length > 0)  compare.avgDE  = deVals.reduce((s, v) => s + v, 0) / deVals.length;
    }
    computedMetrics.push(calculateMetrics(collected[i], Object.keys(compare).length > 0 ? compare : undefined));
  }
  return computedMetrics;
}

const _fmtD = (v) => v != null ? "$" + Math.round(v).toLocaleString() : "—";
const _fmtP = (v) => v != null ? (v * 100).toFixed(1) + "%" : "—";

// ── Full dashboard pipeline (mirrors derived state computed after runAnalysis) ──
export function runPipeline(collectedIn) {
  const results = [...collectedIn].sort((a, b) => a.year - b.year);
  const metrics = runMetrics(results);
  const metricMap = Object.fromEntries(results.map((r, i) => [r.year, metrics[i]]));

  // trendData (JSX 2031–2039)
  const trendData = metrics.map((m, i) => ({
    year:            results[i]?.year,
    wagesPct:        m.incomeBreakdown?.wagesPct ?? 0,
    capitalGainsPct: m.incomeBreakdown?.capitalGainsPct ?? 0,
    otherPct:        m.incomeBreakdown?.otherPct ?? 0,
    totalIncome:     results[i]?.summary?.totalIncome ?? null,
    totalTax:        results[i]?.summary?.totalTax ?? null,
    afterTaxIncome:  m.afterTaxIncome ?? null,
  })).sort((a, b) => a.year - b.year);

  // trendInsights (JSX 2041–2139)
  const trendInsights = (() => {
    if (trendData.length < 2) return [];
    const first = trendData[0];
    const last  = trendData[trendData.length - 1];
    const incomeGrowth   = first.totalIncome    ? (last.totalIncome    - first.totalIncome)    / first.totalIncome    : null;
    const taxGrowth      = first.totalTax       ? (last.totalTax       - first.totalTax)       / first.totalTax       : null;
    const afterTaxGrowth = first.afterTaxIncome ? (last.afterTaxIncome - first.afterTaxIncome) / first.afterTaxIncome : null;
    const wagesDelta     = last.wagesPct        - first.wagesPct;
    const gainsDelta     = last.capitalGainsPct - first.capitalGainsPct;
    const lowBase        = first.totalIncome != null && first.totalIncome < 10000;
    const items = [];
    const lastFullResult = results.find(r => r.year === last.year);
    const lastCapGains  = lastFullResult?.income?.capitalGains ?? 0;
    const lastTotalInc  = last.totalIncome || 1;
    const eventIncome   = Math.max(lastCapGains, 0);
    const eventRatio    = eventIncome / lastTotalInc;

    if (incomeGrowth != null) {
      if (lowBase) {
        items.push({ text: `Income increased significantly from a low base ($${Math.round(first.totalIncome).toLocaleString()} in ${first.year}). Growth rates are not meaningful at this scale — trajectory analysis begins once income exceeds $10K.`, metric: "income", type: "income_growth" });
      } else {
        const pct   = Math.abs(incomeGrowth * 100).toFixed(0);
        const dir   = incomeGrowth >= 0 ? "↑" : "↓";
        let growthNote;
        if (incomeGrowth > 0.15) {
          if (eventRatio > 0.40) growthNote = "This growth is primarily driven by non-recurring capital gains, not core earnings — it may not reflect your ongoing income trajectory.";
          else if (eventRatio > 0.20) growthNote = "Growth reflects a mix of core earnings and investment gains — verify how much is recurring before drawing long-term conclusions.";
          else growthNote = "This pace signals meaningful career or business acceleration.";
        } else if (incomeGrowth > 0) {
          growthNote = "Modest cumulative growth — income is expanding but not rapidly.";
        } else if (incomeGrowth < -0.05) {
          growthNote = "Income is contracting — review whether this reflects a structural change or a temporary adjustment.";
        } else {
          growthNote = "Income is effectively flat — no significant trajectory in either direction.";
        }
        items.push({ text: `Gross income ${dir} ${pct}% cumulatively from ${first.year} to ${last.year}. ${growthNote}`, metric: "income", type: "income_growth" });
      }
    }

    if (taxGrowth != null && incomeGrowth != null && incomeGrowth > 0 && taxGrowth > incomeGrowth + 0.05 && !lowBase) {
      const incPct = (incomeGrowth * 100).toFixed(0);
      const taxPct = (taxGrowth * 100).toFixed(0);
      const lastIsHighIncome = last.totalIncome != null && last.totalIncome > HIGH_INCOME_THRESHOLD;
      items.push({ text: lastIsHighIncome
        ? `Over ${first.year}–${last.year}, income grew ${incPct}% cumulatively while taxes grew ${taxPct}% over the same period, as earnings entered higher marginal brackets — Standard Deduction is flat by design, so reducing the taxable base requires pre-tax contribution growth (401k, HSA, Mega Backdoor Roth).`
        : `Over ${first.year}–${last.year}, income grew ${incPct}% cumulatively while taxes grew ${taxPct}% over the same period, as earnings entered higher marginal brackets with limited deduction scaling — resulting in a shrinking share of each additional dollar retained after tax.`,
        metric: "tax", type: "tax_efficiency" });
    } else if (afterTaxGrowth != null && incomeGrowth != null && incomeGrowth > 0 && afterTaxGrowth < incomeGrowth - 0.05 && !lowBase) {
      items.push({ text: `After-tax income is growing slower than gross income, indicating rising tax drag. A portion of income growth is being absorbed by higher marginal rates without corresponding tax optimization.`, metric: "afterTax", type: "tax_efficiency" });
    } else if (lowBase && taxGrowth != null && taxGrowth > 1) {
      items.push({ text: `Tax burden increased sharply as income moved from near-zero into taxable brackets. This is a natural transition, not a structural inefficiency — but it creates the highest-leverage window for tax optimization.`, metric: "tax", type: "tax_efficiency" });
    } else if (incomeGrowth != null && !lowBase) {
      const lastMetric = metrics[metrics.length - 1];
      if (lastMetric?.isLossDriven) {
        items.push({ text: `Tax burden decreased primarily due to capital losses, not improved deduction structure. This reduction is not expected to repeat without similar losses.`, metric: "tax", type: "tax_efficiency" });
      } else if (incomeGrowth < 0) {
        const taxPart = taxGrowth != null ? ` and total tax ${taxGrowth < 0 ? "fell" : "rose"} ${Math.abs(taxGrowth * 100).toFixed(0)}%` : "";
        items.push({ text: `Over ${first.year}–${last.year}, gross income fell ${Math.abs(incomeGrowth * 100).toFixed(0)}%${taxPart}.`, metric: "tax", type: "tax_efficiency" });
      } else if (incomeGrowth > 0 && taxGrowth != null && taxGrowth < 0) {
        items.push({ text: `Over ${first.year}–${last.year}, gross income rose ${(incomeGrowth * 100).toFixed(0)}% while total tax fell ${Math.abs(taxGrowth * 100).toFixed(0)}% — after-tax income grew faster than gross income.`, metric: "tax", type: "tax_efficiency" });
      } else if (incomeGrowth > 0 && taxGrowth != null && taxGrowth > 0) {
        items.push({ text: `Tax obligation is growing in line with income — no compression of take-home margin detected. Current deduction structure is keeping pace with income growth.`, metric: "tax", type: "tax_efficiency" });
      }
    }

    if (Math.abs(wagesDelta) > 0.05 || Math.abs(gainsDelta) > 0.05) {
      if (wagesDelta > 0.05 && gainsDelta < -0.05)
        items.push({ text: `Income is shifting toward W-2 wages and away from investment income. This increases exposure to ordinary tax rates and reduces access to preferential capital gains treatment.`, metric: "income", type: "income_mix" });
      else if (wagesDelta < -0.05 && gainsDelta > 0.05) {
        const firstFullR = results.find(r => r.year === first.year);
        const firstCG = firstFullR?.income?.capitalGains ?? 0;
        const isSpike = lastCapGains > firstCG * 3 && lastCapGains / lastTotalInc > 0.30;
        items.push({ text: isSpike
          ? `Capital gains spiked significantly this year — this likely reflects a one-time event (asset sale, exit) rather than structural income diversification. Tax impact may not repeat.`
          : `Income mix is diversifying into capital gains, which are taxed at lower rates. This structural shift improves long-term tax efficiency if sustained.`, metric: "income", type: "income_mix" });
      } else if (gainsDelta > 0.05) {
        const firstFullR = results.find(r => r.year === first.year);
        const firstCG = firstFullR?.income?.capitalGains ?? 0;
        const isSpike = lastCapGains > firstCG * 3 && lastCapGains / lastTotalInc > 0.30;
        items.push({ text: isSpike
          ? `Capital gains spiked significantly — likely a one-time event rather than sustained income diversification. Verify whether this level of investment income is expected to recur.`
          : `Investment income share is growing. Capital gains and qualified dividends receive preferential tax rates — this diversification will reduce effective tax burden over time.`, metric: "income", type: "income_mix" });
      } else if (gainsDelta < -0.05) {
        const lastCapGainsVal = results.find(r => r.year === last.year)?.income?.capitalGains;
        items.push({ text: lastCapGainsVal != null && lastCapGainsVal < 0
          ? `Capital gains turned negative (loss position), reducing investment income share. This concentrates earnings in ordinary income and narrows tax flexibility.`
          : `Investment income share is declining, concentrating earnings in ordinary income. This narrows tax flexibility and increases marginal rate exposure.`, metric: "income", type: "income_mix" });
      }
    }
    return items;
  })();

  // Signal override layer (JSX 2142–2164)
  const overriddenInsights = (() => {
    if (!trendInsights.length || !metrics.length) return trendInsights;
    const lastM = metrics[metrics.length - 1];
    const flags = new Set((lastM?.falseSignals ?? []).map(s => s.flag));
    const hasOneTimeEvent    = flags.has("ONE_TIME_EVENT");
    const hasIncomeCollapse  = flags.has("INCOME_COLLAPSE");
    const hasFalseEfficiency = flags.has("FALSE_EFFICIENCY");
    if (!hasOneTimeEvent && !hasIncomeCollapse && !hasFalseEfficiency) return trendInsights;
    return trendInsights.map(item => {
      if (hasOneTimeEvent) {
        if (item.type === "income_growth") return { ...item, text: "Reported income growth includes a significant one-time capital event and may not reflect sustainable earnings trajectory." };
        if (item.type === "income_mix") return { ...item, text: "Capital gains spiked significantly this year — this likely reflects a one-time event (asset sale, exit) rather than structural income diversification. Tax impact may not repeat." };
      }
      if (hasIncomeCollapse || hasFalseEfficiency) {
        if (item.type === "tax_efficiency") return { ...item, text: "Tax metrics appear stable, but income has declined — efficiency improvements reflect contraction, not optimization." };
      }
      return item;
    });
  })();

  // CAGR & tax delta (JSX 2229–2247)
  const _td0 = trendData[0];
  const _tdN = trendData[trendData.length - 1];
  const _tdYrs = trendData.length - 1;
  const safeCagr = (first, last, yrs) => {
    if (!(yrs > 0) || !(first > 0) || !(last > 0)) return null;
    const result = Math.pow(last / first, 1 / yrs) - 1;
    return Number.isFinite(result) ? result : null;
  };
  const incomeCagr = safeCagr(_td0?.totalIncome, _tdN?.totalIncome, _tdYrs);
  const afterTaxCagr = safeCagr(_td0?.afterTaxIncome, _tdN?.afterTaxIncome, _tdYrs);
  const _m0 = _td0 ? metricMap[_td0.year] : null;
  const _mN = _tdN ? metricMap[_tdN.year] : null;
  const taxRateDelta = _m0?.effectiveTaxRate != null && _mN?.effectiveTaxRate != null
    ? _mN.effectiveTaxRate - _m0.effectiveTaxRate : null;
  const _lowBase = _td0?.totalIncome != null && _td0.totalIncome < 10000;

  // Strategy phase (JSX 2424–2522)
  const strategyPhase = (() => {
    const cagr = incomeCagr ?? afterTaxCagr;
    if (cagr == null || trendData.length < 2) return null;
    const years = trendData.length;
    const lowBase = trendData[0]?.totalIncome != null && trendData[0].totalIncome < 10000;
    const latestDE = _mN?.deductionEfficiency;
    let phase, characteristics, implication, note;
    if (lowBase && cagr > 0.12) {
      phase = "Early Income Expansion";
      characteristics = [
        "Rapid income growth from a low base",
        "Increasing tax exposure as income enters taxable brackets",
        latestDE != null && latestDE < 0.1 ? "Below-AGI deduction ratio is low at this stage" : "Below-AGI deduction ratio beginning to build",
      ];
      implication = "This phase offers the highest leverage for tax optimization decisions. Habits formed now compound over the entire career arc.";
      note = "Income is transitioning from a near-zero base into meaningful taxable territory. The growth rate itself is distorted by the low starting point, but the structural pattern is clear: earnings are scaling while tax strategy has not yet been established.";
    } else if (cagr > 0.12) {
      const peakIncome = Math.max(...trendData.map(t => t.totalIncome ?? 0));
      const peakYear = trendData.find(t => t.totalIncome === peakIncome)?.year;
      const latestIncome = _tdN?.totalIncome ?? 0;
      const hasCorrection = peakYear && peakYear !== _tdN?.year && latestIncome < peakIncome * 0.85;
      if (hasCorrection) {
        phase = "High Growth with Recent Correction";
        characteristics = [
          "Strong long-term income growth above 12% annualized",
          `Peak income in ${peakYear} ($${Math.round(peakIncome).toLocaleString()}) followed by a pullback in ${_tdN?.year}`,
          latestDE != null && latestDE < 0.1 ? "Below-AGI deduction ratio remains low relative to total income" : "Below-AGI deduction ratio is in a typical range",
        ];
        implication = "Your multi-year trend shows strong growth, but the most recent year reflects a significant correction. Tax planning should account for volatility, not just the long-term trajectory.";
        // NOTE: _mN.insights.hasCapitalLoss does not exist on the engine output (generateInsights returns {signals, summary}) — this clause can never fire. Ported as-is.
        note = `Your ${years}-year trend shows strong long-term growth, but ${_tdN?.year} reflects a significant correction${_mN?.insights?.hasCapitalLoss ? " driven by investment losses" : ""}. This is a growth-with-volatility story, not a linear acceleration.`;
      } else {
        phase = "Accelerated Growth";
        characteristics = [
          "Sustained high income growth above 12% annualized",
          taxRateDelta != null && taxRateDelta > 0.02 ? "Tax burden scaling with income — rising effective rate" : "Tax burden managed within growth pace",
          latestDE != null && latestDE < 0.1 ? "Below-AGI deduction ratio remains low relative to total income" : "Below-AGI deduction ratio is in a typical range",
        ];
        implication = "Rapid growth creates urgency: tax optimization decisions made now will protect a compounding income base. Delay increases cumulative tax leakage.";
        note = "Income is expanding at an accelerated pace. Without proportional deduction scaling, a growing share of each incremental dollar will be taxed at progressively higher marginal rates.";
      }
    } else if (cagr > 0.04) {
      phase = "Steady Accumulation";
      const cagrPct = (cagr * 100).toFixed(1);
      characteristics = [
        `${cagrPct}% annualized growth — moderate, above-inflation income expansion`,
        taxRateDelta != null ? `Effective tax rate shifted by ${(taxRateDelta * 100).toFixed(1)} percentage points — ${Math.abs(taxRateDelta) < 0.02 ? "stable exposure" : taxRateDelta > 0 ? "gradual upward pressure" : "improving efficiency"}` : "Tax exposure data insufficient for trend comparison",
        latestDE != null ? `Below-AGI deduction ratio at ${(latestDE * 100).toFixed(1)}% — ${latestDE > 0.15 ? "typical range" : "reflects a smaller standard/itemized deduction relative to income"}` : "Deduction data unavailable",
      ];
      implication = `At ${cagrPct}% annualized growth, steady expansion provides the most predictable environment for tax planning. Incremental tax-planning improvements compound reliably at this pace.`;
      note = `Growth is consistent at ${cagrPct}% annualized without dramatic shifts. This stability is ideal for establishing automated pre-tax contributions and reviewing deduction coverage systematically.`;
    } else if (cagr >= 0.02) {
      phase = "Stable Growth";
      const cagrPct = (cagr * 100).toFixed(1);
      const latestATM = _mN?.afterTaxMargin;
      characteristics = [
        `${cagrPct}% annualized growth — consistent, positive trajectory`,
        latestATM != null ? `After-tax margin at ${(latestATM * 100).toFixed(1)}% — ${latestATM > 0.8 ? "strong after-tax performance" : "moderate after-tax performance"}` : "After-tax margin data unavailable",
        latestDE != null ? `Below-AGI deduction ratio at ${(latestDE * 100).toFixed(1)}% — ${latestDE < 0.1 ? "smaller share of income sheltered by deductions" : "maintained at current level"}` : "Deduction data unavailable",
      ];
      implication = `At ${cagrPct}% annualized growth, income is expanding steadily. This is a reliable environment for systematic tax planning.`;
      note = `Income is growing consistently at ${cagrPct}% annualized — healthy, positive trajectory. Focus shifts to deduction strategy and income mix optimization to ensure after-tax growth keeps pace.`;
    } else if (cagr >= 0) {
      phase = "Income Plateau";
      const cagrPct = (cagr * 100).toFixed(1);
      const latestATM = _mN?.afterTaxMargin;
      characteristics = [
        `${cagrPct}% annualized growth — effectively flat or below inflation`,
        latestATM != null ? `After-tax margin at ${(latestATM * 100).toFixed(1)}% — ${latestATM > 0.8 ? "after-tax income stable but not improving" : "tax drag is compressing take-home income"}` : "After-tax margin data unavailable",
        latestDE != null ? `Below-AGI deduction ratio at ${(latestDE * 100).toFixed(1)}% — ${latestDE < 0.1 ? "smaller share of income sheltered by deductions" : "maintained at current level"}` : "Deduction data unavailable",
      ];
      implication = `With income growing at only ${cagrPct}% annualized, after-tax growth must come from efficiency gains — reducing taxable income through deductions and income mix optimization.`;
      note = `Income has leveled off at ${cagrPct}% annualized growth. If after-tax growth is a priority, the path runs through deduction strategy and income diversification rather than income growth alone.`;
    } else {
      phase = "Income Contraction";
      const cagrPct = (cagr * 100).toFixed(1);
      const latestATM = _mN?.afterTaxMargin;
      characteristics = [
        `${cagrPct}% annualized — income declining year-over-year`,
        latestATM != null ? `After-tax margin at ${(latestATM * 100).toFixed(1)}% — ${latestATM > 0.8 ? "after-tax income stable despite declining income" : "tax burden not adjusting proportionally to lower income"}` : "After-tax margin data unavailable",
        taxRateDelta != null ? `Effective tax rate shifted by ${(taxRateDelta * 100).toFixed(1)} percentage points — ${taxRateDelta > 0 ? "rate rising on a shrinking base, compounding after-tax erosion" : "rate adjusting downward with income"}` : "Effective tax rate trend data unavailable",
      ];
      implication = `At ${cagrPct}% annualized decline, verify that tax withholding and expense structure have adjusted proportionally. Over-withholding on a shrinking base accelerates after-tax erosion.`;
      note = `Income is trending downward at ${cagrPct}% annualized. Priority shifts to preserving current after-tax income: verify withholding is accurate, claim all eligible deductions, and evaluate whether income sources can be restructured.`;
    }
    if (metrics.some(m => (m?.falseSignals ?? []).some(s => s.flag === "ONE_TIME_EVENT"))) {
      phase = "Event-Driven Income";
      note = "Income growth this period includes a significant one-time capital event. This may not reflect your ongoing earnings trajectory.";
    }
    return { years, cagr, phase, note, characteristics, implication };
  })();

  // Overview strategy bar sentence (JSX 3050–3054)
  const overviewSentence = strategyPhase
    ? `Across your ${strategyPhase.years}-year trend${_lowBase ? "" : `, with an annualized growth rate of ${(strategyPhase.cagr * 100).toFixed(1)}%`}, your financial phase is ${strategyPhase.phase}. ${strategyPhase.note}`
    : null;

  // Year insight labels (JSX 2571–2660) — text parts only (colors omitted)
  const yearInsight = (year) => {
    const r = results.find(res => res.year === year);
    const m = metricMap[year];
    if (!r || !m) return null;
    const rPrior = results.filter(res => res.year < year).sort((a, b) => b.year - a.year)[0] ?? null;
    const mPrior = rPrior ? metricMap[rPrior.year] : null;
    const etr = m.effectiveTaxRate;
    const de  = m.deductionEfficiency;
    const ati = m.afterTaxIncome;
    const ti  = r.summary?.totalIncome;
    const etrPrior  = mPrior?.effectiveTaxRate ?? null;
    const etrDelta  = etr != null && etrPrior != null ? etr - etrPrior : null;
    const etrRising = etrDelta != null && etrDelta > 0.015;
    const _ps = m.primarySignal;
    const _psOverride = _ps && (_ps.severity === "CRITICAL" || _ps.severity === "HIGH");
    const etrLabel  = etr == null ? null
      : _psOverride ? _ps.override
      : etr > 0.25 ? "high tax burden relative to income"
      : etr > 0.15 ? "moderate burden, optimization possible"
      : etr > 0.05 ? "low burden, favorable structure"
      : "minimal burden, most income retained";
    const atiPrior  = mPrior?.afterTaxIncome ?? null;
    const atiGrowth = ati != null && atiPrior != null && atiPrior > 0 ? (ati - atiPrior) / atiPrior : null;
    const dePct    = de != null ? (de * 100).toFixed(1) + "%" : null;
    const deIsHighIncome = ti != null && ti > HIGH_INCOME_THRESHOLD;
    const tiPriorForDe = rPrior?.summary?.totalIncome ?? null;
    const deIncomeYoY  = ti != null && tiPriorForDe > 0 ? (ti - tiPriorForDe) / tiPriorForDe : null;
    const deIsContracting = deIncomeYoY != null && deIncomeYoY < -0.05;
    const deLabel  = de == null ? null
      : de > 0.2 && deIsContracting ? `${dePct} — high ratio reflects contracted income, not active sheltering`
      : de > 0.2 ? `${dePct}, strong — income effectively sheltered`
      : de > 0.1 && deIsContracting ? `${dePct} — elevated by income contraction, not optimization`
      : de > 0.1 ? `${dePct}, moderate share of income sheltered by the standard/itemized deduction`
      : deIsHighIncome ? `${dePct} (standard deduction is flat at this income — this ratio isn't moved by IRA/HSA/401k contributions)`
      : `${dePct}, limited — most income taxed without offsets`;
    return { year, etr, de, ati, etrDelta, etrRising, etrLabel, deLabel, atiGrowth, tti: m.taxToIncome };
  };

  // Why engine (JSX 2662–2708)
  const whyBullets = (year) => {
    const r = results.find(res => res.year === year);
    const m = metricMap[year];
    if (!r || !m) return [];
    const rPrior   = results.filter(res => res.year < year).sort((a, b) => b.year - a.year)[0] ?? null;
    const mPrior   = rPrior ? metricMap[rPrior.year] : null;
    const etr      = m.effectiveTaxRate;
    const de       = m.deductionEfficiency;
    const ti       = r.summary?.totalIncome;
    const tiPrior  = rPrior?.summary?.totalIncome;
    const wagesPct = m.incomeBreakdown?.wagesPct;
    const agiRatio = m.agiRatio;
    const etrPrior = mPrior?.effectiveTaxRate;
    const etrDelta = etr != null && etrPrior != null ? etr - etrPrior : null;
    const atm      = m.afterTaxMargin;
    const bullets = [];
    const whyIsHighIncome = ti != null && ti > HIGH_INCOME_THRESHOLD;
    if (ti && tiPrior && etrDelta != null && etrDelta > 0.01) {
      const g = ((ti - tiPrior) / tiPrior * 100).toFixed(0);
      bullets.push(whyIsHighIncome
        ? `income +${g}% YoY — deductions are flat by design; 401k/HSA contributions reduce the taxable base`
        : `income +${g}% YoY — deductions didn't scale proportionally`);
    }
    if (de != null && de < 0.08) {
      bullets.push(whyIsHighIncome
        ? `below-AGI deduction ratio ${(de * 100).toFixed(1)}% — expected at this income level; focus on pre-tax contribution caps, not ratios`
        : `below-AGI deduction ratio ${(de * 100).toFixed(1)}% — taxable income close to gross`);
    } else if (de != null && de > 0.2 && bullets.length < 2) {
      bullets.push(`below-AGI deduction ratio ${(de * 100).toFixed(1)}% — strong tax base reduction`);
    }
    if (wagesPct != null && wagesPct > 0.88 && etr != null && etr > 0.1) {
      bullets.push(`${(wagesPct * 100).toFixed(0)}% W-2 wages — ordinary income rates apply`);
    }
    if (agiRatio != null && agiRatio > 0.94 && bullets.length < 2) {
      bullets.push(`No above-the-line adjustments reported between total income and AGI — ${(agiRatio * 100).toFixed(0)}% of gross income carries through unchanged`);
    }
    if (etr != null && etr < 0.1 && atm != null && atm > 0.85 && bullets.length < 2) {
      bullets.push(`${(atm * 100).toFixed(0)}% of total income retained after tax`);
    }
    return bullets.slice(0, 3);
  };

  // Peak-risk year (JSX 2710–2719)
  const peakRiskYear = (() => {
    if (results.length < 3) return null;
    const peakIncYear = results.reduce((a, b) => (b.summary?.totalIncome ?? 0) > (a.summary?.totalIncome ?? 0) ? b : a).year;
    const etrVals = results.map(r => ({ y: r.year, e: metricMap[r.year]?.effectiveTaxRate })).filter(v => v.e != null);
    const deVals  = results.map(r => ({ y: r.year, d: metricMap[r.year]?.deductionEfficiency })).filter(v => v.d != null);
    if (etrVals.length < 2 || deVals.length < 2) return null;
    const highETRYear = etrVals.reduce((a, b) => b.e > a.e ? b : a).y;
    const lowDEYear   = deVals.reduce((a, b) => b.d < a.d ? b : a).y;
    if (peakIncYear === highETRYear && highETRYear === lowDEYear) return peakIncYear;
    return null;
  })();

  // NR→1040 transition (JSX 2721–2728)
  const nrTransitionYear = (() => {
    if (results.length < 2) return null;
    const sorted = [...results].sort((a, b) => a.year - b.year);
    for (let i = 1; i < sorted.length; i++) {
      if (sorted[i - 1].isNR && !sorted[i].isNR) return sorted[i].year;
    }
    return null;
  })();
  const NR_TRANSITION_TEXT = nrTransitionYear
    ? `Your tax profile changed materially in ${nrTransitionYear} as you transitioned from non-resident (1040-NR) to U.S. resident filing. This expanded your taxable base and increased exposure to ordinary income tax rates.`
    : null;
  const PEAK_RISK_TEXT = peakRiskYear
    ? `${peakRiskYear} was your most tax-exposed year: peak income, highest effective tax rate, and lowest below-AGI deduction ratio across all years analyzed. This is the highest-leverage year for retroactive optimization review.`
    : null;

  // Strategy tab / print report narrative (JSX 3751–3879)
  const strategyTab = (() => {
    if (results.length === 0) return null;
    const _sorted = [...results].sort((a, b) => a.year - b.year);
    const _multi = _sorted.length > 1;
    const _first = _sorted[0];
    const _last  = _sorted[_sorted.length - 1];
    const _mFirst = metricMap[_first.year];
    const _mLast  = metricMap[_last.year];
    const _lb = _first.summary?.totalIncome != null && _first.summary.totalIncome < 10000;
    const _incomeRoseTaxFell = _first.summary?.totalIncome != null && _last.summary?.totalIncome != null && _last.summary.totalIncome > _first.summary.totalIncome
      && _first.summary?.totalTax != null && _last.summary?.totalTax != null && _last.summary.totalTax < _first.summary.totalTax;
    const _latestM = _tdN ? metricMap[_tdN.year] : null;
    const _latestR = _tdN ? results.find(r => r.year === _tdN.year) : null;
    const _tags = [];
    if (incomeCagr != null && incomeCagr > 0.12) {
      _tags.push({ text: "High Growth", cls: "pos" });
      if (strategyPhase?.phase === "High Growth with Recent Correction") _tags.push({ text: "Recent Correction", cls: "warn" });
    }
    else if (incomeCagr != null && incomeCagr < -0.05) _tags.push({ text: "Income Declining", cls: "neg" });
    if (taxRateDelta != null && taxRateDelta > 0.02) _tags.push({ text: "Rising Tax", cls: "neg" });
    if (_latestM?.deductionEfficiency != null && _latestM.deductionEfficiency < 0.1) _tags.push({ text: "Low Deduction Ratio", cls: "warn" });
    else if (_latestM?.deductionEfficiency != null && _latestM.deductionEfficiency > 0.2) _tags.push({ text: "Strong Deductions", cls: "pos" });
    if (_latestM?.afterTaxMargin != null && _latestM.afterTaxMargin > 0.8) _tags.push({ text: "Strong Take-Home", cls: "pos" });
    const _headline = _tags.length > 0 ? _tags.slice(0, 2).map(t => t.text.toUpperCase()).join(" · ") : "FINANCIAL OVERVIEW";
    const _explain = (() => {
      if (incomeCagr != null && incomeCagr > 0.12 && taxRateDelta != null && taxRateDelta > 0.02) return "Income rising fast, but tax efficiency is not keeping pace.";
      if (incomeCagr != null && incomeCagr > 0.12) return "Income growing rapidly — early optimization has the highest lifetime impact.";
      if (taxRateDelta != null && taxRateDelta > 0.02) return "Tax burden increasing — more income is being lost to taxes.";
      if (_latestM?.deductionEfficiency != null && _latestM.deductionEfficiency < 0.1) return "Below-AGI deduction ratio is low — taxable income is close to total income.";
      if (_latestM?.afterTaxMargin != null && _latestM.afterTaxMargin > 0.8) return "Strong after-tax performance — most of total income preserved after tax.";
      return "Review your income structure and tax efficiency below.";
    })();
    const _impact = (() => {
      if (taxRateDelta != null && taxRateDelta > 0.02 && incomeCagr != null && incomeCagr > 0.1) return "Without adjustment, taxes will scale faster than income growth.";
      if (_latestM?.effectiveTaxRate != null && _latestM.effectiveTaxRate > 0.2) return "High tax burden — over 20% of income going to federal tax.";
      if (_latestM?.deductionEfficiency != null && _latestM.deductionEfficiency < 0.08) return "Almost no taxable income reduced through deductions.";
      return null;
    })();
    const _actions = [];
    if (_latestM?.deductionEfficiency != null && _latestM.deductionEfficiency < 0.15 && _latestR?.summary?.totalIncome) {
      const _dePct = (_latestM.deductionEfficiency * 100).toFixed(1);
      _actions.push({ action: "Review whether itemizing would beat the standard deduction", reason: `Your below-AGI deduction ratio is ${_dePct}% of total income, reflecting the standard deduction. This ratio only moves with itemized deductions (mortgage interest, SALT, charitable giving, medical) — above-the-line moves like 401k, IRA, and HSA contributions reduce your overall tax bill but don't change this specific ratio, since they're already subtracted before AGI is calculated.` });
    }
    if (_latestM?.deductionEfficiency != null && _latestM.deductionEfficiency < 0.1) _actions.push({ action: "Reduce taxable income exposure", reason: `Beyond retirement, evaluate HSA eligibility, student loan interest deduction, and above-the-line adjustments.` });
    if (taxRateDelta != null && taxRateDelta > 0.02) _actions.push({ action: "Review tax withholding accuracy", reason: `Effective tax rate increased by ${(taxRateDelta * 100).toFixed(1)} percentage points. Verify W-4 reflects current income.` });
    if (incomeCagr != null && incomeCagr > 0.08) _actions.push({ action: "Shift income mix toward tax-advantaged sources", reason: "Capital gains and qualified dividends are taxed at 0–20% vs ordinary rates of 22–37%." });
    if (_actions.length === 0) _actions.push({ action: "Conduct annual deduction and contribution audit", reason: "Ensure all eligible deductions are claimed and pre-tax contributions are near annual limits." });

    const _proseParts = [];
    if (_latestR && _latestM) {
      _proseParts.push(`In ${_latestR.year}, you earned ${_fmtD(_latestR.summary?.totalIncome)} in total income and kept ${_fmtD(_latestM.afterTaxIncome)} after federal taxes — an effective tax rate of ${_fmtP(_latestM.effectiveTaxRate)} (based on taxable income)${_latestM.afterTaxMargin != null ? `, with an after-tax margin (share of total income kept after tax) of ${_fmtP(_latestM.afterTaxMargin)}` : ""}.`);
      if (_multi && taxRateDelta != null && Math.abs(taxRateDelta) > 0.01) {
        _proseParts.push(`Over ${_first.year}–${_last.year}, your effective tax rate ${taxRateDelta > 0 ? "increased" : "decreased"} by ${Math.abs(taxRateDelta * 100).toFixed(1)} percentage points${_lb ? " as income moved from a near-zero base into taxable brackets" : ""}.`);
      }
      if (_latestM.deductionEfficiency != null && _latestM.deductionEfficiency < 0.1) {
        _proseParts.push(`Below-AGI deduction ratio is low at ${(_latestM.deductionEfficiency * 100).toFixed(1)}% — this reflects the standard/itemized deduction only; it doesn't move with above-the-line contributions like 401k, IRA, or HSA.`);
      }
    }
    const _incOf = (r) => { const inc = r.income ?? {}; return { wages: inc.wages ?? 0, capitalGains: inc.capitalGains ?? 0, dividends: inc.dividends ?? 0, interest: inc.interest ?? 0, other: inc.additionalIncome ?? 0 }; };
    const _incomeBullets = [], _taxBullets = [], _dragBullets = [], _afterTaxBullets = [], _compBullets = [], _dedBullets = [], _summaryBullets = [];
    if (_multi) {
      const fi = _first.summary?.totalIncome, li = _last.summary?.totalIncome;
      if (fi && li) { if (_lb) { _incomeBullets.push(`Income expanded from ${_fmtD(fi)} (${_first.year}) to ${_fmtD(li)} (${_last.year}). The starting base was below $10,000, which distorts percentage-based metrics.`); } else { const g = ((li - fi) / fi * 100).toFixed(0); _incomeBullets.push(`Total income: ${_fmtD(fi)} (${_first.year}) → ${_fmtD(li)} (${_last.year}) — ${g}% total change.`); } }
      if (incomeCagr != null && !_lb) _incomeBullets.push(`Annualized growth rate: ${(incomeCagr * 100).toFixed(1)}%. ${incomeCagr > 0.2 ? "Exceptionally fast — sustainability should be monitored." : incomeCagr > 0.08 ? "Above-average growth creating compounding value." : incomeCagr > 0 ? "Modest growth near inflation levels." : "Income contracting in real terms."}`);
      else if (_lb) _incomeBullets.push(`Low-base distortion: ${_first.year} income of ${_fmtD(_first.summary?.totalIncome)} suppresses percentage-based metrics.`);
      const incs = _sorted.map(r => r.summary?.totalIncome).filter(v => v != null);
      if (incs.length >= 3) { const yoy = incs.slice(1).map((v, i) => `${_sorted[i].year}→${_sorted[i+1].year}: ${incs[i] > 0 ? ((v - incs[i]) / incs[i] * 100).toFixed(0) + "%" : "—"}`).join("; "); _incomeBullets.push(`Year-over-year: ${yoy}.`); }
    } else if (_first.summary?.totalIncome) _incomeBullets.push(`Single-year total income: ${_fmtD(_first.summary.totalIncome)}.`);
    if (_multi) {
      const etrVals = _sorted.map(r => ({ y: r.year, e: metricMap[r.year]?.effectiveTaxRate })).filter(x => x.e != null);
      if (etrVals.length >= 2) _taxBullets.push(`Effective tax rate: ${_fmtP(etrVals[0].e)} (${etrVals[0].y}) → ${_fmtP(etrVals[etrVals.length-1].e)} (${etrVals[etrVals.length-1].y}). ${etrVals[etrVals.length-1].e > 0.25 ? "Current rate is high — wage-heavy in upper brackets." : etrVals[etrVals.length-1].e > 0.15 ? "Moderate burden at current level." : "Current rate is relatively low."}`);
      if (taxRateDelta != null) { if (taxRateDelta > 0.02) _taxBullets.push(`Rate increased ${(taxRateDelta * 100).toFixed(1)}pp${_lb ? " — driven by income entering taxable brackets from near-zero base." : " — income outpacing deduction scaling."}`); else if (taxRateDelta < -0.02) _taxBullets.push(`Rate decreased ${Math.abs(taxRateDelta * 100).toFixed(1)}pp — favorable shift.`); else _taxBullets.push(`Rate stable (${(taxRateDelta * 100).toFixed(1)}pp change).`); }
    } else if (_mFirst?.effectiveTaxRate != null) _taxBullets.push(`Effective tax rate: ${_fmtP(_mFirst.effectiveTaxRate)}.`);
    if (_multi) { const fa = _mFirst?.afterTaxIncome, la = _mLast?.afterTaxIncome, fi2 = _first.summary?.totalIncome, li2 = _last.summary?.totalIncome; if (fa && la && fi2 && li2 && fi2 > 0 && fa > 0) { const id = li2 - fi2, ad = la - fa; if (id > 0 && ad < 0) { _dragBullets.push(`Over ${_first.year}–${_last.year}: gross income rose ${_fmtD(id)} but after-tax income fell ${_fmtD(-ad)} — taxes grew faster than income over the period.`); } else if (id > 0 && ad > id) { _dragBullets.push(`Over ${_first.year}–${_last.year}: gross income rose ${_fmtD(id)} and total tax fell ${_fmtD(ad - id)}, so after-tax income grew by more than gross income.`); } else if (id > 0 && (id - ad) / id >= 0.05) { const mr = (id - ad) / id; _dragBullets.push(`Over ${_first.year}–${_last.year}: income +${_fmtD(id)}, after-tax +${_fmtD(ad)}. Taxes absorbed ${_fmtD(id - ad)} of income growth (${(mr * 100).toFixed(0)}%). Without optimization, this leakage will compound as income rises.`); _dragBullets.push(`Per $1.00 earned: $${mr.toFixed(2)} to taxes, $${(1 - mr).toFixed(2)} retained (${(mr * 100).toFixed(0)}% absorption rate).`); } } const ms = _sorted.map(r => ({ y: r.year, m: metricMap[r.year]?.afterTaxMargin })).filter(x => x.m != null); if (ms.length >= 2) { const d = ms[ms.length-1].m - ms[0].m; if (Math.abs(d) > 0.02) _dragBullets.push(`After-tax margin ${d > 0 ? "improved" : "declined"} from ${_fmtP(ms[0].m)} to ${_fmtP(ms[ms.length-1].m)}.`); } }
    if (_multi) {
      if (_mFirst?.afterTaxIncome && _mLast?.afterTaxIncome) _afterTaxBullets.push(`After-tax income: ${_fmtD(_mFirst.afterTaxIncome)} (${_first.year}) → ${_fmtD(_mLast.afterTaxIncome)} (${_last.year}).`);
      if (_mLast?.afterTaxMargin != null) _afterTaxBullets.push(`${_last.year} after-tax margin: ${_fmtP(_mLast.afterTaxMargin)} of total income kept after tax — ${_mLast.afterTaxMargin > 0.85 ? "strong" : _mLast.afterTaxMargin > 0.7 ? "moderate" : "significant tax drag"}.`);
    } else if (_mFirst?.afterTaxIncome != null) _afterTaxBullets.push(`After-tax income: ${_fmtD(_mFirst.afterTaxIncome)}, margin: ${_fmtP(_mFirst.afterTaxMargin)}.`);
    {
      const vLast = _incOf(_last); const tLast = vLast.wages + vLast.capitalGains + vLast.dividends + vLast.interest + vLast.other;
      if (tLast > 0) { const wL = vLast.wages / tLast; _compBullets.push(`${_last.year}: ${wL >= 0.95 ? "Entirely W-2 wages — ordinary rates apply" : wL >= 0.8 ? `${(wL*100).toFixed(0)}% wages, ${((1-wL)*100).toFixed(0)}% investment` : `Mixed — ${(wL*100).toFixed(0)}% wages, ${((1-wL)*100).toFixed(0)}% investment/other`}.`); }
      if (_multi) { const vF = _incOf(_first); const tF = vF.wages + vF.capitalGains + vF.dividends + vF.interest + vF.other; if (tF > 0 && tLast > 0) { const wF = vF.wages / tF; const wL2 = vLast.wages / tLast; if (Math.abs(wL2 - wF) > 0.05) _compBullets.push(`Wage concentration ${wL2 > wF ? "increased" : "decreased"} from ${(wF*100).toFixed(0)}% to ${(wL2*100).toFixed(0)}% over the period.`); else if (wL2 >= 0.95 && wF >= 0.95) _compBullets.push("Income remains fully W-2 across all years — limited tax flexibility."); } }
    }
    if (_mLast?.deductionEfficiency != null) { const d = _mLast.deductionEfficiency; _dedBullets.push(`${_last.year}: ${_fmtP(d)} of total income offset by the standard/itemized deduction — ${d > 0.2 ? "strong sheltering" : d > 0.1 ? "moderate" : "low; this ratio isn't moved by 401k, IRA, or HSA contributions"}.`); }
    if (_multi && _mFirst?.deductionEfficiency != null && _mLast?.deductionEfficiency != null) { const d = _mLast.deductionEfficiency - _mFirst.deductionEfficiency; if (Math.abs(d) > 0.03) _dedBullets.push(`Below-AGI deduction ratio ${d > 0 ? "increased" : "decreased"} by ${Math.abs(d * 100).toFixed(1)}pp over ${_first.year}–${_last.year}.`); }
    if (_multi) { if (_lb && incomeCagr != null && incomeCagr > 0.1 && taxRateDelta != null && taxRateDelta > 0.03) _summaryBullets.push("Income transitioned from minimal base into taxable territory. Window for establishing tax-efficient habits is now."); else if (incomeCagr != null && incomeCagr > 0.1 && taxRateDelta != null && taxRateDelta > 0.03) _summaryBullets.push("Income growing aggressively but tax burden growing disproportionately."); else if (incomeCagr != null && incomeCagr < 0) _summaryBullets.push("Income contracting — shift to defensive optimization."); if (_mLast?.deductionEfficiency != null && _mLast.deductionEfficiency < 0.08) _summaryBullets.push(`Below-AGI deduction ratio of ${_fmtP(_mLast.deductionEfficiency)} is the largest gap between total income and taxable income this year.`); if (_mLast?.afterTaxMargin != null) _summaryBullets.push(`Retention: ${_fmtP(_mLast.afterTaxMargin)} — $${(_mLast.afterTaxMargin).toFixed(2)} kept per $1.00 earned.`); }
    const _wtmBullets = [];
    if (incomeCagr != null && incomeCagr > 0.1 && taxRateDelta != null && taxRateDelta > 0.01) _wtmBullets.push(`Effective tax rate rising ${(taxRateDelta * 100).toFixed(1)}pp while income grows — entering higher tax exposure phase.`);
    else if (incomeCagr != null && incomeCagr > 0.1 && !_incomeRoseTaxFell) _wtmBullets.push(`Income at ${_latestR ? _fmtD(_latestR.summary?.totalIncome) : "current level"} — tax drag will compound without deduction scaling.`);
    if (taxRateDelta != null && taxRateDelta > 0.02) _wtmBullets.push(`The ${(taxRateDelta * 100).toFixed(1)}pp rate increase means take-home margin will continue to compress without structural changes.`);
    if (_latestM?.deductionEfficiency != null && _latestM.deductionEfficiency < 0.1) _wtmBullets.push(`At ${(_latestM.deductionEfficiency * 100).toFixed(1)}% below-AGI deduction ratio, itemizing (if eligible) is the only lever that moves this specific ratio.`);
    if (_latestM?.afterTaxMargin != null && _latestM.afterTaxMargin > 0.85) _wtmBullets.push(`${(_latestM.afterTaxMargin * 100).toFixed(1)}% after-tax margin is strong — priority is protecting this margin as income scales.`);
    if (_wtmBullets.length === 0 && _latestM?.effectiveTaxRate != null) _wtmBullets.push(`Current rate ${_fmtP(_latestM.effectiveTaxRate)} — review deduction strategy annually.`);
    if (taxRateDelta != null && taxRateDelta > 0.01) {
      _wtmBullets.push("You are entering a higher tax exposure phase. Without changes, a growing share of your income will be taxed at higher marginal rates.");
      _wtmBullets.push("What to do next: (1) Increase pre-tax contributions immediately. (2) Review withholding and deduction strategy. (3) Shift future income toward tax-advantaged sources.");
    } else if (_latestM?.deductionEfficiency != null && _latestM.deductionEfficiency < 0.15) {
      _wtmBullets.push("Below-AGI deduction ratio is low — that specifically reflects the standard/itemized deduction, not above-the-line contributions.");
      _wtmBullets.push("What to do next: (1) Evaluate whether itemizing would beat the standard deduction. (2) Separately, review 401k, HSA, and IRA contribution levels — these reduce your overall tax bill but won't change this ratio. (3) Review deduction strategy annually as income scales.");
    }
    return {
      tags: _tags, headline: _headline, explain: _explain, impact: _impact, actions: _actions, prose: _proseParts,
      incomeBullets: _incomeBullets, taxBullets: _taxBullets, dragBullets: _dragBullets, afterTaxBullets: _afterTaxBullets,
      compBullets: _compBullets, dedBullets: _dedBullets, summaryBullets: _summaryBullets, wtmBullets: _wtmBullets,
    };
  })();

  return {
    results, metrics, metricMap, trendData,
    trendInsights, overriddenInsights,
    incomeCagr, afterTaxCagr, taxRateDelta, lowBase: _lowBase,
    strategyPhase, overviewSentence,
    yearInsights: results.map(r => yearInsight(r.year)),
    whyBullets: Object.fromEntries(results.map(r => [r.year, whyBullets(r.year)])),
    peakRiskYear, nrTransitionYear, nrTransitionText: NR_TRANSITION_TEXT, peakRiskText: PEAK_RISK_TEXT,
    strategyTab,
  };
}

// Collect every narrative string the app would render for a pipeline result, tagged by surface.
export function collectNarrative(p) {
  const out = [];
  p.metrics.forEach((m, i) => {
    const y = p.results[i].year;
    for (const [k, s] of Object.entries(m.insights?.signals ?? {})) if (s) out.push({ surface: `signal.${k}`, year: y, text: s.label });
    (m.insights?.summary ?? []).forEach(s => out.push({ surface: "insights.summary", year: y, text: s.text }));
    (m.falseSignals ?? []).forEach(s => out.push({ surface: `falseSignal.${s.flag}`, year: y, text: s.override }));
    out.push({ surface: "healthLabel", year: y, text: m.healthLabel });
  });
  p.overriddenInsights.forEach(t => out.push({ surface: "trendInsights", year: null, text: t.text }));
  if (p.strategyPhase) {
    out.push({ surface: "strategyPhase.phase", year: null, text: p.strategyPhase.phase });
    out.push({ surface: "strategyPhase.note", year: null, text: p.strategyPhase.note });
    out.push({ surface: "strategyPhase.implication", year: null, text: p.strategyPhase.implication });
    p.strategyPhase.characteristics.forEach(c => out.push({ surface: "strategyPhase.characteristic", year: null, text: c }));
  }
  if (p.overviewSentence) out.push({ surface: "overview", year: null, text: p.overviewSentence });
  p.yearInsights.forEach(yi => { if (yi?.etrLabel) out.push({ surface: "yearInsight.etr", year: yi.year, text: yi.etrLabel }); if (yi?.deLabel) out.push({ surface: "yearInsight.de", year: yi.year, text: yi.deLabel }); });
  for (const [y, bs] of Object.entries(p.whyBullets)) bs.forEach(b => out.push({ surface: "why", year: Number(y), text: b }));
  if (p.nrTransitionText) out.push({ surface: "nrTransition", year: p.nrTransitionYear, text: p.nrTransitionText });
  if (p.peakRiskText) out.push({ surface: "peakRisk", year: p.peakRiskYear, text: p.peakRiskText });
  const st = p.strategyTab;
  if (st) {
    out.push({ surface: "strategy.headline", year: null, text: st.headline });
    out.push({ surface: "strategy.explain", year: null, text: st.explain });
    if (st.impact) out.push({ surface: "strategy.impact", year: null, text: st.impact });
    st.actions.forEach(a => out.push({ surface: "strategy.action", year: null, text: `${a.action} — ${a.reason}` }));
    st.prose.forEach(t => out.push({ surface: "strategy.prose", year: null, text: t }));
    for (const k of ["incomeBullets", "taxBullets", "dragBullets", "afterTaxBullets", "compBullets", "dedBullets", "summaryBullets", "wtmBullets"]) st[k].forEach(t => out.push({ surface: `strategy.${k}`, year: null, text: t }));
  }
  return out;
}
