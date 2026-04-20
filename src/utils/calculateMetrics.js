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

  // === FINANCIAL HEALTH SCORE ===
  let healthScore = 50;
  if (falseSignals.some(s => s.flag === "TRUE_OPTIMIZATION")) healthScore += 20;
  if (effectiveTaxRate != null && effectiveTaxRate < 0.15) healthScore += 10;
  if (deductionEfficiency != null && deductionEfficiency > 0.20) healthScore += 10;
  if (afterTaxMargin != null && afterTaxMargin > 0.80) healthScore += 10;
  if (falseSignals.some(s => s.flag === "INCOME_COLLAPSE")) healthScore -= 30;
  if (falseSignals.some(s => s.flag === "FALSE_EFFICIENCY")) healthScore -= 25;
  if (falseSignals.some(s => s.flag === "LOSS_DISTORTION")) healthScore -= 20;
  if (falseSignals.some(s => s.flag === "DEDUCTION_ILLUSION")) healthScore -= 10;
  if (falseSignals.some(s => s.flag === "ONE_TIME_EVENT")) healthScore -= 5;
  healthScore = Math.max(0, Math.min(100, healthScore));
  const healthLabel = healthScore >= 80 ? "Strong" : healthScore >= 60 ? "Stable" : healthScore >= 40 ? "Moderate" : healthScore >= 20 ? "At Risk" : "Critical";
  const healthColor = healthScore >= 80 ? "positive" : healthScore >= 60 ? "neutral" : healthScore >= 40 ? "caution" : "danger";

  const insights = generateInsights({ agiRatio, effectiveTaxRate, deductionEfficiency, afterTaxMargin, hasCapitalLoss, isLossDriven, primarySignal, incomeYoY, totalIncome }, compare);

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
    healthScore,
    healthLabel,
    healthColor,
    insights,
  };
}

function generateInsights({ agiRatio, effectiveTaxRate, deductionEfficiency, afterTaxMargin, hasCapitalLoss, isLossDriven, primarySignal, incomeYoY, totalIncome }, compare) {
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

  // Contraction-driven deduction rise: override deduction tag when income shrank
  // (runs after CRITICAL/HIGH override so Income-driven / Loss-driven tags take priority)
  if (incomeYoY != null && incomeYoY < -0.05 && signals.deduction && signals.deduction.level !== "low") {
    signals.deduction = { label: "\u26A0 Contraction-driven", level: "low" };
  }

  const summary = buildSummary({ ...signals, effectiveTaxRate, deductionEfficiency, afterTaxMargin, hasCapitalLoss, isLossDriven, primarySignal, incomeYoY, totalIncome }, compare);

  return { signals, summary };
}

// compare: optional { priorETR, avgETR, priorDE, avgDE, priorATM } for cross-year context
function buildSummary({ agi, tax, deduction, margin, effectiveTaxRate, deductionEfficiency, afterTaxMargin, hasCapitalLoss, isLossDriven, primarySignal, incomeYoY, totalIncome }, compare) {
  const items = [];
  const c = compare || {};
  const isContracting = incomeYoY != null && incomeYoY < -0.05;
  const isHighIncome  = totalIncome != null && totalIncome > 250000;

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
      const lowAction = isHighIncome
        ? `Standard Deduction is a fixed IRS amount — at this income level it naturally covers only ${dePct}% of gross. Lowering taxable income requires above-the-line moves: 401k, HSA, IRA, Mega Backdoor Roth`
        : `only ${dePct}% of total income offset by deductions, leaving ${(100 - Number(dePct)).toFixed(1)}% fully taxable`;
      items.push({ text: `Deduction efficiency: ${dePct}%${compText} — ${lowAction}`, metric: "deduction" });
    } else if (deduction?.level === "high") {
      const highAction = isContracting
        ? `${dePct}% reflects income contraction outpacing flat deductions, not active sheltering`
        : `${dePct}% of total income sheltered from taxation through deductions and pre-tax contributions`;
      items.push({ text: `Deduction efficiency: ${dePct}%${compText} — ${highAction}`, metric: "deduction" });
    } else {
      const midAction = isContracting
        ? "moderate sheltering; hold current contribution pace — income contraction makes liquidity the higher priority"
        : isHighIncome
        ? "moderate sheltering — at this income level, Mega Backdoor Roth and Deferred Compensation often outrank simple 401k increases for marginal tax reduction"
        : "moderate sheltering; increasing pre-tax contributions would raise this ratio";
      items.push({ text: `Deduction efficiency: ${dePct}%${compText} — ${midAction}`, metric: "deduction" });
    }
  }

  // Line 3: action — tied to specific metrics with comparison context
  if (deduction?.level === "low" && deductionEfficiency != null && afterTaxMargin != null) {
    const dePct = (deductionEfficiency * 100).toFixed(1);
    const atmPct = (afterTaxMargin * 100).toFixed(1);
    let deAction;
    if (isContracting) {
      deAction = "deduction efficiency rose mechanically due to income contraction, not optimization — prioritize liquidity; avoid increasing pre-tax contributions until income recovers";
    } else if (isHighIncome && deductionEfficiency < 0.06) {
      deAction = "At this income level, Standard Deduction alone won't move the needle. Highest-leverage moves: max 401k ($23,500 in 2025), HSA if eligible ($4,300 single), and Backdoor Roth IRA. Above ~$350K total income, also consider Mega Backdoor Roth and Deferred Compensation if available through employer.";
    } else if (isHighIncome && deductionEfficiency <= 0.10) {
      deAction = "Pre-tax contributions reduce taxable income dollar-for-dollar. At this income level, prioritize: 401k max, HSA (if eligible), Backdoor Roth, then Mega Backdoor Roth if plan allows after-tax contributions.";
    } else if (deductionEfficiency < 0.06) {
      deAction = "401k / IRA contributions have near-zero competition for tax reduction — this is the highest-leverage action";
    } else if (deductionEfficiency <= 0.10) {
      deAction = "pre-tax contributions are the primary lever — 401k and IRA reduce taxable income dollar-for-dollar";
    } else if (incomeYoY != null && incomeYoY <= 0.05) {
      deAction = "deductions are active — maintain current pre-tax contribution pace";
    } else {
      deAction = "deductions are active — continue scaling pre-tax contributions as income grows";
    }
    items.push({ text: `At ${dePct}% deduction efficiency vs ${atmPct}% after-tax retention — ${deAction}`, metric: "deduction" });
  } else if (effectiveTaxRate != null && afterTaxMargin != null) {
    const etrPct = (effectiveTaxRate * 100).toFixed(1);
    const atmPct = (afterTaxMargin * 100).toFixed(1);
    const marginAction = afterTaxMargin > 0.85
      ? (isContracting
        ? "high retention this year reflects reduced income rather than optimization — preserve liquidity until income recovers"
        : "protect this margin by routing growth through tax-advantaged accounts")
      : "withholding review + deduction audit to improve retention ratio";
    items.push({ text: `${etrPct}% effective rate vs ${atmPct}% retention — ${marginAction}`, metric: "deduction" });
  }

  return items.length ? items : null;
}
