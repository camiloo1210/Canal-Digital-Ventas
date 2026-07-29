---
id: 1a5dcee7-8512-4c74-a657-81fc3b77e7d1
title: "DOC-03: Pipeline CI/CD y Política de Ramas"
author: AI Agent (MCP)
creation_date: "2026-07-29"
updated_date: "2026-07-29"
issue_type: documentation
status: open
labels:
  - ai-generated
integrity_hash: "sha256:dd674746600bd62f0f6adbfd274df09eb62ea1878c3978fd2cae9f44b1aec536"
---

## Contenido
<!-- [SECTION_START: Contenido] -->
## Fases del Pipeline de CI/CD (GitHub Actions)
- **Lint & Type Check**: Análisis estático del código fuente. Verifica ESLint y TypeScript en la Arquitectura Hexagonal. (Criterio: Compilación limpia, sin warnings críticos ni errores).
- **Unit & Integration Tests**: Ejecución sobre Paquete de Dominio y adaptadores. (Criterio: 100% aprobadas).
- **E2E Tests**: Simulando flujos reales (carrito, checkout). (Criterio: Finalización exitosa sin bloqueos).
- **Security Scans**: SAST para detectar inyecciones. (Criterio: 0 vulnerabilidades conocidas de severidad Alta o Crítica).
- **IaC Security (Checkov)**: Escaneo de Infraestructura. (Criterio: Configuraciones libres de exposiciones).
- **Container Scan (Trivy)**: Escaneo de imágenes de contenedores. (Criterio: Imagen aprobada sin vulnerabilidades a nivel de paquetes).
- **Production Build**: Compilación final de Next.js. (Criterio: Exit code 0).
- **DAST (OWASP ZAP)**: Pruebas dinámicas contra el build generado. (Criterio: Cero brechas explotables).
- **SLSA Release & OIDC Deploy**: Generación de procedencia criptográfica. (Criterio: Provenance firmado).
- **Vercel - Deployment**: Promoción automática hacia Vercel. (Criterio: Entorno en vivo 100% disponible).

## Política de Ramas
- **main (Producción)**: Rama estrictamente protegida. Solo contiene código estable que ha superado el 100% de pruebas. Merge a esta rama desencadena paso a producción.
- **develop (Integración)**: Rama central de trabajo (Pre-producción). Confluyen las funcionalidades terminadas al final del Sprint.
- **feature/*** : Aislan el desarrollo de cada HU. Exigen Pull Request (PR) con aprobación de GitHub Actions.
- **hotfix/*** : Ramas desde main para corregir defectos críticos detectados en producción de forma inmediata.
<!-- [SECTION_END: Contenido] -->
