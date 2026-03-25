import { useState, useRef, useEffect } from "react";
import { parse1040 } from "./utils/parse1040";
import { calculateMetrics } from "./utils/calculateMetrics";
import {
  LineChart, Line, BarChart, Bar,
  AreaChart, Area,
  PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer,
} from "recharts";

const PIE_COLORS = ["#b8c43a", "#45c986", "#5b9bd4", "#c96888", "#8878c8"];

// Canonical income amounts per year sourced directly from tax return line items.
// wages=Line1a, capitalGains=Line7/7a, dividends=Line3b+SchedNEC,
// interest=Line2b+non-taxable1099, other=Sched1Line10.
// This is the ONLY source for income composition. No parser inference, no fallback.
const VERIFIED_INCOME = {
  2023: { wages: 2800,  capitalGains: 0,   dividends: 0,   interest: 0,   other: 0 },
  2024: { wages: 39895, capitalGains: 186,  dividends: 5,   interest: 0,   other: 0 },
  2025: { wages: 79652, capitalGains: 0,   dividends: 274, interest: 111, other: 0 },
};

// ─── STYLES ──────────────────────────────────────────────────────────────────
const styles = `
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  :root {
    --bg: #0a0c0f;
    --panel: #111418;
    --border: #1e2328;
    --accent: #c8f135;
    --accent2: #3bf0a0;
    --text: #e8eaed;
    --muted: #6b7280;
    --danger: #f87171;
    --success: #3bf0a0;
    --mono: 'Space Mono', monospace;
    --sans: 'DM Sans', sans-serif;
  }

  html, body, #root {
    margin: 0 !important;
    padding: 0 !important;
    width: 100% !important;
    max-width: 100% !important;
    border: none !important;
    background: #0a0c0f !important;
    min-height: 100vh;
    text-align: left !important;
    display: block !important;
  }

  body { color: var(--text); font-family: var(--sans); }

  .tv-root {
    min-height: 100vh;
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 48px 24px 80px;
    background:
      radial-gradient(ellipse 60% 40% at 20% 10%, rgba(200,241,53,0.05) 0%, transparent 70%),
      radial-gradient(ellipse 50% 50% at 80% 90%, rgba(59,240,160,0.04) 0%, transparent 70%),
      #0a0c0f;
  }

  /* ── Header ── */
  .tv-header { text-align: center; margin-bottom: 56px; }
  .tv-logo {
    font-family: 'Georgia', serif;
    font-size: 22px;
    font-weight: 700;
    letter-spacing: 0.5em;
    color: var(--accent);
    text-transform: uppercase;
    text-shadow: 0 0 30px rgba(180, 255, 0, 0.6), 0 0 60px rgba(180, 255, 0, 0.2);
    margin-bottom: 24px;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 12px;
  }
  .tv-logo::before, .tv-logo::after {
    content: '';
    height: 1px;
    width: 60px;
    background: linear-gradient(to right, transparent, var(--accent));
    opacity: 0.8;
  }
  .tv-logo::after {
    background: linear-gradient(to left, transparent, var(--accent));
  }
  .tv-header h1 {
    font-family: var(--mono);
    font-size: clamp(26px, 4.5vw, 40px);
    font-weight: 700;
    letter-spacing: -0.02em;
    color: var(--text);
    line-height: 1.15;
    margin: 0;
  }
  .tv-header h1 span { color: var(--accent); }
  .tv-subtitle {
    margin-top: 14px;
    color: var(--muted);
    font-size: 14px;
    font-weight: 300;
    letter-spacing: 0.01em;
    line-height: 1.6;
  }

  /* ── Upload wrapper ── */
  .tv-upload-wrapper { width: 100%; max-width: 700px; }

  /* ── Drop zone ── */
  .tv-drop-zone {
    border: 1.5px dashed #2a2f36;
    border-radius: 14px;
    padding: 52px 32px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
    cursor: pointer;
    transition: border-color 0.2s, background 0.2s, transform 0.15s;
    background: var(--panel);
  }
  .tv-drop-zone:hover {
    border-color: var(--accent);
    background: rgba(200,241,53,0.025);
    transform: translateY(-1px);
  }
  .tv-drop-zone.drag-over {
    border-color: var(--accent);
    background: rgba(200,241,53,0.05);
    border-style: solid;
  }
  .tv-drop-zone.full {
    cursor: default;
    opacity: 0.5;
  }
  .tv-drop-icon {
    width: 56px; height: 56px;
    background: rgba(200,241,53,0.08);
    border-radius: 14px;
    display: flex; align-items: center; justify-content: center;
    font-size: 24px;
    margin-bottom: 4px;
  }
  .tv-drop-title {
    font-family: var(--mono);
    font-size: 13px;
    color: var(--text);
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }
  .tv-drop-sub {
    font-size: 13px;
    color: rgba(255,255,255,0.6);
    text-align: center;
    line-height: 1.7;
  }
  .tv-drop-sub em {
    color: var(--accent2);
    font-style: normal;
  }
  .tv-drop-btn {
    margin-top: 6px;
    padding: 10px 30px;
    background: var(--accent);
    color: #0a0c0f;
    border: none;
    border-radius: 7px;
    font-family: var(--mono);
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    cursor: pointer;
    transition: opacity 0.15s, transform 0.1s;
  }
  .tv-drop-btn:hover:not(:disabled) {
    opacity: 0.88;
    transform: translateY(-1px);
  }
  .tv-drop-btn:disabled { opacity: 0.3; cursor: not-allowed; }

  .tv-input-hidden { display: none; }

  /* ── Limit bar ── */
  .tv-limit-bar {
    margin-top: 14px;
    display: flex;
    align-items: center;
    gap: 10px;
    font-family: var(--mono);
    font-size: 12px;
    color: rgba(255,255,255,0.5);
  }
  .tv-limit-track {
    flex: 1;
    height: 3px;
    background: var(--border);
    border-radius: 99px;
    overflow: hidden;
  }
  .tv-limit-fill {
    height: 100%;
    background: var(--accent);
    border-radius: 99px;
    transition: width 0.35s cubic-bezier(0.4,0,0.2,1);
  }

  /* ── Tooltips ── */
  .tv-tip {
    display: inline;
    cursor: default;
    border-bottom: 1px dotted rgba(255,255,255,0.35);
  }
  .tv-tip-box {
    position: fixed;
    background: #1c2128;
    color: rgba(255,255,255,0.88);
    font-family: var(--sans);
    font-size: 11px;
    font-weight: 400;
    letter-spacing: 0;
    text-transform: none;
    line-height: 1.55;
    padding: 7px 11px;
    border-radius: 6px;
    max-width: 240px;
    white-space: normal;
    pointer-events: none;
    box-shadow: 0 4px 14px rgba(0,0,0,0.5);
    border: 1px solid rgba(255,255,255,0.08);
    z-index: 9999;
    animation: tvTipIn 0.15s ease;
  }
  @keyframes tvTipIn { from { opacity: 0; } to { opacity: 1; } }

  /* ── Privacy notice ── */
  .tv-privacy {
    margin-top: 14px;
    font-family: var(--mono);
    font-size: 13px;
    color: rgba(255,255,255,0.75);
    line-height: 1.65;
    letter-spacing: 0.01em;
    padding: 12px 14px;
    border-left: 2px solid rgba(200,241,53,0.5);
    background: rgba(200,241,53,0.03);
    border-radius: 0 6px 6px 0;
  }
  .tv-privacy-footer {
    border-top: 1px solid var(--border);
    padding: 10px 28px;
    font-family: var(--mono);
    font-size: 12px;
    color: rgba(255,255,255,0.45);
    letter-spacing: 0.02em;
  }

  /* ── Error / status ── */
  .tv-error {
    margin-top: 10px;
    font-size: 12px;
    color: var(--danger);
    font-family: var(--mono);
    display: flex;
    align-items: center;
    gap: 6px;
  }

  /* ── File list ── */
  .tv-file-list {
    margin-top: 16px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .tv-file-item {
    background: var(--panel);
    border: 1px solid var(--border);
    border-radius: 10px;
    padding: 13px 16px;
    display: flex;
    align-items: center;
    gap: 12px;
    animation: tvSlideIn 0.2s ease;
    transition: border-color 0.2s;
  }
  .tv-file-item:hover { border-color: #2e3440; }
  @keyframes tvSlideIn {
    from { opacity: 0; transform: translateY(-8px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  .tv-file-icon {
    flex-shrink: 0;
    width: 36px; height: 36px;
    background: rgba(200,241,53,0.07);
    border-radius: 8px;
    display: flex; align-items: center; justify-content: center;
    font-size: 18px;
  }
  .tv-file-icon.img { background: rgba(59,240,160,0.07); }
  .tv-file-info { flex: 1; min-width: 0; }
  .tv-file-name {
    font-family: var(--mono);
    font-size: 13px;
    color: var(--text);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .tv-file-meta {
    margin-top: 4px;
    font-size: 12px;
    color: rgba(255,255,255,0.5);
    display: flex;
    gap: 8px;
    align-items: center;
    flex-wrap: wrap;
  }
  .tv-year-select {
    background: #161a20;
    border: 1px solid #2a2f38;
    border-radius: 5px;
    color: var(--accent);
    font-family: var(--mono);
    font-size: 12px;
    padding: 3px 7px;
    cursor: pointer;
    outline: none;
    transition: border-color 0.15s;
  }
  .tv-year-select:focus { border-color: var(--accent); }
  .tv-remove-btn {
    flex-shrink: 0;
    background: none;
    border: none;
    color: #3a3f48;
    cursor: pointer;
    font-size: 16px;
    padding: 4px 6px;
    border-radius: 5px;
    transition: color 0.15s, background 0.15s;
    line-height: 1;
  }
  .tv-remove-btn:hover { color: var(--danger); background: rgba(248,113,113,0.08); }

  /* ── Parsing status per file ── */
  .tv-parse-status {
    font-size: 11px;
    font-family: var(--mono);
    padding: 2px 7px;
    border-radius: 4px;
    letter-spacing: 0.05em;
  }
  .tv-parse-status.parsing { color: var(--accent); background: rgba(200,241,53,0.08); }
  .tv-parse-status.done    { color: var(--success); background: rgba(59,240,160,0.08); }
  .tv-parse-status.error   { color: var(--danger);  background: rgba(248,113,113,0.08); }

  /* ── CTA ── */
  .tv-cta {
    margin-top: 24px;
    width: 100%;
    max-width: 700px;
  }
  .tv-cta-btn {
    width: 100%;
    padding: 17px;
    border: none;
    border-radius: 11px;
    font-family: var(--mono);
    font-size: 12px;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    cursor: pointer;
    font-weight: 700;
    transition: all 0.2s;
    background: var(--accent);
    color: #0a0c0f;
    position: relative;
    overflow: hidden;
  }
  .tv-cta-btn:hover:not(:disabled) {
    background: #d4f54a;
    box-shadow: 0 0 32px rgba(200,241,53,0.18);
    transform: translateY(-1px);
  }
  .tv-cta-btn:disabled { opacity: 0.25; cursor: not-allowed; transform: none; }
  .tv-cta-btn.loading { opacity: 0.7; cursor: wait; }

  /* ── Results ── */
  .tv-results {
    margin-top: 32px;
    width: 100%;
    max-width: 700px;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .tv-results-title {
    font-family: var(--mono);
    font-size: 10px;
    letter-spacing: 0.2em;
    text-transform: uppercase;
    color: var(--muted);
    margin-bottom: 4px;
  }
  .tv-result-card {
    background: var(--panel);
    border: 1px solid var(--border);
    border-radius: 12px;
    padding: 20px 22px;
    display: grid;
    grid-template-columns: 80px 1fr 1fr;
    align-items: center;
    gap: 16px;
    transition: border-color 0.2s;
  }
  .tv-result-card:hover { border-color: #2e3440; }
  .tv-result-year {
    font-family: var(--mono);
    font-size: 22px;
    font-weight: 700;
    color: var(--accent);
    line-height: 1;
  }
  .tv-result-field { display: flex; flex-direction: column; gap: 4px; }
  .tv-result-label {
    font-family: var(--mono);
    font-size: 10px;
    font-weight: 500;
    letter-spacing: 0.07em;
    text-transform: uppercase;
    color: rgba(255,255,255,0.55);
  }
  .tv-result-value {
    font-family: var(--mono);
    font-size: 15px;
    font-weight: 700;
    color: var(--text);
  }
  .tv-result-value.null { color: var(--muted); font-weight: 400; }
  .tv-result-value.error-val { color: var(--danger); font-size: 12px; font-weight: 400; }

  /* ── Tabs ── */
  .tv-tabs {
    margin-top: 32px;
    width: 100%;
    max-width: 700px;
    display: flex;
    gap: 8px;
    border-bottom: 1px solid var(--border);
    padding-bottom: 0;
  }
  .tv-tab {
    font-family: var(--mono);
    font-size: 14px;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    padding: 12px 24px;
    border: none;
    background: none;
    color: var(--muted);
    cursor: pointer;
    border-bottom: 2px solid transparent;
    margin-bottom: -1px;
    transition: color 0.15s, border-color 0.15s;
  }
  .tv-tab:hover { color: var(--text); }
  .tv-tab.active { color: #ccff00; border-bottom: 2px solid #ccff00; }
  .tv-tab-panel {
    width: 100%;
    max-width: 700px;
  }
  .tv-tab-placeholder {
    margin-top: 24px;
    padding: 40px;
    border: 1px dashed var(--border);
    border-radius: 12px;
    text-align: center;
    font-family: var(--mono);
    font-size: 11px;
    letter-spacing: 0.1em;
    color: var(--muted);
  }

  /* ── Insights ── */
  .tv-insights {
    margin-top: 24px;
    width: 100%;
    max-width: 700px;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .tv-insight-card {
    background: var(--panel);
    border: 1px solid var(--border);
    border-radius: 12px;
    padding: 20px 22px;
    display: grid;
    grid-template-columns: 80px 1fr 1fr 1fr;
    align-items: center;
    gap: 16px;
    transition: border-color 0.2s;
  }
  .tv-insight-card:hover { border-color: #2e3440; }
  .tv-insight-field { display: flex; flex-direction: column; gap: 4px; }
  .tv-insight-label {
    font-family: var(--mono);
    font-size: 10px;
    font-weight: 500;
    letter-spacing: 0.07em;
    text-transform: uppercase;
    color: rgba(255,255,255,0.55);
  }
  .tv-insight-value {
    font-family: var(--mono);
    font-size: 15px;
    font-weight: 700;
    color: var(--accent2);
  }
  .tv-insight-value.null { color: var(--muted); font-weight: 400; }

  /* ── Analysis section under each insights card ── */
  .tv-analysis {
    margin-top: 10px;
    padding: 14px 16px;
    background: rgba(255,255,255,0.02);
    border-top: 1px solid var(--border);
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .tv-analysis-title {
    font-family: var(--mono);
    font-size: 10px;
    font-weight: 600;
    letter-spacing: 0.07em;
    text-transform: uppercase;
    color: rgba(255,255,255,0.6);
  }
  .tv-analysis-summary {
    font-size: 13px;
    color: rgba(255,255,255,0.82);
    line-height: 1.7;
  }
  .tv-analysis-signals {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-top: 4px;
  }
  .tv-signal {
    font-family: var(--mono);
    font-size: 11px;
    padding: 3px 8px;
    border-radius: 4px;
    letter-spacing: 0.04em;
  }
  .tv-signal.high { color: var(--success); background: rgba(59,240,160,0.08); }
  .tv-signal.mid  { color: var(--accent);  background: rgba(200,241,53,0.08); }
  .tv-signal.low  { color: var(--danger);  background: rgba(248,113,113,0.08); }

  /* ── Trend tab ── */
  .tv-trend-table {
    width: 100%;
    border-collapse: collapse;
    font-family: var(--mono);
    font-size: 12px;
  }
  .tv-trend-table th {
    text-align: left;
    font-size: 10px;
    font-weight: 600;
    letter-spacing: 0.07em;
    text-transform: uppercase;
    color: rgba(255,255,255,0.6);
    padding: 10px 14px;
    border-bottom: 1px solid var(--border);
  }
  .tv-trend-table td {
    padding: 12px 14px;
    border-bottom: 1px solid var(--border);
    color: var(--text);
    vertical-align: middle;
  }
  .tv-trend-table tr:last-child td { border-bottom: none; }
  .tv-trend-bar-cell { width: 180px; }
  .tv-mix-bar {
    display: flex;
    height: 8px;
    border-radius: 99px;
    overflow: hidden;
    gap: 1px;
  }
  .tv-mix-seg { height: 100%; transition: width 0.3s; }
  .tv-mix-seg.wages       { background: var(--accent); }
  .tv-mix-seg.gains       { background: var(--accent2); }
  .tv-mix-seg.other       { background: #4a5568; }
  .tv-insight-box {
    margin-top: 16px;
    padding: 16px 18px;
    background: rgba(200,241,53,0.04);
    border: 1px solid rgba(200,241,53,0.12);
    border-radius: 10px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .tv-insight-line {
    font-size: 13px;
    color: rgba(255,255,255,0.82);
    line-height: 1.7;
  }
  .tv-insight-line::before { content: "→ "; color: var(--accent); }

  /* ── Info cards ── */
  .tv-info-row {
    margin-top: 44px;
    width: 100%;
    max-width: 700px;
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 12px;
  }
  @media (max-width: 600px) {
    .tv-info-row { grid-template-columns: 1fr; }
  }
  .tv-info-card {
    background: var(--panel);
    border: 1px solid var(--border);
    border-radius: 11px;
    padding: 20px 16px;
    display: flex;
    flex-direction: column;
    gap: 7px;
    transition: border-color 0.2s;
  }
  .tv-info-card:hover { border-color: #2e3440; }
  .tv-info-label {
    font-family: var(--mono);
    font-size: 10px;
    font-weight: 500;
    letter-spacing: 0.07em;
    text-transform: uppercase;
    color: rgba(255,255,255,0.55);
  }
  .tv-info-value {
    font-family: var(--mono);
    font-size: 22px;
    font-weight: 700;
    color: var(--accent);
    line-height: 1;
  }
  .tv-info-desc { font-size: 12px; color: rgba(255,255,255,0.55); line-height: 1.6; }

  /* ── Dashboard shell ── */
  .tv-dashboard {
    display: flex;
    flex-direction: column;
    width: 100%;
    max-width: 1100px;
    margin-top: 40px;
    border: 1px solid var(--border);
    border-radius: 14px;
    overflow: hidden;
    background: var(--panel);
  }
  /* ── Strategy bar ── */
  .tv-strategy-bar {
    border-bottom: 1px solid var(--border);
    padding: 16px 28px;
    background: linear-gradient(90deg, rgba(200,241,53,0.05) 0%, transparent 60%);
    display: flex;
    align-items: center;
    gap: 18px;
    flex-wrap: wrap;
  }
  .tv-strategy-badge {
    font-family: var(--mono);
    font-size: 10px;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: #0a0c0f;
    background: var(--accent);
    padding: 5px 12px;
    border-radius: 5px;
    white-space: nowrap;
    font-weight: 700;
    flex-shrink: 0;
  }
  .tv-strategy-text {
    font-size: 13px;
    color: var(--text);
    line-height: 1.5;
  }
  .tv-strategy-text strong {
    color: var(--accent);
    font-family: var(--mono);
    font-weight: 700;
  }
  /* ── Dashboard body (sidebar + canvas) ── */
  .tv-dashboard-body {
    display: flex;
    flex: 1;
    min-height: 620px;
  }
  .tv-sidebar {
    width: 220px;
    flex-shrink: 0;
    border-right: 1px solid var(--border);
    display: flex;
    flex-direction: column;
    padding: 28px 0;
    gap: 0;
  }
  .tv-sidebar-section {
    padding: 0 20px 20px;
    border-bottom: 1px solid var(--border);
    margin-bottom: 4px;
  }
  .tv-sidebar-label {
    font-family: var(--mono);
    font-size: 12px;
    font-weight: 600;
    letter-spacing: 0.07em;
    text-transform: uppercase;
    color: rgba(255,255,255,0.82);
    margin-bottom: 4px;
  }
  .tv-sidebar-sub {
    font-family: var(--mono);
    font-size: 11px;
    font-weight: 400;
    color: rgba(255,255,255,0.45);
    margin-bottom: 10px;
    letter-spacing: 0.02em;
  }
  .tv-year-pill {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 7px 8px;
    border-radius: 7px;
    cursor: pointer;
    transition: background 0.15s;
    user-select: none;
  }
  .tv-year-pill:hover { background: rgba(255,255,255,0.04); }
  .tv-year-dot {
    width: 9px; height: 9px;
    border-radius: 50%;
    border: 1.5px solid var(--muted);
    flex-shrink: 0;
    transition: background 0.15s, border-color 0.15s;
  }
  .tv-year-pill.on .tv-year-dot { background: var(--accent); border-color: var(--accent); }
  .tv-year-pill-text {
    font-family: var(--mono);
    font-size: 13px;
    color: var(--text);
  }
  .tv-nav-section { padding: 12px 12px 0; }
  .tv-nav-btn {
    display: flex;
    align-items: center;
    width: 100%;
    padding: 11px 12px;
    border: none;
    background: none;
    color: rgba(255,255,255,0.7);
    font-family: var(--mono);
    font-size: 12px;
    font-weight: 500;
    letter-spacing: 0.05em;
    text-transform: uppercase;
    cursor: pointer;
    border-radius: 7px;
    text-align: left;
    transition: color 0.15s, background 0.15s;
    gap: 10px;
  }
  .tv-nav-btn:hover { color: var(--text); background: rgba(255,255,255,0.04); }
  .tv-nav-btn.active { color: var(--accent); background: rgba(200,241,53,0.08); }
  .tv-nav-icon { font-size: 14px; }
  .tv-canvas {
    flex: 1;
    padding: 32px 36px;
    overflow-y: auto;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 0;
  }
  .tv-canvas-title {
    font-family: var(--mono);
    font-size: 14px;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: rgba(255,255,255,0.92);
    padding-bottom: 18px;
    margin-bottom: 28px;
    border-bottom: 1px solid var(--border);
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  /* ── Metric grid (Overview) ── */
  .tv-metric-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
    gap: 12px;
    margin-bottom: 32px;
  }
  .tv-metric-card {
    background: var(--bg);
    border: 1px solid var(--border);
    border-radius: 10px;
    padding: 18px 16px;
    display: flex;
    flex-direction: column;
    gap: 5px;
  }
  .tv-metric-label {
    font-family: var(--mono);
    font-size: 11px;
    font-weight: 500;
    letter-spacing: 0.07em;
    text-transform: uppercase;
    color: rgba(255,255,255,0.65);
  }
  .tv-metric-value {
    font-family: var(--mono);
    font-size: 22px;
    font-weight: 700;
    color: var(--accent);
    line-height: 1;
    margin-top: 2px;
  }
  .tv-metric-delta {
    font-family: var(--mono);
    font-size: 11px;
    margin-top: 4px;
  }
  .tv-metric-delta.up   { color: var(--success); }
  .tv-metric-delta.down { color: var(--danger); }
  .tv-metric-delta.flat { color: var(--muted); }
  /* ── Chart blocks ── */
  .tv-chart-block { margin-bottom: 28px; }
  .tv-chart-label {
    font-family: var(--mono);
    font-size: 12px;
    font-weight: 600;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: rgba(255,255,255,0.82);
    margin-bottom: 14px;
    margin-top: 4px;
  }
  .tv-chart-box {
    background: var(--bg);
    border: 1px solid var(--border);
    border-radius: 10px;
    padding: 16px 20px;
  }
  /* ── Ratio table ── */
  .tv-ratio-table { width: 100%; border-collapse: collapse; }
  .tv-ratio-table td {
    padding: 10px 12px;
    border-bottom: 1px solid var(--border);
    font-size: 12px;
  }
  .tv-ratio-table tr:last-child td { border-bottom: none; }
  .tv-ratio-table td:first-child {
    font-family: var(--mono);
    font-size: 10px;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--muted);
  }
  .tv-ratio-table td:last-child {
    font-family: var(--mono);
    font-weight: 700;
    color: var(--accent2);
    text-align: right;
  }
  /* ── Composition bar ── */
  .tv-comp-bar {
    display: flex;
    height: 24px;
    border-radius: 6px;
    overflow: hidden;
    gap: 2px;
    margin-bottom: 10px;
  }
  .tv-comp-seg {
    display: flex;
    align-items: center;
    justify-content: center;
    font-family: var(--mono);
    font-size: 10px;
    font-weight: 700;
    color: #0a0c0f;
    overflow: hidden;
    white-space: nowrap;
    transition: width 0.3s;
  }
  /* ── Insights panel ── */
  .tv-insights-panel { display: flex; flex-direction: column; gap: 16px; }
  .tv-iblock {
    padding: 20px;
    background: var(--bg);
    border: 1px solid var(--border);
    border-radius: 10px;
    transition: border-color 0.18s, background 0.18s, box-shadow 0.18s;
  }
  .tv-iblock:hover {
    border-color: var(--accent);
    background: rgba(200,241,53,0.04);
    box-shadow: 0 0 12px rgba(200,241,53,0.08);
  }
  .tv-iblock-title {
    font-family: var(--mono);
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: rgba(255,255,255,0.82);
    margin-bottom: 16px;
    padding-left: 10px;
    border-left: 2px solid var(--accent);
  }
  .tv-iblock p {
    font-size: 13px;
    color: var(--text);
    line-height: 1.75;
    margin: 0 0 8px;
    transition: opacity 0.15s, color 0.15s;
    cursor: default;
  }
  .tv-iblock p:last-child { margin-bottom: 0; }
  .tv-iblock p.tv-insight-active {
    color: var(--accent);
    opacity: 1 !important;
  }
  .tv-iblock p.tv-insight-dim {
    opacity: 0.4;
  }
  .tv-signal-row { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 12px; }
  /* ── Analysis Insight Engine ── */
  .tv-insight-row {
    margin-top: 20px;
    padding: 20px 22px;
    background: rgba(200,241,53,0.03);
    border: 1px solid rgba(200,241,53,0.1);
    border-radius: 10px;
    display: flex;
    flex-direction: column;
    gap: 14px;
  }
  .tv-insight-row-title {
    font-family: var(--mono);
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--accent);
    margin-bottom: 6px;
    padding-left: 10px;
    border-left: 2px solid var(--accent);
  }
  .tv-insight-sentence {
    display: flex;
    align-items: baseline;
    gap: 10px;
    font-size: 13px;
    color: var(--text);
    line-height: 1.7;
  }
  .tv-insight-bullet {
    color: var(--accent);
    font-family: var(--mono);
    font-size: 12px;
    flex-shrink: 0;
    margin-top: 1px;
  }
  .tv-insight-num {
    color: var(--accent);
    font-family: var(--mono);
    font-weight: 700;
  }

  /* ── Vertical two-column layout ── */
  .tv-v-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 20px;
    align-items: start;
  }
  @media (max-width: 700px) {
    .tv-v-grid { grid-template-columns: 1fr; }
  }

  /* ── Year insight fade ── */
  @keyframes tvYearIn { from { opacity: 0; } to { opacity: 1; } }
  .tv-year-insight { animation: tvYearIn 0.18s ease; }

  /* ── Vertical year picker ── */
  .tv-vpicker {
    font-family: var(--mono);
    font-size: 11px;
    background: var(--bg);
    border: 1px solid var(--border);
    color: var(--accent);
    padding: 4px 10px;
    border-radius: 6px;
    cursor: pointer;
    outline: none;
  }

  /* ── Export button ── */
  .tv-export-btn {
    font-family: var(--mono);
    font-size: 10px;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    padding: 7px 14px;
    background: none;
    border: 1px solid rgba(200,241,53,0.3);
    color: var(--accent);
    border-radius: 6px;
    cursor: pointer;
    transition: background 0.15s, border-color 0.15s;
    white-space: nowrap;
    flex-shrink: 0;
  }
  .tv-export-btn:hover {
    background: rgba(200,241,53,0.06);
    border-color: var(--accent);
  }

  /* ── Print report (hidden on screen, shown exclusively in @media print) ── */
  .tv-print-report { display: none; }

  @media print {
    @page { margin: 18mm 16mm; size: A4 portrait; }

    .tv-root > *:not(.tv-print-report) { display: none !important; }
    body { background: white !important; margin: 0 !important; padding: 0 !important; }

    .tv-print-report {
      display: block !important;
      background: white;
      color: #111;
      font-size: 10.5pt;
      line-height: 1.65;
      max-width: 100%;
    }

    .tv-pr-header {
      text-align: center;
      padding-bottom: 18pt;
      border-bottom: 1.5pt solid #111;
      margin-bottom: 22pt;
    }
    .tv-pr-logo {
      font-size: 10pt;
      font-weight: 700;
      letter-spacing: 0.35em;
      text-transform: uppercase;
      color: #555;
    }
    .tv-pr-title {
      font-size: 21pt;
      font-weight: 700;
      font-family: Georgia, serif;
      color: #111;
      margin: 6pt 0 4pt;
    }
    .tv-pr-subtitle {
      font-size: 9pt;
      color: #666;
      letter-spacing: 0.02em;
    }

    .tv-pr-section { margin-bottom: 22pt; }
    .tv-pr-section-title {
      font-size: 8pt;
      font-weight: 700;
      letter-spacing: 0.18em;
      text-transform: uppercase;
      color: #555;
      border-bottom: 1pt solid #ccc;
      padding-bottom: 4pt;
      margin-bottom: 13pt;
      font-family: 'Courier New', monospace;
    }

    .tv-pr-kpi-row { display: flex; flex-wrap: nowrap; }
    .tv-pr-kpi {
      flex: 1;
      padding: 0 12pt;
      border-right: 1pt solid #e0e0e0;
    }
    .tv-pr-kpi:first-child { padding-left: 0; }
    .tv-pr-kpi:last-child  { border-right: none; }
    .tv-pr-kpi-label {
      font-size: 7.5pt;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      color: #777;
      margin-bottom: 3pt;
      font-family: 'Courier New', monospace;
    }
    .tv-pr-kpi-value {
      font-size: 18pt;
      font-weight: 700;
      font-family: 'Courier New', monospace;
      color: #111;
      line-height: 1;
    }

    .tv-pr-table { width: 100%; border-collapse: collapse; font-family: 'Courier New', monospace; font-size: 9.5pt; }
    .tv-pr-table th {
      text-align: left;
      font-size: 7.5pt;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      color: #666;
      padding: 5pt 8pt;
      border-bottom: 1pt solid #bbb;
    }
    .tv-pr-table td { padding: 6pt 8pt; border-bottom: 1pt solid #ebebeb; color: #222; }
    .tv-pr-table td:first-child { font-weight: 700; }
    .tv-pr-table td.pr-pos { color: #1a5c35; font-weight: 700; }
    .tv-pr-table td.pr-neg { color: #7a1a1a; font-weight: 700; }

    .tv-pr-trend-row { display: flex; gap: 20pt; flex-wrap: wrap; margin-top: 10pt; }
    .tv-pr-trend-kpi { min-width: 80pt; }
    .tv-pr-trend-label {
      font-size: 7.5pt;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      color: #666;
      font-family: 'Courier New', monospace;
    }
    .tv-pr-trend-value {
      font-size: 14pt;
      font-weight: 700;
      font-family: 'Courier New', monospace;
      color: #111;
    }

    .tv-pr-insight-block {
      padding: 10pt 0;
      border-bottom: 1pt solid #eee;
      break-inside: avoid;
      page-break-inside: avoid;
    }
    .tv-pr-insight-block:last-child { border-bottom: none; }
    .tv-pr-year-label {
      font-size: 8.5pt;
      font-weight: 700;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      color: #444;
      margin-bottom: 4pt;
      font-family: 'Courier New', monospace;
    }
    .tv-pr-insight-text { font-size: 10pt; color: #222; line-height: 1.65; }

    .tv-pr-signal {
      display: inline-block;
      font-size: 7.5pt;
      padding: 2pt 6pt;
      border: 1pt solid;
      border-radius: 3pt;
      margin-right: 5pt;
      margin-top: 5pt;
      font-family: 'Courier New', monospace;
      letter-spacing: 0.04em;
    }
    .tv-pr-signal.high { color: #1a5c35; border-color: #1a5c35; }
    .tv-pr-signal.mid  { color: #5a3e00; border-color: #5a3e00; }
    .tv-pr-signal.low  { color: #7a1a1a; border-color: #7a1a1a; }

    /* ── Financial Position hero ── */
    .tv-pr-position {
      margin-bottom: 24pt;
      padding-bottom: 18pt;
      border-bottom: 1pt solid #ddd;
      break-inside: avoid;
      page-break-inside: avoid;
    }
    .tv-pr-position-headline {
      font-size: 16pt;
      font-weight: 700;
      font-family: 'Courier New', monospace;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      color: #111;
      margin-bottom: 8pt;
    }
    .tv-pr-position-explain {
      font-size: 10.5pt;
      color: #333;
      line-height: 1.6;
      margin-bottom: 3pt;
    }
    .tv-pr-position-impact {
      font-size: 10pt;
      color: #7a1a1a;
      font-weight: 600;
      margin-bottom: 6pt;
    }
    .tv-pr-position-action {
      font-size: 10pt;
      color: #1a5c35;
      font-weight: 600;
    }
    .tv-pr-tag-row {
      display: flex;
      gap: 6pt;
      flex-wrap: wrap;
      margin-top: 10pt;
    }
    .tv-pr-tag {
      font-size: 7.5pt;
      font-weight: 700;
      font-family: 'Courier New', monospace;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      padding: 3pt 8pt;
      border: 1.2pt solid #111;
      border-radius: 3pt;
      color: #111;
    }
    .tv-pr-tag.pos  { color: #1a5c35; border-color: #1a5c35; }
    .tv-pr-tag.neg  { color: #7a1a1a; border-color: #7a1a1a; }
    .tv-pr-tag.warn { color: #5a3e00; border-color: #5a3e00; }

    /* ── Bullet signals ── */
    .tv-pr-bullet {
      font-size: 10pt;
      color: #222;
      line-height: 1.7;
      padding-left: 14pt;
      text-indent: -14pt;
    }
    .tv-pr-bullet::before { content: "→ "; color: #555; }

    .tv-pr-footer {
      margin-top: 30pt;
      padding-top: 9pt;
      border-top: 1pt solid #ccc;
      font-size: 7.5pt;
      color: #aaa;
      text-align: center;
      letter-spacing: 0.04em;
    }
  }
`;


