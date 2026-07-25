import type { AnchorBasis } from "./types.js";
import type {
  Pct,
  TemplateNode,
  TemplateRepeat,
  TemplateStep,
  WorkoutTemplate,
} from "./template.js";

/**
 * Render a Workout template to the Intervals.icu description text (ADR 0005).
 *
 * Anchored steps (bare `%`) resolve against the template's basis; everything
 * else is emitted verbatim. Repeat blocks that contain another block are
 * unrolled — Intervals.icu supports only a single level of `Nx` — and the
 * unrolled block's label is discarded.
 */

export interface RenderAnchors {
  mapWatts?: number;
  ftpWatts?: number;
}

export const TEMPLATE_MARKER_RE =
  /<!--\s*template:\s*([a-z0-9][a-z0-9-]*)\s*-->/i;
/** Legacy provenance written by the retired seed/refresh path; read-only. */
const LEGACY_RATIONALE_RE = /<!--\s*rationale\s*([\s\S]+?)\s*-->/i;

export class MissingAnchorError extends Error {
  constructor(
    readonly seedId: string,
    readonly basis: AnchorBasis
  ) {
    super(
      `${seedId} is anchored to ${basis} but no ${basis === "MAP" ? "mapWatts" : "ftpWatts"} was supplied`
    );
    this.name = "MissingAnchorError";
  }
}

/**
 * Round to nearest 5 W — head-unit targets should be clean numbers. Preserved
 * from the retired seed path so rendered watts are unchanged.
 */
function wattsFromPct(pct: number, anchorWatts: number): number {
  return Math.round(((pct / 100) * anchorWatts) / 5) * 5;
}

function formatWatts(pct: Pct, anchorWatts: number): string {
  if (Array.isArray(pct)) {
    return `${wattsFromPct(pct[0], anchorWatts)}w-${wattsFromPct(pct[1], anchorWatts)}w`;
  }
  return `${wattsFromPct(pct, anchorWatts)}w`;
}

function formatStep(step: TemplateStep, anchorWatts: number | null): string {
  const parts: string[] = [];
  if (step.label) parts.push(step.label);
  parts.push(step.duration);

  if (step.anchored !== undefined) {
    // assertBasis guarantees a basis exists whenever a step is anchored, and
    // resolveAnchor rejects a missing anchor before we get here.
    parts.push(formatWatts(step.anchored, anchorWatts as number));
  } else if (step.target) {
    parts.push(step.target);
  }

  if (step.cadence) parts.push(step.cadence);
  return `- ${parts.join(" ")}`;
}

function containsRepeat(nodes: TemplateNode[]): boolean {
  return nodes.some((n) => n.kind === "repeat");
}

function formatLeafRepeat(
  block: TemplateRepeat,
  anchorWatts: number | null
): string {
  const header = block.label
    ? `${block.label} ${block.iterations}x`
    : `${block.iterations}x`;
  const steps = block.children
    .map((c) => formatStep(c as TemplateStep, anchorWatts))
    .join("\n");
  return `${header}\n${steps}`;
}

/**
 * Flatten a node tree into rendered sections. Sections are joined with a blank
 * line, matching what Intervals.icu's parser expects around an `Nx` block.
 */
function renderNodes(
  nodes: TemplateNode[],
  anchorWatts: number | null
): string[] {
  const sections: string[] = [];
  for (const node of nodes) {
    if (node.kind === "step") {
      sections.push(formatStep(node, anchorWatts));
      continue;
    }
    if (!containsRepeat(node.children)) {
      sections.push(formatLeafRepeat(node, anchorWatts));
      continue;
    }
    // Nested: unroll this level, discarding its label, and recurse.
    for (let i = 0; i < node.iterations; i++) {
      sections.push(...renderNodes(node.children, anchorWatts));
    }
  }
  return sections;
}

function resolveAnchor(
  template: WorkoutTemplate,
  anchors: RenderAnchors
): number | null {
  if (!template.basis) return null;
  const watts = template.basis === "MAP" ? anchors.mapWatts : anchors.ftpWatts;
  if (watts === undefined) {
    throw new MissingAnchorError(template.seedId, template.basis);
  }
  return watts;
}

/** The step body alone, without prose or marker. */
export function renderBody(
  template: WorkoutTemplate,
  anchors: RenderAnchors
): string {
  const anchorWatts = resolveAnchor(template, anchors);
  return renderNodes(template.steps, anchorWatts).join("\n\n");
}

/**
 * The full description as it will sit on Intervals.icu: purpose line, prose,
 * steps, then the provenance marker.
 */
export function renderDescription(
  template: WorkoutTemplate,
  anchors: RenderAnchors
): string {
  const body = renderBody(template, anchors);
  const prose = [template.purpose.trim(), template.prose.trim()]
    .filter(Boolean)
    .join("\n\n");
  const head = prose ? `${prose}\n\n` : "";
  return `${head}${body}\n\n<!-- template: ${template.seedId} -->`;
}

/**
 * The seedId a remote description belongs to, or null. Reads the current
 * marker and, for one release, the legacy rationale block so already-seeded
 * workouts keep matching their template.
 */
export function extractSeedId(description: string): string | null {
  if (!description) return null;
  const marker = description.match(TEMPLATE_MARKER_RE);
  if (marker) return marker[1];

  const legacy = description.match(LEGACY_RATIONALE_RE);
  if (legacy) {
    try {
      const parsed = JSON.parse(legacy[1]) as { seedId?: unknown };
      if (typeof parsed.seedId === "string" && parsed.seedId) {
        return parsed.seedId;
      }
    } catch {
      return null;
    }
  }
  return null;
}
