# Claude-generated artifacts listed in top manifest

> Type: **AFK**
> Covers user stories: 23
> Parent doc: `../PRD.md`

## What to build

Extend `TranscriptBuilder` so Claude-generated artifacts (each assistant message's `files[]` array — React components, HTML pages, PDFs, canvas documents, etc.) are surfaced in the top manifest's **"Files you (Claude) generated"** sub-section. They are listed by **filename only**. Artifact content is **not** inlined.

> **Files you (Claude) generated:**
> - `Dashboard.tsx` (file)
> - `index.html` (file)
> - `report.pdf` (file)
>
> *Ask the user to share any specific file if you need its contents — they aren't included here.*

This **overrides the original spec for slice 07** which called for inlining artifact content under `Claude artifact: <title>` headings. The override is recorded in the project memory entry `project-claude-artifacts-manifest` — the rationale: artifact-heavy conversations (a "show me everything Claude can do" demo produces 9+ files totalling well over 100KB) bloat the transcript past usefulness when every artifact is inlined. The manifest-list approach degrades gracefully — the next Claude knows the files existed and the user can paste any specific one back.

The manifest's "Files you (Claude) generated" sub-section is rendered iff at least one Claude message in the sliced range has a non-empty `files[]`. The wider manifest block is rendered iff at least one of the two sub-sections is non-empty. Both sub-sections share the single trailing instruction line; render it once after whichever sub-section appears last.

Drop-not-summarize rule applies here too: `tool_use` content blocks for inline-rendered widgets (charts, recipes, etc.) are dropped entirely from the transcript, because the accompanying `text` block already narrates them. Slice 04 establishes this drop rule; this slice does not need to re-implement it but its tests should confirm artifact-bearing messages still drop tool blocks correctly.

- **`TranscriptBuilder`** extended:
  - For each Claude `Message` in the sliced range, iterate `message.artifacts` (the normalized name for the API's `files[]`) and add each filename + `(file)` indicator to the "Files you (Claude) generated" sub-section
  - The sub-section header reads exactly: `Files you (Claude) generated:`
  - Ordering: artifacts appear in the order they were produced across messages, and within a message in the order returned by `ConversationClient` (which preserves the API's order). This must be documented and tested for stability.
- **Tests** against the artifact fixture from issue 01:
  - Single-artifact case: filename appears in the manifest sub-section; no artifact content is in the transcript
  - Multi-artifact case (multiple files in one Claude message): all filenames appear in stable order in the manifest sub-section
  - Cross-message case (artifacts in different Claude messages): all filenames appear, ordered by message order then within-message order
  - Drop-rule check: a message containing a `tool_use` block plus a regular `text` block plus an artifact → text block renders, tool_use is dropped, artifact filename appears in manifest

## Acceptance criteria

- [ ] Each Claude artifact's filename appears in the manifest's "Files you (Claude) generated" sub-section
- [ ] No artifact content is inlined anywhere in the transcript
- [ ] The sub-section header reads exactly: `Files you (Claude) generated:`
- [ ] Each entry carries a `(file)` kind indicator
- [ ] Multiple artifacts (within one message or across messages) render in stable, documented order
- [ ] `tool_use`, `tool_result`, and `thinking` content blocks are confirmed dropped (regression check on the slice 04 rule)
- [ ] `TranscriptBuilder` tests cover single-artifact, multi-artifact-in-one-message, cross-message-multi-artifact, and the drop-rule regression

## Blocked by

- Issue 04 (`TranscriptBuilder` text-only path and `BranchModal` must exist)

Can run in parallel with issues 05 and 06.
