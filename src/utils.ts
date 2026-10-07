/**
 * Converts Western digits to Eastern Persian digits if enabled.
 */
export function toPersianDigits(n: number | string, enabled = true): string {
  const str = String(n);
  if (!enabled) return str;
  const persianDigits = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
  return str.replace(/[0-9]/g, (d) => persianDigits[parseInt(d, 10)]);
}

/**
 * Checks if a string contains predominantly RTL / Persian / Arabic characters.
 * Prioritizes alphabet letters over digits so English text with Persian digits
 * remains properly classified as LTR.
 */
export function isRtlText(text: string): boolean {
  if (!text) return false;
  const rtlLetters = text.match(/[\u0621-\u064A\u0671-\u06D3\u06FB-\u06FC\u067E\u0686\u0698\u06AF\uFB50-\uFDFF\uFE70-\uFEFC\u0590-\u05FF]/g);
  const ltrLetters = text.match(/[a-zA-Z]/g);
  if (!rtlLetters && !ltrLetters) {
    const rtlRegex = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF\u0590-\u05FF]/;
    return rtlRegex.test(text);
  }
  return (rtlLetters?.length || 0) >= (ltrLetters?.length || 0);
}

/**
 * Detects whether a document / set of headings is predominantly RTL (Persian/Arabic) or LTR (English).
 */
export function detectDocumentDirection(
  headings: { heading: string }[],
  fallbackTitle?: string
): 'rtl' | 'ltr' {
  let rtlCount = 0;
  let ltrCount = 0;

  const rtlLetterRegex = /[\u0621-\u064A\u0671-\u06D3\u06FB-\u06FC\u067E\u0686\u0698\u06AF\uFB50-\uFDFF\uFE70-\uFEFC\u0590-\u05FF]/g;
  const ltrLetterRegex = /[a-zA-Z]/g;

  for (const h of headings) {
    const text = h.heading || '';
    const rtlMatches = text.match(rtlLetterRegex);
    const ltrMatches = text.match(ltrLetterRegex);
    if (rtlMatches) rtlCount += rtlMatches.length;
    if (ltrMatches) ltrCount += ltrMatches.length;
  }

  if (rtlCount > 0 || ltrCount > 0) {
    return rtlCount >= ltrCount ? 'rtl' : 'ltr';
  }

  if (fallbackTitle) {
    const rtlMatches = fallbackTitle.match(rtlLetterRegex);
    const ltrMatches = fallbackTitle.match(ltrLetterRegex);
    if (rtlMatches || ltrMatches) {
      return (rtlMatches?.length || 0) >= (ltrMatches?.length || 0) ? 'rtl' : 'ltr';
    }
  }

  return 'ltr';
}

/**
 * Cleans markdown formatting and HTML tags from headings for clean outline display
 */
export function cleanHeadingText(raw: string): string {
  if (!raw) return '';
  let cleaned = raw;

  // Strip HTML tags: <span ...>text</span> -> text
  cleaned = cleaned.replace(/<[^>]+>/g, '');

  // Obsidian wikilinks: [[note|alias]] -> alias, or [[note]] -> note
  cleaned = cleaned.replace(/\[\[(?:[^|\]]*\|)?([^\]]+)\]\]/g, '$1');

  // Standard markdown links: [text](url) -> text
  cleaned = cleaned.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');

  // Inline code: `code` -> code
  cleaned = cleaned.replace(/`([^`]+)`/g, '$1');

  // Iteratively strip bold, italics, highlights, and strikethroughs to handle nested markdown
  for (let i = 0; i < 3; i++) {
    cleaned = cleaned.replace(/\*{1,3}(.*?)\*{1,3}/g, '$1');
    cleaned = cleaned.replace(/_{1,3}(.*?)_{1,3}/g, '$1');
    cleaned = cleaned.replace(/==(.*?)==/g, '$1');
    cleaned = cleaned.replace(/~~(.*?)~~/g, '$1');
  }

  // Clean trailing and leading spaces
  return cleaned.trim();
}
