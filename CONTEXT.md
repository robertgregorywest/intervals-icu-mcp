# intervals-icu-mcp

A server exposing Intervals.icu operations and agentic-coaching tools. The same operations are surfaced through more than one transport, so the vocabulary below separates an operation from the surfaces that project it.

## Language

**Tool**:
A named operation defined once as `{ name, description, input schema, handler, annotations, output schema? }`. Lives in `src/tools/`, registered in `src/registry.ts`.
_Avoid_: command, endpoint, function (for the registered unit)

**Tool registry**:
The single list (`src/registry.ts`) of all Tools, iterated by every Adapter. The source of truth for what operations exist.
_Avoid_: tool list, catalogue

**Adapter**:
A transport that projects the Tool registry onto a surface. Owns transport concerns (wire format, discovery, error rendering); never holds business logic.
_Avoid_: transport, layer (as synonyms for the module)

**MCP adapter**:
The Adapter at `src/mcp/` that projects Tools as Model Context Protocol tools. Spans more than one **Transport**: a local stdio transport (the desktop/mcpb distribution artifact) and a remote hosted transport (reached over the public internet by claude.ai web/mobile).

**Transport**:
The wire mechanism an Adapter uses to reach a client. Adding a Transport to an Adapter is not adding a new Adapter — the remote MCP server is a second Transport of the **MCP adapter**, not its own Adapter, because it still projects Tools as MCP tools.
_Avoid_: channel, surface (as synonyms for the wire mechanism)

**CLI adapter**:
The Adapter at `src/cli/` that projects Tools as Bash subcommands. The agent's zero-reconnect dev surface, run via `tsx`.

**Projection**:
A single Tool as exposed by one Adapter. An **MCP tool** and a **CLI command** are two Projections of the same Tool.

**MAP zones**:
The canonical coaching training zones, anchored to MAP (Ric Stern / cyclecoach model). Derived live and surfaced by `get_coaching_context` as `mapZones`. The coaching skills reason in these.
_Avoid_: "power zones" (ambiguous with the FTP set)

**FTP zones**:
Intervals.icu's native Coggan / %FTP power zones. Available on the raw `get_athlete` view; intentionally absent from the coaching context (see ADR 0003).

**Workout template**:
The tracked Markdown file in `templates/` that is the source of truth for one curated workout — frontmatter (identity, folder, purpose, basis) plus a body in Intervals.icu step syntax. Authored by hand; editing one is a commit.
_Avoid_: "seed" or "canonical template" (both imply a one-time initial write, which is exactly what this is not)

**Library workout**:
The materialised copy of a Workout template on Intervals.icu. A **rendered view**, never a source — hand edits to it are overwritten on the next Sync. Every Library workout has a Workout template behind it.
_Avoid_: calling it the workout "in the library" as though it were authoritative

**Sync**:
The single reconcile operation (`sync_workout_library`): render every Workout template at the current anchors and upsert it, matched by its Template marker. Creates what is missing, updates what differs, never deletes.
_Avoid_: "seed" / "refresh" — both named halves of this one operation and are retired

**Basis**:
The anchor a template's percentages are read against — MAP or FTP — declared once per template. One basis per template; mixing is a parse error.

**Anchored target**:
A bare percentage in a step line, resolved against the template's Basis at render time. Everything else — literal watts, zones, HR, pace, cadence — is a **literal target**, emitted verbatim and unaffected by anchor changes. A template with no Anchored target needs no Basis and always syncs.

**Template marker**:
The HTML comment carrying a Workout template's identity on its Library workout, so Sync can find the copy it owns. Invisible in the Intervals.icu UI.

**Orphan**:
A marker-bearing Library workout whose Workout template no longer exists. Reported by Sync as a warning; never deleted automatically.

**Coaching philosophy**:
The athlete's durable, timeless training principles — foundational pillars, intensity anchor (MAP), execution rules, biases, test cadence. **Tracked in git** as the `coaching-philosophy` skill and shared by every install; the base layer of the Coaching-context stack. Editing it is a commit (see ADR 0004).
_Avoid_: putting season-scoped or current-state facts here (those are **Season** / athlete state); calling one athlete's deviations "philosophy" (that's **Steering**).

**Steering**:
A single athlete's thin, personal override layer (`docs/personal/steering.md`, gitignored) on top of the shared **Coaching philosophy**. **Wins on conflict.** Durable steering is promoted _up_ into the philosophy skill.
_Avoid_: durable training beliefs that would hold next season (promote them into philosophy); block-scoped plans (that's **Season**).

**Season**:
Personal, gitignored current-block context (`docs/personal/season.md`) — race calendar, macro structure, block constraints. Revised between blocks.
_Avoid_: momentary CTL/TSB and in-flight niggles (that's the coaching log); timeless principles (that's **Coaching philosophy**).

**Coaching-context stack**:
The four ordered tiers the coaching skills read at session-start, most-durable first: **Coaching philosophy** → **Steering** → **Season** → coaching log. Later tiers override earlier ones on conflict; facts promote _up_ the stack as they prove durable (log→season, steering→philosophy).
_Avoid_: confusing this with `get_coaching_context`'s output — that is live **athlete state** (FTP/MAP/zones/CTL), a separate input, not a tier in the stack.

## Relationships

- A **Tool** is registered once in the **Tool registry**
- Each **Adapter** iterates the **Tool registry** and produces one **Projection** per Tool
- An **MCP tool** and a **CLI command** are **Projections** of the same **Tool**
- An **Adapter** holds no business logic — that lives in the Tool's handler and the services it calls
- A **Workout template** is rendered by **Sync** into exactly one **Library workout**, found by its **Template marker**
- A **Library workout** with no **Workout template** is an **Orphan**; a **Workout template** with no **Library workout** is created on the next **Sync**
- An **Anchored target** moves when MAP/FTP moves; a **literal target** does not — that is the whole difference between them
- An **Adapter** may expose its **Projections** over one or more **Transports** — the local stdio and remote hosted MCP servers are two **Transports** of the same **MCP adapter**

## Example dialogue

> **Dev:** "If I add a `get_segments` operation, do I wire it into both the server and the CLI?"
> **Architect:** "No — you add one **Tool** to the **Tool registry**. Both **Adapters** pick it up, so you get an MCP tool and a CLI command for free. You only touch an **Adapter** if the _transport_ needs something special."

## Flagged ambiguities

- "tool" was used for both the registered operation and its MCP form — resolved: the registered unit is a **Tool**; its MCP-surface form is an **MCP tool** (a **Projection**), and its CLI-surface form is a **CLI command**.
- "the remote MCP server" could be read as a new Adapter — resolved: it is a second **Transport** of the **MCP adapter** (it still projects Tools as MCP tools and holds no business logic), not its own Adapter.
