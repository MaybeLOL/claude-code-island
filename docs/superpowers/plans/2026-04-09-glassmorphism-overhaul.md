# Glassmorphism Visual Overhaul Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform Claude Code Island from its current purple-tinted pixel-art aesthetic to a macOS glassmorphism style with neutral frosted glass, line-art ghost mascot, tighter dimensions, and refined animations.

**Architecture:** CSS-only overhaul within `index.html` (styles, ghost SVG renderer, minor markup) plus 4 dimension constants in `main.js`. No new files, no new dependencies, no functional changes.

**Tech Stack:** CSS3, inline SVG, vanilla JS (Electron renderer)

**Spec:** `docs/superpowers/specs/2026-04-09-glassmorphism-overhaul-design.md`

---

### Task 1: Update main.js dimension constants

**Files:**
- Modify: `main.js:70-73`

- [ ] **Step 1: Update the four dimension constants**

In `main.js`, change:

```js
const COMPACT_WIDTH = 240;
const COMPACT_HEIGHT = 42;
const EXPANDED_WIDTH = 320;
const EXPANDED_HEIGHT = 380;
```

Was: 280, 48, 360, 420.

- [ ] **Step 2: Verify no other hardcoded dimension values exist**

Search `main.js` for `280`, `48`, `360`, `420` to confirm all dimension references use the constants. The only other numbers should be unrelated (port numbers, timeouts, etc).

- [ ] **Step 3: Commit**

```bash
git add main.js
git commit -m "feat(visual): update dimension constants for smaller island"
```

---

### Task 2: CSS — Root variables, glassmorphism surfaces, state colors

**Files:**
- Modify: `index.html` — `:root`, `.state-*`, `.pill`, `#island`, `.theme-light` CSS blocks

- [ ] **Step 1: Replace `:root` variables**

```css
:root {
  --hi: #c8c0e0; --body: #b0a8d0; --shadow: #6858a0; --face: #6858a0;
  --bg-tint: rgba(30,30,30,0.72);
  --spring: cubic-bezier(0.34, 1.56, 0.64, 1);
  --ios: cubic-bezier(0.25, 0.1, 0.25, 1);
}
```

- [ ] **Step 2: Replace state color classes**

```css
.state-idle    { --hi:#c8c0e0;--body:#b0a8d0;--shadow:#6858a0;--face:#6858a0;--bg-tint:rgba(30,30,30,0.72); }
.state-working { --hi:#f0c8a0;--body:#e0a878;--shadow:#c89068;--face:#5a3020;--bg-tint:rgba(35,28,22,0.72); }
.state-success { --hi:#a0e8b8;--body:#78c890;--shadow:#58a870;--face:#1a5838;--bg-tint:rgba(22,32,26,0.72); }
.state-error   { --hi:#e8b0b0;--body:#d08080;--shadow:#b06060;--face:#6a2020;--bg-tint:rgba(35,22,22,0.72); }
```

- [ ] **Step 3: Update `.pill` styles**

```css
.pill {
  background: var(--bg-tint);
  backdrop-filter: blur(60px); -webkit-backdrop-filter: blur(60px);
  border: 1px solid rgba(255,255,255,0.15);
  overflow: hidden;
  transition: all 0.3s var(--spring);
  box-shadow: 0 8px 32px rgba(0,0,0,0.3), inset 0 0.5px 0 rgba(255,255,255,0.12);
}
```

Remove the per-state `.state-working .pill`, `.state-success .pill`, `.state-error .pill` box-shadow overrides (they currently set `box-shadow:none` — no longer needed since the base shadow is now a neutral drop shadow).

- [ ] **Step 4: Update compact/expanded dimensions in CSS**

```css
#island.compact { width: 240px; height: 42px; }
#island.compact .pill { height: 42px; border-radius: 21px; }

#island.expanded { width: 320px; height: 380px; }
#island.expanded .pill { height: 380px; border-radius: 24px; }
```

- [ ] **Step 5: Update hover scale**

```css
#island.compact .pill:hover { transform: scale(1.015); }
```

- [ ] **Step 6: Update light theme overrides**

