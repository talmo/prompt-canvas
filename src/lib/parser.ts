import { nanoid } from 'nanoid';
import type { PromptDocument, Prompt, FileMetadata, PromptMetadata } from './types';

const FILE_META_REGEX = /^<!--\s*prompt-canvas:\s*(\{.*?\})\s*-->/;
const PROMPT_META_REGEX = /^<!--\s*prompt:\s*(\{.*?\})\s*-->\n?/;
const SEPARATOR_REGEX = /\n---+\n/;

export function parse(text: string): PromptDocument {
  let fileMetadata: FileMetadata = { version: '1.0', groups: {} };
  let content = text;

  // Extract file-level metadata
  const fileMetaMatch = content.match(FILE_META_REGEX);
  if (fileMetaMatch) {
    try {
      fileMetadata = JSON.parse(fileMetaMatch[1]);
    } catch {
      // Keep default if parse fails
    }
    content = content.slice(fileMetaMatch[0].length).replace(/^\n+/, '');
  }

  // Handle empty content
  if (!content.trim()) {
    return {
      fileMetadata,
      prompts: [],
      trailingNewline: text.endsWith('\n'),
    };
  }

  // Split by separator
  const segments = content.split(SEPARATOR_REGEX);

  const prompts: Prompt[] = segments
    .map(segment => segment.trim())
    .filter(segment => segment.length > 0)
    .map(segment => {
      const metaMatch = segment.match(PROMPT_META_REGEX);
      let metadata: PromptMetadata;
      let promptContent: string;

      if (metaMatch) {
        try {
          metadata = JSON.parse(metaMatch[1]);
          promptContent = segment.slice(metaMatch[0].length);
        } catch {
          // If JSON parse fails, treat whole segment as content
          metadata = {
            id: nanoid(),
            status: 'queue',
            created: new Date().toISOString(),
          };
          promptContent = segment;
        }
      } else {
        // No metadata - create default
        metadata = {
          id: nanoid(),
          status: 'queue',
          created: new Date().toISOString(),
        };
        promptContent = segment;
      }

      // Ensure ID exists
      if (!metadata.id) {
        metadata.id = nanoid();
      }

      return {
        id: metadata.id,
        content: promptContent,
        metadata,
      };
    });

  return {
    fileMetadata,
    prompts,
    trailingNewline: text.endsWith('\n'),
  };
}

export function serialize(doc: PromptDocument): string {
  const parts: string[] = [];

  // File metadata
  parts.push(`<!-- prompt-canvas: ${JSON.stringify(doc.fileMetadata)} -->\n`);

  // Prompts
  if (doc.prompts.length > 0) {
    const promptTexts = doc.prompts.map(prompt => {
      const metaComment = `<!-- prompt: ${JSON.stringify(prompt.metadata)} -->`;
      return `${metaComment}\n${prompt.content}`;
    });

    parts.push(promptTexts.join('\n\n---\n\n'));
  }

  let result = parts.join('\n');

  // Ensure trailing newline if original had one (or if we have content)
  if (doc.trailingNewline || doc.prompts.length > 0) {
    if (!result.endsWith('\n')) {
      result += '\n';
    }
  }

  return result;
}
