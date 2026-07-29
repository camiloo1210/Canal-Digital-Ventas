---
id: "261c7c26-ed69-45a4-bf4e-8d621e0924bf"
title: 'HU-28: Escaneos de seguridad SAST y DAST'
author: AI Agent (MCP)
creation_date: '2026-07-03'
updated_date: '2026-07-03'
issue_type: user-story
status: ready
assignee: dev-1
labels:
  - frontend
story_points: '5'
relations:
  - type: parent
    id: "1f97c1e5-2ae8-42d7-a99c-e0b43ccd6439"
  - type: depends_on
    id: "9b541cae-3982-4610-9971-72fe123690b7"
---

<!-- [SECTION_START: acceptance] -->

**Dado** que se realiza un Merge Request en GitLab,
**Cuando** corre el pipeline de seguridad estático,
**Entonces** se reportan 0 vulnerabilidades conocidas de severidad Alta o Crítica.

<!-- [SECTION_END: acceptance] -->

<!-- [SECTION_START: user_story] -->

**Como** DevSecOps,
**Quiero** someter el código a escaneos de seguridad estáticos (SAST) y dinámicos (DAST),
**Para** identificar y mitigar vulnerabilidades antes del paso a producción.

<!-- [SECTION_END: user_story] -->
