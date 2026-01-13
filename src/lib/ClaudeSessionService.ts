/**
 * Claude Code Session Service
 *
 * VS Code service that manages Claude session data and file watching.
 * Uses the pure functions from claudeSession.ts.
 */

import * as vscode from 'vscode';
import {
  listProjectSessions,
  readSessionMessages,
  getProjectSessionDir,
  type SessionInfo,
  type SessionEntry,
} from './claudeSession';

/**
 * Service class that manages Claude session data and file watching
 */
export class ClaudeSessionService implements vscode.Disposable {
  private _onSessionsChanged = new vscode.EventEmitter<SessionInfo[]>();
  public readonly onSessionsChanged = this._onSessionsChanged.event;

  private watcher: vscode.FileSystemWatcher | null = null;
  private sessions: SessionInfo[] = [];
  private projectPath: string;

  constructor(projectPath: string) {
    this.projectPath = projectPath;
  }

  /**
   * Initialize the service and start watching for changes
   */
  async initialize(): Promise<void> {
    await this.refresh();
    this.startWatching();
  }

  /**
   * Get current sessions
   */
  getSessions(): SessionInfo[] {
    return this.sessions;
  }

  /**
   * Refresh session list from disk
   */
  async refresh(): Promise<void> {
    this.sessions = await listProjectSessions(this.projectPath);
    this._onSessionsChanged.fire(this.sessions);
  }

  /**
   * Get a session by ID
   */
  getSession(sessionId: string): SessionInfo | undefined {
    return this.sessions.find(s => s.sessionId === sessionId);
  }

  /**
   * Read messages from a specific session
   */
  async readSession(sessionId: string): Promise<SessionEntry[]> {
    const session = this.getSession(sessionId);
    if (!session) {
      return [];
    }

    const entries: SessionEntry[] = [];
    for await (const entry of readSessionMessages(session.filePath)) {
      entries.push(entry);
    }
    return entries;
  }

  /**
   * Start watching session directory for changes
   */
  private startWatching(): void {
    const sessionDir = getProjectSessionDir(this.projectPath);
    const pattern = new vscode.RelativePattern(sessionDir, '*.jsonl');

    this.watcher = vscode.workspace.createFileSystemWatcher(pattern);

    this.watcher.onDidCreate(() => this.refresh());
    this.watcher.onDidChange(() => this.refresh());
    this.watcher.onDidDelete(() => this.refresh());
  }

  /**
   * Dispose resources
   */
  dispose(): void {
    this.watcher?.dispose();
    this._onSessionsChanged.dispose();
  }
}
