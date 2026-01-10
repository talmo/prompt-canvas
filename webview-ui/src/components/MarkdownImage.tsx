import { useState } from 'react';
import { clsx } from 'clsx';

interface MarkdownImageProps {
  src: string;
  alt: string;
}

export function MarkdownImage({ src, alt }: MarkdownImageProps) {
  const [hasError, setHasError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  if (hasError) {
    return (
      <div className="inline-flex items-center gap-2 px-3 py-2 rounded bg-red-500/10 text-red-400 text-sm border border-red-500/30">
        <ImageBrokenIcon />
        <span>Failed to load: {alt || src}</span>
      </div>
    );
  }

  return (
    <div className="relative inline-block my-2">
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-800/50 rounded">
          <span className="text-gray-400 text-sm">Loading...</span>
        </div>
      )}
      <img
        src={src}
        alt={alt}
        onLoad={() => setIsLoading(false)}
        onError={() => {
          setIsLoading(false);
          setHasError(true);
        }}
        className={clsx(
          'max-w-full h-auto rounded border border-[var(--vscode-panel-border)]',
          isLoading && 'opacity-0'
        )}
      />
    </div>
  );
}

function ImageBrokenIcon() {
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
    >
      <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
      <line x1="3" y1="3" x2="21" y2="21" />
    </svg>
  );
}

// Parse markdown content and extract images
export function parseMarkdownImages(content: string): Array<{ type: 'text' | 'image'; value: string; alt?: string }> {
  const imageRegex = /!\[([^\]]*)\]\(([^)]+)\)/g;
  const parts: Array<{ type: 'text' | 'image'; value: string; alt?: string }> = [];
  let lastIndex = 0;
  let match;

  while ((match = imageRegex.exec(content)) !== null) {
    // Add text before the image
    if (match.index > lastIndex) {
      parts.push({
        type: 'text',
        value: content.slice(lastIndex, match.index),
      });
    }

    // Add the image
    parts.push({
      type: 'image',
      value: match[2], // src
      alt: match[1],   // alt text
    });

    lastIndex = match.index + match[0].length;
  }

  // Add remaining text
  if (lastIndex < content.length) {
    parts.push({
      type: 'text',
      value: content.slice(lastIndex),
    });
  }

  return parts;
}