```css
.theme-light { --bg-tint: rgba(245,243,250,0.78); }
.theme-light .pill {
  border-color: rgba(0,0,0,0.08);
  box-shadow: 0 8px 32px rgba(0,0,0,0.12), inset 0 0.5px 0 rgba(255,255,255,0.5);
}
```

Keep existing light theme text color overrides but update panel backgrounds to use `rgba(0,0,0,0.03)`.

- [ ] **Step 7: Commit**

```bash
git add index.html
git commit -m "feat(visual): glassmorphism surfaces, state colors, pill styling"
```

---

### Task 3: CSS — Typography and layout spacing

**Files:**
- Modify: `index.html` — font-family on `body`, compact-view, expanded-view, labels, meters, stats, tabs, rows

- [ ] **Step 1: Update body font stack**

```css
body {
  background: transparent; overflow: hidden; user-select: none;
  font-family: -apple-system, 'SF Pro Text', 'Segoe UI', system-ui, sans-serif;
  color: #fff; -webkit-font-smoothing: antialiased;
}
```

- [ ] **Step 2: Update compact view sizing and typography**

```css
.compact-view {
  display: flex; align-items: center; gap: 8px;
  padding: 0 12px 0 6px; height: 42px;
}
.compact-label {
  font-size: 12.5px; font-weight: 500; white-space: nowrap;
  overflow: hidden; text-overflow: ellipsis; flex: 1;
  letter-spacing: -0.2px; transition: color 0.4s ease;
}
.compact-meta {
  display: flex; gap: 6px; font-size: 10px; color: #777;
  flex-shrink: 0; font-weight: 500; font-variant-numeric: tabular-nums;
}
```

- [ ] **Step 3: Update expanded view padding and header**

```css
.expanded-view { display: none; flex-direction: column; padding: 16px; height: 100%; overflow: hidden; }
.exp-top { display: flex; align-items: center; gap: 12px; margin-bottom: 14px; }
.exp-title { font-size: 15px; font-weight: 600; letter-spacing: -0.3px; }
.exp-sub { font-size: 11.5px; color: var(--body); font-weight: 400; margin-top: 2px; transition: color 0.4s ease; }
```

- [ ] **Step 4: Update section labels**

```css
.label {
  font-size: 9px; color: #666; font-weight: 600;
  text-transform: uppercase; letter-spacing: 0.8px; margin-bottom: 5px;
}
```

- [ ] **Step 5: Update meters typography**

```css
.meters { display: flex; gap: 12px; margin-bottom: 12px; }
.m-label { font-size: 9px; color: #666; font-weight: 600; }
.m-val { font-size: 10px; color: #fff; font-weight: 700; font-variant-numeric: tabular-nums; }
```

- [ ] **Step 6: Update stats row**

```css
.stats-row { display: flex; gap: 12px; margin-bottom: 12px; }
.stat-label { font-size: 9px; color: #666; font-weight: 600; }
.stat-val { font-size: 12px; color: #fff; font-weight: 700; font-variant-numeric: tabular-nums; }
```

- [ ] **Step 7: Update tab buttons**

```css
.tab-btn {
  flex: 1; padding: 7px 0; text-align: center;
  font-size: 10px; font-weight: 600; text-transform: uppercase;
  letter-spacing: 0.5px; color: #666; cursor: pointer;
  background: none; border: none; outline: none;
  transition: color 0.2s ease;
}
```

- [ ] **Step 8: Update session rows**

```css
.sess-list { margin-bottom: 10px; }
.sess-row {
  display: flex; align-items: center; gap: 6px;
  padding: 5px 10px; background: rgba(255,255,255,0.04);
  border-radius: 10px; margin-bottom: 3px; font-size: 10.5px;
  cursor: pointer; transition: background 0.2s;
}
.sess-row:hover { background: rgba(255,255,255,0.06); }
.sess-dot {
  width: 5px; height: 5px; border-radius: 50%;
  background: var(--body); box-shadow: 0 0 4px var(--body);
  transition: background 0.4s ease;
}
.sess-path { flex: 1; font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: #ddd; }
.sess-time { font-size: 9px; color: #555; }
```

