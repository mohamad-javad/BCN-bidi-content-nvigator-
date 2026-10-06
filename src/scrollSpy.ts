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

  return headings[0] ?? null;
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
): void {
  const cm = getCodeMirrorView(view.editor);
  const targetLine = heading.position.start.line;

  if (cm && cm.state?.doc && cm.scrollDOM) {
    try {
      const line1 = targetLine + 1;
      const totalLines = cm.state.doc.lines;
      const safeLine = Math.min(line1, totalLines);
      const docLine = cm.state.doc.line(safeLine);
      const block = cm.lineBlockAt ? cm.lineBlockAt(docLine.from) : null;

      if (block) {
        if (behavior === 'smooth') {
          cm.scrollDOM.scrollTo({
            top: Math.max(0, block.top - 20),
            behavior: 'smooth'
          });
        } else {
          cm.scrollDOM.scrollTop = Math.max(0, block.top - 20);
        }
        view.editor.setCursor({ line: targetLine, ch: 0 });
        return;
      }
    } catch {
      // Fallback
    }
  }

  try {
    view.editor.scrollIntoView(
      { from: { line: targetLine, ch: 0 }, to: { line: targetLine, ch: 0 } },
      true
    );
    view.editor.setCursor({ line: targetLine, ch: 0 });
    view.setEphemeralState({ line: targetLine });
  } catch {
    // Ignore
  }
}

/**
 * Smoothly scrolls to a target heading in Reading View.
 */
export function scrollToHeadingInReadingView(
  view: MarkdownView,
  heading: HeadingCache,
  behavior: ScrollBehavior = 'smooth'
): void {
  const preview = view.previewMode;
  const container = preview?.containerEl;
  if (!container) return;

  const headingEls = Array.from(
    container.querySelectorAll<HTMLHeadingElement>('h1, h2, h3, h4, h5, h6')
  );
  const cleanTarget = cleanHeadingText(heading.heading);
  const targetEl = headingEls.find(el => {
    const dataH = el.getAttribute('data-heading');
    const textH = el.textContent?.trim();
    return (
      dataH === heading.heading ||
      textH === heading.heading.trim() ||
      (dataH && cleanHeadingText(dataH) === cleanTarget) ||
      (textH && cleanHeadingText(textH) === cleanTarget)
    );
  });

  if (targetEl) {
    targetEl.scrollIntoView({ behavior, block: 'start' });
    return;
  }

  view.setEphemeralState({ line: heading.position.start.line });
  const previewScroll = preview as unknown as MarkdownPreviewViewWithScroll;
  if (typeof previewScroll.applyScroll === 'function') {
    previewScroll.applyScroll(heading.position.start.line);
  }
}

/**
 * Universal scroll to heading across both modes.
 */
export function scrollToHeading(
  view: MarkdownView,
  heading: HeadingCache,
  behavior: ScrollBehavior = 'smooth'
): void {
  if (view.getMode() === 'preview') {
    scrollToHeadingInReadingView(view, heading, behavior);
  } else {
    scrollToHeadingInSourceMode(view, heading, behavior);
  }
}
