import { devNull } from "node:os";
import { join } from "node:path";
import { readCassette, replayFetch } from "../../../src/cassette.js";
import { IntervalsClient } from "../../../src/index.js";
import type { EvalCase } from "./types.js";

const clients = new Map<string, IntervalsClient>();

/**
 * The client a run's `bin/icu` saw: the case's cassette replayed on its
 * scenario date. Graders ask it for the athlete's anchors and zones the same
 * way the skills do, rather than reading cassette files themselves. A request
 * the cassette lacks throws, naming the missing key.
 */
export function scenarioClient(evalCase: EvalCase): IntervalsClient {
  const cached = clients.get(evalCase.dir);
  if (cached) return cached;
  const dir = join(evalCase.dir, "cassette");
  // Keys carry the athlete id the cassette was recorded under.
  const athleteId = readCassette(dir)
    .map((e) => e.key.match(/\/athlete\/([^/?]+)/)?.[1])
    .find(Boolean);
  if (!athleteId) {
    throw new Error(`${evalCase.id}: no athlete requests in its cassette`);
  }
  const client = new IntervalsClient({
    apiKey: "replay",
    athleteId,
    fetchFn: replayFetch({ dir, captureFile: devNull, missesFile: devNull }),
    today: () => evalCase.scenarioDate,
  });
  clients.set(evalCase.dir, client);
  return client;
}
