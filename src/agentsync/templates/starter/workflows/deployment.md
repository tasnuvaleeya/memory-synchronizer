---
name: workflow-deployment
description: How code reaches production and how to roll back.
source: authored
priority: 50
applies_to: ["*"]
tags: [workflow, deployment]
---

# Deployment Workflow

## Pipeline

- CI runs on every PR.
- Merging to `main` triggers a deploy to staging.
- A manual approval promotes staging → production.

## Rollback

- Use `<command>` to redeploy the previous release.
