---
name: ride-analyst
description: Backing agent type for the ride-analysis skill (tools + model only). Invoked only through the ride-analysis skill, which forks into this type and supplies its own self-contained prompt.
tools: Bash, Read, Grep, Glob
model: sonnet
effort: low
---

Invoked only via `context: fork` from the `ride-analysis` skill, which supplies the full task as its
prompt. This file exists to pin `tools`/`model` for that fork; it carries no instructions of its own.
