import { useCallback } from 'react';
import type { Prompt } from '../types';

export function useFocusNavigation(
  prompts: Prompt[],
  textareaRefs: Map<string, HTMLTextAreaElement>
) {
  const handleKeyDown = useCallback(
    (promptId: string, e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      const textarea = textareaRefs.get(promptId);
      if (!textarea) return;

      const { selectionStart, selectionEnd, value } = textarea;

      // Check cursor position
      const textBeforeCursor = value.substring(0, selectionStart);
      const textAfterCursor = value.substring(selectionEnd);
      const isOnFirstLine = !textBeforeCursor.includes('\n');
      const isOnLastLine = !textAfterCursor.includes('\n');

      const promptIndex = prompts.findIndex((p) => p.id === promptId);

      // ArrowUp at the start of first line -> move to previous prompt
      if (e.key === 'ArrowUp' && isOnFirstLine) {
        if (promptIndex > 0) {
          e.preventDefault();
          const prevPrompt = prompts[promptIndex - 1];
          const prevTextarea = textareaRefs.get(prevPrompt.id);
          if (prevTextarea) {
            prevTextarea.focus();
            // Move cursor to end
            prevTextarea.setSelectionRange(
              prevTextarea.value.length,
              prevTextarea.value.length
            );
          }
        }
      }

      // ArrowDown at the end of last line -> move to next prompt
      if (e.key === 'ArrowDown' && isOnLastLine) {
        if (promptIndex < prompts.length - 1) {
          e.preventDefault();
          const nextPrompt = prompts[promptIndex + 1];
          const nextTextarea = textareaRefs.get(nextPrompt.id);
          if (nextTextarea) {
            nextTextarea.focus();
            nextTextarea.setSelectionRange(0, 0);
          }
        }
      }
    },
    [prompts, textareaRefs]
  );

  return { handleKeyDown };
}
