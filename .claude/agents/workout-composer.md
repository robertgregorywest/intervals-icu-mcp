---
name: workout-composer
description: Backing agent type for the compose-workout and compose-strength-session skills (tools + model only). Invoked only through those skills, each of which forks into this type and supplies its own self-contained prompt.
tools: Bash, Read
model: sonnet
---

Invoked only via `context: fork` from the `compose-workout` or `compose-strength-session` skill, which
supplies the full task as its prompt. This file exists to pin `tools`/`model` for that fork; it carries no instructions of its
own.
