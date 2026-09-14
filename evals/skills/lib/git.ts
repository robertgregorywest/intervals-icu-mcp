import { execFileSync } from "node:child_process";

export function git(cwd: string, ...args: string[]): string {
  return execFileSync("git", args, { cwd }).toString().trim();
}
