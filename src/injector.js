import { SELECTORS, MOUNT_MARKER_ATTR } from './constants.js';

export function createInjector(onMount) {
  function mountAll() {
    const messages = document.querySelectorAll(SELECTORS.CLAUDE_MESSAGE);
    for (const msg of messages) {
      if (msg.hasAttribute(MOUNT_MARKER_ATTR)) continue;
      const streamingDiv = msg.querySelector(SELECTORS.STREAMING_DIV);
      if (streamingDiv?.getAttribute('data-is-streaming') === 'true') continue;
      const content = msg.querySelector(SELECTORS.RESPONSE_CONTENT);
      if (!content) continue;
      msg.setAttribute(MOUNT_MARKER_ATTR, 'true');
      onMount({ container: msg, content });
    }
  }

  const observer = new MutationObserver(() => mountAll());

  function start() {
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['data-is-streaming'],
    });
    mountAll();
  }

  return { start };
}
