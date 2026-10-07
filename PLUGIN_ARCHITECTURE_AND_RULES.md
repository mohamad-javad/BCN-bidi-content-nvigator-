# BiDi Flow Navigator — Architectural Blueprint & Development Rules
> **Reference Document for AI Agents & Developers**  
> Plugin ID: `bidi-flow-navigator` | Repository: `mohamad-javad/BCN-bidi-content-nvigator-`

This document defines the core architecture, established design patterns, critical Obsidian API gotchas, and strict quality rules for the **BiDi Flow Navigator** plugin. Any agent or developer working on this codebase must adhere to these rules to avoid breaking features or failing Obsidian community plugin reviews.

---

## 1. Project Identity & Git Workflow

### Branching Model
- **`develop`**: The primary working branch. **ALL active development, bug fixes, and feature additions must be committed here.**
- **`main`**: The production release branch. Only updated by merging `develop` when a release tag is created.
- **NEVER** commit work directly onto `main`. Always work on `develop`, verify tests and builds, merge into `main`, tag the release, and return to `develop`.

### Release Versioning Checklist
When creating a new release (e.g., `X.Y.Z`):
1. Update version string in **`manifest.json`** (`"version": "X.Y.Z"`).
2. Update version string in **`package.json`** (`"version": "X.Y.Z"`).
3. Add entry in **`versions.json`** (`"X.Y.Z": "1.7.2"`).
4. Update release badge and changelog in **`README.md`**.
5. Run `npx tsc --noEmit` and `npm run build`.
6. Commit changes on `develop`.
7. Checkout `main`, merge `develop`, create annotated tag `X.Y.Z`:
   ```bash
   git tag -a X.Y.Z -m "Release vX.Y.Z: Summary of changes"
   git push origin main && git push origin X.Y.Z
   git checkout develop
   ```

---

## 2. Directory & Module Architecture

```text
obsidian-bidi-navigator/
├── manifest.json              # Obsidian plugin metadata (ID, version, minAppVersion)
├── package.json               # NPM scripts, dependencies, build targets
├── versions.json              # Version compatibility map
├── esbuild.config.mjs         # Build script (bundles TS, copies src/styles.css -> styles.css)
├── README.md                  # User-facing bilingual documentation & changelog
├── assets/                    # Showcase screenshots (desktop dark/light/sepia, mobile)
├── styles.css                 # COMPILED CSS output (DO NOT EDIT DIRECTLY!)
├── main.js                    # COMPILED JS bundle (DO NOT EDIT DIRECTLY!)
└── src/
    ├── main.ts                # Plugin lifecycle, workspace event listeners, commands
    ├── BidiFlowNavigatorCore.ts # Universal outline UI, 5-button toolbar, auto-scroll engine
    ├── BidiFlowFloatingWidget.ts# In-note floating widget component (mini/floating/rail)
    ├── BidiFlowSidebarView.ts # Dedicated right sidebar tab (ItemView)
    ├── scrollSpy.ts           # Binary search heading detection & cross-mode smooth scroll
    ├── settings.ts            # Configuration tab (PluginSettingTab)
    ├── styles.css             # SOURCE OF TRUTH for all styles
    ├── types.ts               # Interfaces, settings schema, constants
    ├── i18n.ts                # Bilingual dictionary (English & Persian)
    └── utils.ts               # BiDi analysis, text cleaning, Persian digits
```

### Component Roles & Responsibilities

