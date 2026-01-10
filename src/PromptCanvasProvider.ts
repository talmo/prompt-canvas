import * as vscode from 'vscode';
import { parse, serialize } from './lib/parser';
import type { PromptDocument, WebviewMessage } from './lib/types';

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
