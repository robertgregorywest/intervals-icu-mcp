#!/usr/bin/env tsx
/**
 * Exercises seed_workout_library against the real API. Defaults to dryRun.
 * Pass --apply to actually create folders/workouts.
 *
 * Usage:
 *   npx tsx scripts/exercise-seed.ts                 # dry run
 *   npx tsx scripts/exercise-seed.ts --apply         # real run
 *   npx tsx scripts/exercise-seed.ts --map=380       # override MAP
 *   npx tsx scripts/exercise-seed.ts --ftp=290       # override FTP
 */
import "dotenv/config";
import { IntervalsClient } from "../src/index.js";

const args = process.argv.slice(2);
const apply = args.includes("--apply");
const mapArg = args.find((a) => a.startsWith("--map="));
const ftpArg = args.find((a) => a.startsWith("--ftp="));

function header(s: string) {
  console.log("\n" + "=".repeat(70) + "\n" + s + "\n" + "=".repeat(70));
}

async function main() {
  const client = new IntervalsClient();

  let mapWatts: number | undefined = mapArg
    ? Number(mapArg.split("=")[1])
    : undefined;
  let ftpWatts: number | undefined = ftpArg
    ? Number(ftpArg.split("=")[1])
    : undefined;

  if (!ftpWatts) {
    const athlete = await client.getAthlete();
    const sportSettings = (athlete as Record<string, unknown>).sportSettings as
      | Array<Record<string, unknown>>
      | undefined;
    const ride = sportSettings?.find((s) =>
      (s.types as string[] | undefined)?.includes("Ride")
    );
    const ftp = ride?.ftp as number | null | undefined;
    if (typeof ftp === "number" && ftp > 0) {
      ftpWatts = ftp;
      console.log(`Using FTP from athlete profile (Ride): ${ftpWatts}W`);
    } else {
      console.log("FTP not found on athlete profile — pass --ftp=<watts>.");
    }
  }
  if (!mapWatts) {
    console.log(
      "MAP not provided — pass --map=<watts> to seed MAP-anchored templates."
    );
  }

  header(`seed (dryRun=${!apply})`);
  const report = await client.workoutLibrary.seed({
    mapWatts,
    ftpWatts,
    dryRun: !apply,
  });
  console.log(`dryRun: ${report.dryRun}`);
  console.log(`created: ${report.created.length}`);
  for (const c of report.created) {
    console.log(
      `  • ${c.folder} / ${c.name}  (basis=${c.basis}, anchor=${c.anchorWatts}W${c.workoutId ? `, id=${c.workoutId}` : ""})`
    );
  }
  console.log(`skipped: ${report.skipped.length}`);
  for (const s of report.skipped) {
    console.log(`  • ${s.name} — ${s.reason}`);
  }
  console.log(`warnings: ${report.warnings.length}`);
  for (const w of report.warnings) console.log(`  ! ${w}`);

  if (report.created.length > 0) {
    header("First materialized workout description (preview)");
    console.log(report.created[0].description);
  }
}

main().catch((err) => {
  console.error("FAIL:", err);
  process.exit(1);
});
