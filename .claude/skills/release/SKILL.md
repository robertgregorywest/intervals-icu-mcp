---
name: release
description: Cut a new release of intervals-icu-mcp: bump versions, build, pack the .mcpb bundle, tag, and push to trigger the GitHub Actions release workflow. Use when user asks to release, ship, publish, or create a new version.
---

# Release

## Steps

- [ ] Bump `version` in `package.json`
- [ ] Bump `version` in `manifest.json` to match
- [ ] `npm run build` — compile TypeScript
- [ ] `npm run mcpb:pack` — produces `intervals-icu-mcp.mcpb`
- [ ] `mcpb clean intervals-icu-mcp.mcpb` — strips dev node_modules (89MB → 2.5MB)
- [ ] Commit: `git add package.json manifest.json && git commit -m "chore: release vX.Y.Z"`
- [ ] Tag and push: `git tag vX.Y.Z && git push && git push --tags`

Pushing the tag triggers the GitHub Actions workflow, which builds, tests, packs the bundle, and creates a GitHub Release with the `.mcpb` file attached.

## MCPB / Claude Desktop Gotchas

- Claude Desktop uses its own **built-in Node.js** (not system Node) and runs with **CWD=`/`**
- `mcp_config.args` in `manifest.json` **must** use `${__dirname}` — bare relative paths won't resolve
- **Never use `console.log`** in the stdio server — corrupts the JSON-RPC transport; use `console.error`
- Manifest env vars use `${user_config.key}` syntax (not `{{key}}`)
