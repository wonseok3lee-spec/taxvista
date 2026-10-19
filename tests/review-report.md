# TaxVista — Robustness Fuzz and Plausibility Review

**Date:** 2026-10-18 · **Code under review:** commit `75511ba` (`src/utils/calculateMetrics.js`, multi-year logic in `src/TaxVista_Step1.jsx`) · Findings below describe the state at `75511ba`; **Section 0 records what has since been fixed.**

---

## 0. Fix status (updated as batches land)

| Finding | Status | Where |
|---|---|---|
| F1 `NaN%` year-over-year bullet | **Fixed** — Batch 1 (`64dcc4f`); Batch 2 prints "—" only for a non-positive prior year, a positive→loss step prints its real % | `TaxVista_Step1.jsx` YoY bullet |
| F2 collapse/efficiency signals after a loss year | **Fixed** — Batch 2: `incomeYoY` needs a positive prior year; same for the year-insight deduction label | `calculateMetrics.js:53`, `TaxVista_Step1.jsx` deIncomeYoY |
| F3 loss year scored as strong | **Fixed (ratios)** — Batch 2: agiRatio, taxToIncome, deductionEfficiency, afterTaxMargin null unless total income > 0; taxableRatio null unless AGI > 0; chart draws no bar. **Open:** no explicit "loss year" label in the UI | `calculateMetrics.js:35–42`, chart data |
| F5 "growing in line" under decline | **Fixed** — Batch 2: requires income and tax growth > 0; a decline now gets a plain contraction sentence; the "entered higher marginal brackets" branch and the "growing slower" branch require income growth > 0 | tax-efficiency chain |
| F6 negative absorption bullets | **Fixed** — Batch 2: drag bullets only when absorbed share ≥ 5 %; plain sentences for "after-tax fell" and "tax fell"; the "tax drag will compound" bullet is suppressed when tax fell | strategy-tab drag/WTM bullets |
| F15 `atiGrowth` NaN/Infinity | **Fixed** — Batch 1 | `TaxVista_Step1.jsx` yearInsight |
| F4 demo data | Open — Batch 3 | |
| F7, F8, F9, F13 narrative accuracy | Open — Batch 4 | |
| F10, F11, F12, F14, F16–F23 | Open — not scheduled | |

Commands run:

```
node tests/fuzz.js            # exit 1 — 228 of 5,024 valid-tier households fail (all one root cause family, see F1/F15)
node tests/review.js          # exit 0 — 44 cases reviewed (6 demo, 34 fuzz-stratified, 4 hand-written edges) + 5,000-household sweep
```

---

## 1. Scope and limits — read first

**What the engine actually does.** `calculateMetrics()` computes *ratios and narrative* from four user-typed 1040 lines (Line 9 total income, Line 11 AGI, Line 15 taxable income, Line 24 total tax). It does **not** compute tax, taxable income, or AGI. Therefore:

- "Engine totalTax vs reference" is only meaningful for inputs the app ships itself — the six landing-page demo cases. A mismatch there is a **demo-data problem**, not an engine computation error. The user-requested classification set (engine bug / intentional simplification / reference uncertainty) does not cover this, so a fourth label, **demo-data**, is used.
- For the 34 fuzz-stratified cases, the reference calculator was used to *build* internally consistent inputs (standard deduction for the year, bracket + preferential-rate tax, self-employment tax for the self-employed profile). On those cases the tax/taxable/take-home comparisons are identities by construction; what the review tests there is the **derived metrics, signal flags, and every narrative string** the app would render.
- The generator's own random Line 24 was kept alongside: **65.7 % of 15,073 generated year-rows had a Line 24 outside the bracket range for their Line 15, and the app accepted every one without a warning** (it has no tax-vs-taxable plausibility check). This is the single biggest limit on anything the app says: garbage-in is undetectable.

