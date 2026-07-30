---
id: 9e753018-468d-4186-a850-e0b873174c78
immutable: false
integrity_hash: "sha256:58289d17901b70bb59910cad428242d7efea286f977c0bf0b14dbabf484d1297"
---

# 0002-politica-de-ramas-y-ci-cd

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