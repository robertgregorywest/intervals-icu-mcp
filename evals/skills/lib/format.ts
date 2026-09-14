import type { TokenCounts } from "./types.js";

export function fmt(n: number, digits = 2): string {
  return n.toFixed(digits);
}

function compact(n: number): string {
  if (n >= 1_000_000) return `${fmt(n / 1_000_000, 1)}M`;
  if (n >= 1_000) return `${Math.round(n / 1_000)}k`;
  return String(Math.round(n));
}

/** Tokens read (fresh + cached) / written, e.g. `812k/21k`. */
export function tokens(t: TokenCounts): string {
  return `${compact(t.input + t.cacheRead + t.cacheWrite)}/${compact(t.output)}`;
}
