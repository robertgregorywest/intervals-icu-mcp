# Authenticate the remote MCP transport via OAuth federated to Intervals.icu

The remote MCP transport targets claude.ai web + mobile, whose connectors only authenticate via OAuth 2.1 + PKCE — they cannot carry a user-pasted API key or bearer header, and tokens in the connector URL are forbidden by the MCP auth spec. Since a server-side Authorization Server is therefore mandatory regardless, we make it an **OAuth broker**: the server is an Authorization Server to claude.ai (built on the MCP TypeScript SDK's auth router so we don't hand-roll OAuth) and an OAuth _client_ to Intervals.icu, storing each user's **scoped, expiring, revocable Intervals.icu refresh/access tokens** rather than a raw `API_KEY`. We chose federation over the simpler "paste-and-store the API key" because once the AS is unavoidable, paste-and-store buys only marginally less code in exchange for being a custodian of non-expiring, full-account, unscoped keys (catastrophic breach blast radius) and a phishing-shaped onboarding where users paste Intervals.icu credentials into our domain.

## Considered options

- **Paste-and-store API key** — rejected: god-mode-key custody and worse onboarding, for little build saving once the OAuth AS is mandatory anyway.
- **Managed IdP (Auth0/Clerk/WorkOS)** — rejected: authenticates human identities we don't want (no user accounts); the pasted-key-or-OAuth-to-Intervals.icu identity is enough.
- **Hand-rolled AS** — rejected: needless attack surface now that the SDK ships an `OAuthServerProvider`.

## Consequences

- Registering the Intervals.icu OAuth app is **manual and email-gated** (`api@intervals.icu`): requires app name, a square ≥128×128 logo URL, a privacy-policy URL, the fixed redirect URI(s), and the owner's athlete ID. The public **callback URL must be stable at registration time** — re-coordinating it later is friction, which favours a fixed-hostname deploy over ephemeral preview URLs.
- `HttpClient` gains a second auth mode (Bearer) and a **token-refresh lifecycle** (detect expiry/401 → refresh → persist rotated tokens → fall back to re-auth) — it is currently stateless static-Basic. This is the one genuinely new code path; it is isolated and testable.
- Scopes requested are least-privilege: `ACTIVITY:READ`, `WELLNESS:READ`, `SETTINGS:READ`, `CALENDAR:WRITE`, `LIBRARY:WRITE` (no `CHATS`).
- Only the **remote transport** federates. The stdio transport and CLI adapter keep single-user Basic `API_KEY` auth from env — unchanged.