| File | Primary Role |
| :--- | :--- |
| `src/main.ts` | Subscribes to Obsidian events (`layout-change`, `active-leaf-change`, `file-open`, `quit`), manages floating widget instances per MarkdownView, registers command palette items, and orchestrates cross-mode scroll restoration. |
| `src/BidiFlowNavigatorCore.ts` | The shared brain of both the floating card and sidebar. Renders the hierarchical tree, tracks the active heading, drives the progress bar, hosts the 5-button action toolbar, and runs the synchronized auto-scroll loop. |
| `src/BidiFlowFloatingWidget.ts` | Wraps `BidiFlowNavigatorCore` inside an absolute-positioned floating container overlaid on `MarkdownView.contentEl`. Handles window mode toggling (`mini`, `floating`, `full-height`) and mobile touch clamping. |
| `src/BidiFlowSidebarView.ts` | Wraps `BidiFlowNavigatorCore` inside Obsidian's native right sidebar leaf (`ItemView`). |
| `src/scrollSpy.ts` | High-performance $O(\log N)$ heading detection. Implements `scrollToHeading` and `scrollWithRetry` for reliable navigation across both Editing and Reading views. |
| `src/styles.css` | **Sole source of truth for styles.** `esbuild.config.mjs` copies this file to `styles.css`. **Never make CSS edits directly to the root `styles.css`.** |

---

## 3. Strict Implementation Rules & Obsidian API Gotchas

### Rule 1: DOM Scroll Container Targeting (Reading View vs Edit View)
> [!CRITICAL]
> In Obsidian, **`view.previewMode.containerEl` is NOT the element that scrolls in Reading View!**

- **Reading View (`previewMode`):**
  - `view.previewMode.containerEl` points to `.markdown-reading-view` which has `overflow: hidden; height: 100%`. Reading its `scrollHeight - clientHeight` yields `0` and assigning to its `scrollTop` does nothing!
  - **The actual scroll container** in Reading View is **`.markdown-preview-view`** (which has `overflow-y: scroll`).
- **Editing View (`source` / Live Preview):**
  - The actual scroll container is **`.cm-scroller`** (CodeMirror 6).
- **Mandatory Solution:** Always use `core.getScrollContainer(view)`:
  ```ts
  public getScrollContainer(view: MarkdownView | null): HTMLElement | null {
    if (!view) return null;
    if (view.getMode() === 'preview') {
      const previewEl = view.contentEl.querySelector<HTMLElement>('.markdown-preview-view')
        ?? (view.previewMode as unknown as { containerEl?: HTMLElement })?.containerEl?.querySelector<HTMLElement>('.markdown-preview-view')
        ?? view.previewMode?.containerEl;
      return previewEl ?? null;
    } else {
      const cmScroller = view.contentEl.querySelector<HTMLElement>('.cm-scroller');
      return cmScroller ?? view.contentEl;
    }
  }
  ```

---

### Rule 2: Smooth Auto-Scroll Engine & Sub-Pixel Accumulation
- **Sub-Pixel Truncation Bug:** In Chromium on Linux/Windows, assigning fractional values $< 0.5$ px to `scrollTop` gets floored to `0`. At reading speeds below 30 px/s (e.g. 10 px/s = $0.16$ px/frame at 60fps), direct assignments result in $0$ movement every frame, causing the auto-scroll to freeze!
- **Mandatory Accumulator Pattern:** Always accumulate fractional frame deltas in a float accumulator and only commit whole pixels:
  ```ts
  this.autoScrollAccumulator += deltaPx;
  if (this.autoScrollAccumulator >= 1) {
    const pxToScroll = Math.floor(this.autoScrollAccumulator);
    this.autoScrollAccumulator -= pxToScroll;
    scrollContainer.scrollTop += pxToScroll;
  }
  ```
- **Cross-Window Synchronization:** Both the floating card and sidebar outlines must display identical button states (`play`/`pause`, `is-active`).
  - Use static tracking: `BidiFlowNavigatorCore.activeInstances: Set<BidiFlowNavigatorCore>` and `BidiFlowNavigatorCore.activeRunner`.
  - When auto-scroll starts or stops, call `BidiFlowNavigatorCore.broadcastAutoScrollState(isRunning)`.
- **Termination Conditions:**
  - Auto-scroll must only stop at the bottom of the document when `scrollContainer.scrollTop >= maxScroll - 3` is confirmed for $> 30$ consecutive frames.
  - Do NOT abort on frame 1 if `maxScroll <= 5`; wait up to 60 frames to allow the virtual DOM to measure content height.

