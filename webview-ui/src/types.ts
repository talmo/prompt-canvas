export type PromptStatus = 'queue' | 'active' | 'done' | 'trash';

export interface GroupMetadata {
  name?: string;
  collapsed: boolean;
}

export interface FileMetadata {
  version: string;
  groups: Record<string, GroupMetadata>;
}

export interface PromptMetadata {
  id: string;
  group?: string;
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
  prompts: Prompt[];
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
