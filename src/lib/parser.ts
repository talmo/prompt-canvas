import { nanoid } from 'nanoid';
import type { PromptDocument, Prompt, FileMetadata, PromptMetadata, PromptSet, Session } from './types';

const FILE_META_REGEX = /^<!--\s*prompt-canvas:\s*(\{.*?\})\s*-->/;
const SET_META_REGEX = /^<!--\s*set:\s*(\{.*?\})\s*-->\n?/;
const PROMPT_META_REGEX = /^<!--\s*prompt:\s*(\{.*?\})\s*-->\n?/;
const SEPARATOR_REGEX = /\n---+\n/;

// v2.0 format regexes
const METADATA_REGEX = /^<!--\s*(\{.*?\})\s*-->$/;
const H1_REGEX = /^#\s+(.*)$/;
const H2_REGEX = /^##\s+(.*)$/;
const H3_REGEX = /^###\s+(.*)$/;
const EMPTY_H1_REGEX = /^#\s*$/;
const EMPTY_H2_REGEX = /^##\s*$/;
const EMPTY_H3_REGEX = /^###\s*$/;

/**
 * Auto-promote H1/H2/H3 in content to H4/H5/H6
 * This prevents content headings from being confused with structural headings.
 * Order matters: process ### first to avoid double-promoting
 */
