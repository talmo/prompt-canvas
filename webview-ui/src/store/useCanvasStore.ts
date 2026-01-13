import { create } from 'zustand';
import type { PromptDocument, Prompt, PromptStatus, FileMetadata, PromptSet, ClaudeSessionSummary } from '../types';
import { vscode } from '../vscode';

function generateId(): string {
  return Math.random().toString(36).substring(2, 15);
}

interface HistoryEntry {
  document: PromptDocument;
}

interface CanvasStore {
  document: PromptDocument | null;
  focusedId: string | null;
  undoStack: HistoryEntry[];
  redoStack: HistoryEntry[];
  isExternalUpdate: boolean;

  // Claude Code sessions
  claudeSessions: ClaudeSessionSummary[];
  sessionBrowserOpen: boolean;
  selectedSessionId: string | null;

  // Actions
  setDocument: (doc: PromptDocument, isExternal?: boolean) => void;
  setFocusedId: (id: string | null) => void;
  updatePromptContent: (id: string, content: string) => void;
  setPromptStatus: (id: string, status: PromptStatus) => void;
  createPrompt: (afterId?: string, setId?: string) => string;
  deletePrompt: (id: string) => void;
  reorderPrompts: (orderedIds: string[]) => void;

  // Set operations (v1.1)
  createSet: (afterSetId?: string) => string;
  deleteSet: (setId: string) => void;
  setActiveSet: (setId: string) => void;
  toggleSetCollapse: (setId: string) => void;
  renameSet: (setId: string, name: string) => void;
  movePromptToSet: (promptId: string, setId: string) => void;
  getActiveSetId: () => string | null;

  // Session operations (v2.0 H2 level)
  createSession: (setId: string, afterSessionId?: string) => string;
  renameSession: (sessionId: string, name: string) => void;
  toggleSessionCollapse: (sessionId: string) => void;

  // Legacy group operations (deprecated, kept for backwards compatibility)
  toggleGroupCollapse: (groupId: string) => void;
  setPromptGroup: (promptId: string, groupId: string | undefined) => void;
  createGroup: (name?: string) => string;
  renameGroup: (groupId: string, name: string) => void;

  // History
  undo: () => void;
  redo: () => void;

  // Claude Code session actions
  setClaudeSessions: (sessions: ClaudeSessionSummary[]) => void;
  setSessionBrowserOpen: (open: boolean) => void;
  setSelectedSessionId: (id: string | null) => void;
  linkPromptToSession: (promptId: string, sessionId: string) => void;
  unlinkPromptFromSession: (promptId: string) => void;
}

