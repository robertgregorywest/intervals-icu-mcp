import { execFileSync } from "node:child_process";
import {
  copyFileSync,
  cpSync,
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  readlinkSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

// Paths never copied into a run's workspace: the eval suite itself (the agent
// must not see cases or graders), and trees irrelevant to coaching.
const EXCLUDE = ["evals", "tests", ".sandcastle", ".github", "docs/personal"];

export type SubagentModel = "inherit" | "pinned";

export interface WorkspaceOptions {
  repoRoot: string;
  caseDir: string;
  subagentModel: SubagentModel;
}

/**
 * A throwaway copy of the working tree — uncommitted skill edits included —
 * with the scenario's personal files at `docs/personal/`.
 */
export function buildWorkspace(opts: WorkspaceOptions): string {
  const ws = mkdtempSync(join(tmpdir(), "icu-eval-"));
  const files = execFileSync(
    "git",
    ["ls-files", "--cached", "--others", "--exclude-standard", "-z"],
    { cwd: opts.repoRoot }
  )
    .toString()
    .split("\0")
    .filter(Boolean)
    .filter((f) => !EXCLUDE.some((p) => f === p || f.startsWith(`${p}/`)));

  for (const file of files) {
    const src = join(opts.repoRoot, file);
    if (!existsSync(src) && !isSymlink(src)) continue; // deleted, not staged
    const dst = join(ws, file);
    mkdirSync(dirname(dst), { recursive: true });
    if (isSymlink(src)) symlinkSync(readlinkSync(src), dst);
    else copyFileSync(src, dst);
  }
  symlinkSync(join(opts.repoRoot, "node_modules"), join(ws, "node_modules"));

  const personal = join(opts.caseDir, "personal");
  if (existsSync(personal)) {
    cpSync(personal, join(ws, "docs", "personal"), { recursive: true });
  }

  // The agent definitions pin their fork to sonnet, which would hide the
  // model under test in every forked skill.
  if (opts.subagentModel === "inherit") {
    const agentsDir = join(ws, ".claude", "agents");
    for (const f of existsSync(agentsDir) ? readdirSync(agentsDir) : []) {
      const path = join(agentsDir, f);
      const text = readFileSync(path, "utf8");
      writeFileSync(path, text.replace(/^model: .*$/m, "model: inherit"));
    }
  }
  return ws;
}

function isSymlink(path: string): boolean {
  try {
    return lstatSync(path).isSymbolicLink();
  } catch {
    return false;
  }
}
