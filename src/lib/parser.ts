import { nanoid } from 'nanoid';
import type { PromptDocument, Prompt, FileMetadata, PromptMetadata, PromptSet } from './types';

const FILE_META_REGEX = /^<!--\s*prompt-canvas:\s*(\{.*?\})\s*-->/;
const SET_META_REGEX = /^<!--\s*set:\s*(\{.*?\})\s*-->\n?/;
const PROMPT_META_REGEX = /^<!--\s*prompt:\s*(\{.*?\})\s*-->\n?/;
const SEPARATOR_REGEX = /\n---+\n/;

// Detect investigation folder patterns in prompt content
const FOLDER_LINK_REGEX = /scratch\/\d{4}-\d{2}-\d{2}-[\w-]+\/?/;

export function parse(text: string): PromptDocument {
  let fileMetadata: FileMetadata = { version: '1.0', groups: {} };
  let content = text;
  const sets: PromptSet[] = [];
  const prompts: Prompt[] = [];

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
      fileMetadata: { ...fileMetadata, version: '1.1' },
      sets: [],
      prompts: [],
      trailingNewline: text.endsWith('\n'),
    };
  }

  // Check if this is v1.1 format (has set metadata)
  const isV11Format = content.includes('<!-- set:');

  if (isV11Format) {
    // Parse v1.1 format with explicit sets
    parseV11Format(content, sets, prompts);
  } else {
    // Parse v1.0 or legacy format - migrate to sets
    parseV10Format(content, sets, prompts, fileMetadata);
  }

  return {
    fileMetadata: { ...fileMetadata, version: '1.1' },
    sets,
    prompts,
    trailingNewline: text.endsWith('\n'),
  };
}

function parseV11Format(content: string, sets: PromptSet[], prompts: Prompt[]): void {
  // Split content by set boundaries (look for <!-- set: --> comments)
  const lines = content.split('\n');
  let currentSetJson: string | null = null;
  let currentPromptJson: string | null = null;
  let currentPromptContent: string[] = [];
  let inPrompt = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmedLine = line.trim();

    // Check for set metadata
    const setMatch = trimmedLine.match(/^<!--\s*set:\s*(\{.*?\})\s*-->$/);
    if (setMatch) {
      // Save any pending prompt
      if (inPrompt && currentPromptJson) {
        savePrompt(currentPromptJson, currentPromptContent, prompts);
        currentPromptContent = [];
        currentPromptJson = null;
        inPrompt = false;
      }

      // Parse and save the set
      try {
        const setData = JSON.parse(setMatch[1]) as PromptSet;
        // Ensure required fields
        if (!setData.created) {
          setData.created = new Date().toISOString();
        }
        if (setData.active === undefined) {
          setData.active = false;
        }
        if (setData.collapsed === undefined) {
          setData.collapsed = false;
        }
        sets.push(setData);
        currentSetJson = setMatch[1];
      } catch {
        // Skip invalid set
      }
      continue;
    }

    // Check for prompt metadata
    const promptMatch = trimmedLine.match(/^<!--\s*prompt:\s*(\{.*?\})\s*-->$/);
    if (promptMatch) {
      // Save any pending prompt
      if (inPrompt && currentPromptJson) {
        savePrompt(currentPromptJson, currentPromptContent, prompts);
        currentPromptContent = [];
      }
      currentPromptJson = promptMatch[1];
      inPrompt = true;
      continue;
    }

    // Skip cosmetic separators (---) between prompts
    if (trimmedLine.match(/^-{3,}$/)) {
      continue;
    }

    // Accumulate content for current prompt
    if (inPrompt) {
      currentPromptContent.push(line);
    }
  }

  // Save last prompt
  if (inPrompt && currentPromptJson) {
    savePrompt(currentPromptJson, currentPromptContent, prompts);
  }

  // Ensure at least one active set exists
  if (sets.length > 0 && !sets.some(s => s.active)) {
    sets[0].active = true;
  }
}

function savePrompt(jsonStr: string, contentLines: string[], prompts: Prompt[]): void {
  try {
    const metadata = JSON.parse(jsonStr) as PromptMetadata;
    // Ensure ID exists
    if (!metadata.id) {
      metadata.id = nanoid();
    }
    // Trim trailing empty lines from content
    while (contentLines.length > 0 && contentLines[contentLines.length - 1].trim() === '') {
      contentLines.pop();
    }
    // Trim leading empty lines
    while (contentLines.length > 0 && contentLines[0].trim() === '') {
      contentLines.shift();
    }

    prompts.push({
      id: metadata.id,
      content: contentLines.join('\n'),
      metadata,
    });
  } catch {
    // Skip invalid prompt
  }
}

