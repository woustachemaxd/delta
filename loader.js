import(chrome.runtime.getURL('src/content.js')).catch((err) =>
  console.error('[delta] loader: failed to import content.js', err)
);
