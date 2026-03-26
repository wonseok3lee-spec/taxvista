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

  const insights = generateInsights({ agiRatio, effectiveTaxRate, deductionEfficiency, afterTaxMargin }, compare);

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
    insights,
  };
}

function generateInsights({ agiRatio, effectiveTaxRate, deductionEfficiency, afterTaxMargin }, compare) {
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

  const summary = buildSummary({ ...signals, effectiveTaxRate, deductionEfficiency, afterTaxMargin }, compare);

  return { signals, summary };
}

// compare: optional { priorETR, avgETR, priorDE, avgDE, priorATM } for cross-year context
function buildSummary({ agi, tax, deduction, margin, effectiveTaxRate, deductionEfficiency, afterTaxMargin }, compare) {
  const items = [];
  const c = compare || {};

  // Line 1: effective tax rate — must include comparison
  if (effectiveTaxRate != null) {
    const etrPct = (effectiveTaxRate * 100).toFixed(1);
    let compText = "";
    if (c.priorETR != null) {
      const delta = effectiveTaxRate - c.priorETR;
      const priorPct = (c.priorETR * 100).toFixed(1);
      compText = delta > 0.005
        ? `, up ${(delta * 100).toFixed(1)} percentage points from ${priorPct}% prior year — rising tax burden`
        : delta < -0.005
        ? `, down ${Math.abs(delta * 100).toFixed(1)} percentage points from ${priorPct}% prior year — improving efficiency`
        : `, unchanged from ${priorPct}% prior year — stable tax burden`;
    } else if (c.avgETR != null) {
      const delta = effectiveTaxRate - c.avgETR;
      const avgPct = (c.avgETR * 100).toFixed(1);
      compText = Math.abs(delta) > 0.005
        ? `, ${delta > 0 ? "above" : "below"} the multi-year average of ${avgPct}% by ${Math.abs(delta * 100).toFixed(1)} percentage points`
        : `, in line with the multi-year average of ${avgPct}%`;
    }
    const atmText = afterTaxMargin != null
      ? `, retaining ${(afterTaxMargin * 100).toFixed(1)}% of gross income after tax`
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
      compText = Math.abs(delta) > 0.005
        ? ` (${delta > 0 ? "up" : "down"} from ${priorPct}% prior year)`
        : ` (unchanged from ${priorPct}% prior year)`;
    } else if (c.avgDE != null) {
      const avgPct = (c.avgDE * 100).toFixed(1);
      compText = ` (vs ${avgPct}% multi-year average)`;
    }
    if (deduction?.level === "low") {
      items.push({ text: `Deduction efficiency: ${dePct}%${compText} — only ${dePct}% of gross income offset by deductions, leaving ${(100 - Number(dePct)).toFixed(1)}% fully taxable`, metric: "deduction" });
    } else if (deduction?.level === "high") {
      items.push({ text: `Deduction efficiency: ${dePct}%${compText} — ${dePct}% of gross income sheltered from taxation through deductions and pre-tax contributions`, metric: "deduction" });
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
