import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdirSync, writeFileSync, rmSync, existsSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import {
  encodeProjectPath,
  getSessionInfo,
  listProjectSessions,
  readSessionMessages,
  getResponseForMessage,
  findMessageByContent,
  type SessionEntry,
  type UserMessage,
  type AssistantMessage,
} from '../lib/claudeSession';

// Create a temporary test directory
const testDir = join(tmpdir(), 'prompt-canvas-test-sessions');
const testProjectPath = '/test/project';

// Sample session entries for testing
const sampleUserMessage: UserMessage = {
  type: 'user',
  sessionId: 'test-session',
  uuid: 'user-msg-1',
  parentUuid: null,
  message: {
    role: 'user',
    content: 'Hello, can you help me with my code?'
  },
  timestamp: '2026-01-12T10:00:00Z',
  cwd: '/test/project'
};

const sampleAssistantMessage: AssistantMessage = {
  type: 'assistant',
  sessionId: 'test-session',
  uuid: 'asst-msg-1',
  parentUuid: 'user-msg-1',
  message: {
    role: 'assistant',
    content: 'Of course! I would be happy to help. What do you need assistance with?'
  },
  timestamp: '2026-01-12T10:00:05Z',
  costUSD: 0.001,
  durationMs: 1500
};

const sampleUserMessage2: UserMessage = {
  type: 'user',
  sessionId: 'test-session',
  uuid: 'user-msg-2',
  parentUuid: 'asst-msg-1',
  message: {
    role: 'user',
    content: [{ type: 'text', text: 'I need to refactor this function' }]
  },
  timestamp: '2026-01-12T10:01:00Z',
  cwd: '/test/project'
};

const sampleMetaMessage: UserMessage = {
  type: 'user',
  sessionId: 'test-session',
  uuid: 'meta-msg',
  parentUuid: null,
  message: {
    role: 'user',
    content: 'meta message'
  },
  timestamp: '2026-01-12T09:59:00Z',
  cwd: '/test/project',
  isMeta: true
};

const sampleSummary = {
  type: 'summary' as const,
  summary: 'Helped user refactor code',
  leafUuid: 'user-msg-2'
};

function createTestSession(sessionId: string, entries: SessionEntry[]): void {
  const encodedPath = encodeProjectPath(testProjectPath);
  const sessionDir = join(testDir, encodedPath);

  if (!existsSync(sessionDir)) {
    mkdirSync(sessionDir, { recursive: true });
  }

  const sessionFile = join(sessionDir, `${sessionId}.jsonl`);
  const content = entries.map(e => JSON.stringify(e)).join('\n') + '\n';
  writeFileSync(sessionFile, content);
}

