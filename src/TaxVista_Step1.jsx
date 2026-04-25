import { useState, useRef, useEffect } from "react";
import { calculateMetrics } from "./utils/calculateMetrics";
import {
  LineChart, Line, BarChart, Bar,
  AreaChart, Area,
  PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer,
} from "recharts";

const PIE_COLORS = ["#b8c43a", "#45c986", "#5b9bd4", "#c96888", "#8878c8"];

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

  * { user-select: none; -webkit-user-select: none; cursor: default; }
  input, button, select, textarea, .tv-drop-zone { cursor: pointer; }
  input, textarea { user-select: text; -webkit-user-select: text; cursor: text; }

  /* ── Content selection: allow copy/paste on analysis screens ── */
  .tv-dashboard, .tv-dashboard *,
  .tv-strategy-bar, .tv-strategy-bar *,
  .tv-print-report, .tv-print-report * {
    user-select: text;
    -webkit-user-select: text;
    -moz-user-select: text;
    cursor: text;
  }

  /* Re-apply none + default cursor on interactive controls inside dashboard */
  .tv-dashboard button,
  .tv-dashboard .tv-nav-btn,
  .tv-dashboard .tv-year-pill,
  .tv-dashboard .tv-export-btn,
  .tv-dashboard .tv-vpicker,
  .tv-dashboard .tv-vpicker *,
  .tv-strategy-bar button,
  .tv-strategy-bar .tv-strategy-badge {
    user-select: none;
    -webkit-user-select: none;
    cursor: pointer;
  }

  /* Charts should use default cursor (not text I-beam) on SVG/canvas areas */
  .tv-dashboard svg, .tv-dashboard canvas,
  .tv-dashboard .recharts-wrapper, .tv-dashboard .recharts-wrapper * {
    cursor: default;
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
    position: relative;
    cursor: default;
    border-bottom: 1px dotted rgba(255,255,255,0.35);
    vertical-align: baseline;
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
    will-change: transform;
    transform: translate(-50%, -100%) translateZ(0);
    opacity: 1;
  }

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

  /* ── Wizard ── */
  .tv-wiz { width: 100%; max-width: 700px; }
  .tv-wiz-progress {
    display: flex; gap: 8px; margin-bottom: 28px; justify-content: center;
  }
  .tv-wiz-dot {
    width: 10px; height: 10px; border-radius: 50%;
    background: var(--border); transition: background 0.2s;
  }
  .tv-wiz-dot.active { background: var(--accent); }
  .tv-wiz-dot.done   { background: var(--accent2); }
  .tv-wiz-step-title {
    font-family: var(--mono); font-size: 12px; font-weight: 700;
    letter-spacing: 0.1em; text-transform: uppercase;
    color: var(--accent); margin-bottom: 6px;
  }
  .tv-wiz-step-sub {
    font-size: 13px; color: var(--muted); margin-bottom: 20px; line-height: 1.6;
  }
  .tv-wiz-year-grid {
    display: flex; gap: 10px; flex-wrap: wrap; justify-content: center; margin-bottom: 20px;
  }
  .tv-wiz-year-btn {
    font-family: var(--mono); font-size: 14px; font-weight: 700;
    padding: 12px 22px; border-radius: 8px; cursor: pointer;
    border: 1.5px solid var(--border); background: var(--panel); color: var(--text);
    transition: all 0.15s; user-select: none;
  }
  .tv-wiz-year-btn:hover { border-color: var(--accent); background: rgba(200,241,53,0.04); }
  .tv-wiz-year-btn.on {
    border-color: var(--accent); background: rgba(200,241,53,0.1); color: var(--accent);
  }
  .tv-wiz-form-row {
    display: flex; align-items: center; gap: 14px;
    padding: 10px 0; border-bottom: 1px solid var(--border);
  }
  .tv-wiz-form-year {
    font-family: var(--mono); font-size: 15px; font-weight: 700; color: var(--accent);
    width: 60px; flex-shrink: 0;
  }
  .tv-wiz-form-pick {
    display: flex; gap: 8px;
  }
  .tv-wiz-form-pick button {
    font-family: var(--mono); font-size: 11px; padding: 6px 14px;
    border-radius: 5px; border: 1px solid var(--border); background: none;
    color: var(--muted); cursor: pointer; transition: all 0.15s;
  }
  .tv-wiz-form-pick button.on {
    border-color: var(--accent); color: var(--accent); background: rgba(200,241,53,0.06);
  }
  .tv-wiz-fields { display: flex; flex-direction: column; gap: 0; }
  .tv-wiz-field-group {
    font-family: var(--mono); font-size: 10px; font-weight: 700;
    letter-spacing: 0.1em; text-transform: uppercase; color: var(--accent);
    padding: 16px 0 8px; border-bottom: 1px solid rgba(200,241,53,0.1);
  }
  .tv-wiz-field {
    display: grid; grid-template-columns: 64px 1fr 140px;
    align-items: center; gap: 10px; padding: 8px 0;
    border-bottom: 1px solid var(--border);
  }
  .tv-wiz-line-badge {
    font-family: var(--mono); font-size: 10px; font-weight: 700;
    color: var(--accent); background: rgba(200,241,53,0.08);
    padding: 3px 7px; border-radius: 4px; text-align: center; white-space: nowrap;
  }
  .tv-wiz-field-label {
    display: flex; flex-direction: column; gap: 2px;
  }
  .tv-wiz-field-name {
    font-family: var(--mono); font-size: 12px; color: var(--text);
  }
  .tv-wiz-field-hint {
    font-size: 11px; color: var(--muted);
  }
  .tv-wiz-field-req::after {
    content: " *"; color: var(--danger); font-size: 10px;
  }
  .tv-wiz-input {
    font-family: var(--mono); font-size: 13px; font-weight: 700;
    background: var(--bg); border: 1px solid var(--border); color: var(--text);
    padding: 8px 12px; border-radius: 6px; text-align: right;
    outline: none; transition: border-color 0.15s;
  }
  .tv-wiz-input:focus { border-color: var(--accent); }
  .tv-wiz-input.invalid { border-color: var(--danger); }
  .tv-wiz-nav {
    display: flex; gap: 10px; margin-top: 24px; justify-content: center;
  }
  .tv-wiz-nav button {
    font-family: var(--mono); font-size: 11px; letter-spacing: 0.1em;
    text-transform: uppercase; padding: 11px 28px; border-radius: 7px;
    cursor: pointer; font-weight: 700; transition: all 0.15s; border: none;
  }
  .tv-wiz-back {
    background: none; border: 1px solid var(--border) !important;
    color: var(--muted);
  }
  .tv-wiz-back:hover { border-color: var(--text) !important; color: var(--text); }
  .tv-wiz-next {
    background: var(--accent); color: #0a0c0f;
  }
  .tv-wiz-next:hover { background: #d4f54a; }
  .tv-wiz-next:disabled { opacity: 0.3; cursor: not-allowed; }
  .tv-wiz-warn {
    font-family: var(--mono); font-size: 11px; color: var(--danger);
    background: rgba(248,113,113,0.06); border: 1px solid rgba(248,113,113,0.15);
    border-radius: 6px; padding: 8px 12px; margin-top: 12px;
  }
  .tv-wiz-year-tab-bar {
    display: flex; gap: 0; border-bottom: 1px solid var(--border); margin-bottom: 16px;
  }
  .tv-wiz-year-tab {
    font-family: var(--mono); font-size: 12px; font-weight: 700;
    padding: 10px 20px; border: none; background: none;
    color: var(--muted); cursor: pointer; border-bottom: 2px solid transparent;
    transition: all 0.15s;
  }
  .tv-wiz-year-tab.active { color: var(--accent); border-bottom-color: var(--accent); }

  /* ── Print modal ── */
  .tv-print-modal-overlay {
    position: fixed; inset: 0; background: rgba(0,0,0,0.7);
    display: flex; align-items: center; justify-content: center;
    z-index: 10000;
  }
  .tv-print-modal {
    background: var(--panel); border: 1px solid var(--border);
    border-radius: 12px; padding: 28px 32px; max-width: 420px;
    text-align: center;
  }
  .tv-print-modal h3 {
    font-family: var(--mono); font-size: 13px; font-weight: 700;
    letter-spacing: 0.06em; color: var(--accent); margin-bottom: 14px;
  }
  .tv-print-modal p {
    font-size: 13px; color: var(--text); line-height: 1.7; margin-bottom: 20px;
  }
  .tv-print-modal-actions { display: flex; gap: 10px; justify-content: center; }

  /* ── Print report (hidden on screen, shown exclusively in @media print) ── */
  .tv-print-report { display: none; }

  @media print {
    @page { margin: 18mm 16mm; size: A4 portrait; }

    .tv-root > *:not(.tv-print-report) { display: none !important; }
    .tv-print-modal-overlay { display: none !important; }
    .tv-test-scenario-badge { display: none !important; }
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
      font-size: 10pt; font-weight: 700; letter-spacing: 0.35em;
      text-transform: uppercase; color: #555;
    }
    .tv-pr-title {
      font-size: 21pt; font-weight: 700; font-family: Georgia, serif;
      color: #111; margin: 6pt 0 4pt;
    }
    .tv-pr-subtitle { font-size: 9pt; color: #666; letter-spacing: 0.02em; }

    .tv-pr-section {
      margin-bottom: 22pt;
      break-inside: avoid; page-break-inside: avoid;
    }
    .tv-pr-section-title {
      font-size: 8pt; font-weight: 700; letter-spacing: 0.18em;
      text-transform: uppercase; color: #555;
      border-bottom: 1pt solid #ccc; padding-bottom: 4pt;
      margin-bottom: 10pt; font-family: 'Courier New', monospace;
    }

    /* KPI grid — 2x2 on page 1 */
    .tv-pr-kpi-grid {
      display: grid; grid-template-columns: 1fr 1fr; gap: 12pt;
      margin-bottom: 16pt;
    }
    .tv-pr-kpi-box {
      border: 1pt solid #ccc; border-radius: 4pt;
      padding: 10pt 14pt;
    }
    .tv-pr-kpi-label {
      font-size: 7.5pt; letter-spacing: 0.12em; text-transform: uppercase;
      color: #777; margin-bottom: 3pt; font-family: 'Courier New', monospace;
    }
    .tv-pr-kpi-value {
      font-size: 20pt; font-weight: 700; font-family: 'Courier New', monospace;
      color: #111; line-height: 1;
    }

    /* Phase badge */
    .tv-pr-phase-badge {
      display: inline-block; font-family: 'Courier New', monospace;
      font-size: 11pt; font-weight: 700; letter-spacing: 0.1em;
      text-transform: uppercase; color: #111;
      border: 1.5pt solid #111; border-radius: 4pt;
      padding: 5pt 14pt; margin: 12pt 0 8pt;
    }

    /* Position hero */
    .tv-pr-position {
      margin-bottom: 20pt; break-inside: avoid; page-break-inside: avoid;
    }
    .tv-pr-position-headline {
      font-size: 18pt; font-weight: 700; font-family: 'Courier New', monospace;
      letter-spacing: 0.06em; text-transform: uppercase; color: #111;
      margin-bottom: 10pt;
    }
    .tv-pr-position-explain {
      font-size: 10.5pt; color: #333; line-height: 1.6; margin-bottom: 3pt;
    }
    .tv-pr-position-impact {
      font-size: 10pt; color: #7a1a1a; font-weight: 600; margin-bottom: 6pt;
    }
    .tv-pr-position-action {
      font-size: 10pt; color: #1a5c35; font-weight: 600;
    }
    .tv-pr-tag-row { display: flex; gap: 6pt; flex-wrap: wrap; margin-top: 10pt; }
    .tv-pr-tag {
      font-size: 7.5pt; font-weight: 700; font-family: 'Courier New', monospace;
      letter-spacing: 0.08em; text-transform: uppercase;
      padding: 3pt 8pt; border: 1.2pt solid #111; border-radius: 3pt; color: #111;
    }
    .tv-pr-tag.pos  { color: #1a5c35; border-color: #1a5c35; }
    .tv-pr-tag.neg  { color: #7a1a1a; border-color: #7a1a1a; }
    .tv-pr-tag.warn { color: #5a3e00; border-color: #5a3e00; }

    /* Priority actions — large numbers */
    .tv-pr-action-num {
      font-size: 16pt; font-weight: 700; color: #111;
      font-family: 'Courier New', monospace; margin-right: 6pt;
      float: left; line-height: 1.4;
    }

    /* Prose summary */
    .tv-pr-prose {
      font-size: 10.5pt; color: #333; line-height: 1.7;
      margin-bottom: 14pt;
    }

    /* Page break */
    .tv-pr-page-break { display: none; }

    /* Table with alternate row shading */
    .tv-pr-table {
      width: 100%; border-collapse: collapse;
      font-family: 'Courier New', monospace; font-size: 9.5pt;
    }
    .tv-pr-table th {
      text-align: left; font-size: 7.5pt; letter-spacing: 0.1em;
      text-transform: uppercase; color: #444; font-weight: 700;
      padding: 5pt 8pt; border-bottom: 1pt solid #bbb;
    }
    .tv-pr-table td {
      padding: 6pt 8pt; border-bottom: 1pt solid #ebebeb; color: #222;
    }
    .tv-pr-table tr:nth-child(even) td { background: #f9f9f9; }
    .tv-pr-table td:first-child { font-weight: 700; }
    .tv-pr-table td.pr-pos { color: #1a5c35; font-weight: 700; }
    .tv-pr-table td.pr-neg { color: #7a1a1a; font-weight: 700; }

    .tv-pr-trend-row { display: flex; gap: 20pt; flex-wrap: wrap; margin-top: 12pt; }
    .tv-pr-trend-kpi { min-width: 80pt; }
    .tv-pr-trend-label {
      font-size: 7.5pt; letter-spacing: 0.1em; text-transform: uppercase;
      color: #666; font-family: 'Courier New', monospace;
    }
    .tv-pr-trend-value {
      font-size: 14pt; font-weight: 700; font-family: 'Courier New', monospace; color: #111;
    }

    /* Labeled trend bullet */
    .tv-pr-trend-bullet {
      font-size: 10pt; color: #222; line-height: 1.7; margin-bottom: 6pt;
    }
    .tv-pr-trend-bullet-label {
      font-weight: 700; font-family: 'Courier New', monospace;
      font-size: 8pt; letter-spacing: 0.08em; text-transform: uppercase;
      color: #555; margin-right: 4pt;
    }

    /* Year deep-dive (vertical) */
    .tv-pr-year-block {
      padding: 14pt 0; border-bottom: 1pt solid #ddd;
      break-inside: avoid; page-break-inside: avoid;
    }
    .tv-pr-year-block:last-child { border-bottom: none; }
    .tv-pr-year-header {
      font-size: 18pt; font-weight: 700; color: #111;
      font-family: 'Courier New', monospace; margin-bottom: 10pt;
    }
    .tv-pr-year-cols {
      display: grid; grid-template-columns: 1fr 1fr; gap: 16pt;
      margin-bottom: 10pt;
    }
    .tv-pr-year-col-title {
      font-size: 7.5pt; font-weight: 700; letter-spacing: 0.1em;
      text-transform: uppercase; color: #555; margin-bottom: 6pt;
      font-family: 'Courier New', monospace;
    }
    .tv-pr-year-row {
      display: flex; justify-content: space-between; padding: 3pt 0;
      font-size: 9.5pt; font-family: 'Courier New', monospace;
    }
    .tv-pr-year-row-label { color: #555; }
    .tv-pr-year-row-val { font-weight: 700; color: #111; }

    /* Callout insight between sections */
    .tv-pr-callout {
      font-size: 10pt; color: #333; font-style: italic;
      border-left: 2pt solid #ccc; padding-left: 8pt;
      margin: 8pt 0; line-height: 1.6;
    }

    .tv-pr-insight-text { font-size: 10pt; color: #222; line-height: 1.65; }

    .tv-pr-signal {
      display: inline-block; font-size: 7.5pt; padding: 2pt 6pt;
      border: 1pt solid; border-radius: 3pt; margin-right: 5pt;
      margin-top: 5pt; font-family: 'Courier New', monospace;
      letter-spacing: 0.04em;
    }
    .tv-pr-signal.high { color: #1a5c35; border-color: #1a5c35; }
    .tv-pr-signal.mid  { color: #5a3e00; border-color: #5a3e00; }
    .tv-pr-signal.low  { color: #7a1a1a; border-color: #7a1a1a; }

    .tv-pr-bullet {
      font-size: 10pt; color: #222; line-height: 1.7;
      padding-left: 14pt; text-indent: -14pt;
    }
    .tv-pr-bullet::before { content: "→ "; color: #555; }

    .tv-pr-footer {
      margin-top: 30pt; padding-top: 9pt; border-top: 1pt solid #ccc;
      font-size: 7.5pt; color: #aaa; text-align: center; letter-spacing: 0.04em;
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

// ─── WIZARD FIELD DEFINITIONS ────────────────────────────────────────────────
// Fields in IRS line-number order. Only lines that feed calculateMetrics().

// 1040 core fields (line-number order)
const FIELDS_1040 = [
  { key: "wages",        label: "W-2 Wages",                    hint: "Wages, salaries, tips",                lineCode: (y) => y === 2021 ? "1" : "1a" },
  { key: "interest",     label: "Taxable Interest",             hint: "From savings, CDs, bonds",             lineCode: () => "2b"  },
  { key: "dividends",    label: "Ordinary Dividends",           hint: "From stocks, mutual funds",            lineCode: () => "3b"  },
  { key: "capitalGains", label: "Capital Gain/Loss",            hint: "From selling assets",                  lineCode: (y) => y >= 2025 ? "7a" : "7" },
  { key: "otherIncome",  label: "Other Income",                 hint: "Schedule 1, business, etc.",           lineCode: () => "8"   },
  { key: "totalIncome",  label: "Total Income",                 hint: "All income before adjustments",        lineCode: () => "9",    required: true },
  { key: "adjustments",  label: "Adjustments to Income",        hint: "IRA, student loan, etc.",              lineCode: () => "10" },
  { key: "agi",          label: "Adjusted Gross Income",        hint: "After pre-tax deductions",             lineCode: (y) => y >= 2025 ? "11a" : "11", required: true },
  { key: "deductions",   label: "Standard/Itemized Deductions", hint: "Standard or itemized amount",         lineCode: (y) => y === 2025 ? "12e" : y === 2021 ? "12a" : "12" },
  { key: "taxableIncome",label: "Taxable Income",               hint: "Income subject to tax",                lineCode: () => "15",   required: true },
  { key: "totalTax",     label: "Total Tax",                    hint: "Your total federal tax",               lineCode: () => "24",   required: true },
];

// 1040-NR core fields (line-number order, includes NR-specific lines inline)
const FIELDS_1040NR = [
  { key: "wages",        label: "W-2 Wages",                    hint: "Wages, salaries, tips",                lineCode: () => "1a" },
  { key: "treatyExempt", label: "Treaty Exempt Income",         hint: "Tax treaty scholarship/wage exemption",lineCode: (y) => y === 2021 ? "1c" : "1k" },
  { key: "interest",     label: "Taxable Interest",             hint: "From savings, CDs, bonds",             lineCode: () => "2b"  },
  { key: "dividends",    label: "Ordinary Dividends",           hint: "From stocks, mutual funds",            lineCode: () => "3b"  },
  { key: "capitalGains", label: "Capital Gain/Loss",            hint: "From selling assets",                  lineCode: (y) => y >= 2025 ? "7a" : "7" },
  { key: "otherIncome",  label: "Other Income",                 hint: "Schedule 1, business, etc.",           lineCode: () => "8"   },
  { key: "totalIncome",  label: "Total ECI Income",             hint: "Effectively connected income",         lineCode: () => "9",    required: true },
  { key: "adjustments",  label: "Adjustments to Income",        hint: "IRA, student loan, etc.",              lineCode: (y) => y <= 2022 ? "10d" : "10" },
  { key: "agi",          label: "Adjusted Gross Income",        hint: "After pre-tax deductions",             lineCode: (y) => y >= 2025 ? "11a" : "11", required: true },
  { key: "deductions",   label: "Itemized Deductions",          hint: "From Schedule A (1040-NR)",            lineCode: (y) => y === 2021 ? "12a" : "12" },
  { key: "taxableIncome",label: "Taxable Income",               hint: "Income subject to tax",                lineCode: () => "15",   required: true },
  { key: "necTax",       label: "NEC Tax",                      hint: "Tax on non-effectively connected income", lineCode: () => "23a" },
  { key: "totalTax",     label: "Total Tax",                    hint: "Your total federal tax",               lineCode: () => "24",   required: true },
];

// Helper: get the right field list for a form type
function getFieldsForForm(formType) {
  return formType === "1040-NR" ? FIELDS_1040NR : FIELDS_1040;
}

function emptyYearData() {
  const d = {};
  FIELDS_1040.forEach(f => { d[f.key] = ""; });
  FIELDS_1040NR.forEach(f => { if (!(f.key in d)) d[f.key] = ""; });
  return d;
}

function parseNum(v) {
  if (v == null || v === "") return null;
  const n = parseFloat(String(v).replace(/[$,\s]/g, ""));
  return isNaN(n) ? null : n;
}

function fmtInput(v) {
  const n = parseNum(v);
  if (n == null) return v;
  return n.toLocaleString("en-US");
}

// ─── TOOLTIP ─────────────────────────────────────────────────────────────────
function Tip({ children, tip }) {
  const [coords, setCoords] = useState(null);
  const ref = useRef(null);
  const rafRef = useRef(null);

  const show = () => {
    if (rafRef.current) return; // already scheduled
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null;
      if (!ref.current) return;
      const r = ref.current.getBoundingClientRect();
      const x = Math.min(Math.max(r.left + r.width / 2, 124), window.innerWidth - 124);
      setCoords({ x, y: r.top - 10 });
    });
  };

  const hide = () => {
    if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
    setCoords(null);
  };

  return (
    <span className="tv-tip" ref={ref} onMouseEnter={show} onMouseLeave={hide}>
      {children}
      {coords && (
        <span
          className="tv-tip-box"
          style={{ left: coords.x, top: coords.y }}
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
// ═══════════════════════════════════════════════════════════════
// TEST SCENARIO SEED — DELETE THIS BLOCK TO REMOVE
// Toggle TEST_SCENARIO_ENABLED to false to disable without deleting.
// ═══════════════════════════════════════════════════════════════
const TEST_SCENARIO_ENABLED = false;

const TEST_SCENARIOS = {
  freelance: {
    label: "Freelance Consultant",
    sublabel: "Income roller-coaster (self-employed, 2023–2025)",
    emoji: "🎢",
    years: [2023, 2024, 2025],
    forms: { 2023: "1040", 2024: "1040", 2025: "1040" },
    data: {
      2023: {
        wages: "0",
        interest: "650",
        dividends: "1800",
        capitalGains: "8400",
        otherIncome: "98000",
        totalIncome: "108850",
        adjustments: "9800",
        agi: "99050",
        deductions: "13850",
        taxableIncome: "85200",
        totalTax: "13680",
      },
      2024: {
        wages: "0",
        interest: "890",
        dividends: "2100",
        capitalGains: "-3000",
        otherIncome: "42000",
        totalIncome: "41990",
        adjustments: "3200",
        agi: "38790",
        deductions: "14600",
        taxableIncome: "24190",
        totalTax: "2680",
      },
      2025: {
        wages: "8500",
        interest: "1240",
        dividends: "3850",
        capitalGains: "18500",
        otherIncome: "142000",
        totalIncome: "174090",
        adjustments: "14200",
        agi: "159890",
        deductions: "15000",
        taxableIncome: "144890",
        totalTax: "38420",
      },
    },
  },
  tech_rsu: {
    label: "Tech Engineer — RSU Ladder",
    sublabel: "Job switch + RSU vest (W-2 dominant, 2023–2025)",
    emoji: "🚀",
    years: [2023, 2024, 2025],
    forms: { 2023: "1040", 2024: "1040", 2025: "1040" },
    data: {
      2023: {
        wages: "185000",
        interest: "3200",
        dividends: "4800",
        capitalGains: "12500",
        otherIncome: "0",
        totalIncome: "205500",
        adjustments: "0",
        agi: "205500",
        deductions: "13850",
        taxableIncome: "191650",
        totalTax: "39180",
      },
      2024: {
        wages: "310000",
        interest: "5800",
        dividends: "6200",
        capitalGains: "28000",
        otherIncome: "0",
        totalIncome: "350000",
        adjustments: "0",
        agi: "350000",
        deductions: "14600",
        taxableIncome: "335400",
        totalTax: "82650",
      },
      2025: {
        wages: "385000",
        interest: "8400",
        dividends: "9600",
        capitalGains: "145000",
        otherIncome: "0",
        totalIncome: "548000",
        adjustments: "0",
        agi: "548000",
        deductions: "15000",
        taxableIncome: "533000",
        totalTax: "138500",
      },
    },
  },
};
// ═══════════════════════════════════════════════════════════════
// END TEST SCENARIO SEED
// ═══════════════════════════════════════════════════════════════

export default function TaxVista() {
  // ── Wizard state ──
  const [wizStep, setWizStep] = useState(1);
  const [wizYears, setWizYears] = useState([]);
  const [wizForms, setWizForms] = useState({});   // { 2025: "1040", 2024: "1040-NR" }
  const [wizData, setWizData]   = useState({});    // { 2025: { totalIncome: "80000", ... } }
  const [wizActiveYear, setWizActiveYear] = useState(null);
  const [wizWarnings, setWizWarnings] = useState([]);
  const [error, setError] = useState("");

  // ── Dashboard state ──
  const [results, setResults] = useState([]);
  const [activeTab, setActiveTab] = useState("overview");
  const [metrics, setMetrics] = useState([]);
  const [selectedYears, setSelectedYears] = useState([]);
  const [verticalYear, setVerticalYear] = useState(null);
  const [activeYear, setActiveYear] = useState(null);
  const [activeMetric, setActiveMetric] = useState(null);
  const [reportName, setReportName] = useState("");
  const areaChartRef = useRef(null);
  const lineChartRef = useRef(null);
  const barChartRef  = useRef(null);

  const onChartMove  = (e) => { if (e?.activeLabel) setActiveYear(Number(e.activeLabel)); };
  const onChartLeave = ()  => setActiveYear(null);

  const metricOpacity = (metric) => activeMetric == null ? 1 : activeMetric === metric ? 1 : 0.4;
  const metricStroke  = (metric, base) => activeMetric === metric ? base + 1 : base;

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

  // TEST SCENARIO SEED — delete this handler along with the constants above and the button JSX
  const loadTestScenario = (scenarioKey) => {
    const scenario = TEST_SCENARIOS[scenarioKey];
    if (!scenario) return;
    setWizYears(scenario.years);
    setWizForms(scenario.forms);
    setWizData(scenario.data);
    setWizActiveYear(scenario.years[scenario.years.length - 1]);
    setWizStep(3);
  };

  // ── Wizard helpers ──
  const toggleYear = (y) => {
    setWizYears(prev => {
      const next = prev.includes(y) ? prev.filter(x => x !== y) : [...prev, y].sort((a, b) => a - b);
      // Initialize form type and data for new years
      if (!prev.includes(y)) {
        setWizForms(f => ({ ...f, [y]: f[y] ?? "1040" }));
        setWizData(d => ({ ...d, [y]: d[y] ?? emptyYearData() }));
      }
      return next;
    });
  };

  const setFieldVal = (year, key, val) => {
    setWizData(prev => ({
      ...prev,
      [year]: { ...prev[year], [key]: val },
    }));
  };

  const handleBlur = (year, key, val) => {
    const formatted = fmtInput(val);
    if (formatted !== val) setFieldVal(year, key, formatted);
  };

  // ── Cross-validation ──
  const runValidation = () => {
    const warns = [];
    for (const y of wizYears) {
      const d = wizData[y];
      if (!d) continue;
      // AGI ≈ totalIncome - adjustments
      const ti = parseNum(d.totalIncome);
      const adj = parseNum(d.adjustments) ?? 0;
      const agi = parseNum(d.agi);
      if (ti != null && agi != null && Math.abs(ti - adj - agi) > 1) {
        warns.push(`${y}: Total Income ($${ti?.toLocaleString()}) - Adjustments ($${adj.toLocaleString()}) ≠ AGI ($${agi?.toLocaleString()}). Check your entries.`);
      }
    }
    setWizWarnings(warns);
    return warns;
  };

  // ── Analyze (from wizard data) ──
  const handleAnalyze = () => {
    const warns = runValidation();
    const collected = wizYears.map(y => {
      const d = wizData[y] ?? {};
      const isNR = wizForms[y] === "1040-NR";
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
        adjustments: {
          totalAdjustments: parseNum(d.adjustments),
        },
        deductions: {
          itemized: parseNum(d.deductions),
        },
        summary: {
          totalIncome:          parseNum(d.totalIncome),
          adjustedGrossIncome:  parseNum(d.agi),
          taxableIncome:        parseNum(d.taxableIncome),
          totalTax:             parseNum(d.totalTax),
        },
      };
    });
    collected.sort((a, b) => a.year - b.year);
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
    console.log("[TaxVista] False Signal Detection:", computedMetrics.map((m, i) => ({
      year: collected[i]?.year,
      primarySignal: m.primarySignal,
      falseSignals: m.falseSignals,
    })));
    setResults(collected);
    setMetrics(computedMetrics);
    const years = collected.map(r => r.year);
    setSelectedYears(years);
    setVerticalYear(years.length > 0 ? Math.max(...years) : null);
    setActiveTab("overview");
    setTimeout(() => {
      document.querySelector(".tv-dashboard")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 50);
  };

  // Check if required fields are filled for all years
  const canAnalyze = wizYears.length > 0 && wizYears.every(y => {
    const d = wizData[y];
    if (!d) return false;
    const fields = getFieldsForForm(wizForms[y] ?? "1040");
    return fields.filter(f => f.required).every(f => parseNum(d[f.key]) != null);
  });

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

    // Event-driven income detection
    const lastFullResult = results.find(r => r.year === last.year);
    const lastWages     = lastFullResult?.income?.wages ?? 0;
    const lastCapGains  = lastFullResult?.income?.capitalGains ?? 0;
    const lastDividends = lastFullResult?.income?.dividends ?? 0;
    const lastInterest  = lastFullResult?.income?.interest ?? 0;
    const lastTotalInc  = last.totalIncome || 1;
    const eventIncome   = Math.max(lastCapGains, 0);
    const eventRatio    = eventIncome / lastTotalInc;

    // Sentence 1: income direction + magnitude (with low-base guard + event detection)
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

    // Sentence 2: tax efficiency vs income (with WHY explanation)
    if (taxGrowth != null && incomeGrowth != null && taxGrowth > incomeGrowth + 0.05 && !lowBase) {
      const incPct = (incomeGrowth * 100).toFixed(0);
      const taxPct = (taxGrowth * 100).toFixed(0);
      items.push({ text: `Over ${first.year}–${last.year}, income grew ${incPct}% cumulatively while taxes grew ${taxPct}% over the same period, as earnings entered higher marginal brackets with limited deduction scaling — resulting in a shrinking share of each additional dollar retained after tax.`, metric: "tax", type: "tax_efficiency" });
    } else if (afterTaxGrowth != null && incomeGrowth != null && afterTaxGrowth < incomeGrowth - 0.05 && !lowBase) {
      items.push({ text: `After-tax income is growing slower than gross income, indicating rising tax drag. A portion of income growth is being absorbed by higher marginal rates without corresponding tax optimization.`, metric: "afterTax", type: "tax_efficiency" });
    } else if (lowBase && taxGrowth != null && taxGrowth > 1) {
      items.push({ text: `Tax burden increased sharply as income moved from near-zero into taxable brackets. This is a natural transition, not a structural inefficiency — but it creates the highest-leverage window for tax optimization.`, metric: "tax", type: "tax_efficiency" });
    } else if (incomeGrowth != null && !lowBase) {
      const lastMetric = metrics[metrics.length - 1];
      if (lastMetric?.isLossDriven) {
        items.push({ text: `Tax burden decreased primarily due to capital losses, not improved deduction structure. This reduction is not expected to repeat without similar losses.`, metric: "tax", type: "tax_efficiency" });
      } else {
        items.push({ text: `Tax obligation is growing in line with income — no compression of take-home margin detected. Current deduction structure is keeping pace with income growth.`, metric: "tax", type: "tax_efficiency" });
      }
    }

    // Sentence 3: income mix shift
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
      }
      else if (gainsDelta < -0.05) {
        const lastCapGainsVal = results.find(r => r.year === last.year)?.income?.capitalGains;
        items.push({ text: lastCapGainsVal != null && lastCapGainsVal < 0
          ? `Capital gains turned negative (loss position), reducing investment income share. This concentrates earnings in ordinary income and narrows tax flexibility.`
          : `Investment income share is declining, concentrating earnings in ordinary income. This narrows tax flexibility and increases marginal rate exposure.`, metric: "income", type: "income_mix" });
      }
    }

    return items;
  })();

  // ── Signal Override Layer (type-based, not phrase-based) ──
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
  const healthColorMap = { positive: "var(--success)", neutral: "var(--accent)", caution: "#f59e0b", danger: "var(--danger)" };
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
  const taxRateDelta = _m0?.effectiveTaxRate != null && _mN?.effectiveTaxRate != null
    ? _mN.effectiveTaxRate - _m0.effectiveTaxRate : null;
  const _lowBase = _td0?.totalIncome != null && _td0.totalIncome < 10000;

  // Vertical pie data — built from user-entered income components
  // Negative components (capital losses) are treated as 0 for the donut; noted separately.
  const vPieData = (() => {
    if (!vResult) return [];
    const inc = vResult.income ?? {};
    const w  = Math.max(inc.wages ?? 0, 0);
    const cg = Math.max(inc.capitalGains ?? 0, 0);
    const dv = Math.max(inc.dividends ?? 0, 0);
    const it = Math.max(inc.interest ?? 0, 0);
    const ot = Math.max(inc.additionalIncome ?? 0, 0);
    const total = w + cg + dv + it + ot;
    if (total <= 0) return [];
    const pct = (amt) => +((amt / total) * 100).toFixed(1);
    return [
      { name: "Wages",     value: pct(w)  },
      { name: "Cap Gains", value: pct(cg) },
      { name: "Dividends", value: pct(dv) },
      { name: "Interest",  value: pct(it) },
      { name: "Other",     value: pct(ot) },
    ];
  })();
  // Capital loss note for display below the donut
  const vCapLoss = vResult?.income?.capitalGains != null && vResult.income.capitalGains < 0
    ? Math.abs(vResult.income.capitalGains) : null;

  // ── Vertical insight sentences ──
  const vInsights = (() => {
    if (!vMetric) return [];
    const ins = [];

    // Signal flags for the selected vertical year
    const vFalseSignals = new Set((vMetric.falseSignals ?? []).map(s => s.flag));
    const vHasOneTimeEvent    = vFalseSignals.has("ONE_TIME_EVENT");
    const vHasIncomeCollapse  = vFalseSignals.has("INCOME_COLLAPSE");
    const vHasFalseEfficiency = vFalseSignals.has("FALSE_EFFICIENCY");

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
      // One-time event ETR note
      if (vHasOneTimeEvent && vMetric.effectiveTaxRate > 0.25) {
        ins.push([
          { text: "Note: high effective tax rate this year reflects one-time capital gains taxed at elevated rates — not indicative of your typical tax burden." },
        ]);
      }
    }

    // Insight 2: Investment income share
    const investPct = (vMetric.incomeBreakdown?.capitalGainsPct ?? 0)
      + (vMetric.incomeBreakdown?.interestPct ?? 0)
      + (vMetric.incomeBreakdown?.dividendsPct ?? 0);
    if (vMetric.incomeBreakdown) {
      const investStr = (investPct * 100).toFixed(1) + "%";
      if (investPct < -0.01) {
        ins.push([
          { text: "Investment income: " },
          { text: `net loss (${investStr})`, accent: true },
          { text: " — capital losses exceeded investment gains this year; this reduces taxable income but reflects portfolio decline" },
        ]);
        if (vMetric.isLossDriven) {
          ins.push([
            { text: "This improvement in tax efficiency is not sustainable and does not reflect underlying financial strength — it is driven by portfolio losses, not tax optimization." },
          ]);
        }
      } else if (investPct < 0.05) {
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
        if (vHasOneTimeEvent) {
          ins.push([
            { text: "Capital gains represent " },
            { text: investStr + " of income this year", accent: true },
            { text: ", driven by a one-time event rather than recurring investment income" },
          ]);
        } else {
          ins.push([
            { text: "Investment income: " },
            { text: investStr, accent: true },
            { text: " — strong lower-rate mix (capital gains + dividends); structural tax advantage — protect and maintain" },
          ]);
        }
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
        const collapseOverride = (vHasIncomeCollapse || vHasFalseEfficiency)
          ? " — high ratio partly reflects lower income base — verify this holds as income recovers"
          : null;
        const lowIncomeCaveat = !collapseOverride && (vResult?.summary?.totalIncome ?? 0) < 50000 && de > 0.25
          ? " (note: this high efficiency partly reflects the lower income base — it may not persist as income scales)"
          : "";
        ins.push([
          { text: "Deduction efficiency: " },
          { text: dePct, accent: true },
          { text: collapseOverride ?? ` — strong tax base reduction; structure is working — maintain as income scales${lowIncomeCaveat}` },
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
      // Check for peak-then-correction: recent year dropped >15% from peak
      const peakIncome = Math.max(...trendData.map(t => t.totalIncome ?? 0));
      const peakYear = trendData.find(t => t.totalIncome === peakIncome)?.year;
      const latestIncome = _tdN?.totalIncome ?? 0;
      const hasCorrection = peakYear && peakYear !== _tdN?.year && latestIncome < peakIncome * 0.85;

      if (hasCorrection) {
        phase = "High Growth with Recent Correction";
        characteristics = [
          "Strong long-term income growth above 12% annualized",
          `Peak income in ${peakYear} ($${Math.round(peakIncome).toLocaleString()}) followed by a pullback in ${_tdN?.year}`,
          latestDE != null && latestDE < 0.1 ? "Deduction efficiency remains low — optimization headroom available" : "Deduction strategy is operational",
        ];
        implication = "Your multi-year trend shows strong growth, but the most recent year reflects a significant correction. Tax planning should account for volatility, not just the long-term trajectory.";
        note = `Your ${years}-year trend shows strong long-term growth, but ${_tdN?.year} reflects a significant correction${_mN?.insights?.hasCapitalLoss ? " driven by investment losses" : ""}. This is a growth-with-volatility story, not a linear acceleration.`;
      } else {
      phase = "Accelerated Growth";
      characteristics = [
        "Sustained high income growth above 12% annualized",
        taxRateDelta != null && taxRateDelta > 0.02 ? "Tax burden scaling with income — rising effective rate" : "Tax burden managed within growth pace",
        latestDE != null && latestDE < 0.1 ? "Deduction efficiency remains low — significant optimization headroom" : "Deduction strategy is operational",
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
        latestATM != null ? `After-tax margin at ${(latestATM * 100).toFixed(1)}% — ${latestATM > 0.8 ? "strong after-tax performance" : "moderate after-tax performance"}` : "After-tax margin data unavailable",
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
        latestATM != null ? `After-tax margin at ${(latestATM * 100).toFixed(1)}% — ${latestATM > 0.8 ? "after-tax income stable but not improving" : "tax drag is compressing take-home income"}` : "After-tax margin data unavailable",
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
        latestATM != null ? `After-tax margin at ${(latestATM * 100).toFixed(1)}% — ${latestATM > 0.8 ? "after-tax income stable despite declining income" : "tax burden not adjusting proportionally to lower income"}` : "After-tax margin data unavailable",
        taxRateDelta != null ? `Effective tax rate shifted by ${(taxRateDelta * 100).toFixed(1)} percentage points — ${taxRateDelta > 0 ? "rate rising on a shrinking base, compounding after-tax erosion" : "rate adjusting downward with income"}` : "Effective tax rate trend data unavailable",
      ];
      implication = `At ${cagrPct}% annualized decline, verify that tax withholding and expense structure have adjusted proportionally. Over-withholding on a shrinking base accelerates after-tax erosion.`;
      note = `Income is trending downward at ${cagrPct}% annualized. Priority shifts to preserving current after-tax income: verify withholding is accurate, claim all eligible deductions, and evaluate whether income sources can be restructured.`;
    }

    // Override for one-time capital event
    if (metrics.some(m => (m?.falseSignals ?? []).some(s => s.flag === "ONE_TIME_EVENT"))) {
      phase = "Event-Driven Income";
      note = "Income growth this period includes a significant one-time capital event. This may not reflect your ongoing earnings trajectory.";
    }

    return { years, cagr, phase, note, characteristics, implication };
  })();

  const [showPrintModal, setShowPrintModal] = useState(false);
  const pendingPrintName = useRef("");

  // ── PDF export with dynamic filename via document.title ──
  const handleExport = () => {
    const name = prompt("Enter your name for this report:");
    if (!name || !name.trim()) return;
    pendingPrintName.current = name.trim();
    setReportName(name.trim());
    setShowPrintModal(true);
  };

  const handleConfirmPrint = () => {
    setShowPrintModal(false);
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
    const _ps = m.primarySignal;
    const _psOverride = _ps && (_ps.severity === "CRITICAL" || _ps.severity === "HIGH");
    const etrLabel  = etr == null ? null
      : _psOverride ? _ps.override
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
    const deIsHighIncome = ti != null && ti > 250000;
    const deLabel  = de == null ? null
      : de > 0.2 ? `${dePct}, strong — income effectively sheltered`
      : de > 0.1 ? `${dePct}, moderate — room to increase pre-tax contributions`
      : deIsHighIncome
      ? `${dePct} (standard deduction is flat — pre-tax 401k/HSA/IRA are the levers at this income)`
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
    const whyIsHighIncome = ti != null && ti > 250000;

    // Income grew but deductions didn't keep pace (only when rate is rising)
    if (ti && tiPrior && etrDelta != null && etrDelta > 0.01) {
      const g = ((ti - tiPrior) / tiPrior * 100).toFixed(0);
      bullets.push(whyIsHighIncome
        ? `income +${g}% YoY — deductions are flat by design; 401k/HSA contributions reduce the taxable base`
        : `income +${g}% YoY — deductions didn't scale proportionally`);
    }

    // Deduction efficiency: low = problem, high = strength
    if (de != null && de < 0.08) {
      bullets.push(whyIsHighIncome
        ? `deduction efficiency ${(de * 100).toFixed(1)}% — expected at this income level; focus on pre-tax contribution caps, not ratios`
        : `deduction efficiency ${(de * 100).toFixed(1)}% — taxable income close to gross`);
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
      bullets.push(`${(atm * 100).toFixed(0)}% of total income retained after tax`);
    }

    return bullets.slice(0, 3);
  })();

  // Peak-risk year: highest income + highest ETR + lowest deduction efficiency
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

  // NR→1040 transition detection
  const nrTransitionYear = (() => {
    if (results.length < 2) return null;
    const sorted = [...results].sort((a, b) => a.year - b.year);
    for (let i = 1; i < sorted.length; i++) {
      if (sorted[i - 1].isNR && !sorted[i].isNR) return sorted[i].year;
    }
    return null;
  })();

  return (
    <>
      <style>{styles}</style>

      {TEST_SCENARIO_ENABLED && (
        <div
          style={{
            position: "fixed",
            top: "8px",
            right: "8px",
            zIndex: 9999,
            background: "#FFE55C",
            color: "#000",
            padding: "4px 10px",
            fontSize: "11px",
            fontFamily: "'Courier New', monospace",
            fontWeight: "bold",
            letterSpacing: "0.1em",
            borderRadius: "3px",
            boxShadow: "0 2px 6px rgba(0,0,0,0.4)",
            pointerEvents: "none",
          }}
          className="tv-test-scenario-badge"
        >
          TEST SCENARIO
        </div>
      )}

      {/* Print instruction modal */}
      {showPrintModal && (
        <div className="tv-print-modal-overlay" onClick={() => setShowPrintModal(false)}>
          <div className="tv-print-modal" onClick={e => e.stopPropagation()}>
            <h3>Before Printing</h3>
            <p>
              In the print dialog, set <strong>Headers and Footers</strong> to <strong>None</strong> (or Off) for a clean report without the URL and timestamp on every page.
            </p>
            <div className="tv-print-modal-actions">
              <button className="tv-wiz-back" onClick={() => setShowPrintModal(false)}>Cancel</button>
              <button className="tv-wiz-next" onClick={handleConfirmPrint}>Got it, Print</button>
            </div>
          </div>
        </div>
      )}

      <div className="tv-root">

        {/* ── Header ── */}
        <div className="tv-header">
          <div className="tv-logo">TaxVista</div>
          <h1>
            Your Tax Return is a<br />
            <span>Financial Story.</span>
          </h1>
          <p className="tv-subtitle">
            Enter your 1040 numbers — no uploads, no SSN, numbers only.
            <br />
            In under 5 minutes, get a bird's-eye view of your financial story.
          </p>
          <p style={{
            fontFamily: "var(--mono)", fontWeight: 700, fontSize: 15,
            color: "var(--accent)", marginTop: 10, letterSpacing: "0.02em",
            textShadow: "0 0 18px rgba(200,241,53,0.35)",
            textDecoration: "underline", textUnderlineOffset: 4, textDecorationColor: "rgba(200,241,53,0.35)",
          }}>
            Download your Financial Story Report.
          </p>
        </div>

        {/* ── Data Entry Wizard ── */}
        {results.length === 0 && (
          <div className="tv-wiz">

            {/* Progress dots */}
            <div className="tv-wiz-progress">
              {[1, 2, 3].map(s => (
                <div key={s} className={`tv-wiz-dot${s === wizStep ? " active" : s < wizStep ? " done" : ""}`} />
              ))}
            </div>

            {/* Step 1 — Year selection */}
            {wizStep === 1 && (
              <>
                <div className="tv-wiz-step-title">Step 1 — Select Tax Years</div>
                <div className="tv-wiz-step-sub">Which years do you want to analyze? Select up to 5.</div>
                <div className="tv-wiz-year-grid">
                  {YEAR_OPTIONS.map(y => (
                    <button
                      key={y}
                      className={`tv-wiz-year-btn${wizYears.includes(y) ? " on" : ""}`}
                      onClick={() => toggleYear(y)}
                      disabled={!wizYears.includes(y) && wizYears.length >= 5}
                    >
                      {y}
                    </button>
                  ))}
                </div>
                <div className="tv-wiz-nav">
                  <button className="tv-wiz-next" disabled={wizYears.length === 0} onClick={() => { setWizStep(2); setWizActiveYear(wizYears[wizYears.length - 1]); }}>
                    Next &rarr;
                  </button>
                </div>              </>
            )}

            {/* Step 2 — Form type per year */}
            {wizStep === 2 && (
              <>
                <div className="tv-wiz-step-title">Step 2 — Form Type</div>
                <div className="tv-wiz-step-sub">For each year, which form did you file?</div>
                {[...wizYears].sort((a, b) => b - a).map(y => (
                  <div key={y} className="tv-wiz-form-row">
                    <div className="tv-wiz-form-year">{y}</div>
                    <div className="tv-wiz-form-pick">
                      {["1040", "1040-NR"].map(ft => (
                        <button key={ft} className={(wizForms[y] ?? "1040") === ft ? "on" : ""}
                          onClick={() => setWizForms(prev => ({ ...prev, [y]: ft }))}
                        >
                          {ft}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
                <div className="tv-wiz-nav">
                  <button className="tv-wiz-back" onClick={() => setWizStep(1)}>&larr; Back</button>
                  <button className="tv-wiz-next" onClick={() => setWizStep(3)}>Next &rarr;</button>
                </div>
              </>
            )}

            {/* Step 3 — Core field entry */}
            {wizStep === 3 && (() => {
              const y = wizActiveYear ?? wizYears[wizYears.length - 1];
              const formType = wizForms[y] ?? "1040";
              const d = wizData[y] ?? emptyYearData();
              const fields = getFieldsForForm(formType);
              return (
                <>
                  <div className="tv-wiz-step-title">Step 3 — Enter Your Numbers</div>
                  <div className="tv-wiz-step-sub">Type the dollar amounts from your {formType}. Fields marked * are required.</div>

                  {/* Year tabs */}
                  <div className="tv-wiz-year-tab-bar">
                    {[...wizYears].sort((a, b) => b - a).map(yr => (
                      <button key={yr} className={`tv-wiz-year-tab${yr === y ? " active" : ""}`}
                        onClick={() => setWizActiveYear(yr)}>
                        {yr} <span style={{ fontSize: 9, color: "var(--muted)", marginLeft: 4 }}>{wizForms[yr] ?? "1040"}</span>
                      </button>
                    ))}
                  </div>

                  <div className="tv-wiz-fields">
                    <div className="tv-wiz-field-group">{formType} — {y}</div>
                    {fields.map(f => (
                      <div key={f.key} className="tv-wiz-field">
                        <div className="tv-wiz-line-badge">Line {f.lineCode(y)}</div>
                        <div className="tv-wiz-field-label">
                          <span className={`tv-wiz-field-name${f.required ? " tv-wiz-field-req" : ""}`}>{f.label}</span>
                          <span className="tv-wiz-field-hint">{typeof f.hint === "function" ? f.hint(y) : f.hint}</span>
                        </div>
                        <input
                          className="tv-wiz-input"
                          type="text"
                          inputMode="decimal"
                          placeholder="0"
                          value={d[f.key] ?? ""}
                          onChange={e => setFieldVal(y, f.key, e.target.value)}
                          onBlur={e => handleBlur(y, f.key, e.target.value)}
                        />
                      </div>
                    ))}
                  </div>

                  {/* Cross-validation warnings */}
                  {wizWarnings.length > 0 && (
                    <div className="tv-wiz-warn">
                      {wizWarnings.map((w, i) => <div key={i}>{w}</div>)}
                    </div>
                  )}

                  <div className="tv-wiz-nav">
                    <button className="tv-wiz-back" onClick={() => setWizStep(2)}>&larr; Back</button>
                    <button className="tv-wiz-next" disabled={!canAnalyze} onClick={() => { runValidation(); handleAnalyze(); }}>
                      Analyze My Returns &rarr;
                    </button>
                  </div>
                </>
              );
            })()}

            <div className="tv-privacy" style={{ marginTop: 20 }}>
              🔒 <span style={{ color: "var(--accent)", fontWeight: 600 }}>Zero data risk.</span> You type only numbers — no SSN, no names, no addresses. Nothing is stored or transmitted. Everything runs in your browser.
            </div>

            {/* TEST SCENARIO SEED — delete this block to remove the buttons */}
            {wizStep === 1 && TEST_SCENARIO_ENABLED && (
              <div style={{ marginTop: 24, paddingTop: 20, borderTop: "1px dashed rgba(255,255,255,0.08)", textAlign: "center" }}>
                <div style={{ fontSize: 10, color: "var(--muted)", marginBottom: 12, letterSpacing: "0.12em", fontFamily: "var(--mono)", textTransform: "uppercase" }}>
                  🧪 Test Scenarios — skip manual entry
                </div>
                <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
                  {Object.entries(TEST_SCENARIOS).map(([key, scenario]) => (
                    <button
                      key={key}
                      onClick={() => loadTestScenario(key)}
                      style={{
                        fontFamily: "var(--mono)",
                        background: "transparent",
                        border: "1px dashed rgba(255,255,255,0.25)",
                        borderRadius: 6,
                        padding: "12px 18px",
                        cursor: "pointer",
                        transition: "all 0.15s",
                        textAlign: "left",
                        minWidth: 240,
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.4)"; e.currentTarget.style.background = "rgba(255,255,255,0.02)"; }}
                      onMouseLeave={(e) => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.25)"; e.currentTarget.style.background = "transparent"; }}
                    >
                      <div style={{ fontSize: 12, fontWeight: 700, color: "rgba(255,255,255,0.85)", letterSpacing: "0.04em" }}>
                        {scenario.emoji} {scenario.label}
                      </div>
                      <div style={{ marginTop: 4, fontSize: 10, color: "var(--muted)", fontFamily: "var(--sans)", letterSpacing: 0 }}>
                        {scenario.sublabel}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {error && <div className="tv-error">{error}</div>}
          </div>
        )}

        {/* Edit data button (when dashboard is showing) */}
        {results.length > 0 && (
          <div style={{ width: "100%", maxWidth: 700, display: "flex", justifyContent: "flex-end", marginBottom: -20 }}>
            <button className="tv-export-btn" onClick={() => { setResults([]); setMetrics([]); }}>
              Edit Data
            </button>
          </div>
        )}

        {/* ── Dashboard ── */}
        {results.length > 0 && (
          <div className="tv-dashboard">

            {/* ── Strategy Detected bar ── */}
            {strategyPhase && (
              <div className="tv-strategy-bar">
                <span className="tv-strategy-badge">{(() => {
                  const ps = resolvedActiveYear && metricMap[resolvedActiveYear]?.primarySignal;
                  if (!ps) return "Strategy Detected";
                  if (ps.severity === "CRITICAL") return "\u26A0 Income Alert";
                  if (ps.severity === "HIGH") return "\u26A0 Signal Distorted";
                  if (ps.severity === "MEDIUM" && ps.flag === "ONE_TIME_EVENT") return "\u26A0 Event Detected";
                  if (ps.severity === "MEDIUM") return "\u26A0 Signal Mixed";
                  if (ps.severity === "POSITIVE") return "\u2713 Strategy Confirmed";
                  return "Strategy Detected";
                })()}</span>
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
                {[...results].sort((a, b) => b.year - a.year).map(r => (
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
                  {[...results].sort((a, b) => b.year - a.year).map(r => <option key={r.year} value={r.year}>{r.year}</option>)}
                </select>
              </div>
              <div className="tv-nav-section">
                {[
                  { id: "overview",   icon: "◈", label: "Overview"   },
                  { id: "horizontal", icon: "↔", label: "Horizontal" },
                  { id: "vertical",   icon: "↕", label: "Vertical"   },
                  { id: "insights",   icon: "◉", label: "Insights"   },
                  { id: "caveats",    icon: "⚠", label: "Caveats"    },
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
              <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 12, marginBottom: 4 }}>
                <span style={{ fontFamily: "var(--mono)", fontSize: 9, color: "var(--muted)", letterSpacing: "0.02em" }}>
                  Tip: In print dialog → Headers and Footers → set to None
                </span>
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
                                { label: "TAX / INCOME", val: pf(m?.taxToIncome),               color: "var(--accent)" },
                              ].map(row => (
                                <div key={row.label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                  <span style={{ color: "var(--muted)", fontFamily: "var(--mono)", fontSize: 9, letterSpacing: "0.12em" }}>{row.label}</span>
                                  <span style={{ fontFamily: "var(--mono)", fontSize: 12, fontWeight: 700, color: row.color }}>{row.val}</span>
                                </div>
                              ))}
                              {m?.healthScore != null && (
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 4, paddingTop: 4, borderTop: "1px solid var(--border)" }}>
                                  <span style={{ color: "var(--muted)", fontFamily: "var(--mono)", fontSize: 9, letterSpacing: "0.12em" }}>HEALTH</span>
                                  <span style={{ fontFamily: "var(--mono)", fontSize: 12, fontWeight: 700, color: healthColorMap[m.healthColor] ?? "var(--text)" }}>{m.healthScore} — {m.healthLabel}</span>
                                </div>
                              )}
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
                        <div className="tv-chart-label"><Tip tip="How much you kept after taxes — year over year.">After-Tax Income Trend</Tip></div>
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
                          {(() => {
                            if (!_lowBase || trendData.length < 3) return null;
                            const peakTd = trendData.reduce((a, b) => (b.totalIncome ?? 0) > (a.totalIncome ?? 0) ? b : a);
                            const lastTd = trendData[trendData.length - 1];
                            if (peakTd.year !== lastTd.year && (peakTd.totalIncome ?? 0) > (lastTd.totalIncome ?? 0) * 1.15) {
                              return <div style={{ fontSize: 9, color: "var(--muted)", fontFamily: "var(--mono)", marginTop: 3, lineHeight: 1.4 }}>
                                Growth concentrated early, peak in {peakTd.year} then pullback.
                              </div>;
                            }
                            return null;
                          })()}
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
                          <div className="tv-metric-label"><Tip tip="Change in effective tax rate (tax ÷ taxable income) from first to most recent year.">Effective Tax Rate Change</Tip></div>
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

                      {/* Tax Burden Comparison (bar) */}
                      <div className="tv-chart-block">
                        <div className="tv-chart-label"><Tip tip="How much of your income went to taxes each year.">Tax Burden Comparison</Tip></div>
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
                                cursor={false}
                              />
                              <Legend iconType="square" wrapperStyle={{ fontFamily: "Space Mono, monospace", fontSize: 10, paddingTop: 10, color: "#6b7280" }} />
                              <Bar dataKey="taxRate"          fill="#b85c5c" name="Tax / Income (total income)"      radius={[3,3,0,0]} isAnimationActive={false}>
                                {hChartData.map((entry) => (
                                  <Cell key={entry.year} fill="#b85c5c" fillOpacity={
                                    (activeYear && entry.year !== String(activeYear) ? 0.3 : 1) * metricOpacity("tax")
                                  } />
                                ))}
                              </Bar>
                              <Bar dataKey="effectiveTaxRate" fill="#c47a3a" name="Effective Tax Rate (taxable income)" radius={[3,3,0,0]} isAnimationActive={false}>
                                {hChartData.map((entry) => (
                                  <Cell key={entry.year} fill="#c47a3a" fillOpacity={
                                    (activeYear && entry.year !== String(activeYear) ? 0.3 : 1) * metricOpacity("etr")
                                  } />
                                ))}
                              </Bar>
                            </BarChart>
                          </ResponsiveContainer>
                          <div style={{ display: "flex", gap: 16, fontFamily: "var(--mono)", fontSize: 10, color: "var(--muted)", marginTop: 8, justifyContent: "center" }}>
                            <Tip tip="Total tax ÷ taxable income. Your true tax rate on income subject to tax.">Effective Tax Rate (taxable income) ?</Tip>
                            <Tip tip="Total tax ÷ total income (before deductions). Always lower than Effective Tax Rate.">Tax / Income (total income) ?</Tip>
                          </div>
                        </div>
                      </div>

                      {/* Trend narrative */}
                      {overriddenInsights.length > 0 && (
                        <div className="tv-iblock">
                          <div className="tv-iblock-title">Trend Narrative</div>
                          {overriddenInsights.map((t, i) => (
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
                                        ■ {d.name} {d.name === "Cap Gains" && vCapLoss ? "net loss" : d.value.toFixed(1) + "%"}
                                      </span>
                                    ))}
                                  </div>
                                  {vCapLoss != null && (
                                    <div style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--danger)", textAlign: "center", marginTop: 6, opacity: 0.8 }}>
                                      Capital losses of ${vCapLoss.toLocaleString()} offset total income this year and are not shown in composition above.
                                    </div>
                                  )}
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

                      {/* Health Score card */}
                      {vMetric?.healthScore != null && (
                        <div style={{ marginTop: 16, padding: "16px 20px", background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 10, display: "flex", alignItems: "center", gap: 20 }}>
                          <div style={{ textAlign: "center", flexShrink: 0 }}>
                            <div style={{ fontFamily: "var(--mono)", fontSize: 36, fontWeight: 700, color: healthColorMap[vMetric.healthColor], lineHeight: 1 }}>{vMetric.healthScore}</div>
                            <div style={{ fontFamily: "var(--mono)", fontSize: 9, letterSpacing: "0.1em", color: "var(--muted)", marginTop: 4 }}>HEALTH SCORE</div>
                          </div>
                          <div>
                            <div style={{ fontFamily: "var(--mono)", fontSize: 13, fontWeight: 700, color: healthColorMap[vMetric.healthColor], marginBottom: 4 }}>{vMetric.healthLabel}</div>
                            <div style={{ fontSize: 12, color: "var(--muted)", lineHeight: 1.6 }}>
                              Based on income trajectory, tax efficiency, deduction structure, and signal quality.
                              {vMetric.primarySignal && (
                                <span style={{ color: healthColorMap[vMetric.healthColor] }}>{" "}Primary flag: {vMetric.primarySignal.flag.replace(/_/g, " ")}</span>
                              )}
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Signal Quality card */}
                      {vMetric.primarySignal && (
                        <div className="tv-iblock" style={{
                          marginTop: 20,
                          borderColor: vMetric.primarySignal.severity === "POSITIVE" ? "var(--success)"
                            : vMetric.primarySignal.severity === "MEDIUM" ? "var(--accent)"
                            : "var(--danger)",
                        }}>
                          <div className="tv-iblock-title" style={{
                            borderLeftColor: vMetric.primarySignal.severity === "POSITIVE" ? "var(--success)"
                              : vMetric.primarySignal.severity === "MEDIUM" ? "var(--accent)"
                              : "var(--danger)",
                          }}>Signal Quality</div>
                          <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 8 }}>
                            <div>
                              <span style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--muted)", letterSpacing: "0.08em" }}>STATUS </span>
                              <span style={{ fontFamily: "var(--mono)", fontSize: 12, fontWeight: 700, color: "var(--text)" }}>
                                {vMetric.primarySignal.flag.replace(/_/g, " ")}
                              </span>
                            </div>
                            <div>
                              <span style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--muted)", letterSpacing: "0.08em" }}>SEVERITY </span>
                              <span style={{
                                fontFamily: "var(--mono)", fontSize: 12, fontWeight: 700,
                                color: vMetric.primarySignal.severity === "POSITIVE" ? "var(--success)"
                                  : vMetric.primarySignal.severity === "MEDIUM" ? "var(--accent)"
                                  : "var(--danger)",
                              }}>{vMetric.primarySignal.severity}</span>
                            </div>
                          </div>
                          <p style={{ fontSize: 13, color: "var(--text)", lineHeight: 1.7 }}>
                            {vMetric.primarySignal.override}
                          </p>
                        </div>
                      )}

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
                    {overriddenInsights.length > 0 && (
                      <div className="tv-iblock">
                        <div className="tv-iblock-title">Multi-Year Trend</div>
                        {overriddenInsights.map((t, i) => (
                          <p key={i}
                            className={activeMetric ? (t.metric === activeMetric ? "tv-insight-active" : "tv-insight-dim") : ""}
                            onMouseEnter={() => setActiveMetric(t.metric)}
                            onMouseLeave={() => setActiveMetric(null)}
                          >{t.text}</p>
                        ))}
                        {nrTransitionYear && (
                          <p style={{ color: "var(--accent)" }}>
                            Your tax profile changed materially in {nrTransitionYear} as you transitioned from non-resident (1040-NR) to U.S. resident filing. This expanded your taxable base and increased exposure to ordinary income tax rates.
                          </p>
                        )}
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
                          {peakRiskYear === r.year && (
                            <p style={{ color: "var(--danger)", fontSize: 12 }}>
                              {r.year} was your most tax-exposed year: peak income, highest effective tax rate, and lowest deduction efficiency across all years analyzed. This is the highest-leverage year for retroactive optimization review.
                            </p>
                          )}
                          {nrTransitionYear === r.year && (
                            <p style={{ color: "var(--accent)", fontSize: 12 }}>
                              Your tax profile changed materially in {r.year} as you transitioned from non-resident (1040-NR) to U.S. resident filing. This expanded your taxable base and increased exposure to ordinary income tax rates.
                            </p>
                          )}
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

              {/* Caveats */}
              {activeTab === "caveats" && (
                <>
                  <div className="tv-canvas-title">
                    Caveats
                    <span style={{ color: "var(--muted)", fontSize: 10 }}>what this report does not capture</span>
                  </div>
                  <div className="tv-iblock" style={{ borderColor: "var(--border)" }}>
                    <div className="tv-iblock-title">Caveats</div>
                    <p style={{ color: "var(--muted)", fontSize: 12, marginBottom: 14, lineHeight: 1.7 }}>
                      Your tax return (Form 1040) shows what was taxed — not your full financial picture. Here are a few things it doesn't fully capture:
                    </p>
                    {[
                      { title: "Investments you didn't sell", text: "If your investments went up or down but you didn't sell them, it won't show here. Your real financial situation could be better — or worse — than this report suggests." },
                      { title: "Changes in your overall wealth", text: "Things like your home increasing in value or your business growing are not included. Your net worth may have changed without showing up on your tax return." },
                      { title: "Income you haven't received yet", text: "Future bonuses, stock vesting, or deferred pay aren't included. Next year could look very different." },
                      { title: "Missed opportunities to lower taxes", text: "This report shows what you paid — not what you could have saved. Things like retirement contributions or tax strategies may reduce your taxes but aren't visible here." },
                      { title: "One-time events", text: "A big gain, job change, or unusual income can make one year look very different. It may not reflect your normal situation." },
                    ].map((item, i) => (
                      <div key={i} style={{ marginBottom: 10 }}>
                        <p style={{ fontWeight: 700, fontSize: 12, color: "var(--text)", marginBottom: 2 }}>{i + 1}. {item.title}</p>
                        <p style={{ fontSize: 12, color: "rgba(255,255,255,0.6)", lineHeight: 1.65, paddingLeft: 16 }}>{item.text}</p>
                      </div>
                    ))}
                    <p style={{ color: "var(--accent)", fontSize: 13, textAlign: "center", marginTop: 16, fontFamily: "var(--mono)", fontWeight: 500 }}>
                      Think of this as a snapshot — not the full story of your finances.
                    </p>
                    <p style={{ fontSize: 10, color: "var(--muted)", textAlign: "center", marginTop: 10, borderTop: "1px solid var(--border)", paddingTop: 10, lineHeight: 1.6 }}>
                      This report is based solely on filed tax return data.<br />It is not financial or tax advice.
                    </p>
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

        {/* ── Print Report — 4-page restructured layout ── */}
        {results.length > 0 && (() => {
          // Pre-compute deep analysis data (shared across pages)
          const _sorted = [...results].sort((a, b) => a.year - b.year);
          const _multi = _sorted.length > 1;
          const _first = _sorted[0];
          const _last  = _sorted[_sorted.length - 1];
          const _mFirst = metricMap[_first.year];
          const _mLast  = metricMap[_last.year];
          const _fmtD = (v) => v != null ? "$" + Math.round(v).toLocaleString() : "—";
          const _fmtP = (v) => v != null ? (v * 100).toFixed(1) + "%" : "—";
          const _lb = _first.summary?.totalIncome != null && _first.summary.totalIncome < 10000;

          // Signal tags
          const _latestM = _tdN ? metricMap[_tdN.year] : null;
          const _latestR = _tdN ? results.find(r => r.year === _tdN.year) : null;
          const _tags = [];
          if (incomeCagr != null && incomeCagr > 0.12) {
            _tags.push({ text: "High Growth", cls: "pos" });
            if (strategyPhase?.phase === "High Growth with Recent Correction") _tags.push({ text: "Recent Correction", cls: "warn" });
          }
          else if (incomeCagr != null && incomeCagr < -0.05) _tags.push({ text: "Income Declining", cls: "neg" });
          if (taxRateDelta != null && taxRateDelta > 0.02) _tags.push({ text: "Rising Tax", cls: "neg" });
          if (_latestM?.deductionEfficiency != null && _latestM.deductionEfficiency < 0.1) _tags.push({ text: "Low Efficiency", cls: "warn" });
          else if (_latestM?.deductionEfficiency != null && _latestM.deductionEfficiency > 0.2) _tags.push({ text: "Strong Deductions", cls: "pos" });
          if (_latestM?.afterTaxMargin != null && _latestM.afterTaxMargin > 0.8) _tags.push({ text: "Strong Take-Home", cls: "pos" });

          const _headline = _tags.length > 0 ? _tags.slice(0, 2).map(t => t.text.toUpperCase()).join(" · ") : "FINANCIAL OVERVIEW";

          const _explain = (() => {
            if (incomeCagr != null && incomeCagr > 0.12 && taxRateDelta != null && taxRateDelta > 0.02) return "Income rising fast, but tax efficiency is not keeping pace.";
            if (incomeCagr != null && incomeCagr > 0.12) return "Income growing rapidly — early optimization has the highest lifetime impact.";
            if (taxRateDelta != null && taxRateDelta > 0.02) return "Tax burden increasing — more income is being lost to taxes.";
            if (_latestM?.deductionEfficiency != null && _latestM.deductionEfficiency < 0.1) return "Deductions underutilized — taxable income is close to total income.";
            if (_latestM?.afterTaxMargin != null && _latestM.afterTaxMargin > 0.8) return "Strong after-tax performance — most of total income preserved after tax.";
            return "Review your income structure and tax efficiency below.";
          })();

          const _impact = (() => {
            if (taxRateDelta != null && taxRateDelta > 0.02 && incomeCagr != null && incomeCagr > 0.1) return "Without adjustment, taxes will scale faster than income growth.";
            if (_latestM?.effectiveTaxRate != null && _latestM.effectiveTaxRate > 0.2) return "High tax burden — over 20% of income going to federal tax.";
            if (_latestM?.deductionEfficiency != null && _latestM.deductionEfficiency < 0.08) return "Almost no taxable income reduced through deductions.";
            return null;
          })();

          // Priority actions
          const _actions = [];
          if (_latestM?.deductionEfficiency != null && _latestM.deductionEfficiency < 0.15 && _latestR?.summary?.totalIncome) {
            const _deGap = 0.20 - _latestM.deductionEfficiency;
            const _shelterAmt = Math.round(_deGap * _latestR.summary.totalIncome);
            _actions.push({ action: "Maximize pre-tax contributions (401k, IRA, HSA)", reason: `Your deduction efficiency is ${(_latestM.deductionEfficiency * 100).toFixed(1)}% — a gap of ${(_deGap * 100).toFixed(1)}pp from the 20% optimization threshold. This represents approximately $${_shelterAmt.toLocaleString()} of additional income that could be sheltered through pre-tax contributions. ${_latestM.deductionEfficiency < 0.08 ? "Each dollar contributed pre-tax reduces taxable income dollar-for-dollar at your current marginal rate." : "Increasing 401k/IRA/HSA contributions is the highest-leverage action to close this gap."}` });
          }
          if (_latestM?.deductionEfficiency != null && _latestM.deductionEfficiency < 0.1) _actions.push({ action: "Reduce taxable income exposure", reason: `Beyond retirement, evaluate HSA eligibility, student loan interest deduction, and above-the-line adjustments.` });
          if (taxRateDelta != null && taxRateDelta > 0.02) _actions.push({ action: "Review tax withholding accuracy", reason: `Effective tax rate increased by ${(taxRateDelta * 100).toFixed(1)} percentage points. Verify W-4 reflects current income.` });
          if (incomeCagr != null && incomeCagr > 0.08) _actions.push({ action: "Shift income mix toward tax-advantaged sources", reason: "Capital gains and qualified dividends are taxed at 0–20% vs ordinary rates of 22–37%." });
          if (_actions.length === 0) _actions.push({ action: "Conduct annual deduction and contribution audit", reason: "Ensure all eligible deductions are claimed and pre-tax contributions are near annual limits." });

          // Prose summary for page 1
          const _proseParts = [];
          if (_latestR && _latestM) {
            _proseParts.push(`In ${_latestR.year}, you earned ${_fmtD(_latestR.summary?.totalIncome)} in total income and kept ${_fmtD(_latestM.afterTaxIncome)} after federal taxes — an effective tax rate of ${_fmtP(_latestM.effectiveTaxRate)} (based on taxable income)${_latestM.afterTaxMargin != null ? `, with an after-tax margin (share of total income kept after tax) of ${_fmtP(_latestM.afterTaxMargin)}` : ""}.`);
            if (_multi && taxRateDelta != null && Math.abs(taxRateDelta) > 0.01) {
              _proseParts.push(`Over ${_first.year}–${_last.year}, your effective tax rate ${taxRateDelta > 0 ? "increased" : "decreased"} by ${Math.abs(taxRateDelta * 100).toFixed(1)} percentage points${_lb ? " as income moved from a near-zero base into taxable brackets" : ""}.`);
            }
            if (_latestM.deductionEfficiency != null && _latestM.deductionEfficiency < 0.1) {
              _proseParts.push(`Deduction efficiency is low at ${(_latestM.deductionEfficiency * 100).toFixed(1)}% — the primary lever for improving after-tax income is increasing pre-tax contributions.`);
            }
          }

          // Income helper
          const _incOf = (r) => { const inc = r.income ?? {}; return { wages: inc.wages ?? 0, capitalGains: inc.capitalGains ?? 0, dividends: inc.dividends ?? 0, interest: inc.interest ?? 0, other: inc.additionalIncome ?? 0 }; };

          // Deep analysis bullet arrays (same logic as before, computed once)
          const _incomeBullets = [], _taxBullets = [], _dragBullets = [], _afterTaxBullets = [], _compBullets = [], _dedBullets = [], _summaryBullets = [];

          // Income trend
          if (_multi) {
            const fi = _first.summary?.totalIncome, li = _last.summary?.totalIncome;
            if (fi && li) { if (_lb) { _incomeBullets.push(`Income expanded from ${_fmtD(fi)} (${_first.year}) to ${_fmtD(li)} (${_last.year}). The starting base was below $10,000, which distorts percentage-based metrics.`); } else { const g = ((li - fi) / fi * 100).toFixed(0); _incomeBullets.push(`Total income: ${_fmtD(fi)} (${_first.year}) → ${_fmtD(li)} (${_last.year}) — ${g}% total change.`); } }
            if (incomeCagr != null && !_lb) _incomeBullets.push(`Annualized growth rate: ${(incomeCagr * 100).toFixed(1)}%. ${incomeCagr > 0.2 ? "Exceptionally fast — sustainability should be monitored." : incomeCagr > 0.08 ? "Above-average growth creating compounding value." : incomeCagr > 0 ? "Modest growth near inflation levels." : "Income contracting in real terms."}`);
            else if (_lb) _incomeBullets.push(`Low-base distortion: ${_first.year} income of ${_fmtD(_first.summary?.totalIncome)} suppresses percentage-based metrics.`);
            const incs = _sorted.map(r => r.summary?.totalIncome).filter(v => v != null);
            if (incs.length >= 3) { const yoy = incs.slice(1).map((v, i) => `${_sorted[i].year}→${_sorted[i+1].year}: ${((v - incs[i]) / incs[i] * 100).toFixed(0)}%`).join("; "); _incomeBullets.push(`Year-over-year: ${yoy}.`); }
          } else if (_first.summary?.totalIncome) _incomeBullets.push(`Single-year total income: ${_fmtD(_first.summary.totalIncome)}.`);

          // Tax trend (condensed: range + delta, not per-year)
          if (_multi) {
            const etrVals = _sorted.map(r => ({ y: r.year, e: metricMap[r.year]?.effectiveTaxRate })).filter(x => x.e != null);
            if (etrVals.length >= 2) _taxBullets.push(`Effective tax rate: ${_fmtP(etrVals[0].e)} (${etrVals[0].y}) → ${_fmtP(etrVals[etrVals.length-1].e)} (${etrVals[etrVals.length-1].y}). ${etrVals[etrVals.length-1].e > 0.25 ? "Current rate is high — wage-heavy in upper brackets." : etrVals[etrVals.length-1].e > 0.15 ? "Moderate burden at current level." : "Current rate is relatively low."}`);
            if (taxRateDelta != null) { if (taxRateDelta > 0.02) _taxBullets.push(`Rate increased ${(taxRateDelta * 100).toFixed(1)}pp${_lb ? " — driven by income entering taxable brackets from near-zero base." : " — income outpacing deduction scaling."}`); else if (taxRateDelta < -0.02) _taxBullets.push(`Rate decreased ${Math.abs(taxRateDelta * 100).toFixed(1)}pp — favorable shift.`); else _taxBullets.push(`Rate stable (${(taxRateDelta * 100).toFixed(1)}pp change).`); }
          } else if (_mFirst?.effectiveTaxRate != null) _taxBullets.push(`Effective tax rate: ${_fmtP(_mFirst.effectiveTaxRate)}.`);

          // Tax drag
          if (_multi) { const fa = _mFirst?.afterTaxIncome, la = _mLast?.afterTaxIncome, fi2 = _first.summary?.totalIncome, li2 = _last.summary?.totalIncome; if (fa && la && fi2 && li2 && fi2 > 0 && fa > 0) { const id = li2 - fi2, ad = la - fa; if (id > 0) { const mr = (id - ad) / id; _dragBullets.push(`Over ${_first.year}–${_last.year}: income +${_fmtD(id)}, after-tax +${_fmtD(ad)}. Taxes absorbed ${_fmtD(id - ad)} of income growth (${(mr * 100).toFixed(0)}%). Without optimization, this leakage will compound as income rises.`); _dragBullets.push(`Per $1.00 earned: $${mr.toFixed(2)} to taxes, $${(1 - mr).toFixed(2)} retained (${(mr * 100).toFixed(0)}% absorption rate).`); } } const ms = _sorted.map(r => ({ y: r.year, m: metricMap[r.year]?.afterTaxMargin })).filter(x => x.m != null); if (ms.length >= 2) { const d = ms[ms.length-1].m - ms[0].m; if (Math.abs(d) > 0.02) _dragBullets.push(`After-tax margin ${d > 0 ? "improved" : "declined"} from ${_fmtP(ms[0].m)} to ${_fmtP(ms[ms.length-1].m)}.`); } }

          // After-tax (condensed: first→last + latest margin only)
          if (_multi) {
            if (_mFirst?.afterTaxIncome && _mLast?.afterTaxIncome) _afterTaxBullets.push(`After-tax income: ${_fmtD(_mFirst.afterTaxIncome)} (${_first.year}) → ${_fmtD(_mLast.afterTaxIncome)} (${_last.year}).`);
            if (_mLast?.afterTaxMargin != null) _afterTaxBullets.push(`${_last.year} after-tax margin: ${_fmtP(_mLast.afterTaxMargin)} of total income kept after tax — ${_mLast.afterTaxMargin > 0.85 ? "strong" : _mLast.afterTaxMargin > 0.7 ? "moderate" : "significant tax drag"}.`);
          } else if (_mFirst?.afterTaxIncome != null) _afterTaxBullets.push(`After-tax income: ${_fmtD(_mFirst.afterTaxIncome)}, margin: ${_fmtP(_mFirst.afterTaxMargin)}.`);

          // Composition (condensed: latest year only + trend note if multi)
          {
            const vLast = _incOf(_last); const tLast = vLast.wages + vLast.capitalGains + vLast.dividends + vLast.interest + vLast.other;
            if (tLast > 0) { const wL = vLast.wages / tLast; _compBullets.push(`${_last.year}: ${wL >= 0.95 ? "Entirely W-2 wages — ordinary rates apply" : wL >= 0.8 ? `${(wL*100).toFixed(0)}% wages, ${((1-wL)*100).toFixed(0)}% investment` : `Mixed — ${(wL*100).toFixed(0)}% wages, ${((1-wL)*100).toFixed(0)}% investment/other`}.`); }
            if (_multi) { const vF = _incOf(_first); const tF = vF.wages + vF.capitalGains + vF.dividends + vF.interest + vF.other; if (tF > 0 && tLast > 0) { const wF = vF.wages / tF; const wL2 = vLast.wages / tLast; if (Math.abs(wL2 - wF) > 0.05) _compBullets.push(`Wage concentration ${wL2 > wF ? "increased" : "decreased"} from ${(wF*100).toFixed(0)}% to ${(wL2*100).toFixed(0)}% over the period.`); else if (wL2 >= 0.95 && wF >= 0.95) _compBullets.push("Income remains fully W-2 across all years — limited tax flexibility."); } }
          }

          // Deductions (condensed: latest + trend delta only)
          if (_mLast?.deductionEfficiency != null) { const d = _mLast.deductionEfficiency; _dedBullets.push(`${_last.year}: ${_fmtP(d)} of total income offset by deductions — ${d > 0.2 ? "strong sheltering" : d > 0.1 ? "moderate, room to increase" : "low, pre-tax accounts are primary lever"}.`); }
          if (_multi && _mFirst?.deductionEfficiency != null && _mLast?.deductionEfficiency != null) { const d = _mLast.deductionEfficiency - _mFirst.deductionEfficiency; if (Math.abs(d) > 0.03) _dedBullets.push(`Efficiency ${d > 0 ? "improved" : "declined"} by ${Math.abs(d * 100).toFixed(1)}pp over ${_first.year}–${_last.year}.`); }

          // Summary
          if (_multi) { if (_lb && incomeCagr != null && incomeCagr > 0.1 && taxRateDelta != null && taxRateDelta > 0.03) _summaryBullets.push("Income transitioned from minimal base into taxable territory. Window for establishing tax-efficient habits is now."); else if (incomeCagr != null && incomeCagr > 0.1 && taxRateDelta != null && taxRateDelta > 0.03) _summaryBullets.push("Income growing aggressively but tax burden growing disproportionately."); else if (incomeCagr != null && incomeCagr < 0) _summaryBullets.push("Income contracting — shift to defensive optimization."); if (_mLast?.deductionEfficiency != null && _mLast.deductionEfficiency < 0.08) _summaryBullets.push(`Deduction efficiency of ${_fmtP(_mLast.deductionEfficiency)} is the single largest optimization opportunity.`); if (_mLast?.afterTaxMargin != null) _summaryBullets.push(`Retention: ${_fmtP(_mLast.afterTaxMargin)} — $${(_mLast.afterTaxMargin).toFixed(2)} kept per $1.00 earned.`); }

          // What This Means
          const _wtmBullets = [];
          if (incomeCagr != null && incomeCagr > 0.1 && taxRateDelta != null && taxRateDelta > 0.01) _wtmBullets.push(`Effective tax rate rising ${(taxRateDelta * 100).toFixed(1)}pp while income grows — entering higher tax exposure phase.`);
          else if (incomeCagr != null && incomeCagr > 0.1) _wtmBullets.push(`Income at ${_latestR ? _fmtD(_latestR.summary?.totalIncome) : "current level"} — tax drag will compound without deduction scaling.`);
          if (taxRateDelta != null && taxRateDelta > 0.02) _wtmBullets.push(`The ${(taxRateDelta * 100).toFixed(1)}pp rate increase means take-home margin will continue to compress without structural changes.`);
          if (_latestM?.deductionEfficiency != null && _latestM.deductionEfficiency < 0.1) _wtmBullets.push(`At ${(_latestM.deductionEfficiency * 100).toFixed(1)}% deduction efficiency, early optimization has the highest lifetime impact.`);
          if (_latestM?.afterTaxMargin != null && _latestM.afterTaxMargin > 0.85) _wtmBullets.push(`${(_latestM.afterTaxMargin * 100).toFixed(1)}% after-tax margin is strong — priority is protecting this margin as income scales.`);
          if (_wtmBullets.length === 0 && _latestM?.effectiveTaxRate != null) _wtmBullets.push(`Current rate ${_fmtP(_latestM.effectiveTaxRate)} — review deduction strategy annually.`);
          // Closing directive — always present
          if (taxRateDelta != null && taxRateDelta > 0.01) {
            _wtmBullets.push("You are entering a higher tax exposure phase. Without changes, a growing share of your income will be taxed at higher marginal rates.");
            _wtmBullets.push("What to do next: (1) Increase pre-tax contributions immediately. (2) Review withholding and deduction strategy. (3) Shift future income toward tax-advantaged sources.");
          } else if (_latestM?.deductionEfficiency != null && _latestM.deductionEfficiency < 0.15) {
            _wtmBullets.push("Pre-tax contribution capacity remains underused — this is the single largest optimization lever available.");
            _wtmBullets.push("What to do next: (1) Increase pre-tax contributions immediately. (2) Evaluate HSA and above-the-line adjustments. (3) Review deduction strategy annually as income scales.");
          }

          const _deepSections = [
            { title: "Income Trend Analysis", items: _incomeBullets },
            { title: "Tax Burden Analysis", items: _taxBullets },
            { title: "Tax Drag & Lost Efficiency", items: _dragBullets },
            { title: "After-Tax Performance", items: _afterTaxBullets },
            { title: "Income Structure & Composition", items: _compBullets },
            { title: "Deduction Efficiency Analysis", items: _dedBullets },
            { title: "Financial Trajectory — Summary", items: _summaryBullets },
          ].filter(s => s.items.length > 0);

          return (
          <div className="tv-print-report">

            {/* ════════════ PAGE 1 — EXECUTIVE SUMMARY ════════════ */}
            <div className="tv-pr-header">
              <div className="tv-pr-logo">TaxVista</div>
              <div className="tv-pr-title">Financial Intelligence Report</div>
              {reportName && <div style={{ fontSize: "11pt", color: "#333", marginTop: "4pt" }}>Prepared for: <strong style={{ fontFamily: "'Arial Unicode MS', 'Noto Sans', sans-serif", unicodeBidi: "normal" }}>{reportName}</strong></div>}
              <div className="tv-pr-subtitle">
                {trendData.length > 0 && `Tax years ${trendData[0].year}–${trendData[trendData.length - 1].year}`}
                {" · "}Generated {new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}
              </div>
            </div>

            {/* Position headline */}
            <div className="tv-pr-position">
              <div className="tv-pr-section-title">Your Financial Position</div>
              <div className="tv-pr-position-headline">{_headline}</div>
              <div className="tv-pr-position-explain">{_explain}</div>
              {_impact && <div className="tv-pr-position-impact">{_impact}</div>}
              {_tags.length > 0 && <div className="tv-pr-tag-row">{_tags.map(t => <span key={t.text} className={`tv-pr-tag ${t.cls}`}>{t.text}</span>)}</div>}
            </div>

            {/* 2x2 KPI grid */}
            {_latestR && _latestM && (
              <div className="tv-pr-section">
                <div className="tv-pr-kpi-grid">
                  {[
                    { label: "Gross Income", value: $v(_latestR.summary?.totalIncome) },
                    { label: "After-Tax Income", value: $v(_latestM.afterTaxIncome) },
                    { label: "Effective Tax Rate", value: pf(_latestM.effectiveTaxRate) },
                    { label: "After-Tax Margin", value: pf(_latestM.afterTaxMargin) },
                    { label: "Health Score", value: _latestM.healthScore != null ? `${_latestM.healthScore} — ${_latestM.healthLabel}` : "—" },
                  ].map(k => (
                    <div className="tv-pr-kpi-box" key={k.label}>
                      <div className="tv-pr-kpi-label">{k.label}</div>
                      <div className="tv-pr-kpi-value">{k.value}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Dual tax rate clarification */}
            {_latestM?.effectiveTaxRate != null && _latestM?.taxToIncome != null && (
              <div className="tv-pr-insight-text" style={{ fontSize: "9pt", color: "#555", marginBottom: "10pt", lineHeight: 1.6 }}>
                Effective Tax Rate ({(_latestM.effectiveTaxRate * 100).toFixed(1)}%) is based on taxable income after deductions.
                Tax / Total Income ({(_latestM.taxToIncome * 100).toFixed(1)}%) is based on total income before deductions.
                Both figures are shown for complete transparency.
              </div>
            )}

            {/* Phase badge */}
            {strategyPhase && <div className="tv-pr-phase-badge">{strategyPhase.phase}</div>}

            {/* Prose summary */}
            {_proseParts.length > 0 && <div className="tv-pr-prose">{_proseParts.join(" ")}</div>}

            {/* Priority Actions on page 1 */}
            <div className="tv-pr-section">
              <div className="tv-pr-section-title">Priority Actions</div>
              {_actions.map((a, i) => (
                <div key={i} style={{ marginBottom: "10pt", overflow: "hidden" }}>
                  <span className="tv-pr-action-num">{i + 1}.</span>
                  <div style={{ overflow: "hidden" }}>
                    <div className="tv-pr-insight-text" style={{ fontWeight: 700 }}>{a.action}</div>
                    <div className="tv-pr-insight-text" style={{ color: "#444", paddingLeft: "2pt" }}>{a.reason}</div>
                  </div>
                </div>
              ))}
            </div>

            {_lb && <div style={{ fontSize: "8pt", color: "#888", paddingTop: "6pt", borderTop: "1pt solid #ddd", lineHeight: 1.5, marginBottom: "8pt" }}>* Low base: {trendData[0]?.year} income ${Math.round(trendData[0]?.totalIncome ?? 0).toLocaleString()} is below $10,000 — percentage growth rates suppressed.</div>}

            {/* ════════════ HORIZONTAL ANALYSIS (continues on same page) ════════════ */}
            <div className="tv-pr-section-title" style={{ fontSize: "10pt", marginBottom: "16pt" }}>How Your Numbers Have Changed Over Time</div>

            {/* Multi-Year Table */}
            {_multi && (
              <div className="tv-pr-section">
                <div className="tv-pr-section-title">Multi-Year Summary</div>
                <table className="tv-pr-table">
                  <thead><tr>{["Year", "Gross Income", "After-Tax", "Tax / Income", "Eff. Tax Rate", "Deduction Eff."].map(h => <th key={h}>{h}</th>)}</tr></thead>
                  <tbody>
                    {[...results].sort((a, b) => b.year - a.year).map(r => { const m = metricMap[r.year]; return (
                      <tr key={r.year}>
                        <td>{r.year}</td>
                        <td>{$v(r.summary?.totalIncome)}</td>
                        <td className="pr-pos">{$v(m?.afterTaxIncome)}</td>
                        <td className={m?.taxToIncome > 0.2 ? "pr-neg" : ""}>{pf(m?.taxToIncome)}</td>
                        <td className={m?.effectiveTaxRate > 0.2 ? "pr-neg" : ""}>{pf(m?.effectiveTaxRate)}</td>
                        <td className={m?.deductionEfficiency > 0.2 ? "pr-pos" : m?.deductionEfficiency != null && m.deductionEfficiency < 0.1 ? "pr-neg" : ""}>{pf(m?.deductionEfficiency)}</td>
                      </tr>); })}
                  </tbody>
                </table>
                {(incomeCagr != null || afterTaxCagr != null || taxRateDelta != null) && (
                  <div className="tv-pr-trend-row">
                    {incomeCagr != null && <div className="tv-pr-trend-kpi"><div className="tv-pr-trend-label">Income Growth (annualized)</div><div className="tv-pr-trend-value">{_lowBase ? "Low base*" : (incomeCagr >= 0 ? "+" : "") + pf(incomeCagr)}</div></div>}
                    {afterTaxCagr != null && <div className="tv-pr-trend-kpi"><div className="tv-pr-trend-label">Take-Home Growth (annualized)</div><div className="tv-pr-trend-value">{_lowBase ? "Low base*" : (afterTaxCagr >= 0 ? "+" : "") + pf(afterTaxCagr)}</div></div>}
                    {taxRateDelta != null && <div className="tv-pr-trend-kpi"><div className="tv-pr-trend-label">Tax Rate Shift (first→last)</div><div className="tv-pr-trend-value">{taxRateDelta > 0 ? "+" : ""}{(taxRateDelta * 100).toFixed(1)}pp</div></div>}
                  </div>
                )}
              </div>
            )}

            {/* Labeled trend narrative */}
            {overriddenInsights.length > 0 && (
              <div className="tv-pr-section">
                <div className="tv-pr-section-title">Trend Narrative</div>
                {overriddenInsights.map((t, i) => {
                  const labelMap = { income: "Income:", afterTax: "After-Tax:", tax: "Tax Efficiency:" };
                  return (
                    <div className="tv-pr-trend-bullet" key={i}>
                      <span className="tv-pr-trend-bullet-label">{labelMap[t.metric] ?? "Insight:"}</span>
                      {t.text}
                    </div>
                  );
                })}
                {nrTransitionYear && (
                  <div className="tv-pr-trend-bullet">
                    <span className="tv-pr-trend-bullet-label">Filing Status:</span>
                    Your tax profile changed materially in {nrTransitionYear} as you transitioned from non-resident (1040-NR) to U.S. resident filing. This expanded your taxable base and increased exposure to ordinary income tax rates.
                  </div>
                )}
              </div>
            )}

            {/* ════════════ PAGE 3 — VERTICAL ANALYSIS ════════════ */}
            <div className="tv-pr-section-title" style={{ fontSize: "10pt", marginBottom: "16pt" }}>Year-by-Year Deep Dive</div>

            {[...results].sort((a, b) => b.year - a.year).map(r => {
              const m = metricMap[r.year];
              if (!m) return null;
              const inc = _incOf(r);
              const incTotal = inc.wages + inc.capitalGains + inc.dividends + inc.interest + inc.other;
              const pctOf = (v) => incTotal > 0 ? ((v / incTotal) * 100).toFixed(1) + "%" : "—";

              return (
                <div className="tv-pr-year-block" key={r.year}>
                  <div className="tv-pr-year-header">{r.year}</div>
                  <div className="tv-pr-year-cols">
                    {/* Left: Income composition */}
                    <div>
                      <div className="tv-pr-year-col-title">Income Composition</div>
                      {[
                        { l: "Wages", v: pctOf(inc.wages) },
                        { l: "Capital Gains", v: inc.capitalGains < 0 ? pctOf(inc.capitalGains) + " (net loss)" : pctOf(inc.capitalGains) },
                        { l: "Dividends", v: pctOf(inc.dividends) },
                        { l: "Interest", v: pctOf(inc.interest) },
                        { l: "Other", v: pctOf(inc.other) },
                      ].map(row => (
                        <div className="tv-pr-year-row" key={row.l}>
                          <span className="tv-pr-year-row-label">{row.l}</span>
                          <span className="tv-pr-year-row-val">{row.v}</span>
                        </div>
                      ))}
                    </div>
                    {/* Right: Key ratios */}
                    <div>
                      <div className="tv-pr-year-col-title">Key Ratios</div>
                      {[
                        { l: "AGI / Total Income", v: pf(m.agiRatio) },
                        { l: "Taxable / AGI", v: pf(m.taxableRatio) },
                        { l: "Eff. Tax Rate", v: pf(m.effectiveTaxRate) },
                        { l: "After-Tax Margin", v: pf(m.afterTaxMargin) },
                        { l: "Deduction Eff.", v: pf(m.deductionEfficiency) },
                      ].map(row => (
                        <div className="tv-pr-year-row" key={row.l}>
                          <span className="tv-pr-year-row-label">{row.l}</span>
                          <span className="tv-pr-year-row-val">{row.v}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  {/* Insights for this year */}
                  {m.insights?.summary?.map((s, i) => (
                    <div className="tv-pr-callout" key={i}>{s.text}</div>
                  ))}
                  {m.insights && (
                    <div style={{ marginTop: "6pt" }}>
                      {Object.entries(m.insights.signals).map(([key, sig]) =>
                        sig ? <span key={key} className={`tv-pr-signal ${sig.level}`}>{sig.label}</span> : null
                      )}
                    </div>
                  )}
                </div>
              );
            })}

            {/* ════════════ PAGE 4 — STRATEGIC ASSESSMENT + DEEP ANALYSIS ════════════ */}
            {/* Strategic Assessment */}
            {strategyPhase && (
              <div className="tv-pr-section">
                <div className="tv-pr-section-title">Strategic Assessment</div>
                <div className="tv-pr-trend-row" style={{ marginTop: 0, marginBottom: "10pt" }}>
                  <div className="tv-pr-trend-kpi"><div className="tv-pr-trend-label">Financial Phase</div><div className="tv-pr-trend-value">{strategyPhase.phase}</div></div>
                  <div className="tv-pr-trend-kpi"><div className="tv-pr-trend-label">Growth Rate (annualized)</div><div className="tv-pr-trend-value">{_lowBase ? "Low base*" : (strategyPhase.cagr * 100).toFixed(1) + "%"}</div></div>
                </div>
                {strategyPhase.characteristics && strategyPhase.characteristics.map((c, i) => <div className="tv-pr-bullet" key={i}>{c}</div>)}
                {strategyPhase.implication && <div className="tv-pr-callout" style={{ marginTop: "8pt" }}>{strategyPhase.implication}</div>}
              </div>
            )}

            {/* Deep analysis sections */}
            {_deepSections.map(s => (
              <div className="tv-pr-section" key={s.title}>
                <div className="tv-pr-section-title">{s.title}</div>
                {s.items.map((b, i) => <div className="tv-pr-bullet" key={i}>{b}</div>)}
              </div>
            ))}

            {/* What This Means */}
            {_wtmBullets.length > 0 && (
              <div className="tv-pr-section">
                <div className="tv-pr-section-title">What This Means</div>
                {_wtmBullets.map((b, i) => <div className="tv-pr-bullet" key={i}>{b}</div>)}
              </div>
            )}

            {/* Caveats */}
            <div className="tv-pr-section" style={{ marginTop: "28pt" }}>
              <div className="tv-pr-section-title">Caveats</div>
              <div className="tv-pr-insight-text" style={{ marginBottom: "10pt" }}>
                Your tax return (Form 1040) shows what was taxed — not your full financial picture. Here are a few things it doesn't fully capture:
              </div>
              {[
                { title: "Investments you didn't sell", text: "If your investments went up or down but you didn't sell them, it won't show here. Your real financial situation could be better — or worse — than this report suggests." },
                { title: "Changes in your overall wealth", text: "Things like your home increasing in value or your business growing are not included. Your net worth may have changed without showing up on your tax return." },
                { title: "Income you haven't received yet", text: "Future bonuses, stock vesting, or deferred pay aren't included. Next year could look very different." },
                { title: "Missed opportunities to lower taxes", text: "This report shows what you paid — not what you could have saved. Things like retirement contributions or tax strategies may reduce your taxes but aren't visible here." },
                { title: "One-time events", text: "A big gain, job change, or unusual income can make one year look very different. It may not reflect your normal situation." },
              ].map((item, i) => (
                <div key={i} style={{ marginBottom: "8pt" }}>
                  <div className="tv-pr-insight-text" style={{ fontWeight: 700 }}>{i + 1}. {item.title}</div>
                  <div className="tv-pr-insight-text" style={{ paddingLeft: "14pt", color: "#444" }}>{item.text}</div>
                </div>
              ))}
              <div className="tv-pr-insight-text" style={{ textAlign: "center", fontWeight: 600, fontStyle: "italic", marginTop: "14pt" }}>
                Think of this as a snapshot — not the full story of your finances.
              </div>
              <div style={{ borderTop: "1pt solid #ccc", marginTop: "10pt", paddingTop: "10pt", fontSize: "8pt", color: "#999", textAlign: "center", lineHeight: 1.6 }}>
                This report is based solely on filed tax return data.<br />It is not financial or tax advice.
              </div>
            </div>

            <div className="tv-pr-footer">
              TaxVista Financial Intelligence
              {" · "}Generated from your tax data — no documents stored
              {" · "}{new Date().getFullYear()}
            </div>

          </div>
          );
        })()}

      </div>
    </>
  );
}
