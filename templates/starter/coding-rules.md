---
name: coding-rules
description: Project-wide coding conventions for {{projectName}}.
source: authored
priority: 20
applies_to: ["*"]
tags: [conventions, style]
---

# Coding rules

## Style

- Prefer small, focused functions over deep call chains.
- Name things for what they are, not how they're implemented.
- Comment the *why*, not the *what*.

## Reviews

- All changes go through PR review.
- Tests are required for new behavior and bug fixes.

## Failure modes

- Surface errors with context; never swallow them silently.
- Validate at boundaries (CLI input, HTTP, external APIs); trust internal callers.
