import { useCanvasStore } from '../store/useCanvasStore';
import { SessionCard } from './SessionCard';

export function SessionBrowser() {
  const claudeSessions = useCanvasStore((s) => s.claudeSessions);
  const sessionBrowserOpen = useCanvasStore((s) => s.sessionBrowserOpen);
  const selectedSessionId = useCanvasStore((s) => s.selectedSessionId);
  const focusedId = useCanvasStore((s) => s.focusedId);
  const setSessionBrowserOpen = useCanvasStore((s) => s.setSessionBrowserOpen);
  const setSelectedSessionId = useCanvasStore((s) => s.setSelectedSessionId);
  const linkPromptToSession = useCanvasStore((s) => s.linkPromptToSession);

  if (!sessionBrowserOpen) {
    return null;
  }

  const handleClose = () => {
    setSessionBrowserOpen(false);
    setSelectedSessionId(null);
  };

  const handleLink = (sessionId: string) => {
    if (focusedId) {
      linkPromptToSession(focusedId, sessionId);
      handleClose();
    }
  };

  return (
    <div className="session-browser-overlay" onClick={handleClose}>
      <div
        className="session-browser"
        onClick={(e) => e.stopPropagation()}
        data-testid="session-browser"
      >
        <div className="session-browser-header">
          <h3>Claude Sessions</h3>
          <button
            className="session-browser-close"
            onClick={handleClose}
            aria-label="Close"
          >
            ×
          </button>
        </div>
        <div className="session-browser-content">
          {claudeSessions.length === 0 ? (
            <div className="session-browser-empty">
              <p>No Claude Code sessions found for this project.</p>
              <p className="session-browser-hint">
                Sessions will appear here after you use Claude Code in this workspace.
              </p>
            </div>
          ) : (
            <div className="session-list">
              {claudeSessions.map((session) => (
                <SessionCard
                  key={session.sessionId}
                  session={session}
                  isSelected={selectedSessionId === session.sessionId}
                  onSelect={() => setSelectedSessionId(session.sessionId)}
                  onLink={() => handleLink(session.sessionId)}
                />
              ))}
            </div>
          )}
        </div>
        {!focusedId && (
          <div className="session-browser-footer">
            <span className="session-browser-hint">
              Select a prompt first to link it to a session
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