**What the reference does (tests/reference-tax.js).** Single-filer rate schedules, standard deductions, long-term-capital-gain / qualified-dividend 0/15/20 % thresholds, employee FICA (6.2 % to the wage base, 1.45 %, 0.9 % Additional Medicare over $200,000), self-employment tax (12.4 % + 2.9 % on 92.35 % of net earnings), $3,000 net-capital-loss limit, and the rule that nonresident aliens get no standard deduction. All parameters were read from official IRS documents during this review; each year's `sources` block names the document and URL (Rev. Proc. 2020-45 / 2021-45 / 2022-38 / 2023-34 / 2024-40 PDFs via `pdftotext`, the IRS newsroom releases, the 2025 Form 1040 instructions and the 2026 release for the OBBB-amended 2025 standard deduction of $15,750, Publication 15 for each year's wage base, Topics 409/554/751, and the nonresident "Figuring your tax" page).

**What this review does NOT verify.**

| Not covered | Why it matters |
|---|---|
| Filing status | TaxVista collects none. Everything is compared against the *single* schedule. A married-filing-jointly return would legitimately show ~half the tax. |
| Credits, AMT, NIIT, QBI, Schedule 1-A, treaty rates, NEC tax | Line 24 includes or is reduced by these; the reference cannot see them. Tax comparisons use a **band**: lower edge = all gains long-term and all dividends qualified, upper edge = all ordinary (+ SE tax where the case is self-employed). Tolerance = max($50, 2 % of the upper edge). |
| Short- vs long-term gains, qualified vs ordinary dividends | Unknown from the inputs → band, not a point estimate. |
| Social Security taxable share (0–85 %) | The demo passes a `socialSec` amount the wizard never collects; treated as already-taxable. |
| 2021 additional standard deduction for age/blindness | **UNVERIFIED** (not extracted); 2022–2025 values verified. Not used in any comparison. |
| 401(k) $23,500 and HSA $4,300 figures quoted in narrative | **UNVERIFIED** by this review — flagged only for being hard-coded to 2025. |
| The React rendering layer | Multi-year logic was ported to `tests/app-mirror.js` with source line references; demo data is extracted from the JSX at runtime. A port can drift — re-sync when `TaxVista_Step1.jsx` changes. |
| Years outside 2021–2025 | `MOST_RECENT_TAX_YEAR` is date-derived; after 2027-03-01 the demo years shift to 2022–2026 and 2026 has no verified parameters (the scripts will mark those rows unverified). |

**Fuzz assertion validity** is documented at the top of `tests/fuzz.js` (A1–A9), including the derivation of the composition tolerance (engine performs no rounding → 1e-9; UI rounds to 0.1 %) and when A4/A5/A6 are skipped (zero or negative denominators, by contract).

---

## 2. Fuzz results (tests/fuzz.js, seed 20261018)

| Tier | Cases | Result |
|---|---|---|
| Valid (generated) | 5,000 | 4,773 pass, **227 fail** (all `zero-income` profile) |
| Valid (hand-written edges) | 24 | 23 pass, **1 fail** (E14, prior-year income $0) |
| Warned (UI warns, still analyzes) | 8 | 0 finiteness/exception issues |
| Malformed (unreachable from UI) | 15 | 4 throw `TypeError`, 8 accepted, 3 accepted with NaN/Infinity in output |

Coverage: form mix all-1040 3,443 / mixed 1,167 / all-1040-NR 414; 1–5 years ≈ 1,000 each; 17 profiles ≈ 280–320 each; features: 1040-NR 1,575, high income 1,065, missing optional field 3,965, NEC tax 609, capital loss 295, negative other income 294, negative total income 231, zero income 285, capital-gain spike 227.

Every failure is assertion **A9** (multi-year pipeline finiteness). The engine itself (`calculateMetrics`) passed A1–A8 on all 5,024 households: no exceptions, no NaN, null only where the contract allows, composition sums to 1 within 1e-9 whenever the clipped parts sum is positive, formulas match CLAUDE.md §1.1 from the input, structural invariants hold. The two A9 failure modes are findings **F1** and **F15** below.

Skipped assertions (by contract): A4 composition skipped on 938 year-rows where every clipped component is 0; A5/A6 sign checks skipped on 1,099–2,333 year-rows with zero or negative denominators.

---

## 3. Findings, ranked by severity

Severity: **HIGH** = wrong or nonsensical content a normal user can see · **MEDIUM** = misleading or contradictory content for a realistic case type · **LOW** = cosmetic, internal, documentation, or unreachable.

