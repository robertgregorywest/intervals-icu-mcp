import { z } from "zod";

export const CHARACTER_LIMIT = 25_000;
export const DEFAULT_LIST_LIMIT = 50;
export const MAX_LIST_LIMIT = 200;
export const MAX_RANGE_DAYS = 365;

export const dateString = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "must be YYYY-MM-DD");

export const limitField = z
  .number()
  .int()
  .min(1)
  .max(MAX_LIST_LIMIT)
  .default(DEFAULT_LIST_LIMIT)
  .describe(
    `Maximum results to return (default ${DEFAULT_LIST_LIMIT}, max ${MAX_LIST_LIMIT})`
  );

export function assertDateRange(oldest: string, newest: string): void {
  const start = Date.parse(oldest);
  const end = Date.parse(newest);
  if (Number.isNaN(start) || Number.isNaN(end)) {
    throw new Error("Invalid date — must be YYYY-MM-DD");
  }
  if (end < start) {
    throw new Error(
      `newest (${newest}) must be on or after oldest (${oldest})`
    );
  }
  const days = (end - start) / 86_400_000;
  if (days > MAX_RANGE_DAYS) {
    throw new Error(
      `Date range too large: ${Math.round(days)} days (max ${MAX_RANGE_DAYS}). ` +
        "Narrow the range and try again."
    );
  }
}

export function applyLimit<T>(
  items: T[],
  limit: number
): { items: T[]; total: number; truncated: boolean } {
  const total = items.length;
  if (total <= limit) {
    return { items, total, truncated: false };
  }
  return { items: items.slice(0, limit), total, truncated: true };
}

export function truncateForCharacterLimit(
  payload: unknown,
  hint: string
): string {
  const json = JSON.stringify(payload, null, 2);
  if (json.length <= CHARACTER_LIMIT) {
    return json;
  }
  return JSON.stringify(
    {
      truncated: true,
      character_limit: CHARACTER_LIMIT,
      original_chars: json.length,
      message: hint,
    },
    null,
    2
  );
}
