# TaxVista Master Reference Document
**Version 2.0 — March 2026**
**For Claude Code Use Only**

> ⚠️ Read this entire file before making any changes to TaxVista code.
> This is the single source of truth for all formulas, labels, and metric definitions.

---

## SECTION 1 — CANONICAL METRIC DEFINITIONS

These are the **only** definitions used in the entire codebase.
No component may define its own version of these formulas.

### 1.1 Core Financial Metrics

| Code Variable | Formula | Label in UI | Label in PDF |
|---|---|---|---|
| `effectiveTaxRate` | `totalTax / taxableIncome` | `Effective Tax Rate` | `Eff. Tax Rate` |
| `taxToIncome` | `totalTax / totalIncome` | `Tax / Income` | `Tax / Income` |
| `afterTaxIncome` | `totalIncome - totalTax` | `After-Tax Income` | `After-Tax Income` |
| `afterTaxMargin` | `afterTaxIncome / totalIncome` | `After-Tax Margin` | `After-Tax Margin` |
| `agiRatio` | `agi / totalIncome` | `Adjusted Gross / Total` | `AGI / Total` |
| `taxableRatio` | `taxableIncome / agi` | `Taxable / Adjusted Gross` | `Taxable / AGI` |
| `deductionEfficiency` | `(agi - taxableIncome) / totalIncome` | `Deduction Efficiency` | `Deduction Eff.` |

### 1.2 Multi-Year Trend Metrics

| Code Variable | Formula | Label in UI | Label in PDF |
|---|---|---|---|
| `incomeCagr` | `(lastIncome / firstIncome)^(1/(n-1)) - 1` | `Income Growth Rate` | `Income Growth Rate` |
| `afterTaxCagr` | `(lastAfterTax / firstAfterTax)^(1/(n-1)) - 1` | `Take-Home Growth Rate` | `Take-Home Growth` |
| `taxRateDelta` | `lastEffectiveTaxRate - firstEffectiveTaxRate` | `Effective Tax Rate Change` | `Tax Rate Shift` |

> ⚠️ **CRITICAL — taxRateDelta fix (v2.0):**
> `taxRateDelta` MUST be calculated using `effectiveTaxRate` (Tax / Taxable Income).
> Previous code incorrectly used `taxToIncome` (Tax / Total Income) for this calculation
> while labeling it "Effective Tax Rate Change." This was a mislabel — now fixed.
>
> ```javascript
> // ✅ CORRECT (v2.0)
> const taxRateDelta = _mN.effectiveTaxRate - _m0.effectiveTaxRate;
>
> // ❌ WRONG (old code — do not use)
> const taxRateDelta = _mN.taxToIncome - _m0.taxToIncome;
> ```

### 1.3 Source Fields (IRS Line Numbers)

| Variable | Definition | IRS Source |
|---|---|---|
| `totalIncome` | All income before adjustments | 1040 Line 9 / 1040-NR Line 9 |
| `agi` | After pre-tax adjustments | 1040 Line 11/11a / 1040-NR Line 11/11a |
| `taxableIncome` | Income subject to tax | 1040 Line 15 |
| `totalTax` | Total federal tax | 1040 Line 24 |
| `afterTaxIncome` | Derived: `totalIncome - totalTax` | — |

---

## SECTION 2 — LABEL STANDARDS

### 2.1 Exact Labels to Use Everywhere

| Metric | ✅ Use This | ❌ Never Use |
|---|---|---|
| `effectiveTaxRate` | `Effective Tax Rate` | `Eff. Tax Rate`, `Tax Rate`, `ETR` |
| `taxToIncome` | `Tax / Income` | `Tax Rate`, `Effective Tax Rate` |
| `taxRateDelta` | `Effective Tax Rate Change` | `Tax Rate Shift` (UI only — PDF may use short form) |
| `incomeCagr` | `Income Growth Rate` | `Income CAGR`, `Annualized Growth` |
| `afterTaxCagr` | `Take-Home Growth Rate` | `After-Tax CAGR`, `Take-Home CAGR` |

### 2.2 Chart Bar Labels

The "Tax Rate by Year" bar chart shows two bars:

| Bar | `dataKey` | `name` prop | Color |
|---|---|---|---|
| Bar 1 | `taxRate` (= `taxToIncome * 100`) | `Tax / Income` | `#b85c5c` |
| Bar 2 | `effectiveTaxRate` (= `effectiveTaxRate * 100`) | `Effective Tax Rate` | `#c47a3a` |

> Note: Bar 1 will always be lower than Bar 2 because Total Income > Taxable Income.
> This is expected and correct.

