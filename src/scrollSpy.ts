import { MarkdownView, HeadingCache, Editor } from 'obsidian';
import { SurroundingHeadings } from './types';
import { cleanHeadingText } from './utils';

/**
 * Retrieves the CodeMirror 6 EditorView instance from Obsidian Editor
 */
export function getCodeMirrorView(editor: Editor): any {
  return (editor as any)?.cm ?? null;
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

  const cm = getCodeMirrorView(view.editor);
  let currentLine0: number;

  if (cm && cm.scrollDOM && cm.lineBlockAtHeight && cm.state?.doc) {
    try {
      const scrollTop = cm.scrollDOM.scrollTop;
      const targetHeight = Math.max(0, scrollTop + bufferPx);
      const block = cm.lineBlockAtHeight(targetHeight);
      const lineInfo = cm.state.doc.lineAt(block.from);
      currentLine0 = lineInfo.number - 1;
    } catch {
      currentLine0 = view.editor.getCursor().line;
    }
  } else {
    // Fallback using Editor scroll info or cursor
    try {
      const scrollInfo = (view.editor as any).getScrollInfo ? (view.editor as any).getScrollInfo() : null;
      if (scrollInfo && scrollInfo.height > 0) {
        const lineCount = view.editor.lineCount();
        const ratio = (scrollInfo.top + bufferPx) / scrollInfo.height;
        currentLine0 = Math.min(lineCount - 1, Math.max(0, Math.floor(ratio * lineCount)));
      } else {
        currentLine0 = view.editor.getCursor().line;
      }
    } catch {
      currentLine0 = view.editor.getCursor().line;
    }
  }

  return findLatestHeadingBeforeLine(headings, currentLine0);
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

  const currentScrollLine = typeof (preview as any).getScroll === 'function'
    ? (preview as any).getScroll()
    : null;

  if (typeof currentScrollLine === 'number') {
    return findLatestHeadingBeforeLine(headings, Math.floor(currentScrollLine));
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
  if (typeof (preview as any).applyScroll === 'function') {
    (preview as any).applyScroll(heading.position.start.line);
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
