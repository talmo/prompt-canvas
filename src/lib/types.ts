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

export interface FileMetadata {
  version: string;
  groups: Record<string, GroupMetadata>; // v1.0 legacy, deprecated
}

export interface PromptMetadata {
  id: string;
  setId?: string; // v1.1: Required - every prompt belongs to a set
  group?: string; // v1.0 legacy, deprecated
  status: PromptStatus;
  created: string;
  updated?: string;
  folderLink?: string;
}

export interface Prompt {
  id: string;
  content: string;
  metadata: PromptMetadata;
}

export interface PromptDocument {
  fileMetadata: FileMetadata;
  sets: PromptSet[]; // v1.1: Ordered list of sets
  prompts: Prompt[]; // Prompts reference their set via metadata.setId
  trailingNewline: boolean;
}

// Message types for extension <-> webview communication
export type ExtensionMessage =
  | { type: 'documentLoaded'; document: PromptDocument }
  | { type: 'documentUpdated'; document: PromptDocument };

export type WebviewMessage =
  | { type: 'contentChanged'; document: PromptDocument }
  | { type: 'copyToClipboard'; text: string }
  | { type: 'openFolder'; path: string }
  | { type: 'ready' };
