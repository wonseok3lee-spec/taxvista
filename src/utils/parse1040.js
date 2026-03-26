// utils/parse1040.js
import * as pdfjsLib from "pdfjs-dist";

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url
).toString();

// ── AcroForm field name → 1040 line mapping ──────────────────────────────────
// IRS fillable PDFs store values in named form fields (e.g. f1_73[0] = Line 9).
// Field names vary by year and form variant. This map covers known IRS field IDs.
// The text-based extractor is used as fallback when form fields are absent.
const FIELD_LINE_MAP_1040 = {
  // Page 1
  "f1_47":  "1a",   // Wages (W-2)
  "f1_57":  "1z",   // Total wages/salaries
  "f1_59":  "2b",   // Taxable interest
  "f1_60":  "3a",   // Qualified dividends
  "f1_61":  "3b",   // Ordinary dividends
  "f1_64":  "4b",   // Taxable IRA distributions
  "f1_66":  "5b",   // Taxable pensions
  "f1_68":  "6b",   // Social Security benefits (taxable)
  "f1_70":  "7a",   // Capital gain/loss (2025) / Line 7 on earlier forms
  "f1_71":  "7",    // Capital gain/loss (pre-2025 field name)
  "f1_72":  "8",    // Other income (Sched 1)
  "f1_73":  "9",    // Total income
  "f1_74":  "10",   // Adjustments to income
  "f1_75":  "11a",  // AGI (2025) / Line 11 on earlier forms
  // Page 2
  "f2_01":  "11b",  // AGI carryforward (same value)
  "f2_02":  "12e",  // Standard/itemized deductions (2025)
  "f2_03":  "12",   // Deductions (pre-2025 field name)
  "f2_04":  "13",   // Qualified business income deduction
  "f2_05":  "14",   // Total deductions
  "f2_06":  "15",   // Taxable income
  "f2_07":  "16",   // Tax
  "f2_13":  "22",   // Sum of taxes
  "f2_14":  "23",   // Net premium tax credit
  "f2_15":  "24",   // Total tax
  "f2_16":  "25a",  // W-2 withholding
  "f2_19":  "25d",  // Total withholding
  "f2_23":  "33",   // Total payments
  "f2_24":  "34",   // Overpayment
  "f2_25":  "35a",  // Refund
  "f2_28":  "37",   // Amount owed
};

// Reverse lookup: line code → field name(s)
const LINE_TO_FIELDS = {};
for (const [field, line] of Object.entries(FIELD_LINE_MAP_1040)) {
  if (!LINE_TO_FIELDS[line]) LINE_TO_FIELDS[line] = [];
  LINE_TO_FIELDS[line].push(field);
}

// Extract numeric value from a form field
function fieldToNumber(val) {
  if (val == null) return null;
  const s = String(val).replace(/[$,\s]/g, "").trim();
  if (!s || s === "-" || s === "—") return null;
  // Handle parenthesized negatives: (1234) → -1234
  const neg = s.match(/^\((.+)\)$/);
  const n = parseFloat(neg ? neg[1] : s);
  return isNaN(n) ? null : (neg ? -n : n);
}

