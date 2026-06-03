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
  MANIFEST_USER_HEADING,
  MANIFEST_CLAUDE_HEADING,
  MANIFEST_TRAILING_INSTRUCTION,
  INLINE_TEXT_THRESHOLD_BYTES,
} from '../src/constants.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURE_DIR = join(__dirname, 'fixtures');

function loadConversation(name) {
  return normalize(JSON.parse(readFileSync(join(FIXTURE_DIR, name), 'utf8')));
}

function makeConv(messages, extra = {}) {
  return { uuid: 'test', title: 'test', messages, ...extra };
}

function userMsg(uuid, text, attachments = []) {
  return { uuid, sender: 'user', text, attachments, artifacts: [] };
}

function claudeMsg(uuid, text, artifacts = []) {
  return { uuid, sender: 'claude', text, attachments: [], artifacts };
}

function artifact(name, kind = 'text') {
  return { uuid: `art-${name}`, name, kind, sizeBytes: null };
}

function textAttachment(name, content, sizeBytes = content.length) {
  return { uuid: `att-${name}`, name, kind: 'text', extractedContent: content, sizeBytes };
}

describe('TranscriptBuilder — empty conversation', () => {
  it('returns framing + opening splitter only', () => {
    const out = build({ messages: [] });
    expect(out).toContain(FRAMING);
    expect(out).toContain(OPENING_SPLITTER);
    expect(out).not.toContain('User Prompt');
    expect(out).not.toContain('Claude Response');
  });

  it('handles null conversation without throwing', () => {
    expect(() => build(null)).not.toThrow();
  });

  it('handles a conversation with only a user message (no claude response yet)', () => {
    const conv = makeConv([userMsg('u1', 'just opened a new chat')]);
    const out = build(conv);
    expect(out).toContain('User Prompt 1:');
    expect(out).toContain('just opened a new chat');
    expect(out).not.toContain('Claude Response');
  });

  it('builds a 100-turn conversation without truncation', () => {
    const messages = [];
    for (let i = 0; i < 50; i++) {
      messages.push(userMsg(`u${i}`, `question ${i}`));
      messages.push(claudeMsg(`c${i}`, `answer ${i}`));
    }
    const conv = makeConv(messages);
    const out = build(conv);
    expect(out).toContain('User Prompt 1:');
    expect(out).toContain('User Prompt 50:');
    expect(out).toContain('Claude Response to User Prompt 50:');
    expect(out).toContain('question 49');
    expect(out).toContain('answer 49');
  });

  it('renders manifest when slice point is the first message and it carries attachments', () => {
    const conv = makeConv([
      userMsg('u1', 'first prompt', [
        { uuid: 'i', name: 'pic.png', kind: 'image', extractedContent: null, sizeBytes: 1000 },
      ]),
      claudeMsg('c1', 'response'),
    ]);
    const out = build(conv, 'u1');
    expect(out).toContain(MANIFEST_USER_HEADING);
    expect(out).toContain('`pic.png` (image)');
    expect(out).toContain('User Prompt 1:');
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
    expect(out).not.toContain(MANIFEST_USER_HEADING);
    expect(out).not.toContain(MANIFEST_TRAILING_INSTRUCTION);
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

describe('TranscriptBuilder — small text attachments inline', () => {
  it('inlines a small text attachment under its user turn as a fenced code block', () => {
    const conv = makeConv([
      userMsg('u1', 'review this snippet', [textAttachment('notes.md', 'small content')]),
      claudeMsg('c1', 'sure'),
    ]);
    const out = build(conv);
    expect(out).toContain('Attached file: notes.md');
    expect(out).toContain('```markdown');
    expect(out).toContain('small content');
    expect(out).toContain('```');
    expect(out).not.toContain(MANIFEST_USER_HEADING);
  });

  it('picks a fence language hint when one is known, otherwise leaves it blank', () => {
    const conv = makeConv([
      userMsg('u1', 'snippet', [
        textAttachment('script.py', 'print("hi")'),
        textAttachment('data.json', '{"a":1}'),
        textAttachment('something.weirdext', 'plain text'),
      ]),
    ]);
    const out = build(conv);
    expect(out).toContain('```python');
    expect(out).toContain('```json');
    expect(out).toContain('```\nplain text');
  });

  it('keeps the attachment with its turn and never adds it to the manifest', () => {
    const conv = makeConv([
      userMsg('u1', 'turn one', [textAttachment('a.md', 'aaa')]),
      claudeMsg('c1', 'ok'),
      userMsg('u2', 'turn two', []),
      claudeMsg('c2', 'great'),
    ]);
    const out = build(conv);
    const turnOneIdx = out.indexOf('User Prompt 1:');
    const turnTwoIdx = out.indexOf('User Prompt 2:');
    const attachmentIdx = out.indexOf('Attached file: a.md');
    expect(attachmentIdx).toBeGreaterThan(turnOneIdx);
    expect(attachmentIdx).toBeLessThan(turnTwoIdx);
    expect(out).not.toContain(MANIFEST_USER_HEADING);
  });
});

describe('TranscriptBuilder — large text attachments go to manifest', () => {
  it('lists large text attachments in the top manifest with a (file) indicator and omits their contents', () => {
    const huge = 'x'.repeat(INLINE_TEXT_THRESHOLD_BYTES + 1);
    const conv = makeConv([
      userMsg('u1', 'review', [textAttachment('big.md', huge)]),
      claudeMsg('c1', 'ok'),
    ]);
    const out = build(conv);
    expect(out).toContain(MANIFEST_USER_HEADING);
    expect(out).toContain('`big.md` (file)');
    expect(out).not.toContain('Attached file: big.md');
    expect(out).not.toContain(huge);
  });

  it('puts the manifest before the first OPENING_SPLITTER', () => {
    const huge = 'x'.repeat(INLINE_TEXT_THRESHOLD_BYTES + 1);
    const conv = makeConv([
      userMsg('u1', 'q', [textAttachment('big.md', huge)]),
    ]);
    const out = build(conv);
    expect(out.indexOf(MANIFEST_USER_HEADING)).toBeGreaterThan(0);
    expect(out.indexOf(MANIFEST_USER_HEADING)).toBeLessThan(out.indexOf(OPENING_SPLITTER));
  });

  it('renders the trailing instruction exactly once even with multiple large attachments', () => {
    const huge = 'x'.repeat(INLINE_TEXT_THRESHOLD_BYTES + 1);
    const conv = makeConv([
      userMsg('u1', 'q1', [
        textAttachment('big1.md', huge),
        textAttachment('big2.md', huge),
      ]),
      claudeMsg('c1', 'a1'),
      userMsg('u2', 'q2', [textAttachment('big3.md', huge)]),
    ]);
    const out = build(conv);
    const instructionMatches = out.match(
      new RegExp(
        MANIFEST_TRAILING_INSTRUCTION.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
        'g',
      ),
    );
    expect(instructionMatches).toHaveLength(1);
  });
});

describe('TranscriptBuilder — threshold boundary', () => {
  it('inlines a text attachment exactly at the threshold size', () => {
    const exact = 'a'.repeat(INLINE_TEXT_THRESHOLD_BYTES);
    const conv = makeConv([
      userMsg('u1', 'edge case', [textAttachment('edge.md', exact)]),
    ]);
    const out = build(conv);
    expect(out).toContain('Attached file: edge.md');
    expect(out).not.toContain(MANIFEST_USER_HEADING);
  });

  it('moves a text attachment one byte over the threshold to the manifest', () => {
    const over = 'a'.repeat(INLINE_TEXT_THRESHOLD_BYTES + 1);
    const conv = makeConv([
      userMsg('u1', 'over', [textAttachment('big.md', over)]),
    ]);
    const out = build(conv);
    expect(out).not.toContain('Attached file: big.md');
    expect(out).toContain('`big.md` (file)');
  });

  it('respects a custom threshold passed via config', () => {
    const conv = makeConv([
      userMsg('u1', 'q', [textAttachment('mid.md', 'a'.repeat(500))]),
    ]);
    const inlinedOut = build(conv, undefined, { inlineTextThresholdBytes: 1000 });
    expect(inlinedOut).toContain('Attached file: mid.md');

    const manifestedOut = build(conv, undefined, { inlineTextThresholdBytes: 100 });
    expect(manifestedOut).toContain('`mid.md` (file)');
    expect(manifestedOut).not.toContain('Attached file: mid.md');
  });
});

describe('TranscriptBuilder — mixed small and large in one conversation', () => {
  const huge = 'x'.repeat(INLINE_TEXT_THRESHOLD_BYTES + 1);
  const conv = makeConv([
    userMsg('u1', 'q1', [
      textAttachment('small.md', 'tiny'),
      textAttachment('big.md', huge),
    ]),
    claudeMsg('c1', 'a1'),
  ]);
  const out = build(conv);

  it('inlines the small attachment at its turn', () => {
    expect(out).toContain('Attached file: small.md');
    expect(out).toContain('tiny');
  });

  it('lists the large attachment in the manifest', () => {
    expect(out).toContain('`big.md` (file)');
  });

  it('renders the manifest header exactly once', () => {
    const matches = out.match(new RegExp(MANIFEST_USER_HEADING, 'g'));
    expect(matches).toHaveLength(1);
  });

  it('does not inline the large attachment content', () => {
    expect(out).not.toContain(huge);
    expect(out).not.toContain('Attached file: big.md');
  });
});

describe('TranscriptBuilder — text attachments with no extracted content', () => {
  it('lists kind=text attachments that lack extractedContent in the manifest', () => {
    const conv = makeConv([
      userMsg('u1', 'see file', [
        { uuid: 'a', name: 'notes.md', kind: 'text', extractedContent: null, sizeBytes: 4096 },
      ]),
    ]);
    const out = build(conv);
    expect(out).toContain('`notes.md` (file)');
    expect(out).not.toContain('Attached file: notes.md');
  });
});

describe('TranscriptBuilder — image attachments go to manifest', () => {
  it('lists an image with an (image) indicator in the manifest', () => {
    const conv = makeConv([
      userMsg('u1', 'look at this', [
        { uuid: 'i', name: 'pic.png', kind: 'image', extractedContent: null, sizeBytes: 1000 },
      ]),
    ]);
    const out = build(conv);
    expect(out).toContain(MANIFEST_USER_HEADING);
    expect(out).toContain('`pic.png` (image)');
  });

  it('never inlines an image, regardless of size', () => {
    const conv = makeConv([
      userMsg('u1', 'tiny pic', [
        { uuid: 'i', name: 'tiny.png', kind: 'image', extractedContent: null, sizeBytes: 100 },
      ]),
    ]);
    const out = build(conv);
    expect(out).not.toContain('Attached file: tiny.png');
    expect(out).not.toContain('```');
  });
});

describe('TranscriptBuilder — binary attachments go to manifest', () => {
  it('lists a PDF with a (file) indicator in the manifest', () => {
    const conv = makeConv([
      userMsg('u1', 'read this', [
        { uuid: 'b', name: 'doc.pdf', kind: 'binary', extractedContent: null, sizeBytes: 5000 },
      ]),
    ]);
    const out = build(conv);
    expect(out).toContain(MANIFEST_USER_HEADING);
    expect(out).toContain('`doc.pdf` (file)');
  });

  it('never inlines a binary attachment', () => {
    const conv = makeConv([
      userMsg('u1', 'binary', [
        { uuid: 'b', name: 'data.bin', kind: 'binary', extractedContent: null, sizeBytes: 50 },
      ]),
    ]);
    const out = build(conv);
    expect(out).not.toContain('Attached file: data.bin');
    expect(out).not.toContain('```');
  });
});

describe('TranscriptBuilder — mixed image, binary, and text attachments', () => {
  const huge = 'x'.repeat(INLINE_TEXT_THRESHOLD_BYTES + 1);
  const conv = makeConv([
    userMsg('u1', 'mixed', [
      { uuid: 'i', name: 'photo.jpg', kind: 'image', extractedContent: null, sizeBytes: 2000 },
      { uuid: 'b', name: 'manual.pdf', kind: 'binary', extractedContent: null, sizeBytes: 5000 },
      textAttachment('snippet.md', 'tiny snippet'),
      textAttachment('giant.md', huge),
    ]),
    claudeMsg('c1', 'ok'),
  ]);
  const out = build(conv);

  it('inlines only the small text attachment', () => {
    expect(out).toContain('Attached file: snippet.md');
    expect(out).toContain('tiny snippet');
  });

  it('lists image, binary, and large text in one manifest sub-section', () => {
    expect(out).toContain('`photo.jpg` (image)');
    expect(out).toContain('`manual.pdf` (file)');
    expect(out).toContain('`giant.md` (file)');
  });

  it('renders a single Files I attached: header', () => {
    const matches = out.match(new RegExp(MANIFEST_USER_HEADING, 'g'));
    expect(matches).toHaveLength(1);
  });

  it('renders the trailing instruction exactly once', () => {
    const matches = out.match(
      new RegExp(
        MANIFEST_TRAILING_INSTRUCTION.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
        'g',
      ),
    );
    expect(matches).toHaveLength(1);
  });

  it('preserves encounter order within the manifest list', () => {
    const photoIdx = out.indexOf('`photo.jpg`');
    const manualIdx = out.indexOf('`manual.pdf`');
    const giantIdx = out.indexOf('`giant.md`');
    expect(photoIdx).toBeLessThan(manualIdx);
    expect(manualIdx).toBeLessThan(giantIdx);
  });
});

describe('TranscriptBuilder — Claude artifacts in manifest', () => {
  it('lists a single Claude artifact in the "Files you (Claude) generated" sub-section with (file)', () => {
    const conv = makeConv([
      userMsg('u1', 'make a counter component'),
      claudeMsg('c1', 'here it is', [artifact('Counter.tsx')]),
    ]);
    const out = build(conv);
    expect(out).toContain(MANIFEST_CLAUDE_HEADING);
    expect(out).toContain('`Counter.tsx` (file)');
  });

  it('never inlines artifact contents', () => {
    const conv = makeConv([
      userMsg('u1', 'q'),
      claudeMsg('c1', 'see file', [artifact('readme.md')]),
    ]);
    const out = build(conv);
    expect(out).not.toContain('Attached file: readme.md');
    expect(out).not.toContain('```markdown');
  });

  it('uses (file) for all artifact kinds, including images', () => {
    const conv = makeConv([
      userMsg('u1', 'q'),
      claudeMsg('c1', 'here', [artifact('chart.png', 'image')]),
    ]);
    const out = build(conv);
    expect(out).toContain('`chart.png` (file)');
    expect(out).not.toContain('(image)');
  });

  it('preserves order across multiple artifacts in one message', () => {
    const conv = makeConv([
      userMsg('u1', 'q'),
      claudeMsg('c1', 'three files', [
        artifact('first.js'),
        artifact('second.js'),
        artifact('third.js'),
      ]),
    ]);
    const out = build(conv);
    const first = out.indexOf('`first.js`');
    const second = out.indexOf('`second.js`');
    const third = out.indexOf('`third.js`');
    expect(first).toBeLessThan(second);
    expect(second).toBeLessThan(third);
  });

  it('preserves order across messages and within messages', () => {
    const conv = makeConv([
      userMsg('u1', 'q1'),
      claudeMsg('c1', 'a1', [artifact('a.js'), artifact('b.js')]),
      userMsg('u2', 'q2'),
      claudeMsg('c2', 'a2', [artifact('c.js')]),
    ]);
    const out = build(conv);
    const aIdx = out.indexOf('`a.js`');
    const bIdx = out.indexOf('`b.js`');
    const cIdx = out.indexOf('`c.js`');
    expect(aIdx).toBeLessThan(bIdx);
    expect(bIdx).toBeLessThan(cIdx);
  });

  it('renders both manifest sub-sections when user attachments and Claude artifacts coexist', () => {
    const conv = makeConv([
      userMsg('u1', 'q', [
        { uuid: 'i', name: 'pic.png', kind: 'image', extractedContent: null, sizeBytes: 1000 },
      ]),
      claudeMsg('c1', 'a', [artifact('out.html')]),
    ]);
    const out = build(conv);
    expect(out).toContain(MANIFEST_USER_HEADING);
    expect(out).toContain(MANIFEST_CLAUDE_HEADING);
    expect(out).toContain('`pic.png` (image)');
    expect(out).toContain('`out.html` (file)');
  });

  it('renders the trailing instruction once across both sub-sections', () => {
    const conv = makeConv([
      userMsg('u1', 'q', [
        { uuid: 'i', name: 'pic.png', kind: 'image', extractedContent: null, sizeBytes: 1000 },
      ]),
      claudeMsg('c1', 'a', [artifact('out.html'), artifact('readme.md')]),
    ]);
    const out = build(conv);
    const matches = out.match(
      new RegExp(
        MANIFEST_TRAILING_INSTRUCTION.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
        'g',
      ),
    );
    expect(matches).toHaveLength(1);
  });

  it('orders the user sub-section before the Claude sub-section', () => {
    const conv = makeConv([
      userMsg('u1', 'q', [
        { uuid: 'i', name: 'pic.png', kind: 'image', extractedContent: null, sizeBytes: 1000 },
      ]),
      claudeMsg('c1', 'a', [artifact('out.html')]),
    ]);
    const out = build(conv);
    expect(out.indexOf(MANIFEST_USER_HEADING)).toBeLessThan(
      out.indexOf(MANIFEST_CLAUDE_HEADING),
    );
  });

  it('omits the manifest entirely when no attachments and no artifacts exist', () => {
    const conv = makeConv([
      userMsg('u1', 'just talk'),
      claudeMsg('c1', 'sure'),
    ]);
    const out = build(conv);
    expect(out).not.toContain(MANIFEST_USER_HEADING);
    expect(out).not.toContain(MANIFEST_CLAUDE_HEADING);
    expect(out).not.toContain(MANIFEST_TRAILING_INSTRUCTION);
  });
});

describe('TranscriptBuilder — drop-rule regression (slice 04 contract)', () => {
  it('does not leak tool_use, tool_result, or thinking content into the transcript', () => {
    const conv = loadConversation('conv-with-attachments.json');
    const out = build(conv);
    expect(out).not.toMatch(/<thinking>/i);
    expect(out).not.toMatch(/"tool_use"/);
    expect(out).not.toMatch(/"tool_result"/);
  });
});

describe('TranscriptBuilder — artifact fixture', () => {
  const conv = loadConversation('conv-with-artifact.json');
  const out = build(conv);

  it('lists each Claude-generated file in the manifest', () => {
    expect(out).toContain(MANIFEST_CLAUDE_HEADING);
    expect(out).toContain('`slide-2.jpg` (file)');
    expect(out).toContain('`slide-3.jpg` (file)');
  });

  it('does not inline any artifact content', () => {
    expect(out).not.toContain('Attached file: slide-2.jpg');
    expect(out).not.toContain('Attached file: slide-3.jpg');
  });
});

describe('TranscriptBuilder — attachments fixture', () => {
  const conv = loadConversation('conv-with-attachments.json');
  const out = build(conv);

  it('inlines the small pasted text attachment under its turn', () => {
    expect(out).toMatch(/Attached (file|content)/);
  });

  it('lists the .md file that has no extracted content in the manifest', () => {
    expect(out).toContain('INGESTION_LOG');
    expect(out).toContain(MANIFEST_USER_HEADING);
  });

  it('lists the image attachment with an (image) indicator', () => {
    expect(out).toMatch(/`.*image.*\.png` \(image\)/);
  });

  it('lists the pdf attachment with a (file) indicator', () => {
    expect(out).toMatch(/`.*book\.pdf` \(file\)/);
  });
});
