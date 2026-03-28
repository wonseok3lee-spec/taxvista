export function calculateMetrics(data, compare) {
  const { income, summary } = data;
  const { totalIncome, totalTax } = summary;

  const totalIncomeFromParts =
    (income.wages ?? 0) +
    (income.capitalGains ?? 0) +
    (income.interest ?? 0) +
    (income.dividends ?? 0) +
    (income.additionalIncome ?? 0);

  const pct = (val) => (totalIncomeFromParts ? (val ?? 0) / totalIncomeFromParts : null);

  const wagesPct       = pct(income.wages);
  const capitalGainsPct = pct(income.capitalGains);
  const interestPct    = pct(income.interest);
  const dividendsPct   = pct(income.dividends);

  const knownPct = [wagesPct, capitalGainsPct, interestPct, dividendsPct]
    .reduce((sum, v) => sum + (v ?? 0), 0);
  const otherPct = totalIncomeFromParts ? Math.max(0, 1 - knownPct) : null;

  const { adjustedGrossIncome: agi, taxableIncome } = summary;

  const afterTaxIncome    = totalIncome != null && totalTax != null ? totalIncome - totalTax : null;
  const agiRatio          = totalIncome && agi != null        ? agi / totalIncome : null;
  const taxableRatio      = agi          && taxableIncome != null ? taxableIncome / agi : null;
  const effectiveTaxRate  = taxableIncome && totalTax != null  ? totalTax / taxableIncome : null;
  const taxToIncome       = totalIncome  && totalTax != null   ? totalTax / totalIncome : null;
  const deductionEfficiency = totalIncome && agi != null && taxableIncome != null ? (agi - taxableIncome) / totalIncome : null;
  const afterTaxMargin    = totalIncome  && afterTaxIncome != null ? afterTaxIncome / totalIncome : null;

  const cg = income.capitalGains ?? 0;
  const hasCapitalLoss = cg < 0;
  const isLossDriven = cg < 0 && totalIncome > 0 && Math.abs(cg) > totalIncome * 0.10;

  // === FALSE SIGNAL DETECTION ===
  const c = compare || {};
  const priorIncome = c.priorIncome ?? null;
  const incomeYoY = priorIncome ? (totalIncome - priorIncome) / priorIncome : null;
  const etrYoY = c.priorETR != null && effectiveTaxRate != null ? effectiveTaxRate - c.priorETR : null;
  const deductionYoY = c.priorDE != null && deductionEfficiency != null ? deductionEfficiency - c.priorDE : null;

  const falseSignals = [];
  if (etrYoY != null && etrYoY < -0.02 && incomeYoY != null && incomeYoY < -0.10) {
    falseSignals.push({ flag: "FALSE_EFFICIENCY", severity: "HIGH", override: "Tax efficiency appears improved, but is primarily driven by reduced income, not structural optimization." });
  }
  if (cg < 0 && totalIncome > 0 && Math.abs(cg) > totalIncome * 0.10 && etrYoY != null && etrYoY < 0) {
    falseSignals.push({ flag: "LOSS_DISTORTION", severity: "HIGH", override: "Lower tax burden is partially driven by realized losses, which may not reflect sustainable tax efficiency." });
  }
  if (incomeYoY != null && incomeYoY < -0.30) {
    falseSignals.push({ flag: "INCOME_COLLAPSE", severity: "CRITICAL", override: "Income has declined significantly. Tax metrics may appear improved but reflect contraction, not optimization." });
  }
  if (deductionYoY != null && deductionYoY > 0.03 && incomeYoY != null && incomeYoY < -0.10) {
    falseSignals.push({ flag: "DEDUCTION_ILLUSION", severity: "MEDIUM", override: "Higher deduction ratios are influenced by lower income, not necessarily increased tax planning activity." });
  }
  if (incomeYoY != null && incomeYoY > 0.05 && etrYoY != null && etrYoY < -0.01 && deductionYoY != null && deductionYoY > 0.01) {
    falseSignals.push({ flag: "TRUE_OPTIMIZATION", severity: "POSITIVE", override: "Tax efficiency improved alongside income growth — indicates effective tax structuring." });
  }
  // RULE 6 — Capital Gain Spike (one-time event)
  const priorCapGains = c.priorCapGains ?? null;
  if (cg > 0 && totalIncome > 0 && cg > totalIncome * 0.35 && (priorCapGains === null || cg > priorCapGains * 3)) {
    falseSignals.push({ flag: "ONE_TIME_EVENT", severity: "MEDIUM", override: "Income growth this year includes a significant capital gain that may be non-recurring. Core earnings growth may differ from total income growth." });
  }
  const priorityOrder = ["CRITICAL", "HIGH", "MEDIUM", "POSITIVE"];
  falseSignals.sort((a, b) => priorityOrder.indexOf(a.severity) - priorityOrder.indexOf(b.severity));
  const primarySignal = falseSignals[0] ?? null;

  const insights = generateInsights({ agiRatio, effectiveTaxRate, deductionEfficiency, afterTaxMargin, hasCapitalLoss, isLossDriven, primarySignal }, compare);

  return {
    incomeBreakdown: {
      wagesPct,
      capitalGainsPct,
      interestPct,
      dividendsPct,
      otherPct,
    },
    taxRate:            taxToIncome,
    afterTaxIncome,
    agiRatio,
    taxableRatio,
    effectiveTaxRate,
    taxToIncome,
    deductionEfficiency,
    afterTaxMargin,
    isLossDriven,
    falseSignals,
    primarySignal,
    insights,
  };
}

