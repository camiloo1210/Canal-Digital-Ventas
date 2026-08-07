---
id: a33dca18-e42a-4c95-8468-4fb0fab09170
title: "HU-28: Escaneos de Seguridad"
author: AI Agent (MCP)
creation_date: "2026-07-29"
updated_date: "2026-07-29"
issue_type: user-story
status: open
labels:
  - ai-generated
relations:
  - type: relates_to
    id: b794c8e6-b73a-42e2-b8ae-115405dbd5ed
  - type: relates_to
    id: cb3e6de8-90eb-413c-925f-a722f89536ae
priority: Should
story_points: "5"
integrity_hash: "sha256:f26e274bd87013b4e6126fe099ff7e7353bf183d06f66c20bb278cc0ba335388"
---

## Criterios de Aceptación
<!-- [SECTION_START: Criterios de Aceptación] -->
Dado que se realiza un Merge Request en GitLab, Cuando corre el pipeline de seguridad estático, Entonces se reportan 0 vulnerabilidades conocidas de severidad Alta o Crítica.
<!-- [SECTION_END: Criterios de Aceptación] -->

## User story
<!-- [SECTION_START: User story] -->
Como DevSecOps, Quiero someter el código a escaneos de seguridad estáticos (SAST) y dinámicos (DAST), Para identificar y mitigar vulnerabilidades antes del paso a producción.
<!-- [SECTION_END: User story] -->
