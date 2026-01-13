export type PromptStatus = 'queue' | 'active' | 'done' | 'trash';

// Legacy v1.0 format (deprecated, kept for backwards compatibility)
export interface GroupMetadata {
  name?: string;
  collapsed: boolean;
}

// New v1.1 format: PromptSet as first-class entity
export interface PromptSet {
  id: string;
  name?: string;
  active: boolean; // Only one set can be active at a time
  collapsed: boolean;
  created: string;
  folderLink?: string; // Links to investigation folder (e.g., scratch/YYYY-MM-DD-name/)
}

// v2.0 format: Session as H2-level grouping within a set
export interface Session {
  id: string;
  name?: string; // H2 heading text (optional)
  setId: string; // Parent set
  collapsed?: boolean; // Optional collapse state
}

export interface FileMetadata {
  version: string;
  groups: Record<string, GroupMetadata>; // v1.0 legacy, deprecated
}

export interface PromptMetadata {
  id: string;
  name?: string; // v2.0: H3 heading text (optional)
  setId?: string; // v1.1+: Required - every prompt belongs to a set
  sessionId?: string; // v2.0: Optional - prompt may belong to a session (H2)
  group?: string; // v1.0 legacy, deprecated
  status: PromptStatus;
  created: string;
  updated?: string;
  folderLink?: string;

  // Claude Code integration fields
  claudeSessionId?: string; // UUID linking to Claude Code session
  claudeMessageId?: string; // UUID of specific message in session
  executedAt?: string; // ISO timestamp when sent to Claude
  responsePreview?: string; // First ~200 chars of response (cached)
}

export interface Prompt {
  id: string;
  content: string;
  metadata: PromptMetadata;
}

export interface PromptDocument {
  fileMetadata: FileMetadata;
  sets: PromptSet[]; // v1.1+: Ordered list of sets
  sessions: Session[]; // v2.0: Ordered list of sessions (H2 groupings)
  prompts: Prompt[]; // Prompts reference their set via metadata.setId
  trailingNewline: boolean;
}

// Claude session info (simplified for webview)
export interface ClaudeSessionSummary {
  sessionId: string;
  projectPath: string;
  startTime: string; // ISO string
  lastTime: string;
  messageCount: number;
  firstPrompt: string;
  summaries: string[];
}

// Message types for extension <-> webview communication
export type ExtensionMessage =
  | { type: 'documentLoaded'; document: PromptDocument }
  | { type: 'documentUpdated'; document: PromptDocument }
  // Claude session messages
  | { type: 'sessionsUpdated'; sessions: ClaudeSessionSummary[] }
  | { type: 'responseLoaded'; promptId: string; response: string };

export type WebviewMessage =
  | { type: 'contentChanged'; document: PromptDocument }
  | { type: 'copyToClipboard'; text: string }
  | { type: 'openFolder'; path: string }
  | { type: 'ready' }
  // Claude session messages
  | { type: 'linkSession'; promptId: string; sessionId: string }
  | { type: 'unlinkSession'; promptId: string }
  | { type: 'getResponse'; sessionId: string; messageId?: string };
