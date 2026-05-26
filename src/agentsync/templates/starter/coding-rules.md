---
name: coding-rules
description: Project-wide coding conventions and review checklists.
source: authored
priority: 20
applies_to: ["*"]
tags: [conventions, style]
---

# Coding Rules

## Style

- Follow the language's idiomatic style guide (PEP 8, gofmt, prettier, etc.).
- Prefer descriptive names over abbreviations.
- Keep functions under ~50 lines unless there's a real reason.

## Tests

- Every new module ships with at least one test.
- Prefer fast, deterministic tests; mock the network, not the database.

## Reviews

- Lint and format before opening a PR.
- A PR description must say what changed and why.

> Replace these bullets with your team's actual rules.