### HIGH

#### F1 — `NaN%` rendered in the print report when an earlier year has $0 total income
- **Class:** engine bug (presentation layer). **Hit rate:** 174 of 5,024 fuzz households (every ≥3-year household containing a $0 year before another year).
- **Input (fuzz H103, 2021–2025 all 1040):** total income 0 / 0 / 0 / 0 / 0, all other lines 0.
- **Actual:** Strategy/print "Income Trend Analysis" bullet: `Year-over-year: 2021→2022: NaN%; 2022→2023: NaN%; 2023→2024: NaN%; 2024→2025: NaN%.`
- **Expected:** years with a zero base skipped or shown as "n/a".
- **Likely cause:** `TaxVista_Step1.jsx:3831` divides by `incs[i]` with no zero guard. The same division is signed-wrong on a negative base (fuzz H36: `-154%; -205%`, see F3).

#### F2 — `INCOME_COLLAPSE` / `FALSE_EFFICIENCY` fire on an income *increase* after a loss year
- **Class:** engine bug. **Hit rate:** 119 of 5,000 households (all with a negative-income year followed by a positive one).
- **Input (edge E04):** 2024: wages 5,000, other income −30,000 → Line 9 −25,000, taxable 0, tax 0. 2025: wages 90,000, taxable 75,400, tax 11,800.
- **Actual (2025):** `falseSignals = [INCOME_COLLAPSE (CRITICAL)]`, health 30 "At Risk", tags "⚠ Contraction-driven" / "⚠ Contraction", summary line "Income has declined significantly. Tax metrics may appear improved but reflect contraction, not optimization."
- **Expected:** no collapse flag; income rose from −$25,000 to $90,000.
- **Likely cause:** `calculateMetrics.js:49` — `incomeYoY = (totalIncome − priorIncome) / priorIncome` with a negative `priorIncome` flips the sign (yields −4.6 here). Every rule at lines 54–66 consumes it. A Schedule C or rental loss year is a legitimate Line 9 value, and the shipped "re-investor" demo already uses negative other income.

#### F3 — A negative-income year is scored as a *strong* year
- **Class:** engine bug (ratios on a negative denominator). **Hit rate:** 231 households with negative-income ratios; 19 ratio-range violations (after-tax margin or deduction ratio outside 0–100 %).
- **Input (edge E03, single year):** wages 12,000, other income −40,000, Line 9 −28,000, AGI −28,000, taxable 0, tax 0.
- **Actual:** agiRatio 100 %, deductionEfficiency 100 %, afterTaxMargin 100 %, tags "Strong deductions", "Strong take-home", health 70 "Stable", headline "STRONG DEDUCTIONS · STRONG TAKE-HOME", text "100.0% of total income sheltered by the standard/itemized deduction", "100.0% after-tax margin is strong — priority is protecting this margin as income scales." Take-home −$28,000 is shown as a positive margin. H97 (2024: income −39,344, tax $0.03) yields afterTaxMargin 1.0000008 (> 100 %).
- **Expected:** ratios null (or explicitly "loss year") when total income ≤ 0; no positive tags.
- **Likely cause:** `calculateMetrics.js:35–40` guard only on `totalIncome` being truthy, not positive; the signal thresholds at 124–146 then read the sign-flipped ratios as strengths.

#### F4 — All six landing-page demo cases are internally inconsistent with the tax years they display
- **Class:** demo-data (not an engine computation). This is the content every visitor sees first.
- **Standard deductions are from the wrong year** (`TaxVista_Step1.jsx:1725–1768`). With today's year window (2021–2025): the 2021 rows use $13,850 (the 2023 amount; 2021 single was $12,550), the 2022–2024 rows use $14,600 (2024's amount; 2022 = $12,950, 2023 = $13,850), the 2025 rows use $14,600 (2025 = $15,750 under P.L. 119-21). The retiree uses $15,700 (2023 single 65+) for 2023–2025. Because the demos are built from offsets off `MOST_RECENT_TAX_YEAR`, the mismatch will change again every March.
- **Line 24 is outside the bracket range in 21 of 30 year-rows** (single-filer schedule, tolerance max($50, 2 %)):

