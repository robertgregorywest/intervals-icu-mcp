// Deno-only. The OAuth broker: server is an Authorization Server to claude.ai
// AND an OAuth client to Intervals.icu (see ADR 0006).
//
// NOT YET WIRED. Implementing this is gated on registering the Intervals.icu
// OAuth app (email api@intervals.icu — needs app name, square >=128px logo URL,
// privacy-policy URL, the stable redirect URI, and the owner's athlete ID).
// Until creds exist, http.ts serves in DEV mode (single INTERVALS_API_KEY) so
// the deploy pipeline can be proven first.
//
// Intended shape, to be implemented against the MCP SDK's OAuthServerProvider:
//
//   Layer 1 (claude.ai -> us): mcpAuthRouter handles discovery, dynamic client
//   registration, PKCE, and token issuance/validation.
//
//   Layer 2 (us -> Intervals.icu): our /authorize handler redirects the user to
//     https://intervals.icu/oauth/authorize?client_id=...&redirect_uri=...
//       &scope=ACTIVITY:READ,WELLNESS:READ,SETTINGS:READ,CALENDAR:WRITE,LIBRARY:WRITE
//       &state=...
//   our callback exchanges the code at https://intervals.icu/api/oauth/token,
//   stores the {access,refresh,expiresAt,scope} via TokenStore keyed to the
//   Layer-1 identity, and completes the Layer-1 auth-code flow.
//
// Mounting (once implemented), in http.ts:
//   import { mcpAuthRouter } from "@modelcontextprotocol/sdk/server/auth/router.js";
//   app.use(mcpAuthRouter({ provider: createIcuOAuthProvider(store), issuerUrl, ... }));

import type { TokenStore } from "./token-store.js";

export const ICU_AUTHORIZE_URL = "https://intervals.icu/oauth/authorize";
export const ICU_TOKEN_URL = "https://intervals.icu/api/oauth/token";

/** Least-privilege scopes for the current tool set (no CHATS). */
export const ICU_SCOPES = [
  "ACTIVITY:READ",
  "WELLNESS:READ",
  "SETTINGS:READ",
  "CALENDAR:WRITE",
  "LIBRARY:WRITE",
].join(",");

export function createIcuOAuthProvider(_store: TokenStore): never {
  throw new Error(
    "createIcuOAuthProvider not implemented — gated on Intervals.icu OAuth app registration (ADR 0006)"
  );
}
