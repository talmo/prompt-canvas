import { clsx } from 'clsx';
import { motion, AnimatePresence } from 'framer-motion';
import type { Prompt, PromptStatus, GroupMetadata } from '../types';
import { PromptCell } from './PromptCell';

interface PromptGroupProps {
  groupId: string;
  metadata: GroupMetadata;
  prompts: Prompt[];
  focusedId: string | null;
  onFocus: (id: string) => void;
  onContentChange: (id: string, content: string) => void;
  onStatusChange: (id: string, status: PromptStatus) => void;
  onDelete: (id: string) => void;
  onCreateBelow: (id: string) => void;
  onToggleCollapse: () => void;
  onKeyDown: (promptId: string, e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  registerTextarea: (id: string, el: HTMLTextAreaElement | null) => void;
}

export function PromptGroup({
  groupId,
  metadata,
  prompts,
  focusedId,
  onFocus,
  onContentChange,
  onStatusChange,
  onDelete,
  onCreateBelow,
  onToggleCollapse,
  onKeyDown,
  registerTextarea,
}: PromptGroupProps) {
  const isCollapsed = metadata.collapsed;
  const groupName = metadata.name || `Group ${groupId.slice(0, 6)}`;

  // Count prompts by status
  const statusCounts = prompts.reduce(
    (acc, p) => {
      acc[p.metadata.status] = (acc[p.metadata.status] || 0) + 1;
      return acc;
    },
    {} as Record<PromptStatus, number>
  );

  return (
    <div className="mb-6">
      {/* Group header */}
      <button
        type="button"
        onClick={onToggleCollapse}
        className={clsx(
          'w-full flex items-center gap-2 px-3 py-2 mb-2',
          'text-left text-sm font-medium',
          'rounded-lg border border-[var(--vscode-panel-border)]',
          'bg-[var(--vscode-editor-background)]',
          'hover:border-[var(--vscode-focusBorder)]/50 transition-fast'
        )}
      >
        <ChevronIcon isOpen={!isCollapsed} />
        <span className="flex-1 text-[var(--vscode-editor-foreground)]">
          {groupName}
        </span>
        <span className="text-gray-500 text-xs">
          {prompts.length} prompt{prompts.length !== 1 ? 's' : ''}
        </span>
        {/* Status summary */}
        <div className="flex gap-1">
          {statusCounts.active && (
            <span className="text-xs text-blue-400">{statusCounts.active} active</span>
          )}
          {statusCounts.done && (
            <span className="text-xs text-green-400">{statusCounts.done} done</span>
          )}
        </div>
      </button>

      {/* Group content */}
      <AnimatePresence initial={false}>
        {!isCollapsed && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden pl-4"
          >
            <div className="space-y-3 border-l-2 border-[var(--vscode-panel-border)] pl-4">
              {prompts.map((prompt) => (
                <PromptCell
                  key={prompt.id}
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
