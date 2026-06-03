import { createHtmlToFormat } from './htmlToFormat.js';
import { writePlain, writeRich } from './clipboardWriter.js';
import { createInjector } from './injector.js';

const formatter = createHtmlToFormat({
  TurndownService: globalThis.TurndownService,
  gfmTables: globalThis.turndownPluginGfm?.tables,
});

function buildButton(label, onClick) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.textContent = label;
  btn.className = 'cwe-copy-btn';
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

function injectActions({ container, content }) {
  const actions = document.createElement('div');
  actions.className = 'cwe-actions';

  actions.appendChild(buildButton('Plain', () => writePlain(formatter.plain(content))));
  actions.appendChild(buildButton('MD', () => writePlain(formatter.markdown(content))));
  actions.appendChild(buildButton('Rich', () => writeRich({
    html: formatter.html(content),
    plain: formatter.plain(content),
  })));

  container.appendChild(actions);
}

createInjector(injectActions).start();
