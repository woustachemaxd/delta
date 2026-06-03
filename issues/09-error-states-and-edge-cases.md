# Error states and edge cases (polish)

> Type: **AFK**
> Covers user stories: 26 (extended), 31
> Parent doc: `../PRD.md`

## What to build

Round out the user-facing error behavior and edge-case handling so the extension degrades gracefully under realistic adverse conditions instead of silently failing or crashing the host page.

- **`BranchModal` error rendering**: when `ConversationClient` or `TranscriptBuilder` throws (or returns a typed error), the modal renders the error visibly in its body instead of showing an empty textarea or a half-built transcript. Each error class — HTTP 401, 404, 5xx, network failure, malformed JSON, missing required fields — surfaces with a clear human-readable message.
- **`ConversationClient` defensive-parsing tests**: feed in fixtures with malformed JSON, missing required fields, unexpected types — assert each surfaces a typed error rather than throwing an unhandled exception.
- **`TranscriptBuilder` edge cases**:
  - Empty conversation → returns transcript with framing paragraph + `OPENING_SPLITTER` only; manifest omitted, no turns, no crash
  - Single-message conversation → produces the expected one-turn transcript
  - Very long conversation (e.g., 100 turns) → builds without crashing; no truncation; deterministic output
  - Conversation with manifest contents but zero turns up to the slice point (degenerate but possible if the first message itself is the slice point and carries attachments) → manifest renders, then `OPENING_SPLITTER`, then the one turn
- **`MessageActionInjector` resilience**: a test that points the injector at a deliberately wrong selector verifies the host page is not broken — the injector logs to console and silently no-ops, never throwing into the page's JavaScript context.
- **Third-party data verification**: a test (or audit) confirms the extension makes no outbound `fetch` calls to any host other than `claude.ai`. This is also a privacy claim from the PRD.

## Acceptance criteria

- [ ] HTTP 401, 404, 5xx, network failure, and malformed JSON each produce a visible error message in the modal body
- [ ] `ConversationClient` returns typed errors (no unhandled exceptions) for all malformed-input cases tested
- [ ] Empty conversation produces a transcript with the framing paragraph and `OPENING_SPLITTER` only — no manifest, no turns; no crash
- [ ] Single-message conversation produces the expected one-turn transcript
- [ ] A 100-turn conversation builds without crashing and without truncation
- [ ] A deliberately wrong injector selector does not break the host page; only a console log is emitted
- [ ] No outbound `fetch` calls go to any host other than `claude.ai` (verified by test, audit, or both)

## Blocked by

- Issue 04 (`BranchModal` and `ConversationClient` must exist before their error states can be exercised)