---

### Rule 3: Cross-Mode Reading Position Parity (Edit ⟷ Read)
- **Obsidian Native Scroll Reset Issue:** Toggling between Edit Mode and Reading View in Obsidian often triggers a transient scroll event reset to line 0 before the target view mounts.
- **Mandatory Prevention Pattern:**
  1. Lock heading position saves in `main.ts` by adding the note path to `this.restoringFiles.add(filePath)`.
  2. Use `scrollWithRetry(view, targetHeading, 'auto', onSuccess)` in `src/scrollSpy.ts` to retry scrolling across animation frames until the heading element is mounted in the DOM.
  3. Release the lock via `setTimeout(() => this.restoringFiles.delete(filePath), 400)`.

---

### Rule 4: Obsidian Review Guidelines & Code Quality Standards
- **NO `!important` in CSS:** The Obsidian plugin review team strictly flags `!important`. Increase selector specificity instead:
  ```css
  /* BAD */
  .bidi-flow-btn-mode { display: none !important; }

  /* GOOD */
  body.is-phone .bidi-floating-navigator .bidi-flow-top-bar .bidi-flow-window-controls .bidi-flow-btn-mode,
  .is-phone .bidi-floating-navigator .bidi-flow-btn-mode { display: none; }
  ```
- **Window Scoping for Animation Frames:** Always qualify with `window.` for popout window compatibility:
  - Use `window.requestAnimationFrame()` (NOT `requestAnimationFrame()`).
  - Use `window.cancelAnimationFrame()` (NOT `cancelAnimationFrame()`).
- **NO Direct DOM Style String Assignments:** Use Obsidian's built-in helper functions:
  - `setCssStyles(element, { width: `${width}px` })` instead of `element.style.width = ...`.
  - `setCssProps(element, { '--custom-var': value })` instead of `element.style.setProperty(...)`.
- **NO Deprecated Slider APIs:** Do not call `slider.setDynamicTooltip()`. Obsidian displays slider values inline automatically.
- **Type Safety:** Maintain zero `any` casts in navigation logic. Define explicit interfaces for internal Obsidian objects (e.g., `MarkdownPreviewViewWithScroll`, `TabHeaderLeaf`).

---

### Rule 5: Mobile & Phone Ergonomics
- **Top Clearance:** On mobile phones (`.is-phone`, `.is-mobile`, `@media (max-width: 768px)`), set `top: 88px` so the widget does not collide with Obsidian's mobile navigation header, back button, or title bar.
- **Height Limitation:** Set mobile card height to `max-height: min(420px, calc(100vh - 150px))` to keep notes readable.
- **Disable Full-Height/Maximize:** Hide the maximize button (`.bidi-flow-btn-mode`) on mobile devices and restrict `cycleMode()` in `BidiFlowFloatingWidget.ts` to toggle only between `mini` and `floating`.

---

### Rule 6: Bidirectional (BiDi) & RTL Typography
- **CSS Logical Properties:** Always use `margin-inline-start`, `border-inline-start`, `inset-inline-*` instead of `margin-left` or `margin-right`.
- **HTML Attributes:** Tree nodes and search inputs must have `dir="auto"` and `unicode-bidi: plaintext` to avoid reverse punctuation or mixed English/Persian glitching.
- **Persian Digits:** Respect `this.settings.persianNumerals` by formatting numbers with `toPersianDigits(num, true)`.

---

## 4. Pre-Commit Quality Verification

Before committing any changes to `develop`:
```bash
# 1. Type check (must produce 0 errors)
npx tsc --noEmit

# 2. Build production bundle (main.js, styles.css)
npm run build

# 3. Check for forbidden patterns
git diff | grep "!important"          # Must return nothing
git diff | grep "setDynamicTooltip"   # Must return nothing

# 4. Verify git status
git status
```