function generateInsights({ agiRatio, effectiveTaxRate, deductionEfficiency, afterTaxMargin, hasCapitalLoss, isLossDriven, primarySignal }, compare) {
  const signals = { agi: null, tax: null, deduction: null, margin: null };

  if (agiRatio != null) {
    if (agiRatio > 0.9)       signals.agi = { label: "Few income adjustments",   level: "low"  };
    else if (agiRatio > 0.7)  signals.agi = { label: "Some income adjustments",  level: "mid"  };
    else                      signals.agi = { label: "Well-structured income",    level: "high" };
  }

  if (effectiveTaxRate != null) {
    if (effectiveTaxRate > 0.25)      signals.tax = { label: "High tax burden", level: "low"  };
    else if (effectiveTaxRate > 0.15) signals.tax = { label: "Tax: moderate",   level: "mid"  };
    else                              signals.tax = { label: "Tax-efficient",    level: "high" };
  }

  if (deductionEfficiency != null) {
    if (deductionEfficiency > 0.2)      signals.deduction = { label: "Strong deductions",  level: "high" };
    else if (deductionEfficiency > 0.1) signals.deduction = { label: "Average deductions", level: "mid"  };
    else                                signals.deduction = { label: "Low deductions",      level: "low"  };
  }

  if (afterTaxMargin != null) {
    if (afterTaxMargin > 0.75)      signals.margin = { label: "Strong take-home",   level: "high" };
    else if (afterTaxMargin > 0.6)  signals.margin = { label: "Moderate take-home", level: "mid"  };
    else                            signals.margin = { label: "High tax drag",       level: "low"  };
  }

  // Override positive signal tags when false signal is CRITICAL or HIGH
  if (primarySignal && (primarySignal.severity === "CRITICAL" || primarySignal.severity === "HIGH")) {
    if (signals.tax?.level === "high")      signals.tax       = { label: "\u26A0 Loss-driven",   level: "low" };
    if (signals.deduction?.level === "high") signals.deduction = { label: "\u26A0 Income-driven", level: "low" };
    if (signals.margin?.level === "high")   signals.margin    = { label: "\u26A0 Contraction",   level: "low" };
  }

  const summary = buildSummary({ ...signals, effectiveTaxRate, deductionEfficiency, afterTaxMargin, hasCapitalLoss, isLossDriven, primarySignal }, compare);

  return { signals, summary };
}

