# Visual Overhaul: macOS Glassmorphism

**Date:** 2026-04-09
**Approach:** CSS-only overhaul (Approach A) — all changes in `index.html` and dimension constants in `main.js`

## Summary

Full visual overhaul of Claude Code Island to achieve a macOS glassmorphism aesthetic. Smaller footprint, neutral frosted glass surfaces, minimal line-art ghost mascot, lighter typography, snappier/subtler animations. No new dependencies, no architecture changes.

## Files Modified

- `index.html` — CSS, SVG ghost renderer, markup tweaks
- `main.js` — dimension constants only (4 values)

## Files NOT Modified

- `preload.js`, `setup.js`, `hooks/*` — untouched

---

## 1. Dimensions & Layout

| Element | Before | After |
|---------|--------|-------|
| Compact pill | 280×48px, radius 24px | 240×42px, radius 21px |
| Expanded panel | 360×420px, radius 28px | 320×380px, radius 24px |
| Compact padding | 0 14px 0 8px | 0 12px 0 6px |
| Expanded padding | 20px | 16px |
| Internal gaps | 14px | 12px |
| Margins | 16px | 10–12px |

All internal spacing reduced proportionally. Tighter, more information-dense.

## 2. Glassmorphism & Surfaces

### Dark theme
- Background: `rgba(30,30,30,0.72)` (was `rgba(22,20,35,0.88)` — less purple, more transparent)
- Backdrop blur: 60px (was 50px)
- Border: `rgba(255,255,255,0.15)` (was 0.08 — more visible edge)
- Inner highlight: `inset 0 0.5px 0 rgba(255,255,255,0.12)` (new)
- Drop shadow: `0 8px 32px rgba(0,0,0,0.3)` (was none/colored glow)

### Light theme
- Background: `rgba(245,243,250,0.78)` (was `rgba(240,238,250,0.92)`)
- Border: `rgba(0,0,0,0.08)`
- Same blur and inner highlight approach

### State color variables (desaturated)

**Idle:**
`--hi:#c8c0e0; --body:#b0a8d0; --shadow:#6858a0; --face:#6858a0; --bg-tint:rgba(30,30,30,0.72);`

**Working:**
`--hi:#f0c8a0; --body:#e0a878; --shadow:#c89068; --face:#5a3020; --bg-tint:rgba(35,28,22,0.72);`

**Success:**
`--hi:#a0e8b8; --body:#78c890; --shadow:#58a870; --face:#1a5838; --bg-tint:rgba(22,32,26,0.72);`

**Error:**
`--hi:#e8b0b0; --body:#d08080; --shadow:#b06060; --face:#6a2020; --bg-tint:rgba(35,22,22,0.72);`

### Internal panels
- Tasks box, session rows, question panel: `rgba(255,255,255,0.04)` backgrounds
- No visible borders on internal panels — depth through luminance only

## 3. Typography

- Font stack: `-apple-system, 'SF Pro Text', 'Segoe UI', system-ui, sans-serif`
- Hierarchy through size and opacity, not bold weight

| Element | Before | After |
|---------|--------|-------|
| Compact label | 13.5px / 600 | 12.5px / 500 |
| Compact meta | 11px / #666 | 10px / #777 |
| Expanded title | 16px / 700 / -0.4px | 15px / 600 / -0.3px |
| Expanded subtitle | 12px / 500 | 11.5px / 400 |
| Section labels | 10px / 600 / 0.6px | 9px / 600 / 0.8px / #666 |
| Tab buttons | 11px / 600 | 10px / 600 |
| Row text (session/task/activity) | 11px | 10.5px |
| Stat values | 13px / 700 | 12px / 700 |

## 4. Ghost Mascot — Minimal Line-Art

Replace pixel-art SVG renderer with clean line-art ghost using SVG `<path>` elements.

### Style
- Stroke-based, not filled: 1.5px stroke, `currentColor` inheriting state colors
- Simple ghost silhouette: rounded head, wavy bottom edge, two dot eyes
- SF Symbols aesthetic weight

