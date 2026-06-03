import { SELECTORS, MOUNT_MARKER_ATTR } from './constants.js';

export function createInjector(onMount, options = {}) {
  const selectors = options.selectors ?? SELECTORS;
  const markerAttr = options.markerAttr ?? MOUNT_MARKER_ATTR;

  function mountAll() {
    let messages;
    try {
      messages = document.querySelectorAll(selectors.CLAUDE_MESSAGE);
    } catch (err) {
      console.error('[delta] injector: bad CLAUDE_MESSAGE selector', err);
      return;
    }
    for (const msg of messages) {
      try {
        if (msg.hasAttribute(markerAttr)) continue;
        const streamingDiv = msg.querySelector(selectors.STREAMING_DIV);
        if (streamingDiv?.getAttribute('data-is-streaming') === 'true') continue;
        const content = msg.querySelector(selectors.RESPONSE_CONTENT);
        if (!content) continue;
        msg.setAttribute(markerAttr, 'true');
        onMount({ container: msg, content });
      } catch (err) {
        console.error('[delta] injector: mount failed for a message; skipping', err);
      }
    }
  }

  const observer = new MutationObserver(() => mountAll());

  function start() {
    try {
      observer.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['data-is-streaming'],
      });
    } catch (err) {
      console.error('[delta] injector: failed to start observer', err);
    }
    mountAll();
  }

  function stop() {
    observer.disconnect();
  }

  return { start, stop };
}
