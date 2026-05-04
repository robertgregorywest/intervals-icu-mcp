import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  loadCoachingInstructions,
  COACHING_FALLBACK_BLURB,
  COACHING_MAX_CHARS,
} from "../../src/mcp/coaching.js";

let dir: string;

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "coaching-"));
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
  delete process.env.INTERVALS_COACHING_DIR;
});

describe("loadCoachingInstructions", () => {
  it("returns fallback when directory is empty", async () => {
    const result = await loadCoachingInstructions({ dir });
    expect(result).toBe(COACHING_FALLBACK_BLURB);
  });

  it("returns fallback when directory does not exist", async () => {
    const result = await loadCoachingInstructions({
      dir: join(dir, "nonexistent"),
    });
    expect(result).toBe(COACHING_FALLBACK_BLURB);
  });

  it("includes only present files with section headings", async () => {
    await writeFile(join(dir, "philosophy.md"), "MAP-anchored coaching.");
    await writeFile(join(dir, "athlete.md"), "Current MAP: 380W.");

    const result = await loadCoachingInstructions({ dir });

    expect(result).toContain("## Philosophy");
    expect(result).toContain("MAP-anchored coaching.");
    expect(result).toContain("## Athlete");
    expect(result).toContain("Current MAP: 380W.");
    expect(result).not.toContain("## Season");
  });

  it("preserves file order: Philosophy, Season, Athlete", async () => {
    await writeFile(join(dir, "athlete.md"), "ATHLETE_BODY");
    await writeFile(join(dir, "season.md"), "SEASON_BODY");
    await writeFile(join(dir, "philosophy.md"), "PHILOSOPHY_BODY");

    const result = await loadCoachingInstructions({ dir });

    const phiIdx = result.indexOf("PHILOSOPHY_BODY");
    const seaIdx = result.indexOf("SEASON_BODY");
    const athIdx = result.indexOf("ATHLETE_BODY");
    expect(phiIdx).toBeGreaterThanOrEqual(0);
    expect(phiIdx).toBeLessThan(seaIdx);
    expect(seaIdx).toBeLessThan(athIdx);
  });

  it("skips empty files (treats whitespace-only as missing)", async () => {
    await writeFile(join(dir, "philosophy.md"), "Real content.");
    await writeFile(join(dir, "season.md"), "   \n  \n");

    const result = await loadCoachingInstructions({ dir });

    expect(result).toContain("Real content.");
    expect(result).not.toContain("## Season");
  });

  it("honors INTERVALS_COACHING_DIR env var", async () => {
    process.env.INTERVALS_COACHING_DIR = dir;
    await writeFile(join(dir, "philosophy.md"), "From env.");

    const result = await loadCoachingInstructions();

    expect(result).toContain("From env.");
  });

  it("explicit opts.dir wins over env var", async () => {
    const otherDir = await mkdtemp(join(tmpdir(), "coaching-other-"));
    try {
      process.env.INTERVALS_COACHING_DIR = dir;
      await writeFile(join(dir, "philosophy.md"), "FROM_ENV");
      await writeFile(join(otherDir, "philosophy.md"), "FROM_OPTS");

      const result = await loadCoachingInstructions({ dir: otherDir });

      expect(result).toContain("FROM_OPTS");
      expect(result).not.toContain("FROM_ENV");
    } finally {
      await rm(otherDir, { recursive: true, force: true });
    }
  });

  it("truncates content above the size cap", async () => {
    const writeSpy = vi
      .spyOn(process.stderr, "write")
      .mockImplementation(() => true);
    const big = "x".repeat(COACHING_MAX_CHARS + 5_000);
    await writeFile(join(dir, "philosophy.md"), big);

    const result = await loadCoachingInstructions({ dir });

    expect(result.length).toBeLessThan(big.length);
    expect(result).toContain("[truncated");
    expect(writeSpy).toHaveBeenCalled();
    writeSpy.mockRestore();
  });
});
