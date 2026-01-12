import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { parse, serialize } from '../lib/parser';
import type { PromptDocument } from '../lib/types';

const fixturesDir = join(__dirname, 'fixtures');

function loadFixture(name: string): string {
  return readFileSync(join(fixturesDir, name), 'utf-8');
}

describe('parser', () => {
  describe('parse', () => {
    it('parses basic file with metadata', () => {
      const content = loadFixture('basic.queue.md');
      const doc = parse(content);

      // Parser upgrades to v2.0 and creates sets
      expect(doc.fileMetadata.version).toBe('2.0');
      expect(doc.sets).toBeDefined();
      expect(doc.sets.length).toBeGreaterThan(0);
      expect(doc.sessions).toBeDefined();
      expect(doc.prompts).toHaveLength(3);

      expect(doc.prompts[0].id).toBe('prompt1');
      expect(doc.prompts[0].metadata.status).toBe('queue');
      expect(doc.prompts[0].content).toBe('This is a basic prompt.');
      expect(doc.prompts[0].metadata.setId).toBeDefined();

      expect(doc.prompts[1].id).toBe('prompt2');
      expect(doc.prompts[1].metadata.status).toBe('active');
      expect(doc.prompts[1].content).toContain('multiple lines');

      expect(doc.prompts[2].id).toBe('prompt3');
      expect(doc.prompts[2].metadata.status).toBe('done');
    });

    it('parses file with groups', () => {
      const content = loadFixture('with-groups.queue.md');
      const doc = parse(content);

      expect(doc.fileMetadata.groups).toHaveProperty('grp1');
      expect(doc.fileMetadata.groups).toHaveProperty('grp2');
      expect(doc.fileMetadata.groups['grp1'].name).toBe('Feature Work');
      expect(doc.fileMetadata.groups['grp1'].collapsed).toBe(false);
      expect(doc.fileMetadata.groups['grp2'].name).toBe('Bug Fixes');
      expect(doc.fileMetadata.groups['grp2'].collapsed).toBe(true);

      expect(doc.prompts).toHaveLength(4);

      const grp1Prompts = doc.prompts.filter(p => p.metadata.group === 'grp1');
      const grp2Prompts = doc.prompts.filter(p => p.metadata.group === 'grp2');
      const ungrouped = doc.prompts.filter(p => !p.metadata.group);

      expect(grp1Prompts).toHaveLength(2);
      expect(grp2Prompts).toHaveLength(1);
      expect(ungrouped).toHaveLength(1);
    });

    it('parses v1.1 file with sets', () => {
      const content = loadFixture('with-sets.queue.md');
      const doc = parse(content);

      expect(doc.fileMetadata.version).toBe('2.0');
      expect(doc.sets).toHaveLength(3);
      expect(doc.prompts).toHaveLength(4);

      // Check sets
      const activeSet = doc.sets.find(s => s.active);
      expect(activeSet).toBeDefined();
      expect(activeSet?.name).toBe('Active Investigation');
      expect(activeSet?.id).toBe('set1');

      const collapsedSet = doc.sets.find(s => s.collapsed);
      expect(collapsedSet).toBeDefined();
      expect(collapsedSet?.name).toBe('Completed Work');

      // Check prompts have correct setIds
      const set1Prompts = doc.prompts.filter(p => p.metadata.setId === 'set1');
      expect(set1Prompts).toHaveLength(2);
      expect(set1Prompts[0].metadata.status).toBe('active');
      expect(set1Prompts[1].metadata.status).toBe('queue');

      const set2Prompts = doc.prompts.filter(p => p.metadata.setId === 'set2');
      expect(set2Prompts).toHaveLength(1);
      expect(set2Prompts[0].metadata.status).toBe('done');
    });

    it('parses empty file', () => {
      const content = loadFixture('empty.queue.md');
      const doc = parse(content);

      expect(doc.fileMetadata.version).toBe('2.0');
      expect(doc.sets).toHaveLength(0);
      expect(doc.sessions).toHaveLength(0);
      expect(doc.prompts).toHaveLength(0);
    });

    it('parses file without any metadata', () => {
      const content = loadFixture('no-metadata.queue.md');
      const doc = parse(content);

      expect(doc.prompts).toHaveLength(3);

      // Each prompt should have auto-generated ID
      doc.prompts.forEach(prompt => {
        expect(prompt.id).toBeTruthy();
        expect(prompt.metadata.id).toBe(prompt.id);
        expect(prompt.metadata.status).toBe('queue'); // default status
        expect(prompt.metadata.created).toBeTruthy(); // should have timestamp
      });

      expect(doc.prompts[0].content).toContain('plain prompt without any metadata');
      expect(doc.prompts[1].content).toContain('Another plain prompt');
      expect(doc.prompts[2].content).toContain('third prompt');
    });

    it('parses file with mixed metadata', () => {
      const content = loadFixture('mixed-metadata.queue.md');
      const doc = parse(content);

      expect(doc.prompts).toHaveLength(3);

      // First prompt has full metadata
      expect(doc.prompts[0].id).toBe('has-meta');
      expect(doc.prompts[0].metadata.status).toBe('active');
      expect(doc.prompts[0].metadata.created).toBe('2024-01-10T10:00:00Z');

      // Second prompt has no metadata - should get defaults
      expect(doc.prompts[1].id).toBeTruthy();
      expect(doc.prompts[1].metadata.status).toBe('queue');

      // Third prompt has partial metadata
      expect(doc.prompts[2].id).toBe('partial');
      expect(doc.prompts[2].metadata.status).toBe('queue');
    });

    it('handles completely empty string', () => {
      const doc = parse('');

      expect(doc.fileMetadata.version).toBe('2.0');
      expect(doc.sets).toHaveLength(0);
      expect(doc.sessions).toHaveLength(0);
      expect(doc.prompts).toHaveLength(0);
    });

    it('handles file with only whitespace', () => {
      const doc = parse('   \n\n   \n   ');

      expect(doc.prompts).toHaveLength(0);
    });

    it('preserves trailing newline information', () => {
      const withNewline = parse('content\n');
      const withoutNewline = parse('content');

      expect(withNewline.trailingNewline).toBe(true);
      expect(withoutNewline.trailingNewline).toBe(false);
    });
  });

  describe('serialize', () => {
    it('serializes document back to markdown with v2.0 headings', () => {
      const doc: PromptDocument = {
        fileMetadata: { version: '2.0', groups: {} },
        sets: [
          { id: 'set1', active: true, collapsed: false, created: '2024-01-01T00:00:00Z' },
        ],
        sessions: [],
        prompts: [
          {
            id: 'test1',
            content: 'First prompt',
            metadata: { id: 'test1', setId: 'set1', status: 'queue', created: '2024-01-01T00:00:00Z' },
          },
          {
            id: 'test2',
            content: 'Second prompt',
            metadata: { id: 'test2', setId: 'set1', status: 'active', created: '2024-01-02T00:00:00Z' },
          },
        ],
        trailingNewline: true,
      };

      const result = serialize(doc);

      expect(result).toContain('<!-- prompt-canvas:');
      expect(result).toContain('# '); // H1 heading for set
      expect(result).toContain('### '); // H3 heading for prompt
      expect(result).toContain('First prompt');
      expect(result).toContain('Second prompt');
      expect(result.endsWith('\n')).toBe(true);
    });

    it('serializes empty document', () => {
      const doc: PromptDocument = {
        fileMetadata: { version: '2.0', groups: {} },
        sets: [],
        sessions: [],
        prompts: [],
        trailingNewline: true,
      };

      const result = serialize(doc);

      expect(result).toContain('<!-- prompt-canvas:');
    });

    it('serializes sets with name in heading', () => {
      const doc: PromptDocument = {
        fileMetadata: {
          version: '2.0',
          groups: {},
        },
        sets: [
          { id: 'set1', name: 'Test Set', active: true, collapsed: false, created: '2024-01-01T00:00:00Z' },
        ],
        sessions: [],
        prompts: [
          {
            id: 'test1',
            content: 'Test prompt',
            metadata: { id: 'test1', setId: 'set1', status: 'queue', created: '2024-01-01T00:00:00Z' },
          },
        ],
        trailingNewline: true,
      };

      const result = serialize(doc);

      expect(result).toContain('# Test Set'); // H1 with set name
      expect(result).toContain('"set1"');
      expect(result).toContain('"active":true');
    });

    it('serializes sessions as H2 headings', () => {
      const doc: PromptDocument = {
        fileMetadata: { version: '2.0', groups: {} },
        sets: [
          { id: 'set1', name: 'My Set', active: true, collapsed: false, created: '2024-01-01T00:00:00Z' },
        ],
        sessions: [
          { id: 'sess1', name: 'My Session', setId: 'set1' },
        ],
        prompts: [
          {
            id: 'test1',
            content: 'Test prompt',
            metadata: { id: 'test1', setId: 'set1', sessionId: 'sess1', status: 'queue', created: '2024-01-01T00:00:00Z' },
          },
        ],
        trailingNewline: true,
      };

      const result = serialize(doc);

      expect(result).toContain('# My Set');
      expect(result).toContain('## My Session');
      expect(result).toContain('### ');
    });
  });

  describe('round-trip', () => {
    it('basic file round-trips correctly', () => {
      const original = loadFixture('basic.queue.md');
      const doc = parse(original);
      const serialized = serialize(doc);
      const reparsed = parse(serialized);

      expect(reparsed.prompts).toHaveLength(doc.prompts.length);
      reparsed.prompts.forEach((prompt, i) => {
        expect(prompt.id).toBe(doc.prompts[i].id);
        expect(prompt.content).toBe(doc.prompts[i].content);
        expect(prompt.metadata.status).toBe(doc.prompts[i].metadata.status);
      });
    });

    it('grouped file migrates to sets correctly', () => {
      const original = loadFixture('with-groups.queue.md');
      const doc = parse(original);
      const serialized = serialize(doc);
      const reparsed = parse(serialized);

      // Groups are migrated to sets in v2.0
      expect(reparsed.sets.length).toBeGreaterThan(0);
      expect(reparsed.prompts).toHaveLength(doc.prompts.length);
    });

    it('empty file round-trips correctly', () => {
      const original = loadFixture('empty.queue.md');
      const doc = parse(original);
      const serialized = serialize(doc);
      const reparsed = parse(serialized);

      expect(reparsed.prompts).toHaveLength(0);
      expect(reparsed.sets).toHaveLength(0);
      expect(reparsed.fileMetadata.version).toBe('2.0');
    });

    it('v2.0 file with sessions round-trips correctly', () => {
      const doc: PromptDocument = {
        fileMetadata: { version: '2.0', groups: {} },
        sets: [
          { id: 'set1', name: 'Test Set', active: true, collapsed: false, created: '2024-01-01T00:00:00Z' },
        ],
        sessions: [
          { id: 'sess1', name: 'Session One', setId: 'set1' },
        ],
        prompts: [
          {
            id: 'p1',
            content: 'First prompt',
            metadata: { id: 'p1', setId: 'set1', sessionId: 'sess1', status: 'queue', created: '2024-01-01T00:00:00Z' },
          },
          {
            id: 'p2',
            content: 'Second prompt',
            metadata: { id: 'p2', setId: 'set1', sessionId: 'sess1', status: 'active', created: '2024-01-02T00:00:00Z' },
          },
        ],
        trailingNewline: true,
      };

      const serialized = serialize(doc);
      const reparsed = parse(serialized);

      expect(reparsed.sets).toHaveLength(1);
      expect(reparsed.sets[0].name).toBe('Test Set');
      expect(reparsed.sessions).toHaveLength(1);
      expect(reparsed.sessions[0].name).toBe('Session One');
      expect(reparsed.prompts).toHaveLength(2);
      expect(reparsed.prompts[0].metadata.sessionId).toBe('sess1');
    });

    it('content headings are promoted and demoted correctly', () => {
      const doc: PromptDocument = {
        fileMetadata: { version: '2.0', groups: {} },
        sets: [
          { id: 'set1', active: true, collapsed: false, created: '2024-01-01T00:00:00Z' },
        ],
        sessions: [],
        prompts: [
          {
            id: 'p1',
            content: '# Step 1\nDo something\n\n## Sub-step\nMore details\n\n### Notes\nFinal notes',
            metadata: { id: 'p1', setId: 'set1', status: 'queue', created: '2024-01-01T00:00:00Z' },
          },
        ],
        trailingNewline: true,
      };

      const serialized = serialize(doc);

      // In file, H1/H2/H3 in content should be promoted to H4/H5/H6
      expect(serialized).toContain('#### Step 1');
      expect(serialized).toContain('##### Sub-step');
      expect(serialized).toContain('###### Notes');

      // After parsing, they should be demoted back
      const reparsed = parse(serialized);
      expect(reparsed.prompts[0].content).toContain('# Step 1');
      expect(reparsed.prompts[0].content).toContain('## Sub-step');
      expect(reparsed.prompts[0].content).toContain('### Notes');
    });
  });
});
