import type { IntervalsEvent } from "../../types.js";
import type { WorkoutPlan, WorkoutStep, RepeatBlock } from "./types.js";
import { isRepeatBlock } from "./types.js";

export interface IWorkoutBuilder {
  toDescription(steps: Array<WorkoutStep | RepeatBlock>): string;
  buildEvent(plan: WorkoutPlan): IntervalsEvent;
}

function formatStep(step: WorkoutStep): string {
  const parts: string[] = [];

  if (step.label) {
    parts.push(step.label);
  }

  parts.push(step.duration);

  if (step.ramp && step.target) {
    parts.push(`ramp ${step.target}`);
  } else if (step.target) {
    parts.push(step.target);
  }

  if (step.cadence) {
    parts.push(step.cadence);
  }

  return `- ${parts.join(" ")}`;
}

function formatRepeatBlock(block: RepeatBlock): string {
  const header = block.label
    ? `${block.label} ${block.iterations}x`
    : `${block.iterations}x`;

  const steps = block.steps.map(formatStep).join("\n");

  return `${header}\n${steps}`;
}

export class WorkoutBuilder implements IWorkoutBuilder {
  toDescription(steps: Array<WorkoutStep | RepeatBlock>): string {
    const sections: string[] = [];

    for (const step of steps) {
      if (isRepeatBlock(step)) {
        sections.push(formatRepeatBlock(step));
      } else {
        sections.push(formatStep(step));
      }
    }

    return sections.join("\n\n");
  }

  buildEvent(plan: WorkoutPlan): IntervalsEvent {
    const description = this.toDescription(plan.steps);
    const externalId =
      plan.externalId || `mcp-${plan.date}-${slugify(plan.name)}`;

    return {
      category: "WORKOUT",
      start_date_local: `${plan.date}T00:00:00`,
      type: plan.sportType,
      name: plan.name,
      description,
      external_id: externalId,
      ...(plan.color ? { color: plan.color } : {}),
    };
  }
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function createWorkoutBuilder(): WorkoutBuilder {
  return new WorkoutBuilder();
}
