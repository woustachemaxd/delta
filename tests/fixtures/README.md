# Conversation API fixtures

These JSON files are captured raw responses from Claude's **internal, undocumented**
conversation API. They are the ground truth for `ConversationClient` (slice 04) and
every downstream module that touches conversation data.

> The API is private and unversioned. Anthropic can change the response shape at any
> release. If a fixture stops matching live responses, recapture (procedure below) and
> diff — do not edit fields to make tests pass.

## Required fixtures

| File | Purpose |
| --- | --- |
| `conv-text-only.json` | A conversation with no attachments and no artifacts. Used by `TranscriptBuilder` happy-path tests and the basic `ConversationClient` parse test. |
| `conv-with-attachments.json` | A conversation with at least one text attachment (`.txt`, `.md`, or source), one image, and one PDF/binary attached by the user. Used by attachment-classification and inline-vs-footer threshold tests. |
| `conv-with-artifact.json` | A conversation containing at least one Claude-generated artifact (file in `files[]`). Used by artifact-manifest tests. |

Add new fixtures freely if a future test needs a shape not covered above. Name them
`conv-<short-description>.json` so the intent is obvious from the file name.

## Confirmed endpoint (verified 2026-06-03)

```
GET https://claude.ai/api/organizations/{orgUuid}/chat_conversations/{convUuid}
    ?tree=True&rendering_mode=messages&render_all_tools=true&consistency=strong
```

- Authentication: session cookies (`fetch` with `credentials: 'include'` from a
  page on `claude.ai` is sufficient — no additional headers needed).
- Returns: a single JSON object representing the conversation tree. See
  **Response shape** below.

### Related endpoints (observed during capture, not used by this extension yet)

- `GET /api/organizations` — returns the list of organizations; first element's
  `uuid` is the org id used in the path above. Hit this if you need to discover
  the org id without scraping the URL.
- `GET /api/organizations/{orgUuid}/chat_conversations_v2?limit=30&starred=false&consistency=eventual`
  — list of conversations. Not needed for branching.
- `GET /api/organizations/{orgUuid}/artifacts/{convUuid}/versions?source=w` —
  conversation's artifact-versions stream. Returns `{"artifact_versions": []}`
  for text-only chats. Worth checking when capturing the artifact fixture, but
  not the source of truth for artifact metadata — that lives on the message
  itself (see `files[]` below).

## Response shape

The top-level response is a single JSON object:

```jsonc
{
  "uuid": "<conversation uuid>",
  "name": "<chat title>",
  "summary": "<longer summary, often empty>",
  "model": "claude-opus-4-8",
  "created_at": "2026-06-02T05:13:25.521016Z",
  "updated_at": "2026-06-02T05:37:59.661853Z",
  "settings": { /* feature flags — opaque, ignore */ },
  "is_starred": false,
  "is_temporary": false,
  "platform": "CLAUDE_AI",
  "current_leaf_message_uuid": "<uuid of deepest active message>",
  "chat_messages": [ /* see Message shape */ ]
}
```

### Message shape

Each entry in `chat_messages[]`:

```jsonc
{
  "uuid": "<message uuid>",
  "parent_message_uuid": "<uuid of previous message, or all-zero sentinel for root>",
  "sender": "human" | "assistant",
  "index": 0,                      // ordinal
  "text": "",                      // almost always empty; real text lives in content[]
  "content": [ /* see Content block types */ ],
  "attachments": [ /* user-uploaded, on human messages */ ],
  "files":       [ /* Claude-generated, on assistant messages */ ],
  "sync_sources": [ /* unused so far */ ],
  "input_mode": "text",
  "truncated": false,
  "stop_reason": "end_turn",       // assistant messages only
  "created_at": "...",
  "updated_at": "..."
}
```

The root user message uses the sentinel `parent_message_uuid:
"00000000-0000-4000-8000-000000000000"`. The conversation is a *tree* (forked
branches share ancestors), but `current_leaf_message_uuid` plus walking parents
up gives the active linear chain.

### Content block types

`content[]` is a heterogeneous array of typed blocks. The discriminator is the
`type` field. Observed types and their shapes:

| `type` | Shape | Where seen |
|---|---|---|
| `text` | `{ type, text, citations: [], start_timestamp, stop_timestamp }` | Both senders |
| `thinking` | `{ type, thinking, summaries: [{summary}], cut_off, truncated, start/stop_timestamp }` | Assistant messages with extended thinking enabled |
| `tool_use` | `{ type, id, name, input, message, integration_name, is_mcp_app }` | Assistant only |
| `tool_result` | `{ type, tool_use_id, name, content: [<inner blocks>], is_error, meta, icon_name, display_content, integration_name, message }` | Assistant only (appears in the same `content[]` array as the `tool_use` that triggered it) |

Inside `tool_result.content[]`, more block types appear (each carries its own
`uuid`):