| Demo | Year | Taxable | Line 24 | Reference band | Gap |
|---|---|---|---|---|---|
| W-2 Employee | 2021 | 41,450 | 4,700 | 4,854–4,868 | −154 |
| | 2022 | 43,740 | 4,950 | 5,224–5,240 | −274 |
| | 2023 | 46,780 | 5,350 | 5,582–5,599 | −232 |
| | 2024 | 50,820 | 5,850 | 6,215–6,233 | −365 |
| | 2025 | 55,880 | 6,500 | 7,187–7,208 | −687 |
| Intl. Student | 2021 NR | 4,050 | 100 | 405 | −305 |
| | 2022 NR | 28,080 | 2,400 | 3,164 | −764 |
| | 2023 NR | 62,250 | 7,800 | 8,996–9,003 | −1,196 |
| | 2024 | 63,750 | 9,800 | 9,068–9,078 | +722 |
| | 2025 | 78,400 | 12,800 | 12,113–12,162 | +638 |
| Retiree | 2021 | 72,100 | 9,600 | 11,527–11,611 | −1,927 |
| | 2022 | 75,250 | 10,100 | 12,081–12,172 | −1,981 |
| Freelancer | 2021 | 38,600 | 4,300 | 4,433–5,563 | −133 |
| | 2022 | 25,260 | 2,600 | 2,826–7,347 | −226 |
| | 2023 | 20,840 | 2,100 | 2,281–7,650 | −181 |
| Tech / Stock Sale | 2024 | 132,450 | 26,500 | 24,237–24,831 | +1,670 |
| | 2025 | 139,600 | 28,200 | 25,838–26,351 | +1,849 |
| W-2 + Real Estate | 2021 | 81,650 | 13,000 | 13,698–13,712 | −698 |
| | 2022 | 76,000 | 11,800 | 12,320–12,337 | −520 |
| | 2023 | 72,100 | 10,900 | 11,149–11,170 | −249 |

- **Freelancer omits self-employment tax while deducting half of it.** 2025: other income $85,000 → SE tax ≈ $12,010 (Topic 554), half-SE deduction ≈ $6,005 — the demo's adjustment is $5,900, so the deduction is modeled, but Line 24 ($9,200) equals plain income tax on $64,620 (band floor $9,130). A real Line 24 would be ≈ $21,100; the demo's "Tax-efficient" tag and 14.2 % effective rate follow from the omission.
- **International student 2021:** $100 tax on $4,050 of taxable ECI (10 % bracket → $405); treaty-exempt income is already excluded from the wages shown.
- **W-2 + Real Estate triggers the app's own validator:** opening Edit Data shows "Other Income (-8,000) can't be negative" for 2022–2024 (`TaxVista_Step1.jsx:1923–1931`), contradicting the demo's rental-loss premise.
- **Expected:** demo rows built from the actual year's standard deduction and a bracket calculation (the reference in `tests/reference-tax.js` reproduces every verified parameter).

#### F5 — "Tax obligation is growing in line with income" shown when income and tax both fell
- **Class:** engine bug (narrative branch). **Hit rate:** 670 of 5,000 households.
- **Input (Retiree demo):** total income $86,700 (2021) → $51,750 (2025), tax $9,600 → $3,750.
- **Actual:** trend insight "Tax obligation is growing in line with income — no compression of take-home margin detected. Current deduction structure is keeping pace with income growth." directly under "Gross income ↓ 40% cumulatively".
- **Expected:** a contraction-aware sentence (tax fell faster than income: −61 % vs −40 %).
- **Likely cause:** `TaxVista_Step1.jsx:2106` is the default `else` branch of the tax-efficiency chain, reached for any non-low-base case where tax growth did not outpace income growth — including declines.

### MEDIUM

#### F6 — Negative "tax absorption" figures in the print report
- **Class:** engine bug (narrative). **Hit rate:** 988 of 5,000 households (≈ 20 %).
- **Input (fuzz H6, 2021/2023/2025):** income +$5,650 over the period while tax fell from $2,065 to $219.
- **Actual:** "Taxes absorbed $-1,846 of income growth (-33%). Without optimization, this leakage will compound as income rises." and "Per $1.00 earned: $-0.33 to taxes, $1.33 retained (-33% absorption rate)."
- **Expected:** when after-tax growth exceeds income growth, say so; never print a negative share or "$1.33 retained per $1.00".
- **Likely cause:** `TaxVista_Step1.jsx:3842` computes `mr = (id − ad) / id` with no clamp and appends the "leakage" sentence unconditionally.

