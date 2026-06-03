# Image, PDF, and binary attachments in top manifest

> Type: **AFK**
> Covers user stories: 20, 21, 22
> Parent doc: `../PRD.md`

## What to build

Extend `TranscriptBuilder` so user-attached images (`kind === 'image'`) and binary files such as PDFs (`kind === 'binary'`) are listed in the top manifest's "Files I attached" sub-section. They are never inlined — embedding image bytes or PDF binaries into a text prompt is meaningless and would only bloat the prompt.

This slice composes with issue 05 — the same "Files I attached" manifest sub-section holds large text attachments (from slice 05), images, and binaries. Their visual grouping is a single flat list; each entry carries a kind indicator so the receiving Claude can distinguish them:

> **Files I attached:**
> - `foo.png` (image)
> - `screenshot.jpg` (image)
> - `bigdoc.pdf` (file)
> - `largetext.md` (file)
>
> *Ask the user to share any specific file if you need its contents — they aren't included here.*

- **`TranscriptBuilder`** extended to iterate image and binary attachments per message and add each to the manifest with its kind indicator (`(image)` for images, `(file)` for all other binaries)
- **Tests** against the attachment fixture from issue 01:
  - An image attachment appears in the manifest with `(image)` indicator
  - A PDF appears in the manifest with `(file)` indicator
  - Neither images nor binaries appear inline anywhere in the transcript
  - A mixed conversation (image + binary + small text + large text) renders one combined manifest list in the documented order

## Acceptance criteria

- [ ] Image attachments (`kind === 'image'`) appear in the manifest's "Files I attached" sub-section with their name and an `(image)` indicator
- [ ] PDF and other binary attachments (`kind === 'binary'`) appear in the manifest with their name and a `(file)` indicator
- [ ] Neither images nor binaries are inlined anywhere in the transcript
- [ ] Image and binary entries coexist with large-text entries from slice 05 in a single "Files I attached" sub-section
- [ ] No file upload, drag-drop simulation, or re-attach is performed
- [ ] `TranscriptBuilder` tests cover the image path, the binary path, and a mixed-kind manifest assembly

## Blocked by

- Issue 04 (`TranscriptBuilder` text-only path and `BranchModal` must exist)

Can run in parallel with issue 05.
