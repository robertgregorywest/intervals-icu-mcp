#!/usr/bin/env tsx
/**
 * Round-trip test for create_workout_library_item: author a custom workout,
 * verify it appears with the right body + rationale, run refresh against it,
 * then delete it. Touches the real account.
 */
import "dotenv/config";
import { IntervalsClient } from "../src/index.js";

function header(s: string) {
  console.log("\n" + "=".repeat(70) + "\n" + s + "\n" + "=".repeat(70));
}

async function main() {
  const client = new IntervalsClient();

  header("1. create custom workout");
  const created = await client.workoutLibrary.create({
    name: "TEST custom 3×8 sweet spot",
    folder: "Coach: Custom",
    description:
      "Test workout authored via create_workout_library_item. Will be deleted by this script.",
    steps: [
      { label: "Warm-up", duration: "10m", target: "160w-189w" },
      {
        iterations: 3,
        label: "Sweet Spot",
        steps: [
          { label: "SST", duration: "8m", target: "255w-273w" },
          { label: "Recovery", duration: "3m", target: "160w" },
        ],
      },
      { label: "Cooldown", duration: "5m", target: "145w" },
    ],
    rationale: {
      basis: "FTP",
      anchorWatts: 290,
      seedId: "TEST-custom-3x8-sst",
      intensities: [
        { stepRef: "Warm-up", pct: [55, 65] },
        { stepRef: "SST", pct: [88, 94] },
        { stepRef: "Recovery", pct: 55 },
        { stepRef: "Cooldown", pct: 50 },
      ],
    },
  });
  console.log("created:", {
    workoutId: created.workoutId,
    name: created.name,
    folder: created.folder,
  });

  header("2. fetch back via get");
  const item = await client.workoutLibrary.get(created.workoutId);
  console.log("rationale:", item.rationale);
  console.log("description_text (first 400 chars):");
  console.log(item.description_text.slice(0, 400));

  header("3. refresh dry-run at FTP=295 — should plan to update this workout");
  const r = await client.workoutLibrary.refresh({
    ftpWatts: 295,
    dryRun: true,
  });
  const ours = r.updated.find((u) => u.workoutId === created.workoutId);
  if (ours) {
    console.log(
      `  ✓ recognized for refresh: ${ours.oldAnchorWatts}W → ${ours.newAnchorWatts}W`
    );
  } else {
    const skipped = r.skipped.find((s) => s.workoutId === created.workoutId);
    console.log(
      `  ✗ not in updated list. Skip reason: ${skipped?.reason ?? "(not in skipped either)"}`
    );
  }

  header("4. cleanup — delete the test workout");
  // Direct API access for delete (no high-level wrapper for it yet).
  const httpClient = (
    client as unknown as {
      httpClient: { request: <T>(p: string, o?: unknown) => Promise<T> };
    }
  ).httpClient;
  const athleteId = process.env.INTERVALS_ATHLETE_ID ?? "0";
  await httpClient.request<void>(
    `/api/v1/athlete/${athleteId}/workouts/${created.workoutId}`,
    { method: "DELETE" }
  );
  console.log(`deleted workout ${created.workoutId}`);
}

main().catch((err) => {
  console.error("FAIL:", err);
  process.exit(1);
});