---

## SECTION 3 — TOOLTIP STANDARDS

### 3.1 Universal Tooltip Rules

- Start with **"How"**
- **No question marks** at the end
- **1 sentence only**
- **No punctuation** at the end
- **No jargon** — avoid "annualized", "basis points", "CAGR"
- Plain English only

### 3.2 Canonical Tooltip Copy

| Field | Tooltip Text |
|---|---|
| Income Growth Rate | `How your income changes over time from your first to latest year` |
| Take-Home Growth Rate | `How your after-tax income changes over time from your first to latest year` |
| Effective Tax Rate Change | `How your effective tax rate shifted from your first to most recent year` |
| Effective Tax Rate | `Effective Tax Rate = Total tax ÷ taxable income after deductions` |
| Tax / Income | `Tax / Income = Total tax ÷ total income before deductions` |
| After-Tax Income | `What you kept after all taxes were paid` |
| After-Tax Margin | `The percentage of your total income that you actually keep` |
| Deduction Efficiency | `How much your deductions reduce your taxable income relative to gross income` |
| Adjusted Gross / Total | `How much of your income remains after pre-tax adjustments` |
| Taxable / Adjusted Gross | `How much of your adjusted income ends up being taxed` |
| After-Tax Income Trend | `How much you kept after taxes — year over year` |
| Gross Income vs Take-Home | `What you earned vs what you kept after taxes` |
| Tax Rate by Year | `How much of your income went to taxes each year` |
| Where Income Comes From | `Where your income comes from — wages, investments, dividends, and other sources` |
| Income & Tax Summary | `How your income shrinks from what you earn to what gets taxed to what you keep` |

---

## SECTION 4 — STRATEGY DETECTION THRESHOLDS

Signal tags use `effectiveTaxRate` as the base:

```javascript
// ETR signal tags — all use effectiveTaxRate (Tax / Taxable Income)
'Tax-efficient'  : effectiveTaxRate < 0.10
'Tax: moderate'  : effectiveTaxRate >= 0.10 && effectiveTaxRate < 0.20
// (no tag for > 20% — add "High Tax Burden" if needed)

// Income phase — uses incomeCagr
'High Growth'    : incomeCagr > 0.20
'Steady'         : incomeCagr >= 0.05 && incomeCagr <= 0.20
'Declining'      : incomeCagr < 0

// Deduction signals — uses deductionEfficiency
'Strong deductions' : deductionEfficiency > 0.20
'Low deductions'    : deductionEfficiency < 0.10

// After-tax signals — uses afterTaxMargin
'Strong take-home'  : afterTaxMargin > 0.80
```

---

## SECTION 5 — METRIC RELATIONSHIPS (for insight engine)

Understanding how metrics relate prevents contradictory insight text:

```
ETR (high) ←→ Deduction Efficiency (low)   — inverse relationship
ETR = cause output / Deduction Efficiency = cause input

taxRateDelta > 0 → "rate rising" → warn user
taxRateDelta < 0 → "rate falling" → positive signal

incomeCagr > taxRateDelta significantly → tax growing faster than income → warn
afterTaxCagr < incomeCagr → take-home lagging income → flag tax drag
```

**Deduction Efficiency vs ETR — key distinction:**

| | What it measures | Direction |
|---|---|---|
| `ETR` | How much tax you paid (result) | Lower = better |
| `Deduction Efficiency` | How much income was sheltered (cause) | Higher = better |

They are causally linked: higher deduction efficiency → lower ETR.
Insight engine should never contradict these: e.g., don't say "high ETR" and "strong deductions" for the same year.

---

## SECTION 6 — CONSISTENCY RULES FOR PDF

The PDF layer must use **the same computed values** from `metricMap` — no recalculation.

| PDF Field | Source Variable | ❌ Never recalculate as |
|---|---|---|
| `Eff. Tax Rate` | `m.effectiveTaxRate` | `totalTax / totalIncome` |
| `Tax / Income` | `m.taxToIncome` | `totalTax / taxableIncome` |
| `Tax Rate Shift` | `taxRateDelta` (= effectiveTaxRate delta) | `taxToIncome` delta |
| `After-Tax Margin` | `m.afterTaxMargin` | any inline calc |
| `Deduction Eff.` | `m.deductionEfficiency` | any inline calc |

---

## SECTION 7 — IRS FORM FIELD MAPS (year-aware)

### 7.1 Form 1040 — Critical Year Changes

