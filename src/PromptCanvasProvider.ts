import * as vscode from 'vscode';
import { parse, serialize } from './lib/parser';
import type { PromptDocument, WebviewMessage, ClaudeSessionSummary } from './lib/types';
import { ClaudeSessionService } from './lib/ClaudeSessionService';
import { getResponseForMessage, type SessionInfo } from './lib/claudeSession';

export class PromptCanvasProvider implements vscode.CustomTextEditorProvider {
  public static readonly viewType = 'promptCanvas.editor';

  private pendingEdits = new Set<string>();

  constructor(private readonly context: vscode.ExtensionContext) {}

  public async resolveCustomTextEditor(
    document: vscode.TextDocument,
    webviewPanel: vscode.WebviewPanel,
    _token: vscode.CancellationToken
  ): Promise<void> {
    webviewPanel.webview.options = {
      enableScripts: true,
      localResourceRoots: [
        vscode.Uri.joinPath(this.context.extensionUri, 'out', 'webview')
      ]
    };

    webviewPanel.webview.html = this.getHtmlForWebview(webviewPanel.webview);

    // Initialize Claude session service for this project
    const workspaceFolder = vscode.workspace.getWorkspaceFolder(document.uri);
    const projectPath = workspaceFolder?.uri.fsPath || vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || '';
    const sessionService = new ClaudeSessionService(projectPath);

    // Helper to convert SessionInfo to ClaudeSessionSummary (serialize dates)
    const toSessionSummary = (session: SessionInfo): ClaudeSessionSummary => ({
      sessionId: session.sessionId,
      projectPath: session.projectPath,
      startTime: session.startTime.toISOString(),
      lastTime: session.lastTime.toISOString(),
      messageCount: session.messageCount,
      firstPrompt: session.firstPrompt,
      summaries: session.summaries,
    });

    // Helper to send sessions to webview
    const sendSessions = (sessions: SessionInfo[]) => {
      webviewPanel.webview.postMessage({
        type: 'sessionsUpdated',
        sessions: sessions.map(toSessionSummary)
      });
    };

    // Subscribe to session changes
    const sessionSubscription = sessionService.onSessionsChanged(sendSessions);

    // Wait for webview to be ready, then send document
    const sendDocument = () => {
      const promptDoc = parse(document.getText());
      webviewPanel.webview.postMessage({
        type: 'documentLoaded',
        document: promptDoc
      });
    };

    // Handle messages from webview
    const messageSubscription = webviewPanel.webview.onDidReceiveMessage(async (message: WebviewMessage) => {
      switch (message.type) {
        case 'ready':
          sendDocument();
          // Initialize session service after webview is ready
          sessionService.initialize().catch(err => {
            console.error('Failed to initialize Claude session service:', err);
          });
          break;
        case 'contentChanged':
          await this.updateDocument(document, message.document);
          break;
        case 'copyToClipboard':
          await vscode.env.clipboard.writeText(message.text);
          break;
        case 'openFolder':
          try {
            const folderUri = vscode.Uri.file(message.path);
            await vscode.commands.executeCommand('revealInExplorer', folderUri);
          } catch {
            vscode.window.showErrorMessage(`Could not open folder: ${message.path}`);
          }
          break;
        case 'getResponse': {
          const session = sessionService.getSession(message.sessionId);
          if (session && message.messageId) {
            try {
              const response = await getResponseForMessage(session.filePath, message.messageId);
              if (response) {
                webviewPanel.webview.postMessage({
                  type: 'responseLoaded',
                  promptId: message.messageId,
                  response
                });
              }
            } catch (err) {
              console.error('Failed to get response:', err);
            }
          }
          break;
        }
      }
    });

    // Handle external document changes
    const changeSubscription = vscode.workspace.onDidChangeTextDocument(e => {
      if (e.document.uri.toString() !== document.uri.toString()) {
        return;
      }

      // Skip if this is our own edit
      const editKey = document.uri.toString();
      if (this.pendingEdits.has(editKey)) {
        return;
      }

      // External edit - update webview
      const promptDoc = parse(document.getText());
      webviewPanel.webview.postMessage({
        type: 'documentUpdated',
        document: promptDoc
      });
    });

    webviewPanel.onDidDispose(() => {
      messageSubscription.dispose();
      changeSubscription.dispose();
      sessionSubscription.dispose();
      sessionService.dispose();
    });
  }

  private async updateDocument(document: vscode.TextDocument, promptDoc: PromptDocument) {
    const newText = serialize(promptDoc);

    // Skip if content hasn't changed
    if (newText === document.getText()) {
      return;
    }

    const editKey = document.uri.toString();
    this.pendingEdits.add(editKey);

    try {
      const edit = new vscode.WorkspaceEdit();
      edit.replace(
        document.uri,
        new vscode.Range(0, 0, document.lineCount, 0),
        newText
      );
      await vscode.workspace.applyEdit(edit);
    } finally {
      // Clear pending flag after a short delay to handle async updates
      setTimeout(() => {
        this.pendingEdits.delete(editKey);
      }, 100);
    }
  }

  private getHtmlForWebview(webview: vscode.Webview): string {
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.context.extensionUri, 'out', 'webview', 'index.js')
    );
    const styleUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.context.extensionUri, 'out', 'webview', 'index.css')
    );

    const nonce = getNonce();

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}'; img-src ${webview.cspSource} data:;">
  <link href="${styleUri}" rel="stylesheet">
  <title>Prompt Canvas</title>
</head>
<body>
  <div id="root"></div>
  <script nonce="${nonce}" type="module" src="${scriptUri}"></script>
</body>
</html>`;
  }
}

function getNonce(): string {
  let text = '';
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < 32; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}
