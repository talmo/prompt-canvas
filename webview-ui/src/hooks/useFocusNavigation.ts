import { useCallback } from 'react';
import type { Prompt } from '../types';

export function useFocusNavigation(
  prompts: Prompt[],
  textareaRefs: Map<string, HTMLTextAreaElement>
) {
  const focusPrevPrompt = useCallback(
    (promptIndex: number, cursorAtEnd = true) => {
      if (promptIndex > 0) {
        const prevPrompt = prompts[promptIndex - 1];
        const prevTextarea = textareaRefs.get(prevPrompt.id);
        if (prevTextarea) {
          prevTextarea.focus();
          if (cursorAtEnd) {
            prevTextarea.setSelectionRange(
              prevTextarea.value.length,
              prevTextarea.value.length
            );
          } else {
            prevTextarea.setSelectionRange(0, 0);
          }
          return true;
        }
      }
      return false;
    },
    [prompts, textareaRefs]
  );

  const focusNextPrompt = useCallback(
    (promptIndex: number, cursorAtStart = true) => {
      if (promptIndex < prompts.length - 1) {
        const nextPrompt = prompts[promptIndex + 1];
        const nextTextarea = textareaRefs.get(nextPrompt.id);
        if (nextTextarea) {
          nextTextarea.focus();
          if (cursorAtStart) {
            nextTextarea.setSelectionRange(0, 0);
          } else {
            nextTextarea.setSelectionRange(
              nextTextarea.value.length,
              nextTextarea.value.length
            );
          }
          return true;
        }
      }
      return false;
    },
    [prompts, textareaRefs]
  );

  const handleKeyDown = useCallback(
    (promptId: string, e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      const textarea = textareaRefs.get(promptId);
      if (!textarea) return;

      const { selectionStart, selectionEnd, value } = textarea;
      const promptIndex = prompts.findIndex((p) => p.id === promptId);

      // Ctrl/Cmd+Up: Jump to previous prompt (regardless of cursor position)
      if ((e.ctrlKey || e.metaKey) && e.key === 'ArrowUp') {
        e.preventDefault();
        focusPrevPrompt(promptIndex, false); // cursor at start
        return;
      }

      // Ctrl/Cmd+Down: Jump to next prompt (regardless of cursor position)
      if ((e.ctrlKey || e.metaKey) && e.key === 'ArrowDown') {
        e.preventDefault();
        focusNextPrompt(promptIndex, true); // cursor at start
        return;
      }

      // Check cursor position for natural arrow navigation
      const textBeforeCursor = value.substring(0, selectionStart);
      const textAfterCursor = value.substring(selectionEnd);
      const isOnFirstLine = !textBeforeCursor.includes('\n');
      const isOnLastLine = !textAfterCursor.includes('\n');

      // For single-line content, also check if cursor is at the very start/end
      // to avoid jumping when just trying to move within the line
      const isAtVeryStart = selectionStart === 0;
      const isAtVeryEnd = selectionEnd === value.length;

      // ArrowUp at cursor position 0 on first line -> move to previous prompt
      if (e.key === 'ArrowUp' && isOnFirstLine && isAtVeryStart) {
        if (focusPrevPrompt(promptIndex, true)) {
          e.preventDefault();
        }
      }

      // ArrowDown at end of last line -> move to next prompt
      if (e.key === 'ArrowDown' && isOnLastLine && isAtVeryEnd) {
        if (focusNextPrompt(promptIndex, true)) {
          e.preventDefault();
        }
      }
    },
    [prompts, textareaRefs, focusPrevPrompt, focusNextPrompt]
  );

  return { handleKeyDown };
}
