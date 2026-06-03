# Capture conversation API fixtures

> Type: **HITL** — only the developer has access to real Claude conversations
> Covers user stories: 25, 32 (infrastructure)
> Parent doc: `../PRD.md`

## What to build

Capture real JSON responses from Claude's internal conversation API and commit them as test fixtures. This unblocks all branching-feature work because the response shape is the ground truth — anything written without seeing real responses is guesswork that will produce wrong code.

Three fixtures are needed, each captured from a separate real conversation:

1. **Text-only conversation** — no attachments, no artifacts. Used by the `TranscriptBuilder` happy-path tests and by `ConversationClient` for the basic parse test.
2. **Conversation with mixed attachments** — at least one text attachment (`.txt`, `.md`, or source code), one image, and one PDF/binary. Used by attachment-classification tests and by the inline-vs-footer logic tests.
3. **Conversation with at least one Claude artifact** — canvas document or code artifact. Used by the artifact-embedding tests.

The captured JSON is the raw body of the conversation API call (the exact URL and query string should be verified live in the browser network tab, since it is undocumented and may evolve). The current observed shape is approximately:

```
GET /api/organizations/{orgUuid}/chat_conversations/{convUuid}
    ?tree=True&rendering_mode=messages&render_all_tools=true
```

Each fixture should be reviewed for PII and proprietary content before commit; redact or replace as needed while preserving the structural shape (field names, nesting, types).

A short `tests/fixtures/README.md` documents the capture procedure so future fixtures can be added without re-discovering the URL or steps.

## Acceptance criteria

- [ ] `tests/fixtures/conv-text-only.json` exists with a captured real response from a text-only conversation
- [ ] `tests/fixtures/conv-with-attachments.json` exists and includes at least one text, one image, and one PDF/binary attachment
- [ ] `tests/fixtures/conv-with-artifact.json` exists and includes at least one Claude-generated artifact
- [ ] `tests/fixtures/README.md` documents the capture procedure: the URL pattern, DevTools steps, and how to sanitize before commit
- [ ] All fixtures have been reviewed for PII and proprietary content; any sensitive substrings are replaced with placeholders while preserving structure
- [ ] The exact URL (with query params) used to capture each fixture is recorded in the README

## Blocked by

None — can start immediately.
