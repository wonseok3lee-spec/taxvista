// tests/reference-tax.js
// INDEPENDENT reference calculator for U.S. federal income tax (single / unmarried filer),
// the preferential long-term capital gain / qualified dividend rate stack, FICA, and
// self-employment tax, for tax years 2021–2025.
//
// Nothing in this file is derived from src/. Every parameter below was read from an
// official IRS publication during this review (2026-10-18). Each year's `sources` block
// records the document and URL. A parameter that could not be read from an official
// source is set to null and marked UNVERIFIED — it is never guessed.
//
// Scope of the reference (and what it deliberately omits — see review-report.md):
//   • Filing status: TaxVista collects no filing status, so the reference uses the
//     "Unmarried Individuals" (single) schedule throughout. MFJ/HoH/MFS are out of scope.
//   • Deductions: standard deduction (single) for Form 1040; nonresident aliens (1040-NR)
//     get NO standard deduction (Pub 519 rule) — only reported itemized deductions.
//   • Preferential rates: a lower-bound tax treats ALL capital gains as long-term and ALL
//     dividends as qualified; an upper bound treats them as ordinary income.
//   • Self-employment tax is offered as an optional add-on for "other income" so that
//     Schedule C cases can be reasoned about. Credits, AMT, NIIT, QBI, the 85% Social
//     Security inclusion rule, treaty rates, and NEC tax are NOT modeled.

export const SOURCES = {
  rp_2020_45: { doc: "Rev. Proc. 2020-45 (2021 inflation adjustments)", url: "https://www.irs.gov/pub/irs-drop/rp-20-45.pdf", how: "PDF text extracted with pdftotext; Table 3 §1(j)(2)(C), §3.03, §3.16" },
  rp_2021_45: { doc: "Rev. Proc. 2021-45 (2022 inflation adjustments)", url: "https://www.irs.gov/pub/irs-drop/rp-21-45.pdf", how: "PDF text extracted with pdftotext; cross-checked against https://www.irs.gov/irb/2021-48_IRB" },
  rp_2022_38: { doc: "Rev. Proc. 2022-38 (2023 inflation adjustments)", url: "https://www.irs.gov/pub/irs-drop/rp-22-38.pdf", how: "PDF text extracted with pdftotext" },
  rp_2023_34: { doc: "Rev. Proc. 2023-34 (2024 inflation adjustments)", url: "https://www.irs.gov/pub/irs-drop/rp-23-34.pdf", how: "PDF text extracted with pdftotext; cross-checked against https://www.irs.gov/irb/2023-48_IRB" },
  rp_2024_40: { doc: "Rev. Proc. 2024-40 (2025 inflation adjustments, pre-OBBBA)", url: "https://www.irs.gov/pub/irs-drop/rp-24-40.pdf", how: "PDF text extracted with pdftotext" },
  news_2021: { doc: "IR-2020-245 — IRS provides tax inflation adjustments for tax year 2021", url: "https://www.irs.gov/newsroom/irs-provides-tax-inflation-adjustments-for-tax-year-2021" },
  news_2022: { doc: "IRS provides tax inflation adjustments for tax year 2022", url: "https://www.irs.gov/newsroom/irs-provides-tax-inflation-adjustments-for-tax-year-2022" },
  news_2023: { doc: "IRS provides tax inflation adjustments for tax year 2023", url: "https://www.irs.gov/newsroom/irs-provides-tax-inflation-adjustments-for-tax-year-2023" },
  news_2024: { doc: "IRS provides tax inflation adjustments for tax year 2024", url: "https://www.irs.gov/newsroom/irs-provides-tax-inflation-adjustments-for-tax-year-2024" },
  news_2025: { doc: "IRS releases tax inflation adjustments for tax year 2025 (Oct 22 2024, pre-OBBBA)", url: "https://www.irs.gov/newsroom/irs-releases-tax-inflation-adjustments-for-tax-year-2025" },
  news_2026_obbb: { doc: "IRS releases tax inflation adjustments for tax year 2026 including amendments from the One Big Beautiful Bill — states the OBBB-amended 2025 standard deduction", url: "https://www.irs.gov/newsroom/irs-releases-tax-inflation-adjustments-for-tax-year-2026-including-amendments-from-the-one-big-beautiful-bill" },
  i1040_2025: { doc: "2025 Instructions for Form 1040 — What's New: standard deduction $15,750 single / $31,500 MFJ / $23,625 HoH", url: "https://www.irs.gov/instructions/i1040gi" },
  obbb_seniors: { doc: "IRS: Working Families Tax Cuts (P.L. 119-21) — additional $6,000 deduction age 65+, phase-out above $75,000 MAGI", url: "https://www.irs.gov/newsroom/one-big-beautiful-bill-act-tax-deductions-for-working-americans-and-seniors" },
  tc751: { doc: "Topic No. 751 — Social Security and Medicare withholding rates (6.2% / 1.45% / Additional Medicare 0.9% over $200,000)", url: "https://www.irs.gov/taxtopics/tc751" },
  tc409: { doc: "Topic No. 409 — Capital gains and losses ($3,000 net capital loss limit; 0%/15%/20% thresholds)", url: "https://www.irs.gov/taxtopics/tc409" },
  tc554: { doc: "Topic No. 554 — Self-employment tax (12.4% + 2.9% on 92.35% of net earnings; one-half deductible)", url: "https://www.irs.gov/taxtopics/tc554" },
  p15_2021: { doc: "Publication 15 (2021) — social security wage base limit $142,800", url: "https://www.irs.gov/pub/irs-prior/p15--2021.pdf" },
  p15_2022: { doc: "Publication 15 (2022) — social security wage base limit $147,000", url: "https://www.irs.gov/pub/irs-prior/p15--2022.pdf" },
  p15_2023: { doc: "Publication 15 (2023) — social security wage base limit $160,200", url: "https://www.irs.gov/pub/irs-prior/p15--2023.pdf" },
  p15_2024: { doc: "Publication 15 (2024) — social security wage base limit $168,600", url: "https://www.irs.gov/pub/irs-prior/p15--2024.pdf" },
  p15_2025: { doc: "Publication 15 (2025) — social security wage base limit $176,100", url: "https://www.irs.gov/pub/irs-prior/p15--2025.pdf" },
  nra_tax: { doc: "Nonresident alien — figuring your tax: 'If you are a nonresident of the U.S., you cannot claim the standard deduction' (India treaty exception)", url: "https://www.irs.gov/individuals/international-taxpayers/nonresident-alien-figuring-your-tax" },
};