- [ ] **Step 9: Update task rows**

```css
.tasks-box {
  background: rgba(255,255,255,0.04); border-radius: 10px;
  padding: 6px 10px; font-size: 11px; color: #888;
  flex: 1; overflow-y: auto; min-height: 36px;
}
.t-row { display: flex; align-items: center; gap: 6px; padding: 3px 0; }
.t-dot { width: 6px; height: 6px; border-radius: 50%; flex-shrink: 0; }
.t-dot.running { background: var(--body); box-shadow: 0 0 4px var(--body); }
.t-name { font-weight: 500; color: #ddd; font-size: 10.5px; }
```

- [ ] **Step 10: Update activity feed rows**

```css
.activity-entry {
  display: flex; align-items: center; gap: 6px;
  padding: 3px 6px; font-size: 10.5px; border-radius: 8px;
}
.activity-label { flex: 1; color: #ddd; font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.activity-time { font-size: 9px; color: #555; flex-shrink: 0; }
.activity-empty { text-align: center; color: #555; padding: 30px 0; font-size: 11px; }
```

- [ ] **Step 11: Commit**

```bash
git add index.html
git commit -m "feat(visual): typography, spacing, and layout tightening"
```

---

### Task 4: CSS — Tab bar pill indicator, component refinements

**Files:**
- Modify: `index.html` — tab bar CSS, close/bell buttons, question panel, notification history, scrollbar, settings controls

- [ ] **Step 1: Replace tab bar indicator with pill-shaped background**

Remove the bottom border from `.tab-bar` and change the indicator to a pill background:

```css
.tab-bar {
  display: flex; gap: 0; margin-bottom: 12px; position: relative;
}
.tab-indicator {
  position: absolute; bottom: 0; height: 100%; width: 0;
  background: rgba(255,255,255,0.08); border-radius: 8px;
  transition: left 0.2s ease, width 0.2s ease;
}
.theme-light .tab-bar { border-bottom: none; }
.theme-light .tab-indicator { background: rgba(0,0,0,0.06); }
```

- [ ] **Step 2: Update close and bell buttons**

```css
.exp-x {
  width: 24px; height: 24px; border-radius: 50%;
  background: rgba(255,255,255,0.04); display: flex;
  align-items: center; justify-content: center; cursor: pointer;
  transition: background 0.2s;
}
.exp-x:hover { background: rgba(255,255,255,0.1); }
.exp-bell {
  width: 24px; height: 24px; border-radius: 50%;
  background: rgba(255,255,255,0.04); display: flex;
  align-items: center; justify-content: center; cursor: pointer;
  transition: background 0.2s; position: relative;
}
.exp-bell:hover { background: rgba(255,255,255,0.1); }
```

Update the SVG icons inside the close and bell buttons in the HTML markup to use thinner strokes:
- Close button: `stroke-width="2"` (was `3`)
- Bell button: `stroke-width="1.5"` (was `2`)
- Close button SVG `width="9" height="9"` (was `10`)
- Bell button SVG `width="13" height="13"` (was `14`)

- [ ] **Step 3: Update question panel**

```css
.question-panel {
  display: none; flex-direction: column; gap: 6px;
  background: rgba(255,255,255,0.04); border-radius: 12px;
  padding: 10px; margin-bottom: 8px;
}
.question-panel.active { display: flex; animation: qpulse 3s ease-in-out infinite; }
.question-text {
  font-size: 11.5px; font-weight: 600; color: #fff;
  line-height: 1.4; margin-bottom: 3px;
}
.question-opt {
  padding: 6px 10px; border-radius: 10px;
  background: rgba(255,255,255,0.04);
  border: 1px solid rgba(255,255,255,0.06);
  cursor: pointer; transition: all 0.2s ease;
}
.question-opt:hover {
  background: rgba(255,255,255,0.08);
  border-color: color-mix(in srgb, var(--body) 40%, transparent);
}
.question-opt:active { transform: scale(0.97); }
.question-opt-label { font-size: 11.5px; font-weight: 600; color: #fff; }
.question-opt-desc { font-size: 9.5px; color: #888; margin-top: 2px; }
```