function parseV10Format(
  content: string,
  sets: PromptSet[],
  prompts: Prompt[],
  fileMetadata: FileMetadata
): void {
  // In v1.0 format, prompts are separated by ---
  // We need to create a default set for all prompts

  const defaultSetId = nanoid();
  const now = new Date().toISOString();

  // Create default set
  sets.push({
    id: defaultSetId,
    active: true,
    collapsed: false,
    created: now,
  });

  // Split by separator
  const segments = content.split(SEPARATOR_REGEX);

  for (const segment of segments) {
    const trimmed = segment.trim();
    if (!trimmed) continue;

    const metaMatch = trimmed.match(PROMPT_META_REGEX);
    let metadata: PromptMetadata;
    let promptContent: string;

    if (metaMatch) {
      try {
        metadata = JSON.parse(metaMatch[1]);
        promptContent = trimmed.slice(metaMatch[0].length);
      } catch {
        // If JSON parse fails, treat whole segment as content
        metadata = {
          id: nanoid(),
          status: 'queue',
          created: now,
        };
        promptContent = trimmed;
      }
    } else {
      // No metadata - create default
      metadata = {
        id: nanoid(),
        status: 'queue',
        created: now,
      };
      promptContent = trimmed;
    }

    // Ensure ID exists
    if (!metadata.id) {
      metadata.id = nanoid();
    }

    // Migrate group to setId
    if (metadata.group) {
      // Check if we have a set for this group
      let groupSet = sets.find(s => s.name === metadata.group);
      if (!groupSet) {
        // Create a new set for this group
        const groupSetId = nanoid();
        groupSet = {
          id: groupSetId,
          name: metadata.group,
          active: false,
          collapsed: fileMetadata.groups[metadata.group]?.collapsed ?? false,
          created: now,
        };
        sets.push(groupSet);
      }
      metadata.setId = groupSet.id;
      // Keep group for backwards compatibility during transition
    } else {
      // Assign to default set
      metadata.setId = defaultSetId;
    }

    prompts.push({
      id: metadata.id,
      content: promptContent,
      metadata,
    });
  }

  // If all prompts were in groups, mark the first set as active
  if (sets.length > 0 && !sets.some(s => s.active)) {
    sets[0].active = true;
  }
}

export function serialize(doc: PromptDocument): string {
  const parts: string[] = [];

  // File metadata (upgrade to v1.1)
  const fileMeta: FileMetadata = {
    ...doc.fileMetadata,
    version: '1.1',
  };
  parts.push(`<!-- prompt-canvas: ${JSON.stringify(fileMeta)} -->\n`);

  // Group prompts by setId
  const promptsBySet = new Map<string, Prompt[]>();
  const orphanPrompts: Prompt[] = [];

  for (const prompt of doc.prompts) {
    const setId = prompt.metadata.setId;
    if (setId) {
      if (!promptsBySet.has(setId)) {
        promptsBySet.set(setId, []);
      }
      promptsBySet.get(setId)!.push(prompt);
    } else {
      orphanPrompts.push(prompt);
    }
  }

  // If there are orphan prompts, create a default set for them
  let setsToWrite = [...doc.sets];
  if (orphanPrompts.length > 0) {
    const defaultSetId = nanoid();
    const defaultSet: PromptSet = {
      id: defaultSetId,
      active: setsToWrite.length === 0,
      collapsed: false,
      created: new Date().toISOString(),
    };
    setsToWrite.push(defaultSet);
    for (const prompt of orphanPrompts) {
      prompt.metadata.setId = defaultSetId;
      if (!promptsBySet.has(defaultSetId)) {
        promptsBySet.set(defaultSetId, []);
      }
      promptsBySet.get(defaultSetId)!.push(prompt);
    }
  }

  // Serialize each set with its prompts
  const setOutputs: string[] = [];

  for (const set of setsToWrite) {
    const setPrompts = promptsBySet.get(set.id) || [];
    if (setPrompts.length === 0) continue; // Skip empty sets

    const setOutput: string[] = [];

    // Set metadata comment
    const setMeta = {
      id: set.id,
      ...(set.name && { name: set.name }),
      active: set.active,
      ...(set.collapsed && { collapsed: set.collapsed }),
      ...(set.folderLink && { folderLink: set.folderLink }),
    };
    setOutput.push(`<!-- set: ${JSON.stringify(setMeta)} -->`);

    // Prompts within set
    const promptOutputs: string[] = [];
    for (const prompt of setPrompts) {
      // Clean up metadata for serialization (remove deprecated fields)
      const cleanMeta = { ...prompt.metadata };
      delete cleanMeta.group; // Remove deprecated v1.0 field

      const metaComment = `<!-- prompt: ${JSON.stringify(cleanMeta)} -->`;
      promptOutputs.push(`${metaComment}\n${prompt.content}`);
    }

    setOutput.push(promptOutputs.join('\n\n---\n\n'));
    setOutputs.push(setOutput.join('\n'));
  }

  // Join sets with blank lines
  parts.push(setOutputs.join('\n\n\n'));

  let result = parts.join('\n');

  // Ensure trailing newline if original had one (or if we have content)
  if (doc.trailingNewline || doc.prompts.length > 0) {
    if (!result.endsWith('\n')) {
      result += '\n';
    }
  }

  return result;
}

// Helper to auto-detect folder links from prompt content
export function detectFolderLink(content: string): string | undefined {
  const match = content.match(FOLDER_LINK_REGEX);
  return match ? match[0] : undefined;
}
