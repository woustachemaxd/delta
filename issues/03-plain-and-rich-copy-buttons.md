# Plain and Rich copy buttons

> Type: **AFK**
> Covers user stories: 1, 5, 6, 8, 9
> Parent doc: `../PRD.md`

## What to build

Extend the copy feature so all three formats agreed in the PRD are available: **Plain**, **MD**, **Rich**. After this slice, every Claude response carries a button group with all three formats.

- **`HtmlToFormat`** extended from a single-format function to one that returns `{markdown, plain, html}` for any given response node. Plain text uses `innerText`; `html` is the cleaned-up `outerHTML` used for the rich-text clipboard write.
- **`ClipboardWriter`** extended with a `rich` mode that writes a `ClipboardItem` carrying both `text/html` and `text/plain` payloads. Paste targets pick the appropriate mime — Google Docs / Notion / email composer take the HTML; plain-text targets take the plain payload.
- **`MessageActionInjector`** updated to mount three buttons (`Plain · MD · Rich`) instead of one, in a compact group that doesn't crowd Claude's existing copy control.
- **Test coverage**: extend `HtmlToFormat` fixtures so plain and rich outputs are asserted alongside the existing markdown tests. Plain output matches `innerText`-style stripping; rich output preserves formatting tags.

The native Ctrl+C / Cmd+C behavior must remain untouched (this slice does not introduce any global keyboard interception).

## Acceptance criteria

- [ ] All three buttons (Plain, MD, Rich) appear on every Claude response in the documented order
- [ ] Plain copies stripped text — no markdown markers, no HTML tags, no styling artifacts
- [ ] Rich copies via `ClipboardItem` with both `text/html` and `text/plain` payloads; pasting into Google Docs / Notion / a rich email composer produces styled output (headings, bold, italics, lists)
- [ ] MD continues to behave as it did in issue 02
- [ ] All three buttons show `Copied!` on success and `Failed` on clipboard rejection
- [ ] Native Ctrl+C / Cmd+C selection copy is unchanged
- [ ] `HtmlToFormat` tests cover plain and rich outputs over the existing fixture HTML set
- [ ] The button group does not visually crowd Claude's native copy control

## Blocked by

- Issue 02 (Markdown copy button)
