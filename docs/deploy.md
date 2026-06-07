# Deploying the remote MCP transport (Deno Deploy)

The remote transport (`src/mcp/http.ts`) runs on the **new** Deno Deploy platform
(org `swanny`, app `swanny-mcp`). See ADR 0006 (auth) and ADR 0007 (runtime).

- **Production URL:** https://swanny-mcp.swanny.deno.net
- **Dashboard:** https://console.deno.com/swanny/swanny-mcp

## Prerequisites

- `deno` (2.8+). Installed at `~/.deno/bin/deno` on the dev box.
- A Deno Deploy **org token**. On WSL the system keychain is unavailable, so
  interactive login can't persist — supply the token via env instead. Keep it in
  a file outside the repo (e.g. `~/.deno-deploy-token`, no trailing newline) and
  read it inline so it never lands in shell history:
  `DENO_DEPLOY_TOKEN="$(tr -d '\r\n' < ~/.deno-deploy-token)" deno deploy ...`

## First deploy (creating the app)

```bash
DENO_DEPLOY_TOKEN="$(tr -d '\r\n' < ~/.deno-deploy-token)" deno deploy create \
  --org swanny --app swanny-mcp --source local \
  --do-not-use-detected-build-config \
  --region eu --runtime-mode dynamic \
  --entrypoint src/mcp/http.ts \
  --install-command "npm install --omit=dev --ignore-scripts" \
  --ignore .env --ignore node_modules --ignore dist
```

## Subsequent deploys

The CLI persisted `org`/`app` into `deno.json`'s `deploy` block, so new revisions
are just:

```bash
DENO_DEPLOY_TOKEN="$(tr -d '\r\n' < ~/.deno-deploy-token)" deno deploy --prod
```

## Gotchas (each one cost us a failed build)

- **Detection overrides your flags.** Without `--do-not-use-detected-build-config`
  the platform guessed `entrypoint src/index.ts` (the facade — no `app.listen`,
  so the warming/health phase fails) and a plain `npm install`.
- **`--source local` is required** for a non-GitHub deploy.
- **No CLI delete.** Removing/recreating an app is dashboard-only
  (Settings → Delete Application). `create` errors with an opaque internal error
  if the app name already exists.
- **`--omit=dev --ignore-scripts` is load-bearing.** It skips the
  `file:../trainingpeaks-mcp` devDependency and husky's `prepare` hook, both of
  which break a clean install on the builder.
- **Unstable flags travel in `deno.json`.** `unstable: ["sloppy-imports", "kv"]`
  is honored by Deploy's runtime; the `.js`-for-`.ts` specifiers won't resolve
  without it.

## Smoke test

```bash
curl -s https://swanny-mcp.swanny.deno.net/healthz
# {"status":"ok","transport":"remote-http"}
```

With no secrets set, `POST /mcp` returns a clean 401 ("No INTERVALS_API_KEY ...").

## Secrets

```bash
# DEV mode (single shared key) — temporary, for testing a real tool call:
deno deploy env add INTERVALS_API_KEY <key> --secret
# Federated mode (later): the AES master key for the token store
deno deploy env add TOKEN_ENC_KEY <base64-32-bytes> --secret
```

## Going live: register the Intervals.icu OAuth app

Federated auth (ADR 0006) needs an Intervals.icu OAuth app. Registration is
**manual** — email `api@intervals.icu` with:

- [ ] App name (e.g. "Swanny Coach")
- [ ] Description
- [ ] Website URL
- [ ] Logo URL — square, ≥128×128
- [ ] Privacy policy URL
- [ ] Redirect URI(s): `https://swanny-mcp.swanny.deno.net/oauth/callback`
      (plus `http://localhost/...` for dev — localhost is always permitted)
- [ ] Your Intervals.icu athlete ID (from `/settings`)

After approval the app appears at Intervals.icu `/settings` → **Manage App** for
the `client_id`/`client_secret`. Scopes to request (least-privilege, no `CHATS`):
`ACTIVITY:READ,WELLNESS:READ,SETTINGS:READ,CALENDAR:WRITE,LIBRARY:WRITE`.
