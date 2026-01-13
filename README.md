# Prompt Canvas

A VS Code extension that provides a notebook-like interface for managing prompt queues in markdown files.

![VS Code](https://img.shields.io/badge/VS%20Code-^1.85.0-blue)
![License](https://img.shields.io/badge/license-MIT-green)

## Overview

Prompt Canvas turns markdown files into an interactive canvas for organizing AI prompts. It's designed for workflows where you queue up multiple prompts, organize them into sets and sessions, and track their status.

**Features:**
- Visual editor for `.queue.md` and `PROMPT_QUEUE.md` files
- Organize prompts into **Sets** (projects/topics) and **Sessions** (conversations)
- Track prompt status: `queue` → `active` → `done`
- Drag-and-drop reordering
- Keyboard-driven workflow
- Plain markdown storage (portable, version-controllable)

## Installation

### From Source (Local Development)

```bash
# Clone and install
git clone https://github.com/talmo/prompt-canvas.git
cd prompt-canvas
npm install
cd webview-ui && npm install && cd ..

# Build and install to VS Code
./scripts/install-local.sh
```

### From VSIX

```bash
npm run build
npm run package
code --install-extension prompt-canvas.vsix
```

## Usage

1. Create a file named `PROMPT_QUEUE.md` or `*.queue.md`
2. Open it in VS Code — Prompt Canvas activates automatically
3. Use the visual interface to add/organize prompts

### File Format

Prompt Canvas uses a heading-based markdown format:

```markdown
<!-- prompt-canvas: {"version":"2.0"} -->

# My Project
<!-- {"id":"set1","active":true} -->

## Session 1
<!-- {"id":"sess1"} -->

### First prompt
<!-- {"id":"p1","status":"queue"} -->
Write a function that...

### Second prompt
<!-- {"id":"p2","status":"done"} -->
Now add error handling...
```

- **H1 (`#`)** — Prompt Set (project/topic grouping)
- **H2 (`##`)** — Session (optional conversation grouping)
- **H3 (`###`)** — Individual prompt

Status values: `queue` | `active` | `done` | `trash`

### Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Shift+Enter` | Add prompt below current |
| `Ctrl+Shift+Enter` | Create new set |
| `Ctrl+Shift+A` | Activate current set |
| `Ctrl+Z` | Undo |
| `Ctrl+Shift+Z` | Redo |

## Development

### Quick Start

```bash
# Install dependencies
npm install
cd webview-ui && npm install && cd ..

# Development mode (debug in VS Code)
# Press F5 in VS Code to launch Extension Development Host

# Watch mode (auto-rebuild on changes)
npm run watch
```

### Commands

| Command | Description |
|---------|-------------|
| `npm run build` | Build extension + webview |
| `npm run watch` | Watch mode for development |
| `npm run test` | Run unit tests (Vitest) |
| `npm run test:harness` | Start visual test harness |
| `npm run lint` | Type check everything |
| `npm run package` | Create .vsix file |

### Local Deployment (Dogfooding)

To install the extension in your main VS Code (not debug mode):

```bash
./scripts/install-local.sh
```

This script:
1. Builds the extension and webview
2. Packages into a `.vsix` file
3. Installs to your VS Code
4. Prompts to reload

Use `--no-reload` to skip the reload prompt.

### Project Structure

```
prompt-canvas/
├── src/                      # VS Code Extension (TypeScript)
│   ├── extension.ts          # Entry point
│   ├── PromptCanvasProvider.ts
│   └── lib/
│       ├── parser.ts         # Markdown parser/serializer
│       └── types.ts          # Shared types
├── webview-ui/               # React UI (Vite)
│   ├── src/
│   │   ├── App.tsx
│   │   ├── components/
│   │   └── store/
│   └── test-harness.html     # Visual testing
├── scripts/
│   └── install-local.sh      # Local deployment script
└── src/test/                 # Unit tests
```

### Testing

**Unit tests** (parser, format migrations):
```bash
npm run test
npm run test:watch
npm run test:coverage
```

**Visual testing** (UI without VS Code):
```bash
npm run test:harness
# Opens http://localhost:5173/test-harness.html
```

See [CLAUDE.md](./CLAUDE.md) for detailed testing procedures and architecture notes.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run tests: `npm run test && npm run lint`
5. Submit a pull request

## License

MIT