### Sizing
| Context | Before | After |
|---------|--------|-------|
| Compact | 34×34px | 28×28px |
| Expanded | 48×48px | 40×40px |
| Notification toast | 24×24px | 20×20px |

### State expressions (path data swaps)
- **Idle:** neutral dot eyes, slight smile, gentle float (3s ease-in-out)
- **Working:** wider eyes with small pupils, open mouth, faster bob (1.5s)
- **Success:** happy arc eyes (^_^), big smile, single scale pulse
- **Error:** X eyes, wavy mouth, gentle shake

### Transition
- 200ms opacity crossfade between states (same approach as current)
- Remove `drop-shadow` filter from ghost wrap — line-art doesn't need it

### Implementation
- `renderGhost(svgEl, state)` rewritten: sets SVG path `d` attributes per state instead of building pixel rects
- `ghostBase()` and `faces` object replaced with `ghostPaths` object keyed by state
- Each state is a set of `<path>` and `<circle>` elements with stroke styling

## 5. Animations & Transitions

| Animation | Before | After |
|-----------|--------|-------|
| Expand/collapse | 400ms spring | 300ms spring (same bezier) |
| Pill hover scale | 1.02 | 1.015 |
| Tab content switch | instant | 150ms opacity crossfade |
| Toast enter | 500ms spring | 350ms spring |
| Toast exit | 300ms ease | 200ms ease-out |
| Toast stack spacing | 48px | 40px |
| Question pulse | 2s, snaps to `var(--body)` | 3s, opacity 0.06↔0.15 |
| Status dot pulse | 2s, opacity 0.3↔1 | 2.5s, opacity 0.4↔1 |
| Success ghost | bounce keyframe | 400ms scale(1→1.08→1) |
| Error ghost | shake ±1px | 300ms translateX ±1.5px, 2 cycles |

Philosophy: 10–20% faster, 10–20% more subtle. Responsive but calm.

## 6. Component Details

### Tab bar
- Remove bottom-border indicator style
- Replace with pill-shaped background highlight behind active tab: `rgba(255,255,255,0.08)`, border-radius 8px
- Indicator slides between tabs (same transition timing)
- Feels like macOS segmented control

### Meters (CPU/RAM)
- Track height: 3px (unchanged)
- Fill: rounded ends (unchanged), add subtle `rgba(255,255,255,0.06)` glow behind fill
- Labels: 9px uppercase

### Session rows
- Border-radius: 10px (was 12px)
- Padding: 5px 10px (was 6px 12px)
- Session dot: 5px (was 6px)
- Hover: `rgba(255,255,255,0.06)` (was 0.08)

### Task rows
- Task dots: 6px (was 8px)
- Running dot glow: `0 0 4px` (was `0 0 6px`)

### Question panel
- Border-radius: 12px (was 14px)
- Option buttons: border-radius 10px (was 14px), padding 6px 10px (was 8px 12px)
- Hover border: state color at 40% opacity (was full `var(--body)`)

### Notification history dropdown
- Border-radius: 14px (was 16px)
- Tighter entry padding, smaller type

### Scrollbar
- Thumb: `#444` (was `#333`), width 4px (unchanged)
- Visible only on hover of scrollable areas

### Close/bell buttons
- Size: 24px (was 28px)
- Thinner icon strokes
- Background: `rgba(255,255,255,0.04)` (was 0.06)

## 7. Main Process Changes

Dimension constants in `main.js`:

```js
const COMPACT_WIDTH = 240;   // was 280
const COMPACT_HEIGHT = 42;   // was 48
const EXPANDED_WIDTH = 320;  // was 360
const EXPANDED_HEIGHT = 380; // was 420
```

All bounds calculations, position clamping, and resize IPC handlers already reference these constants — changes propagate automatically.

## 8. Out of Scope

- No changes to IPC bridge (`preload.js`)
- No changes to hooks (`island-status.js`, `island-ask.js`)
- No changes to setup script (`setup.js`)
- No new dependencies
- No functional behavior changes (polling, TCP questions, drag, settings persistence)
- No architecture changes (single-file HTML stays as-is)
