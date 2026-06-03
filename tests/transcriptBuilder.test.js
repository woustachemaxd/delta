import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { normalize } from '../src/conversationClient.js';
import { build } from '../src/transcriptBuilder.js';
import {
  FRAMING,
  OPENING_SPLITTER,
  SPLITTER,
} from '../src/constants.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURE_DIR = join(__dirname, 'fixtures');

function loadConversation(name) {
  return normalize(JSON.parse(readFileSync(join(FIXTURE_DIR, name), 'utf8')));
}

describe('TranscriptBuilder — empty conversation', () => {
  it('returns framing + opening splitter only', () => {
    const out = build({ messages: [] });
    expect(out).toContain(FRAMING);
    expect(out).toContain(OPENING_SPLITTER);
    expect(out).not.toContain('User Prompt');
    expect(out).not.toContain('Claude Response');
  });
});

describe('TranscriptBuilder — text-only fixture, full slice', () => {
  const conv = loadConversation('conv-text-only.json');
  const leaf = conv.messages[conv.messages.length - 1];
  const out = build(conv, leaf.uuid);

  it('starts with the framing paragraph', () => {
    expect(out.startsWith(FRAMING)).toBe(true);
  });

  it('labels each turn correctly', () => {
    expect(out).toContain('User Prompt 1:');
    expect(out).toContain('Claude Response to User Prompt 1:');
    expect(out).toContain('User Prompt 2:');
    expect(out).toContain('Claude Response to User Prompt 2:');
  });

  it('uses opening splitter before each user prompt', () => {
    const openings = out.match(new RegExp(OPENING_SPLITTER, 'g'));
    expect(openings).toHaveLength(2);
  });

  it('uses inner splitter between user and claude within a turn', () => {
    const inner = out.match(new RegExp(SPLITTER, 'g'));
    expect(inner).toHaveLength(2);
  });

  it('preserves verbatim message text', () => {
    expect(out).toContain('Fc26 how to play first game w friend ps5 2 controllers');
    expect(out).toContain('For local 2-player on one PS5');
  });

  it('omits the file manifest when both user attachments and claude artifacts are empty', () => {
    expect(out).not.toContain('Files I attached');
    expect(out).not.toContain('Files you (Claude) generated');
  });
});

describe('TranscriptBuilder — slice at a specific message', () => {
  const conv = loadConversation('conv-text-only.json');
  const firstClaudeMsg = conv.messages.find((m) => m.sender === 'claude');
  const out = build(conv, firstClaudeMsg.uuid);

  it('includes the first turn pair', () => {
    expect(out).toContain('User Prompt 1:');
    expect(out).toContain('Claude Response to User Prompt 1:');
  });

  it('omits later turns', () => {
    expect(out).not.toContain('User Prompt 2:');
    expect(out).not.toContain('Claude Response to User Prompt 2:');
  });
});

describe('TranscriptBuilder — defaults to last message when uuid is missing', () => {
  const conv = loadConversation('conv-text-only.json');
  it('uses the leaf when sliceAtMessageUuid is undefined', () => {
    const out = build(conv);
    expect(out).toContain('User Prompt 2:');
    expect(out).toContain('Claude Response to User Prompt 2:');
  });

  it('uses the leaf when sliceAtMessageUuid does not match any message', () => {
    const out = build(conv, 'no-such-uuid');
    expect(out).toContain('Claude Response to User Prompt 2:');
  });
});