// Bracket rows: [upper bound of the bracket, marginal rate]. Last row is open-ended.
// Verified against the "TABLE 3 - Section 1(j)(2)(C) Unmarried Individuals" rows.
export const PARAMS = {
  2021: {
    brackets: [[9950, 0.10], [40525, 0.12], [86375, 0.22], [164925, 0.24], [209425, 0.32], [523600, 0.35], [Infinity, 0.37]],
    stdDeduction: 12550,
    stdDeductionAgedUnmarriedAddl: null, // UNVERIFIED — not extracted from Rev. Proc. 2020-45 during this review
    cgZeroRateMax: 40400,   // §1(h)(1)(B)(i) "any other individual"
    cg15RateMax: 445850,    // §1(h)(1)(C)(ii)(I) "any other individual"
    ssWageBase: 142800,
    sources: { brackets: "rp_2020_45 + news_2021", stdDeduction: "rp_2020_45 + news_2021", capitalGains: "rp_2020_45", ssWageBase: "p15_2021" },
  },
  2022: {
    brackets: [[10275, 0.10], [41775, 0.12], [89075, 0.22], [170050, 0.24], [215950, 0.32], [539900, 0.35], [Infinity, 0.37]],
    stdDeduction: 12950,
    stdDeductionAgedUnmarriedAddl: 1750,
    cgZeroRateMax: 41675,
    cg15RateMax: 459750,
    ssWageBase: 147000,
    sources: { brackets: "rp_2021_45 + news_2022", stdDeduction: "rp_2021_45 + news_2022", capitalGains: "rp_2021_45", ssWageBase: "p15_2022" },
  },
  2023: {
    brackets: [[11000, 0.10], [44725, 0.12], [95375, 0.22], [182100, 0.24], [231250, 0.32], [578125, 0.35], [Infinity, 0.37]],
    stdDeduction: 13850,
    stdDeductionAgedUnmarriedAddl: 1850,
    cgZeroRateMax: 44625,
    cg15RateMax: 492300,
    ssWageBase: 160200,
    sources: { brackets: "rp_2022_38 + news_2023", stdDeduction: "rp_2022_38 + news_2023", capitalGains: "rp_2022_38", ssWageBase: "p15_2023" },
  },
  2024: {
    brackets: [[11600, 0.10], [47150, 0.12], [100525, 0.22], [191950, 0.24], [243725, 0.32], [609350, 0.35], [Infinity, 0.37]],
    stdDeduction: 14600,
    stdDeductionAgedUnmarriedAddl: 1950,
    cgZeroRateMax: 47025,
    cg15RateMax: 518900,
    ssWageBase: 168600,
    sources: { brackets: "rp_2023_34 + news_2024", stdDeduction: "rp_2023_34 + news_2024", capitalGains: "rp_2023_34", ssWageBase: "p15_2024" },
  },
  2025: {
    brackets: [[11925, 0.10], [48475, 0.12], [103350, 0.22], [197300, 0.24], [250525, 0.32], [626350, 0.35], [Infinity, 0.37]],
    stdDeduction: 15750,            // OBBB-amended (P.L. 119-21). Pre-OBBB Rev. Proc. 2024-40 value was $15,000.
    stdDeductionPreOBBB: 15000,
    stdDeductionAgedUnmarriedAddl: 2000,
    cgZeroRateMax: 48350,
    cg15RateMax: 533400,
    ssWageBase: 176100,
    sources: { brackets: "rp_2024_40 + news_2025", stdDeduction: "i1040_2025 + news_2026_obbb (pre-OBBB value: rp_2024_40)", capitalGains: "rp_2024_40 + tc409", ssWageBase: "p15_2025" },
  },
};