#### F7 — NR→1040 transition sentence contradicts the numbers
- **Class:** engine bug (static text). **Hit rate:** 851 households (essentially every NR-to-resident transition).
- **Input (Intl. Student demo):** 2023 1040-NR taxable/AGI 100 % → 2024 1040 taxable/AGI 81.4 % (standard deduction becomes available).
- **Actual:** "Your tax profile changed materially in 2024 … This expanded your taxable base and increased exposure to ordinary income tax rates." (`TaxVista_Step1.jsx:3629, 3661, 4012`).
- **Expected:** the taxable base *shrank* relative to AGI; ECI was already taxed at ordinary graduated rates on the 1040-NR. The sentence is true of worldwide-income scope, not of the lines the app holds.

#### F8 — Low-base suppression leaks a growth percentage into the strategy text
- **Class:** engine bug (inconsistency). **Hit rate:** 297 households.
- **Input (fuzz H7, 2022–2025):** first-year income $9,780 (< $10K → "Low base" on the KPI cards and overview).
- **Actual:** phase characteristics/note/implication say "10.3% annualized growth — moderate, above-inflation income expansion", "Growth is consistent at 10.3% annualized …", "At 10.3% annualized growth …".
- **Likely cause:** `TaxVista_Step1.jsx:2469–2520` only special-cases `lowBase && cagr > 0.12`; the Steady/Stable/Plateau/Contraction branches format `cagr` regardless of `lowBase`.

#### F9 — Causal overclaim "as earnings entered higher marginal brackets" when the effective rate fell
- **Class:** engine bug (narrative). **Hit rate:** 119 households.
- **Input (fuzz H3, self-employed 2021–2025):** income +123 %, tax +149 %, effective rate 28.2 % → 25.3 % (−2.9 pp); deduction ratio fell 34.9 % → 19.6 %.
- **Actual:** "… taxes grew 149% …, as earnings entered higher marginal brackets with limited deduction scaling".
- **Expected:** the driver was the flat standard deduction shrinking as a share of income, not bracket creep; the rate on taxable income fell.
- **Likely cause:** `TaxVista_Step1.jsx:2094–2095` keys only on tax growth > income growth + 5 pp.

#### F10 — One report says "Rate stable" and "You are entering a higher tax exposure phase" about the same 1.1 pp change
- **Class:** engine bug (threshold inconsistency).
- **Input (W-2 + Real Estate demo):** taxRateDelta +1.1 pp.
- **Actual:** Tax Burden Analysis: "Rate stable (1.1pp change)." What This Means: "You are entering a higher tax exposure phase. Without changes, a growing share of your income will be taxed at higher marginal rates. What to do next: (1) Increase pre-tax contributions immediately …"
- **Likely cause:** `TaxVista_Step1.jsx:3838` uses 0.02, `:3873` uses 0.01.

#### F11 — The one-time-event override is applied to trend text but not to the following year's flags
- **Class:** engine bug (layering).
- **Input (Tech / Stock Sale demo):** 2023 capital gain $85,000 (ONE_TIME_EVENT correctly raised), 2024 income back to $147,050.
- **Actual (2024):** `INCOME_COLLAPSE` CRITICAL, health 20 "At Risk", tag "⚠ Contraction", summary "Income has declined significantly…". The phase is "Event-Driven Income" yet its implication/characteristics are the Steady-Accumulation strings ("At 5.7% annualized growth, steady expansion provides the most predictable environment…").
- **Likely cause:** the override at `TaxVista_Step1.jsx:2142–2164` rewrites `trendInsights` only; `calculateMetrics.js:60` has no knowledge that the prior year was flagged as a spike; `:2517–2520` overrides `phase`/`note` but keeps `characteristics`/`implication`.

