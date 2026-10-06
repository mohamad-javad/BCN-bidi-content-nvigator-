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
 */
export function isRtlText(text: string): boolean {
  if (!text) return false;
  // Persian / Arabic / Hebrew unicode ranges
  const rtlRegex = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF\u0590-\u05FF]/;
  return rtlRegex.test(text);
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
