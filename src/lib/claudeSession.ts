/**
 * Claude Code Session Reader
 *
 * Pure Node.js functions for reading Claude Code session files from ~/.claude/projects/
 * These functions have no VS Code dependencies and can be unit tested.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as readline from 'readline';

// Types based on Claude Code JSONL structure
export interface ClaudeMessage {
  role: 'user' | 'assistant' | 'system';
  content: string | ContentBlock[];
}

export interface ContentBlock {
  type: 'text' | 'tool_use' | 'tool_result';
  text?: string;
  name?: string;
  input?: Record<string, unknown>;
}

export interface UserMessage {
  type: 'user';
  sessionId: string;
  uuid: string;
  parentUuid: string | null;
  message: ClaudeMessage;
  timestamp: string;
  cwd: string;
  gitBranch?: string;
  version?: string;
  isMeta?: boolean;
}

export interface AssistantMessage {
  type: 'assistant';
  sessionId: string;
  uuid: string;
  parentUuid: string | null;
  message: ClaudeMessage;
  timestamp: string;
  costUSD?: number;
  durationMs?: number;
}

export interface FileHistorySnapshot {
  type: 'file-history-snapshot';
  messageId: string;
  snapshot: {
    messageId: string;
    trackedFileBackups: Record<string, {
      backupFileName: string | null;
      version: number;
      backupTime: string;
    }>;
    timestamp: string;
  };
}

export interface SummaryMessage {
  type: 'summary';
  summary: string;
  leafUuid: string;
}

export type SessionEntry = UserMessage | AssistantMessage | FileHistorySnapshot | SummaryMessage;

export interface SessionInfo {
  sessionId: string;
  projectPath: string;
  filePath: string;
  startTime: Date;
  lastTime: Date;
  messageCount: number;
  firstPrompt: string;
  summaries: string[];
}

/**
 * Encode project path to Claude's format (slashes become dashes)
 */
export function encodeProjectPath(projectPath: string): string {
  return projectPath.replace(/\//g, '-');
}

/**
 * Get Claude projects directory
 */
export function getClaudeProjectsDir(): string {
  return path.join(os.homedir(), '.claude', 'projects');
}

/**
 * Get the encoded project directory for a specific project
 */
export function getProjectSessionDir(projectPath: string): string {
  const projectsDir = getClaudeProjectsDir();
  const encodedPath = encodeProjectPath(projectPath);
  return path.join(projectsDir, encodedPath);
}

/**
 * Extract text content from a Claude message
 */
export function extractTextContent(content: string | ContentBlock[]): string {
  if (typeof content === 'string') {
    return content;
  }
  for (const block of content) {
    if (block.type === 'text' && block.text) {
      return block.text;
    }
  }
  return '';
}

/**
 * Get info about a single session file
 */
export async function getSessionInfo(
  filePath: string,
  sessionId: string,
  projectPath: string
): Promise<SessionInfo | null> {
  const fileStream = fs.createReadStream(filePath);
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });

  let firstPrompt = '';
  let startTime: Date | null = null;
  let lastTime: Date | null = null;
  let messageCount = 0;
  const summaries: string[] = [];

  for await (const line of rl) {
    if (!line.trim()) continue;

    try {
      const entry = JSON.parse(line) as SessionEntry;

      if (entry.type === 'user' && !entry.isMeta) {
        messageCount++;
        const timestamp = new Date(entry.timestamp);
        if (!startTime) startTime = timestamp;
        lastTime = timestamp;

        if (!firstPrompt && entry.message?.content) {
          firstPrompt = extractTextContent(entry.message.content).slice(0, 200);
        }
      }

      if (entry.type === 'assistant') {
        messageCount++;
        const timestamp = new Date(entry.timestamp);
        lastTime = timestamp;
      }

      if (entry.type === 'summary') {
        summaries.push(entry.summary);
      }
    } catch {
      // Skip malformed lines
    }
  }

  if (!startTime || !lastTime) return null;

  return {
    sessionId,
    projectPath,
    filePath,
    startTime,
    lastTime,
    messageCount,
    firstPrompt,
    summaries
  };
}

/**
 * List all sessions for a project
 */
export async function listProjectSessions(projectPath: string): Promise<SessionInfo[]> {
  const projectDir = getProjectSessionDir(projectPath);

  if (!fs.existsSync(projectDir)) {
    return [];
  }

  const files = fs.readdirSync(projectDir)
    .filter(f => f.endsWith('.jsonl'))
    .map(f => path.join(projectDir, f));

  const sessions: SessionInfo[] = [];

  for (const file of files) {
    const sessionId = path.basename(file, '.jsonl');
    const info = await getSessionInfo(file, sessionId, projectPath);
    if (info) {
      sessions.push(info);
    }
  }

  // Sort by last activity (most recent first)
  sessions.sort((a, b) => b.lastTime.getTime() - a.lastTime.getTime());

  return sessions;
}

/**
 * Read full session messages as an async generator
 */
export async function* readSessionMessages(filePath: string): AsyncGenerator<SessionEntry> {
  const fileStream = fs.createReadStream(filePath);
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });

  for await (const line of rl) {
    if (!line.trim()) continue;

    try {
      const entry = JSON.parse(line) as SessionEntry;
      yield entry;
    } catch {
      // Skip malformed lines
    }
  }
}

/**
 * Get the response for a specific user message
 */
export async function getResponseForMessage(
  filePath: string,
  messageUuid: string
): Promise<string | null> {
  for await (const entry of readSessionMessages(filePath)) {
    if (entry.type === 'assistant' && entry.parentUuid === messageUuid) {
      return extractTextContent(entry.message.content);
    }
  }
  return null;
}

/**
 * Find a user message by matching content
 */
export async function findMessageByContent(
  filePath: string,
  contentPrefix: string
): Promise<UserMessage | null> {
  for await (const entry of readSessionMessages(filePath)) {
    if (entry.type === 'user' && !entry.isMeta) {
      const text = extractTextContent(entry.message.content);
      if (text.startsWith(contentPrefix)) {
        return entry;
      }
    }
  }
  return null;
}