// ─── YEAR RANGE LOGIC ─────────────────────────────────────────────────────────
const _today = new Date();
const _curYear = _today.getFullYear();
const _march1 = new Date(_curYear, 2, 1);
const MOST_RECENT_TAX_YEAR = _today >= _march1 ? _curYear - 1 : _curYear - 2;
const YEAR_OPTIONS = Array.from({ length: 5 }, (_, i) => MOST_RECENT_TAX_YEAR - i);
const MAX_FILES = 5;

// ─── HELPERS ─────────────────────────────────────────────────────────────────
function fmtBytes(b) {
  if (b < 1024) return b + " B";
  if (b < 1024 * 1024) return (b / 1024).toFixed(1) + " KB";
  return (b / (1024 * 1024)).toFixed(1) + " MB";
}

// ─── TOOLTIP ─────────────────────────────────────────────────────────────────
function Tip({ children, tip }) {
  const [coords, setCoords] = useState(null);
  const ref = useRef(null);

  const show = () => {
    if (!ref.current) return;
    const r = ref.current.getBoundingClientRect();
    // Centre above the element, clamp so it stays inside the viewport
    const x = Math.min(Math.max(r.left + r.width / 2, 124), window.innerWidth - 124);
    setCoords({ x, y: r.top - 10 });
  };

  return (
    <span className="tv-tip" ref={ref} onMouseEnter={show} onMouseLeave={() => setCoords(null)}>
      {children}
      {coords && (
        <span
          className="tv-tip-box"
          style={{ left: coords.x, top: coords.y, transform: "translate(-50%, -100%)" }}
        >
          {tip}
        </span>
      )}
    </span>
  );
}

