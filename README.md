# Delta

A small browser extension that adds power-user tools to the Claude web UI:

1. **Copy** any Claude response as **Plain**, **Markdown**, or **Rich** (HTML).
2. **Branch from here** — open a transcript of every turn up to and including a chosen Claude response, copy or download it, and paste it into a new chat to continue from that point.

The extension is content-script-only. No background pages, no remote services, no bundler.

## Project layout

```
src/            Runtime modules (ES modules, loaded via loader.js)
vendor/         Vendored Turndown + GFM tables (no npm install needed at runtime)
tests/          Vitest suites + captured API fixtures
scripts/        build.js — copies src + vendor + the right manifest into dist/<target>/
dist/chrome/    Loadable unpacked extension for Chrome
dist/firefox/   Loadable temporary add-on for Firefox / Zen
```

## Develop

```
npm install
npm test              # vitest run, 90+ tests
npm run build         # rebuilds dist/chrome/ and dist/firefox/
```

There is no watcher — re-run `npm run build` after editing `src/`.

## Install — Chrome / Chromium

1. `npm run build`
2. Visit `chrome://extensions`
3. Toggle **Developer mode** (top right)
4. Click **Load unpacked**
5. Pick the `dist/chrome/` directory
6. Open `https://claude.ai/chat/...` and reload the tab

After editing source: rebuild, then click the refresh icon on the extension card and reload the Claude tab.

## Install — Firefox / Zen

Firefox-based browsers (including Zen) load unpacked extensions as **temporary add-ons** — they survive the current session and are unloaded on browser quit.

1. `npm run build`
2. Visit `about:debugging`
3. Click **This Firefox** (or **This Zen** etc.) in the sidebar
4. Click **Load Temporary Add-on…**
5. Pick **any single file** inside `dist/firefox/` (for example, `manifest.json`) — Firefox loads the whole containing directory
6. Open `https://claude.ai/chat/...` and reload the tab

After editing source: rebuild, return to `about:debugging`, and click **Reload** on the extension's card.

> Zen-specific note: the experience is identical to Firefox, since Zen tracks Firefox releases. If a feature works in Firefox but not Zen, file it as a follow-up.

## Permissions

The extension only runs on `https://claude.ai/chat/*`. It makes no outbound `fetch` calls to any host other than `claude.ai` (locked in by a test in `tests/conversationClient.test.js`).
