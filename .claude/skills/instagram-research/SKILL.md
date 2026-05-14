---
name: instagram-research
description: Download all images + caption from a public Instagram post so the model can read them. Use whenever the user pastes an instagram.com/p/<shortcode>/ URL and asks for analysis, summary, or to fold insights into the project. WebFetch cannot read Instagram (auth wall); this skill is the only reliable path.
---

# instagram-research

User regularly shares Instagram posts with cycling/coaching insights (e.g. @knowledgeiswatt, @inscyd). Instagram blocks unauthenticated HTTP, so `WebFetch` returns nothing useful — captions and carousel images both need a real download. This skill is the workflow.

## When to invoke

The user message contains an `instagram.com/p/<shortcode>/` URL **and** asks for analysis, reading, or integration into the project. If the user is just sharing a link without asking for analysis, ask first.

## The command

```bash
SC=<shortcode>   # the path segment after /p/ in the URL
mkdir -p docs/personal/instagram/$SC
gallery-dl -D docs/personal/instagram/$SC --write-metadata \
  --cookies-from-browser chrome \
  "https://www.instagram.com/p/$SC/"
```

Output layout (one JSON sidecar per image):

```
docs/personal/instagram/<shortcode>/
  <id>_<media_id_1>.jpg
  <id>_<media_id_1>.jpg.json
  <id>_<media_id_2>.jpg
  ...
```

The directory `docs/personal/` is already gitignored — downloads stay local.

## After download

1. **Get caption + tags from any one JSON** — `description`, `tags`, `username`, `post_date` are identical across sidecars in a carousel.
2. **Order the slides by the `num` field** in each JSON (carousel position 1..N). Filenames are not in slide order.
3. **Read each image in order** with the `Read` tool (multimodal). Transcribe the substantive text and describe any charts/diagrams in your head before summarising.
4. **Cite sources visible on the slides** (e.g. "Vaccari et al. 2020", "Odden et al. 2024") so the user can verify the underlying paper before you change project code.

## Where insights typically land

Cycling/coaching IG posts almost always map to one of these:

- **`/.claude/skills/intervals-coach/session-patterns.md`** — a new named session template (e.g. "preloaded short intermittents"). Most common landing spot.
- **`/.claude/skills/intervals-coach/power-conversion.md`** — only if the post changes how %MAP / %FTP / Z-zones get translated to watts.
- **`src/services/workout-library/seed.ts`** — if the new pattern is canonical enough to ship as a seeded library workout. Carry a `<!-- rationale … -->` block so it stays refreshable when MAP/FTP change.
- **`src/mcp/syntax-doc.ts`** — only if the post changes server-tool-binding rules (workout-text syntax, watts-at-API rule). Rare.
- **`docs/adr/`** — if the post nudges an architectural decision (e.g. a new computed athlete-state field). Rare.

Default: prefer adding a named pattern to `session-patterns.md` over carving new code paths. The pattern can be invoked by the `intervals-coach` skill without server changes.

## Cookie troubleshooting

`gallery-dl --cookies-from-browser chrome` reads Chrome's encrypted cookie DB on macOS. Two failure modes:

1. **HTTP redirect to login** — your stored cookies are stale or expired. Open Chrome, visit instagram.com, confirm you're logged in, retry.
2. **Command hangs with no output** — Chrome is running and has the cookie DB locked. Ask the user to fully quit Chrome (Cmd+Q, not just close window) and retry.

If both fail, fall back to a manual `cookies.txt`: install a "Get cookies.txt LOCALLY" Chrome extension, export instagram.com cookies, save to `~/.config/gallery-dl/instagram-cookies.txt`, then swap `--cookies-from-browser chrome` for `--cookies ~/.config/gallery-dl/instagram-cookies.txt`. This path also works while Chrome is open.

## What not to do

- **Do not** `WebFetch` the Instagram URL — it returns "[Content truncated due to length...]" or a login redirect. Wastes a turn.
- **Do not** guess slide content from the URL shortcode or the user's hint. Read the actual images.
- **Do not** check downloaded images into git. `docs/personal/` is gitignored; keep it that way.
- **Do not** auto-propose code changes from a single post. Summarise the insight, cite the paper(s), and ask the user before editing any project file beyond skill docs.
