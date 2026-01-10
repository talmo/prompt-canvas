import * as vscode from 'vscode';
import { PromptCanvasProvider } from './PromptCanvasProvider';

export function activate(context: vscode.ExtensionContext) {
  const provider = new PromptCanvasProvider(context);

  context.subscriptions.push(
    vscode.window.registerCustomEditorProvider(
      PromptCanvasProvider.viewType,
      provider,
      {
        webviewOptions: {
          retainContextWhenHidden: true,
        },
        supportsMultipleEditorsPerDocument: false,
      }
    )
  );

  // Register commands
  context.subscriptions.push(
    vscode.commands.registerCommand('promptCanvas.newPrompt', () => {
      // Will be implemented to communicate with active webview
      vscode.window.showInformationMessage('New prompt command');
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('promptCanvas.openAsText', async () => {
      const activeEditor = vscode.window.activeTextEditor;
      if (activeEditor) {
        await vscode.commands.executeCommand(
          'vscode.openWith',
          activeEditor.document.uri,
          'default'
        );
      }
    })
  );
}

export function deactivate() {}
