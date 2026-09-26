/**
 * Which prescribed steps carry the session's intent, read from the step's own
 * label rather than inferred from its intensity.
 *
 * The coaching layer used to derive this from prescribed intensity and
 * structural position together, because no marker existed on the planned side.
 * A marker exists now: the workouts are authored by a model that knows which
 * steps are the session, and it declares that in the first word of the step's
 * label — a word the athlete reads on the head unit anyway. See
 * `docs/adr/0010-work-steps-declared-in-the-label.md`.
 *
 * Only work steps matter. A label whose first word is not in the vocabulary is
 * **not classified** — the step is carried but never judged. That is the
 * deliberate failure mode: a warm-up, a recovery step and an unrecognised label
 * all fall out the same way, so nothing is ever guessed into a finding.
 */

/**
 * The first word of a step label that declares the step as work.
 *
 * A closed list. Every entry earns its place from a label this athlete's
 * templates or calendar already uses — adding a word is a deliberate edit, and
 * an unrecognised word costs a step's verdict rather than inventing one.
 *
 * Deliberately absent: `endurance` and `steady`. A Z2 or steady block is the
 * session's volume, and judging it rep-style against its band would report a
 * ride that sat mid-band as a miss. The band lens is what reads those.
 */
export const WORK_WORDS: ReadonlySet<string> = new Set([
  // Generic
  "work",
  "effort",
  "interval",
  "rep",
  "set",
  "block",
  // Zone / physiology
  "tempo",
  "sweet",
  "sweetspot",
  "sst",
  "threshold",
  "miet",
  "map",
  "vo2",
  "anaerobic",
  "neuromuscular",
  // Race-specific
  "sprint",
  "start",
  "standing",
  "pursuit",
  "race",
  "kilo",
  "run",
  "lap",
  // Rep-internal shape — the under and the float of an over-under are the
  // prescription, not recovery between reps, and `on` is the on of an on/off.
  "on",
  "over",
  "under",
  "float",
  "settle",
  "hold",
  "surge",
  "preload",
  // Priming
  "opener",
  "openers",
  "activation",
  "primer",
  // Test
  "test",
  "max",
  "peak",
]);

export type StepRole = "work" | "unclassified";

/**
 * The label's first word, lowercased and stripped to letters and digits, so
 * `Warm-up`, `SST —`, `VO2` and `Pre-load` all normalise the way a reader would
 * expect. Returns undefined for a label that opens with no word at all.
 */
export function firstWord(label: string | undefined): string | undefined {
  const raw = label?.trim().split(/\s+/)[0];
  const word = raw?.replace(/[^a-z0-9]/gi, "").toLowerCase();
  return word ? word : undefined;
}

/** Whether a step label declares the step as work. */
export function isWorkLabel(label: string | undefined): boolean {
  const word = firstWord(label);
  return word !== undefined && WORK_WORDS.has(word);
}

/**
 * A step's role. `unclassified` is not a failure — it is every support step and
 * every label outside the vocabulary, and it is judged by nothing.
 */
export function stepRole(label: string | undefined): StepRole {
  return isWorkLabel(label) ? "work" : "unclassified";
}