#### F12 — "⚠ Loss-driven" tag shown with no loss at all
- **Class:** engine bug (mislabel).
- **Input (Retiree demo 2023):** capital gain +$2,000, income −35 % (planned retirement).
- **Actual:** tax tag "⚠ Loss-driven", plus "⚠ Income-driven", "⚠ Contraction", health 15 "Critical".
- **Likely cause:** `calculateMetrics.js:150` relabels any `high` tax signal as "Loss-driven" whenever the primary signal is CRITICAL/HIGH, regardless of whether a capital loss exists. Separately, the health score treats a planned income reduction as "Critical" — a design choice worth revisiting for retirees.

#### F13 — Advice that cannot apply to the case type
- **Class:** engine bug (narrative not conditioned on form/income type). **Hit rates:** 636 households whose latest year is 1040-NR receive "Review whether itemizing would beat the standard deduction" / "itemizing (if eligible) is the only lever" (nonresidents cannot claim the standard deduction — IRS nonresident "Figuring your tax" page); 292 households with $0 wages in the latest year are told "Verify W-4 reflects current income" / "verify withholding is accurate" (Freelancer demo: 1099 income pays estimated tax, not W-4 withholding; Retiree demo). Sources: `TaxVista_Step1.jsx:3798–3803, 2509, 2511`.

#### F14 — Social Security is invisible to the composition chart
- **Class:** intentional simplification with a visible consequence.
- **Input (Retiree demo 2025):** `socialSec` $23,000 of $51,750 total (44 %).
- **Actual:** composition denominator is wages + gains + interest + dividends + other = $28,750; the report says "Mixed — 0% wages, 100% investment/other" and the Income Sources bar reconciles only via the footnote. `socialSecurity` is parsed (`:1952`) but never used (`calculateMetrics.js:12–19`), and the wizard has no field for it — only demo data can carry it.

### LOW

#### F15 — `atiGrowth` is NaN/Infinity when the prior year's after-tax income is 0
- 228 fuzz households (the other A9 failure). `TaxVista_Step1.jsx:2612` divides by `atiPrior`. The value only drives a colour (`NaN < −0.05` is false → green), so nothing is rendered wrong today, but it is a non-finite value in app state and the fuzz exit code will stay 1 until F1 and this are guarded.

#### F16 — 2025 contribution limits quoted for other tax years
- `calculateMetrics.js:252` hard-codes "max 401k ($23,500 in 2025), HSA if eligible ($4,300 single)"; shown for 425 households whose latest year is not 2025 (e.g. fuzz H10, a 2024 analysis). The figures themselves were not verified here.

#### F17 — "High tax burden" and "Strong deductions" co-occur (CLAUDE.md §5 says they never should)
- 135 households, all self-employed/NEC profiles: Line 24 carries SE or NEC tax, so the effective rate on taxable income can be 28 % while the deduction ratio is 35 % (fuzz H3 2021). The §5 "inverse relationship" assumption holds only when Line 24 is pure income tax.

#### F18 — Health label ignores the burden level
- 188 households show "Stable" or "Strong" with an effective rate above 25 % (H3 2021: 70 "Stable" at 28.2 %). `calculateMetrics.js:79–89` only ever *adds* for a low rate; nothing subtracts for a high one.

#### F19 — CLAUDE.md §4 thresholds differ from the code
- 23 of 44 cases carry "Tax-efficient" at 10.1–14.2 % or "Tax: moderate" at 20.0–24.9 %. The document says < 10 % / 10–20 %; `calculateMetrics.js:131–133` uses < 15 % / 15–25 %. Documentation sync item (already tracked).

#### F20 — Zero-income year with tax (1040-NR with NEC tax)
- Edge E02: Line 9 $0, Line 24 $450 → take-home −$450, every ratio null, no narrative except "Review your income structure", health 50 "Moderate". Valid for an NR with only Schedule NEC income; the app has no way to say so.

#### F21 — Dead clause: "driven by investment losses" can never render
- `TaxVista_Step1.jsx:2457` reads `_mN.insights.hasCapitalLoss`; `generateInsights` returns only `{signals, summary}`, so the flag is always `undefined`.

