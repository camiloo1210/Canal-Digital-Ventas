---
id: ce7ceccf-e984-43d2-be23-d91749d72283
immutable: false
integrity_hash: "sha256:29da0d13d84029f6a8264f33da9c402837bcca52b3252847ff2e07763d8a82b0"
---

# es/0002-politica-de-ramas-y-ci-cd

## Status
Accepted

## Context
Dado que el sistema procesa pagos reales y almacena datos confidenciales de usuarios y pedidos, los pasos a producción no pueden dejarse a procesos manuales propensos a error.

## Decision
Se adopta un flujo de integración continua estricto utilizando GitHub Actions:
- Estructura de ramas: `main` (Producción), `develop` (Integración), `feature/*` y `hotfix/*`.
- Antes de hacer merge hacia las ramas principales, el código debe superar obligatoriamente un Pipeline de 10 validaciones (Linting, Unit Tests, E2E Tests, SAST, DAST, Checkov, Trivy, OIDC Deploy).

## Consequences
Todo el código que llegue a producción estará altamente auditado, asegurando estabilidad y cumplimiento de buenas prácticas de seguridad. El desarrollo individual (`feature/*`) requerirá que los desarrolladores aseguren un alto nivel de calidad de código local para evitar bloqueos continuos por parte del CI/CD, lo que alarga ligeramente el ciclo de vida de un PR pero reduce drásticamente las fallas críticas.