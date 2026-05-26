---
name: testing-workflow
description: How {{projectName}} is tested.
source: authored
priority: 60
applies_to: ["*"]
tags: [workflow, testing]
---

# Testing workflow

## Run tests

```
# Replace with the actual command for this project.
npm test
```

## What we test

- Unit tests cover pure logic and data transformations.
- Integration tests cover real I/O paths (filesystem, network, database).

## Snapshot policy

Snapshots are reviewed line-by-line on update. Never regenerate without
reading the diff.