// compare: optional { priorETR, avgETR, priorDE, avgDE, priorATM } for cross-year context
function buildSummary({ agi, tax, deduction, margin, effectiveTaxRate, deductionEfficiency, afterTaxMargin, hasCapitalLoss, isLossDriven, primarySignal }, compare) {
  const items = [];
  const c = compare || {};

  // False signal override — must appear first when severity is CRITICAL or HIGH
  if (primarySignal && (primarySignal.severity === "CRITICAL" || primarySignal.severity === "HIGH")) {
    items.push({ text: primarySignal.override, metric: "etr" });
  } else if (isLossDriven && effectiveTaxRate != null && afterTaxMargin != null) {
    items.push({ text: `Tax reduction was primarily driven by capital losses — not by structural optimization. Effective tax rate: ${(effectiveTaxRate * 100).toFixed(1)}%, retaining ${(afterTaxMargin * 100).toFixed(1)}% of total income after tax.`, metric: "etr" });
  }

  // Line 1: effective tax rate — must include comparison
  if (effectiveTaxRate != null) {
    const etrPct = (effectiveTaxRate * 100).toFixed(1);
    let compText = "";
    if (c.priorETR != null) {
      const delta = effectiveTaxRate - c.priorETR;
      const priorPct = (c.priorETR * 100).toFixed(1);
      const absDelta = Math.abs(delta);
      const capLossCaveat = delta < -0.005 && hasCapitalLoss ? " (partly driven by capital losses reducing taxable income, not solely structural optimization)" : "";
      compText = absDelta > 0.01
        ? `, ${delta > 0 ? "up" : "down"} ${(absDelta * 100).toFixed(1)} percentage points from ${priorPct}% prior year — ${delta > 0 ? "rising tax burden" : "improving efficiency"}${capLossCaveat}`
        : absDelta > 0.002
        ? `, slightly ${delta > 0 ? "increased" : "decreased"} from ${priorPct}% prior year`
        : `, essentially unchanged from ${priorPct}% prior year — stable tax burden`;
    } else if (c.avgETR != null) {
      const delta = effectiveTaxRate - c.avgETR;
      const avgPct = (c.avgETR * 100).toFixed(1);
      compText = Math.abs(delta) > 0.005
        ? `, ${delta > 0 ? "above" : "below"} the multi-year average of ${avgPct}% by ${Math.abs(delta * 100).toFixed(1)} percentage points`
        : `, in line with the multi-year average of ${avgPct}%`;
    }
    const atmText = afterTaxMargin != null
      ? `, retaining ${(afterTaxMargin * 100).toFixed(1)}% of total income after tax`
      : "";
    // Only emit if we have a comparison OR an afterTaxMargin comparison
    if (compText || afterTaxMargin != null) {
      items.push({ text: `Effective tax rate: ${etrPct}%${compText}${atmText}`, metric: "etr" });
    }
  }

  // Line 2: deduction efficiency — must include comparison
  if (deductionEfficiency != null) {
    const dePct = (deductionEfficiency * 100).toFixed(1);
    let compText = "";
    if (c.priorDE != null) {
      const delta = deductionEfficiency - c.priorDE;
      const priorPct = (c.priorDE * 100).toFixed(1);
      compText = Math.abs(delta) > 0.01
        ? ` (${delta > 0 ? "up" : "down"} ${(Math.abs(delta) * 100).toFixed(1)}pp from ${priorPct}% prior year)`
        : Math.abs(delta) > 0.002
        ? ` (slightly ${delta > 0 ? "up" : "down"} from ${priorPct}% prior year)`
        : ` (essentially unchanged from ${priorPct}% prior year)`;
    } else if (c.avgDE != null) {
      const avgPct = (c.avgDE * 100).toFixed(1);
      compText = ` (vs ${avgPct}% multi-year average)`;
    }
    if (deduction?.level === "low") {
      items.push({ text: `Deduction efficiency: ${dePct}%${compText} — only ${dePct}% of total income offset by deductions, leaving ${(100 - Number(dePct)).toFixed(1)}% fully taxable`, metric: "deduction" });
    } else if (deduction?.level === "high") {
      items.push({ text: `Deduction efficiency: ${dePct}%${compText} — ${dePct}% of total income sheltered from taxation through deductions and pre-tax contributions`, metric: "deduction" });
    } else {
      items.push({ text: `Deduction efficiency: ${dePct}%${compText} — moderate sheltering; increasing pre-tax contributions would raise this ratio`, metric: "deduction" });
    }
  }

  // Line 3: action — tied to specific metrics with comparison context
  if (deduction?.level === "low" && deductionEfficiency != null && afterTaxMargin != null) {
    const dePct = (deductionEfficiency * 100).toFixed(1);
    const atmPct = (afterTaxMargin * 100).toFixed(1);
    const deAction = deductionEfficiency < 0.06
      ? "401k / IRA contributions have near-zero competition for tax reduction — this is the highest-leverage action"
      : deductionEfficiency <= 0.10
      ? "pre-tax contributions are the primary lever — 401k and IRA reduce taxable income dollar-for-dollar"
      : "deductions are active — continue scaling pre-tax contributions as income grows";
    items.push({ text: `At ${dePct}% deduction efficiency vs ${atmPct}% after-tax retention — ${deAction}`, metric: "deduction" });
  } else if (effectiveTaxRate != null && afterTaxMargin != null) {
    const etrPct = (effectiveTaxRate * 100).toFixed(1);
    const atmPct = (afterTaxMargin * 100).toFixed(1);
    items.push({ text: `${etrPct}% effective rate vs ${atmPct}% retention — ${afterTaxMargin > 0.85 ? "protect this margin by routing growth through tax-advantaged accounts" : "withholding review + deduction audit to improve retention ratio"}`, metric: "deduction" });
  }

  return items.length ? items : null;
}
