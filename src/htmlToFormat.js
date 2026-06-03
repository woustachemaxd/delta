const STRIP_SELECTORS = 'button, input, textarea, select';

function stripInteractive(node) {
  const clone = node.cloneNode(true);
  clone.querySelectorAll(STRIP_SELECTORS).forEach((el) => el.remove());
  return clone;
}

export function createHtmlToFormat({ TurndownService, gfmTables }) {
  const turndown = new TurndownService({
    headingStyle: 'atx',
    codeBlockStyle: 'fenced',
  });

  if (gfmTables) turndown.use(gfmTables);

  turndown.addRule('lineBreaks', {
    filter: 'br',
    replacement: () => '\n',
  });

  return {
    markdown(node) {
      return turndown.turndown(stripInteractive(node).innerHTML);
    },
  };
}
