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
import { PromptGroup } from './PromptGroup';
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
  const toggleGroupCollapse = useCanvasStore((s) => s.toggleGroupCollapse);
  const undo = useCanvasStore((s) => s.undo);
  const redo = useCanvasStore((s) => s.redo);

  const textareaRefs = useRef<Map<string, HTMLTextAreaElement>>(new Map());

  const prompts = document?.prompts || [];
  const fileMetadata = document?.fileMetadata || { version: '1.0', groups: {} };

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
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [undo, redo]);

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

  // Group prompts by groupId
  const { grouped, ungrouped } = useMemo(() => {
    const grouped: Record<string, Prompt[]> = {};
    const ungrouped: Prompt[] = [];

    for (const prompt of prompts) {
      if (prompt.metadata.group) {
        if (!grouped[prompt.metadata.group]) {
          grouped[prompt.metadata.group] = [];
        }
        grouped[prompt.metadata.group].push(prompt);
      } else {
        ungrouped.push(prompt);
      }
    }

    return { grouped, ungrouped };
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
      createPrompt(id, prompt?.metadata.group);
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

  const handleToggleCollapse = useCallback(
    (groupId: string) => {
      toggleGroupCollapse(groupId);
    },
    [toggleGroupCollapse]
  );

  const handleAddPrompt = useCallback(() => {
    createPrompt();
  }, [createPrompt]);

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
          {/* Grouped prompts */}
          {Object.entries(grouped).map(([groupId, groupPrompts]) => {
            const groupMeta = fileMetadata.groups[groupId] || {
              collapsed: false,
            };
            return (
              <PromptGroup
                key={groupId}
                groupId={groupId}
                metadata={groupMeta}
                prompts={groupPrompts}
                focusedId={focusedId}
                onFocus={handleFocus}
                onContentChange={handleContentChange}
                onStatusChange={handleStatusChange}
                onDelete={handleDelete}
                onCreateBelow={handleCreateBelow}
                onToggleCollapse={() => handleToggleCollapse(groupId)}
                onKeyDown={handleKeyDown}
                registerTextarea={registerTextarea}
              />
            );
          })}

          {/* Ungrouped prompts */}
          <div className="space-y-3">
            <AnimatePresence initial={false}>
              {ungrouped.map((prompt) => (
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
        </SortableContext>
      </DndContext>

      {/* Empty state / Add prompt button */}
      {prompts.length === 0 ? (
        <button
          type="button"
          onClick={handleAddPrompt}
          className="w-full py-8 rounded-lg border-2 border-dashed border-[var(--vscode-panel-border)] hover:border-[var(--vscode-focusBorder)] transition-fast text-gray-500 hover:text-gray-300"
        >
          Click to add your first prompt
        </button>
      ) : (
        <button
          type="button"
          onClick={handleAddPrompt}
          className="w-full mt-4 py-3 rounded-lg border border-[var(--vscode-panel-border)] hover:border-[var(--vscode-focusBorder)] transition-fast text-gray-500 hover:text-gray-300 text-sm"
        >
          + Add prompt
        </button>
      )}
    </div>
  );
}
