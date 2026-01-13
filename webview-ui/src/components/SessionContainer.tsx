import { useState, useRef, useEffect } from 'react';
import { clsx } from 'clsx';
import { motion, AnimatePresence } from 'framer-motion';
import type { Prompt, PromptStatus, Session } from '../types';
import { PromptCell } from './PromptCell';

interface SessionContainerProps {
  session: Session;
  prompts: Prompt[];
  focusedId: string | null;
  onFocus: (id: string) => void;
  onContentChange: (id: string, content: string) => void;
  onStatusChange: (id: string, status: PromptStatus) => void;
  onDelete: (id: string) => void;
  onCreateBelow: (id: string) => void;
  onToggleCollapse: () => void;
  onRename: (name: string) => void;
  onKeyDown: (promptId: string, e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  registerTextarea: (id: string, el: HTMLTextAreaElement | null) => void;
}

export function SessionContainer({
  session,
  prompts,
  focusedId,
  onFocus,
  onContentChange,
  onStatusChange,
  onDelete,
  onCreateBelow,
  onToggleCollapse,
  onRename,
  onKeyDown,
  registerTextarea,
}: SessionContainerProps) {
  const isCollapsed = session.collapsed ?? false;
  const defaultName = `Session ${session.id.slice(0, 6)}`;
  const sessionName = session.name || defaultName;

  // Editable name state
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(session.name || '');
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus input when entering edit mode
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleStartEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    setEditValue(session.name || '');
    setIsEditing(true);
  };

  const handleFinishEdit = () => {
    const trimmed = editValue.trim();
    if (trimmed !== (session.name || '')) {
      onRename(trimmed);
    }
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleFinishEdit();
    } else if (e.key === 'Escape') {
      setEditValue(session.name || '');
      setIsEditing(false);
    }
  };

  // Count prompts by status
  const statusCounts = prompts.reduce(
    (acc, p) => {
      acc[p.metadata.status] = (acc[p.metadata.status] || 0) + 1;
      return acc;
    },
    {} as Record<PromptStatus, number>
  );

  const doneCount = statusCounts.done || 0;
  const totalCount = prompts.length;

  return (
    <div
      className={clsx(
        'ml-2 mb-4 border-l-2 border-[var(--vscode-panel-border)] pl-3',
        'transition-all'
      )}
      data-testid="session-container"
      data-session-id={session.id}
    >
      {/* Session header */}
      <div className="flex items-center gap-2 py-1.5">
        <button
          type="button"
          onClick={onToggleCollapse}
          data-testid="session-header"
          data-session-id={session.id}
          data-collapsed={isCollapsed}
          className={clsx(
            'flex items-center gap-1',
            'text-left text-xs font-medium',
            'hover:opacity-80 transition-fast',
            'text-gray-400'
          )}
        >
          <ChevronIcon isOpen={!isCollapsed} size={12} />
        </button>

        {/* Editable session name */}
        {isEditing ? (
          <input
            ref={inputRef}
            type="text"
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={handleFinishEdit}
            onKeyDown={handleKeyDown}
            placeholder="Session name..."
            className={clsx(
              'flex-1 px-1.5 py-0.5 rounded text-xs font-medium',
              'bg-[var(--vscode-input-background)]',
              'border border-[var(--vscode-input-border)]',
              'text-[var(--vscode-input-foreground)]',
              'focus:outline-none focus:border-blue-500'
            )}
          />
        ) : (
          <button
            type="button"
            onClick={handleStartEdit}
            className={clsx(
              'flex-1 text-left text-xs font-medium px-1 rounded',
              'hover:bg-[var(--vscode-list-hoverBackground)] transition-fast',
              'text-gray-400',
              !session.name && 'italic'
            )}
            title="Click to rename"
          >
            {sessionName}
          </button>
        )}

        {/* Status summary */}
        <div className="flex items-center gap-2 text-xs">
          {isCollapsed && (
            <span className="text-gray-600">
              {totalCount} prompt{totalCount !== 1 ? 's' : ''}
            </span>
          )}
          {doneCount > 0 && (
            <span className="text-green-500/70 text-xs">{doneCount}/{totalCount}</span>
          )}
        </div>
      </div>

      {/* Session content */}
      <AnimatePresence initial={false}>
        {!isCollapsed && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="overflow-hidden"
          >
            <div className="space-y-3 pt-1">
              {prompts.map((prompt, index) => (
                <div key={prompt.id}>
                  {/* Visual separator between prompts */}
                  {index > 0 && (
                    <div className="flex items-center gap-2 py-2">
                      <div className="flex-1 h-px bg-[var(--vscode-panel-border)] opacity-30" />
                    </div>
                  )}
                  <PromptCell
                    prompt={prompt}
                    isFocused={focusedId === prompt.id}
                    onFocus={() => onFocus(prompt.id)}
                    onContentChange={(content) => onContentChange(prompt.id, content)}
                    onStatusChange={(status) => onStatusChange(prompt.id, status)}
                    onDelete={() => onDelete(prompt.id)}
                    onCreateBelow={() => onCreateBelow(prompt.id)}
                    onKeyDown={(e) => onKeyDown(prompt.id, e)}
                    registerTextarea={registerTextarea}
                  />
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function ChevronIcon({ isOpen, size = 16 }: { isOpen: boolean; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={clsx(
        'transition-transform',
        isOpen ? 'rotate-90' : 'rotate-0'
      )}
    >
      <polyline points="9,18 15,12 9,6" />
    </svg>
  );
}
