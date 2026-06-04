# Delta

A small browser extension that adds power-user tools to the Claude web UI:

1. **Copy** any Claude response as **Plain**, **Markdown**, or **Rich** (HTML).
2. **Branch from here** — open a transcript of every turn up to and including a chosen Claude response, copy or download it, and paste it into a new chat to continue from that point.

The extension is content-script-only. No background pages, no remote services, no bundler.

## Install — Chrome / Chromium

1. Download `delta-chrome.zip` from the [latest release](https://github.com/woustachemaxd/delta/releases/latest).
2. Unzip it somewhere permanent (the extension loads from this folder — don't delete it).
3. Visit `chrome://extensions`.
4. Toggle **Developer mode** (top right).
5. Click **Load unpacked** and pick the unzipped folder.
6. Open `https://claude.ai/chat/...` and reload the tab.

To update: download the new release, unzip over the existing folder, and click the refresh icon on the extension card.

## Install — Firefox / Zen

Coming soon. Firefox requires Mozilla-signed `.xpi` files for stable distribution; once signed, the install path becomes a one-click `.xpi` download.

In the meantime, see [Develop](#develop) below for the temporary-add-on flow.

## Permissions

The extension only runs on `https://claude.ai/chat/*`. It makes no outbound `fetch` calls to any host other than `claude.ai` (locked in by a test in `tests/conversationClient.test.js`).

## Develop

```
npm install
npm test                    # vitest run
npm run build               # rebuilds dist/chrome/ and dist/firefox/
npm run package:chrome      # builds + zips dist/chrome/ into dist/delta-chrome.zip
```

There is no watcher — re-run `npm run build` after editing `src/`.

### Project layout

```
src/            Runtime modules (ES modules, loaded via loader.js)
vendor/         Vendored Turndown + GFM tables (no npm install needed at runtime)
tests/          Vitest suites + captured API fixtures
scripts/        build.js — copies src + vendor + the right manifest into dist/<target>/
dist/chrome/    Loadable unpacked extension for Chrome
dist/firefox/   Loadable temporary add-on for Firefox / Zen
```

### Load unpacked from source

For Chrome, follow the install steps above but pick `dist/chrome/` after `npm run build` instead of an unzipped release.

For Firefox / Zen (temporary add-on, unloaded on browser quit):

1. `npm run build`
2. Visit `about:debugging` → **This Firefox** → **Load Temporary Add-on…**
3. Pick any file inside `dist/firefox/` (Firefox loads the whole containing folder).
4. Open `https://claude.ai/chat/...` and reload the tab.

After editing source: rebuild, return to `about:debugging`, and click **Reload** on the extension's card.
