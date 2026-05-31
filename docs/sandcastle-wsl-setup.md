# Sandcastle on WSL

This repo's `npm run sandcastle` orchestration must run **inside WSL**, against a
WSL-native checkout. This document explains why, records the current setup, and
gives getting-started steps (including how to recreate it on a fresh machine).

## Why WSL (not Windows/PowerShell)

The Docker daemon on this machine is a **Linux daemon hosted in the `aurora_wsl`
WSL distro**. The Windows `docker.exe` reaches it over `tcp://docker.local:2375`
with **no path translation** — it is not Docker Desktop.

Sandcastle derives its bind-mount from `process.cwd()`. Run from PowerShell, that
is a Windows path (`C:/GitHub/...`) which the Linux daemon cannot resolve, and
sandcastle's default `:z` SELinux mount suffix adds a colon-part the Linux volume
parser rejects. The run dies immediately at sandbox creation with:

```
docker: Error response from daemon: invalid volume specification:
'C:/GitHub/.../intervals-icu-mcp:/home/agent/workspace:z'
```

Run from inside WSL, `process.cwd()` is a native Linux path the daemon mounts
cleanly, and `:z` becomes a harmless no-op (WSL2's kernel doesn't enforce
SELinux). **No code change is needed** — leave `selinuxLabel` at its default in
`.sandcastle/main.ts`.

## Current setup

| Thing          | Value                                                      |
| -------------- | ---------------------------------------------------------- |
| WSL distro     | `aurora_wsl` (hostname `AER-OXF-DEV-RWE`)                  |
| Repo (primary) | `~/personal/intervals-icu-mcp` on the distro's native ext4 |
| Docker         | Linux daemon in `aurora_wsl`, reached via local socket     |
| `DOCKER_HOST`  | unset inside the distro (uses the socket — leave it unset) |
| Node           | v22 at `~/.local/node` (per-user, no sudo)                 |
| Secrets        | `.sandcastle/.env` → `CLAUDE_CODE_OAUTH_TOKEN`, `GH_TOKEN` |

`~/.local/node/bin` is prepended to `PATH` in both `~/.bashrc` and `~/.profile`,
so login terminals use this Node rather than the Windows `fnm`/`nvm` install that
leaks onto `PATH` via `/mnt/c`. The sandcastle container installs its own `gh` and
Claude CLI (see `.sandcastle/Dockerfile`), so the host needs neither.

## Getting started

Open the distro (Windows Terminal → `aurora_wsl`, or `wsl -d aurora_wsl`), then:

```bash
cd ~/personal/intervals-icu-mcp
npm install        # first time, or after dependency changes
npm run sandcastle
```

A full run spawns an Opus planner plus parallel implementer agents — it spends
real tokens, runs for a while, and creates branches/commits. Logs stream to
`.sandcastle/logs/` (e.g. `tail -f .sandcastle/logs/main-planner.log`).

### Editing with VS Code

Use the **WSL** extension (`ms-vscode-remote.remote-wsl`) so VS Code edits the
native Linux files directly:

```bash
cd ~/personal/intervals-icu-mcp
code .             # opens a "[WSL: aurora_wsl]" window
```

The integrated terminal opens inside the distro, so `npm run sandcastle` just
works. Avoid opening the repo via the `\\wsl.localhost\aurora_wsl\...` UNC path as
a plain Windows folder — that runs the extension host and terminal Windows-side
over 9p (slow, and the terminal isn't in the distro).

## Recreating on a fresh machine

1. **Install a Linux Node (≥20)** in the distro, no sudo required:
   ```bash
   ver=$(curl -fsSL https://nodejs.org/dist/index.json \
     | grep -oE '"version":"v22[0-9.]+"' | head -1 | cut -d'"' -f4)
   mkdir -p ~/.local/node
   curl -fsSL "https://nodejs.org/dist/$ver/node-$ver-linux-x64.tar.xz" \
     | tar -xJ -C ~/.local/node --strip-components=1
   # prepend to PATH for login + interactive shells
   for f in ~/.bashrc ~/.profile; do
     grep -q '.local/node/bin' "$f" 2>/dev/null \
       || echo 'export PATH="$HOME/.local/node/bin:$PATH"' >> "$f"
   done
   ```
2. **Clone the repo into the native filesystem** (not `/mnt/c`). The
   `github.com-personal` host below is an SSH alias from the multi-account git
   setup (`~/.ssh/config` + per-directory `~/.gitconfig` `includeIf`); it selects
   the personal key so this repo authenticates and commits as the personal
   account. Substitute a plain `git@github.com:` / HTTPS URL if you haven't set
   that up.
   ```bash
   mkdir -p ~/personal
   git clone git@github.com-personal:robertgregorywest/intervals-icu-mcp.git ~/personal/intervals-icu-mcp
   cd ~/personal/intervals-icu-mcp && npm install
   ```
3. **Create `.sandcastle/.env`** from `.sandcastle/.env.example`. For Claude
   auth set **`CLAUDE_CODE_OAUTH_TOKEN`** (generate with `claude setup-token` —
   a `sk-ant-oat01-…` subscription token) **or** `ANTHROPIC_API_KEY` (a
   `sk-ant-api03-…` console key), not both. Also set a GitHub `GH_TOKEN`
   (Issues: read/write, Metadata: read). sandcastle's `EnvResolver` forwards
   every key declared in this file into the sandbox container.
4. **Verify** the daemon is reachable from the distro:
   ```bash
   docker info --format '{{.Name}} {{.OSType}}'   # expect: <host> linux
   ```

## Troubleshooting

- **`invalid volume specification ... :z`** — you're running from Windows, not
  inside WSL. `cd ~/personal/intervals-icu-mcp` in the `aurora_wsl` distro and re-run.
- **`npm` resolves to a Windows version (wrong number)** — your shell picked up
  the leaked Windows Node via `/mnt/c`. Confirm `command -v node` points at
  `~/.local/node/bin/node`; if not, ensure the `PATH` line is in `~/.profile` and
  start a fresh login shell.
- **Docker unreachable** — check `DOCKER_HOST` is unset inside the distro so the
  CLI uses the local socket.
- **`Invalid API key · Fix external API key`** (agent exits code 1) — you put a
  subscription OAuth token (`sk-ant-oat01-…`) in `ANTHROPIC_API_KEY`. The Claude
  CLI sends that as an `x-api-key`, which the API rejects (`invalid x-api-key`).
  Move the value to `CLAUDE_CODE_OAUTH_TOKEN` and remove the `ANTHROPIC_API_KEY`
  line. Only `sk-ant-api03-…` console keys belong in `ANTHROPIC_API_KEY`.
