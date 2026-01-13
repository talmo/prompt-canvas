#!/usr/bin/env bash
#
# install-local.sh - Build and install Prompt Canvas extension locally
#
# Usage: ./scripts/install-local.sh [--no-reload]
#
# This script builds the extension from source and installs it to your
# local VS Code installation (not the Extension Development Host).
#
# Steps:
#   1. Checks prerequisites (code CLI, npx)
#   2. Installs dependencies if needed
#   3. Builds extension + webview
#   4. Packages into .vsix
#   5. Uninstalls any existing version
#   6. Installs the new .vsix
#   7. Prompts to reload VS Code (unless --no-reload)

set -euo pipefail

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Get repo root (script is in scripts/)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# Extension ID from package.json
EXTENSION_ID="talmo.prompt-canvas"
VSIX_NAME="prompt-canvas.vsix"

# Parse args
NO_RELOAD=false
for arg in "$@"; do
    case $arg in
        --no-reload)
            NO_RELOAD=true
            ;;
        -h|--help)
            echo "Usage: ./scripts/install-local.sh [--no-reload]"
            echo ""
            echo "Build and install Prompt Canvas to your local VS Code."
            echo ""
            echo "Options:"
            echo "  --no-reload  Skip the VS Code reload prompt"
            echo "  -h, --help   Show this help message"
            exit 0
            ;;
    esac
done

echo -e "${BLUE}══════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}  Prompt Canvas - Local Install${NC}"
echo -e "${BLUE}══════════════════════════════════════════════════════════${NC}"
echo

cd "$REPO_ROOT"

# Step 1: Prerequisites
echo -e "${YELLOW}[1/5]${NC} Checking prerequisites..."

if ! command -v code &> /dev/null; then
    echo -e "${RED}Error: 'code' command not found.${NC}"
    echo "Install it: VS Code → Cmd+Shift+P → 'Shell Command: Install code command'"
    exit 1
fi

if ! command -v npx &> /dev/null; then
    echo -e "${RED}Error: 'npx' not found. Install Node.js.${NC}"
    exit 1
fi

echo -e "  ${GREEN}✓${NC} VS Code CLI available"
echo -e "  ${GREEN}✓${NC} npx available"

# Step 2: Dependencies
echo -e "${YELLOW}[2/5]${NC} Installing dependencies..."

if [ ! -d "node_modules" ]; then
    npm install --silent
fi
if [ ! -d "webview-ui/node_modules" ]; then
    (cd webview-ui && npm install --silent)
fi
echo -e "  ${GREEN}✓${NC} Dependencies ready"

# Step 3: Build
echo -e "${YELLOW}[3/5]${NC} Building extension..."

npm run build --silent
echo -e "  ${GREEN}✓${NC} Build complete"

# Step 4: Package
echo -e "${YELLOW}[4/5]${NC} Packaging .vsix..."

# Use npx vsce (auto-installs if needed)
# --allow-missing-repository: No repo field in package.json
# --skip-license: No LICENSE file yet
npx --yes @vscode/vsce package \
    --out "$VSIX_NAME" \
    --allow-missing-repository \
    --skip-license \
    2>&1 | grep -v "^npm warn" || true

VSIX_PATH="$REPO_ROOT/$VSIX_NAME"
echo -e "  ${GREEN}✓${NC} Created: $VSIX_NAME"

# Step 5: Install
echo -e "${YELLOW}[5/5]${NC} Installing extension..."

# Uninstall existing (ignore if not installed)
code --uninstall-extension "$EXTENSION_ID" 2>/dev/null || true

# Install new version
code --install-extension "$VSIX_PATH" --force
echo -e "  ${GREEN}✓${NC} Installed: $EXTENSION_ID"

# Done
echo
echo -e "${GREEN}══════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}  Done! Extension installed.${NC}"
echo -e "${GREEN}══════════════════════════════════════════════════════════${NC}"
echo
echo -e "To activate, reload VS Code:"
echo -e "  ${YELLOW}Cmd+Shift+P${NC} → ${BLUE}Developer: Reload Window${NC}"
echo
echo -e "Then open any ${BLUE}PROMPT_QUEUE.md${NC} or ${BLUE}*.queue.md${NC} file."
echo

if [ "$NO_RELOAD" = false ]; then
    echo -ne "${YELLOW}Reload VS Code now? [y/N]${NC} "
    read -r response
    if [[ "$response" =~ ^[Yy]$ ]]; then
        code --command "workbench.action.reloadWindow" 2>/dev/null || {
            echo -e "${YELLOW}Could not auto-reload. Please reload manually.${NC}"
        }
    fi
fi
