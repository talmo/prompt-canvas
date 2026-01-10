import { clsx } from 'clsx';
import type { PromptStatus } from '../types';

interface StatusBadgeProps {
  status: PromptStatus;
  onClick?: () => void;
}

const statusConfig: Record<
  PromptStatus,
  { label: string; className: string; icon: string }
> = {
  queue: {
    label: 'Queue',
    className: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
    icon: '○',
  },
  active: {
    label: 'Active',
    className: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    icon: '●',
  },
  done: {
    label: 'Done',
    className: 'bg-green-500/20 text-green-400 border-green-500/30',
    icon: '✓',
  },
  trash: {
    label: 'Trash',
    className: 'bg-red-500/20 text-red-400 border-red-500/30',
    icon: '×',
  },
};

export function StatusBadge({ status, onClick }: StatusBadgeProps) {
  const config = statusConfig[status];

  return (
    <button
      type="button"
      onClick={onClick}
      className={clsx(
        'inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium border',
        'transition-fast hover:opacity-80',
        config.className,
        onClick && 'cursor-pointer'
      )}
      title={`Status: ${config.label}. Click to cycle.`}
    >
      <span className="text-[10px]">{config.icon}</span>
      <span>{config.label}</span>
    </button>
  );
}
