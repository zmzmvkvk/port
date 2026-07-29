# Learnings

## Cross-browser direct hash entry

Using public hashes such as `#lotte` on the same DOM elements used by the
browser's native anchor scrolling caused a race with the scrub engine in
Firefox, Edge, and mobile WebKit. Static section IDs now use a `career-` prefix
while the public URL keeps the shorter hash.

## Small editorial text contrast

The initial muted and accent colors narrowly missed WCAG AA for small text.
The final darker values pass axe checks in all configured browser projects.

## Media validation

Short-GOP prototype clips remain small because the frames are intentionally
minimal. Build validation, not filesize assumptions, is the source of truth for
codec, resolution, timing, GOP, faststart, audio removal, and frame continuity.

