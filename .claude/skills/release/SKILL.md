---
name: release
description: Cut a new release of intervals-icu-mcp: bump versions in package.json and manifest.json, commit, tag, and push to trigger the GitHub Actions release workflow. Use when user asks to release, ship, or create a new version.
---

# Release

## Steps

- [ ] Verify `manifest.json` `tools[]` and `prompts[]` match what the server registers (see check below)
- [ ] Bump `version` in `package.json`
- [ ] Bump `version` in `manifest.json` to match
- [ ] Commit: `git add package.json manifest.json && git commit -m "chore: release vX.Y.Z"`
- [ ] Tag and push: `git tag vX.Y.Z && git push && git push --tags`

Pushing the tag triggers the GitHub Actions workflow, which handles build, test, pack, clean, and GitHub Release creation.

## Manifest staleness check

The manifest's `tools[]` and `prompts[]` arrays must match what the server actually registers — they're how Claude Desktop's UI advertises capabilities. Drift here doesn't break the server (the live tool list comes from `tools/list` over MCP), but it does break discoverability for users browsing the bundle.

Run before bumping versions:

```bash
# Tools — empty diff means in sync
diff <(perl -0777 -nE 'say $1 while /\btool\(\s*"([^"]+)"/g' src/mcp/server.ts | sort) \
     <(jq -r '.tools[].name' manifest.json | sort)

# Prompts — eyeball both lists
perl -0777 -nE 'say $1 while /registerPrompt\(\s*"([^"]+)"/g' \
  src/mcp/server.ts src/mcp/prompts/*.ts | sort -u
jq -r '.prompts[].name' manifest.json | sort
```

(Perl rather than `grep` because the registrations span newlines: `tool(\n    "name",`.)

If something's missing from the manifest, add it before tagging. Each `tools[]` entry is `{ "name": "..." }`; each `prompts[]` entry needs `name`, `description`, and `text` (validated by `npx mcpb validate manifest.json`).

## MCPB / Claude Desktop Gotchas

- Claude Desktop uses its own **built-in Node.js** (not system Node) and runs with **CWD=`/`**
- `mcp_config.args` in `manifest.json` **must** use `${__dirname}` — bare relative paths won't resolve
- **Never use `console.log`** in the stdio server — corrupts the JSON-RPC transport; use `console.error`
- Manifest env vars use `${user_config.key}` syntax (not `{{key}}`)
