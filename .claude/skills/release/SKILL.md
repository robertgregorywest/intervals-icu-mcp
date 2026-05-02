---
name: release
description: Cut a new release of intervals-icu-mcp: bump versions, build, pack the .mcpb bundle, tag, and push to trigger the GitHub Actions release workflow. Use when user asks to release, ship, publish, or create a new version.
---

# Release

## Steps

- [ ] Bump `version` in `package.json`
- [ ] Bump `version` in `manifest.json` to match
- [ ] Commit: `git add package.json manifest.json && git commit -m "chore: release vX.Y.Z"`
- [ ] Tag and push: `git tag vX.Y.Z && git push && git push --tags`

Pushing the tag triggers the GitHub Actions workflow, which handles build, test, pack, clean, and GitHub Release creation.

To test the bundle locally before tagging, install `mcpb` first — it is not in the project dependencies:

```
npm install -g @anthropic-ai/mcpb
mcpb pack && mcpb clean intervals-icu-mcp.mcpb
```

## MCPB / Claude Desktop Gotchas

- Claude Desktop uses its own **built-in Node.js** (not system Node) and runs with **CWD=`/`**
- `mcp_config.args` in `manifest.json` **must** use `${__dirname}` — bare relative paths won't resolve
- **Never use `console.log`** in the stdio server — corrupts the JSON-RPC transport; use `console.error`
- Manifest env vars use `${user_config.key}` syntax (not `{{key}}`)