export const FICA = {
  ssRate: 0.062,
  medicareRate: 0.0145,
  additionalMedicareRate: 0.009,
  additionalMedicareThresholdSingle: 200000,
  source: "tc751",
};

export const SE_TAX = {
  ssRate: 0.124,
  medicareRate: 0.029,
  netEarningsFactor: 0.9235,
  source: "tc554",
};

export const CAPITAL_LOSS_LIMIT_SINGLE = 3000; // tc409

export const NR_RULES = {
  standardDeduction: 0, // nonresident aliens cannot claim the standard deduction (nra_tax); India-treaty students excepted
  source: "nra_tax",
};

export function hasParams(year) {
  return Object.prototype.hasOwnProperty.call(PARAMS, year);
}

// Ordinary income tax from the rate schedule (exact formula, not the $50-step tax table).
export function ordinaryTax(taxable, year) {
  if (!hasParams(year)) return null;
  const t = Math.max(0, taxable);
  let tax = 0, lower = 0;
  for (const [upper, rate] of PARAMS[year].brackets) {
    if (t <= lower) break;
    const slice = Math.min(t, upper) - lower;
    tax += slice * rate;
    lower = upper;
  }
  return tax;
}

// Tax with the long-term capital gain / qualified dividend rate stack (Schedule D / QDCG
// worksheet, simplified: pref income is stacked on top of ordinary income).
export function preferentialTax(taxable, preferentialIncome, year) {
  if (!hasParams(year)) return null;
  const p = PARAMS[year];
  const t = Math.max(0, taxable);
  const pref = Math.max(0, Math.min(preferentialIncome ?? 0, t));
  const ordinaryPortion = t - pref;
  let tax = ordinaryTax(ordinaryPortion, year);
  let remaining = pref;
  let base = ordinaryPortion;
  const zero = Math.max(0, Math.min(remaining, p.cgZeroRateMax - base));
  remaining -= zero; base += zero;
  const fifteen = Math.max(0, Math.min(remaining, p.cg15RateMax - base));
  tax += fifteen * 0.15; remaining -= fifteen;
  tax += remaining * 0.20;
  return tax;
}