Note: `color-mix` is supported in Chromium 111+ (Electron 33 uses Chromium 130+). If you prefer broader compat, use a fixed `rgba(176,168,208,0.4)` for idle state hover border instead.

- [ ] **Step 4: Update notification history dropdown**

```css
.notif-history {
  display: none; position: absolute; top: 52px; right: 16px;
  width: 260px; max-height: 280px; z-index: 100;
  background: rgba(30,30,30,0.95); backdrop-filter: blur(30px);
  border: 1px solid rgba(255,255,255,0.1); border-radius: 14px;
  overflow: hidden; flex-direction: column;
}
.notif-history-entry {
  display: flex; align-items: flex-start; gap: 6px;
  padding: 5px 7px; font-size: 10.5px; border-radius: 8px;
  border-left: 2px solid #555;
}
.notif-history-icon { flex-shrink: 0; font-size: 9px; margin-top: 1px; }
.notif-history-msg { flex: 1; color: #ddd; font-weight: 500; }
.notif-history-time { font-size: 9px; color: #555; flex-shrink: 0; }
.notif-history-clear {
  text-align: center; padding: 7px; font-size: 10.5px;
  color: #888; cursor: pointer; border-top: 1px solid rgba(255,255,255,0.06);
  transition: color 0.2s;
}
.theme-light .notif-history { background: rgba(245,243,250,0.95); border-color: rgba(0,0,0,0.06); }
```

- [ ] **Step 5: Update scrollbar — show only on hover**

```css
::-webkit-scrollbar { width: 4px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb { background: transparent; border-radius: 2px; transition: background 0.2s; }
*:hover::-webkit-scrollbar-thumb { background: #444; }
```

- [ ] **Step 6: Update notification toast**

```css
.notif {
  position: fixed; left: 50%; transform: translateX(-50%);
  background: rgba(30,30,30,0.92); backdrop-filter: blur(24px);
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: 16px;
  box-shadow: 0 8px 24px rgba(0,0,0,0.25);
  padding: 8px 14px; display: flex; align-items: center; gap: 8px;
  font-size: 12px; font-weight: 500; color: #fff;
  z-index: 200; white-space: nowrap; cursor: pointer;
  transition: top 0.35s var(--spring), opacity 0.2s ease-out;
  opacity: 0; top: -50px; pointer-events: none;
}
```

Remove the per-state `.state-working .notif`, `.state-success .notif`, `.state-error .notif` box-shadow overrides.

- [ ] **Step 7: Update settings controls for tighter sizing**

```css
.settings-list { display: flex; flex-direction: column; gap: 10px; overflow-y: auto; flex: 1; padding: 2px 0; }
.setting-row {
  display: flex; align-items: center; justify-content: space-between;
  font-size: 11.5px; color: #ddd;
}
.setting-label { font-weight: 500; }
.setting-slider {
  -webkit-appearance: none; width: 90px; height: 3px;
  background: rgba(255,255,255,0.08); border-radius: 2px; outline: none;
}
.setting-slider::-webkit-slider-thumb {
  -webkit-appearance: none; width: 12px; height: 12px;
  border-radius: 50%; background: var(--body); cursor: pointer;
}
.setting-val { font-size: 9px; color: #888; min-width: 28px; text-align: right; }
.setting-toggle {
  width: 32px; height: 18px; border-radius: 9px;
  background: rgba(255,255,255,0.08); cursor: pointer;
  position: relative; transition: background 0.2s ease;
  border: none; outline: none; padding: 0;
}
.setting-toggle.on { background: var(--body); }
.setting-toggle::after {
  content: ''; position: absolute; top: 2px; left: 2px;
  width: 14px; height: 14px; border-radius: 50%;
  background: #fff; transition: left 0.2s ease;
}
.setting-toggle.on::after { left: 16px; }
.setting-btn {
  padding: 5px 12px; border-radius: 8px; font-size: 10px;
  font-weight: 600; cursor: pointer; border: none;
  background: rgba(255,255,255,0.06); color: #ddd;
  transition: background 0.2s ease;
}
.setting-btn:hover { background: rgba(255,255,255,0.12); }
.setting-radio-opt {
  padding: 3px 8px; border-radius: 6px; font-size: 9.5px;
  font-weight: 600; cursor: pointer; border: 1px solid rgba(255,255,255,0.06);
  background: none; color: #888; transition: all 0.2s ease;
}
.setting-radio-opt.active { background: var(--body); color: #000; border-color: var(--body); }
```

