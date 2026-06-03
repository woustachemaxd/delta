import(chrome.runtime.getURL('src/content.js')).catch((err) =>
  console.error('[cwe] loader: failed to import content.js', err)
);
