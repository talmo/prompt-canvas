import { useRef, useEffect, useCallback, forwardRef } from 'react';
import TextareaAutosize from 'react-textarea-autosize';
import { clsx } from 'clsx';
import { motion } from 'framer-motion';
import type { Prompt, PromptStatus } from '../types';
import { StatusBadge } from './StatusBadge';
import { Toolbar } from './Toolbar';
import { ResponsePreview } from './ResponsePreview';
import { useTUIPasteCleaner } from '../hooks/useTUIPasteCleaner';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface PromptCellProps {
  prompt: Prompt;
  isFocused: boolean;
  onFocus: () => void;
  onContentChange: (content: string) => void;
  onStatusChange: (status: PromptStatus) => void;
  onDelete: () => void;
  onCreateBelow: () => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  registerTextarea: (id: string, el: HTMLTextAreaElement | null) => void;
}

const statusCycle: PromptStatus[] = ['queue', 'active', 'done', 'trash'];

export const PromptCell = forwardRef<HTMLDivElement, PromptCellProps>(
  function PromptCell(
    {
      prompt,
      isFocused,
      onFocus,
      onContentChange,
      onStatusChange,
      onDelete,
      onCreateBelow,
      onKeyDown,
      registerTextarea,
    },
    ref
  ) {
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const { handlePaste } = useTUIPasteCleaner();

    const {
      attributes,
      listeners,
      setNodeRef,
      transform,
      transition,
      isDragging,
    } = useSortable({ id: prompt.id });

    const style = {
      transform: CSS.Transform.toString(transform),
      transition,
    };

    // Register textarea ref
    useEffect(() => {
      registerTextarea(prompt.id, textareaRef.current);
      return () => {
        registerTextarea(prompt.id, null);
      };
    }, [prompt.id, registerTextarea]);

    // Focus textarea when cell becomes focused
    useEffect(() => {
      if (isFocused && textareaRef.current) {
        textareaRef.current.focus();
      }
    }, [isFocused]);

    const handleKeyDown = useCallback(
      (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        // Shift+Enter to create new prompt below
        if (e.key === 'Enter' && e.shiftKey) {
          e.preventDefault();
          onCreateBelow();
          return;
        }

        // Enter: Auto-continue lists (- or 1.)
        if (e.key === 'Enter' && !e.shiftKey && !e.ctrlKey && !e.metaKey) {
          const textarea = e.target as HTMLTextAreaElement;
          const { value, selectionStart, selectionEnd } = textarea;

          // Only handle if no selection
          if (selectionStart !== selectionEnd) {
            return;
          }

          // Find current line
          const lineStart = value.lastIndexOf('\n', selectionStart - 1) + 1;
          const lineEnd = value.indexOf('\n', selectionStart);
          const currentLine = value.substring(
            lineStart,
            lineEnd === -1 ? value.length : lineEnd
          );

          // Check for unordered list: - or * at start
          const unorderedMatch = currentLine.match(/^(\s*)([-*])\s(.*)$/);
          if (unorderedMatch) {
            const [, indent, bullet, content] = unorderedMatch;
            // If line is empty (just "- "), remove the bullet on Enter
            if (!content.trim()) {
              e.preventDefault();
              const newValue =
                value.substring(0, lineStart) +
                value.substring(selectionStart);
              onContentChange(newValue);
              // Set cursor at line start
              setTimeout(() => {
                textarea.setSelectionRange(lineStart, lineStart);
              }, 0);
              return;
            }
            // Continue the list
            e.preventDefault();
            const insertion = `\n${indent}${bullet} `;
            const newValue =
              value.substring(0, selectionStart) +
              insertion +
              value.substring(selectionStart);
            onContentChange(newValue);
            setTimeout(() => {
              const newPos = selectionStart + insertion.length;
              textarea.setSelectionRange(newPos, newPos);
            }, 0);
            return;
          }

          // Check for ordered list: 1. 2. etc
          const orderedMatch = currentLine.match(/^(\s*)(\d+)\.\s(.*)$/);
          if (orderedMatch) {
            const [, indent, numStr, content] = orderedMatch;
            // If line is empty (just "1. "), remove the number on Enter
            if (!content.trim()) {
              e.preventDefault();
              const newValue =
                value.substring(0, lineStart) +
                value.substring(selectionStart);
              onContentChange(newValue);
              setTimeout(() => {
                textarea.setSelectionRange(lineStart, lineStart);
              }, 0);
              return;
            }
            // Continue the list with incremented number
            e.preventDefault();
            const nextNum = parseInt(numStr, 10) + 1;
            const insertion = `\n${indent}${nextNum}. `;
            const newValue =
              value.substring(0, selectionStart) +
              insertion +
              value.substring(selectionStart);
            onContentChange(newValue);
            setTimeout(() => {
              const newPos = selectionStart + insertion.length;
              textarea.setSelectionRange(newPos, newPos);
            }, 0);
            return;
          }
        }

        // Pass to focus navigation
        onKeyDown(e);
      },
      [onKeyDown, onCreateBelow, onContentChange]
    );

    const cycleStatus = () => {
      const currentIndex = statusCycle.indexOf(prompt.metadata.status);
      const nextIndex = (currentIndex + 1) % statusCycle.length;
      onStatusChange(statusCycle[nextIndex]);
    };

    const isTrash = prompt.metadata.status === 'trash';

    return (
      <motion.div
        ref={(node) => {
          setNodeRef(node);
          if (typeof ref === 'function') {
            ref(node);
          } else if (ref) {
            ref.current = node;
          }
        }}
        style={style}
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: isDragging ? 0.5 : 1, y: 0 }}
        exit={{ opacity: 0, height: 0, marginBottom: 0 }}
        transition={{ duration: 0.2 }}
        data-testid="prompt-cell"
        data-prompt-id={prompt.id}
        className={clsx(
          'group relative rounded-lg border transition-all',
          'bg-[var(--vscode-editor-background)]',
          isFocused
            ? 'border-[var(--vscode-focusBorder)]'
            : 'border-[var(--vscode-panel-border)] hover:border-[var(--vscode-focusBorder)]/50',
          isTrash && 'opacity-50',
          isDragging && 'z-50'
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-3 py-2 border-b border-[var(--vscode-panel-border)]">
          <div className="flex items-center gap-2">
            {/* Drag handle */}
            <button
              {...attributes}
              {...listeners}
              className="cursor-grab active:cursor-grabbing p-1 -ml-1 text-gray-500 hover:text-gray-300"
              title="Drag to reorder"
            >
              <DragHandle />
            </button>
            <StatusBadge status={prompt.metadata.status} onClick={cycleStatus} />
            {/* Claude session indicator */}
            {prompt.metadata.claudeSessionId && (
              <span
                className="claude-session-indicator"
                title={`Linked to Claude session`}
                data-testid="claude-indicator"
              >
                linked
              </span>
            )}
          </div>
          <div className="opacity-0 group-hover:opacity-100 transition-fast">
            <Toolbar
              content={prompt.content}
              status={prompt.metadata.status}
              onStatusChange={onStatusChange}
              onDelete={onDelete}
              onCreateBelow={onCreateBelow}
            />
          </div>
        </div>

        {/* Content */}
        <div className="p-3">
          <TextareaAutosize
            ref={textareaRef}
            value={prompt.content}
            onChange={(e) => onContentChange(e.target.value)}
            onFocus={onFocus}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            placeholder="Enter your prompt..."
            minRows={2}
            className={clsx(
              'w-full bg-transparent resize-none outline-none',
              'text-[var(--vscode-editor-foreground)]',
              'placeholder:text-gray-500',
              'font-mono text-sm leading-relaxed'
            )}
          />
        </div>

        {/* Folder link (if present) */}
        {prompt.metadata.folderLink && (
          <div className="px-3 pb-2">
            <button
              type="button"
              onClick={() => {
                // Would call openFolder via vscode
              }}
              className="text-xs text-blue-400 hover:underline"
            >
              {prompt.metadata.folderLink}
            </button>
          </div>
        )}

        {/* Claude response preview (if linked) */}
        {prompt.metadata.claudeSessionId && (
          <div className="px-3 pb-3">
            <ResponsePreview
              claudeSessionId={prompt.metadata.claudeSessionId}
              claudeMessageId={prompt.metadata.claudeMessageId}
              responsePreview={prompt.metadata.responsePreview}
              executedAt={prompt.metadata.executedAt}
            />
          </div>
        )}
      </motion.div>
    );
  }
);

function DragHandle() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="currentColor"
    >
      <circle cx="9" cy="5" r="2" />
      <circle cx="9" cy="12" r="2" />
      <circle cx="9" cy="19" r="2" />
      <circle cx="15" cy="5" r="2" />
      <circle cx="15" cy="12" r="2" />
      <circle cx="15" cy="19" r="2" />
    </svg>
  );
}
