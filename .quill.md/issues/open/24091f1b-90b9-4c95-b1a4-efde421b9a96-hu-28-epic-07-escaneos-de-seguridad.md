---
id: 24091f1b-90b9-4c95-b1a4-efde421b9a96
title: "HU-28(EPIC-07): Escaneos de Seguridad"
author: AI Agent (MCP)
creation_date: "2026-07-29"
updated_date: "2026-07-29"
issue_type: user-story
status: open
labels:
  - ai-generated
relations:
  - type: relates_to
    id: ad2865f9-cda3-47ad-95d9-5e34a5d4708e
  - type: relates_to
    id: cb3e6de8-90eb-413c-925f-a722f89536ae
priority: Should
story_points: "5"
integrity_hash: "sha256:dac01f0dfcf24e5677a6e131911457976c1da087279248eca7bc7dd50c85aa8e"
---

## Criterios de Aceptación
<!-- [SECTION_START: Criterios de Aceptación] -->
Dado que se realiza un Merge Request en GitLab, Cuando corre el pipeline de seguridad estático, Entonces se reportan 0 vulnerabilidades conocidas de severidad Alta o Crítica.
<!-- [SECTION_END: Criterios de Aceptación] -->

## User story
<!-- [SECTION_START: User story] -->
Como DevSecOps, Quiero someter el código a escaneos de seguridad estáticos (SAST) y dinámicos (DAST), Para identificar y mitigar vulnerabilidades antes del paso a producción.
<!-- [SECTION_END: User story] -->