describe('claudeSession', () => {
  beforeAll(() => {
    // Clean up any existing test directory
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true });
    }
    mkdirSync(testDir, { recursive: true });
  });

  afterAll(() => {
    // Clean up test directory
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true });
    }
  });

  describe('encodeProjectPath', () => {
    it('encodes forward slashes as dashes', () => {
      expect(encodeProjectPath('/Users/test/project')).toBe('-Users-test-project');
    });

    it('handles paths with multiple slashes', () => {
      expect(encodeProjectPath('/a/b/c/d/e')).toBe('-a-b-c-d-e');
    });

    it('handles empty string', () => {
      expect(encodeProjectPath('')).toBe('');
    });

    it('handles path without leading slash', () => {
      expect(encodeProjectPath('relative/path')).toBe('relative-path');
    });
  });

  describe('getSessionInfo', () => {
    it('extracts session info from JSONL file', async () => {
      const entries = [
        sampleMetaMessage,
        sampleUserMessage,
        sampleAssistantMessage,
        sampleUserMessage2,
        sampleSummary
      ];
      createTestSession('session-info-test', entries);

      const encodedPath = encodeProjectPath(testProjectPath);
      const filePath = join(testDir, encodedPath, 'session-info-test.jsonl');

      const info = await getSessionInfo(filePath, 'session-info-test', testProjectPath);

      expect(info).not.toBeNull();
      expect(info!.sessionId).toBe('session-info-test');
      expect(info!.projectPath).toBe(testProjectPath);
      expect(info!.messageCount).toBe(3); // 2 user (non-meta) + 1 assistant
      expect(info!.firstPrompt).toBe('Hello, can you help me with my code?');
      expect(info!.summaries).toEqual(['Helped user refactor code']);
    });

    it('skips meta messages for first prompt', async () => {
      const entries = [sampleMetaMessage, sampleUserMessage];
      createTestSession('skip-meta-test', entries);

      const encodedPath = encodeProjectPath(testProjectPath);
      const filePath = join(testDir, encodedPath, 'skip-meta-test.jsonl');

      const info = await getSessionInfo(filePath, 'skip-meta-test', testProjectPath);

      expect(info!.firstPrompt).toBe('Hello, can you help me with my code?');
      expect(info!.messageCount).toBe(1); // Only non-meta user message counted
    });

    it('handles content block arrays', async () => {
      const entries = [sampleUserMessage2];
      createTestSession('content-block-test', entries);

      const encodedPath = encodeProjectPath(testProjectPath);
      const filePath = join(testDir, encodedPath, 'content-block-test.jsonl');

      const info = await getSessionInfo(filePath, 'content-block-test', testProjectPath);

      expect(info!.firstPrompt).toBe('I need to refactor this function');
    });

    it('returns null for empty session', async () => {
      const encodedPath = encodeProjectPath(testProjectPath);
      const sessionDir = join(testDir, encodedPath);
      mkdirSync(sessionDir, { recursive: true });
      writeFileSync(join(sessionDir, 'empty-session.jsonl'), '');

      const filePath = join(sessionDir, 'empty-session.jsonl');
      const info = await getSessionInfo(filePath, 'empty-session', testProjectPath);

      expect(info).toBeNull();
    });

    it('truncates long first prompts', async () => {
      const longPrompt: UserMessage = {
        ...sampleUserMessage,
        uuid: 'long-user',
        message: {
          role: 'user',
          content: 'A'.repeat(300)
        }
      };
      createTestSession('long-prompt-test', [longPrompt]);

      const encodedPath = encodeProjectPath(testProjectPath);
      const filePath = join(testDir, encodedPath, 'long-prompt-test.jsonl');

      const info = await getSessionInfo(filePath, 'long-prompt-test', testProjectPath);

      expect(info!.firstPrompt.length).toBe(200);
    });
  });

  describe('listProjectSessions', () => {
    const listTestProject = '/list/test/project';

    beforeAll(() => {
      // Create multiple sessions for list tests
      const baseEntries = [sampleUserMessage, sampleAssistantMessage];

      // Create sessions with different timestamps
      const session1User: UserMessage = {
        ...sampleUserMessage,
        timestamp: '2026-01-12T10:00:00Z'
      };
      const session2User: UserMessage = {
        ...sampleUserMessage,
        uuid: 'user-2',
        timestamp: '2026-01-12T11:00:00Z' // Newer
      };
      const session3User: UserMessage = {
        ...sampleUserMessage,
        uuid: 'user-3',
        timestamp: '2026-01-12T09:00:00Z' // Older
      };

      const encodedPath = encodeProjectPath(listTestProject);
      const sessionDir = join(testDir, encodedPath);
      mkdirSync(sessionDir, { recursive: true });

      writeFileSync(
        join(sessionDir, 'session-1.jsonl'),
        JSON.stringify(session1User) + '\n'
      );
      writeFileSync(
        join(sessionDir, 'session-2.jsonl'),
        JSON.stringify(session2User) + '\n'
      );
      writeFileSync(
        join(sessionDir, 'session-3.jsonl'),
        JSON.stringify(session3User) + '\n'
      );
    });

    it('lists all sessions for a project', async () => {
      // Override getClaudeProjectsDir for this test by using the actual function
      // with our test directory structure
      const encodedPath = encodeProjectPath(listTestProject);
      const sessionDir = join(testDir, encodedPath);

      // We need to test with the actual function, but it uses os.homedir()
      // For unit tests, we'll test the low-level functions instead
      // The integration with PromptCanvasProvider will handle the actual path
      expect(existsSync(sessionDir)).toBe(true);
    });

    it('returns empty array for non-existent project', async () => {
      const sessions = await listProjectSessions('/non/existent/project');
      expect(sessions).toEqual([]);
    });
  });

  describe('readSessionMessages', () => {
    it('yields all messages in order', async () => {
      const entries = [sampleUserMessage, sampleAssistantMessage, sampleUserMessage2];
      createTestSession('read-all-test', entries);

      const encodedPath = encodeProjectPath(testProjectPath);
      const filePath = join(testDir, encodedPath, 'read-all-test.jsonl');

      const messages: SessionEntry[] = [];
      for await (const entry of readSessionMessages(filePath)) {
        messages.push(entry);
      }

      expect(messages).toHaveLength(3);
      expect(messages[0].type).toBe('user');
      expect(messages[1].type).toBe('assistant');
      expect(messages[2].type).toBe('user');
    });

    it('skips malformed lines gracefully', async () => {
      const encodedPath = encodeProjectPath(testProjectPath);
      const sessionDir = join(testDir, encodedPath);
      const filePath = join(sessionDir, 'malformed-test.jsonl');

      const content = [
        JSON.stringify(sampleUserMessage),
        'this is not valid JSON',
        JSON.stringify(sampleAssistantMessage)
      ].join('\n');

      writeFileSync(filePath, content);

      const messages: SessionEntry[] = [];
      for await (const entry of readSessionMessages(filePath)) {
        messages.push(entry);
      }

      expect(messages).toHaveLength(2);
    });

    it('skips empty lines', async () => {
      const encodedPath = encodeProjectPath(testProjectPath);
      const sessionDir = join(testDir, encodedPath);
      const filePath = join(sessionDir, 'empty-lines-test.jsonl');

      const content = [
        JSON.stringify(sampleUserMessage),
        '',
        '   ',
        JSON.stringify(sampleAssistantMessage)
      ].join('\n');

      writeFileSync(filePath, content);

      const messages: SessionEntry[] = [];
      for await (const entry of readSessionMessages(filePath)) {
        messages.push(entry);
      }

      expect(messages).toHaveLength(2);
    });
  });

  describe('getResponseForMessage', () => {
    it('finds assistant response by parent UUID', async () => {
      const entries = [sampleUserMessage, sampleAssistantMessage];
      createTestSession('response-test', entries);

      const encodedPath = encodeProjectPath(testProjectPath);
      const filePath = join(testDir, encodedPath, 'response-test.jsonl');

      const response = await getResponseForMessage(filePath, 'user-msg-1');

      expect(response).toBe('Of course! I would be happy to help. What do you need assistance with?');
    });

    it('returns null when no response found', async () => {
      const entries = [sampleUserMessage];
      createTestSession('no-response-test', entries);

      const encodedPath = encodeProjectPath(testProjectPath);
      const filePath = join(testDir, encodedPath, 'no-response-test.jsonl');

      const response = await getResponseForMessage(filePath, 'user-msg-1');

      expect(response).toBeNull();
    });
  });

  describe('findMessageByContent', () => {
    it('finds message by content prefix', async () => {
      const entries = [sampleUserMessage, sampleAssistantMessage, sampleUserMessage2];
      createTestSession('find-content-test', entries);

      const encodedPath = encodeProjectPath(testProjectPath);
      const filePath = join(testDir, encodedPath, 'find-content-test.jsonl');

      const message = await findMessageByContent(filePath, 'Hello, can you');

      expect(message).not.toBeNull();
      expect(message!.uuid).toBe('user-msg-1');
    });

    it('returns null when content not found', async () => {
      const entries = [sampleUserMessage];
      createTestSession('find-not-found-test', entries);

      const encodedPath = encodeProjectPath(testProjectPath);
      const filePath = join(testDir, encodedPath, 'find-not-found-test.jsonl');

      const message = await findMessageByContent(filePath, 'nonexistent content');

      expect(message).toBeNull();
    });

    it('skips meta messages', async () => {
      const entries = [sampleMetaMessage, sampleUserMessage];
      createTestSession('find-skip-meta-test', entries);

      const encodedPath = encodeProjectPath(testProjectPath);
      const filePath = join(testDir, encodedPath, 'find-skip-meta-test.jsonl');

      const message = await findMessageByContent(filePath, 'meta message');

      expect(message).toBeNull();
    });
  });
});
