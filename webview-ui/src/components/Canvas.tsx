import { useCallback, useRef, useEffect, useMemo } from 'react';
import { AnimatePresence } from 'framer-motion';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { useCanvasStore } from '../store/useCanvasStore';
import { useFocusNavigation } from '../hooks/useFocusNavigation';
import { PromptCell } from './PromptCell';
import { PromptSetContainer } from './PromptSetContainer';
import type { Prompt, PromptStatus } from '../types';

export function Canvas() {
  const document = useCanvasStore((s) => s.document);
  const focusedId = useCanvasStore((s) => s.focusedId);
  const setFocusedId = useCanvasStore((s) => s.setFocusedId);
  const updatePromptContent = useCanvasStore((s) => s.updatePromptContent);
  const setPromptStatus = useCanvasStore((s) => s.setPromptStatus);
  const deletePrompt = useCanvasStore((s) => s.deletePrompt);
  const createPrompt = useCanvasStore((s) => s.createPrompt);
  const reorderPrompts = useCanvasStore((s) => s.reorderPrompts);
  const toggleSetCollapse = useCanvasStore((s) => s.toggleSetCollapse);
  const setActiveSet = useCanvasStore((s) => s.setActiveSet);
  const createSet = useCanvasStore((s) => s.createSet);
  const undo = useCanvasStore((s) => s.undo);
  const redo = useCanvasStore((s) => s.redo);

  const textareaRefs = useRef<Map<string, HTMLTextAreaElement>>(new Map());

  const prompts = document?.prompts || [];
  const sets = document?.sets || [];

  const { handleKeyDown: focusHandleKeyDown } = useFocusNavigation(
    prompts,
    textareaRefs.current
  );

  // Keyboard shortcuts
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      // Undo: Ctrl/Cmd + Z
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
      }
      // Redo: Ctrl/Cmd + Shift + Z or Ctrl/Cmd + Y
      if (
        ((e.ctrlKey || e.metaKey) && e.key === 'z' && e.shiftKey) ||
        ((e.ctrlKey || e.metaKey) && e.key === 'y')
      ) {
        e.preventDefault();
        redo();
      }
      // Create new set: Ctrl/Cmd + Shift + Enter
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'Enter') {
        e.preventDefault();
        // Find the current set based on focused prompt
        const focusedPrompt = prompts.find((p) => p.id === focusedId);
        const currentSetId = focusedPrompt?.metadata.setId;
        createSet(currentSetId);
      }
      // Mark current set as active: Ctrl/Cmd + Shift + A
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'a') {
        e.preventDefault();
        const focusedPrompt = prompts.find((p) => p.id === focusedId);
        if (focusedPrompt?.metadata.setId) {
          setActiveSet(focusedPrompt.metadata.setId);
        }
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [undo, redo, createSet, setActiveSet, prompts, focusedId]);

  const registerTextarea = useCallback(
    (id: string, el: HTMLTextAreaElement | null) => {
      if (el) {
        textareaRefs.current.set(id, el);
      } else {
        textareaRefs.current.delete(id);
      }
    },
    []
  );

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (over && active.id !== over.id) {
        const oldIndex = prompts.findIndex((p) => p.id === active.id);
        const newIndex = prompts.findIndex((p) => p.id === over.id);
        const newOrder = [...prompts];
        const [removed] = newOrder.splice(oldIndex, 1);
        newOrder.splice(newIndex, 0, removed);
        reorderPrompts(newOrder.map((p) => p.id));
      }
    },
    [prompts, reorderPrompts]
  );

  // Group prompts by setId
  const { promptsBySet, orphanPrompts } = useMemo(() => {
    const promptsBySet = new Map<string, Prompt[]>();
    const orphanPrompts: Prompt[] = [];

    for (const prompt of prompts) {
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

    return { promptsBySet, orphanPrompts };
  }, [prompts]);

  const handleContentChange = useCallback(
    (id: string, content: string) => {
      updatePromptContent(id, content);
    },
    [updatePromptContent]
  );

  const handleStatusChange = useCallback(
    (id: string, status: PromptStatus) => {
      setPromptStatus(id, status);
    },
    [setPromptStatus]
  );

  const handleDelete = useCallback(
    (id: string) => {
      deletePrompt(id);
    },
    [deletePrompt]
  );

  const handleCreateBelow = useCallback(
    (id: string) => {
      const prompt = prompts.find((p) => p.id === id);
      createPrompt(id, prompt?.metadata.setId);
    },
    [prompts, createPrompt]
  );

  const handleFocus = useCallback(
    (id: string) => {
      setFocusedId(id);
    },
    [setFocusedId]
  );

  const handleKeyDown = useCallback(
    (promptId: string, e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      focusHandleKeyDown(promptId, e);
    },
    [focusHandleKeyDown]
  );

  const handleToggleSetCollapse = useCallback(
    (setId: string) => {
      toggleSetCollapse(setId);
    },
    [toggleSetCollapse]
  );

  const handleSetActive = useCallback(
    (setId: string) => {
      setActiveSet(setId);
    },
    [setActiveSet]
  );

  const handleAddPrompt = useCallback(() => {
    createPrompt();
  }, [createPrompt]);

  const handleCreateNewSet = useCallback(() => {
    createSet();
  }, [createSet]);

  if (!document) {
    return (
      <div className="flex items-center justify-center h-full text-gray-500">
        Loading...
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4 max-w-4xl mx-auto">
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={prompts.map((p) => p.id)}
          strategy={verticalListSortingStrategy}
        >
          {/* Render sets in order */}
          {sets.map((set) => {
            const setPrompts = promptsBySet.get(set.id) || [];
            if (setPrompts.length === 0) return null;

            return (
              <PromptSetContainer
                key={set.id}
                set={set}
                prompts={setPrompts}
                focusedId={focusedId}
                onFocus={handleFocus}
                onContentChange={handleContentChange}
                onStatusChange={handleStatusChange}
                onDelete={handleDelete}
                onCreateBelow={handleCreateBelow}
                onToggleCollapse={() => handleToggleSetCollapse(set.id)}
                onSetActive={() => handleSetActive(set.id)}
                onKeyDown={handleKeyDown}
                registerTextarea={registerTextarea}
              />
            );
          })}

          {/* Orphan prompts (no setId) - render directly */}
          {orphanPrompts.length > 0 && (
            <div className="space-y-3 mb-6">
              <AnimatePresence initial={false}>
                {orphanPrompts.map((prompt) => (
                  <PromptCell
                    key={prompt.id}
                    prompt={prompt}
                    isFocused={focusedId === prompt.id}
                    onFocus={() => handleFocus(prompt.id)}
                    onContentChange={(content) =>
                      handleContentChange(prompt.id, content)
                    }
                    onStatusChange={(status) =>
                      handleStatusChange(prompt.id, status)
                    }
                    onDelete={() => handleDelete(prompt.id)}
                    onCreateBelow={() => handleCreateBelow(prompt.id)}
                    onKeyDown={(e) => handleKeyDown(prompt.id, e)}
                    registerTextarea={registerTextarea}
                  />
                ))}
              </AnimatePresence>
            </div>
          )}
        </SortableContext>
      </DndContext>

      {/* Action buttons */}
      <div className="flex gap-2 mt-4">
        {/* Add prompt to active set */}
        {prompts.length > 0 && (
          <button
            type="button"
            onClick={handleAddPrompt}
            className="flex-1 py-3 rounded-lg border border-[var(--vscode-panel-border)] hover:border-[var(--vscode-focusBorder)] transition-fast text-gray-500 hover:text-gray-300 text-sm"
          >
            + Add prompt
          </button>
        )}

        {/* Create new set */}
        <button
          type="button"
          onClick={handleCreateNewSet}
          className="px-4 py-3 rounded-lg border-2 border-dashed border-blue-500/50 hover:border-blue-500 transition-fast text-blue-400 hover:text-blue-300 text-sm"
          title="Create new set (Ctrl+Shift+Enter)"
        >
          + New Set
        </button>
      </div>

      {/* Empty state */}
      {prompts.length === 0 && (
        <button
          type="button"
          onClick={handleAddPrompt}
          className="w-full mt-4 py-8 rounded-lg border-2 border-dashed border-[var(--vscode-panel-border)] hover:border-[var(--vscode-focusBorder)] transition-fast text-gray-500 hover:text-gray-300"
        >
          Click to add your first prompt
        </button>
      )}

      {/* Keyboard shortcuts hint */}
      <div className="mt-4 text-xs text-gray-600 flex flex-wrap gap-x-4 gap-y-1">
        <span><kbd>Shift+Enter</kbd> Add prompt</span>
        <span><kbd>Ctrl+Shift+Enter</kbd> New set</span>
        <span><kbd>Ctrl+Shift+A</kbd> Activate set</span>
        <span><kbd>Ctrl+Z</kbd> Undo</span>
      </div>
    </div>
  );
}
