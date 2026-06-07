// Deno-only. Resolves the per-request IntervalsClient for the remote transport.
//
// Two modes:
//   - DEV (today): if INTERVALS_API_KEY is set, every request uses that single
//     key via Basic auth. Lets us deploy and smoke-test the pipeline BEFORE the
//     Intervals.icu OAuth app exists (see ADR 0006/0007).
//   - FEDERATED (once David issues client creds): extract the server-issued
//     OAuth identity from the request, look up the user's Intervals.icu tokens
//     in the TokenStore, refresh if expired, and build a Bearer-auth client.
//
// The FEDERATED path needs HttpClient to gain a Bearer auth mode + refresh
// lifecycle — the one genuinely new code path called out in ADR 0006. Until
// then it throws so we never silently fall back to an insecure mode.

import { IntervalsClient } from "../../index.js";
import type { IncomingMessage } from "node:http";
// import { TokenStore } from "./token-store.js"; // wired in the FEDERATED path

export async function resolveClient(
  _req: IncomingMessage
): Promise<IntervalsClient> {
  const devKey = Deno.env.get("INTERVALS_API_KEY");
  if (devKey) {
    return new IntervalsClient({ apiKey: devKey });
  }

  // TODO(federated): once the Intervals.icu OAuth app is registered —
  //   1. read the server-issued access token from `_req.headers.authorization`
  //      (mcpAuthRouter has already validated it upstream)
  //   2. map token -> userId, then `tokens = await store.get(userId)`
  //   3. if Date.now() >= tokens.expiresAt: refresh via /api/oauth/token,
  //      persist the rotated tokens, and continue
  //   4. `return new IntervalsClient({ bearerToken: tokens.accessToken })`
  //      (requires the HttpClient Bearer mode from ADR 0006)
  throw new Error(
    "No INTERVALS_API_KEY set and federated OAuth not yet implemented. " +
      "Set INTERVALS_API_KEY for dev, or finish the federated path once the " +
      "Intervals.icu OAuth app is registered."
  );
}
