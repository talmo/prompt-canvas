# Prompt Canvas

VS Code extension that provides a notebook-like interface for prompt queue markdown files (`.queue.md`, `PROMPT_QUEUE.md`).

## Quick Reference

```bash
npm run build          # Build extension + webview
npm run watch          # Watch mode for development
npm run test           # Run unit tests (Vitest)
npm run test:harness   # Start visual test harness for Playwright
npm run lint           # Type check both extension and webview
```

## Architecture

```
prompt-canvas/
├── src/                      # VS Code Extension (Node.js)
│   ├── extension.ts          # Extension entry point
│   ├── PromptCanvasProvider.ts  # Custom editor provider
│   └── lib/
│       ├── parser.ts         # Markdown file parser/serializer
│       ├── types.ts          # Shared types (PromptDocument, etc.)
│       └── tuiCleaner.ts     # TUI artifact removal
│
├── webview-ui/               # React Webview (Vite + React)
│   ├── src/
│   │   ├── main.tsx          # React entry
│   │   ├── App.tsx           # Root component
│   │   ├── vscode.ts         # VS Code API wrapper
│   │   ├── components/       # React components
│   │   │   ├── Canvas.tsx    # Main canvas with drag-drop
│   │   │   ├── PromptCell.tsx
│   │   │   ├── PromptSetContainer.tsx
│   │   │   └── StatusBadge.tsx
│   │   ├── store/
│   │   │   └── useCanvasStore.ts  # Zustand state management
│   │   └── hooks/
│   │       └── useVSCodeBridge.ts # Extension communication
│   └── test-harness.html     # Visual testing (see Testing section)
│
├── src/test/                 # Unit tests
│   ├── parser.test.ts
│   └── fixtures/             # Test .queue.md files
│
└── e2e/                      # E2E tests (WebdriverIO, currently flaky)
```

## File Format (v2.0)

The extension uses a heading-based markdown format:

```markdown
# Set Name                    ← PromptSet (H1)
<!-- {"id":"s1","active":true} -->

## Session Name               ← Session (H2, optional)
<!-- {"id":"sess1"} -->

### Prompt Title              ← Prompt (H3)
<!-- {"id":"p1","status":"queue"} -->
Prompt content here...
```

**Status values:** `queue` | `active` | `done` | `trash`

Older formats (v1.0, v1.1) are auto-migrated to v2.0 on save.

## Testing

### Unit Tests (Vitest)

```bash
npm run test              # Run once
npm run test:watch        # Watch mode
npm run test:coverage     # With coverage report
```

Tests parser logic, format migrations, and TUI cleaner.

### Visual Testing (Test Harness + Playwright)

For visual verification of the webview UI without launching VS Code:

```bash
npm run test:harness
# Opens http://localhost:5173/test-harness.html
```

Then use Playwright MCP tools:

```
browser_navigate → http://localhost:5173/test-harness.html
browser_snapshot → Get accessibility tree
browser_take_screenshot → Visual capture
browser_click → Interact with elements
browser_select_option → Switch test fixtures
```

**Available fixtures:** `v2-full`, `v2-simple`, `multi-set`, `all-statuses`, `empty`, `long-content`

Select via dropdown or URL param: `?fixture=all-statuses`

### E2E Tests (WebdriverIO)

```bash
npm run test:e2e
```

Full VS Code integration tests. Currently flaky with connection issues. Prefer test harness for visual verification.

## Development

### Running the Extension

1. Open project in VS Code
2. Press F5 to launch Extension Development Host
3. Open any `.queue.md` file or `PROMPT_QUEUE.md`

### Watch Mode

```bash
npm run watch
```

Rebuilds both extension and webview on changes.

### Building for Production

```bash
npm run build
npm run package   # Creates .vsix file
```

## Key Patterns

### Extension ↔ Webview Communication

```typescript
// Extension → Webview
panel.webview.postMessage({ type: 'documentLoaded', document });

// Webview → Extension
vscode.postMessage({ type: 'contentChanged', document });
```

Message types defined in `src/lib/types.ts`.

### State Management

Webview uses Zustand store (`useCanvasStore.ts`) with:
- Document state (sets, sessions, prompts)
- UI state (collapsed, focused)
- Undo/redo history

### Data Test IDs

Components use `data-testid` for testing:
- `prompt-cell` - Individual prompt
- `prompt-set` - Set container (also `data-set-id`, `data-active`)
- `set-header` - Set header (also `data-collapsed`)
- `status-badge` - Status indicator (also `data-status`)

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| Shift+Enter | Add prompt below current |
| Ctrl+Shift+Enter | Create new set |
| Ctrl+Shift+A | Activate current set |
| Ctrl+Z | Undo |
| Ctrl+Shift+Z | Redo |

## Investigation Notes

Development investigations are in `scratch/` (gitignored):
- `scratch/2026-01-11-roadmap-v2/` - v2.0 format implementation
- `scratch/2026-01-11-roadmap-v2/TEST_HARNESS.md` - Visual testing details
