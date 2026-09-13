---
name: workout-composer
description: Backing agent type for the compose-workout skill (tools + model only). Invoked only through the compose-workout skill, which forks into this type and supplies its own self-contained prompt.
tools: Bash, Read
model: sonnet
---

Invoked only via `context: fork` from the `compose-workout` skill, which supplies the full task as
its prompt. This file exists to pin `tools`/`model` for that fork; it carries no instructions of its
own.
