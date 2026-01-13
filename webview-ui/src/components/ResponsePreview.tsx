import { useState } from 'react';
import { clsx } from 'clsx';
import { vscode } from '../vscode';

interface ResponsePreviewProps {
  claudeSessionId: string;
  claudeMessageId?: string;
  responsePreview?: string;
  executedAt?: string;
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

export function ResponsePreview({
  claudeSessionId,
  claudeMessageId,
  responsePreview,
  executedAt,
}: ResponsePreviewProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [fullResponse] = useState<string | null>(null);

  const handleLoadFull = () => {
    if (fullResponse) {
      setIsExpanded(!isExpanded);
      return;
    }

    setIsLoading(true);
    vscode.postMessage({
      type: 'getResponse',
      sessionId: claudeSessionId,
      messageId: claudeMessageId,
    });

    // In a real implementation, we'd listen for the responseLoaded message
    // For now, just show loading then toggle
    setTimeout(() => {
      setIsLoading(false);
      setIsExpanded(true);
    }, 500);
  };

  const displayContent = isExpanded && fullResponse ? fullResponse : responsePreview;

  return (
    <div className="response-preview" data-testid="response-preview">
      <div
        className="response-preview-header"
        onClick={handleLoadFull}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === 'Enter' && handleLoadFull()}
      >
        <span className="response-preview-icon">{isExpanded ? '▼' : '▶'}</span>
        <span className="response-preview-title">
          Claude Response
          {executedAt && (
            <span className="response-preview-time">
              ({formatRelativeTime(executedAt)})
            </span>
          )}
        </span>
        {isLoading && <span className="response-preview-loading">Loading...</span>}
      </div>
      {displayContent && (
        <div
          className={clsx(
            'response-preview-content',
            isExpanded && 'expanded'
          )}
        >
          <div className="response-preview-text">
            {displayContent}
            {!isExpanded && displayContent.length >= 200 && (
              <span className="response-preview-more">...</span>
            )}
          </div>
          {!isExpanded && (
            <button
              className="response-preview-expand"
              onClick={handleLoadFull}
            >
              Show full response
            </button>
          )}
        </div>
      )}
    </div>
  );
}
