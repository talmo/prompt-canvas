import { create } from 'zustand';
import type { PromptDocument, Prompt, PromptStatus, FileMetadata } from '../types';
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

  // Actions
  setDocument: (doc: PromptDocument, isExternal?: boolean) => void;
  setFocusedId: (id: string | null) => void;
  updatePromptContent: (id: string, content: string) => void;
  setPromptStatus: (id: string, status: PromptStatus) => void;
  createPrompt: (afterId?: string, groupId?: string) => string;
  deletePrompt: (id: string) => void;
  reorderPrompts: (orderedIds: string[]) => void;
  toggleGroupCollapse: (groupId: string) => void;
  setPromptGroup: (promptId: string, groupId: string | undefined) => void;
  createGroup: (name?: string) => string;
  renameGroup: (groupId: string, name: string) => void;
  undo: () => void;
  redo: () => void;
}

export const useCanvasStore = create<CanvasStore>((set, get) => ({
  document: null,
  focusedId: null,
  undoStack: [],
  redoStack: [],
  isExternalUpdate: false,

  setDocument: (doc, isExternal = false) => {
    set({ document: doc, isExternalUpdate: isExternal });
    if (!isExternal) {
      // Don't sync to extension if this is an external update
    }
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

  createPrompt: (afterId, groupId) => {
    const { document } = get();
    if (!document) return '';

    const prevDoc = document;
    const newId = generateId();
    const now = new Date().toISOString();

    const newPrompt: Prompt = {
      id: newId,
      content: '',
      metadata: {
        id: newId,
        status: 'queue',
        created: now,
        group: groupId,
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

    const newDoc: PromptDocument = { ...document, prompts: newPrompts };

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

    const newDoc: PromptDocument = { ...document, prompts: newPrompts };

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
}));
