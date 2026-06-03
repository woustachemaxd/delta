# Inline text attachments with threshold

> Type: **AFK**
> Covers user stories: 18, 19, 22
> Parent doc: `../PRD.md`

## What to build

Extend `TranscriptBuilder` to handle user-attached text-extractable files (anything with `kind === 'text'` and a populated `textContent` from `ConversationClient`). Threshold logic:

- **At or below** `config.inlineTextThresholdBytes` (default 20480 bytes ≈ 20KB) → inline the file's contents at the turn the file was attached to, as a fenced code block preceded by an `Attached file: <name>` heading. Small attachments stay with their turn — they do **not** hoist to the manifest.
- **Above the threshold** → omit the contents from the turn and add the file to the **top manifest** under its "Files I attached" sub-section.

Threshold-boundary behavior must be defined precisely and tested. The PRD specifies `≤ threshold → inline`; this issue is the place to make that explicit in code and in tests.

This is the slice that first populates the manifest scaffolding established in slice 04. The "Files I attached" sub-section is rendered only if it has at least one entry; the wider manifest block is rendered only if at least one sub-section is non-empty. After this slice, the wording for the manifest sub-section header and its trailing instruction is fixed:

> **Files I attached:**
> - `bigdoc.md` (file)
> - `notes.txt` (file)
>
> *Ask the user to share any specific file if you need its contents — they aren't included here.*

(The instruction line is shared across both manifest sub-sections; render it once after the last sub-section, not per-sub-section.)

The extension performs **no** file upload or re-attach. The user is explicit about retaining control of what gets re-shared.

- **`TranscriptBuilder`** extended:
  - Per-message attachment iteration in turn order
  - Inline path emits a heading line (e.g., `Attached file: foo.md`) followed by a fenced code block; use the file extension to pick the fence language hint when reasonable, otherwise leave the fence untagged
  - Manifest path adds the file name and `(file)` indicator to the "Files I attached" list
- **Tests** against the attachment fixture from issue 01:
  - One small text attachment → inlined at its turn, not in manifest
  - One large text attachment → in manifest, not inlined
  - Threshold boundary (file size exactly equal to threshold) → inlined (documented behavior)
  - Both small and large text attachments in the same conversation → small inlined, large in manifest, manifest header rendered exactly once

## Acceptance criteria

- [ ] Text attachments with `sizeBytes ≤ inlineTextThresholdBytes` are inlined at their turn as fenced code blocks under an `Attached file: <name>` heading
- [ ] Text attachments with `sizeBytes > inlineTextThresholdBytes` appear in the top manifest's "Files I attached" sub-section with their name and a `(file)` indicator
- [ ] An attachment whose size exactly equals the threshold is inlined (documented behavior)
- [ ] The manifest's "Files I attached" sub-section header reads exactly: `Files I attached:`
- [ ] The shared manifest-trailing instruction reads exactly: `Ask the user to share any specific file if you need its contents — they aren't included here.`
- [ ] The manifest block is omitted entirely when both sub-sections are empty
- [ ] The extension performs no file upload, drag-drop simulation, or re-attach
- [ ] `TranscriptBuilder` tests cover the inline path, the manifest path, the threshold boundary, and the both-small-and-large mixed case

## Blocked by

- Issue 04 (`TranscriptBuilder` text-only path and `BranchModal` must exist)
