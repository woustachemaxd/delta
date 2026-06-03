import { createHtmlToFormat } from './htmlToFormat.js';
import { writePlain, writeRich } from './clipboardWriter.js';
import { createInjector } from './injector.js';
import { createConversationClient } from './conversationClient.js';
import { build as buildTranscript } from './transcriptBuilder.js';
import { openTranscriptModal, openErrorModal } from './branchModal.js';
import { SELECTORS } from './constants.js';

const formatter = createHtmlToFormat({
  TurndownService: globalThis.TurndownService,
  gfmTables: globalThis.turndownPluginGfm?.tables,
});

const client = createConversationClient();

function parseConvUuid() {
  const match = location.pathname.match(/\/chat\/([0-9a-fA-F-]{8,})/);
  return match ? match[1] : null;
}

function safeFilename(title) {
  const base = (title || 'claude-branch')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'claude-branch';
  return `${base}.txt`;
}

function buildButton(label, onClick, { variant } = {}) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.textContent = label;
  btn.className = 'cwe-copy-btn';
  if (variant) btn.dataset.variant = variant;
  btn.addEventListener('click', async () => {
    try {
      await onClick();
      btn.textContent = 'Copied!';
      btn.dataset.state = 'success';
    } catch (err) {
      btn.textContent = 'Failed';
      btn.dataset.state = 'error';
      console.error(`[cwe] ${label} copy failed`, err);
    }
    setTimeout(() => {
      btn.textContent = label;
      btn.removeAttribute('data-state');
    }, 1600);
  });
  return btn;
}

function buildBranchButton(container) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.textContent = 'Branch from here';
  btn.className = 'cwe-copy-btn';
  btn.dataset.variant = 'branch';
  btn.addEventListener('click', async () => {
    if (btn.dataset.state === 'loading') return;
    btn.dataset.state = 'loading';
    btn.textContent = 'Loading…';
    try {
      const convUuid = parseConvUuid();
      if (!convUuid) throw new Error('Open a conversation first.');

      const allMessages = Array.from(document.querySelectorAll(SELECTORS.CLAUDE_MESSAGE));
      const claudeIndex = allMessages.indexOf(container);
      if (claudeIndex < 0) {
        throw new Error('Could not locate this response on the page.');
      }

      const conv = await client.fetchConversation(convUuid);
      const claudeMessages = conv.messages.filter((m) => m.sender === 'claude');
      const target = claudeMessages[claudeIndex];
      if (!target) {
        throw new Error(
          `Conversation has ${claudeMessages.length} responses but you clicked #${claudeIndex + 1}.`,
        );
      }

      const transcript = buildTranscript(conv, target.uuid);
      openTranscriptModal(transcript, { filename: safeFilename(conv.title) });
    } catch (err) {
      console.error('[cwe] branch failed', err);
      openErrorModal(err?.message || String(err));
    } finally {
      btn.removeAttribute('data-state');
      btn.textContent = 'Branch from here';
    }
  });
  return btn;
}

function injectActions({ container, content }) {
  const actions = document.createElement('div');
  actions.className = 'cwe-actions';

  const copyRow = document.createElement('div');
  copyRow.className = 'cwe-actions-row';
  copyRow.appendChild(buildButton('Plain', () => writePlain(formatter.plain(content))));
  copyRow.appendChild(buildButton('MD', () => writePlain(formatter.markdown(content))));
  copyRow.appendChild(
    buildButton('Rich', () =>
      writeRich({
        html: formatter.html(content),
        plain: formatter.plain(content),
      }),
    ),
  );

  const branchRow = document.createElement('div');
  branchRow.className = 'cwe-actions-row';
  branchRow.appendChild(buildBranchButton(container));

  actions.appendChild(copyRow);
  actions.appendChild(branchRow);
  container.appendChild(actions);
}

createInjector(injectActions).start();
