import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { normalize, ConversationParseError } from '../src/conversationClient.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURE_DIR = join(__dirname, 'fixtures');

function loadFixture(name) {
  return JSON.parse(readFileSync(join(FIXTURE_DIR, name), 'utf8'));
}

describe('ConversationClient — normalize text-only fixture', () => {
  const conv = normalize(loadFixture('conv-text-only.json'));

  it('returns conversation metadata', () => {
    expect(conv.uuid).toBeTruthy();
    expect(conv.title).toBe('FC 26 local multiplayer setup guide');
  });

  it('orders messages from root to leaf alternating user/claude', () => {
    expect(conv.messages).toHaveLength(4);
    expect(conv.messages.map((m) => m.sender)).toEqual([
      'user',
      'claude',
      'user',
      'claude',
    ]);
  });

  it('extracts text content for each turn', () => {
    expect(conv.messages[0].text).toMatch(/Fc26/);
    expect(conv.messages[1].text).toMatch(/local 2-player/);
    expect(conv.messages[3].text).toMatch(/shooting/i);
  });

  it('has empty attachments and artifacts arrays on every message', () => {
    for (const m of conv.messages) {
      expect(m.attachments).toEqual([]);
      expect(m.artifacts).toEqual([]);
    }
  });
});

describe('ConversationClient — normalize attachments fixture', () => {
  const conv = normalize(loadFixture('conv-with-attachments.json'));

  it('classifies user attachments by kind', () => {
    const userWithAttachments = conv.messages.find((m) => m.attachments.length);
    expect(userWithAttachments).toBeDefined();
    const kinds = userWithAttachments.attachments.map((a) => a.kind).sort();
    expect(kinds).toEqual(['binary', 'image', 'text', 'text']);
  });

  it('captures extracted_content for paste-as-attachment', () => {
    const userWithAttachments = conv.messages.find((m) => m.attachments.length);
    const pasted = userWithAttachments.attachments.find(
      (a) => a.kind === 'text' && a.name === '',
    );
    expect(pasted).toBeDefined();
    expect(pasted.extractedContent).toBeTruthy();
  });

  it('strips assistant thinking and tool blocks from text output', () => {
    const assistantWithThinking = conv.messages.find(
      (m) => m.sender === 'claude' && m.text.length,
    );
    expect(assistantWithThinking.text).not.toMatch(/<thinking>/i);
  });
});

describe('ConversationClient — normalize artifacts fixture', () => {
  const conv = normalize(loadFixture('conv-with-artifact.json'));

  it('captures claude-generated files as artifacts', () => {
    const claudeWithArtifacts = conv.messages.find(
      (m) => m.sender === 'claude' && m.artifacts.length,
    );
    expect(claudeWithArtifacts).toBeDefined();
    expect(claudeWithArtifacts.artifacts.length).toBeGreaterThan(0);
    for (const a of claudeWithArtifacts.artifacts) {
      expect(['text', 'image', 'binary']).toContain(a.kind);
    }
  });
});

describe('ConversationClient — error handling', () => {
  it('throws ConversationParseError on null input', () => {
    expect(() => normalize(null)).toThrow(ConversationParseError);
  });

  it('throws ConversationParseError when chat_messages is missing', () => {
    expect(() => normalize({ uuid: 'x' })).toThrow(ConversationParseError);
  });

  it('tolerates unknown top-level fields', () => {
    const conv = normalize({
      uuid: 'abc',
      name: 'T',
      unknown_future_field: { nested: true },
      chat_messages: [],
      current_leaf_message_uuid: null,
    });
    expect(conv.messages).toEqual([]);
  });
});
