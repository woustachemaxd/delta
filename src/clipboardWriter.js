export async function writePlain(text) {
  await navigator.clipboard.writeText(text);
}

export async function writeRich({ html, plain }) {
  const item = new ClipboardItem({
    'text/html': new Blob([html], { type: 'text/html' }),
    'text/plain': new Blob([plain], { type: 'text/plain' }),
  });
  await navigator.clipboard.write([item]);
}
