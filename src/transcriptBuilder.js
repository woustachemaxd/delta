import {
  FRAMING,
  OPENING_SPLITTER,
  SPLITTER,
  MANIFEST_USER_HEADING,
  MANIFEST_TRAILING_INSTRUCTION,
  INLINE_TEXT_THRESHOLD_BYTES,
} from './constants.js';

const FENCE_LANG_BY_EXT = {
  md: 'markdown', markdown: 'markdown',
  js: 'javascript', mjs: 'javascript', cjs: 'javascript',
  jsx: 'jsx', ts: 'typescript', tsx: 'tsx',
  py: 'python', rb: 'ruby', go: 'go', rs: 'rust',
  java: 'java', kt: 'kotlin', swift: 'swift', scala: 'scala', php: 'php',
  c: 'c', h: 'c', cc: 'cpp', cpp: 'cpp', hpp: 'cpp', cs: 'csharp',
  html: 'html', htm: 'html', xml: 'xml', svg: 'xml',
  css: 'css', scss: 'scss', sass: 'sass', less: 'less',
  sh: 'bash', bash: 'bash', zsh: 'bash', fish: 'bash',
  yml: 'yaml', yaml: 'yaml', toml: 'toml',
  sql: 'sql', graphql: 'graphql', proto: 'proto',
  json: 'json', jsonc: 'json',
  csv: 'csv', tsv: 'tsv',
};

function pickFenceLang(name) {
  if (!name) return '';
  const ext = name.split('.').pop()?.toLowerCase();
  return FENCE_LANG_BY_EXT[ext] ?? '';
}

function effectiveSize(att) {
  if (typeof att.extractedContent === 'string') {
    return new Blob([att.extractedContent]).size;
  }
  if (typeof att.sizeBytes === 'number') return att.sizeBytes;
  return Infinity;
}

function classifyForRender(att, threshold) {
  if (att.kind !== 'text') return 'skip';
  if (!att.extractedContent) return 'manifest';
  return effectiveSize(att) <= threshold ? 'inline' : 'manifest';
}

function labelFor(sender, promptNumber) {
  return sender === 'user'
    ? `User Prompt ${promptNumber}:`
    : `Claude Response to User Prompt ${promptNumber}:`;
}

function renderInlineAttachment(att) {
  const heading = att.name ? `Attached file: ${att.name}` : 'Attached content:';
  const lang = pickFenceLang(att.name);
  return `${heading}\n\`\`\`${lang}\n${att.extractedContent}\n\`\`\``;
}

function renderUserTurn(msg, promptNumber, threshold) {
  const inlineAttachments = (msg.attachments ?? []).filter(
    (a) => classifyForRender(a, threshold) === 'inline',
  );
  const parts = [`${labelFor('user', promptNumber)}\n${msg.text}`];
  for (const att of inlineAttachments) {
    parts.push(renderInlineAttachment(att));
  }
  return parts.join('\n\n');
}

function renderClaudeTurn(msg, promptNumber) {
  return `${labelFor('claude', promptNumber)}\n${msg.text}`;
}

function collectManifest(messages, threshold) {
  const userFiles = [];
  for (const msg of messages) {
    if (msg.sender !== 'user') continue;
    for (const att of msg.attachments ?? []) {
      if (classifyForRender(att, threshold) === 'manifest') {
        userFiles.push({ name: att.name || '(pasted content)', indicator: 'file' });
      }
    }
  }
  return { userFiles, claudeFiles: [] };
}

function renderManifest({ userFiles, claudeFiles }) {
  if (userFiles.length === 0 && claudeFiles.length === 0) return null;
  const sections = [];
  if (userFiles.length) {
    const lines = [MANIFEST_USER_HEADING];
    for (const f of userFiles) lines.push(`- \`${f.name}\` (${f.indicator})`);
    sections.push(lines.join('\n'));
  }
  sections.push(MANIFEST_TRAILING_INSTRUCTION);
  return sections.join('\n\n');
}

export function build(conversation, sliceAtMessageUuid, config = {}) {
  const threshold = config.inlineTextThresholdBytes ?? INLINE_TEXT_THRESHOLD_BYTES;
  const messages = conversation?.messages ?? [];

  if (messages.length === 0) {
    return [FRAMING, OPENING_SPLITTER].join('\n\n');
  }

  let sliceIdx = messages.length - 1;
  if (sliceAtMessageUuid) {
    const found = messages.findIndex((m) => m.uuid === sliceAtMessageUuid);
    if (found >= 0) sliceIdx = found;
  }

  const sliced = messages.slice(0, sliceIdx + 1);
  const manifest = renderManifest(collectManifest(sliced, threshold));

  const sections = [FRAMING];
  if (manifest) sections.push(manifest);

  let promptNumber = 0;
  for (const msg of sliced) {
    if (msg.sender === 'user') {
      promptNumber += 1;
      sections.push(OPENING_SPLITTER);
      sections.push(renderUserTurn(msg, promptNumber, threshold));
    } else {
      sections.push(SPLITTER);
      sections.push(renderClaudeTurn(msg, promptNumber || 1));
    }
  }

  return sections.join('\n\n');
}
