---
name: architecture
description: High-level architecture and module boundaries for {{projectName}}.
source: hybrid
priority: 10
applies_to: ["*"]
tags: [architecture, overview]
---

# Architecture

> This file is `hybrid`: human-authored prose **and** generated sections (see
> the `<!-- agentctx:begin generated -->` markers once Milestone 3 lands).

## System overview

Replace this paragraph with a 3–5 sentence summary of {{projectName}} — what
it does, who it serves, and the top-level shape of the system.

## Modules

- `src/...` — describe the major directories and their responsibilities.
- `tests/...` — testing strategy at a glance.

## Entry points

List the CLI commands, HTTP routes, or library exports that callers depend on.

## Dependencies

Call out the external services, databases, and third-party APIs that the
system relies on at runtime.