- [ ] **Step 8: Commit**

```bash
git add index.html
git commit -m "feat(visual): tab pill indicator, component refinements, toast and scrollbar updates"
```

---

### Task 5: CSS — Animation keyframes and transitions

**Files:**
- Modify: `index.html` — `@keyframes` blocks, ghost-wrap animation rules, status-dot

- [ ] **Step 1: Replace keyframe definitions**

Remove all existing `@keyframes` blocks (`pulse`, `blink`, `bob`, `bobFast`, `shake`, `bounce`, `qpulse`, `tabFade`) and replace with:

```css
@keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.4; } }
@keyframes bob { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-2px); } }
@keyframes bobFast { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-2px); } }
@keyframes ghostPulse { 0%,100% { transform: scale(1); } 50% { transform: scale(1.08); } }
@keyframes ghostShake { 0%,100% { transform: translateX(0); } 25% { transform: translateX(-1.5px); } 75% { transform: translateX(1.5px); } }
@keyframes qpulse { 0%,100% { border-color: rgba(255,255,255,0.06); } 50% { border-color: rgba(255,255,255,0.15); } }
@keyframes tabFade { from { opacity: 0; } to { opacity: 1; } }
```

- [ ] **Step 2: Update status dot pulse timing**

```css
.status-dot {
  width: 6px; height: 6px; border-radius: 50%; flex-shrink: 0;
  background: var(--body); box-shadow: 0 0 6px var(--body);
  animation: pulse 2.5s ease-in-out infinite;
  transition: background 0.4s ease, box-shadow 0.4s ease;
}
.status-dot.off { background: #555; box-shadow: none; animation: none; }
```

- [ ] **Step 3: Update ghost-wrap animation rules per state**

```css
.state-idle .ghost-wrap { animation: bob 3s ease-in-out infinite; }
.state-working .ghost-wrap { animation: bobFast 1.5s ease-in-out infinite; }
.state-success .ghost-wrap { animation: ghostPulse 0.4s ease-out; }
.state-error .ghost-wrap { animation: ghostShake 0.3s ease-in-out 2; }
```

Note: success uses `ghostPulse` (scale 1→1.08→1 over 400ms, plays once). Error uses `ghostShake` (±1.5px over 300ms, plays twice then stops).

- [ ] **Step 4: Remove ghost-wrap drop-shadow filters**

Delete these rules entirely:

```css
/* DELETE all of these */
.ghost-wrap { ... filter: drop-shadow(...); }
.state-working .ghost-wrap { filter: ... }
.state-success .ghost-wrap { filter: ... }
.state-error .ghost-wrap { filter: ... }
```

Keep the rest of `.ghost-wrap` (width, height, flex-shrink, display, line-height, transition):

```css
.ghost-wrap { width: 28px; height: 28px; flex-shrink: 0; display: block; line-height: 0; transition: opacity 0.15s ease; }
.exp-top .ghost-wrap { width: 40px; height: 40px; }
```

- [ ] **Step 5: Update ghost size classes**

```css
.ghost-mini { width: 28px; height: 28px; flex-shrink: 0; display: block; position: relative; top: 3px; left: 2px; }
.ghost-big { width: 40px; height: 40px; flex-shrink: 0; display: block; position: relative; top: 2px; left: -3px; }
.ghost-notif { width: 20px; height: 20px; display: block; }
```

- [ ] **Step 6: Update toast stack spacing in JS**

In the `repositionToasts()` function, change the spacing:

```js
function repositionToasts() {
  for (var i = 0; i < toastStack.length; i++) {
    toastStack[i].style.top = (48 + i * 40) + 'px';
  }
}
```

Was: `(54 + i * 48)`.

- [ ] **Step 7: Commit**

```bash
git add index.html
git commit -m "feat(visual): refined animations, keyframes, ghost sizing, toast spacing"
```

