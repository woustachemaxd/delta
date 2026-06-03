# PRD: Claude Web UI Companion Extension

> Status: Draft (local — no issue tracker configured yet)
> Browser targets: Chrome (MV3), Firefox (MV3)

## Problem Statement

People using Claude's web UI (claude.ai) hit two recurring friction points that the product doesn't solve:

1. **Copy is lossy.** Selecting and copying a Claude response copies the rendered rich text. Pasting into a markdown-aware editor (Obsidian, Notion, GitHub, etc.) often produces broken formatting; pasting into a plain-text context drags along styling artifacts. Users want to choose the format at copy time, not after.

2. **There is no way to branch a conversation.** Once a conversation goes down a wrong path, or once a user wants to explore an alternative from an earlier point, the only option is to manually scroll, copy each turn, and rebuild the context in a new chat. An existing community extension ("Claude: Continue from Here") attempts this by scraping the DOM, but its approach has known gaps: it cannot reliably extract user-attached file contents (it currently emits a generic placeholder), it ignores Claude-generated artifacts beyond inline code blocks, and its sidebar-click extraction strategy is fragile against DOM changes.

Both problems are minor in isolation but compound for power users who use Claude as a daily thinking tool.

## Solution

A browser extension (Chrome + Firefox, single codebase) that injects two features into the Claude web UI:

1. **Three-format copy buttons** appear next to Claude's existing copy control on every Claude response. The buttons are labeled **Plain**, **MD**, and **Rich**, and copy that response in the chosen format. No modal, no menu — one click per format.

2. **Branch from here** adds a button to every Claude response that opens a modal containing a complete, well-formatted transcript of the conversation up to and including that response. The user copies the transcript and pastes it into a fresh Claude chat to continue from that point with full context. The transcript is built from Claude's internal conversation API (not DOM scraping). Small text attachments are inlined at the turn they belong to; everything else (large text attachments, images, binaries, Claude-generated files) is listed by filename in a manifest at the **top** of the transcript so the receiving Claude sees it before the conversation body.

The extension is content-script only — no background worker, no popup, no remote calls beyond Claude's own internal API (which the extension is already authenticated to via session cookies).

## User Stories

### Copy with format

