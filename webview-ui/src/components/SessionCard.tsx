import type { ClaudeSessionSummary } from '../types';

interface SessionCardProps {
  session: ClaudeSessionSummary;
  isSelected: boolean;
  onSelect: () => void;
  onLink: () => void;
}

function formatRelativeTime(isoString: string): string {
  const date = new Date(isoString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins} min ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
  return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
}

export function SessionCard({ session, isSelected, onSelect, onLink }: SessionCardProps) {
  const truncatedPrompt = session.firstPrompt.length > 100
    ? session.firstPrompt.slice(0, 100) + '...'
    : session.firstPrompt;

  return (
    <div
      className={`session-card ${isSelected ? 'selected' : ''}`}
      onClick={onSelect}
      data-testid="session-card"
      data-session-id={session.sessionId}
    >
      <div className="session-card-header">
        <span className="session-time">{formatRelativeTime(session.lastTime)}</span>
        <span className="session-count">{session.messageCount} messages</span>
      </div>
      <div className="session-prompt">"{truncatedPrompt}"</div>
      {session.summaries.length > 0 && (
        <div className="session-summaries">
          {session.summaries.slice(0, 2).map((s, i) => (
            <span key={i} className="session-summary">{s}</span>
          ))}
        </div>
      )}
      <button
        className="session-link-button"
        onClick={(e) => {
          e.stopPropagation();
          onLink();
        }}
        data-testid="link-session-button"
      >
        Link to Selected Prompt
      </button>
    </div>
  );
}