---

### Task 6: JS — Replace pixel-art ghost renderer with line-art SVG

**Files:**
- Modify: `index.html` — replace `ghostBase()`, `faces`, `colors`, `renderGhost()` JS functions

- [ ] **Step 1: Remove old pixel ghost data and renderer**

Delete the entire `// --- GHOST PIXEL DATA ---` section: `ghostBase()`, `faces` object, `colors` object, and `renderGhost()` function.

- [ ] **Step 2: Add new line-art ghost paths and renderer**

Replace with a `ghostPaths` object keyed by state. Each state defines SVG content as a string. The ghost is a stroke-based silhouette (rounded head, wavy bottom, expressive face):

```js
// --- GHOST LINE-ART ---
var ghostPaths = {
  idle: {
    body: 'M10,18 Q10,20 12,20 L12,19 Q13,20 14,19 L14,20 Q15,20 16,18 Q16,20 18,20 L18,19 Q19,20 20,19 L20,20 Q22,20 22,18 L22,10 Q22,4 16,4 Q10,4 10,10 Z',
    face: [
      { type: 'circle', cx: 13, cy: 11, r: 1 },
      { type: 'circle', cx: 19, cy: 11, r: 1 },
      { type: 'path', d: 'M14,14.5 Q16,15.5 18,14.5' }
    ]
  },
  working: {
    body: 'M10,18 Q10,20 12,20 L12,19 Q13,20 14,19 L14,20 Q15,20 16,18 Q16,20 18,20 L18,19 Q19,20 20,19 L20,20 Q22,20 22,18 L22,10 Q22,4 16,4 Q10,4 10,10 Z',
    face: [
      { type: 'ellipse', cx: 13, cy: 10.5, rx: 1.5, ry: 2 },
      { type: 'circle', cx: 13, cy: 10.5, r: 0.6, fill: true },
      { type: 'ellipse', cx: 19, cy: 10.5, rx: 1.5, ry: 2 },
      { type: 'circle', cx: 19, cy: 10.5, r: 0.6, fill: true },
      { type: 'ellipse', cx: 16, cy: 15, rx: 1.2, ry: 1 }
    ]
  },
  success: {
    body: 'M10,18 Q10,20 12,20 L12,19 Q13,20 14,19 L14,20 Q15,20 16,18 Q16,20 18,20 L18,19 Q19,20 20,19 L20,20 Q22,20 22,18 L22,10 Q22,4 16,4 Q10,4 10,10 Z',
    face: [
      { type: 'path', d: 'M11.5,11 Q13,9.5 14.5,11' },
      { type: 'path', d: 'M17.5,11 Q19,9.5 20.5,11' },
      { type: 'path', d: 'M13,14 Q16,17 19,14' }
    ]
  },
  error: {
    body: 'M10,18 Q10,20 12,20 L12,19 Q13,20 14,19 L14,20 Q15,20 16,18 Q16,20 18,20 L18,19 Q19,20 20,19 L20,20 Q22,20 22,18 L22,10 Q22,4 16,4 Q10,4 10,10 Z',
    face: [
      { type: 'path', d: 'M11.5,9.5 L14.5,12.5' },
      { type: 'path', d: 'M14.5,9.5 L11.5,12.5' },
      { type: 'path', d: 'M17.5,9.5 L20.5,12.5' },
      { type: 'path', d: 'M20.5,9.5 L17.5,12.5' },
      { type: 'path', d: 'M14,15.5 Q16,14 18,15.5' }
    ]
  }
};

var stateStrokeColors = {
  idle: '#b0a8d0',
  working: '#e0a878',
  success: '#78c890',
  error: '#d08080'
};

function renderGhost(svgEl, gs) {
  var ghost = ghostPaths[gs];
  var stroke = stateStrokeColors[gs];
  var svg = '<path d="' + ghost.body + '" fill="none" stroke="' + stroke + '" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>';
  ghost.face.forEach(function(f) {
    if (f.type === 'circle') {
      if (f.fill) {
        svg += '<circle cx="' + f.cx + '" cy="' + f.cy + '" r="' + f.r + '" fill="' + stroke + '" stroke="none"/>';
      } else {
        svg += '<circle cx="' + f.cx + '" cy="' + f.cy + '" r="' + f.r + '" fill="' + stroke + '" stroke="none"/>';
      }
    } else if (f.type === 'ellipse') {
      if (f.fill) {
        svg += '<ellipse cx="' + f.cx + '" cy="' + f.cy + '" rx="' + f.rx + '" ry="' + f.ry + '" fill="' + stroke + '" stroke="none"/>';
      } else {
        svg += '<ellipse cx="' + f.cx + '" cy="' + f.cy + '" rx="' + f.rx + '" ry="' + f.ry + '" fill="none" stroke="' + stroke + '" stroke-width="1.5" stroke-linecap="round"/>';
      }
    } else if (f.type === 'path') {
      svg += '<path d="' + f.d + '" fill="none" stroke="' + stroke + '" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>';
    }
  });
  svgEl.innerHTML = svg;
}
```

