import { createHtmlToFormat } from './htmlToFormat.js';
import { writePlain } from './clipboardWriter.js';
import { createInjector } from './injector.js';

const formatter = createHtmlToFormat({
  TurndownService: globalThis.TurndownService,
  gfmTables: globalThis.turndownPluginGfm?.tables,
});

function buildButton(label) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.textContent = label;
  btn.className = 'cwe-copy-btn';
  return btn;
}

function injectActions({ container, content }) {
  const actions = document.createElement('div');
  actions.className = 'cwe-actions';

  const mdBtn = buildButton('MD');
  mdBtn.addEventListener('click', async () => {
    const original = mdBtn.textContent;
    try {
      const md = formatter.markdown(content);
      await writePlain(md);
      mdBtn.textContent = 'Copied!';
    } catch (err) {
      mdBtn.textContent = 'Failed';
      console.error('cwe: markdown copy failed', err);
    }
    setTimeout(() => {
      mdBtn.textContent = original;
    }, 2000);
  });

  actions.appendChild(mdBtn);
  container.appendChild(actions);
}

createInjector(injectActions).start();
