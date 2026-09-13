---
name: execution-analyst
description: Backing agent type for the execution-review skill (tools + model only). Not invoked directly — the execution-review skill forks into this type and supplies its own self-contained prompt.
tools: Bash, Read
model: sonnet
---

Invoked only via `context: fork` from the `execution-review` skill, which supplies the full task as
its prompt. This file exists to pin `tools`/`model` for that fork; it carries no instructions of its
own.
