import { MarkdownView, HeadingCache, Editor, MarkdownSubView } from 'obsidian';
import { SurroundingHeadings } from './types';
import { cleanHeadingText } from './utils';

export interface CmScrollDOM {
  scrollTop: number;
  scrollHeight: number;
  clientHeight: number;
}

export interface CmLineBlock {
  top: number;
  bottom: number;
  from: number;
  to: number;
}

export interface CmDocLine {
  from: number;
  to: number;
  number: number;
  text?: string;
}

export interface CmDoc {
  lines: number;
  line(n: number): CmDocLine;
  lineAt(pos: number): CmDocLine;
}

export interface CmState {
  doc: CmDoc;
}

export interface CmEditorInstance {
  scrollDOM?: HTMLElement & CmScrollDOM;
  state?: CmState;
  coordsAtPos?: (pos: number) => { top: number; bottom: number } | null;
  lineBlockAt?: (pos: number) => CmLineBlock;
  lineBlockAtHeight?: (height: number) => CmLineBlock;
}

export interface CodeMirrorEditorView {
  cm?: CmEditorInstance;
  getScrollInfo?: () => { top: number; left: number };
}

export interface MarkdownPreviewViewWithScroll {
  getScroll?: () => number;
  applyScroll?: (scroll: number) => void;
}

/**
 * Retrieves the CodeMirror 6 EditorView instance from Obsidian Editor
 */
export function getCodeMirrorView(editor: Editor): CmEditorInstance | null {
  return (editor as unknown as CodeMirrorEditorView)?.cm ?? null;
}

/**
 * Binary search to find the heading where heading.position.start.line <= line.
 */