#### F22 — No plausibility guard on Line 24
- 9,905 of 15,073 random year-rows had a tax outside the bracket range for their taxable income (e.g. 30 % on $20K); none produced a warning. Combined with F4 this means the app cannot distinguish a typo from a real return.

#### F23 — Malformed input behaviour (unreachable from the UI)
- Missing `summary`/`income`/`data` → `TypeError` (4 cases). `NaN` or `Infinity` in required fields propagates into `afterTaxIncome`, `agiRatio`, composition (3 cases). A `NaN` in `compare.priorETR` renders "essentially unchanged from NaN% prior year". Strings and booleans coerce silently. The wizard's `parseNum` prevents all of these in practice.

---

## 4. Reference comparison — classification summary

| Comparison | Result | Classification |
|---|---|---|
| Demo Line 24 vs bracket band | 21/30 rows outside (table in F4) | **demo-data** |
| Demo deductions vs year's standard deduction | 30/30 rows use another year's amount; 6/6 demos below the 2025 standard deduction in their 2025 row | **demo-data** |
| Freelancer demo vs SE-tax-inclusive band | 2024–2025 sit exactly at the no-SE-tax floor | **demo-data** (SE tax omitted) |
| Engine effective rate = Line 24 / Line 15 | identity on all 44 cases (A7 on 5,024) | match |
| Engine take-home = Line 9 − Line 24 | identity on all 44 cases | match |
| Take-home vs take-home after employee FICA | gap 7.3–7.6 % of income for W-2 cases (e.g. W-2 demo 2025: $63,980 shown vs $58,625 after FICA) | **intentional simplification** — federal income tax only; nowhere stated in the UI |
| Composition denominator vs Line 9 | 26/34 fuzz cases: a blank optional field makes the pie describe only the entered parts | **intentional simplification** (documented at `calculateMetrics.js:9–30`), surfaced by the reconciliation footnote |
| Single-filer assumption | all cases | **reference uncertainty** — the app has no filing status; MFJ/HoH returns would legitimately fall below the band |
| Gain/dividend character, credits, AMT, NIIT | all cases | **reference uncertainty** — handled by using a band rather than a point |

---

## 5. Narrative overclaim inventory (cases out of 44 containing the phrase)

| Phrase | Cases | Why it overclaims |
|---|---|---|
| "Without optimization, this leakage will compound" | 21 | Printed for any positive income growth, including when taxes *fell* (F6) and for a 0 % absorption rate (H7: "Taxes absorbed $0 … Without optimization, this leakage will compound"). |
| "Review whether itemizing would beat the standard deduction" | 18 | Fires on deduction ratio < 15 % alone; shown to 1040-NR filers (F13). |
| "Capital gains and qualified dividends are taxed at 0–20% vs ordinary rates of 22–37%" | 14 | Fires on income CAGR > 8 % alone; shown to a $13K low-wage case (H7) whose marginal rate is 10–12 %. |
| "itemizing (if eligible) is the only lever" | 13 | Pre-tax contributions also change Line 15; the sentence is about one ratio but reads as tax advice. |
| "Increase pre-tax contributions immediately" / "Shift future income toward tax-advantaged sources" | 11 / 11 | Triggered by a 1 pp rate rise (F10); no eligibility or income-type check. |
| "Verify W-4" / "verify withholding is accurate" / "Over-withholding" | 6 / 8 / 8 | Withholding is not among the inputs; shown to $0-wage cases (F13). |
| "Without adjustment, taxes will scale faster than income growth" | 5 | A forecast from two endpoints. |
| "Mega Backdoor Roth" / "Backdoor Roth IRA" / "max 401k ($23,500 in 2025)" / "HSA if eligible ($4,300 single)" | 4 each | Plan availability and eligibility unknown; limits hard-coded to 2025 (F16). |

---

## 6. Where to look (files written by this review)

- `tests/fuzz.js` — generator, assertion docs, tiers, CLI (`--seed`, `--n`, `--show-skips`).
- `tests/review.js` — case selection, reference comparison, narrative/plausibility rules, population sweep.
- `tests/reference-tax.js` — verified parameters with sources; `UNVERIFIED` marked as null.
- `tests/app-mirror.js` — Node port of the JSX multi-year logic (line references inline) and runtime extraction of `DEMO_CASES`.