function promoteContentHeadings(content: string): string {
  return content
    .replace(/^### /gm, '###### ')  // ### → ######
    .replace(/^## /gm, '##### ')    // ## → #####
    .replace(/^# /gm, '#### ');     // # → ####
}

/**
 * Demote H4/H5/H6 in content back to H1/H2/H3 for display
 * This restores the original heading levels when reading.
 */
function demoteContentHeadings(content: string): string {
  return content
    .replace(/^###### /gm, '### ')
    .replace(/^##### /gm, '## ')
    .replace(/^#### /gm, '# ');
}

// Detect investigation folder patterns in prompt content
const FOLDER_LINK_REGEX = /scratch\/\d{4}-\d{2}-\d{2}-[\w-]+\/?/;

export function parse(text: string): PromptDocument {
  let fileMetadata: FileMetadata = { version: '1.0', groups: {} };
  let content = text;
  const sets: PromptSet[] = [];
  const sessions: Session[] = [];
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
      fileMetadata: { ...fileMetadata, version: '2.0' },
      sets: [],
      sessions: [],
      prompts: [],
      trailingNewline: text.endsWith('\n'),
    };
  }

  // Detect format version:
  // v2.0: Uses markdown headings (# for set, ## for session, ### for prompt)
  // v1.1: Uses <!-- set: --> and <!-- prompt: --> comments
  // v1.0: Uses <!-- prompt: --> comments only (or no metadata)
  const isV20Format = detectV20Format(content);
  const isV11Format = content.includes('<!-- set:');

  if (isV20Format) {
    // Parse v2.0 format with heading structure
    parseV20Format(content, sets, sessions, prompts);
  } else if (isV11Format) {
    // Parse v1.1 format with explicit sets
    parseV11Format(content, sets, prompts);
  } else {
    // Parse v1.0 or legacy format - migrate to sets
    parseV10Format(content, sets, prompts, fileMetadata);
  }

  return {
    fileMetadata: { ...fileMetadata, version: '2.0' },
    sets,
    sessions,
    prompts,
    trailingNewline: text.endsWith('\n'),
  };
}

/**
 * Detect if content is v2.0 format (heading-based structure)
 * v2.0 is detected by having H1/H2/H3 headings followed by JSON metadata comments
 */
function detectV20Format(content: string): boolean {
  const lines = content.split('\n');
  for (let i = 0; i < lines.length - 1; i++) {
    const line = lines[i];
    const nextLine = lines[i + 1];
    // Check for heading followed by metadata comment
    if ((line.match(H1_REGEX) || line.match(H2_REGEX) || line.match(H3_REGEX) ||
         line.match(EMPTY_H1_REGEX) || line.match(EMPTY_H2_REGEX) || line.match(EMPTY_H3_REGEX)) &&
        nextLine.match(METADATA_REGEX)) {
      return true;
    }
  }
  return false;
}

/**
 * Parse v2.0 format with heading-based structure:
 * - H1 (#) = PromptSet
 * - H2 (##) = Session (optional grouping)
 * - H3 (###) = Prompt
 */
function parseV20Format(
  content: string,
  sets: PromptSet[],
  sessions: Session[],
  prompts: Prompt[]
): void {
  const lines = content.split('\n');
  const now = new Date().toISOString();

  let currentSetId: string | null = null;
  let currentSessionId: string | null = null;
  let currentPrompt: Partial<Prompt> | null = null;
  let currentPromptContent: string[] = [];
  let lineIndex = 0;

  function saveCurrentPrompt(): void {
    if (currentPrompt && currentPrompt.id) {
      // Trim trailing empty lines
      while (currentPromptContent.length > 0 && currentPromptContent[currentPromptContent.length - 1].trim() === '') {
        currentPromptContent.pop();
      }
      // Trim leading empty lines
      while (currentPromptContent.length > 0 && currentPromptContent[0].trim() === '') {
        currentPromptContent.shift();
      }

      // Demote H4/H5/H6 back to H1/H2/H3 for internal representation
      const rawContent = currentPromptContent.join('\n');
      currentPrompt.content = demoteContentHeadings(rawContent);

      prompts.push(currentPrompt as Prompt);
      currentPrompt = null;
      currentPromptContent = [];
    }
  }

  function ensureSet(): string {
    if (!currentSetId) {
      const setId = nanoid();
      sets.push({
        id: setId,
        active: true,
        collapsed: false,
        created: now,
      });
      currentSetId = setId;
    }
    return currentSetId;
  }

  for (; lineIndex < lines.length; lineIndex++) {
    const line = lines[lineIndex];
    const trimmed = line.trim();

    // Check for H1 (Set) - must check before H2 and H3
    const h1Match = line.match(H1_REGEX) || line.match(EMPTY_H1_REGEX);
    if (h1Match) {
      saveCurrentPrompt();

      const setId = nanoid();
      const name = h1Match[1]?.trim() || undefined;

      // Check next line for metadata
      let metadata: Record<string, unknown> = {};
      if (lineIndex + 1 < lines.length) {
        const metaMatch = lines[lineIndex + 1].match(METADATA_REGEX);
        if (metaMatch) {
          try {
            metadata = JSON.parse(metaMatch[1]);
            lineIndex++; // Skip metadata line
          } catch {
            // Ignore parse errors
          }
        }
      }

      sets.push({
        id: (metadata.id as string) || setId,
        name,
        active: (metadata.active as boolean) ?? sets.length === 0,
        collapsed: (metadata.collapsed as boolean) ?? false,
        created: (metadata.created as string) || now,
        folderLink: metadata.folderLink as string | undefined,
      });

      currentSetId = (metadata.id as string) || setId;
      currentSessionId = null;
      continue;
    }

    // Check for H2 (Session)
    const h2Match = line.match(H2_REGEX) || line.match(EMPTY_H2_REGEX);
    if (h2Match) {
      saveCurrentPrompt();

      const sessionId = nanoid();
      const name = h2Match[1]?.trim() || undefined;
      const setId = ensureSet();

      // Check next line for metadata
      let metadata: Record<string, unknown> = {};
      if (lineIndex + 1 < lines.length) {
        const metaMatch = lines[lineIndex + 1].match(METADATA_REGEX);
        if (metaMatch) {
          try {
            metadata = JSON.parse(metaMatch[1]);
            lineIndex++; // Skip metadata line
          } catch {
            // Ignore parse errors
          }
        }
      }

      sessions.push({
        id: (metadata.id as string) || sessionId,
        name,
        setId,
        collapsed: metadata.collapsed as boolean | undefined,
      });

      currentSessionId = (metadata.id as string) || sessionId;
      continue;
    }

    // Check for H3 (Prompt)
    const h3Match = line.match(H3_REGEX) || line.match(EMPTY_H3_REGEX);
    if (h3Match) {
      saveCurrentPrompt();

      const promptId = nanoid();
      const name = h3Match[1]?.trim() || undefined;
      const setId = ensureSet();

      // Check next line for metadata
      let metadata: Record<string, unknown> = {};
      if (lineIndex + 1 < lines.length) {
        const metaMatch = lines[lineIndex + 1].match(METADATA_REGEX);
        if (metaMatch) {
          try {
            metadata = JSON.parse(metaMatch[1]);
            lineIndex++; // Skip metadata line
          } catch {
            // Ignore parse errors
          }
        }
      }

      currentPrompt = {
        id: (metadata.id as string) || promptId,
        content: '',
        metadata: {
          id: (metadata.id as string) || promptId,
          name,
          setId,
          sessionId: currentSessionId || undefined,
          status: (metadata.status as PromptMetadata['status']) || 'queue',
          created: (metadata.created as string) || now,
          updated: metadata.updated as string | undefined,
          folderLink: metadata.folderLink as string | undefined,
          // Claude Code integration fields
          claudeSessionId: metadata.claudeSessionId as string | undefined,
          claudeMessageId: metadata.claudeMessageId as string | undefined,
          executedAt: metadata.executedAt as string | undefined,
          responsePreview: metadata.responsePreview as string | undefined,
        },
      };
      currentPromptContent = [];
      continue;
    }

    // Skip cosmetic separators between prompts
    if (trimmed.match(/^-{3,}$/)) {
      continue;
    }

    // Accumulate content if in a prompt
    if (currentPrompt) {
      currentPromptContent.push(line);
    }
  }

  // Save final prompt
  saveCurrentPrompt();

  // Ensure at least one set is active
  if (sets.length > 0 && !sets.some(s => s.active)) {
    sets[0].active = true;
  }
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

  // File metadata (always v2.0)
  parts.push(`<!-- prompt-canvas: {"version":"2.0"} -->\n`);

  // Group prompts by setId, then by sessionId
  const promptsBySetAndSession = new Map<string, Map<string | null, Prompt[]>>();
  const orphanPrompts: Prompt[] = [];

  for (const prompt of doc.prompts) {
    const setId = prompt.metadata.setId;
    if (setId) {
      if (!promptsBySetAndSession.has(setId)) {
        promptsBySetAndSession.set(setId, new Map());
      }
      const setMap = promptsBySetAndSession.get(setId)!;
      const sessionKey = prompt.metadata.sessionId || null;
      if (!setMap.has(sessionKey)) {
        setMap.set(sessionKey, []);
      }
      setMap.get(sessionKey)!.push(prompt);
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
      if (!promptsBySetAndSession.has(defaultSetId)) {
        promptsBySetAndSession.set(defaultSetId, new Map());
      }
      const setMap = promptsBySetAndSession.get(defaultSetId)!;
      if (!setMap.has(null)) {
        setMap.set(null, []);
      }
      setMap.get(null)!.push(prompt);
    }
  }

  // Sessions indexed by ID
  const sessions = doc.sessions || [];
  const sessionsById = new Map(sessions.map(s => [s.id, s]));

  // Serialize each set with its prompts using v2.0 heading format
  const setOutputs: string[] = [];

  for (const set of setsToWrite) {
    const setMap = promptsBySetAndSession.get(set.id);
    if (!setMap || setMap.size === 0) continue; // Skip empty sets

    const setOutput: string[] = [];

    // Set heading (H1)
    const setName = set.name || '';
    setOutput.push(`# ${setName}`);

    // Set metadata
    const setMeta: Record<string, unknown> = {
      id: set.id,
      active: set.active,
    };
    if (set.collapsed) setMeta.collapsed = true;
    if (set.folderLink) setMeta.folderLink = set.folderLink;
    if (set.created) setMeta.created = set.created;
    setOutput.push(`<!-- ${JSON.stringify(setMeta)} -->\n`);

    // Get all session IDs for this set (in order), plus null for no-session prompts
    const sessionIds: (string | null)[] = [];
    if (setMap.has(null)) sessionIds.push(null);
    for (const session of sessions) {
      if (session.setId === set.id && setMap.has(session.id)) {
        sessionIds.push(session.id);
      }
    }

    for (const sessionId of sessionIds) {
      const sessionPrompts = setMap.get(sessionId) || [];
      if (sessionPrompts.length === 0) continue;

      if (sessionId) {
        const session = sessionsById.get(sessionId);
        if (session) {
          const sessionName = session.name || '';
          setOutput.push(`## ${sessionName}`);

          // Session metadata
          const sessionMeta: Record<string, unknown> = { id: session.id };
          if (session.collapsed) sessionMeta.collapsed = true;
          setOutput.push(`<!-- ${JSON.stringify(sessionMeta)} -->\n`);
        }
      }

      // Prompts within session
      const promptParts: string[] = [];
      for (const prompt of sessionPrompts) {
        const promptName = prompt.metadata.name || '';
        let promptStr = `### ${promptName}`;

        // Prompt metadata
        const promptMeta: Record<string, unknown> = {
          id: prompt.id,
          status: prompt.metadata.status,
        };
        if (prompt.metadata.created) promptMeta.created = prompt.metadata.created;
        if (prompt.metadata.updated) promptMeta.updated = prompt.metadata.updated;
        if (prompt.metadata.folderLink) promptMeta.folderLink = prompt.metadata.folderLink;
        // Claude Code integration fields
        if (prompt.metadata.claudeSessionId) promptMeta.claudeSessionId = prompt.metadata.claudeSessionId;
        if (prompt.metadata.claudeMessageId) promptMeta.claudeMessageId = prompt.metadata.claudeMessageId;
        if (prompt.metadata.executedAt) promptMeta.executedAt = prompt.metadata.executedAt;
        if (prompt.metadata.responsePreview) promptMeta.responsePreview = prompt.metadata.responsePreview;
        promptStr += `\n<!-- ${JSON.stringify(promptMeta)} -->`;

        if (prompt.content) {
          // Auto-promote H1/H2/H3 in content to H4/H5/H6
          const promotedContent = promoteContentHeadings(prompt.content);
          promptStr += `\n${promotedContent}`;
        }

        promptParts.push(promptStr);
      }

      setOutput.push(promptParts.join('\n\n'));
    }

    setOutputs.push(setOutput.join('\n'));
  }

  // Join sets with blank lines
  parts.push(setOutputs.join('\n\n'));

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
