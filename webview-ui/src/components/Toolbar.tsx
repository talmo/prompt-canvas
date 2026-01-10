import { clsx } from 'clsx';
import type { PromptStatus } from '../types';
import { vscode } from '../vscode';

interface ToolbarProps {
  content: string;
  status: PromptStatus;
  onStatusChange: (status: PromptStatus) => void;
  onDelete: () => void;
  onCreateBelow: () => void;
}

const statusCycle: PromptStatus[] = ['queue', 'active', 'done', 'trash'];

export function Toolbar({
  content,
  status,
  onStatusChange,
  onDelete,
  onCreateBelow,
}: ToolbarProps) {
  const handleCopy = () => {
    vscode.postMessage({ type: 'copyToClipboard', text: content });
  };

  const cycleStatus = () => {
    const currentIndex = statusCycle.indexOf(status);
    const nextIndex = (currentIndex + 1) % statusCycle.length;
    onStatusChange(statusCycle[nextIndex]);
  };

  return (
    <div className="flex items-center gap-1">
      <ToolbarButton onClick={handleCopy} title="Copy to clipboard">
        <CopyIcon />
      </ToolbarButton>
      <ToolbarButton onClick={onCreateBelow} title="Add prompt below (Shift+Enter)">
        <PlusIcon />
      </ToolbarButton>
      <ToolbarButton onClick={cycleStatus} title="Cycle status">
        <StatusIcon />
      </ToolbarButton>
      <ToolbarButton
        onClick={onDelete}
        title="Delete prompt"
        className="hover:text-red-400"
      >
        <TrashIcon />
      </ToolbarButton>
    </div>
  );
}

interface ToolbarButtonProps {
  onClick: () => void;
  title: string;
  children: React.ReactNode;
  className?: string;
}

function ToolbarButton({
  onClick,
  title,
  children,
  className,
}: ToolbarButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={clsx(
        'p-1.5 rounded hover:bg-white/10 transition-fast',
        'text-gray-400 hover:text-gray-200',
        className
      )}
    >
      {children}
    </button>
  );
}

function CopyIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}

function StatusIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="10" />
      <polyline points="12,6 12,12 16,14" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="3,6 5,6 21,6" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    </svg>
  );
}