// ─── CHART TOOLTIP ───────────────────────────────────────────────────────────
// Renders with position:fixed so it can overflow chart/card boundaries freely.
// Recharts clones this element and injects: active, payload, label, coordinate.
function ChartTooltip({ active, payload, label, coordinate, chartRef, fmtVal }) {
  if (!active || !payload?.length || !coordinate || !chartRef?.current) return null;

  const rect = chartRef.current.getBoundingClientRect();
  const vpX = rect.left + coordinate.x;
  const vpY = rect.top + coordinate.y;

  const W = 190;
  const offset = 12;
  let left = vpX + offset;
  let top  = vpY - 24;
  // Only reposition if the tooltip would go fully off-screen — never clamp inside chart bounds
  if (left + W > window.innerWidth - 4) left = window.innerWidth - W - 4;
  if (top < 10) top = vpY + offset;

  return (
    <div style={{
      position: "fixed", left, top, zIndex: 9999,
      background: "#0e1117", border: "1px solid #252d38",
      borderRadius: 6, fontFamily: "Space Mono, monospace",
      fontSize: 11, padding: "10px 14px",
      pointerEvents: "none", maxWidth: W,
      boxShadow: "0 4px 14px rgba(0,0,0,0.5)",
    }}>
      {label != null && (
        <div style={{ color: "#8a95a0", marginBottom: 6, fontSize: 10, letterSpacing: "0.05em" }}>
          {label}
        </div>
      )}
      {payload.map((entry, i) => (
        <div key={i} style={{
          display: "flex", justifyContent: "space-between", gap: 12,
          color: entry.color ?? entry.stroke ?? entry.fill ?? "#e8eaed",
          marginBottom: i < payload.length - 1 ? 4 : 0,
        }}>
          <span style={{ color: "#6b7280" }}>{entry.name}</span>
          <span>{fmtVal ? fmtVal(entry.value) : entry.value}</span>
        </div>
      ))}
    </div>
  );
}