| Inner block `type` | Shape |
|---|---|
| `text` | `{ type, text, uuid }` — most common (the tool's textual output) |
| `image_gallery` | `{ type, images: [{ id, url, thumbnail_url, title, source, page_url, width, height, ... }], uuid, is_expired }` — image search or recipe widgets |
| `local_resource` | `{ type, file_path, name, mime_type, uuid }` — file presentation results |

### Attachments vs files vs sync_sources

Three arrays, two are used. **Both `attachments[]` and `files[]` can appear
on user messages** (this was a surprise — the PRD assumed only one).

- **`attachments[]`** (human messages, sometimes): the *text-extracted* view of
  uploads. An item appears here when Claude pre-extracts content from a
  text-like upload (`.txt`, `.md`, source code, etc.) or when the user pastes a
  large block as an attachment. Shape:
  ```jsonc
  {
    "id": "<attachment uuid>",
    "file_name": "filename.md",   // can be "" for paste-as-attachment
    "file_size": 43285,
    "file_type": "txt",            // extension-based label
    "extracted_content": "<the text>",
    "created_at": "..."
  }
  ```
- **`files[]`** (human and assistant messages): the binary/upload registry.
  - On **human messages**, every uploaded file appears here regardless of type
    (image, document, blob). The same file is **also** in `attachments[]` if
    Claude was able to extract text from it.
  - On **assistant messages**, every file Claude generated appears here (the
    artifact registry). The PRD called these `artifacts[]`; reality is they
    use the same `files[]` array.

  Shape varies by kind:
  ```jsonc
  // image upload
  {
    "success": true,
    "file_kind": "image",
    "file_uuid": "<uuid>",
    "file_name": "screenshot.png",
    "thumbnail_url": "/api/{org}/files/{uuid}/thumbnail",
    "preview_url":   "/api/{org}/files/{uuid}/preview",
    "thumbnail_asset": { "url", "file_variant", "primary_color", "image_width", "image_height" },
    "preview_asset":   { ... },
    "uuid": "<same as file_uuid>"
  }

  // non-image upload (md, pdf, etc.)
  {
    "success": true,
    "file_kind": "blob",
    "path": "/mnt/user-data/uploads/...",     // server-side path; informational
    "file_uuid": "<uuid>",
    "file_name": "notes.md",
    "size_bytes": 43285,
    "created_at": "...",
    "uuid": "<same as file_uuid>"
  }
  ```
- **`sync_sources[]`** (both senders): always `[]` in captures so far. Reserved
  for future use; the parser tolerates it but ignores it.

### Implication for `ConversationClient`

On a user message, attachment classification has to merge the two arrays:

1. Walk `files[]` to get every upload by `file_uuid` (this is the master list
   — image, blob, etc.).
2. Walk `attachments[]` to enrich any item that also has `extracted_content`.
   Matching is by file name (the `attachments[]` `id` is *not* the same as the
   `files[]` `file_uuid`, and `file_name` may be empty on
   paste-as-attachment items — so the merge is best-effort, not strict).
3. Derive `kind`:
   - `files[].file_kind === "image"` → `"image"`
   - Otherwise, by extension on `file_name`: `.txt`/`.md`/source → `"text"`;
     everything else → `"binary"`.
   - If an item has `extracted_content` in `attachments[]`, it is `"text"`
     regardless of extension (paste-as-attachment puts `file_name: ""`).

## Normalization (what `ConversationClient` produces)

The PRD's `Conversation` / `Message` / `Attachment` / `Artifact` contract is the
*normalized* shape — what consumers downstream see. Mapping rules:

| Raw response | Normalized |
| --- | --- |
| `chat_messages[]` | `messages[]` (ordered by walking `parent_message_uuid` from the leaf) |
| `sender: "human" \| "assistant"` | `sender: "user" \| "claude"` |
| `content[]` with mixed block types | `text: string` — concatenate `type: "text"` blocks only; **drop** `thinking`, `tool_use`, `tool_result` (see Transcript policy below for why) |
| `attachments[]` on user messages | per-message `attachments[]` with `kind` derived from MIME |
| `files[]` on Claude messages | per-message `artifacts[]` (rename for consistency with PRD) |
| `parent_message_uuid` tree | flattened to ordered list by walking from `current_leaf_message_uuid` upward, then reversing |
| `00000000-0000-4000-8000-000000000000` parent | treated as "no parent" — this is the conversation root |

## Transcript rendering policy

The transcript is what `TranscriptBuilder` produces and what the user pastes
into a fresh Claude chat. It is **purely mechanical** — no Claude, no LLM, no
semantic summarization. Just string assembly from normalized data.

### Block-by-block rules

| Source | Goes into transcript |
|---|---|
| User message `text` content | Verbatim, labeled `User Prompt N:` |
| Claude message `text` content | Verbatim, labeled `Claude Response to User Prompt N:` |
| Claude message `thinking` content | **Dropped** — it's internal reasoning, not part of the conversation flow |
| Claude message `tool_use` blocks | **Dropped** — Claude's own text blocks usually narrate what was looked up, so the next Claude gets a human-readable account for free |
| Claude message `tool_result` blocks (including nested `image_gallery`, `local_resource`) | **Dropped** — same reason |
| User `attachments[]`, text type, ≤ 20480 bytes | Inlined under the relevant turn as a fenced code block with the filename as heading |
| User `attachments[]`, text type, > threshold | Listed in the top-of-transcript manifest |
| User `attachments[]`, image / binary | Listed in the top-of-transcript manifest |
| Claude `files[]` (any) | Listed in the top-of-transcript manifest |

### Transcript structure

```
I'd like to continue from a previous conversation; here it is.

Files that were part of this conversation but aren't included below.
Please ask me to share them if you need them:

  Files I attached:
  - prd-draft.md
  - screenshot.png

  Files you (Claude) generated:
  - counter.jsx
  - rent-split-model.xlsx

========================================
User Prompt 1:
<text>

[Small text attachment inlined here as a fenced block if under 20KB]
----------------------------------------
Claude Response to User Prompt 1:
<text>
========================================
User Prompt 2:
...
```

Empty manifest sections (or the entire manifest block) are omitted when there's
nothing to list — no "Files: none" clutter.

### Why this overrides slice 07's original "inline artifacts" spec

Slice 07 originally said *"I want the artifact contents included inline in the
transcript, so that I don't lose Claude's work."* In practice, an artifact-heavy
conversation (e.g., a capabilities demo) produces 9+ files totalling well over
100KB. Inlining all of them would balloon the transcript and bury the actual
conversation. The manifest-list approach degrades gracefully: the next Claude
knows the files existed and can ask for any of them.

## Privacy / redaction

While the repo is private and the published extension excludes `tests/`,
fixtures can carry real personal content without breaking anything. However:

- **Always redact** the org UUID (in URLs recorded in the capture log) and the
  conversation UUID. They're effectively credentials tied to your account.
- **Always redact** message UUIDs, since they reference real chats and could
  leak into git history if the repo's visibility ever changes.
- **Prefer to redact** content — names, locations, work-project terms,
  flatmate names, phone numbers, real third-party URLs (Etsy listings, Maps
  place IDs, etc.) — when you can. It's cheap insurance against the privacy
  setting flipping later. For artifact / attachment fixtures, easier to
  capture a deliberately neutral conversation up-front than to scrub one
  after the fact.

When redacting:

- **Preserve structure.** Field names, nesting depth, array lengths, value
  types stay exactly as captured. Only the *contents* of string fields change.
- **Keep linkage.** If you redact a message UUID, the next message's
  `parent_message_uuid` and the top-level `current_leaf_message_uuid` must be
  updated to match. Same for attachment / file UUIDs referenced inside
  message content.
- **Do not invent fields** the API didn't return. Do not delete fields even if
  they look empty — the parser needs to see the real shape.

## Capture procedure

### 1. Open DevTools on a conversation

1. Open the target Claude conversation at `https://claude.ai/chat/{convUuid}`.
2. Open DevTools → **Network** tab, set the type filter to **XHR** (Firefox) or
   **Fetch/XHR** (Chrome).
3. Clear the network log (trash-can icon).
4. **Hard reload** (Cmd+Shift+R on Mac, Ctrl+Shift+R on Win/Linux). SPA route
   navigation does *not* fire the conversation fetch — only a fresh page load
   does.
5. Wait for the chat to render. In the network list, look for a row whose URL
   contains the conversation UUID, ending in
   `chat_conversations/{convUuid}?tree=True&…&consistency=strong`.

### 2. Capture the response body

- **Firefox:** click the request → **Response** tab → toggle **Raw** on → select
  all text → copy.
- **Chrome:** right-click the request → **Copy → Copy response**.

Paste into the appropriate fixture file. Validate JSON:

```bash
jq -e . tests/fixtures/conv-text-only.json > /dev/null
```

### 3. Sanity-check after redaction

```bash
# JSON validity
for f in tests/fixtures/conv-*.json; do
  echo "=== $f ==="
  jq -e . "$f" > /dev/null && echo "valid JSON"
done

# Shape glance
for f in tests/fixtures/conv-*.json; do
  echo "=== $f ==="
  jq '{
    name,
    message_count: (.chat_messages | length),
    senders: ([.chat_messages[].sender] | unique),
    user_attachment_counts: [.chat_messages[] | select(.sender == "human") | .attachments | length],
    claude_file_counts:     [.chat_messages[] | select(.sender == "assistant") | .files | length],
    block_types: [.chat_messages[].content[].type] | unique
  }' "$f"
done
```

## Capture log

Record the exact URL each fixture was captured from. Update whenever a fixture
is recaptured. Org UUID and conversation UUID redacted to placeholders.

| Fixture | Captured URL (org and conv redacted) | Date |
| --- | --- | --- |
| `conv-text-only.json` | `/api/organizations/{org}/chat_conversations/{conv}?tree=True&rendering_mode=messages&render_all_tools=true&consistency=strong` | 2026-06-03 |
| `conv-with-artifact.json` | `/api/organizations/{org}/chat_conversations/{conv}?tree=True&rendering_mode=messages&render_all_tools=true&consistency=strong` | 2026-06-03 |
| `conv-with-attachments.json` | `/api/organizations/{org}/chat_conversations/{conv}?tree=True&rendering_mode=messages&render_all_tools=true&consistency=strong` | 2026-06-03 |