// Employee-side FICA on W-2 wages (single filer threshold for Additional Medicare).
export function ficaTax(wages, year) {
  if (!hasParams(year)) return null;
  const w = Math.max(0, wages ?? 0);
  const ss = Math.min(w, PARAMS[year].ssWageBase) * FICA.ssRate;
  const med = w * FICA.medicareRate;
  const addl = Math.max(0, w - FICA.additionalMedicareThresholdSingle) * FICA.additionalMedicareRate;
  return { ss, medicare: med, additionalMedicare: addl, total: ss + med + addl };
}

// Self-employment tax on net SE earnings; SS portion limited by wage base less W-2 wages.
export function seTax(netSelfEmployment, wages, year) {
  if (!hasParams(year)) return null;
  const net = Math.max(0, netSelfEmployment ?? 0) * SE_TAX.netEarningsFactor;
  const ssRoom = Math.max(0, PARAMS[year].ssWageBase - Math.max(0, wages ?? 0));
  const ss = Math.min(net, ssRoom) * SE_TAX.ssRate;
  const med = net * SE_TAX.medicareRate;
  return { ss, medicare: med, total: ss + med, halfDeduction: (ss + med) / 2 };
}

// Standard deduction the reference applies for a year/form.
export function standardDeduction(year, isNR) {
  if (!hasParams(year)) return null;
  return isNR ? NR_RULES.standardDeduction : PARAMS[year].stdDeduction;
}

/**
 * Full reference computation for one tax year from the raw 1040 components.
 * input: { year, isNR, wages, interest, dividends, capitalGains, otherIncome, socialSecurity,
 *          adjustments, deductions (reported Line 12), selfEmployed (bool: treat positive otherIncome as SE) }
 * All money fields may be null (treated as 0 for the reference sum).
 */
export function referenceYear(input) {
  const year = input.year;
  const verified = hasParams(year);
  const n = (v) => (v == null || Number.isNaN(v) ? 0 : v);
  const wages = n(input.wages), interest = n(input.interest), dividends = n(input.dividends);
  const capitalGains = n(input.capitalGains), other = n(input.otherIncome), ss = n(input.socialSecurity);
  const adjustments = n(input.adjustments);
  // Line 7 can show at most a $3,000 net loss (tc409) — larger losses carry forward.
  const line7 = Math.max(capitalGains, -CAPITAL_LOSS_LIMIT_SINGLE);
  const totalIncomeRef = wages + interest + dividends + line7 + other + ss;
  const agiRef = totalIncomeRef - adjustments;
  const std = verified ? standardDeduction(year, !!input.isNR) : null;
  const reportedDed = input.deductions == null ? null : n(input.deductions);
  const deductionRef = !verified ? null
    : input.isNR ? (reportedDed ?? 0)
    : Math.max(std, reportedDed ?? 0);
  const taxableRef = deductionRef == null ? null : Math.max(0, agiRef - deductionRef);
  const prefIncome = Math.max(0, capitalGains) + Math.max(0, dividends);
  const se = verified && input.selfEmployed ? seTax(other, wages, year) : null;
  const band = taxableRef == null ? null : taxBand(taxableRef, prefIncome, year, se);
  return {
    year, verified, std, reportedDed, deductionRef,
    totalIncomeRef, agiRef, taxableRef, prefIncome,
    taxLow: band?.low ?? null,       // preferential rates, no SE tax
    taxHigh: band?.high ?? null,     // all ordinary + SE tax (if selfEmployed)
    seTax: se?.total ?? null,
    fica: verified ? ficaTax(wages, year) : null,
    capitalLossClipped: line7 !== capitalGains,
  };
}

// Plausible range for Line 24 given a taxable-income amount, before credits.
export function taxBand(taxable, prefIncome, year, se = null) {
  if (!hasParams(year)) return null;
  const low = preferentialTax(taxable, prefIncome, year);
  const high = ordinaryTax(taxable, year) + (se?.total ?? 0);
  return { low, high };
}