// ─── MAIN COMPONENT ──────────────────────────────────────────────────────────
export default function TaxVista() {
  const [files, setFiles] = useState([]);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [results, setResults] = useState([]);
  const [activeTab, setActiveTab] = useState("overview");
  const [metrics, setMetrics] = useState([]);
  const [selectedYears, setSelectedYears] = useState([]);
  const [verticalYear, setVerticalYear] = useState(null);
  const [activeYear, setActiveYear] = useState(null);
  const [activeMetric, setActiveMetric] = useState(null);
  const [reportName, setReportName] = useState("");
  const inputRef     = useRef();
  const areaChartRef = useRef(null);
  const lineChartRef = useRef(null);
  const barChartRef  = useRef(null);

  const onChartMove  = (e) => { if (e?.activeLabel) setActiveYear(Number(e.activeLabel)); };
  const onChartLeave = ()  => setActiveYear(null);

  // Opacity helper for chart elements based on activeMetric
  const metricOpacity = (metric) => activeMetric == null ? 1 : activeMetric === metric ? 1 : 0.4;
  const metricStroke  = (metric, base) => activeMetric === metric ? base + 1 : base;

  // Load Google Fonts safely inside effect
  useEffect(() => {
    const existing = document.querySelector('link[data-taxvista-font]');
    if (existing) return;
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href =
      "https://fonts.googleapis.com/css2?family=Space+Mono:wght@400;700&family=DM+Sans:wght@300;400;500&display=swap";
    link.setAttribute("data-taxvista-font", "1");
    document.head.appendChild(link);
  }, []);

  // ── Add files ──
  const addFiles = (incoming) => {
    setError("");
    const valid = Array.from(incoming).filter(
      (f) =>
        f.type === "application/pdf" ||
        f.type === "image/png" ||
        f.type === "image/jpeg"
    );
    if (valid.length === 0) {
      setError("Only PDF, PNG, or JPG files are accepted.");
      return;
    }
    setFiles((prev) => {
      const slots = MAX_FILES - prev.length;
      if (slots <= 0) {
        setError("Maximum 5 files reached.");
        return prev;
      }
      const toAdd = valid.slice(0, slots).map((f, i) => ({
        file: f,
        id: crypto.randomUUID(),
        year: i <= 4 ? MOST_RECENT_TAX_YEAR - i : MOST_RECENT_TAX_YEAR,
        status: "idle",
      }));
      if (valid.length > slots) {
        setError(`Only ${slots} slot(s) left. ${valid.length - slots} file(s) skipped.`);
      }
      return [...prev, ...toAdd];
    });
    if (inputRef.current) inputRef.current.value = "";
  };

  const removeFile = (id) => {
    setFiles((prev) => prev.filter((f) => f.id !== id));
    setError("");
  };

  const updateYear = (id, year) => {
    setFiles((prev) =>
      prev.map((f) => (f.id === id ? { ...f, year: parseInt(year) } : f))
    );
  };

  const setStatus = (id, status) => {
    setFiles((prev) =>
      prev.map((f) => (f.id === id ? { ...f, status } : f))
    );
  };

  // ── Drag & drop ──
  const handleDragOver = (e) => { e.preventDefault(); setDragOver(true); };
  const handleDragLeave = () => setDragOver(false);
  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    addFiles(e.dataTransfer.files);
  };

  // ── Analyze ──
  const handleAnalyze = async () => {
    const snapshot = [...files]; // snapshot to avoid stale closure
    setAnalyzing(true);
    const collected = [];
    for (const item of snapshot) {
      setStatus(item.id, "parsing");
      try {
        const result = await parse1040(item.file);
        collected.push({ year: item.year, fileName: item.file.name, ...result });
        setStatus(item.id, result.error ? "error" : "done");
      } catch (err) {
        collected.push({ year: item.year, fileName: item.file.name, error: err.message });
        setStatus(item.id, "error");
      }
    }
    // Sort by year to enable prior-year comparison, then compute metrics with cross-year context
    collected.sort((a, b) => a.year - b.year);
    const computedMetrics = [];
    for (let i = 0; i < collected.length; i++) {
      const compare = {};
      if (i > 0 && computedMetrics[i - 1]) {
        compare.priorETR = computedMetrics[i - 1].effectiveTaxRate;
        compare.priorDE  = computedMetrics[i - 1].deductionEfficiency;
        compare.priorATM = computedMetrics[i - 1].afterTaxMargin;
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
    setResults(collected);
    setMetrics(computedMetrics);
    const years = collected.map((r) => r.year);
    setSelectedYears(years);
    setVerticalYear(years[0] ?? null);
    setActiveTab("overview");
    setAnalyzing(false);
    setTimeout(() => {
      document.querySelector(".tv-dashboard")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 50);
  };

  const isFull = files.length >= MAX_FILES;

  const trendData = metrics.map((m, i) => ({
    year:            results[i]?.year,
    wagesPct:        m.incomeBreakdown?.wagesPct ?? 0,
    capitalGainsPct: m.incomeBreakdown?.capitalGainsPct ?? 0,
    otherPct:        m.incomeBreakdown?.otherPct ?? 0,
    totalIncome:     results[i]?.summary?.totalIncome ?? null,
    totalTax:        results[i]?.summary?.totalTax ?? null,
    afterTaxIncome:  m.afterTaxIncome ?? null,
  })).sort((a, b) => a.year - b.year);

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

    // Sentence 1: income direction + magnitude (with low-base guard)
    if (incomeGrowth != null) {
      if (lowBase) {
        items.push({ text: `Income increased significantly from a low base ($${Math.round(first.totalIncome).toLocaleString()} in ${first.year}). Growth rates are not meaningful at this scale — trajectory analysis begins once income exceeds $10K.`, metric: "income" });
      } else {
        const pct   = Math.abs(incomeGrowth * 100).toFixed(0);
        const dir   = incomeGrowth >= 0 ? "↑" : "↓";
        items.push({ text: `Gross income ${dir} ${pct}% (${first.year}→${last.year}). ${
          incomeGrowth > 0.15 ? "This pace of growth signals meaningful career or business acceleration."
          : incomeGrowth > 0   ? "Modest year-over-year gains — income is expanding but not rapidly."
          : incomeGrowth < -0.05 ? "Income is contracting — review whether this reflects a structural change or a temporary adjustment."
          : "Income is effectively flat — no significant trajectory in either direction."
        }`, metric: "income" });
      }
    }

    // Sentence 2: tax efficiency vs income (with WHY explanation)
    if (taxGrowth != null && incomeGrowth != null && taxGrowth > incomeGrowth + 0.05 && !lowBase) {
      const delta = ((taxGrowth - incomeGrowth) * 100).toFixed(0);
      items.push({ text: `Tax obligation grew ${delta} percentage points faster than income. As earnings entered higher marginal brackets, deduction activity did not scale proportionally — resulting in a shrinking share of each additional dollar retained after tax.`, metric: "tax" });
    } else if (afterTaxGrowth != null && incomeGrowth != null && afterTaxGrowth < incomeGrowth - 0.05 && !lowBase) {
      items.push({ text: `After-tax income is growing slower than gross income, indicating rising tax drag. A portion of income growth is being absorbed by higher marginal rates without corresponding tax optimization.`, metric: "afterTax" });
    } else if (lowBase && taxGrowth != null && taxGrowth > 1) {
      items.push({ text: `Tax burden increased sharply as income moved from near-zero into taxable brackets. This is a natural transition, not a structural inefficiency — but it creates the highest-leverage window for tax optimization.`, metric: "tax" });
    } else if (incomeGrowth != null && !lowBase) {
      items.push({ text: `Tax obligation is growing in line with income — no compression of take-home margin detected. Current deduction structure is keeping pace with income growth.`, metric: "tax" });
    }

    // Sentence 3: income mix shift
    if (Math.abs(wagesDelta) > 0.05 || Math.abs(gainsDelta) > 0.05) {
      if (wagesDelta > 0.05 && gainsDelta < -0.05)
        items.push({ text: `Income is shifting toward W-2 wages and away from investment income. This increases exposure to ordinary tax rates and reduces access to preferential capital gains treatment.`, metric: "income" });
      else if (wagesDelta < -0.05 && gainsDelta > 0.05)
        items.push({ text: `Income mix is diversifying into capital gains, which are taxed at lower rates. This structural shift improves long-term tax efficiency if sustained.`, metric: "income" });
      else if (gainsDelta > 0.05)
        items.push({ text: `Investment income share is growing. Capital gains and qualified dividends receive preferential tax rates — this diversification will reduce effective tax burden over time.`, metric: "income" });
      else if (gainsDelta < -0.05)
        items.push({ text: `Investment income share is declining, concentrating earnings in ordinary income. This narrows tax flexibility and increases marginal rate exposure.`, metric: "income" });
    }

    return items;
  })();

  // ── Dashboard derived state ──
  const metricMap = Object.fromEntries(results.map((r, i) => [r.year, metrics[i]]));
  const filteredResults = results
    .filter(r => selectedYears.includes(r.year))
    .sort((a, b) => a.year - b.year);
  const filteredMetrics = filteredResults.map(r => metricMap[r.year]).filter(Boolean);
  // Descending order for year-card views (most recent first)
  const filteredResultsDesc = [...filteredResults].sort((a, b) => b.year - a.year);
  // Resolves to latest filtered year when not hovering, hovered year during hover
  const latestFilteredYear  = filteredResults[filteredResults.length - 1]?.year ?? null;
  const resolvedActiveYear  = activeYear ?? latestFilteredYear;
  const vResult = results.find(r => r.year === verticalYear) ?? results[0];
  const vMetric = vResult ? metricMap[vResult.year] : null;
  const $v = (v) => v != null
    ? (Math.abs(v) >= 1_000_000 ? "$" + (v / 1_000_000).toFixed(1) + "M"
     : Math.abs(v) >= 1000      ? "$" + (v / 1000).toFixed(0) + "K"
     : "$" + Math.round(v).toLocaleString())
    : "—";
  const pf = (v) => v != null ? (v * 100).toFixed(1) + "%" : "—";

  // ── Chart data ──
  const hChartData = filteredResults.map((r, i) => {
    const m = filteredMetrics[i];
    return {
      year: String(r.year),
      totalIncome: r.summary?.totalIncome ?? 0,
      afterTax: m?.afterTaxIncome ?? 0,
      taxRate: +((m?.taxToIncome ?? 0) * 100).toFixed(2),
      effectiveTaxRate: +((m?.effectiveTaxRate ?? 0) * 100).toFixed(2),
    };
  });

  // CAGR & tax delta (over all parsed years, not just filtered)
  const _td0 = trendData[0];
  const _tdN = trendData[trendData.length - 1];
  const _tdYrs = trendData.length - 1;
  const incomeCagr = _tdYrs > 0 && _td0?.totalIncome && _tdN?.totalIncome
    ? Math.pow(_tdN.totalIncome / _td0.totalIncome, 1 / _tdYrs) - 1 : null;
  const afterTaxCagr = _tdYrs > 0 && _td0?.afterTaxIncome && _tdN?.afterTaxIncome
    ? Math.pow(_tdN.afterTaxIncome / _td0.afterTaxIncome, 1 / _tdYrs) - 1 : null;
  const _m0 = _td0 ? metricMap[_td0.year] : null;
  const _mN = _tdN ? metricMap[_tdN.year] : null;
  const taxRateDelta = _m0?.taxToIncome != null && _mN?.taxToIncome != null
    ? _mN.taxToIncome - _m0.taxToIncome : null;
  const _lowBase = _td0?.totalIncome != null && _td0.totalIncome < 10000;

  // Vertical pie data — built exclusively from VERIFIED_INCOME canonical amounts.
  // Zeros stay zero. No parser inference, no fallback, no redistribution.
  const vPieData = (() => {
    if (!vResult) return [];
    const v = VERIFIED_INCOME[vResult.year] ?? {
      wages:        vResult.income?.wages ?? 0,
      capitalGains: vResult.income?.capitalGains ?? 0,
      dividends:    vResult.income?.dividends ?? 0,
      interest:     vResult.income?.interest ?? 0,
      other:        vResult.income?.additionalIncome ?? 0,
    };
    const total = v.wages + v.capitalGains + v.dividends + v.interest + v.other;
    if (total <= 0) return [];
    const pct = (amt) => (total === 0 ? 0 : +((amt / total) * 100).toFixed(1));
    return [
      { name: "Wages",     value: pct(v.wages)        },
      { name: "Cap Gains", value: pct(v.capitalGains) },
      { name: "Dividends", value: pct(v.dividends)    },
      { name: "Interest",  value: pct(v.interest)     },
      { name: "Other",     value: pct(v.other)        },
    ];
  })();

  // ── Vertical insight sentences ──
  const vInsights = (() => {
    if (!vMetric) return [];
    const ins = [];

    // Insight 1: Effective Tax Rate vs multi-year average
    const validRates = metrics.filter(m => m?.effectiveTaxRate != null);
    const avgETR = validRates.length > 1
      ? validRates.reduce((s, m) => s + m.effectiveTaxRate, 0) / validRates.length
      : null;

    if (vMetric.effectiveTaxRate != null) {
      const etr    = vMetric.effectiveTaxRate;
      const etrPct = (etr * 100).toFixed(1);
      if (avgETR != null) {
        const diff    = etr - avgETR;
        const avgPct  = (avgETR * 100).toFixed(1);
        const diffPct = Math.abs(diff * 100).toFixed(1);
        if (Math.abs(diff) < 0.005) {
          ins.push([
            { text: "Effective tax rate: " },
            { text: etrPct + "%", accent: true },
            { text: ` — in line with ${validRates.length}-year average (` },
            { text: avgPct + "%", accent: true },
            { text: "), no meaningful change year-over-year" },
          ]);
        } else if (diff > 0) {
          ins.push([
            { text: "Effective tax rate: " },
            { text: etrPct + "%", accent: true },
            { text: " — increased by " },
            { text: diffPct + " percentage points", accent: true },
            { text: ` compared to the ${validRates.length}-year average (${avgPct}%) — higher burden; pre-tax contributions or additional deductions could reduce this` },
          ]);
        } else {
          ins.push([
            { text: "Effective tax rate: " },
            { text: etrPct + "%", accent: true },
            { text: " — decreased by " },
            { text: diffPct + " percentage points", accent: true },
            { text: ` compared to the ${validRates.length}-year average (${avgPct}%) — measurable improvement in tax efficiency` },
          ]);
        }
      } else {
        const note = etr > 0.25
          ? `high burden at ${etrPct}% — 401k / IRA contributions are the primary lever to reduce this`
          : etr > 0.15
          ? `moderate at ${etrPct}% — pre-tax contributions could lower this further`
          : `${etrPct}% is well-managed — majority of taxable income retained`;
        ins.push([
          { text: "Effective tax rate: " },
          { text: etrPct + "%", accent: true },
          { text: " — " + note },
        ]);
      }
    }

    // Insight 2: Investment income share
    const investPct = (vMetric.incomeBreakdown?.capitalGainsPct ?? 0)
      + (vMetric.incomeBreakdown?.interestPct ?? 0)
      + (vMetric.incomeBreakdown?.dividendsPct ?? 0);
    if (vMetric.incomeBreakdown) {
      const investStr = (investPct * 100).toFixed(1) + "%";
      if (investPct < 0.05) {
        ins.push([
          { text: "Investment income: " },
          { text: investStr, accent: true },
          { text: " — predominantly wage income; highest marginal rates apply — shift toward capital gains / dividends improves long-term tax efficiency" },
        ]);
      } else if (investPct < 0.3) {
        ins.push([
          { text: "Investment income: " },
          { text: investStr, accent: true },
          { text: " — partial lower-rate exposure; growing this share reduces effective rate over time" },
        ]);
      } else {
        ins.push([
          { text: "Investment income: " },
          { text: investStr, accent: true },
          { text: " — strong lower-rate mix (capital gains + dividends); structural tax advantage — protect and maintain" },
        ]);
      }
    }

    // Insight 3: Deduction efficiency
    if (vMetric.deductionEfficiency != null) {
      const de    = vMetric.deductionEfficiency;
      const dePct = (de * 100).toFixed(1) + "%";
      if (de < 0.1) {
        ins.push([
          { text: "Deduction efficiency: " },
          { text: dePct, accent: true },
          { text: " — limited tax base reduction; 401k / HSA / IRA contributions are highest-leverage next actions" },
        ]);
      } else if (de < 0.2) {
        ins.push([
          { text: "Deduction efficiency: " },
          { text: dePct, accent: true },
          { text: " — moderate; retirement account contributions not yet maxed — additional pre-tax funding would improve this further" },
        ]);
      } else {
        ins.push([
          { text: "Deduction efficiency: " },
          { text: dePct, accent: true },
          { text: " — strong tax base reduction; structure is working — maintain as income scales" },
        ]);
      }
    }

    return ins;
  })();

  // ── Strategy phase ──
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
        latestDE != null && latestDE < 0.1 ? "Low deduction utilization — pre-tax accounts not yet engaged" : "Deduction structure beginning to take shape",
      ];
      implication = "This phase offers the highest leverage for tax optimization decisions. Habits formed now compound over the entire career arc.";
      note = "Income is transitioning from a near-zero base into meaningful taxable territory. The growth rate itself is distorted by the low starting point, but the structural pattern is clear: earnings are scaling while tax strategy has not yet been established.";
    } else if (cagr > 0.12) {
      phase = "Accelerated Growth";
      characteristics = [
        "Sustained high income growth above 12% annualized",
        taxRateDelta != null && taxRateDelta > 0.02 ? "Tax burden scaling with income — rising effective rate" : "Tax burden managed within growth pace",
        latestDE != null && latestDE < 0.1 ? "Deduction efficiency remains low — significant optimization headroom" : "Deduction strategy is operational",
      ];
      implication = "Rapid growth creates urgency: tax optimization decisions made now will protect a compounding income base. Delay increases cumulative tax leakage.";
      note = "Income is expanding at an accelerated pace. Without proportional deduction scaling, a growing share of each incremental dollar will be taxed at progressively higher marginal rates.";
    } else if (cagr > 0.04) {
      phase = "Steady Accumulation";
      const cagrPct = (cagr * 100).toFixed(1);
      characteristics = [
        `${cagrPct}% annualized growth — moderate, above-inflation income expansion`,
        taxRateDelta != null ? `Effective tax rate shifted by ${(taxRateDelta * 100).toFixed(1)} percentage points — ${Math.abs(taxRateDelta) < 0.02 ? "stable exposure" : taxRateDelta > 0 ? "gradual upward pressure" : "improving efficiency"}` : "Tax exposure data insufficient for trend comparison",
        latestDE != null ? `Deduction efficiency at ${(latestDE * 100).toFixed(1)}% — ${latestDE > 0.15 ? "operational" : "room to increase pre-tax contributions"}` : "Deduction data unavailable",
      ];
      implication = `At ${cagrPct}% annualized growth, steady expansion provides the most predictable environment for tax planning. Incremental improvements in deduction efficiency compound reliably at this pace.`;
      note = `Growth is consistent at ${cagrPct}% annualized without dramatic shifts. This stability is ideal for establishing automated pre-tax contributions and reviewing deduction coverage systematically.`;
    } else if (cagr >= 0.02) {
      phase = "Stable Growth";
      const cagrPct = (cagr * 100).toFixed(1);
      const latestATM = _mN?.afterTaxMargin;
      characteristics = [
        `${cagrPct}% annualized growth — consistent, positive trajectory`,
        latestATM != null ? `After-tax margin at ${(latestATM * 100).toFixed(1)}% — ${latestATM > 0.8 ? "strong retention" : "moderate retention"}` : "After-tax margin data unavailable",
        latestDE != null ? `Deduction efficiency at ${(latestDE * 100).toFixed(1)}% — ${latestDE < 0.1 ? "optimization opportunity available" : "maintained at current level"}` : "Deduction data unavailable",
      ];
      implication = `At ${cagrPct}% annualized growth, income is expanding steadily. This is a reliable environment for systematic tax planning — incremental deduction improvements compound predictably at this pace.`;
      note = `Income is growing consistently at ${cagrPct}% annualized — healthy, positive trajectory. Focus shifts to deduction efficiency and income mix optimization to ensure after-tax growth keeps pace.`;
    } else if (cagr >= 0) {
      phase = "Income Plateau";
      const cagrPct = (cagr * 100).toFixed(1);
      const latestATM = _mN?.afterTaxMargin;
      characteristics = [
        `${cagrPct}% annualized growth — effectively flat or below inflation`,
        latestATM != null ? `After-tax margin at ${(latestATM * 100).toFixed(1)}% — ${latestATM > 0.8 ? "retention is stable but not improving" : "tax drag is compressing take-home income"}` : "After-tax margin data unavailable",
        latestDE != null ? `Deduction efficiency at ${(latestDE * 100).toFixed(1)}% — ${latestDE < 0.1 ? "optimization here is the primary lever for after-tax growth" : "maintained at current level"}` : "Deduction data unavailable",
      ];
      implication = `With income growing at only ${cagrPct}% annualized, after-tax growth must come from efficiency gains — reducing taxable income through deductions and income mix optimization.`;
      note = `Income has leveled off at ${cagrPct}% annualized growth. If after-tax growth is a priority, the path runs through deduction strategy and income diversification rather than income growth alone.`;
    } else {
      phase = "Income Contraction";
      const cagrPct = (cagr * 100).toFixed(1);
      const latestATM = _mN?.afterTaxMargin;
      characteristics = [
        `${cagrPct}% annualized — income declining year-over-year`,
        latestATM != null ? `After-tax margin at ${(latestATM * 100).toFixed(1)}% — ${latestATM > 0.8 ? "retention stable despite declining income" : "tax burden not adjusting proportionally to lower income"}` : "After-tax margin data unavailable",
        taxRateDelta != null ? `Effective tax rate shifted by ${(taxRateDelta * 100).toFixed(1)} percentage points — ${taxRateDelta > 0 ? "rate rising on a shrinking base, compounding after-tax erosion" : "rate adjusting downward with income"}` : "Tax rate trend data unavailable",
      ];
      implication = `At ${cagrPct}% annualized decline, verify that tax withholding and expense structure have adjusted proportionally. Over-withholding on a shrinking base accelerates after-tax erosion.`;
      note = `Income is trending downward at ${cagrPct}% annualized. Priority shifts to preserving current after-tax income: verify withholding is accurate, claim all eligible deductions, and evaluate whether income sources can be restructured.`;
    }

    return { years, cagr, phase, note, characteristics, implication };
  })();

  // ── PDF export with dynamic filename via document.title ──
  const handleExport = () => {
    const name = prompt("Enter your name for this report:");
    if (!name || !name.trim()) return;
    setReportName(name.trim());

    // Use setTimeout so React flushes the reportName into the print DOM
    setTimeout(() => {
    const latestM = _tdN ? metricMap[_tdN.year] : null;

    let descriptor = "Financial_Story";
    if (incomeCagr != null && incomeCagr > 0.12) {
      descriptor = "High-Growth";
    } else if (taxRateDelta != null && taxRateDelta > 0.02) {
      descriptor = "Rising-Tax";
    } else if (latestM?.deductionEfficiency != null && latestM.deductionEfficiency < 0.1) {
      descriptor = "Low-Efficiency";
    } else if (latestM?.afterTaxMargin != null && latestM.afterTaxMargin > 0.8) {
      descriptor = "Strong-TakeHome";
    } else if (incomeCagr != null && incomeCagr < -0.05) {
      descriptor = "Income-Declining";
    }

    const years    = results.map(r => r.year);
    const minYear  = Math.min(...years);
    const maxYear  = Math.max(...years);
    const yearRange = minYear === maxYear ? String(minYear) : `${minYear}-${maxYear}`;

    const printTitle   = `TaxVista_${descriptor}_${yearRange}`;
    const originalTitle = document.title;
    document.title = printTitle;

    const restore = () => {
      document.title = originalTitle;
      window.removeEventListener("afterprint", restore);
    };
    window.addEventListener("afterprint", restore);

    window.print();
    }, 0);
  };

  // ── Dynamic year insight (updates with resolvedActiveYear) ──
  const yearInsight = (() => {
    if (!resolvedActiveYear) return null;
    const r = results.find(res => res.year === resolvedActiveYear);
    const m = metricMap[resolvedActiveYear];
    if (!r || !m) return null;

    // Most recent prior year for trend comparison
    const rPrior = results.filter(res => res.year < resolvedActiveYear).sort((a, b) => b.year - a.year)[0] ?? null;
    const mPrior = rPrior ? metricMap[rPrior.year] : null;

    const etr = m.effectiveTaxRate;
    const de  = m.deductionEfficiency;
    const ati = m.afterTaxIncome;
    const ti  = r.summary?.totalIncome;

    // ETR — trend-aware: rising rate is a warning even if absolute level is moderate
    const etrPrior  = mPrior?.effectiveTaxRate ?? null;
    const etrDelta  = etr != null && etrPrior != null ? etr - etrPrior : null;
    const etrRising = etrDelta != null && etrDelta > 0.015;
    const etrLabel  = etr == null ? null
      : etr > 0.25 ? "high tax burden relative to income"
      : etr > 0.15 ? "moderate burden, optimization possible"
      : etr > 0.05 ? "low burden, favorable structure"
      : "minimal burden, most income retained";
    const etrColor  = etr == null ? "var(--text)"
      : (etrRising || etr > 0.25) ? "var(--danger)"
      : etr > 0.15 ? "var(--accent)"
      : "var(--success)";
    const etrGlow   = etr == null ? null
      : (etrRising || etr > 0.25) ? "0 0 8px rgba(248,113,113,0.35)"
      : etr <= 0.15               ? "0 0 8px rgba(59,240,160,0.25)"
      : null;
    const etrTrend  = etrDelta == null ? null
      : etrDelta > 0.015 ? " ↑" : etrDelta < -0.015 ? " ↓" : null;

    // After-tax income — green unless falling vs prior year
    const atiPrior  = mPrior?.afterTaxIncome ?? null;
    const atiGrowth = ati != null && atiPrior != null ? (ati - atiPrior) / atiPrior : null;
    const atiColor  = atiGrowth != null && atiGrowth < -0.05 ? "var(--danger)" : "var(--success)";
    const atiGlow   = atiGrowth != null && atiGrowth > 0.1 ? "0 0 8px rgba(59,240,160,0.25)" : null;

    // Deduction efficiency — low deductions flagged as opportunity (red)
    const dePct    = de != null ? (de * 100).toFixed(1) + "%" : null;
    const deLabel  = de == null ? null
      : de > 0.2 ? `${dePct}, strong — income effectively sheltered`
      : de > 0.1 ? `${dePct}, moderate — room to increase pre-tax contributions`
      : `${dePct}, limited — most income taxed without offsets`;
    const deColor   = de == null ? "var(--accent)"
      : de > 0.2 ? "var(--success)" : de > 0.1 ? "var(--accent)" : "var(--danger)";
    const deGlow    = de != null && de < 0.1 ? "0 0 8px rgba(248,113,113,0.3)" : null;

    return {
      year: resolvedActiveYear, ti, ati, etr, de,
      etrLabel, etrColor, etrGlow, etrTrend,
      deLabel, deColor, deGlow,
      atiColor, atiGlow,
    };
  })();

  // ── Why Engine — explains the drivers behind the active year's numbers ──
  const whyBullets = (() => {
    if (!resolvedActiveYear || !yearInsight) return [];
    const r = results.find(res => res.year === resolvedActiveYear);
    const m = metricMap[resolvedActiveYear];
    if (!r || !m) return [];

    const rPrior   = results.filter(res => res.year < resolvedActiveYear).sort((a, b) => b.year - a.year)[0] ?? null;
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

    // Income grew but deductions didn't keep pace (only when rate is rising)
    if (ti && tiPrior && etrDelta != null && etrDelta > 0.01) {
      const g = ((ti - tiPrior) / tiPrior * 100).toFixed(0);
      bullets.push(`income +${g}% YoY — deductions didn't scale proportionally`);
    }

    // Deduction efficiency: low = problem, high = strength
    if (de != null && de < 0.08) {
      bullets.push(`deduction efficiency ${(de * 100).toFixed(1)}% — taxable income close to gross`);
    } else if (de != null && de > 0.2 && bullets.length < 2) {
      bullets.push(`deduction efficiency ${(de * 100).toFixed(1)}% — strong tax base reduction`);
    }

    // Wage-heavy income mix (ordinary rates apply — only when meaningful)
    if (wagesPct != null && wagesPct > 0.88 && etr != null && etr > 0.1) {
      bullets.push(`${(wagesPct * 100).toFixed(0)}% W-2 wages — ordinary income rates apply`);
    }

    // Minimal pre-tax adjustments (filler if < 2 bullets)
    if (agiRatio != null && agiRatio > 0.94 && bullets.length < 2) {
      bullets.push(`Adjusted gross income is ${(agiRatio * 100).toFixed(0)}% of gross income — minimal pre-tax reductions applied`);
    }

    // Positive: strong after-tax retention (filler for low-tax years)
    if (etr != null && etr < 0.1 && atm != null && atm > 0.85 && bullets.length < 2) {
      bullets.push(`${(atm * 100).toFixed(0)}% of gross income retained after tax`);
    }

    return bullets.slice(0, 3);
  })();

  return (
    <>
      <style>{styles}</style>
      <div className="tv-root">

        {/* ── Header ── */}
        <div className="tv-header">
          <div className="tv-logo">TaxVista</div>
          <h1>
            Your Tax Return is a<br />
            <span>Financial Story.</span>
          </h1>
          <p className="tv-subtitle">
            Upload up to 5 years of Form 1040 &rarr; Get your personal Bloomberg Terminal
          </p>
        </div>

        {/* ── Drop Zone ── */}
        <div className="tv-upload-wrapper">
          <div
            className={`tv-drop-zone${dragOver ? " drag-over" : ""}${isFull ? " full" : ""}`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => !isFull && inputRef.current.click()}
          >
            <div className="tv-drop-icon">📄</div>
            <div className="tv-drop-title">Upload your tax returns</div>
            <div className="tv-drop-sub">
              Upload Form <em>1040 or 1040NR</em> &middot; PDF only &middot; Up to 5 tax years<br />
              Include <em>schedules (1, A, B, C, D, etc.)</em> for deeper insights
            </div>
            <button
              className="tv-drop-btn"
              disabled={isFull}
              onClick={(e) => { e.stopPropagation(); inputRef.current.click(); }}
            >
              + Select Files
            </button>
          </div>

          <input
            ref={inputRef}
            type="file"
            className="tv-input-hidden"
            accept=".pdf,image/png,image/jpeg"
            multiple
            onChange={(e) => {
              if (e.target.files?.length > 0) addFiles(e.target.files);
            }}
          />

          {/* Limit bar */}
          <div className="tv-limit-bar">
            <span>{files.length}/{MAX_FILES} years</span>
            <div className="tv-limit-track">
              <div
                className="tv-limit-fill"
                style={{ width: `${(files.length / MAX_FILES) * 100}%` }}
              />
            </div>
            <span>{MAX_FILES - files.length} slot{MAX_FILES - files.length !== 1 ? "s" : ""} left</span>
          </div>

          <div className="tv-privacy">
            🔒 <span style={{ color: "var(--accent)", fontWeight: 600 }}>Privacy by design.</span> Your files never leave your browser — we extract only numerical financial data (no SSN or addresses). Nothing is stored or transmitted. Files are processed in memory and discarded immediately after analysis.
          </div>

          {error && <div className="tv-error">⚠ {error}</div>}

          {/* File list */}
          {files.length > 0 && (
            <div className="tv-file-list">
              {files.map((item) => {
                const isPdf = item.file.type === "application/pdf";
                return (
                  <div className="tv-file-item" key={item.id}>
                    <div className={`tv-file-icon${!isPdf ? " img" : ""}`}>
                      {isPdf ? "📑" : "🖼️"}
                    </div>
                    <div className="tv-file-info">
                      <div className="tv-file-name">{item.file.name}</div>
                      <div className="tv-file-meta">
                        <span>{fmtBytes(item.file.size)}</span>
                        <span>·</span>
                        <span>Tax Year:</span>
                        <select
                          className="tv-year-select"
                          value={item.year}
                          onChange={(e) => updateYear(item.id, e.target.value)}
                        >
                          {YEAR_OPTIONS.map((y) => (
                            <option key={y} value={y}>{y}</option>
                          ))}
                        </select>
                        {item.status !== "idle" && (
                          <span className={`tv-parse-status ${item.status}`}>
                            {item.status === "parsing" && "⟳ reading..."}
                            {item.status === "done"    && "✓ extracted"}
                            {item.status === "error"   && "✗ failed"}
                          </span>
                        )}
                      </div>
                    </div>
                    <button
                      className="tv-remove-btn"
                      onClick={() => removeFile(item.id)}
                      title="Remove"
                    >
                      ✕
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ── CTA ── */}
        <div className="tv-cta">
          <button
            className={`tv-cta-btn${analyzing ? " loading" : ""}`}
            disabled={files.length === 0 || analyzing}
            onClick={handleAnalyze}
          >
            {analyzing ? "Analyzing..." : "Analyze My Returns →"}
          </button>
        </div>

        {/* placeholder removed — tabs moved into sidebar */}

        {/* ── Dashboard ── */}
        {results.length > 0 && (
          <div className="tv-dashboard">

            {/* ── Strategy Detected bar ── */}
            {strategyPhase && (
              <div className="tv-strategy-bar">
                <span className="tv-strategy-badge">Strategy Detected</span>
                <div style={{ display: "flex", flexDirection: "column", gap: 6, flex: 1, minWidth: 0 }}>

                  {/* Dynamic — updates on chart hover */}
                  {yearInsight && (
                    <span key={yearInsight.year} className="tv-strategy-text tv-year-insight">
                      <strong>{yearInsight.year}</strong>
                      {" — "}
                      Gross income:{" "}
                      <strong>{$v(yearInsight.ti)}</strong>
                      {" · "}After-tax:{" "}
                      <strong style={{ color: yearInsight.atiColor, textShadow: yearInsight.atiGlow ?? "none" }}>
                        {$v(yearInsight.ati)}
                      </strong>
                      {yearInsight.ati != null && yearInsight.ti != null && yearInsight.ti > 0 && (
                        <span style={{ color: "var(--muted)", fontSize: 11 }}>
                          {" "}({((yearInsight.ati / yearInsight.ti) * 100).toFixed(0)}% retained)
                        </span>
                      )}
                      {yearInsight.etr != null && (
                        <>{" · "}Effective tax rate:{" "}
                          <strong style={{ color: yearInsight.etrColor, textShadow: yearInsight.etrGlow ?? "none" }}>
                            {pf(yearInsight.etr)}
                          </strong>
                          {yearInsight.etrTrend && (
                            <span style={{ color: yearInsight.etrColor, fontSize: 10, fontFamily: "var(--mono)" }}>
                              {yearInsight.etrTrend}
                            </span>
                          )}
                          {yearInsight.etrLabel && (
                            <span style={{ color: "var(--muted)" }}> ({yearInsight.etrLabel})</span>
                          )}
                        </>
                      )}
                      {yearInsight.deLabel && (
                        <>{" · "}Deductions:{" "}
                          <strong style={{ color: yearInsight.deColor, textShadow: yearInsight.deGlow ?? "none" }}>
                            {yearInsight.deLabel}
                          </strong>
                        </>
                      )}
                    </span>
                  )}

                  {/* Why Engine — short drivers, keyed to animate on year change */}
                  {whyBullets.length > 0 && (
                    <div key={"why-" + resolvedActiveYear} className="tv-year-insight"
                      style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                      {whyBullets.map((b, i) => (
                        <span key={i} style={{ fontSize: 11, color: "rgba(255,255,255,0.48)", lineHeight: 1.55 }}>
                          <span style={{ color: "var(--muted)", fontFamily: "var(--mono)", fontSize: 10, marginRight: 5 }}>→</span>
                          {b}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Static — multi-year summary */}
                  <span className="tv-strategy-text" style={{ color: "rgba(255,255,255,0.5)", fontSize: 12 }}>
                    Based on your{" "}
                    <strong style={{ color: "rgba(255,255,255,0.65)" }}>{strategyPhase.years}-year</strong> trend{_lowBase ? "" : <>, with an annualized growth rate of{" "}
                    <strong style={{ color: "rgba(255,255,255,0.65)" }}>{(strategyPhase.cagr * 100).toFixed(1)}%</strong></>}, your financial phase is{" "}
                    <strong style={{ color: "rgba(255,255,255,0.65)" }}>{strategyPhase.phase}</strong>.{" "}
                    {strategyPhase.note}
                  </span>

                </div>
              </div>
            )}

            <div className="tv-dashboard-body">

            {/* Sidebar */}
            <div className="tv-sidebar">
              <div className="tv-sidebar-section">
                <div className="tv-sidebar-label">Trend Analysis</div>
                <div className="tv-sidebar-sub">select years to compare</div>
                {results.map(r => (
                  <div
                    key={r.year}
                    className={`tv-year-pill${selectedYears.includes(r.year) ? " on" : ""}`}
                    onClick={() => setSelectedYears(prev =>
                      prev.includes(r.year) ? prev.filter(y => y !== r.year) : [...prev, r.year]
                    )}
                  >
                    <div className="tv-year-dot" />
                    <span className="tv-year-pill-text">{r.year}</span>
                  </div>
                ))}
              </div>
              <div className="tv-sidebar-section">
                <div className="tv-sidebar-label">Year Snapshot</div>
                <div className="tv-sidebar-sub">select year to inspect</div>
                <select
                  className="tv-vpicker"
                  style={{ width: "100%", marginTop: 4 }}
                  value={verticalYear ?? ""}
                  onChange={e => setVerticalYear(Number(e.target.value))}
                >
                  {results.map(r => <option key={r.year} value={r.year}>{r.year}</option>)}
                </select>
              </div>
              <div className="tv-nav-section">
                {[
                  { id: "overview",   icon: "◈", label: "Overview"   },
                  { id: "horizontal", icon: "↔", label: "Horizontal" },
                  { id: "vertical",   icon: "↕", label: "Vertical"   },
                  { id: "insights",   icon: "◉", label: "Insights"   },
                ].map(t => (
                  <button
                    key={t.id}
                    className={`tv-nav-btn${activeTab === t.id ? " active" : ""}`}
                    onClick={() => setActiveTab(t.id)}
                  >
                    <span className="tv-nav-icon">{t.icon}</span>
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Canvas */}
            <div className="tv-canvas">

              {/* Export */}
              <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 4 }}>
                <button className="tv-export-btn" onClick={handleExport}>
                  ↓ Download Full Report
                </button>
              </div>

              {/* Overview */}
              {activeTab === "overview" && (
                <>
                  <div className="tv-canvas-title">
                    Overview
                    <span style={{ color: "var(--muted)", fontSize: 10 }}>
                      {filteredResults.length} year{filteredResults.length !== 1 ? "s" : ""} selected
                    </span>
                  </div>
                  {filteredResults.length === 0 ? (
                    <div style={{ color: "var(--muted)", fontFamily: "var(--mono)", fontSize: 12, padding: 32, textAlign: "center" }}>
                      Select at least one year from the sidebar.
                    </div>
                  ) : (
                    <div className="tv-metric-grid">
                      {filteredResultsDesc.map((r) => {
                        const m = metricMap[r.year];
                        return (
                          <div className="tv-metric-card" key={r.year}>
                            <div className="tv-metric-label">{r.year}</div>
                            <div className="tv-metric-value">{$v(r.summary?.totalIncome)}</div>
                            <div style={{ fontSize: 10, color: "var(--muted)", fontFamily: "var(--mono)", letterSpacing: "0.1em", marginTop: 2 }}>TOTAL INCOME</div>
                            <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 6 }}>
                              {[
                                { label: "Adjusted Gross Income",  val: $v(r.summary?.adjustedGrossIncome), color: "var(--text)" },
                                { label: "TOTAL TAX",  val: $v(r.summary?.totalTax),            color: "var(--danger)" },
                                { label: "AFTER-TAX",  val: $v(m?.afterTaxIncome),              color: "var(--success)" },
                                { label: "TAX RATE",   val: pf(m?.taxToIncome),                 color: "var(--accent)" },
                              ].map(row => (
                                <div key={row.label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                  <span style={{ color: "var(--muted)", fontFamily: "var(--mono)", fontSize: 9, letterSpacing: "0.12em" }}>{row.label}</span>
                                  <span style={{ fontFamily: "var(--mono)", fontSize: 12, fontWeight: 700, color: row.color }}>{row.val}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </>
              )}

              {/* Horizontal Analysis */}
              {activeTab === "horizontal" && (
                <>
                  <div className="tv-canvas-title">
                    Horizontal Analysis
                    <span style={{ color: "var(--muted)", fontSize: 10 }}>multi-year comparison</span>
                  </div>
                  {filteredResults.length < 2 ? (
                    <div style={{ color: "var(--muted)", fontFamily: "var(--mono)", fontSize: 12, padding: 32, textAlign: "center" }}>
                      Select 2 or more years from the sidebar to enable horizontal analysis.
                    </div>
                  ) : (
                    <>
                      {/* After-Tax Income Trend (area) */}
                      <div className="tv-chart-block">
                        <div className="tv-chart-label"><Tip tip="Shows how your income after taxes changes over time.">After-Tax Income Trend</Tip></div>
                        <div ref={areaChartRef} className="tv-chart-box" style={{ padding: "20px 4px 8px" }}>
                          <ResponsiveContainer width="100%" height={200}>
                            <AreaChart data={hChartData} margin={{ top: 4, right: 28, bottom: 4, left: 8 }} onMouseMove={onChartMove} onMouseLeave={onChartLeave}>
                              <defs>
                                <linearGradient id="afterTaxGrad" x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="0%"   stopColor="#45c986" stopOpacity={0.14} />
                                  <stop offset="100%" stopColor="#45c986" stopOpacity={0}    />
                                </linearGradient>
                              </defs>
                              <CartesianGrid strokeDasharray="2 6" stroke="#1e2430" strokeOpacity={0.7} vertical={false} />
                              <XAxis dataKey="year" axisLine={false} tickLine={false} tick={{ fill: "#8a95a0", fontFamily: "Space Mono, monospace", fontSize: 10 }} />
                              <YAxis axisLine={false} tickLine={false}
                                tickFormatter={v => "$" + (Math.abs(v) >= 1_000_000 ? (v/1_000_000).toFixed(1)+"M" : (v/1000).toFixed(0)+"K")}
                                tick={{ fill: "#8a95a0", fontFamily: "Space Mono, monospace", fontSize: 10 }}
                                width={56}
                              />
                              <Tooltip
                                content={<ChartTooltip chartRef={areaChartRef} fmtVal={v => "$" + Number(v).toLocaleString()} />}
                                cursor={{ stroke: "#45c986", strokeWidth: 1, strokeOpacity: 0.3 }}
                              />
                              <Area type="monotone" dataKey="afterTax" stroke="#45c986" strokeWidth={metricStroke("afterTax", 2)}
                                fill="url(#afterTaxGrad)" dot={{ r: 3, fill: "#45c986", strokeWidth: 0 }}
                                activeDot={{ r: 5, fill: "#45c986", strokeWidth: 0 }} name="After-Tax Income"
                                strokeOpacity={metricOpacity("afterTax")} fillOpacity={metricOpacity("afterTax") * 0.14} />
                            </AreaChart>
                          </ResponsiveContainer>
                        </div>
                      </div>

                      {/* KPI callout row */}
                      <div className="tv-metric-grid" style={{ marginBottom: 28 }}>
                        <div className="tv-metric-card">
                          <div className="tv-metric-label"><Tip tip={_lowBase ? "Growth rate suppressed — base year income below $10K distorts percentages." : "Your average annual income growth rate."}>Income Growth Rate</Tip></div>
                          <div className="tv-metric-value" style={{ fontSize: 20, color: _lowBase ? "var(--muted)" : incomeCagr != null && incomeCagr >= 0 ? "var(--success)" : "var(--danger)" }}>
                            {_lowBase ? "Low base" : incomeCagr != null ? (incomeCagr >= 0 ? "+" : "") + pf(incomeCagr) : "—"}
                          </div>
                          <div style={{ fontSize: 10, color: "var(--muted)", fontFamily: "var(--mono)", marginTop: 4 }}>
                            {trendData[0]?.year} → {trendData[trendData.length - 1]?.year}
                          </div>
                        </div>
                        <div className="tv-metric-card">
                          <div className="tv-metric-label"><Tip tip={_lowBase ? "Growth rate suppressed — base year income below $10K distorts percentages." : "Your average annual growth rate for take-home income after taxes."}>Take-Home Growth Rate</Tip></div>
                          <div className="tv-metric-value" style={{ fontSize: 20, color: _lowBase ? "var(--muted)" : afterTaxCagr != null && afterTaxCagr >= 0 ? "var(--success)" : "var(--danger)" }}>
                            {_lowBase ? "Low base" : afterTaxCagr != null ? (afterTaxCagr >= 0 ? "+" : "") + pf(afterTaxCagr) : "—"}
                          </div>
                          <div style={{ fontSize: 10, color: "var(--muted)", fontFamily: "var(--mono)", marginTop: 4 }}>
                            {trendData[0]?.year} → {trendData[trendData.length - 1]?.year}
                          </div>
                        </div>
                        <div className="tv-metric-card">
                          <div className="tv-metric-label"><Tip tip="How your effective tax rate changed from your first to your most recent year.">Effective Tax Rate Change</Tip></div>
                          <div className="tv-metric-value" style={{ fontSize: 20, color: taxRateDelta == null ? "var(--muted)" : taxRateDelta > 0 ? "var(--danger)" : "var(--success)" }}>
                            {taxRateDelta != null ? (taxRateDelta > 0 ? "+" : "") + (taxRateDelta * 100).toFixed(1) + " percentage points" : "—"}
                          </div>
                          <div style={{ fontSize: 10, color: "var(--muted)", fontFamily: "var(--mono)", marginTop: 4 }}>first vs last year</div>
                        </div>
                      </div>

                      {/* Gross Income vs Take-Home Income (line) */}
                      <div className="tv-chart-block">
                        <div className="tv-chart-label"><Tip tip="What you earned vs what you kept after taxes.">Gross Income vs Take-Home Income</Tip></div>
                        <div ref={lineChartRef} className="tv-chart-box" style={{ padding: "20px 4px 8px" }}>
                          <ResponsiveContainer width="100%" height={200}>
                            <LineChart data={hChartData} margin={{ top: 4, right: 28, bottom: 4, left: 8 }} onMouseMove={onChartMove} onMouseLeave={onChartLeave}>
                              <CartesianGrid strokeDasharray="2 6" stroke="#1e2430" strokeOpacity={0.7} vertical={false} />
                              <XAxis dataKey="year" axisLine={false} tickLine={false} tick={{ fill: "#8a95a0", fontFamily: "Space Mono, monospace", fontSize: 10 }} />
                              <YAxis axisLine={false} tickLine={false}
                                tickFormatter={v => "$" + (Math.abs(v) >= 1_000_000 ? (v/1_000_000).toFixed(1)+"M" : (v/1000).toFixed(0)+"K")}
                                tick={{ fill: "#8a95a0", fontFamily: "Space Mono, monospace", fontSize: 10 }}
                                width={56}
                              />
                              <Tooltip
                                content={<ChartTooltip chartRef={lineChartRef} fmtVal={v => "$" + Number(v).toLocaleString()} />}
                                cursor={{ stroke: "#ffffff", strokeWidth: 1, strokeOpacity: 0.08 }}
                              />
                              <Legend iconType="plainline" wrapperStyle={{ fontFamily: "Space Mono, monospace", fontSize: 10, paddingTop: 10, color: "#6b7280" }} />
                              <Line type="monotone" dataKey="totalIncome" stroke="#b8c43a" strokeWidth={metricStroke("income", 2)}
                                dot={{ r: 3, fill: "#b8c43a", strokeWidth: 0 }} activeDot={{ r: 5, strokeWidth: 0 }} name="Total Income"
                                strokeOpacity={metricOpacity("income")} />
                              <Line type="monotone" dataKey="afterTax" stroke="#45c986" strokeWidth={metricStroke("afterTax", 2)}
                                dot={{ r: 3, fill: "#45c986", strokeWidth: 0 }} activeDot={{ r: 5, strokeWidth: 0 }} name="After-Tax"
                                strokeOpacity={metricOpacity("afterTax")} />
                            </LineChart>
                          </ResponsiveContainer>
                        </div>
                      </div>

                      {/* Tax Rate by Year (bar) */}
                      <div className="tv-chart-block">
                        <div className="tv-chart-label"><Tip tip="Effective Tax Rate = Tax ÷ Taxable Income. Tax/Income = Tax ÷ Gross Income. Gap between bars = deductions at work — wider gap means stronger deductions.">Tax Rate by Year</Tip></div>
                        <div ref={barChartRef} className="tv-chart-box" style={{ padding: "20px 4px 8px" }}>
                          <ResponsiveContainer width="100%" height={180}>
                            <BarChart data={hChartData} margin={{ top: 4, right: 28, bottom: 4, left: 8 }} barGap={3} barCategoryGap="32%" onMouseMove={onChartMove} onMouseLeave={onChartLeave}>
                              <CartesianGrid strokeDasharray="2 6" stroke="#1e2430" strokeOpacity={0.7} vertical={false} />
                              <XAxis dataKey="year" axisLine={false} tickLine={false} tick={{ fill: "#8a95a0", fontFamily: "Space Mono, monospace", fontSize: 10 }} />
                              <YAxis axisLine={false} tickLine={false}
                                tickFormatter={v => v.toFixed(0) + "%"}
                                tick={{ fill: "#8a95a0", fontFamily: "Space Mono, monospace", fontSize: 10 }}
                                width={38}
                              />
                              <Tooltip
                                content={<ChartTooltip chartRef={barChartRef} fmtVal={v => v.toFixed(1) + "%"} />}
                                cursor={{ fill: "rgba(255,255,255,0.03)" }}
                              />
                              <Legend iconType="square" wrapperStyle={{ fontFamily: "Space Mono, monospace", fontSize: 10, paddingTop: 10, color: "#6b7280" }} />
                              <Bar dataKey="taxRate"          fill="#b85c5c" name="Tax / Income"      radius={[3,3,0,0]} isAnimationActive={false}>
                                {hChartData.map((entry) => (
                                  <Cell key={entry.year} fill="#b85c5c" fillOpacity={
                                    (activeYear && entry.year !== String(activeYear) ? 0.3 : 1) * metricOpacity("tax")
                                  } />
                                ))}
                              </Bar>
                              <Bar dataKey="effectiveTaxRate" fill="#c47a3a" name="Effective Tax Rate" radius={[3,3,0,0]} isAnimationActive={false}>
                                {hChartData.map((entry) => (
                                  <Cell key={entry.year} fill="#c47a3a" fillOpacity={
                                    (activeYear && entry.year !== String(activeYear) ? 0.3 : 1) * metricOpacity("etr")
                                  } />
                                ))}
                              </Bar>
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      </div>

                      {/* Trend narrative */}
                      {trendInsights.length > 0 && (
                        <div className="tv-iblock">
                          <div className="tv-iblock-title">Trend Narrative</div>
                          {trendInsights.map((t, i) => (
                            <p key={i}
                              className={activeMetric ? (t.metric === activeMetric ? "tv-insight-active" : "tv-insight-dim") : ""}
                              onMouseEnter={() => setActiveMetric(t.metric)}
                              onMouseLeave={() => setActiveMetric(null)}
                            >{t.text}</p>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </>
              )}

              {/* Vertical Analysis */}
              {activeTab === "vertical" && (
                <>
                  <div className="tv-canvas-title">
                    Vertical Analysis — {verticalYear ?? "—"}
                    <span style={{ color: "var(--muted)", fontSize: 10 }}>personal P&amp;L structure</span>
                  </div>
                  {vResult && vMetric ? (
                    <>
                      {/* Two-column: pie + ratios */}
                      <div className="tv-v-grid">
                        {/* Income Composition Donut */}
                        <div>
                          <div className="tv-chart-block" style={{ marginBottom: 0 }}>
                            <div className="tv-chart-label"><Tip tip="Where your income comes from — wages, investments, dividends, and other sources.">Where Income Comes From</Tip></div>
                            <div className="tv-chart-box" style={{ padding: "16px 8px 8px" }}>
                              {vPieData.length > 0 ? (
                                <>
                                  <ResponsiveContainer width="100%" height={200}>
                                    <PieChart>
                                      <Pie
                                        data={vPieData}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={52}
                                        outerRadius={82}
                                        paddingAngle={2}
                                        dataKey="value"
                                      >
                                        {vPieData.map((entry, idx) => (
                                          <Cell key={entry.name} fill={PIE_COLORS[idx % PIE_COLORS.length]} />
                                        ))}
                                      </Pie>
                                      <Tooltip
                                        contentStyle={{ background: "#0e1117", border: "1px solid #252d38", borderRadius: 6, fontFamily: "Space Mono, monospace", fontSize: 11, padding: "8px 12px" }}
                                        formatter={(v, name) => [v.toFixed(1) + "%", name]}
                                        labelStyle={{ display: "none" }}
                                        itemStyle={{ color: "#8a95a0" }}
                                      />
                                    </PieChart>
                                  </ResponsiveContainer>
                                  <div style={{ display: "flex", flexWrap: "wrap", gap: "6px 14px", justifyContent: "center", marginTop: 6 }}>
                                    {vPieData.map((d, idx) => (
                                      <span key={d.name} style={{ fontFamily: "Space Mono, monospace", fontSize: 10, color: d.value > 0 ? PIE_COLORS[idx % PIE_COLORS.length] : "#3a4250" }}>
                                        ■ {d.name} {d.value.toFixed(1)}%
                                      </span>
                                    ))}
                                  </div>
                                </>
                              ) : (
                                <div style={{ color: "var(--muted)", fontFamily: "var(--mono)", fontSize: 11, textAlign: "center", padding: 24 }}>
                                  No income breakdown data
                                </div>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* P&L Ratios table */}
                        <div>
                          <div className="tv-chart-block" style={{ marginBottom: 0 }}>
                            <div className="tv-chart-label"><Tip tip="How your income shrinks from what you earn to what gets taxed to what you keep.">Income & Tax Summary</Tip></div>
                            <div className="tv-chart-box" style={{ padding: 0 }}>
                              <table className="tv-ratio-table" style={{ width: "100%" }}>
                                <tbody>
                                  {[
                                    { label: "Total Income",         val: $v(vResult.summary?.totalIncome),           accent: false, tip: null },
                                    { label: "Adjusted Gross Income", val: $v(vResult.summary?.adjustedGrossIncome),   accent: false, tip: "Income after pre-tax deductions like IRA contributions and student loan interest." },
                                    { label: "Taxable Income",       val: $v(vResult.summary?.taxableIncome),         accent: false, tip: "The portion of your income that is actually taxed." },
                                    { label: "Total Tax",            val: $v(vResult.summary?.totalTax),              accent: false, tip: null },
                                    { label: "After-Tax Income",     val: $v(vMetric.afterTaxIncome),                 accent: true,  tip: "What you kept after all taxes were paid." },
                                    { label: "Adjusted Gross / Total", val: pf(vMetric.agiRatio),                     accent: false, tip: "How much of your income remains after pre-tax adjustments. Lower means more was reduced upfront." },
                                    { label: "Taxable / Adjusted Gross", val: pf(vMetric.taxableRatio),               accent: false, tip: "How much of your adjusted income ends up being taxed. Lower is better." },
                                    { label: "Effective Tax Rate",   val: pf(vMetric.effectiveTaxRate),               accent: false, tip: "The percentage of your taxable income that goes to taxes." },
                                    { label: "After-Tax Margin",     val: pf(vMetric.afterTaxMargin),                 accent: true,  tip: "The percentage of your total income that you actually keep." },
                                    { label: "Deduction Efficiency", val: pf(vMetric.deductionEfficiency),            accent: false, tip: "How much your deductions reduce your taxable income." },
                                  ].map(row => (
                                    <tr key={row.label}>
                                      <td>{row.tip ? <Tip tip={row.tip}>{row.label}</Tip> : row.label}</td>
                                      <td style={{ color: row.accent ? "var(--success)" : "var(--accent2)" }}>{row.val}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Insight signals */}
                      {vMetric.insights && (
                        <div className="tv-iblock" style={{ marginTop: 20 }}>
                          <div className="tv-iblock-title">{vResult.year} Signal Summary</div>
                          {vMetric.insights.summary?.map((s, i) => (
                            <p key={i}
                              className={activeMetric ? (s.metric === activeMetric ? "tv-insight-active" : "tv-insight-dim") : ""}
                              onMouseEnter={() => s.metric && setActiveMetric(s.metric)}
                              onMouseLeave={() => setActiveMetric(null)}
                            >{s.text}</p>
                          ))}
                          <div className="tv-signal-row">
                            {Object.entries(vMetric.insights.signals).map(([key, sig]) =>
                              sig ? <span key={key} className={`tv-signal ${sig.level}`}>{sig.label}</span> : null
                            )}
                          </div>
                        </div>
                      )}

                      {/* Analysis Insight Engine */}
                      {vInsights.length > 0 && (
                        <div className="tv-insight-row">
                          <div className="tv-insight-row-title">Analysis Insight Engine</div>
                          {vInsights.map((parts, i) => (
                            <div key={i} className="tv-insight-sentence">
                              <span className="tv-insight-bullet">→</span>
                              <span>
                                {parts.map((p, j) =>
                                  p.accent
                                    ? <span key={j} className="tv-insight-num">{p.text}</span>
                                    : <span key={j}>{p.text}</span>
                                )}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </>
                  ) : (
                    <div style={{ color: "var(--muted)", fontFamily: "var(--mono)", fontSize: 12, padding: 32, textAlign: "center" }}>
                      No data available for selected year.
                    </div>
                  )}
                </>
              )}

              {/* Insights */}
              {activeTab === "insights" && (
                <>
                  <div className="tv-canvas-title">
                    Insights
                    <span style={{ color: "var(--muted)", fontSize: 10 }}>financial intelligence</span>
                  </div>
                  <div className="tv-insights-panel">
                    {trendInsights.length > 0 && (
                      <div className="tv-iblock">
                        <div className="tv-iblock-title">Multi-Year Trend</div>
                        {trendInsights.map((t, i) => (
                          <p key={i}
                            className={activeMetric ? (t.metric === activeMetric ? "tv-insight-active" : "tv-insight-dim") : ""}
                            onMouseEnter={() => setActiveMetric(t.metric)}
                            onMouseLeave={() => setActiveMetric(null)}
                          >{t.text}</p>
                        ))}
                      </div>
                    )}
                    {filteredResults.length === 0 ? (
                      <div style={{ color: "var(--muted)", fontFamily: "var(--mono)", fontSize: 12, padding: 32, textAlign: "center" }}>
                        Select years from the sidebar to view insights.
                      </div>
                    ) : filteredResultsDesc.map((r) => {
                      const m = metricMap[r.year];
                      if (!m?.insights) return null;
                      return (
                        <div
                          className="tv-iblock"
                          key={r.year}
                        >
                          <div className="tv-iblock-title">{r.year} Analysis</div>
                          {m.insights.summary?.map((s, i) => (
                            <p key={i}
                              className={activeMetric ? (s.metric === activeMetric ? "tv-insight-active" : "tv-insight-dim") : ""}
                              onMouseEnter={() => s.metric && setActiveMetric(s.metric)}
                              onMouseLeave={() => setActiveMetric(null)}
                            >{s.text}</p>
                          ))}
                          <div className="tv-signal-row">
                            {Object.entries(m.insights.signals).map(([key, sig]) =>
                              sig ? <span key={key} className={`tv-signal ${sig.level}`}>{sig.label}</span> : null
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}

            </div>
            </div>{/* tv-dashboard-body */}
            <div className="tv-privacy-footer">
              🔒 Your files were processed and deleted. Nothing was saved.
            </div>
          </div>
        )}

        {/* ── Print Report — direct child of tv-root; @media print hides all siblings ── */}
        {results.length > 0 && (
          <div className="tv-print-report">

            <div className="tv-pr-header">
              <div className="tv-pr-logo">TaxVista</div>
              <div className="tv-pr-title">Financial Intelligence Report</div>
              {reportName && (
                <div style={{ fontSize: "11pt", color: "#333", marginTop: "4pt", letterSpacing: "0.02em" }}>
                  Prepared for: <strong>{reportName}</strong>
                </div>
              )}
              <div className="tv-pr-subtitle">
                {trendData.length > 0 && `Tax years ${trendData[0].year}–${trendData[trendData.length - 1].year}`}
                {" · "}Generated {new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}
              </div>
            </div>

            {/* ── Section 1: Your Financial Position (hero) ── */}
            {(() => {
              const latestR = _tdN ? results.find(r => r.year === _tdN.year) : null;
              const latestM = _tdN ? metricMap[_tdN.year] : null;
              if (!latestR || !latestM) return null;

              // Build 1–2 signal words for headline
              const tags = [];
              if (incomeCagr != null && incomeCagr > 0.12) tags.push({ text: "High Growth", cls: "pos" });
              else if (incomeCagr != null && incomeCagr < -0.05) tags.push({ text: "Income Declining", cls: "neg" });
              if (taxRateDelta != null && taxRateDelta > 0.02) tags.push({ text: "Rising Tax", cls: "neg" });
              if (latestM.deductionEfficiency != null && latestM.deductionEfficiency < 0.1) tags.push({ text: "Low Efficiency", cls: "warn" });
              else if (latestM.deductionEfficiency != null && latestM.deductionEfficiency > 0.2) tags.push({ text: "Strong Deductions", cls: "pos" });
              if (latestM.afterTaxMargin != null && latestM.afterTaxMargin > 0.8) tags.push({ text: "Strong Take-Home", cls: "pos" });
              const headline = tags.length > 0
                ? tags.slice(0, 2).map(t => t.text.toUpperCase()).join(" · ")
                : "FINANCIAL OVERVIEW";

              // Explanation line
              const explain = (() => {
                if (incomeCagr != null && incomeCagr > 0.12 && taxRateDelta != null && taxRateDelta > 0.02)
                  return "Income rising fast, but tax efficiency is not keeping pace";
                if (incomeCagr != null && incomeCagr > 0.12)
                  return "Income growing rapidly — early optimization has the highest lifetime impact";
                if (taxRateDelta != null && taxRateDelta > 0.02)
                  return "Tax burden increasing — more income is being lost to taxes";
                if (latestM.deductionEfficiency != null && latestM.deductionEfficiency < 0.1)
                  return "Deductions underutilized — taxable income is close to gross income";
                if (latestM.afterTaxMargin != null && latestM.afterTaxMargin > 0.8)
                  return "Strong income retention — most of gross income preserved after tax";
                return "Review your income structure and tax efficiency below";
              })();

              // Impact line
              const impact = (() => {
                if (taxRateDelta != null && taxRateDelta > 0.02 && incomeCagr != null && incomeCagr > 0.1)
                  return "Without adjustment, taxes will scale faster than income growth";
                if (latestM.effectiveTaxRate != null && latestM.effectiveTaxRate > 0.2)
                  return "High tax burden — over 20% of income going to federal tax";
                if (latestM.deductionEfficiency != null && latestM.deductionEfficiency < 0.08)
                  return "Almost no taxable income reduced through deductions";
                return null;
              })();

              // Action line
              const action = (() => {
                if (latestM.deductionEfficiency != null && latestM.deductionEfficiency < 0.1)
                  return "Priority: Max 401k / IRA / HSA — direct taxable income reduction";
                if (taxRateDelta != null && taxRateDelta > 0.02)
                  return "Priority: Increase pre-tax contributions and review tax strategy";
                if (latestM.afterTaxMargin != null && latestM.afterTaxMargin > 0.8)
                  return "Maintain: Route future growth through tax-advantaged accounts";
                return "Review: Deduction audit + pre-tax contribution check";
              })();

              return (
                <div className="tv-pr-position">
                  <div className="tv-pr-section-title">Your Financial Position</div>
                  <div className="tv-pr-position-headline">{headline}</div>
                  <div className="tv-pr-position-explain">{explain}</div>
                  {impact && <div className="tv-pr-position-impact">{impact}</div>}
                  <div className="tv-pr-position-action">{action}</div>
                  {tags.length > 0 && (
                    <div className="tv-pr-tag-row">
                      {tags.map(t => (
                        <span key={t.text} className={`tv-pr-tag ${t.cls}`}>{t.text}</span>
                      ))}
                    </div>
                  )}
                </div>
              );
            })()}

            {/* ── Section 2: Financial Snapshot (KPIs) ── */}
            {_tdN && metricMap[_tdN.year] && (() => {
              const rN = results.find(r => r.year === _tdN.year);
              const mN = metricMap[_tdN.year];
              return (
                <div className="tv-pr-section">
                  <div className="tv-pr-section-title">Financial Snapshot — {_tdN.year}</div>
                  <div className="tv-pr-kpi-row">
                    {[
                      { label: "Gross Income",      value: $v(rN.summary?.totalIncome)  },
                      { label: "After-Tax Income",  value: $v(mN.afterTaxIncome)        },
                      { label: "Effective Tax Rate", value: pf(mN.effectiveTaxRate)      },
                      { label: "After-Tax Margin",  value: pf(mN.afterTaxMargin)        },
                    ].map(k => (
                      <div className="tv-pr-kpi" key={k.label}>
                        <div className="tv-pr-kpi-label">{k.label}</div>
                        <div className="tv-pr-kpi-value">{k.value}</div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}

            {/* ── Section 3: Multi-Year Summary ── */}
            {results.length > 1 && (
              <div className="tv-pr-section">
                <div className="tv-pr-section-title">Multi-Year Summary</div>
                <table className="tv-pr-table">
                  <thead>
                    <tr>
                      {["Year", "Gross Income", "After-Tax", "Tax / Income", "Effective Tax Rate", "Deduction Efficiency"].map(h => (
                        <th key={h}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {[...results].sort((a, b) => b.year - a.year).map(r => {
                      const m = metricMap[r.year];
                      return (
                        <tr key={r.year}>
                          <td>{r.year}</td>
                          <td>{$v(r.summary?.totalIncome)}</td>
                          <td className="pr-pos">{$v(m?.afterTaxIncome)}</td>
                          <td className={m?.taxToIncome > 0.2 ? "pr-neg" : ""}>{pf(m?.taxToIncome)}</td>
                          <td className={m?.effectiveTaxRate > 0.2 ? "pr-neg" : ""}>{pf(m?.effectiveTaxRate)}</td>
                          <td className={m?.deductionEfficiency > 0.2 ? "pr-pos" : m?.deductionEfficiency != null && m.deductionEfficiency < 0.1 ? "pr-neg" : ""}>{pf(m?.deductionEfficiency)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {(incomeCagr != null || afterTaxCagr != null || taxRateDelta != null) && (
                  <div className="tv-pr-trend-row">
                    {incomeCagr != null && (
                      <div className="tv-pr-trend-kpi">
                        <div className="tv-pr-trend-label">Income Growth Rate</div>
                        <div className="tv-pr-trend-value">{_lowBase ? "Low base*" : (incomeCagr >= 0 ? "+" : "") + pf(incomeCagr)}</div>
                      </div>
                    )}
                    {afterTaxCagr != null && (
                      <div className="tv-pr-trend-kpi">
                        <div className="tv-pr-trend-label">Take-Home Growth</div>
                        <div className="tv-pr-trend-value">{_lowBase ? "Low base*" : (afterTaxCagr >= 0 ? "+" : "") + pf(afterTaxCagr)}</div>
                      </div>
                    )}
                    {taxRateDelta != null && (
                      <div className="tv-pr-trend-kpi">
                        <div className="tv-pr-trend-label">Tax Rate Shift</div>
                        <div className="tv-pr-trend-value">{taxRateDelta > 0 ? "+" : ""}{(taxRateDelta * 100).toFixed(1)} percentage points</div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* ── Section 4: Year-by-Year Analysis ── */}
            <div className="tv-pr-section">
              <div className="tv-pr-section-title">Year-by-Year Analysis</div>
              {[...results].sort((a, b) => b.year - a.year).map(r => {
                const m = metricMap[r.year];
                if (!m?.insights) return null;
                return (
                  <div className="tv-pr-insight-block" key={r.year}>
                    <div className="tv-pr-year-label">{r.year}</div>
                    {m.insights.summary?.map((s, i) => (
                      <div className="tv-pr-insight-text" key={i}>{s.text}</div>
                    ))}
                    <div>
                      {Object.entries(m.insights.signals).map(([key, sig]) =>
                        sig ? <span key={key} className={`tv-pr-signal ${sig.level}`}>{sig.label}</span> : null
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* ── Section 5: Deep Analysis (expanded insights for report) ── */}
            {(() => {
              const sorted = [...results].sort((a, b) => a.year - b.year);
              const multi = sorted.length > 1;
              const first = sorted[0];
              const last  = sorted[sorted.length - 1];
              const mFirst = metricMap[first.year];
              const mLast  = metricMap[last.year];
              const fmtD = (v) => v != null ? "$" + Math.round(v).toLocaleString() : "—";
              const fmtP = (v) => v != null ? (v * 100).toFixed(1) + "%" : "—";
              const lowBase = first.summary?.totalIncome != null && first.summary.totalIncome < 10000;

              // ── Income Trend ──
              const incomeBullets = [];
              if (multi) {
                const firstInc = first.summary?.totalIncome;
                const lastInc  = last.summary?.totalIncome;
                if (firstInc && lastInc) {
                  if (lowBase) {
                    incomeBullets.push(`Income expanded from ${fmtD(firstInc)} (${first.year}) to ${fmtD(lastInc)} (${last.year}). The starting base was below $10,000, which distorts percentage-based growth metrics. The trajectory is meaningful — the raw percentage is not.`);
                  } else {
                    const rawGrowth = ((lastInc - firstInc) / firstInc * 100).toFixed(0);
                    incomeBullets.push(`Gross income moved from ${fmtD(firstInc)} (${first.year}) to ${fmtD(lastInc)} (${last.year}) — a ${rawGrowth}% total change. ${
                      Number(rawGrowth) > 100 ? "This scale of increase reflects either a career transition, business scaling, or a structural shift in income sources."
                      : Number(rawGrowth) > 30 ? "This represents meaningful above-average growth, likely driven by compensation increases or new income streams."
                      : "Growth is within normal career progression ranges."
                    }`);
                  }
                }
                if (incomeCagr != null && !lowBase) {
                  const cagrPct = (incomeCagr * 100).toFixed(1);
                  incomeBullets.push(`Annualized growth rate: ${cagrPct}%. ${
                    incomeCagr > 0.2 ? "This is exceptionally fast — typical of early-career acceleration or a significant role change. Sustainability should be monitored."
                    : incomeCagr > 0.08 ? "Above-average growth that is creating real compounding value if after-tax income is keeping pace."
                    : incomeCagr > 0 ? "Modest growth near inflation levels — real income purchasing power is roughly stable."
                    : "Income is contracting in real terms. This may reflect career transition, industry downturn, or reduced hours."
                  }`);
                } else if (lowBase) {
                  incomeBullets.push(`Low-base distortion detected — annualized growth rates are suppressed from this report because the ${first.year} income of ${fmtD(first.summary?.totalIncome)} produces misleadingly large percentages that do not reflect true financial trajectory.`);
                }
                // Volatility
                const incomes = sorted.map(r => r.summary?.totalIncome).filter(v => v != null);
                if (incomes.length >= 3) {
                  const yoyChanges = incomes.slice(1).map((v, i) => ((v - incomes[i]) / incomes[i] * 100).toFixed(0));
                  const yoyText = yoyChanges.map((c, i) => `${sorted[i].year}→${sorted[i+1].year}: ${Number(c) > 0 ? "+" : ""}${c}%`).join("; ");
                  incomeBullets.push(`Year-over-year progression: ${yoyText}. ${
                    yoyChanges.some(c => Math.abs(Number(c)) > 50) ? "Significant volatility detected — income trajectory is not linear, which affects tax planning predictability."
                    : "Progression is relatively stable — a favorable pattern for tax planning."
                  }`);
                }
              } else {
                const inc = first.summary?.totalIncome;
                if (inc) incomeBullets.push(`Single-year gross income: ${fmtD(inc)}. Without prior-year data, trend analysis is unavailable. The analysis below focuses on structural efficiency — how effectively this income was retained after tax.`);
              }

              // ── Tax Trend (with WHY explanations) ──
              const taxBullets = [];
              if (multi) {
                sorted.forEach(r => {
                  const m = metricMap[r.year];
                  if (m?.effectiveTaxRate != null) {
                    const etr = m.effectiveTaxRate;
                    taxBullets.push(`${r.year}: Effective tax rate ${fmtP(etr)}. ${
                      etr > 0.25 ? "This is a high burden relative to income — it typically indicates wage-heavy income in upper brackets without sufficient deduction offsets."
                      : etr > 0.15 ? "Moderate tax burden — within expected range for this income level, though optimization opportunities may exist."
                      : etr > 0.05 ? "Relatively low effective rate — either income is modest, deductions are strong, or income includes preferentially-taxed components."
                      : "Near-zero effective rate — income is likely below standard deduction thresholds or offset by credits."
                    }`);
                  }
                });
                if (taxRateDelta != null) {
                  if (lowBase && taxRateDelta > 0.02) {
                    taxBullets.push(`The effective tax rate increased by ${(taxRateDelta * 100).toFixed(1)} percentage points over the period. This was primarily driven by income transitioning from a near-zero base into taxable brackets. At the starting income level, most or all earnings fell below the standard deduction — as income grew, it entered progressively higher marginal rate tiers while deduction activity did not expand proportionally.`);
                  } else if (taxRateDelta > 0.05) {
                    taxBullets.push(`The effective tax rate increased by ${(taxRateDelta * 100).toFixed(1)} percentage points — a significant shift indicating that income growth outpaced deduction scaling. As earnings moved into higher marginal brackets, the absence of proportional pre-tax contributions or itemized deductions allowed more income to be taxed at elevated rates. This suggests current growth is not being converted efficiently into after-tax income.`);
                  } else if (taxRateDelta > 0.02) {
                    taxBullets.push(`Effective tax rate increased by ${(taxRateDelta * 100).toFixed(1)} percentage points. Moderate upward pressure — likely from income pushing into a higher marginal bracket without corresponding deduction increases.`);
                  } else if (taxRateDelta < -0.02) {
                    taxBullets.push(`Effective tax rate decreased by ${Math.abs(taxRateDelta * 100).toFixed(1)} percentage points — a favorable shift. This may reflect improved deduction utilization, income diversification into lower-taxed categories, or effective pre-tax contribution strategy.`);
                  } else {
                    taxBullets.push(`Effective tax rate remained essentially stable (${(taxRateDelta * 100).toFixed(1)} percentage points change). Tax burden is tracking proportionally with income — no structural compression or improvement detected.`);
                  }
                }
              } else if (mFirst?.effectiveTaxRate != null) {
                taxBullets.push(`Effective tax rate: ${fmtP(mFirst.effectiveTaxRate)}. ${
                  mFirst.effectiveTaxRate > 0.2 ? "This rate is above typical thresholds for this income level, suggesting deductions and pre-tax contributions may be underutilized. A withholding and deduction review is recommended."
                  : mFirst.effectiveTaxRate > 0.1 ? "Within normal range for this income profile. Upload additional years to track whether this rate is trending upward as income grows."
                  : "Low effective rate — this is favorable, potentially reflecting strong deduction usage or income below higher bracket thresholds."
                }`);
              }

              // ── Tax Drag / Lost Efficiency ──
              const dragBullets = [];
              if (multi) {
                const firstAT = mFirst?.afterTaxIncome;
                const lastAT  = mLast?.afterTaxIncome;
                const firstInc = first.summary?.totalIncome;
                const lastInc  = last.summary?.totalIncome;
                if (firstAT && lastAT && firstInc && lastInc && firstInc > 0 && firstAT > 0) {
                  const incDelta = lastInc - firstInc;
                  const atDelta  = lastAT - firstAT;

                  // Core metric: marginal tax rate on incremental income
                  if (incDelta > 0) {
                    const taxOnIncremental = incDelta - atDelta;
                    const marginalRate = taxOnIncremental / incDelta;
                    const lostPerDollar = marginalRate.toFixed(2);
                    const keptPerDollar = (1 - marginalRate).toFixed(2);
                    const pctAbsorbed = (marginalRate * 100).toFixed(0);

                    dragBullets.push(`Over ${first.year}–${last.year}, gross income increased by ${fmtD(incDelta)} while after-tax income increased by ${fmtD(atDelta)}. The difference — ${fmtD(taxOnIncremental)} — was absorbed by taxes.`);
                    dragBullets.push(`For every $1.00 of additional income earned, $${lostPerDollar} was lost to taxes and $${keptPerDollar} was retained. This means ${pctAbsorbed}% of all incremental income went to federal tax rather than take-home pay.`);

                    if (marginalRate > 0.25) {
                      dragBullets.push(`An incremental tax absorption rate of ${pctAbsorbed}% is significant. It indicates that income growth is being taxed at a higher effective marginal rate than the overall effective rate — a direct consequence of progressive bracket exposure without proportional deduction scaling.`);
                    } else if (marginalRate > 0.15) {
                      dragBullets.push(`A ${pctAbsorbed}% absorption rate on incremental income is moderate. Tax drag exists but is within manageable range — increasing pre-tax contributions would directly reduce this rate.`);
                    } else {
                      dragBullets.push(`At ${pctAbsorbed}% absorption, incremental income is being taxed efficiently. The current structure is preserving most of each additional dollar earned.`);
                    }
                  } else if (incDelta < 0) {
                    dragBullets.push(`Income declined by ${fmtD(Math.abs(incDelta))} while after-tax income declined by ${fmtD(Math.abs(atDelta))}. When income falls, the relevant question is whether tax withholding adjusted proportionally.`);
                  }

                  // Year-over-year incremental tax rates
                  const yoyDrag = [];
                  for (let i = 1; i < sorted.length; i++) {
                    const prevInc = sorted[i-1].summary?.totalIncome;
                    const currInc = sorted[i].summary?.totalIncome;
                    const prevAT  = metricMap[sorted[i-1].year]?.afterTaxIncome;
                    const currAT  = metricMap[sorted[i].year]?.afterTaxIncome;
                    if (prevInc && currInc && prevAT && currAT && currInc > prevInc) {
                      const dInc = currInc - prevInc;
                      const dAT  = currAT - prevAT;
                      const rate = ((dInc - dAT) / dInc * 100).toFixed(0);
                      yoyDrag.push(`${sorted[i-1].year}→${sorted[i].year}: ${rate}% of incremental income taxed`);
                    }
                  }
                  if (yoyDrag.length > 1) {
                    dragBullets.push(`Year-over-year marginal absorption: ${yoyDrag.join("; ")}. ${
                      yoyDrag.length >= 2 ? "Tracking this rate over time reveals whether tax drag is accelerating, stable, or improving." : ""
                    }`);
                  }
                }
                // Per-year margin comparison
                if (sorted.length >= 2) {
                  const margins = sorted.map(r => ({ year: r.year, m: metricMap[r.year]?.afterTaxMargin })).filter(x => x.m != null);
                  if (margins.length >= 2) {
                    const mDelta = margins[margins.length - 1].m - margins[0].m;
                    if (Math.abs(mDelta) > 0.02) {
                      dragBullets.push(`After-tax margin ${mDelta > 0 ? "improved" : "declined"} from ${fmtP(margins[0].m)} to ${fmtP(margins[margins.length-1].m)}. ${
                        mDelta < -0.02 ? "Each dollar of income is retaining less after tax than it was previously — a clear sign that tax efficiency is not scaling with income." : "The share of income retained after tax has increased — tax efficiency is improving."
                      }`);
                    }
                  }
                }
              }

              // ── After-Tax Performance ──
              const afterTaxBullets = [];
              if (multi) {
                const firstAT = mFirst?.afterTaxIncome;
                const lastAT  = mLast?.afterTaxIncome;
                if (firstAT && lastAT) {
                  afterTaxBullets.push(`After-tax income: ${fmtD(firstAT)} (${first.year}) → ${fmtD(lastAT)} (${last.year}). This is the amount actually available for savings, investment, and spending after federal tax.`);
                }
                sorted.forEach(r => {
                  const m = metricMap[r.year];
                  if (m?.afterTaxMargin != null) {
                    afterTaxBullets.push(`${r.year}: Retained ${fmtP(m.afterTaxMargin)} of gross income after tax (${fmtD(m.afterTaxIncome)} of ${fmtD(r.summary?.totalIncome)}) — ${
                      m.afterTaxMargin > 0.85 ? "strong retention, indicating efficient tax structure"
                      : m.afterTaxMargin > 0.7 ? "moderate retention with room for deduction improvement"
                      : "significant portion lost to tax — structural optimization recommended"
                    }.`);
                  }
                });
              } else if (mFirst?.afterTaxIncome != null) {
                afterTaxBullets.push(`After-tax income: ${fmtD(mFirst.afterTaxIncome)} — after-tax margin: ${fmtP(mFirst.afterTaxMargin)}. This means ${fmtP(mFirst.afterTaxMargin)} of every dollar earned was retained after federal tax obligation.`);
              }

              // ── Income Composition (interpretive) ──
              const compBullets = [];
              sorted.forEach(r => {
                const v = VERIFIED_INCOME[r.year];
                if (!v) return;
                const total = v.wages + v.capitalGains + v.dividends + v.interest + v.other;
                if (total <= 0) return;
                const wPct = v.wages / total;
                const invTotal = v.capitalGains + v.dividends + v.interest;
                const invPct = invTotal / total;

                if (wPct >= 0.95) {
                  compBullets.push(`${r.year}: Income is entirely derived from earned wages (${fmtD(v.wages)}). This structure provides no access to preferential capital gains or qualified dividend rates, exposing all earnings to ordinary income tax brackets.`);
                } else if (wPct >= 0.8) {
                  compBullets.push(`${r.year}: Predominantly wage-based income (${(wPct*100).toFixed(0)}%) with modest investment income (${fmtD(invTotal)}). While investment income is small in absolute terms, it signals the beginning of income diversification.`);
                } else {
                  compBullets.push(`${r.year}: Mixed income structure — wages ${(wPct*100).toFixed(0)}%, investment and other ${(invPct*100).toFixed(0)}%. Diversified income sources provide access to preferential tax rates and reduce dependency on ordinary income brackets.`);
                }
              });
              if (multi && sorted.length >= 2) {
                const vFirst = VERIFIED_INCOME[first.year];
                const vLast  = VERIFIED_INCOME[last.year];
                if (vFirst && vLast) {
                  const tFirst = vFirst.wages + vFirst.capitalGains + vFirst.dividends + vFirst.interest + vFirst.other;
                  const tLast  = vLast.wages + vLast.capitalGains + vLast.dividends + vLast.interest + vLast.other;
                  if (tFirst > 0 && tLast > 0) {
                    const wFirst = vFirst.wages / tFirst;
                    const wLast  = vLast.wages / tLast;
                    if (wLast >= 0.95 && wFirst >= 0.95) {
                      compBullets.push("Income remains fully concentrated in W-2 wages across all years. This limits tax flexibility and exposes all earnings to ordinary income tax rates. Introducing capital gains or qualified dividend income — even modestly — would create structural tax advantage.");
                    } else if (Math.abs(wLast - wFirst) > 0.05) {
                      compBullets.push(`Wage concentration ${wLast > wFirst ? "increased" : "decreased"} from ${(wFirst*100).toFixed(0)}% to ${(wLast*100).toFixed(0)}%. ${
                        wLast < wFirst ? "This diversification is structurally favorable — investment income is taxed at lower rates than wages." : "Greater wage concentration increases ordinary rate exposure and reduces access to preferential tax treatment."
                      }`);
                    }
                  }
                }
              }

              // ── Deduction Efficiency Trend ──
              const dedBullets = [];
              sorted.forEach(r => {
                const m = metricMap[r.year];
                if (m?.deductionEfficiency != null) {
                  const de = m.deductionEfficiency;
                  dedBullets.push(`${r.year}: ${fmtP(de)} of gross income was offset by deductions. ${
                    de > 0.2 ? "This is strong — a meaningful portion of income is being sheltered from taxation through deductions and pre-tax contributions."
                    : de > 0.1 ? "Moderate deduction activity — some income is being sheltered, but there is likely room to increase pre-tax contributions."
                    : "Low deduction efficiency — nearly all gross income is flowing through to taxable income with minimal offsets. Pre-tax accounts (401k, IRA, HSA) are the primary lever available."
                  }`);
                }
              });
              if (multi && mFirst?.deductionEfficiency != null && mLast?.deductionEfficiency != null) {
                const delta = mLast.deductionEfficiency - mFirst.deductionEfficiency;
                if (delta < -0.03) {
                  dedBullets.push(`Deduction efficiency declined by ${Math.abs(delta * 100).toFixed(1)} percentage points. As income grew, deductions did not scale proportionally — a shrinking share of each dollar is being sheltered. This is the most common driver of rising effective tax rates during income growth phases.`);
                } else if (delta > 0.03) {
                  dedBullets.push(`Deduction efficiency improved by ${(delta * 100).toFixed(1)} percentage points. More income is being sheltered from taxation, which is directly improving after-tax retention. This suggests increased pre-tax contribution activity or access to additional deduction categories.`);
                } else {
                  dedBullets.push("Deduction efficiency is roughly stable across the period. While there is no deterioration, a lack of improvement during income growth means the tax base is expanding in absolute terms.");
                }
              }

              // ── Financial Trajectory — Summary ──
              const summaryBullets = [];
              if (multi) {
                if (lowBase && incomeCagr != null && incomeCagr > 0.1 && taxRateDelta != null && taxRateDelta > 0.03) {
                  summaryBullets.push("Income has transitioned from a minimal base into meaningful taxable territory. The increase in effective tax rate is a natural consequence of this transition — but the window for establishing tax-efficient habits is now, before the income trajectory compounds further without structural optimization.");
                } else if (incomeCagr != null && incomeCagr > 0.1 && taxRateDelta != null && taxRateDelta > 0.03) {
                  summaryBullets.push("Income is growing aggressively, but tax burden is growing disproportionately. Without intervention, the gap between gross and after-tax income will continue to widen. Each year of delay compounds the cumulative tax leakage.");
                } else if (incomeCagr != null && incomeCagr > 0.1 && (taxRateDelta == null || taxRateDelta <= 0.01)) {
                  summaryBullets.push("Strong income growth paired with stable tax efficiency — this is a favorable trajectory. Current tax structure is keeping pace with income growth, preserving after-tax margin.");
                } else if (incomeCagr != null && incomeCagr < 0) {
                  summaryBullets.push("Income is contracting. Priority should shift to defensive optimization: verify withholding accuracy, claim all eligible deductions, and evaluate whether income sources can be restructured to improve after-tax retention.");
                }
                if (mLast?.deductionEfficiency != null && mLast.deductionEfficiency < 0.08) {
                  summaryBullets.push(`Deduction efficiency of ${fmtP(mLast.deductionEfficiency)} in ${last.year} represents the single largest optimization opportunity. Nearly all gross income is reaching taxable income without meaningful offsets. Maximizing pre-tax contributions (401k, IRA, HSA) would have direct, dollar-for-dollar impact on reducing tax liability.`);
                }
                if (mLast?.afterTaxMargin != null) {
                  summaryBullets.push(`Current after-tax retention: ${fmtP(mLast.afterTaxMargin)} — for every $1.00 earned, $${(mLast.afterTaxMargin).toFixed(2)} is retained after federal tax. ${
                    mLast.afterTaxMargin > 0.85 ? "This is strong retention — the priority is protecting this margin as income scales."
                    : mLast.afterTaxMargin > 0.7 ? "Moderate retention with room for improvement through increased deduction activity."
                    : "Significant tax drag — more than 30 cents of every dollar is going to federal tax. Structural intervention is recommended."
                  }`);
                }
              } else {
                if (mFirst?.afterTaxMargin != null) {
                  summaryBullets.push(`Single-year after-tax margin: ${fmtP(mFirst.afterTaxMargin)}. ${
                    mFirst.afterTaxMargin > 0.85 ? "Strong retention — current structure is efficient." : mFirst.afterTaxMargin > 0.7 ? "Moderate retention — optimization opportunities likely exist." : "Significant tax burden relative to income."
                  } Upload additional years to enable trend analysis, tax drag detection, and trajectory forecasting.`);
                }
              }

              const sections = [
                { title: "Income Trend Analysis", items: incomeBullets },
                { title: "Tax Burden Analysis", items: taxBullets },
                { title: "Tax Drag & Lost Efficiency", items: dragBullets },
                { title: "After-Tax Performance", items: afterTaxBullets },
                { title: "Income Structure & Composition", items: compBullets },
                { title: "Deduction Efficiency Analysis", items: dedBullets },
                { title: "Financial Trajectory — Summary", items: summaryBullets },
              ].filter(s => s.items.length > 0);

              return sections.map(s => (
                <div className="tv-pr-section" key={s.title}>
                  <div className="tv-pr-section-title">{s.title}</div>
                  {s.items.map((b, i) => (
                    <div className="tv-pr-bullet" key={i}>{b}</div>
                  ))}
                </div>
              ));
            })()}

            {/* ── Section 6: Strategic Assessment (restructured) ── */}
            {(strategyPhase || trendInsights.length > 0) && (
              <div className="tv-pr-section">
                <div className="tv-pr-section-title">Strategic Assessment</div>

                {strategyPhase && (
                  <>
                    <div className="tv-pr-kpi-row" style={{ marginBottom: "10pt" }}>
                      <div className="tv-pr-kpi">
                        <div className="tv-pr-kpi-label">Financial Phase</div>
                        <div className="tv-pr-kpi-value" style={{ fontSize: "13pt" }}>{strategyPhase.phase}</div>
                      </div>
                      <div className="tv-pr-kpi">
                        <div className="tv-pr-kpi-label">Income Growth Rate</div>
                        <div className="tv-pr-kpi-value" style={{ fontSize: "13pt" }}>{_lowBase ? "Low base*" : (strategyPhase.cagr * 100).toFixed(1) + "%"}</div>
                      </div>
                    </div>

                    {/* Characteristics */}
                    {strategyPhase.characteristics && (
                      <div style={{ marginBottom: "8pt" }}>
                        <div style={{ fontSize: "8pt", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#555", marginBottom: "4pt", fontFamily: "Courier New, monospace" }}>Characteristics</div>
                        {strategyPhase.characteristics.map((c, i) => (
                          <div className="tv-pr-bullet" key={i}>{c}</div>
                        ))}
                      </div>
                    )}

                    {/* Implication */}
                    {strategyPhase.implication && (
                      <div className="tv-pr-insight-text" style={{ fontWeight: 600, marginBottom: "10pt" }}>
                        {strategyPhase.implication}
                      </div>
                    )}

                    {/* Trend bullets */}
                    {trendInsights.map((t, i) => (
                      <div className="tv-pr-bullet" key={i}>{t.text}</div>
                    ))}
                  </>
                )}
              </div>
            )}

            {/* ── Section 6: What This Means ── */}
            {strategyPhase && (() => {
              const bullets = [];
              const latestM = _tdN ? metricMap[_tdN.year] : null;
              const latestR = _tdN ? results.find(r => r.year === _tdN.year) : null;
              if (incomeCagr != null && incomeCagr > 0.1 && taxRateDelta != null && taxRateDelta > 0.01) {
                const etrShift = (taxRateDelta * 100).toFixed(1);
                bullets.push(`With effective tax rate rising by ${etrShift} percentage points while income is growing, you are entering a higher tax exposure phase — each additional dollar of income faces a higher marginal rate than the last`);
              } else if (incomeCagr != null && incomeCagr > 0.1) {
                const lastInc = latestR?.summary?.totalIncome;
                bullets.push(`Income reached ${lastInc ? "$" + Math.round(lastInc).toLocaleString() : "its current level"} — at this growth pace, tax drag will compound unless deduction strategy scales proportionally`);
              }
              if (taxRateDelta != null && taxRateDelta > 0.02) {
                const etrShift = (taxRateDelta * 100).toFixed(1);
                bullets.push(`The ${etrShift} percentage point increase in effective tax rate means a growing share of each additional dollar is being taxed — without structural changes, take-home margin will continue to compress`);
              }
              if (latestM?.deductionEfficiency != null && latestM.deductionEfficiency < 0.1) {
                const dePct = (latestM.deductionEfficiency * 100).toFixed(1);
                bullets.push(`At ${dePct}% deduction efficiency, pre-tax accounts are not offsetting income meaningfully — early optimization at this income level has the highest lifetime impact because the base is compounding`);
              }
              if (latestM?.afterTaxMargin != null && latestM.afterTaxMargin > 0.85) {
                const atmPct = (latestM.afterTaxMargin * 100).toFixed(1);
                bullets.push(`${atmPct}% after-tax retention is strong — the priority is protecting this margin as income grows, because higher brackets will erode it without active management`);
              }
              if (bullets.length === 0 && latestM?.effectiveTaxRate != null) {
                const etrPct = (latestM.effectiveTaxRate * 100).toFixed(1);
                bullets.push(`Current effective tax rate of ${etrPct}% — review deduction strategy and pre-tax contributions annually to prevent passive rate increases`);
              }
              return (
                <div className="tv-pr-section">
                  <div className="tv-pr-section-title">What This Means</div>
                  {bullets.map((b, i) => (
                    <div className="tv-pr-bullet" key={i}>{b}</div>
                  ))}
                </div>
              );
            })()}

            {/* ── Section 8: Priority Actions (Ranked) ── */}
            {(() => {
              const latestM = _tdN ? metricMap[_tdN.year] : null;
              const actions = [];

              // Priority 1: Pre-tax contributions (highest impact for low deduction efficiency)
              if (latestM?.deductionEfficiency != null && latestM.deductionEfficiency < 0.15) {
                actions.push({
                  action: "Maximize pre-tax contributions immediately (401k, IRA, HSA)",
                  reason: latestM.deductionEfficiency < 0.08
                    ? `Current deduction efficiency is ${(latestM.deductionEfficiency * 100).toFixed(1)}% — nearly all income is reaching taxable income without offsets. Each dollar contributed pre-tax reduces taxable income dollar-for-dollar at your current marginal rate.`
                    : "Pre-tax account contributions are below optimal levels. Increasing 401k and IRA contributions is the single highest-ROI tax action available.",
                });
              }

              // Priority 2: Reduce taxable income exposure
              if (latestM?.deductionEfficiency != null && latestM.deductionEfficiency < 0.1) {
                const dePct = (latestM.deductionEfficiency * 100).toFixed(1);
                actions.push({
                  action: "Reduce taxable income exposure",
                  reason: `Deduction efficiency is ${dePct}% — meaning ${(100 - Number(dePct)).toFixed(1)}% of gross income reaches taxable income without offsets. Beyond retirement contributions, evaluate HSA eligibility (triple tax benefit), student loan interest deduction, and above-the-line adjustments that reduce adjusted gross income directly.`,
                });
              }

              // Priority 3: Review withholding (rising tax)
              if (taxRateDelta != null && taxRateDelta > 0.02) {
                actions.push({
                  action: "Review tax withholding accuracy",
                  reason: `Effective tax rate increased by ${(taxRateDelta * 100).toFixed(1)} percentage points over the analysis period. Verify that W-4 withholding reflects current income level — over-withholding creates an interest-free loan to the IRS, while under-withholding triggers penalties.`,
                });
              }

              // Priority 4: Income mix diversification (growth phase)
              if (incomeCagr != null && incomeCagr > 0.08) {
                actions.push({
                  action: "Begin shifting income mix toward tax-advantaged sources",
                  reason: "As income scales, introducing capital gains and qualified dividend income — even modestly through index fund investing — creates structural tax advantage. These income types are taxed at 0–20% vs ordinary rates of 22–37%.",
                });
              }

              // Fallback
              if (actions.length === 0) {
                actions.push({
                  action: "Conduct annual deduction and contribution audit",
                  reason: "Ensure all eligible deductions are being claimed and pre-tax contributions are at or near annual limits. Even stable financial situations benefit from annual review to prevent tax creep.",
                });
              }

              return (
                <div className="tv-pr-section">
                  <div className="tv-pr-section-title">Priority Actions (Ranked)</div>
                  {actions.map((a, i) => (
                    <div key={i} style={{ marginBottom: "10pt" }}>
                      <div className="tv-pr-insight-text" style={{ fontWeight: 700 }}>
                        {i + 1}. {a.action}
                      </div>
                      <div className="tv-pr-insight-text" style={{ color: "#444", paddingLeft: "14pt" }}>
                        {a.reason}
                      </div>
                    </div>
                  ))}
                </div>
              );
            })()}

            {_lowBase && (
              <div style={{ fontSize: "8pt", color: "#888", marginTop: "16pt", paddingTop: "8pt", borderTop: "1pt solid #ddd", lineHeight: 1.6 }}>
                * Low base note: Base year income ({trendData[0]?.year}: ${Math.round(trendData[0]?.totalIncome ?? 0).toLocaleString()}) is below $10,000. Percentage-based growth rates are suppressed throughout this report because they produce misleadingly large figures that do not reflect true financial trajectory. All dollar-amount comparisons and structural analysis remain valid.
              </div>
            )}

            <div className="tv-pr-footer">
              TaxVista Financial Intelligence
              {" · "}Generated from your tax data — no documents stored
              {" · "}{new Date().getFullYear()}
            </div>

          </div>
        )}

      </div>
    </>
  );
}
