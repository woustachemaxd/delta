# Branch from here — text-only conversations

> Type: **AFK**
> Covers user stories: 12, 13, 14, 15, 16, 17, 24, 26, 30
> Parent doc: `../PRD.md`

## What to build

The second feature's tracer bullet. A **Branch from here** button is injected on every Claude response. Clicking it fetches the full conversation via Claude's internal API, formats a transcript of all turns up to and including the clicked response, and opens a modal that lets the user copy or download the transcript and paste it into a new Claude chat to continue from that point.

Scope is **text-only conversations** for this slice — attachments and artifacts are handled in follow-up slices (05–07). The plumbing built here (`ConversationClient`, `TranscriptBuilder` text path, `BranchModal`) must be designed to extend cleanly to those features without rework.

- **`ConversationClient`** — speaks Claude's internal API.
  - `getOrgId() → Promise<string>` discovers the org UUID (single fetch, cached for the session)
  - `fetchConversation(orgId, convUuid) → Promise<Conversation>` fetches the full conversation tree with `credentials: 'include'` so the existing session cookie authenticates the call
  - Normalizes the response into the contract defined in the PRD (`Conversation`, `Message`, `Attachment`, `Artifact` shapes)
  - **Defensive parsing**: unknown fields tolerated, missing required fields produce a typed error the modal can render. Attachment `kind` derived from `mimeType` (`text` / `image` / `binary`).
  - Tests against the fixtures captured in issue 01: the text-only fixture parses to the expected shape; the attachment fixture's attachments classify correctly even though this slice doesn't render them.
- **`TranscriptBuilder`** (text-only path) — pure function, no DOM, no network.
  - `build(conversation, sliceAtMessageUuid, config) → string`
  - Output structure (text-only slice — manifest section is empty here so it's omitted, but the structure is in place for slices 05–07 to extend):
    1. Framing paragraph
    2. *(manifest section — omitted entirely when empty, which is always the case in this text-only slice)*
    3. `OPENING_SPLITTER`
    4. Numbered turns separated by `SPLITTER`
    5. End (no closing footer, no closing manifest — the last turn is the last thing in the transcript)
  - Each turn labeled `User Prompt N:` or `Claude Response to User Prompt N:`
  - Slice point: include the user prompt and every turn up to and including the Claude response whose UUID was passed
  - `tool_use` / `tool_result` / `thinking` content blocks are dropped; only `text` blocks render to the transcript
  - Empty-conversation edge case returns the framing paragraph and `OPENING_SPLITTER` only — no manifest, no turns, no crash
  - Tests against the text-only fixture: a known-shape conversation slices to the expected turn count, in the expected order, with the expected labels.
- **`BranchModal`** — DOM UI.
  - `open(transcriptText) → void` builds a resizable modal with a read-only textarea showing the transcript, plus **Copy**, **Download**, **Close**
  - Renders error states when given an error object instead of transcript text (used in issue 09 for polish; basic happy-path-with-error here)
- **`MessageActionInjector`** extended to mount the Branch button next to the copy buttons. Click handler calls `ConversationClient`, then `TranscriptBuilder`, then `BranchModal.open`.

Demoable: open a text-only conversation, click **Branch from here** on the 3rd Claude response, modal shows turns 1–3 with the framing header, click Copy, paste into a new Claude chat, new Claude understands the context.

## Acceptance criteria

- [ ] **Branch from here** button appears on every Claude response
- [ ] Clicking it fetches the full conversation via Claude's internal API (no DOM scraping for message content — DOM is only used to find the clicked response's UUID)
- [ ] Modal opens containing a transcript with all turns up to and including the clicked response
- [ ] Each turn is labeled `User Prompt N` / `Claude Response to User Prompt N` with the documented splitter delimiters between turns
- [ ] Transcript starts with a framing paragraph instructing the new Claude to continue from this conversation
- [ ] **Copy** copies the transcript to the clipboard; **Download** saves a `.txt` file; **Close** removes the modal
- [ ] Modal is resizable
- [ ] API failure (network error, non-2xx, malformed JSON) surfaces as a visible error message in the modal; the host page never crashes
- [ ] `ConversationClient` tests pass against the captured text-only and attachment fixtures (attachment classification verified even though rendering is in a later slice)
- [ ] `TranscriptBuilder` tests cover the text-only path including the empty-conversation edge case and a slice-at-Nth-message case
- [ ] No outbound network calls to any host other than `claude.ai`

## Blocked by

- Issue 01 (fixtures must exist before `ConversationClient` and `TranscriptBuilder` can be tested)
- Issue 02 (constants module, content script entry, and `MessageActionInjector` from the copy-button slice are reused here)
