import { describe, it, expect } from 'vitest';
import { looksLikeTUI, cleanTUIArtifacts } from '../lib/tuiCleaner';

describe('tuiCleaner', () => {
  describe('looksLikeTUI', () => {
    it('detects vertical bar prefixes', () => {
      const text = `│ Line one
│ Line two
│ Line three`;
      expect(looksLikeTUI(text)).toBe(true);
    });

    it('detects box drawing characters', () => {
      const text = `┌─────────────┐
│ Content     │
└─────────────┘`;
      expect(looksLikeTUI(text)).toBe(true);
    });

    it('detects pipe characters as TUI', () => {
      const text = `| Line one
| Line two
| Line three`;
      expect(looksLikeTUI(text)).toBe(true);
    });

    it('returns false for normal text', () => {
      const text = `This is normal text.
It has no TUI artifacts.
Just regular content.`;
      expect(looksLikeTUI(text)).toBe(false);
    });

    it('returns false for single pipe (like markdown table)', () => {
      const text = `This has a | single pipe but not TUI`;
      expect(looksLikeTUI(text)).toBe(false);
    });

    it('detects double-line box characters', () => {
      const text = `╔═══════════════╗
║ Double-line   ║
╚═══════════════╝`;
      expect(looksLikeTUI(text)).toBe(true);
    });
  });

  describe('cleanTUIArtifacts', () => {
    it('removes leading vertical bars', () => {
      const input = `│ Line one
│ Line two
│ Line three`;
      const result = cleanTUIArtifacts(input);

      expect(result).not.toContain('│');
      expect(result).toContain('Line one');
      expect(result).toContain('Line two');
      expect(result).toContain('Line three');
    });

    it('removes trailing vertical bars', () => {
      const input = `Content here │
More content │`;
      const result = cleanTUIArtifacts(input);

      expect(result).not.toContain('│');
      expect(result).toContain('Content here');
      expect(result).toContain('More content');
    });

    it('removes box drawing lines', () => {
      const input = `┌─────────────────┐
│ Content here    │
└─────────────────┘`;
      const result = cleanTUIArtifacts(input);

      // Should remove the border lines but keep content
      expect(result).toContain('Content here');
      expect(result).not.toContain('┌');
      expect(result).not.toContain('┐');
      expect(result).not.toContain('└');
      expect(result).not.toContain('┘');
    });

    it('leaves normal text unchanged', () => {
      const input = `This is normal text.
No TUI artifacts here.`;
      const result = cleanTUIArtifacts(input);

      expect(result).toBe(input);
    });

    it('normalizes excessive blank lines', () => {
      const input = `│ Line one



│ Line two`;
      const result = cleanTUIArtifacts(input);

      // Should have at most 2 consecutive newlines
      expect(result).not.toMatch(/\n{3,}/);
    });

    it('handles mixed TUI styles', () => {
      const input = `┌────────────────────────────────────┐
│ Box-style TUI content              │
│ with full borders                  │
└────────────────────────────────────┘`;
      const result = cleanTUIArtifacts(input);

      expect(result).toContain('Box-style TUI content');
      expect(result).toContain('with full borders');
      expect(result).not.toContain('┌');
      expect(result).not.toContain('│');
    });

    it('handles pipe character TUI', () => {
      const input = `| Line with pipe prefix
| Another line`;
      const result = cleanTUIArtifacts(input);

      expect(result).toContain('Line with pipe prefix');
      expect(result).not.toMatch(/^\|/m);
    });

    it('trims result', () => {
      const input = `│
│ Content
│   `;
      const result = cleanTUIArtifacts(input);

      expect(result).not.toMatch(/^\s/);
      expect(result).not.toMatch(/\s$/);
    });
  });
});