| Field | 2021 | 2022–2024 | 2025 |
|---|---|---|---|
| W-2 Wages | Line 1 | Line 1a | Line 1a |
| Total Wages | N/A | Line 1z | Line 1z |
| Capital Gain | Line 7 | Line 7 | Line 7a ⚠️ |
| AGI | Line 11 | Line 11 | Line 11a ⚠️ |
| Deductions | Line 12a | Line 12 | Line 12e ⚠️ |
| QBI Deduction | Line 13 | Line 13 | Line 13a ⚠️ |
| Schedule 1-A | N/A | N/A | Line 13b ⚠️ (NEW) |
| Taxable Income | Line 15 | Line 15 | Line 15 |
| Total Tax | Line 24 | Line 24 | Line 24 |

### 7.2 Form 1040-NR — Critical Year Changes

| Field | 2021 | 2022–2024 | 2025 |
|---|---|---|---|
| Treaty Exempt | Line 1c ⚠️ | Line 1k | Line 1k |
| Total Adjustments | Line 10d | Line 10d (2022) / Line 10 (2023+) | Line 10 |
| AGI | Line 11 | Line 11 | Line 11a ⚠️ |
| Itemized Ded. | Line 12a ⚠️ | Line 12 | Line 12 |
| Schedule 1-A | N/A | N/A | Line 13c ⚠️ (NEW) |
| NEC Tax | Line 23a | Line 23a | Line 23a |

### 7.3 SALT Cap

| Years | Cap | MFS Cap |
|---|---|---|
| 2021–2024 | $10,000 | $5,000 |
| 2025 | $40,000 ⚠️ | $20,000 ⚠️ |

### 7.4 2025 New Items

- **Schedule 1-A** (brand new): Tips deduction, Overtime deduction, Car loan interest, Enhanced senior deduction
  - 1040 → Line 13b
  - 1040-NR → Line 13c
- **Schedule D**: 1099-DA (digital assets) added alongside 1099-B. Box letters expanded A–L (G–L are new).

---

## SECTION 8 — CROSS-VALIDATION RULES

Before running analytics, verify internal consistency:

| Check | Rule |
|---|---|
| AGI formula | `totalIncome - adjustments ≈ agi` (within $1) |
| Interest | `1040 Line 2b == Schedule B Line 4` |
| Dividends | `1040 Line 3b == Schedule B Line 6` |
| Business income | `Schedule C Line 31 == Schedule 1 Line 3` |
| Capital gains | `Schedule D Line 16 == 1040 Line 7 (or 7a in 2025)` |
| Adjustments | `Schedule 1 Line 26 == 1040 Line 10` |
| Treaty (NR) | `Schedule OI L1e == 1040-NR Line 1k (2022+)` |
| NEC tax (NR) | `Schedule NEC Line 15 == 1040-NR Line 23a` |

---

## SECTION 9 — VERIFICATION CHECKLIST

After any change, run the same test case (2021 / 2023 / 2025) and confirm:

- [ ] UI Overview card `TAX RATE` → uses `taxToIncome`
- [ ] UI Strategy Bar `Effective tax rate` → uses `effectiveTaxRate`
- [ ] Chart Bar 1 (`taxRate`) → uses `taxToIncome * 100`
- [ ] Chart Bar 2 (`effectiveTaxRate`) → uses `effectiveTaxRate * 100`
- [ ] KPI card "Effective Tax Rate Change" → uses `effectiveTaxRate` delta ✅ (v2.0 fix)
- [ ] Strategy phase logic `taxRateDelta` → uses `effectiveTaxRate` delta ✅ (v2.0 fix)
- [ ] Strategy Bar narrative "Effective tax rate increased by X pp" → uses `effectiveTaxRate` delta ✅
- [ ] PDF "Tax Rate Shift" → uses `effectiveTaxRate` delta ✅
- [ ] PDF "Eff. Tax Rate" column → uses `m.effectiveTaxRate` (no inline recalc)
- [ ] Insight engine ETR references → uses `effectiveTaxRate`
- [ ] All tooltips: start with "How", no question mark, no trailing punctuation

---

## SECTION 10 — CHANGE LOG

| Version | Date | Change |
|---|---|---|
| v1.0 | March 2026 | Initial master reference |
| v2.0 | March 2026 | **CRITICAL FIX:** `taxRateDelta` corrected to use `effectiveTaxRate` delta (was incorrectly using `taxToIncome` delta while labeled "Effective Tax Rate Change"). Tooltip standards added. Metric relationship rules added. PDF consistency rules added. |

---

*TaxVista Master Reference v2.0 — March 2026*
*Single source of truth for all TaxVista metric definitions, labels, and formulas*