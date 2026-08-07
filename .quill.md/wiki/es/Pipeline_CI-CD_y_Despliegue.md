---
id: 6b8876b5-cd77-44fd-bf7e-05dfd315d823
immutable: false
integrity_hash: "sha256:c4344498b30732605beda3a2654014e3b096d4fed15d7e717cca49b994d2f03c"
---

# Pipeline CI/CD, Despliegue y Política de Ramas

Dado que el canal maneja transacciones financieras y datos comerciales, el plan de despliegue integra controles de seguridad automatizados en cada etapa de Integración y Despliegue Continuo utilizando **GitHub Actions**.

## Fases del Pipeline (10 Checks Estrictos)
Antes de que cualquier cambio sea promovido a producción en Vercel, debe superar exitosamente las siguientes validaciones:

1. **Lint & Type Check**: Análisis estático del código (ESLint) y tipos estrictos TypeScript. *Criterio: Compilación limpia sin warnings.*
2. **Unit & Integration Tests**: Pruebas sobre Dominio e infraestructura. *Criterio: 100% Pass.*
3. **E2E Tests**: Simulación de flujos de usuario (carrito, checkout). *Criterio: Éxito sin bloqueos.*
4. **Security Scans**: SAST para detectar vulnerabilidades en el código. *Criterio: 0 CVEs Altos/Críticos.*
5. **IaC Security (Checkov)**: Escaneo de configuración de infraestructura. *Criterio: Sin malas prácticas.*
6. **Container Scan (Trivy)**: Escaneo de vulnerabilidades a nivel OS/Librerías. *Criterio: Imagen aprobada.*
7. **Production Build**: Compilación final Next.js. *Criterio: Exit code 0.*
8. **DAST (OWASP ZAP)**: Pruebas dinámicas contra el build generado. *Criterio: Cero brechas explotables.*
9. **SLSA Release & OIDC Deploy**: Generación de procedencia criptográfica y autenticación sin contraseñas. *Criterio: Provenance firmado.*
10. **Vercel - Deployment**: Promoción automática a Edge Network. *Criterio: Entorno en vivo 100%.*

## Política de Ramas
Para hacer uso eficiente de los checks, se opera bajo la siguiente política:
- **`main` (Producción)**: Rama estrictamente protegida. Solo contiene código que superó el 100% de las pruebas CI/CD.
- **`develop` (Integración)**: Rama central (Pre-producción). Confluyen funcionalidades al final de cada Sprint.
- **`feature/*`**: Aislan el desarrollo de Historias de Usuario. Se envían a `develop` mediante Pull Request (PR) exigiendo aprobación de GitHub Actions.
- **`hotfix/*`**: Creadas desde `main` excepcionalmente para corregir bugs críticos en producción con máxima prioridad.