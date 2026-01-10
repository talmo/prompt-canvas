const TUI_PATTERNS: [RegExp, string][] = [
  [/^[┌┐└┘├┤┬┴┼╔╗╚╝╠╣╦╩╬─═]+$/gm, ''],   // Lines that are entirely box drawing chars
  [/^[│┃|]\s*/gm, ''],                     // Leading vertical bars
  [/\s*[│┃|]$/gm, ''],                     // Trailing vertical bars
  [/^\s{4,}(?=\S)/gm, ''],                 // Excessive leading whitespace
];

export function looksLikeTUI(text: string): boolean {
  const boxChars = /[│┃┌┐└┘├┤┬┴┼╔╗╚╝╠╣╦╩╬]/;
  const lines = text.split('\n');
  const leadingPipes = lines.filter(l => /^[│|]/.test(l.trim())).length;
  return boxChars.test(text) || leadingPipes >= 2;
}

export function cleanTUIArtifacts(text: string): string {
  if (!looksLikeTUI(text)) return text;

  let cleaned = text;
  for (const [pattern, replacement] of TUI_PATTERNS) {
    cleaned = cleaned.replace(pattern, replacement);
  }

  // Normalize excessive blank lines
  cleaned = cleaned.replace(/\n{3,}/g, '\n\n');

  return cleaned.trim();
}
