export async function writePlain(text) {
  await navigator.clipboard.writeText(text);
}
