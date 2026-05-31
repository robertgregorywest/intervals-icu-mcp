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
The Adapter at `src/mcp/` that projects Tools as Model Context Protocol tools. The production / distribution artifact (mcpb, manifest, desktop).

**CLI adapter**:
The Adapter at `src/cli/` that projects Tools as Bash subcommands. The agent's zero-reconnect dev surface, run via `tsx`.

**Projection**:
A single Tool as exposed by one Adapter. An **MCP tool** and a **CLI command** are two Projections of the same Tool.

## Relationships

- A **Tool** is registered once in the **Tool registry**
- Each **Adapter** iterates the **Tool registry** and produces one **Projection** per Tool
- An **MCP tool** and a **CLI command** are **Projections** of the same **Tool**
- An **Adapter** holds no business logic — that lives in the Tool's handler and the services it calls

## Example dialogue

> **Dev:** "If I add a `get_segments` operation, do I wire it into both the server and the CLI?"
> **Architect:** "No — you add one **Tool** to the **Tool registry**. Both **Adapters** pick it up, so you get an MCP tool and a CLI command for free. You only touch an **Adapter** if the _transport_ needs something special."

## Flagged ambiguities

- "tool" was used for both the registered operation and its MCP form — resolved: the registered unit is a **Tool**; its MCP-surface form is an **MCP tool** (a **Projection**), and its CLI-surface form is a **CLI command**.