- [ ] **Step 3: Update SVG viewBox in HTML markup**

The ghost SVGs in the HTML use `viewBox="0 0 32 32"`. Keep this — the line-art paths are designed for a 32x32 coordinate space. But remove `style="image-rendering:pixelated;"` from all three ghost SVGs (`ghostCompact`, `ghostExp`, and the toast ghost) since line-art should be anti-aliased:

Compact ghost:
```html
<svg class="ghost-mini" id="ghostCompact" viewBox="0 0 32 32"></svg>
```

Expanded ghost:
```html
<svg class="ghost-big" id="ghostExp" viewBox="0 0 32 32"></svg>
```

Toast ghost (rendered dynamically in `notify()` function):
```js
toast.innerHTML = '<svg class="ghost-notif" viewBox="0 0 32 32"></svg><span>' + esc(message) + '</span>';
```

- [ ] **Step 4: Commit**

```bash
git add index.html
git commit -m "feat(visual): replace pixel-art ghost with line-art SVG renderer"
```

---

### Task 7: Light theme updates and final CSS pass

**Files:**
- Modify: `index.html` — `.theme-light` CSS overrides

- [ ] **Step 1: Update all light theme overrides**

Replace the existing `.theme-light` block with updated values that match the new glassmorphism surfaces:

```css
.theme-light { --bg-tint: rgba(245,243,250,0.78); }
.theme-light .pill {
  border-color: rgba(0,0,0,0.08);
  box-shadow: 0 8px 32px rgba(0,0,0,0.12), inset 0 0.5px 0 rgba(255,255,255,0.5);
}
.theme-light .compact-label, .theme-light .exp-title { color: #111; }
.theme-light .exp-sub, .theme-light .label, .theme-light .m-label { color: #666; }
.theme-light .m-val, .theme-light .t-name, .theme-light .sess-path { color: #222; }
.theme-light .m-track { background: rgba(0,0,0,0.06); }
.theme-light .tasks-box { background: rgba(0,0,0,0.03); }
.theme-light .sess-row { background: rgba(0,0,0,0.03); }
.theme-light .sess-row:hover { background: rgba(0,0,0,0.05); }
.theme-light .compact-meta { color: #999; }
.theme-light .notif { background: rgba(245,243,250,0.95); color: #111; box-shadow: 0 8px 24px rgba(0,0,0,0.1); }
.theme-light .question-panel { background: rgba(0,0,0,0.03); }
.theme-light .question-opt { background: rgba(0,0,0,0.03); border-color: rgba(0,0,0,0.06); }
.theme-light .question-opt:hover { background: rgba(0,0,0,0.06); }
.theme-light .question-opt-label { color: #111; }
.theme-light .question-opt-desc { color: #666; }
.theme-light .tab-btn { color: #999; }
.theme-light .tab-btn.active { color: #111; }
.theme-light .tab-indicator { background: rgba(0,0,0,0.06); }
.theme-light .activity-entry:hover { background: rgba(0,0,0,0.03); }
.theme-light .activity-label { color: #333; }
.theme-light .activity-time { color: #888; }
.theme-light .stat-val { color: #111; }
.theme-light .setting-row { color: #333; }
.theme-light .setting-slider { background: rgba(0,0,0,0.08); }
.theme-light .setting-btn { background: rgba(0,0,0,0.05); color: #333; }
.theme-light .setting-btn:hover { background: rgba(0,0,0,0.08); }
.theme-light .setting-toggle { background: rgba(0,0,0,0.08); }
.theme-light .setting-radio-opt { border-color: rgba(0,0,0,0.08); color: #666; }
.theme-light .setting-radio-opt.active { color: #000; }
.theme-light .notif-history { background: rgba(245,243,250,0.95); border-color: rgba(0,0,0,0.06); }
.theme-light .notif-history-msg { color: #333; }
.theme-light .notif-history-clear { color: #666; border-top-color: rgba(0,0,0,0.06); }
.theme-light .notif-history-clear:hover { color: #111; }
```

