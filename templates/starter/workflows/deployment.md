---
name: deployment-workflow
description: How {{projectName}} is deployed.
source: authored
priority: 60
applies_to: ["*"]
tags: [workflow, deployment]
---

# Deployment workflow

## Environments

- `development` — local
- `staging` — pre-production verification
- `production` — user-facing

## Release steps

1. Merge to `main`.
2. CI builds and runs the test matrix.
3. Tag the release (`vX.Y.Z`) and push.
4. CD pipeline promotes the build to staging, then production after sign-off.

## Rollback

Document the exact command or runbook entry that reverts a bad release.
