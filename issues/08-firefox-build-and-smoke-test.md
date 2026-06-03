# Firefox build and manual smoke test

> Type: **HITL** — value is a real-browser smoke test, not code
> Covers user stories: 29
> Parent doc: `../PRD.md`

## What to build

Add a Firefox MV3 manifest and verify both features work in Firefox. The extension is pure content scripts plus DOM, `fetch`, and Clipboard API — all of which behave identically across Chrome and Firefox — so no JavaScript code changes are expected. The work is mostly a manifest delta plus a careful manual pass.

- `manifest.firefox.json` matches `manifest.chrome.json` plus the `browser_specific_settings.gecko.id` field that Firefox requires
- README section documenting:
  - How to load the unpacked extension in Firefox via `about:debugging` → "This Firefox" → "Load Temporary Add-on"
  - Any commands needed to produce the Firefox bundle (if any — current architecture suggests there's no build step beyond having two manifests)
- Manual smoke pass in Firefox on a real conversation:
  - All three copy buttons (Plain, MD, Rich) appear and work; paste targets receive the right formats
  - **Branch from here** button appears on every Claude response
  - Modal opens, transcript is correct, Copy/Download/Close work
  - Test a text-only conversation
  - Test a conversation with attachments (text inline, large/image/binary in footer)
  - Test a conversation with artifacts (embedded inline)
  - Confirm no JavaScript console errors during normal operation
- Any browser-specific deltas discovered (selectors that don't resolve, clipboard quirks, manifest validation differences) are filed as separate follow-up issues. Do **not** block this issue on fixing them unless they're trivial one-liners.

## Acceptance criteria

- [ ] `manifest.firefox.json` exists with `browser_specific_settings.gecko.id` set
- [ ] The extension loads unpacked in Firefox via `about:debugging` without manifest validation errors
- [ ] All three copy buttons function correctly in Firefox
- [ ] **Branch from here** button + modal function correctly in Firefox
- [ ] No JavaScript console errors during normal operation across the smoke-test scenarios above
- [ ] README documents the Firefox install procedure
- [ ] Any browser-specific deltas are filed as separate follow-up issues (referenced from this one as it closes)

## Blocked by

- Issue 03 (Plain and Rich copy buttons must be implemented in order for the smoke test to cover them)
- Ideally also issues 04–07 so the branching feature can be smoke-tested too. This issue may be picked up before those land if branching coverage is deferred to a follow-up smoke pass.
