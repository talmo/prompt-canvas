import type { WebviewMessage } from './types';

interface VSCodeApi {
  postMessage(message: WebviewMessage): void;
  getState(): unknown;
  setState(state: unknown): void;
}

declare function acquireVsCodeApi(): VSCodeApi;

class VSCodeAPIWrapper {
  private readonly vscode: VSCodeApi | undefined;

  constructor() {
    if (typeof acquireVsCodeApi === 'function') {
      this.vscode = acquireVsCodeApi();
    }
  }

  public postMessage(message: WebviewMessage): void {
    if (this.vscode) {
      this.vscode.postMessage(message);
    } else {
      console.log('VS Code API not available, message:', message);
    }
  }

  public getState<T>(): T | undefined {
    if (this.vscode) {
      return this.vscode.getState() as T | undefined;
    }
    return undefined;
  }

  public setState<T>(state: T): void {
    if (this.vscode) {
      this.vscode.setState(state);
    }
  }
}

export const vscode = new VSCodeAPIWrapper();
