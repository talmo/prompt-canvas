/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'vscode': {
          'bg': 'var(--vscode-editor-background)',
          'fg': 'var(--vscode-editor-foreground)',
          'border': 'var(--vscode-panel-border)',
          'input-bg': 'var(--vscode-input-background)',
          'input-fg': 'var(--vscode-input-foreground)',
          'input-border': 'var(--vscode-input-border)',
          'button-bg': 'var(--vscode-button-background)',
          'button-fg': 'var(--vscode-button-foreground)',
          'button-hover': 'var(--vscode-button-hoverBackground)',
          'focus-border': 'var(--vscode-focusBorder)',
          'selection': 'var(--vscode-editor-selectionBackground)',
          'badge-bg': 'var(--vscode-badge-background)',
          'badge-fg': 'var(--vscode-badge-foreground)',
        }
      },
    },
  },
  plugins: [],
}
