import { useState, useRef, useEffect, useMemo } from 'react';
import { clsx } from 'clsx';
import { motion, AnimatePresence } from 'framer-motion';
import type { Prompt, PromptStatus, PromptSet, Session } from '../types';
import { PromptCell } from './PromptCell';
import { SessionContainer } from './SessionContainer';

interface PromptSetContainerProps {
  set: PromptSet;
  prompts: Prompt[];
  sessions: Session[];
  focusedId: string | null;
  onFocus: (id: string) => void;
  onContentChange: (id: string, content: string) => void;
  onStatusChange: (id: string, status: PromptStatus) => void;
  onDelete: (id: string) => void;
  onCreateBelow: (id: string) => void;
  onToggleCollapse: () => void;
  onSetActive: () => void;
  onRename: (name: string) => void;
  onToggleSessionCollapse: (sessionId: string) => void;
  onRenameSession: (sessionId: string, name: string) => void;
  onKeyDown: (promptId: string, e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  registerTextarea: (id: string, el: HTMLTextAreaElement | null) => void;
}

export function PromptSetContainer({
  set,
  prompts,
  sessions,
  focusedId,
  onFocus,
  onContentChange,
  onStatusChange,
  onDelete,
  onCreateBelow,
  onToggleCollapse,
  onSetActive,
  onRename,
  onToggleSessionCollapse,
  onRenameSession,
  onKeyDown,
  registerTextarea,
}: PromptSetContainerProps) {
  const isCollapsed = set.collapsed;
  const isActive = set.active;
  const defaultName = `Set ${set.id.slice(0, 6)}`;
  const setName = set.name || defaultName;

  // Group prompts by session
  const { promptsBySession, orphanPrompts } = useMemo(() => {
    const promptsBySession = new Map<string, Prompt[]>();
    const orphanPrompts: Prompt[] = [];

    for (const prompt of prompts) {
      const sessionId = prompt.metadata.sessionId;
      if (sessionId) {
        if (!promptsBySession.has(sessionId)) {
          promptsBySession.set(sessionId, []);
        }
        promptsBySession.get(sessionId)!.push(prompt);
      } else {
        orphanPrompts.push(prompt);
      }
    }

    return { promptsBySession, orphanPrompts };
  }, [prompts]);

  // Editable name state
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(set.name || '');
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
    setEditValue(set.name || '');
    setIsEditing(true);
  };

  const handleFinishEdit = () => {
    const trimmed = editValue.trim();
    // Only save if changed from current name
    if (trimmed !== (set.name || '')) {
      onRename(trimmed);
    }
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleFinishEdit();
    } else if (e.key === 'Escape') {
      setEditValue(set.name || '');
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
        'mb-6 rounded-lg border-2 transition-all',
        isActive
          ? 'border-blue-500/70 bg-blue-500/5 shadow-lg shadow-blue-500/10'
          : 'border-[var(--vscode-panel-border)] bg-[var(--vscode-editor-background)]'
      )}
      data-testid="prompt-set"
      data-set-id={set.id}
      data-active={isActive}
    >
      {/* Set header */}
      <div
        className={clsx(
          'flex items-center gap-2 px-3 py-2',
          'border-b',
          isActive
            ? 'border-blue-500/30'
            : 'border-[var(--vscode-panel-border)]'
        )}
      >
        <button
          type="button"
          onClick={onToggleCollapse}
          data-testid="set-header"
          data-set-id={set.id}
          data-collapsed={isCollapsed}
          className={clsx(
            'flex items-center gap-2',
            'text-left text-sm font-medium',
            'hover:opacity-80 transition-fast'
          )}
        >
          <ChevronIcon isOpen={!isCollapsed} />
        </button>

        {/* Editable set name */}
        {isEditing ? (
          <input
            ref={inputRef}
            type="text"
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={handleFinishEdit}
            onKeyDown={handleKeyDown}
            placeholder="Set name..."
            className={clsx(
              'flex-1 px-2 py-0.5 rounded text-sm font-medium',
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
              'flex-1 text-left text-sm font-medium px-1 rounded',
              'hover:bg-[var(--vscode-list-hoverBackground)] transition-fast',
              isActive
                ? 'text-blue-400'
                : 'text-[var(--vscode-editor-foreground)]',
              !set.name && 'text-gray-500 italic'
            )}
            title="Click to rename"
          >
            {setName}
          </button>
        )}

        {/* Status summary */}
        <div className="flex items-center gap-2 text-xs">
          {isCollapsed && (
            <span className="text-gray-500">
              {totalCount} prompt{totalCount !== 1 ? 's' : ''}
            </span>
          )}
          {doneCount > 0 && (
            <span className="text-green-400">{doneCount}/{totalCount} done</span>
          )}
          {statusCounts.active && (
            <span className="text-blue-400">{statusCounts.active} active</span>
          )}
        </div>

        {/* Folder link */}
        {set.folderLink && (
          <span className="text-xs text-gray-500 truncate max-w-[150px]" title={set.folderLink}>
            {set.folderLink}
          </span>
        )}

        {/* Mark as active button */}
        {!isActive && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onSetActive();
            }}
            className={clsx(
              'px-2 py-1 rounded text-xs',
              'bg-blue-500/20 text-blue-400',
              'hover:bg-blue-500/30 transition-fast'
            )}
            title="Mark as active set"
          >
            Activate
          </button>
        )}

        {isActive && (
          <span className="px-2 py-0.5 rounded text-xs bg-blue-500/30 text-blue-300">
            Active
          </span>
        )}
      </div>

      {/* Set content */}
      <AnimatePresence initial={false}>
        {!isCollapsed && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="p-3">
              {/* Render orphan prompts first (prompts without a session) */}
              {orphanPrompts.length > 0 && (
                <div className="space-y-3 mb-4">
                  {orphanPrompts.map((prompt, index) => (
                    <div key={prompt.id}>
                      {index > 0 && (
                        <div className="flex items-center gap-2 py-2">
                          <div className="flex-1 h-px bg-[var(--vscode-panel-border)] opacity-50" />
                          <span className="text-gray-600 text-xs">---</span>
                          <div className="flex-1 h-px bg-[var(--vscode-panel-border)] opacity-50" />
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
              )}

              {/* Render sessions with their prompts */}
              {sessions.map((session) => {
                const sessionPrompts = promptsBySession.get(session.id) || [];
                if (sessionPrompts.length === 0) return null;

                return (
                  <SessionContainer
                    key={session.id}
                    session={session}
                    prompts={sessionPrompts}
                    focusedId={focusedId}
                    onFocus={onFocus}
                    onContentChange={onContentChange}
                    onStatusChange={onStatusChange}
                    onDelete={onDelete}
                    onCreateBelow={onCreateBelow}
                    onToggleCollapse={() => onToggleSessionCollapse(session.id)}
                    onRename={(name) => onRenameSession(session.id, name)}
                    onKeyDown={onKeyDown}
                    registerTextarea={registerTextarea}
                  />
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function ChevronIcon({ isOpen }: { isOpen: boolean }) {
  return (
    <svg
      width="16"
      height="16"
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