- [ ] **Step 2: Remove any scattered light theme overrides**

Search for any remaining `.theme-light` rules outside this block and consolidate them here. The current codebase has light theme rules scattered across multiple locations — gather them into one block after the dark theme styles.

- [ ] **Step 3: Commit**

```bash
git add index.html
git commit -m "feat(visual): consolidated light theme overrides for glassmorphism"
```

---

### Task 8: Visual verification and final adjustments

**Files:**
- Possibly: `index.html`, `main.js` — minor tweaks only

- [ ] **Step 1: Launch the app**

```bash
npm start
```

Verify in compact mode:
- Pill is 240x42px, centered at top of screen
- Frosted glass background with neutral tint (not purple)
- Visible border edge and subtle inner highlight
- Soft drop shadow
- Line-art ghost with idle animation (gentle bob)
- Status dot pulsing at 2.5s interval
- Text is lighter weight, smaller

- [ ] **Step 2: Verify expanded mode**

Click the pill to expand. Verify:
- Smooth 300ms spring expansion to 320x380px
- Tab bar uses pill-shaped background indicator (no bottom border)
- Dashboard tab: meters, stats, sessions, tasks all render with tighter spacing
- Activity tab: entries render with correct dot colors and sizing
- Settings tab: all controls (slider, toggles, radio, button) render correctly at smaller sizes
- Close and bell buttons are 24px with thinner strokes

- [ ] **Step 3: Verify ghost states**

Trigger each ghost state (start a Claude Code session, complete a task, etc.) or temporarily modify the code to cycle through states. Verify:
- Idle: dot eyes, slight smile, gentle bob
- Working: wide eyes with pupils, open mouth, fast bob
- Success: happy arc eyes, big smile, scale pulse (plays once)
- Error: X eyes, wavy mouth, shake (plays twice then stops)
- State transitions: 200ms opacity crossfade

- [ ] **Step 4: Verify light theme**

Toggle theme in settings. Verify:
- Background shifts to light frosted glass
- All text colors invert appropriately
- Tab indicator, panels, controls all look correct
- Ghost line-art still visible (stroke colors are state-driven, not theme-driven)

- [ ] **Step 5: Verify toast notifications**

Trigger a notification (start/stop a session). Verify:
- Toast appears with 350ms spring from top
- 40px spacing between stacked toasts
- 16px border-radius, neutral shadow
- Line-art ghost in toast at 20px
- Dismisses on click or after 4s

- [ ] **Step 6: Verify question panel**

If possible, trigger an AskUserQuestion. Verify:
- Panel appears with 3s subtle pulse animation
- Options have 10px border-radius, tighter padding
- Hover shows state-color-tinted border
- Selection animation works correctly

- [ ] **Step 7: Fix any visual issues found**

Address any spacing, alignment, or color issues discovered during verification. Common things to watch for:
- Ghost SVG alignment within the pill (may need `top`/`left` position tweaks on `.ghost-mini`)
- Tab indicator not aligning perfectly (may need JS `updateTabIndicator()` timing adjustment)
- Expanded panel content overflowing at 380px height (may need to reduce some margins further)

- [ ] **Step 8: Final commit**

```bash
git add -A
git commit -m "feat(visual): glassmorphism overhaul complete — verification fixes"
```