export async function parse1040(file) {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

  // ── Step 1: Try AcroForm field extraction (fillable PDFs) ──────────────
  const formFields = {};
  let hasFormData = false;
  try {
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const annots = await page.getAnnotations();
      for (const annot of annots) {
        if (annot.fieldType === "Tx" && annot.fieldName && annot.fieldValue) {
          // Normalize field name: "f1_73[0]" → "f1_73"
          const key = annot.fieldName.replace(/\[\d+\]$/, "");
          const lineCode = FIELD_LINE_MAP_1040[key];
          if (lineCode) {
            const num = fieldToNumber(annot.fieldValue);
            if (num != null) {
              formFields[lineCode] = num;
              hasFormData = true;
            }
          }
        }
      }
    }
  } catch (_) {
    // getAnnotations can fail on some PDFs — fall through to text extraction
  }

  // ── Step 2: Text extraction (visual text layer — used as fallback) ──────
  const lines = [];
  const pageNums = [];

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();

    const byY = {};
    for (const item of content.items) {
      if (!item.str.trim()) continue;
      const y = Math.round(item.transform[5] / 2) * 2;
      if (!byY[y]) byY[y] = [];
      byY[y].push(item.str);
    }

    const sortedYs = Object.keys(byY).sort((a, b) => Number(b) - Number(a));
    for (const y of sortedYs) {
      lines.push(byY[y].join(" "));
      pageNums.push(i);
    }
  }

  const is1040 = lines.some((l) => /form\s*1040/i.test(l));
  if (!is1040) {
    return { error: "No Form 1040 found in this PDF." };
  }

  const form1040PageSet = new Set(
    lines
      .map((l, i) => (/form\s*1040/i.test(l) ? pageNums[i] : null))
      .filter(Boolean)
  );

  // Detect tax year (2021–2025) and form variant from PDF text
  const yearMatch = lines.map((l) => l.match(/\b(202[1-5])\b/)).find((m) => m != null);
  const year = yearMatch ? parseInt(yearMatch[1]) : null;
  const isNR = lines.some((l) => /1040-NR|1040NR|nonresident\s+alien/i.test(l));

  // ── Unified field reader: form fields first, text extraction fallback ──
  const field = (lineCode) =>
    formFields[lineCode] ?? extractByLineNumber(lines, lineCode);

  // ── Summary fields (year-aware) ──────────────────────────────────────────
  const totalIncome = field("9");

  // AGI: Line 11a on 2025 forms, Line 11 on 2021–2024
  const adjustedGrossIncome =
    year === 2025
      ? (field("11a") ?? field("11"))
      : (field("11") ?? field("11a"));

  const taxableIncome = field("15");
  const totalTax      = field("24");

  // ── Income fields (year-aware) ───────────────────────────────────────────
  // Wages: Line 1z (total wages, 2022+) is the correct income-composition numerator.
  // 2021 regular 1040: Line 1. 2021 1040-NR: Line 1a (no 1z available).
  const wages = (() => {
    if (year == null || year >= 2022) {
      return field("1z") ?? field("1a");
    }
    // year === 2021
    return isNR
      ? field("1a")
      : (field("1") ?? field("1a"));
  })();

  // Capital gains: Line 7 on 2021–2024, Line 7a on 2025
  const capitalGains =
    year === 2025
      ? (field("7a") ?? field("7"))
      : (field("7") ?? field("7a"));

  // Adjustments: 1040-NR 2021–2022 uses Line 10d; all others use Line 10
  const totalAdjustments =
    isNR && year != null && year <= 2022
      ? (field("10d") ?? field("10"))
      : field("10");

  // Deductions: year/form-specific line numbers
  const itemizedDeduction = (() => {
    if (year === 2025 && !isNR) {
      return field("12e") ?? field("12");
    }
    if (year === 2021) {
      return field("12a") ?? field("12");
    }
    return field("12");
  })();

  return {
    year,
    isNR,
    formFieldsUsed: hasFormData,
    income: {
      wages,
      interest:         field("2b"),
      dividends:        field("3b"),
      socialSecurity:   field("6b"),
      capitalGains,
      additionalIncome: field("8"),
    },
    adjustments: {
      studentLoanInterest: field("21"),
      totalAdjustments,
    },
    deductions: {
      itemized: itemizedDeduction,
    },
    summary: {
      totalIncome,
      adjustedGrossIncome,
      taxableIncome,
      totalTax,
    },
    pagesFound: [...form1040PageSet],
  };
}

// Find line containing lineCode as a standalone token (e.g. "1a", "11a", "24").
// Primary: match line code at the very start of the line (IRS left-column label).
// Fallback: isolated token — not preceded or followed by alphanumeric chars.
// Lookahead: up to 2 following lines, stops if a new line-number label is encountered.
function extractByLineNumber(lines, lineCode) {
  const esc = escapeRegex(lineCode);
  const leadingRe  = new RegExp(`^\\s*${esc}(?![0-9a-zA-Z])`, "i");
  const isolatedRe = new RegExp(`(?<![0-9a-zA-Z])${esc}(?![0-9a-zA-Z])`, "i");
  // Matches a line that starts with a new IRS line number label (e.g. "1a", "12", "24")
  const labelStartRe = /^\s*\d+[a-zA-Z]?(?![0-9a-zA-Z])/;

  const tryExtract = (matchRe) => {
    for (let i = 0; i < lines.length; i++) {
      if (!matchRe.test(lines[i])) continue;

      for (let j = i; j <= i + 2 && j < lines.length; j++) {
        // Stop lookahead if we've moved past the anchor line and hit a new label
        if (j > i && labelStartRe.test(lines[j])) break;
        const nums = parseLargeNumbers(lines[j]);
        if (!nums.length) continue;
        return j === i ? nums[nums.length - 1] : nums[0];
      }
    }
    return null;
  };

  return tryExtract(leadingRe) ?? tryExtract(isolatedRe);
}

// Extract all numbers >= 100 or comma-formatted from a line
function parseLargeNumbers(line) {
  return [...line.matchAll(/[\d,]+/g)]
    .map((m) => ({ raw: m[0], val: parseFloat(m[0].replace(/,/g, "")) }))
    .filter(({ raw, val }) => !isNaN(val) && (val >= 100 || raw.includes(",")))
    .map(({ val }) => val);
}

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
