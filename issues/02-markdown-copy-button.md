# Markdown copy button (foundational tracer)

> Type: **AFK**
> Covers user stories: 2, 3, 4, 7, 10, 11, 27, 28, 31, 32
> Parent doc: `../PRD.md`

## What to build

The first end-to-end vertical slice. A single **MD** button is injected next to Claude's existing copy control on every Claude response. Clicking it copies the response as clean GitHub-flavored markdown. The button flips to `Copied!` for ~2s on success and `Failed` on clipboard rejection.

This slice establishes the whole project skeleton, so it touches every layer:

- **Chrome MV3 manifest** restricted to `claude.ai/chat/*`
- **Content script entry** that initializes the injector on load
- **Constants module** holding CSS selectors, splitter strings, and configuration defaults — everything that might churn with UI updates lives here
- **`MessageActionInjector`** built on a `MutationObserver`. It finds Claude response containers, mounts the button into each response's action bar, is idempotent (won't double-inject), and re-mounts on streaming-complete by observing the `data-is-streaming` attribute flipping off
- **`HtmlToFormat`** (markdown path only for this slice) wrapping Turndown with the configuration agreed in the PRD: ATX headings, fenced code blocks, `<br>` preserved as newlines. Turndown stays vendored locally — no CDN, no remote loads, CSP-safe.
- **`ClipboardWriter`** (plain-text path only) using `navigator.clipboard.writeText`
- **Vitest + jsdom** test setup, run via a single npm script
- **HtmlToFormat markdown unit tests** over fixture HTML strings: simple paragraph, fenced code with language hint, nested ordered/unordered lists, GFM table, inline code/bold/italics/links, `<br>` handling

Native Ctrl+C / Cmd+C must remain untouched — text-selection copy continues to behave exactly as Claude ships it.

Demoable end-to-end: load the unpacked extension in Chrome, open any Claude chat, click **MD** on a response, paste into a markdown-aware editor → headings, lists, fenced code, and links all render correctly.

## Acceptance criteria

- [ ] The unpacked extension loads in Chrome (MV3) with the content script active only on `claude.ai/chat/*`
- [ ] An **MD** button is visible inside the action area of every Claude response (existing and newly streamed)
- [ ] The button mounts after streaming completes for streaming responses (no early mount on partial content)
- [ ] Clicking the button copies the response as markdown to the system clipboard
- [ ] Button label flips to `Copied!` for ~2s on success and to `Failed` on clipboard rejection
- [ ] Markdown output preserves fenced code blocks with language hints, nested lists, GFM tables, inline code, bold, italics, and links
- [ ] Native Ctrl+C / Cmd+C selection copy works exactly as it did without the extension
- [ ] All CSS selectors, splitter strings, and config defaults live in a single constants module
- [ ] Turndown is vendored locally; no remote script loads
- [ ] Vitest runs from `npm test`; all `HtmlToFormat` markdown tests pass

## Blocked by

None — can start immediately. Independent of issue 01 (no API calls in this slice).
