import { useEffect } from 'react';
import type { ExtensionMessage } from '../types';
import { useCanvasStore } from '../store/useCanvasStore';
import { vscode } from '../vscode';

export function useVSCodeBridge() {
  const setDocument = useCanvasStore((s) => s.setDocument);
  const setClaudeSessions = useCanvasStore((s) => s.setClaudeSessions);

  useEffect(() => {
    const handleMessage = (event: MessageEvent<ExtensionMessage>) => {
      const message = event.data;

      switch (message.type) {
        case 'documentLoaded':
          setDocument(message.document, true);
          break;
        case 'documentUpdated':
          // Only update if this is an external change
          setDocument(message.document, true);
          break;
        case 'sessionsUpdated':
          setClaudeSessions(message.sessions);
          break;
        case 'responseLoaded':
          // Response loaded - could update a preview cache here
          console.log('Response loaded for prompt:', message.promptId);
          break;
      }
    };

    window.addEventListener('message', handleMessage);

    // Tell extension we're ready
    vscode.postMessage({ type: 'ready' });

    return () => {
      window.removeEventListener('message', handleMessage);
    };
  }, [setDocument, setClaudeSessions]);
}