1. As a Claude user, I want to see three copy buttons (Plain, MD, Rich) next to every Claude response, so that I can choose the format at copy time without going to settings.
2. As a Claude user, I want the buttons to appear on every Claude response in the current conversation, so that I never have to wonder which messages I can copy.
3. As a Claude user, I want the buttons to appear on Claude responses that are still streaming (after streaming completes), so that newly arrived responses are immediately actionable.
4. As a Claude user copying to a markdown editor, I want the **MD** button to give me clean GitHub-flavored markdown, so that headings, lists, code blocks, and links paste correctly.
5. As a Claude user copying to a code review or plain-text context, I want the **Plain** button to give me text with no formatting markers at all, so that I can paste into terminals, email, or chat without artifacts.
6. As a Claude user copying to a rich-text editor (Google Docs, Notion, email composer), I want the **Rich** button to give me styled output, so that bold, italics, headings, and lists render as styling, not as markdown characters.
7. As a Claude user, I want a brief visual confirmation when a copy succeeds (button label flips to "Copied!" for ~2s), so that I know the action worked.
8. As a Claude user, I want copy to fail visibly (button label flips to "Failed") when the clipboard API rejects, so that I'm not silently working with stale clipboard contents.
9. As a Claude user, I do **not** want the extension to intercept native Ctrl+C / Cmd+C, so that text selection copy continues to work exactly as Claude ships it.
10. As a Claude user, I want code blocks in copied markdown to use fenced syntax (` ``` `) with language hints preserved, so that downstream renderers highlight correctly.
11. As a Claude user, I want copied markdown to preserve nested lists, tables, and inline code spans, so that complex Claude responses survive the round trip.

### Branch conversation

12. As a Claude user, I want a **Branch from here** button on every Claude response, so that I can fork the conversation at any point.
13. As a Claude user clicking Branch, I want a modal to appear containing the transcript of the conversation up to and including the message I clicked, so that I can review what will be carried over before pasting.
14. As a Claude user, I want each turn in the transcript labeled (User Prompt N / Claude Response N) with clear delimiters between turns, so that the next Claude can parse the structure.
15. As a Claude user, I want a short framing instruction at the top of the transcript ("I'd like to continue from a previous conversation; here it is"), so that the receiving Claude immediately understands the context.
16. As a Claude user, I want **Copy**, **Download**, and **Close** actions on the modal, so that I can choose how to take the transcript out.
17. As a Claude user, I want the modal to be resizable, so that I can review long transcripts comfortably.
18. As a Claude user with text-based attachments (`.txt`, `.md`, source code) in the original conversation, I want their contents inlined into the transcript when small (under a configurable threshold, default ~20KB), so that the new Claude sees the actual content, not just the file name.
19. As a Claude user with large text attachments above the threshold, I want them listed in the top manifest with a note saying the user can re-share if needed, so that the receiving Claude sees them in its first chunk of attention rather than 50KB deep.
20. As a Claude user with image attachments in the original conversation, I want them listed in the top manifest ("the following images were attached: foo.png, screenshot.jpg — ask the user to share if needed"), so that the new Claude knows they existed without trying to reason about non-existent image bytes.
21. As a Claude user with PDF or other binary attachments, I want them listed in the top manifest the same way as images, so that the new Claude is aware of them.
22. As a Claude user, I do **not** want the extension to auto-re-upload any files or images to a new chat, so that I retain control of what gets re-shared.
23. As a Claude user whose conversation produced Claude-generated artifacts (React components, HTML pages, PDFs, canvas documents), I want their filenames listed in the top manifest under a "Files Claude generated" section, so that the receiving Claude knows they existed and can ask me to share any specific one. The contents are **not** inlined — artifact-heavy conversations would blow past usefulness if every file were embedded.
24. As a Claude user, I want **Branch from here** to work mid-conversation — clicking it on response #3 of a 10-message chat should produce a transcript of messages 1–3 only, so that I can explore alternatives from the past.
25. As a Claude user, I want the extension to handle a conversation that is still loading or paginated gracefully (fetch full data via API, not whatever happens to be rendered), so that I don't silently lose old messages.
26. As a Claude user, I want clear error messaging in the modal if the transcript build fails (API error, unrecognized response shape), so that I'm not staring at an empty box.

### Cross-cutting

27. As a Claude user, I want the extension to work on `claude.ai/chat/*` URLs, so that it activates exactly where it's useful and not on the rest of the site.
28. As a Claude user, I want both features to work without me needing to log in again or grant extra permissions, so that installation is one click.
29. As a Firefox user, I want feature parity with Chrome, so that browser choice doesn't determine which features I get.
30. As a Claude user, I do not want the extension to send any data to third-party servers, so that my conversations stay between me and Anthropic.
31. As a Claude user, I want the extension to degrade gracefully when Claude's DOM or API changes (catch errors, log to console, never crash the host page), so that a bad release of Claude doesn't break my tab.
32. As a developer maintaining the extension, I want CSS selectors and API endpoints centralized in a constants module, so that adapting to Claude UI changes is mechanical.

## Implementation Decisions

### Architecture

- **Content-script only.** No service worker, no popup, no background page. Both features run entirely in the page context. This minimizes the permission footprint and dual-browser surface area.
- **Pure vanilla JavaScript**, no bundler initially. Matches the prior-art fork. If complexity warrants it later, introduce esbuild — not now.
- **Single source manifest, two build outputs.** Chrome MV3 is the baseline. The Firefox build adds `browser_specific_settings.gecko.id` and uses the same `content_scripts` entry. No code branches needed for the browser difference.
- **Authoritative data source for branching is Claude's internal conversation API**, not DOM scraping. The extension is already authenticated via session cookies; `fetch` with `credentials: 'include'` reaches the same endpoints the web UI calls. DOM scraping is reserved for finding where to inject buttons.

### Modules

1. **ConversationClient** — speaks Claude's internal API.
   - Interface: `getOrgId() → Promise<string>`, `fetchConversation(orgId, convUuid) → Promise<Conversation>`.
   - Returns a normalized `Conversation` object: ordered list of messages, each with `{uuid, sender: 'user'|'claude', text, attachments[], artifacts[]}`. Attachments carry `{uuid, name, mimeType, sizeBytes, textContent?}` — `textContent` is populated for text-extractable types when the API provides it.
   - Hides URL construction, error handling, response-shape variations, and the org-id discovery dance.

2. **TranscriptBuilder** — pure function, no DOM, no network.
   - Interface: `build(conversation, sliceAtMessageUuid, config) → string`.
   - `config` includes `inlineTextThresholdBytes` (default 20480) and the splitter/header/footer strings.
   - Owns: turn numbering, delimiter strings, decision logic for inline-vs-footer per attachment, artifact embedding, footer assembly listing files/images that were excluded.

3. **HtmlToFormat** — pure function over a DOM node.
   - Interface: `convert(htmlNode) → {markdown, plain, html}`.
   - Wraps Turndown with a fixed configuration (ATX headings, fenced code, preserve `<br>` as newline). Plain text is `innerText`. `html` is the cleaned-up outerHTML used for the rich-text clipboard write.

4. **ClipboardWriter** — wraps the Clipboard API.
   - Interface: `write({markdown, plain, html}, format: 'plain'|'markdown'|'rich') → Promise<void>`.
   - For `rich`, writes a `ClipboardItem` with both `text/html` and `text/plain` so paste targets pick the appropriate mime. For `markdown` and `plain`, writes plain text only.

5. **MessageActionInjector** — DOM lifecycle for button mounting.
   - Interface: `start()`, internally uses a `MutationObserver` watching for new Claude message containers and for streaming-completion attribute changes.
   - Mounts the copy buttons and the Branch button into each Claude response's action bar. Idempotent (won't double-inject).

6. **BranchModal** — UI.
   - Interface: `open(transcriptText) → void`. Builds the modal DOM (header, textarea, Copy/Download/Close, resize handle), attaches handlers, removes itself on close.

7. **Constants module** — all CSS selectors, API endpoints, splitter strings, configurable thresholds. Single file so DOM-rot fixes are one-file changes.

8. **Content script entry** — wires the above and starts the injector.

### API contract (ConversationClient → consumers)

```
Conversation {
  uuid: string
  messages: Message[]
}

Message {
  uuid: string
  sender: 'user' | 'claude'
  text: string                  // markdown-ready
  attachments: Attachment[]
  artifacts: Artifact[]
}

Attachment {
  uuid: string
  name: string
  mimeType: string
  sizeBytes: number
  textContent?: string          // present iff Claude's API returned text for this attachment
  kind: 'text' | 'image' | 'binary'   // derived from mimeType
}

Artifact {
  uuid: string
  name: string                  // filename, e.g. "ComponentA.tsx"
  mimeType: string
}
// Content is intentionally not part of the contract.
// TranscriptBuilder lists artifacts by filename in the top manifest;
// the receiving Claude asks the user to share specific files if needed.
```

### Transcript format

Structure, in order:

1. **Framing paragraph** instructing the new Claude to continue from a prior conversation.
2. **File manifest** (omit entirely if both sub-sections are empty). Two sub-sections, each omitted if empty:
   - *Files I attached:* large text attachments (`kind === 'text'` with `sizeBytes > inlineTextThresholdBytes`), images, PDFs, and other binaries from the user's `attachments[]`. Listed by filename with a kind indicator (e.g., `foo.pdf (file)`, `bar.png (image)`).
   - *Files you (Claude) generated:* every entry in each Claude message's `files[]` (renamed to `artifacts[]` in the normalized contract), listed by filename with a kind indicator.
   - Followed by a one-line instruction: *"Ask the user to share any specific file if you need its contents — they aren't included here."*
3. **`OPENING_SPLITTER`** — clear delimiter telling the receiving Claude where the prior-conversation transcript begins.
4. **Turns**, each labeled `User Prompt N:` or `Claude Response to User Prompt N:`, separated by `SPLITTER`.
5. **End** — no closing footer, no closing manifest. The last turn is the last thing in the transcript.

Per-turn handling:

- **Small text attachments** (`kind === 'text'` and `sizeBytes ≤ inlineTextThresholdBytes`) stay at the turn they belong to, inlined as a fenced code block under an `Attached file: <name>` heading. These do **not** hoist to the manifest.
- **`tool_use`, `tool_result`, and `thinking` content blocks are dropped entirely** from the transcript. Claude's `text` blocks usually already narrate what was looked up or computed, so dropping the tool plumbing is not lossy. See [[project-transcript-builder-mechanical]] for the rationale.

**Why manifest-at-top, not footer:** in long conversations, footer content gets pushed deep into the receiving Claude's context. A manifest at the top puts file references in the first chunk of attention, where they're most likely to be retained and prioritized.

### Browser/dual-build

- One `manifest.template.json` plus a tiny script (or hand-maintained pair, given the small delta) producing `manifest.chrome.json` and `manifest.firefox.json`.
- Firefox requires `browser_specific_settings.gecko.id`. Everything else (content_scripts, matches, icons) is identical.
- No `chrome.*` API usage in v1 — everything the extension does works through DOM + `fetch` + Clipboard API, all of which behave identically across the two browsers.

### Error handling philosophy

- Never throw uncaught into the host page. All API and DOM operations are wrapped; failures surface as user-visible messages in the modal or as a button "Failed" state for copy actions.
- Defensive parsing in `ConversationClient`: unknown fields are tolerated, missing required fields produce a typed error the modal can render.
- Selector failures (button can't find a place to mount) are silent in console but never break the page.

### Streaming responses

- Copy buttons appear after streaming completes for a given response (observe `data-is-streaming` flipping off, then mount).
- Branch button has the same lifecycle. Branching while a response is still streaming is not supported in v1; the button simply isn't there yet.

## Testing Decisions

### What makes a good test

Tests target the externally observable behavior of each module — the inputs and outputs of its public interface — not its internal data structures or helper functions. Selectors, exact HTML emitted by Turndown, and exact wording of splitter strings should not be asserted character-for-character; instead, assert structural properties (e.g., "the transcript contains a section for every message up to the slice point" rather than "the transcript equals this exact 4000-char string"). Fixtures capture real-world inputs (sample HTML from Claude messages, sample API responses) so tests fail loudly when those inputs change shape.

### Modules under test

1. **TranscriptBuilder** (priority: highest, pure function over fixtures).
   - Given a fixture `Conversation` with text-only messages, slice at the second user prompt → assert the output contains exactly that many turns, in order, with correct labels, and the manifest section is omitted entirely (both sub-sections empty).
   - Given a conversation with a small text attachment (≤ threshold) → assert the file contents appear inline at the relevant turn as a fenced code block and the file is **not** in the manifest.
   - Given a conversation with a large text attachment (> threshold) → assert it appears in the manifest's "Files I attached" sub-section and is **not** inlined.
   - Given a conversation with image attachments → assert they appear in the manifest's "Files I attached" sub-section with an image indicator and never inline.
   - Given a conversation with Claude artifacts → assert each artifact's filename appears in the manifest's "Files you (Claude) generated" sub-section; no artifact content is inlined anywhere.
   - Given a conversation containing `tool_use` / `tool_result` / `thinking` blocks → assert those blocks are dropped from the transcript while accompanying `text` blocks remain.
   - Given an empty conversation → assert builder returns a transcript with the framing paragraph and splitters but no manifest and no turns (graceful, not a crash).
   - Threshold edge cases: file size exactly at `inlineTextThresholdBytes` (specify behavior — inline or manifest — and test it).

2. **HtmlToFormat** (priority: high, pure function over HTML strings).
   - Fixture HTML for a simple paragraph → markdown round-trips to the same paragraph; plain matches `innerText`.
   - Fixture HTML for a fenced code block with a language hint → markdown preserves the fence and language; plain strips the fence.
   - Fixture HTML for nested ordered/unordered lists → markdown preserves nesting.
   - Fixture HTML for a table → markdown emits a GFM table; plain emits whitespace-separated cells.
   - Fixture HTML for inline code, bold, italics, links → markdown preserves them; plain strips formatting but preserves link text.
   - HTML with `<br>` tags → markdown converts to newlines (per the Turndown rule the prior-art fork already established).

3. **ConversationClient** (priority: high, mocked fetch).
   - `getOrgId()` against a fixture response → returns the expected org id.
   - `fetchConversation()` against a fixture response → returns a `Conversation` whose shape matches the documented contract above.
   - Attachment classification: a fixture with PDF, PNG, and `.txt` attachments → each is mapped to the correct `kind` (`binary`, `image`, `text`).
   - Error paths: 401, 404, malformed JSON → each surfaces as a typed error, not an unhandled exception.

### Modules not under unit test (justification)

- **ClipboardWriter, MessageActionInjector, BranchModal** — these are thin wrappers around browser APIs (clipboard, MutationObserver, DOM construction). Their value lies in working correctly against the real browser, which unit tests can't simulate without near-1:1 mocks that test the mock rather than the code. They will be smoke-tested manually before each release: install the unpacked extension on Chrome + Firefox, load a real conversation, exercise every button.

### Prior art

The fork at `../claude-continue-from-here/` has no test infrastructure. This PRD establishes the first test setup for the project. Suggested framework: **Vitest** (fast, ESM-native, jsdom integration for HtmlToFormat). Fixtures live under a `tests/fixtures/` directory: JSON files for `ConversationClient` (sample API responses), HTML files for `HtmlToFormat` (real Claude message snippets), and JS-built `Conversation` objects for `TranscriptBuilder`.

## Out of Scope

- **Auto-attaching files or images to the new branched conversation.** The user explicitly chose the manual re-share flow. Auto-attach requires either Claude's upload API (more reverse engineering, more breakage surface) or simulating file drops on the input element (fragile). Punted to a future PRD if demand emerges.
- **Programmatically creating a new Claude conversation via API and seeding it with prior turns.** The transcript-paste UX is the chosen design; a true API-seeded fork is a different product decision.
- **Settings / options UI.** v1 ships with sensible defaults (inline threshold 20KB, both features enabled). A settings page can be added later if users want to tune the threshold or disable features.
- **Editing transcript before paste.** The modal textarea is read-only in v1. Editing support is a nice-to-have, not a blocker.
- **Search across conversations, conversation export, sidebar enhancements, prompt library** — all out of scope. This extension is about copy and branching only.
- **Mobile / Safari support.** Chrome + Firefox desktop only.
- **Telemetry / analytics.** None — no third-party data flows is a stated user story.

## Further Notes

### Risk: private API stability

Claude's internal conversation API is undocumented and unversioned. Anthropic can change response shapes at any release. Mitigations:

- Defensive parsing in `ConversationClient` (tolerate unknown fields, fail typed on missing required fields).
- Centralized endpoint constants for fast updates.
- Fixtures captured from real responses, dated, so when a breakage occurs we can diff against a known-good snapshot.

### Risk: CSS selector rot

Claude's web UI uses Tailwind classes that look stable but aren't (e.g., `.text-\[12px\]`). Whenever possible, anchor on `data-*` attributes (`data-is-streaming`, `data-test-render-count`) which are more semantic. All selectors live in the constants module so a UI update is a one-file PR.

### Risk: CSP

Claude's site likely ships a strict Content-Security-Policy. Content scripts inject their own JS through the extension's own world and bypass page CSP for code execution, but **remote script loading is forbidden**. Everything stays vendored locally — Turndown is bundled as a file, no CDN, no eval, no inline scripts in the modal. This is already how the fork operates.

### Sequencing

A pragmatic build order:

1. Manifest + project skeleton (one file each for Chrome and Firefox; identical content_scripts).
2. Constants module.
3. **Feature 1 end-to-end** (HtmlToFormat → ClipboardWriter → MessageActionInjector for the copy buttons). Ship this first — it has no API dependency and proves the injection plumbing.
4. **ConversationClient** with test fixtures captured from a real conversation.
5. **TranscriptBuilder** with unit tests.
6. **BranchModal** + wire-up.
7. Manual smoke pass on Chrome and Firefox.
8. Polish: error UI, edge cases (empty conversation, all-image conversation, very long conversations).

### Naming

Product name: **Delta**. The Δ doubles as the mathematical "change" symbol and a river delta where one channel fans out — both nods to branching conversations.

### Open follow-ups

- Capture a real conversation API response (with attachments and artifacts) as the first test fixture before writing `ConversationClient` — the response shape is the ground truth, and guessing it from outside will produce wrong code.
- Decide threshold for inline-text attachments more precisely than "~20KB" once we see how the Claude UI displays such files (do we want to inline things larger than what the user could comfortably scroll through? probably not — 20KB ≈ 400 lines is a reasonable upper bound for v1).