export const useCanvasStore = create<CanvasStore>((set, get) => ({
  document: null,
  focusedId: null,
  undoStack: [],
  redoStack: [],
  isExternalUpdate: false,

  // Claude Code sessions
  claudeSessions: [],
  sessionBrowserOpen: false,
  selectedSessionId: null,

  setDocument: (doc, isExternal = false) => {
    // Ensure document has sets and sessions arrays (backwards compatibility)
    const normalizedDoc = {
      ...doc,
      sets: doc.sets || [],
      sessions: doc.sessions || [],
    };
    set({ document: normalizedDoc, isExternalUpdate: isExternal });
  },

  setFocusedId: (id) => set({ focusedId: id }),

  updatePromptContent: (id, content) => {
    const { document } = get();
    if (!document) return;

    // Save to undo stack
    const prevDoc = document;

    const newPrompts = document.prompts.map((p) =>
      p.id === id
        ? {
            ...p,
            content,
            metadata: { ...p.metadata, updated: new Date().toISOString() },
          }
        : p
    );

    const newDoc: PromptDocument = { ...document, prompts: newPrompts };

    set((state) => ({
      document: newDoc,
      undoStack: [...state.undoStack, { document: prevDoc }],
      redoStack: [],
    }));

    // Sync to extension
    vscode.postMessage({ type: 'contentChanged', document: newDoc });
  },

  setPromptStatus: (id, status) => {
    const { document } = get();
    if (!document) return;

    const prevDoc = document;

    const newPrompts = document.prompts.map((p) =>
      p.id === id ? { ...p, metadata: { ...p.metadata, status } } : p
    );

    const newDoc: PromptDocument = { ...document, prompts: newPrompts };

    set((state) => ({
      document: newDoc,
      undoStack: [...state.undoStack, { document: prevDoc }],
      redoStack: [],
    }));

    vscode.postMessage({ type: 'contentChanged', document: newDoc });
  },

  createPrompt: (afterId, setId) => {
    const { document, getActiveSetId } = get();
    if (!document) return '';

    const prevDoc = document;
    const newId = generateId();
    const now = new Date().toISOString();

    // Determine which set to add the prompt to
    let targetSetId = setId;
    if (!targetSetId && afterId) {
      // Use the same set as the prompt we're inserting after
      const afterPrompt = document.prompts.find((p) => p.id === afterId);
      targetSetId = afterPrompt?.metadata.setId;
    }
    if (!targetSetId) {
      // Use the active set
      targetSetId = getActiveSetId() || undefined;
    }

    // If still no set, create a default one
    let newSets = [...document.sets];
    if (!targetSetId) {
      targetSetId = generateId();
      newSets.push({
        id: targetSetId,
        active: true,
        collapsed: false,
        created: now,
      });
    }

    const newPrompt: Prompt = {
      id: newId,
      content: '',
      metadata: {
        id: newId,
        setId: targetSetId,
        status: 'queue',
        created: now,
      },
    };

    let newPrompts: Prompt[];
    if (afterId) {
      const afterIndex = document.prompts.findIndex((p) => p.id === afterId);
      if (afterIndex >= 0) {
        newPrompts = [
          ...document.prompts.slice(0, afterIndex + 1),
          newPrompt,
          ...document.prompts.slice(afterIndex + 1),
        ];
      } else {
        newPrompts = [...document.prompts, newPrompt];
      }
    } else {
      newPrompts = [...document.prompts, newPrompt];
    }

    const newDoc: PromptDocument = { ...document, sets: newSets, prompts: newPrompts };

    set((state) => ({
      document: newDoc,
      focusedId: newId,
      undoStack: [...state.undoStack, { document: prevDoc }],
      redoStack: [],
    }));

    vscode.postMessage({ type: 'contentChanged', document: newDoc });
    return newId;
  },

  deletePrompt: (id) => {
    const { document } = get();
    if (!document) return;

    const prevDoc = document;
    const newPrompts = document.prompts.filter((p) => p.id !== id);

    // Check if any sets are now empty and remove them
    const usedSetIds = new Set(newPrompts.map((p) => p.metadata.setId).filter(Boolean));
    const newSets = document.sets.filter((s) => usedSetIds.has(s.id));

    // Ensure at least one set remains active
    if (newSets.length > 0 && !newSets.some((s) => s.active)) {
      newSets[0].active = true;
    }

    const newDoc: PromptDocument = { ...document, sets: newSets, prompts: newPrompts };

    set((state) => ({
      document: newDoc,
      focusedId: state.focusedId === id ? null : state.focusedId,
      undoStack: [...state.undoStack, { document: prevDoc }],
      redoStack: [],
    }));

    vscode.postMessage({ type: 'contentChanged', document: newDoc });
  },

  reorderPrompts: (orderedIds) => {
    const { document } = get();
    if (!document) return;

    const prevDoc = document;
    const promptMap = new Map(document.prompts.map((p) => [p.id, p]));
    const newPrompts = orderedIds
      .map((id) => promptMap.get(id))
      .filter((p): p is Prompt => p !== undefined);

    const newDoc: PromptDocument = { ...document, prompts: newPrompts };

    set((state) => ({
      document: newDoc,
      undoStack: [...state.undoStack, { document: prevDoc }],
      redoStack: [],
    }));

    vscode.postMessage({ type: 'contentChanged', document: newDoc });
  },

  // Set operations (v1.1)
  createSet: (afterSetId) => {
    const { document } = get();
    if (!document) return '';

    const prevDoc = document;
    const newId = generateId();
    const now = new Date().toISOString();

    const newSet: PromptSet = {
      id: newId,
      active: true, // New sets become active
      collapsed: false,
      created: now,
    };

    // Deactivate other sets
    let newSets = document.sets.map((s) => ({ ...s, active: false }));

    // Insert the new set at the right position
    if (afterSetId) {
      const afterIndex = newSets.findIndex((s) => s.id === afterSetId);
      if (afterIndex >= 0) {
        newSets = [
          ...newSets.slice(0, afterIndex + 1),
          newSet,
          ...newSets.slice(afterIndex + 1),
        ];
      } else {
        newSets.push(newSet);
      }
    } else {
      newSets.push(newSet);
    }

    // Create an empty prompt in the new set
    const newPromptId = generateId();
    const newPrompt: Prompt = {
      id: newPromptId,
      content: '',
      metadata: {
        id: newPromptId,
        setId: newId,
        status: 'queue',
        created: now,
      },
    };

    const newDoc: PromptDocument = {
      ...document,
      sets: newSets,
      prompts: [...document.prompts, newPrompt],
    };

    set((state) => ({
      document: newDoc,
      focusedId: newPromptId,
      undoStack: [...state.undoStack, { document: prevDoc }],
      redoStack: [],
    }));

    vscode.postMessage({ type: 'contentChanged', document: newDoc });
    return newId;
  },

  deleteSet: (setId) => {
    const { document } = get();
    if (!document) return;

    const prevDoc = document;

    // Remove all prompts in the set
    const newPrompts = document.prompts.filter((p) => p.metadata.setId !== setId);
    // Remove the set
    let newSets = document.sets.filter((s) => s.id !== setId);

    // Ensure at least one set is active
    if (newSets.length > 0 && !newSets.some((s) => s.active)) {
      newSets[0].active = true;
    }

    const newDoc: PromptDocument = { ...document, sets: newSets, prompts: newPrompts };

    set((state) => ({
      document: newDoc,
      undoStack: [...state.undoStack, { document: prevDoc }],
      redoStack: [],
    }));

    vscode.postMessage({ type: 'contentChanged', document: newDoc });
  },

  setActiveSet: (setId) => {
    const { document } = get();
    if (!document) return;

    const prevDoc = document;

    // Set only this set as active
    const newSets = document.sets.map((s) => ({
      ...s,
      active: s.id === setId,
    }));

    const newDoc: PromptDocument = { ...document, sets: newSets };

    set((state) => ({
      document: newDoc,
      undoStack: [...state.undoStack, { document: prevDoc }],
      redoStack: [],
    }));

    vscode.postMessage({ type: 'contentChanged', document: newDoc });
  },

  toggleSetCollapse: (setId) => {
    const { document } = get();
    if (!document) return;

    const prevDoc = document;

    const newSets = document.sets.map((s) =>
      s.id === setId ? { ...s, collapsed: !s.collapsed } : s
    );

    const newDoc: PromptDocument = { ...document, sets: newSets };

    set((state) => ({
      document: newDoc,
      undoStack: [...state.undoStack, { document: prevDoc }],
      redoStack: [],
    }));

    vscode.postMessage({ type: 'contentChanged', document: newDoc });
  },

  renameSet: (setId, name) => {
    const { document } = get();
    if (!document) return;

    const prevDoc = document;

    const newSets = document.sets.map((s) =>
      s.id === setId ? { ...s, name } : s
    );

    const newDoc: PromptDocument = { ...document, sets: newSets };

    set((state) => ({
      document: newDoc,
      undoStack: [...state.undoStack, { document: prevDoc }],
      redoStack: [],
    }));

    vscode.postMessage({ type: 'contentChanged', document: newDoc });
  },

  movePromptToSet: (promptId, setId) => {
    const { document } = get();
    if (!document) return;

    const prevDoc = document;

    const newPrompts = document.prompts.map((p) =>
      p.id === promptId ? { ...p, metadata: { ...p.metadata, setId } } : p
    );

    const newDoc: PromptDocument = { ...document, prompts: newPrompts };

    set((state) => ({
      document: newDoc,
      undoStack: [...state.undoStack, { document: prevDoc }],
      redoStack: [],
    }));

    vscode.postMessage({ type: 'contentChanged', document: newDoc });
  },

  getActiveSetId: () => {
    const { document } = get();
    if (!document || document.sets.length === 0) return null;
    const activeSet = document.sets.find((s) => s.active);
    return activeSet?.id || document.sets[0]?.id || null;
  },

  // Session operations (v2.0 H2 level)
  createSession: (setId, afterSessionId) => {
    const { document } = get();
    if (!document) return '';

    const prevDoc = document;
    const sessionId = generateId();
    const now = new Date().toISOString();

    const newSession = {
      id: sessionId,
      setId,
      collapsed: false,
    };

    let newSessions = [...document.sessions];
    if (afterSessionId) {
      const afterIndex = newSessions.findIndex((s) => s.id === afterSessionId);
      if (afterIndex >= 0) {
        newSessions.splice(afterIndex + 1, 0, newSession);
      } else {
        newSessions.push(newSession);
      }
    } else {
      newSessions.push(newSession);
    }

    const newDoc: PromptDocument = { ...document, sessions: newSessions };

    set((state) => ({
      document: newDoc,
      undoStack: [...state.undoStack, { document: prevDoc }],
      redoStack: [],
    }));

    vscode.postMessage({ type: 'contentChanged', document: newDoc });
    return sessionId;
  },

  renameSession: (sessionId, name) => {
    const { document } = get();
    if (!document) return;

    const prevDoc = document;

    const newSessions = document.sessions.map((s) =>
      s.id === sessionId ? { ...s, name } : s
    );

    const newDoc: PromptDocument = { ...document, sessions: newSessions };

    set((state) => ({
      document: newDoc,
      undoStack: [...state.undoStack, { document: prevDoc }],
      redoStack: [],
    }));

    vscode.postMessage({ type: 'contentChanged', document: newDoc });
  },

  toggleSessionCollapse: (sessionId) => {
    const { document } = get();
    if (!document) return;

    const prevDoc = document;

    const newSessions = document.sessions.map((s) =>
      s.id === sessionId ? { ...s, collapsed: !s.collapsed } : s
    );

    const newDoc: PromptDocument = { ...document, sessions: newSessions };

    set((state) => ({
      document: newDoc,
      undoStack: [...state.undoStack, { document: prevDoc }],
      redoStack: [],
    }));

    vscode.postMessage({ type: 'contentChanged', document: newDoc });
  },

  // Legacy group operations (deprecated)
  toggleGroupCollapse: (groupId) => {
    const { document } = get();
    if (!document) return;

    const prevDoc = document;
    const currentGroup = document.fileMetadata.groups[groupId] || {
      collapsed: false,
    };

    const newFileMetadata: FileMetadata = {
      ...document.fileMetadata,
      groups: {
        ...document.fileMetadata.groups,
        [groupId]: {
          ...currentGroup,
          collapsed: !currentGroup.collapsed,
        },
      },
    };

    const newDoc: PromptDocument = {
      ...document,
      fileMetadata: newFileMetadata,
    };

    set((state) => ({
      document: newDoc,
      undoStack: [...state.undoStack, { document: prevDoc }],
      redoStack: [],
    }));

    vscode.postMessage({ type: 'contentChanged', document: newDoc });
  },

  setPromptGroup: (promptId, groupId) => {
    const { document } = get();
    if (!document) return;

    const prevDoc = document;
    const newPrompts = document.prompts.map((p) =>
      p.id === promptId
        ? { ...p, metadata: { ...p.metadata, group: groupId } }
        : p
    );

    const newDoc: PromptDocument = { ...document, prompts: newPrompts };

    set((state) => ({
      document: newDoc,
      undoStack: [...state.undoStack, { document: prevDoc }],
      redoStack: [],
    }));

    vscode.postMessage({ type: 'contentChanged', document: newDoc });
  },

  createGroup: (name) => {
    const { document } = get();
    if (!document) return '';

    const prevDoc = document;
    const newId = generateId();

    const newFileMetadata: FileMetadata = {
      ...document.fileMetadata,
      groups: {
        ...document.fileMetadata.groups,
        [newId]: {
          name: name || `Group ${Object.keys(document.fileMetadata.groups).length + 1}`,
          collapsed: false,
        },
      },
    };

    const newDoc: PromptDocument = {
      ...document,
      fileMetadata: newFileMetadata,
    };

    set((state) => ({
      document: newDoc,
      undoStack: [...state.undoStack, { document: prevDoc }],
      redoStack: [],
    }));

    vscode.postMessage({ type: 'contentChanged', document: newDoc });
    return newId;
  },

  renameGroup: (groupId, name) => {
    const { document } = get();
    if (!document) return;

    const prevDoc = document;
    const currentGroup = document.fileMetadata.groups[groupId];
    if (!currentGroup) return;

    const newFileMetadata: FileMetadata = {
      ...document.fileMetadata,
      groups: {
        ...document.fileMetadata.groups,
        [groupId]: { ...currentGroup, name },
      },
    };

    const newDoc: PromptDocument = {
      ...document,
      fileMetadata: newFileMetadata,
    };

    set((state) => ({
      document: newDoc,
      undoStack: [...state.undoStack, { document: prevDoc }],
      redoStack: [],
    }));

    vscode.postMessage({ type: 'contentChanged', document: newDoc });
  },

  undo: () => {
    const { undoStack, document } = get();
    if (undoStack.length === 0 || !document) return;

    const prevEntry = undoStack[undoStack.length - 1];
    const newUndoStack = undoStack.slice(0, -1);

    set((state) => ({
      document: prevEntry.document,
      undoStack: newUndoStack,
      redoStack: [...state.redoStack, { document }],
    }));

    vscode.postMessage({ type: 'contentChanged', document: prevEntry.document });
  },

  redo: () => {
    const { redoStack, document } = get();
    if (redoStack.length === 0 || !document) return;

    const nextEntry = redoStack[redoStack.length - 1];
    const newRedoStack = redoStack.slice(0, -1);

    set((state) => ({
      document: nextEntry.document,
      undoStack: [...state.undoStack, { document }],
      redoStack: newRedoStack,
    }));

    vscode.postMessage({ type: 'contentChanged', document: nextEntry.document });
  },

  // Claude Code session actions
  setClaudeSessions: (sessions) => set({ claudeSessions: sessions }),

  setSessionBrowserOpen: (open) => set({ sessionBrowserOpen: open }),

  setSelectedSessionId: (id) => set({ selectedSessionId: id }),

  linkPromptToSession: (promptId, sessionId) => {
    const { document } = get();
    if (!document) return;

    const prevDoc = document;
    const now = new Date().toISOString();

    const newPrompts = document.prompts.map((p) =>
      p.id === promptId
        ? {
            ...p,
            metadata: {
              ...p.metadata,
              claudeSessionId: sessionId,
              executedAt: now,
            },
          }
        : p
    );

    const newDoc: PromptDocument = { ...document, prompts: newPrompts };

    set((state) => ({
      document: newDoc,
      undoStack: [...state.undoStack, { document: prevDoc }],
      redoStack: [],
    }));

    vscode.postMessage({ type: 'contentChanged', document: newDoc });
    vscode.postMessage({ type: 'linkSession', promptId, sessionId });
  },

  unlinkPromptFromSession: (promptId) => {
    const { document } = get();
    if (!document) return;

    const prevDoc = document;

    const newPrompts = document.prompts.map((p) =>
      p.id === promptId
        ? {
            ...p,
            metadata: {
              ...p.metadata,
              claudeSessionId: undefined,
              claudeMessageId: undefined,
              executedAt: undefined,
              responsePreview: undefined,
            },
          }
        : p
    );

    const newDoc: PromptDocument = { ...document, prompts: newPrompts };

    set((state) => ({
      document: newDoc,
      undoStack: [...state.undoStack, { document: prevDoc }],
      redoStack: [],
    }));

    vscode.postMessage({ type: 'contentChanged', document: newDoc });
    vscode.postMessage({ type: 'unlinkSession', promptId });
  },
}));
