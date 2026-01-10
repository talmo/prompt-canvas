import { useRef, useEffect, useCallback, forwardRef } from 'react';
import TextareaAutosize from 'react-textarea-autosize';
import { clsx } from 'clsx';
import { motion } from 'framer-motion';
import type { Prompt, PromptStatus } from '../types';
import { StatusBadge } from './StatusBadge';
import { Toolbar } from './Toolbar';
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

        // Pass to focus navigation
        onKeyDown(e);
      },
      [onKeyDown, onCreateBelow]
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