export function findLatestHeadingBeforeLine(
  headings: HeadingCache[],
  line: number
): HeadingCache | null {
  if (headings.length === 0) return null;
  if (headings[0].position.start.line > line) return null;

  let low = 0;
  let high = headings.length - 1;
  let resultIndex = -1;

  while (low <= high) {
    const mid = (low + high) >> 1;
    if (headings[mid].position.start.line <= line) {
      resultIndex = mid;
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }

  return resultIndex !== -1 ? headings[resultIndex] : null;
}

/**
 * Finds the active heading in Live Preview / Source Mode.
 */
export function getActiveHeadingInSourceMode(
  view: MarkdownView,
  headings: HeadingCache[],
  bufferPx = 60
): HeadingCache | null {
  if (!headings || headings.length === 0) return null;

  // 1. Primary: check visible heading DOM elements in Live Preview viewport
  const scroller = view.contentEl.querySelector<HTMLElement>('.cm-scroller');
  if (scroller) {
    const scrollerRect = scroller.getBoundingClientRect();
    const threshold = scrollerRect.top + bufferPx;

    const headingEls = Array.from(
      view.contentEl.querySelectorAll<HTMLElement>('.HyperMD-header, [class*="HyperMD-header"]')
    );

    let activeEl: HTMLElement | null = null;
    for (const el of headingEls) {
      const rect = el.getBoundingClientRect();
      if (rect.top <= threshold) {
        activeEl = el;
      } else {
        break;
      }
    }

    if (activeEl) {
      const headingText = activeEl.textContent?.trim() ?? '';
      if (headingText) {
        const cleanTarget = cleanHeadingText(headingText);
        const matched = headings.find(h => {
          const hClean = cleanHeadingText(h.heading);
          return (
            h.heading.trim() === headingText ||
            hClean === cleanTarget ||
            headingText.includes(h.heading.trim()) ||
            h.heading.trim().includes(headingText)
          );
        });
        if (matched) return matched;
      }
    }
  }

  // 2. Secondary: Obsidian SubView scroll line
  const subView = (view as unknown as { currentMode?: MarkdownSubView; editMode?: MarkdownSubView }).currentMode ??
                  (view as unknown as { editMode?: MarkdownSubView }).editMode;
  if (typeof subView?.getScroll === 'function') {
    const scrollLine = subView.getScroll();
    if (typeof scrollLine === 'number' && !isNaN(scrollLine)) {
      return findLatestHeadingBeforeLine(headings, Math.floor(scrollLine + 2));
    }
  }

  // 3. Fallback: CodeMirror scrollDOM ratio
  const cm = getCodeMirrorView(view.editor);
  if (cm?.scrollDOM && cm.state?.doc) {
    try {
      const scrollerEl = cm.scrollDOM;
      const ratio = scrollerEl.scrollHeight > 0 ? (scrollerEl.scrollTop + bufferPx) / scrollerEl.scrollHeight : 0;
      const totalLines = cm.state.doc.lines;
      const estimatedLine = Math.min(totalLines - 1, Math.max(0, Math.floor(ratio * totalLines)));
      return findLatestHeadingBeforeLine(headings, estimatedLine);
    } catch {
      // Ignore
    }
  }

  return headings[0] ?? null;
}

/**
 * Finds the active heading in Reading View.
 */
export function getActiveHeadingInReadingView(
  view: MarkdownView,
  headings: HeadingCache[],
  bufferPx = 60
): HeadingCache | null {
  if (!headings || headings.length === 0) return null;

  const preview = view.previewMode;
  const container = preview?.containerEl;
  if (!container) return null;

  const containerRect = container.getBoundingClientRect();
  const threshold = containerRect.top + bufferPx;

  const headingEls = Array.from(
    container.querySelectorAll<HTMLHeadingElement>('h1, h2, h3, h4, h5, h6')
  );

  let activeEl: HTMLHeadingElement | null = null;
  for (const el of headingEls) {
    const rect = el.getBoundingClientRect();
    if (rect.top <= threshold) {
      activeEl = el;
    } else {
      break;
    }
  }

  if (activeEl) {
    const headingText = activeEl.getAttribute('data-heading') ?? activeEl.textContent?.trim();
    if (headingText) {
      const cleanTarget = cleanHeadingText(headingText);
      const matched = headings.find(h =>
        h.heading.trim() === headingText.trim() ||
        cleanHeadingText(h.heading) === cleanTarget
      );
      if (matched) return matched;
    }
  }

  const previewScroll = preview as unknown as MarkdownPreviewViewWithScroll;
  const currentScrollLine = typeof previewScroll.getScroll === 'function'
    ? previewScroll.getScroll()
    : null;

  if (typeof currentScrollLine === 'number' && !isNaN(currentScrollLine)) {
    return findLatestHeadingBeforeLine(headings, Math.floor(currentScrollLine + 2));
  }

  return null;
}

/**
 * Detects active heading across both preview and source modes.
 */
export function getActiveHeading(
  view: MarkdownView,
  headings: HeadingCache[],
  bufferPx = 60
): HeadingCache | null {
  if (!view || !headings || headings.length === 0) return null;
  const mode = view.getMode();
  if (mode === 'preview') {
    return getActiveHeadingInReadingView(view, headings, bufferPx);
  } else {
    return getActiveHeadingInSourceMode(view, headings, bufferPx);
  }
}

/**
 * Computes surrounding headings (previous, active, next).
 */
export function getSurroundingHeadings(
  headings: HeadingCache[],
  active: HeadingCache | null
): SurroundingHeadings {
  if (!headings || headings.length === 0) {
    return { prev: null, active: null, next: null, activeIndex: -1, totalCount: 0 };
  }

  if (!active) {
    return {
      prev: null,
      active: null,
      next: headings[0] ?? null,
      activeIndex: -1,
      totalCount: headings.length
    };
  }

  const index = headings.findIndex(
    h => h.position.start.line === active.position.start.line && h.heading === active.heading
  );

  if (index === -1) {
    return { prev: null, active, next: null, activeIndex: -1, totalCount: headings.length };
  }

  return {
    prev: index > 0 ? headings[index - 1] : null,
    active: headings[index],
    next: index < headings.length - 1 ? headings[index + 1] : null,
    activeIndex: index,
    totalCount: headings.length
  };
}

/**
 * Smoothly scrolls to a target heading in Live Preview / Source Mode.
 */
export function scrollToHeadingInSourceMode(
  view: MarkdownView,
  heading: HeadingCache,
  behavior: ScrollBehavior = 'smooth'
): boolean {
  const targetLine = heading.position.start.line;
  const editor = view.editor;
  if (!editor || editor.lineCount() <= targetLine) return false;

  // 1. Position editor cursor
  try {
    editor.setCursor({ line: targetLine, ch: 0 });
  } catch {
    // Ignore
  }

  // 2. Use Obsidian's native subView applyScroll to position heading at top
  let scrolled = false;
  try {
    const subView = (view as unknown as { currentMode?: MarkdownSubView; editMode?: MarkdownSubView }).currentMode ??
                    (view as unknown as { editMode?: MarkdownSubView }).editMode;
    if (typeof subView?.applyScroll === 'function') {
      subView.applyScroll(targetLine);
      scrolled = true;
    }
  } catch {
    // Ignore
  }

  // 3. Fallback: scrollIntoView without centering jump (center = false)
  if (!scrolled) {
    try {
      editor.scrollIntoView(
        { from: { line: targetLine, ch: 0 }, to: { line: targetLine, ch: 0 } },
        false
      );
    } catch {
      // Ignore
    }
  }

  return true;
}

/**
 * Smoothly scrolls to a target heading in Reading View.
 */
export function scrollToHeadingInReadingView(
  view: MarkdownView,
  heading: HeadingCache,
  behavior: ScrollBehavior = 'smooth'
): boolean {
  const targetLine = heading.position.start.line;
  const preview = view.previewMode;
  const container = preview?.containerEl;
  if (!container) return false;

  const headingEls = Array.from(
    container.querySelectorAll<HTMLHeadingElement>('h1, h2, h3, h4, h5, h6')
  );
  const cleanTarget = cleanHeadingText(heading.heading);
  const allMatchingEls = headingEls.filter(el => {
    const dataH = el.getAttribute('data-heading');
    const textH = el.textContent?.trim();
    return (
      dataH === heading.heading ||
      textH === heading.heading.trim() ||
      (dataH && cleanHeadingText(dataH) === cleanTarget) ||
      (textH && cleanHeadingText(textH) === cleanTarget)
    );
  });

  let targetEl: HTMLHeadingElement | undefined;
  if (allMatchingEls.length > 1 && view.file) {
    const cache = view.app.metadataCache.getFileCache(view.file);
    const docHeadings = cache?.headings ?? [];
    const sameNameHeadings = docHeadings.filter(h => cleanHeadingText(h.heading) === cleanTarget);
    const occurrenceIndex = sameNameHeadings.findIndex(h => h.position.start.line === heading.position.start.line);
    if (occurrenceIndex >= 0 && occurrenceIndex < allMatchingEls.length) {
      targetEl = allMatchingEls[occurrenceIndex];
    } else {
      targetEl = allMatchingEls[0];
    }
  } else {
    targetEl = allMatchingEls[0];
  }

  if (targetEl) {
    targetEl.scrollIntoView({ behavior, block: 'start' });
    return true;
  }

  // Ensure preview.applyScroll is also called for accurate virtual positioning
  try {
    const previewRenderer = (preview as unknown as { renderer?: { applyScrollDelayed?: (line: number) => void; applyScroll?: (line: number) => boolean } })?.renderer;
    if (typeof previewRenderer?.applyScrollDelayed === 'function') {
      previewRenderer.applyScrollDelayed(targetLine);
    } else {
      const previewScroll = preview as unknown as MarkdownPreviewViewWithScroll;
      if (typeof previewScroll.applyScroll === 'function') {
        previewScroll.applyScroll(targetLine);
      }
    }
  } catch {
    // Ignore
  }

  return false;
}

/**
 * Universal scroll to heading across both modes.
 */
export function scrollToHeading(
  view: MarkdownView,
  heading: HeadingCache,
  behavior: ScrollBehavior = 'smooth'
): boolean {
  if (view.getMode() === 'preview') {
    return scrollToHeadingInReadingView(view, heading, behavior);
  } else {
    return scrollToHeadingInSourceMode(view, heading, behavior);
  }
}

/**
 * Retries scrolling to a target heading until rendered or attempts exhausted.
 */
export function scrollWithRetry(
  view: MarkdownView,
  heading: HeadingCache,
  behavior: ScrollBehavior = 'auto',
  onSuccess?: () => void
): void {
  let attempts = 0;
  const tryScroll = (): boolean => {
    if (!view.containerEl.isConnected) return true;
    const ok = scrollToHeading(view, heading, behavior);
    if (ok) {
      onSuccess?.();
      return true;
    }
    return false;
  };

  if (tryScroll()) return;

  const interval = window.setInterval(() => {
    attempts++;
    if (tryScroll() || attempts >= 25) {
      window.clearInterval(interval);
      if (attempts >= 25) {
        onSuccess?.();
      }
    }
  }, 40);
}
