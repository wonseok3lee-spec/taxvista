// utils/parse1040.js
import * as pdfjsLib from "pdfjs-dist";

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url
).toString();

export async function parse1040(file) {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

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

  // ── Summary fields (year-aware) ──────────────────────────────────────────
  const totalIncome = extractByLineNumber(lines, "9");

  // AGI: Line 11a on 2025 forms, Line 11 on 2021–2024
  const adjustedGrossIncome =
    year === 2025
      ? (extractByLineNumber(lines, "11a") ?? extractByLineNumber(lines, "11"))
      : (extractByLineNumber(lines, "11") ?? extractByLineNumber(lines, "11a"));

  const taxableIncome = extractByLineNumber(lines, "15");
  const totalTax      = extractByLineNumber(lines, "24");

  // ── Income fields (year-aware) ───────────────────────────────────────────
  // Wages: Line 1z (total wages, 2022+) is the correct income-composition numerator.
  // 2021 regular 1040: Line 1. 2021 1040-NR: Line 1a (no 1z available).
  const wages = (() => {
    if (year == null || year >= 2022) {
      return extractByLineNumber(lines, "1z") ?? extractByLineNumber(lines, "1a");
    }
    // year === 2021
    return isNR
      ? extractByLineNumber(lines, "1a")
      : (extractByLineNumber(lines, "1") ?? extractByLineNumber(lines, "1a"));
  })();

  // Capital gains: Line 7 on 2021–2024, Line 7a on 2025
  const capitalGains =
    year === 2025
      ? (extractByLineNumber(lines, "7a") ?? extractByLineNumber(lines, "7"))
      : (extractByLineNumber(lines, "7") ?? extractByLineNumber(lines, "7a"));

  // Adjustments: 1040-NR 2021–2022 uses Line 10d; all others use Line 10
  const totalAdjustments =
    isNR && year != null && year <= 2022
      ? (extractByLineNumber(lines, "10d") ?? extractByLineNumber(lines, "10"))
      : extractByLineNumber(lines, "10");

  // Deductions: year/form-specific line numbers
  const itemizedDeduction = (() => {
    if (year === 2025 && !isNR) {
      return extractByLineNumber(lines, "12e") ?? extractByLineNumber(lines, "12");
    }
    if (year === 2021) {
      return extractByLineNumber(lines, "12a") ?? extractByLineNumber(lines, "12");
    }
    return extractByLineNumber(lines, "12");
  })();

  return {
    year,
    isNR,
    income: {
      wages,
      interest:         extractByLineNumber(lines, "2b"),
      dividends:        extractByLineNumber(lines, "3b"),
      socialSecurity:   extractByLineNumber(lines, "6b"),
      capitalGains,
      additionalIncome: extractByLineNumber(lines, "8"),
    },
    adjustments: {
      studentLoanInterest: extractByLineNumber(lines, "21"),
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
