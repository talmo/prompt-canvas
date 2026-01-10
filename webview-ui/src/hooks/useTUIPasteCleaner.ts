import { useCallback } from 'react';

const TUI_PATTERNS: [RegExp, string][] = [
  [/^[│┃|]\s*/gm, ''],
  [/\s*[│┃|]$/gm, ''],
  [/^[┌┐└┘├┤┬┴┼╔╗╚╝╠╣╦╩╬─═]+\n/gm, ''],
  [/^\s{4,}(?=\S)/gm, ''],
];

function looksLikeTUI(text: string): boolean {
  const boxChars = /[│┃┌┐└┘├┤┬┴┼╔╗╚╝╠╣╦╩╬]/;
  const lines = text.split('\n');
  const leadingPipes = lines.filter((l) => /^[│|]/.test(l.trim())).length;
  return boxChars.test(text) || leadingPipes >= 2;
}

function cleanTUIArtifacts(text: string): string {
  if (!looksLikeTUI(text)) return text;

  let cleaned = text;
  for (const [pattern, replacement] of TUI_PATTERNS) {
    cleaned = cleaned.replace(pattern, replacement);
  }

  cleaned = cleaned.replace(/\n{3,}/g, '\n\n');
  return cleaned.trim();
}

export function useTUIPasteCleaner() {
  const handlePaste = useCallback(
    (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
      const pastedText = e.clipboardData.getData('text');

      if (looksLikeTUI(pastedText)) {
        e.preventDefault();
        const cleanedText = cleanTUIArtifacts(pastedText);
        const textarea = e.currentTarget;
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const currentValue = textarea.value;

        const newValue =
          currentValue.substring(0, start) +
          cleanedText +
          currentValue.substring(end);

        // Trigger a change event
        const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
          window.HTMLTextAreaElement.prototype,
          'value'
        )?.set;

        if (nativeInputValueSetter) {
          nativeInputValueSetter.call(textarea, newValue);
          const event = new Event('input', { bubbles: true });
          textarea.dispatchEvent(event);

          // Set cursor position after pasted text
          const newCursorPos = start + cleanedText.length;
          textarea.setSelectionRange(newCursorPos, newCursorPos);
        }
      }
    },
    []
  );

  return { handlePaste };
}
