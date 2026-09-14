import { existsSync, readFileSync } from "node:fs";

/** One JSON value per line; a missing file reads as empty. */
export function readJsonl<T>(file: string): T[] {
  if (!existsSync(file)) return [];
  return readFileSync(file, "utf8")
    .split("\n")
    .filter(Boolean)
    .map((l) => JSON.parse(l) as T);
}
