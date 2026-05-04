#!/usr/bin/env tsx
/**
 * Exercises refresh_workout_library against the real API.
 *
 * Usage:
 *   npx tsx scripts/exercise-refresh.ts --map=410        # dry run
 *   npx tsx scripts/exercise-refresh.ts --map=410 --apply
 */
import "dotenv/config";
import { IntervalsClient } from "../src/index.js";

const args = process.argv.slice(2);
const apply = args.includes("--apply");
const mapArg = args.find((a) => a.startsWith("--map="));
const ftpArg = args.find((a) => a.startsWith("--ftp="));
const mapWatts = mapArg ? Number(mapArg.split("=")[1]) : undefined;
const ftpWatts = ftpArg ? Number(ftpArg.split("=")[1]) : undefined;

function header(s: string) {
  console.log("\n" + "=".repeat(70) + "\n" + s + "\n" + "=".repeat(70));
}

async function main() {
  const client = new IntervalsClient();

  header(
    `refresh (dryRun=${!apply})  mapWatts=${mapWatts}  ftpWatts=${ftpWatts}`
  );
  const report = await client.workoutLibrary.refresh({
    mapWatts,
    ftpWatts,
    dryRun: !apply,
  });
  console.log(`dryRun: ${report.dryRun}`);
  console.log(`updated: ${report.updated.length}`);
  for (const u of report.updated) {
    console.log(
      `  • ${u.folder} / ${u.name}  (${u.basis}: ${u.oldAnchorWatts}W → ${u.newAnchorWatts}W, id=${u.workoutId})`
    );
  }
  console.log(`skipped: ${report.skipped.length}`);
  for (const s of report.skipped) {
    console.log(`  • ${s.name} — ${s.reason}`);
  }
  console.log(`warnings: ${report.warnings.length}`);
  for (const w of report.warnings) console.log(`  ! ${w}`);
}

main().catch((err) => {
  console.error("FAIL:", err);
  process.exit(1);
});
