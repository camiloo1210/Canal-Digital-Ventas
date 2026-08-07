---
id: f7ac948d-ded6-40d2-811f-f0cde531776d
immutable: false
integrity_hash: "sha256:07d71a349d90dd51d032cf906dfbb46c5590282049e574f31aca86326385c57c"
---

# en/0002-branching-policy-and-ci-cd

## Status
Accepted

## Context
Since the system processes real payments and stores confidential user and order data, deployments to production cannot be left to error-prone manual processes.

## Decision
A strict continuous integration flow using GitHub Actions is adopted:
- Branch structure: `main` (Production), `develop` (Integration), `feature/*`, and `hotfix/*`.
- Before merging into main branches, the code must obligatorily pass a Pipeline of 10 validations (Linting, Unit Tests, E2E Tests, SAST, DAST, Checkov, Trivy, OIDC Deploy).

## Consequences
All code reaching production will be highly audited, ensuring stability and compliance with good security practices. Individual development (`feature/*`) will require developers to ensure a high level of local code quality to avoid continuous blockers by the CI/CD, which slightly lengthens a PR's lifecycle but drastically reduces critical failures.