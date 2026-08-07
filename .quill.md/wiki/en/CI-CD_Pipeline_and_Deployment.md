---
id: cefe2907-a08e-43e5-b34e-deec7881e839
immutable: false
integrity_hash: "sha256:773e45c138c10c26e8dd7b7039cc4f9eab594a27f54c8b6118f14ed80ada7e91"
---

# CI/CD Pipeline, Deployment, and Branching Policy

Given that the channel handles financial transactions and commercial data, the deployment plan integrates automated security controls at each stage of Continuous Integration and Deployment using **GitHub Actions**.

## Pipeline Phases (10 Strict Checks)
Before any change is promoted to production on Vercel, it must successfully pass the following validations:

1. **Lint & Type Check**: Static code analysis (ESLint) and strict TypeScript types. *Criteria: Clean compilation with no warnings.*
2. **Unit & Integration Tests**: Tests on Domain and infrastructure. *Criteria: 100% Pass.*
3. **E2E Tests**: Simulation of user flows (cart, checkout). *Criteria: Success without blockers.*
4. **Security Scans**: SAST to detect vulnerabilities in the code. *Criteria: 0 High/Critical CVEs.*
5. **IaC Security (Checkov)**: Infrastructure configuration scanning. *Criteria: No bad practices.*
6. **Container Scan (Trivy)**: Vulnerability scanning at OS/Libraries level. *Criteria: Approved image.*
7. **Production Build**: Final Next.js compilation. *Criteria: Exit code 0.*
8. **DAST (OWASP ZAP)**: Dynamic testing against the generated build. *Criteria: Zero exploitable breaches.*
9. **SLSA Release & OIDC Deploy**: Cryptographic provenance generation and passwordless authentication. *Criteria: Signed provenance.*
10. **Vercel - Deployment**: Automatic promotion to Edge Network. *Criteria: Live environment 100%.*

## Branching Policy
To make efficient use of the checks, we operate under the following policy:
- **`main` (Production)**: Strictly protected branch. It only contains code that passed 100% of the CI/CD checks.
- **`develop` (Integration)**: Central branch (Pre-production). Features converge at the end of each Sprint.
- **`feature/*`**: Isolate the development of User Stories. They are submitted to `develop` via Pull Request (PR) requiring GitHub Actions approval.
- **`hotfix/*`**: Created from `main` exceptionally to fix critical bugs in production with top priority.