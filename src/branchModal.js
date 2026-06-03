function buildShell() {
  const backdrop = document.createElement('div');
  backdrop.className = 'delta-modal-backdrop';

  const dialog = document.createElement('div');
  dialog.className = 'delta-modal';
  dialog.setAttribute('role', 'dialog');
  dialog.setAttribute('aria-modal', 'true');
  dialog.setAttribute('aria-label', 'Branch from here');

  const header = document.createElement('div');
  header.className = 'delta-modal-header';
  const title = document.createElement('div');
  title.className = 'delta-modal-title';
  title.textContent = 'Branch from here';
  const closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.className = 'delta-modal-icon-btn';
  closeBtn.setAttribute('aria-label', 'Close');
  closeBtn.textContent = '×';
  header.appendChild(title);
  header.appendChild(closeBtn);

  const body = document.createElement('div');
  body.className = 'delta-modal-body';

  const footer = document.createElement('div');
  footer.className = 'delta-modal-footer';

  dialog.appendChild(header);
  dialog.appendChild(body);
  dialog.appendChild(footer);
  backdrop.appendChild(dialog);

  return { backdrop, dialog, header, body, footer, closeBtn };
}

function downloadText(text, filename) {
  const blob = new Blob([text], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function makeActionButton(label) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'delta-modal-btn';
  btn.textContent = label;
  return btn;
}

function flash(btn, text) {
  const original = btn.textContent;
  btn.textContent = text;
  btn.dataset.state = text === 'Failed' ? 'error' : 'success';
  setTimeout(() => {
    btn.textContent = original;
    btn.removeAttribute('data-state');
  }, 1600);
}

export function openTranscriptModal(transcript, { filename = 'claude-branch.txt' } = {}) {
  const { backdrop, body, footer, closeBtn } = buildShell();

  const textarea = document.createElement('textarea');
  textarea.className = 'delta-modal-textarea';
  textarea.readOnly = true;
  textarea.value = transcript;
  body.appendChild(textarea);

  const copyBtn = makeActionButton('Copy');
  const downloadBtn = makeActionButton('Download');
  const closeFooterBtn = makeActionButton('Close');
  footer.appendChild(copyBtn);
  footer.appendChild(downloadBtn);
  footer.appendChild(closeFooterBtn);

  copyBtn.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(transcript);
      flash(copyBtn, 'Copied!');
    } catch (err) {
      console.error('[delta] modal copy failed', err);
      flash(copyBtn, 'Failed');
    }
  });

  downloadBtn.addEventListener('click', () => {
    try {
      downloadText(transcript, filename);
      flash(downloadBtn, 'Saved!');
    } catch (err) {
      console.error('[delta] modal download failed', err);
      flash(downloadBtn, 'Failed');
    }
  });

  function close() {
    backdrop.remove();
    document.removeEventListener('keydown', onKey);
  }

  function onKey(e) {
    if (e.key === 'Escape') close();
  }

  closeBtn.addEventListener('click', close);
  closeFooterBtn.addEventListener('click', close);
  backdrop.addEventListener('click', (e) => {
    if (e.target === backdrop) close();
  });
  document.addEventListener('keydown', onKey);

  document.body.appendChild(backdrop);
  textarea.focus();
}

export function openErrorModal(message) {
  const { backdrop, body, footer, closeBtn } = buildShell();

  const errorBox = document.createElement('div');
  errorBox.className = 'delta-modal-error';
  const heading = document.createElement('div');
  heading.className = 'delta-modal-error-heading';
  heading.textContent = "Couldn't build the transcript";
  const detail = document.createElement('div');
  detail.className = 'delta-modal-error-detail';
  detail.textContent = message || 'Unknown error.';
  errorBox.appendChild(heading);
  errorBox.appendChild(detail);
  body.appendChild(errorBox);

  const closeFooterBtn = makeActionButton('Close');
  footer.appendChild(closeFooterBtn);

  function close() {
    backdrop.remove();
    document.removeEventListener('keydown', onKey);
  }
  function onKey(e) {
    if (e.key === 'Escape') close();
  }

  closeBtn.addEventListener('click', close);
  closeFooterBtn.addEventListener('click', close);
  backdrop.addEventListener('click', (e) => {
    if (e.target === backdrop) close();
  });
  document.addEventListener('keydown', onKey);

  document.body.appendChild(backdrop);
}
