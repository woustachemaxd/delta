import { API, ROOT_PARENT_UUID } from './constants.js';

export class ConversationApiError extends Error {
  constructor(message, cause) {
    super(message);
    this.name = 'ConversationApiError';
    if (cause) this.cause = cause;
  }
}

export class ConversationParseError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ConversationParseError';
  }
}

const TEXT_EXTENSIONS = new Set([
  'txt', 'md', 'markdown', 'rst', 'log', 'csv', 'tsv',
  'js', 'jsx', 'mjs', 'cjs', 'ts', 'tsx', 'json', 'jsonc',
  'py', 'rb', 'go', 'rs', 'java', 'kt', 'swift', 'scala', 'php',
  'c', 'cc', 'cpp', 'h', 'hpp', 'cs',
  'html', 'htm', 'xml', 'svg', 'css', 'scss', 'sass', 'less',
  'sh', 'bash', 'zsh', 'fish',
  'yml', 'yaml', 'toml', 'ini', 'conf', 'env',
  'sql', 'graphql', 'proto',
]);

function classifyByExtension(fileName) {
  if (!fileName) return 'binary';
  const ext = fileName.split('.').pop()?.toLowerCase();
  return TEXT_EXTENSIONS.has(ext) ? 'text' : 'binary';
}

function normalizeUserAttachments(rawAttachments = [], rawFiles = []) {
  const result = [];
  const consumed = new Set();

  for (const file of rawFiles) {
    const matchIdx = file.file_name
      ? rawAttachments.findIndex(
          (a, i) => !consumed.has(i) && a.file_name && a.file_name === file.file_name,
        )
      : -1;

    let kind;
    let extractedContent = null;
    if (file.file_kind === 'image') {
      kind = 'image';
    } else if (matchIdx >= 0) {
      kind = 'text';
      extractedContent = rawAttachments[matchIdx].extracted_content ?? null;
      consumed.add(matchIdx);
    } else {
      kind = classifyByExtension(file.file_name);
    }

    result.push({
      uuid: file.file_uuid || file.uuid || null,
      name: file.file_name || '',
      sizeBytes: file.size_bytes ?? null,
      kind,
      extractedContent,
    });
  }

  for (let i = 0; i < rawAttachments.length; i++) {
    if (consumed.has(i)) continue;
    const a = rawAttachments[i];
    result.push({
      uuid: a.id || null,
      name: a.file_name || '',
      sizeBytes: a.file_size ?? null,
      kind: 'text',
      extractedContent: a.extracted_content ?? null,
    });
  }

  return result;
}

function normalizeArtifacts(rawFiles = []) {
  return rawFiles.map((file) => ({
    uuid: file.file_uuid || file.uuid || null,
    name: file.file_name || '',
    sizeBytes: file.size_bytes ?? null,
    kind: file.file_kind === 'image' ? 'image' : classifyByExtension(file.file_name),
  }));
}

function extractText(content) {
  if (!Array.isArray(content)) return '';
  return content
    .filter((b) => b && b.type === 'text' && typeof b.text === 'string')
    .map((b) => b.text)
    .join('\n\n');
}

export function normalize(raw) {
  if (!raw || typeof raw !== 'object') {
    throw new ConversationParseError('Response is not an object');
  }
  if (!Array.isArray(raw.chat_messages)) {
    throw new ConversationParseError('Missing chat_messages array');
  }

  const byUuid = new Map();
  for (const m of raw.chat_messages) {
    if (m && m.uuid) byUuid.set(m.uuid, m);
  }

  let ordered;
  const leafUuid = raw.current_leaf_message_uuid;
  if (leafUuid && byUuid.has(leafUuid)) {
    ordered = [];
    const seen = new Set();
    let cursor = byUuid.get(leafUuid);
    while (cursor && !seen.has(cursor.uuid)) {
      seen.add(cursor.uuid);
      ordered.unshift(cursor);
      if (cursor.parent_message_uuid === ROOT_PARENT_UUID) break;
      cursor = byUuid.get(cursor.parent_message_uuid);
    }
  } else {
    ordered = raw.chat_messages.filter((m) => m && m.uuid);
  }

  const messages = ordered.map((m) => ({
    uuid: m.uuid,
    sender: m.sender === 'human' ? 'user' : 'claude',
    text: extractText(m.content),
    attachments:
      m.sender === 'human'
        ? normalizeUserAttachments(m.attachments, m.files)
        : [],
    artifacts:
      m.sender === 'assistant' ? normalizeArtifacts(m.files) : [],
  }));

  return {
    uuid: raw.uuid || null,
    title: raw.name || '',
    messages,
  };
}

function humanMessageForStatus(status, context) {
  if (status === 401) {
    return 'Your Claude session expired. Reload claude.ai and try again.';
  }
  if (status === 403) {
    return 'This conversation belongs to an organization your session can\'t access.';
  }
  if (status === 404) {
    return context === 'conversation'
      ? 'This conversation no longer exists or isn\'t in any of your organizations.'
      : 'Claude returned 404 for the organization list.';
  }
  if (status >= 500 && status < 600) {
    return `Claude's API returned ${status}. Try again in a moment.`;
  }
  return `Request failed with status ${status}.`;
}

async function safeFetch(fetchImpl, url, opts) {
  try {
    return await fetchImpl(url, opts);
  } catch (err) {
    throw new ConversationApiError(
      "Couldn't reach claude.ai. Check your network connection.",
      err,
    );
  }
}

async function safeJson(res, context) {
  try {
    return await res.json();
  } catch (err) {
    throw new ConversationApiError(
      `Claude returned a non-JSON ${context} response.`,
      err,
    );
  }
}

export function createConversationClient({ fetch = globalThis.fetch?.bind(globalThis) } = {}) {
  let cachedOrgIds = null;
  let preferredOrgId = null;

  async function getOrgIds() {
    if (cachedOrgIds) return cachedOrgIds;
    const res = await safeFetch(fetch, API.ORGS, { credentials: 'include' });
    if (!res.ok) {
      throw new ConversationApiError(humanMessageForStatus(res.status, 'organizations'));
    }
    const data = await safeJson(res, 'organizations');
    if (!Array.isArray(data) || data.length === 0) {
      throw new ConversationApiError('Your account isn\'t in any organizations.');
    }
    cachedOrgIds = data.map((o) => o?.uuid).filter(Boolean);
    if (cachedOrgIds.length === 0) {
      throw new ConversationApiError('No organization had a uuid in the response.');
    }
    return cachedOrgIds;
  }

  async function fetchConversation(convUuid) {
    const orgIds = await getOrgIds();
    const ordered = preferredOrgId
      ? [preferredOrgId, ...orgIds.filter((id) => id !== preferredOrgId)]
      : orgIds;

    let lastStatus = null;
    for (const orgId of ordered) {
      const res = await safeFetch(fetch, API.conversation(orgId, convUuid), {
        credentials: 'include',
      });
      if (res.ok) {
        preferredOrgId = orgId;
        const raw = await safeJson(res, 'conversation');
        return normalize(raw);
      }
      if (res.status === 404 || res.status === 403) {
        lastStatus = res.status;
        continue;
      }
      throw new ConversationApiError(humanMessageForStatus(res.status, 'conversation'));
    }
    throw new ConversationApiError(
      humanMessageForStatus(lastStatus ?? 404, 'conversation'),
    );
  }

  return { fetchConversation };
}
