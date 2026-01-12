import { clsx } from 'clsx';
import { motion, AnimatePresence } from 'framer-motion';
import type { Prompt, PromptStatus, PromptSet } from '../types';
import { PromptCell } from './PromptCell';

interface PromptSetContainerProps {
  set: PromptSet;
  prompts: Prompt[];
  focusedId: string | null;
  onFocus: (id: string) => void;
  onContentChange: (id: string, content: string) => void;
  onStatusChange: (id: string, status: PromptStatus) => void;
  onDelete: (id: string) => void;
  onCreateBelow: (id: string) => void;
  onToggleCollapse: () => void;
  onSetActive: () => void;
  onKeyDown: (promptId: string, e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  registerTextarea: (id: string, el: HTMLTextAreaElement | null) => void;
}

export function PromptSetContainer({
  set,
  prompts,
  focusedId,
  onFocus,
  onContentChange,
  onStatusChange,
  onDelete,
  onCreateBelow,
  onToggleCollapse,
  onSetActive,
  onKeyDown,
  registerTextarea,
}: PromptSetContainerProps) {
  const isCollapsed = set.collapsed;
  const isActive = set.active;
  const setName = set.name || `Set ${set.id.slice(0, 6)}`;

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
            'flex items-center gap-2 flex-1',
            'text-left text-sm font-medium',
            'hover:opacity-80 transition-fast'
          )}
        >
          <ChevronIcon isOpen={!isCollapsed} />
          <span
            className={clsx(
              'flex-1',
              isActive
                ? 'text-blue-400'
                : 'text-[var(--vscode-editor-foreground)]'
            )}
          >
            {setName}
          </span>
        </button>

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
            <div className="p-3 space-y-3">
              {prompts.map((prompt, index) => (
                <div key={prompt.id}>
                  {/* Visual separator between prompts */}
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
