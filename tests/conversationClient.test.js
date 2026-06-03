import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  normalize,
  createConversationClient,
  ConversationParseError,
  ConversationApiError,
} from '../src/conversationClient.js';

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

  it('throws ConversationParseError when chat_messages is the wrong type', () => {
    expect(() => normalize({ chat_messages: 'not-an-array' })).toThrow(ConversationParseError);
  });

  it('tolerates messages with missing content arrays', () => {
    const conv = normalize({
      uuid: 'x',
      chat_messages: [
        { uuid: 'm1', sender: 'human', parent_message_uuid: '00000000-0000-4000-8000-000000000000', content: null },
      ],
      current_leaf_message_uuid: 'm1',
    });
    expect(conv.messages[0].text).toBe('');
  });
});

function mockFetch(handler) {
  return vi.fn(async (url, opts) => handler(url, opts));
}

describe('ConversationClient — no third-party hosts', () => {
  it('only ever issues requests to relative paths (i.e. claude.ai per manifest matches)', async () => {
    const seenUrls = [];
    const client = createConversationClient({
      fetch: vi.fn(async (url) => {
        seenUrls.push(url);
        if (url === '/api/organizations') return jsonResponse(200, [{ uuid: 'org-a' }]);
        return jsonResponse(200, {
          uuid: 'c',
          name: '',
          chat_messages: [],
          current_leaf_message_uuid: null,
        });
      }),
    });
    await client.fetchConversation('conv-x');
    for (const url of seenUrls) {
      expect(url).toMatch(/^\//);
      expect(url).not.toMatch(/^https?:/);
    }
  });
});

function jsonResponse(status, body) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  };
}

describe('ConversationClient — HTTP error variants', () => {
  it('surfaces 401 as a human-readable session-expired message', async () => {
    const client = createConversationClient({
      fetch: mockFetch(async (url) => {
        if (url === '/api/organizations') return jsonResponse(401, {});
        throw new Error('unexpected url');
      }),
    });
    await expect(client.fetchConversation('any')).rejects.toThrow(/session expired/i);
  });

  it('surfaces 5xx as a human-readable retry message', async () => {
    const client = createConversationClient({
      fetch: mockFetch(async () => jsonResponse(503, {})),
    });
    await expect(client.fetchConversation('any')).rejects.toThrow(/Try again/i);
  });

  it('surfaces network failure with a connection message', async () => {
    const client = createConversationClient({
      fetch: vi.fn(async () => {
        throw new TypeError('Failed to fetch');
      }),
    });
    await expect(client.fetchConversation('any')).rejects.toThrow(/network|reach claude/i);
  });

  it('surfaces malformed JSON from the org list as a typed error', async () => {
    const client = createConversationClient({
      fetch: mockFetch(async () => ({
        ok: true,
        status: 200,
        json: async () => {
          throw new SyntaxError('bad json');
        },
      })),
    });
    await expect(client.fetchConversation('any')).rejects.toThrow(ConversationApiError);
  });

  it('walks all orgs on 404, throwing a single not-found error after exhaustion', async () => {
    let callCount = 0;
    const client = createConversationClient({
      fetch: mockFetch(async (url) => {
        if (url === '/api/organizations') {
          return jsonResponse(200, [{ uuid: 'org-a' }, { uuid: 'org-b' }]);
        }
        callCount += 1;
        return jsonResponse(404, {});
      }),
    });
    await expect(client.fetchConversation('conv-x')).rejects.toThrow(/no longer exists|isn't in any/i);
    expect(callCount).toBe(2);
  });

  it('returns the conversation when one org of many succeeds', async () => {
    const client = createConversationClient({
      fetch: mockFetch(async (url) => {
        if (url === '/api/organizations') {
          return jsonResponse(200, [{ uuid: 'org-a' }, { uuid: 'org-b' }]);
        }
        if (url.includes('/org-b/')) {
          return jsonResponse(200, {
            uuid: 'conv-x',
            name: 'hit',
            chat_messages: [],
            current_leaf_message_uuid: null,
          });
        }
        return jsonResponse(404, {});
      }),
    });
    const conv = await client.fetchConversation('conv-x');
    expect(conv.title).toBe('hit');
  });
});
