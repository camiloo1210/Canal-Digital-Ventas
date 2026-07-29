---
id: "b99b30af-d2b6-480b-be76-59466c911e27"
title: 'CU-MOD4-01: Visualizar KPIs del Canal Digital'
author: AI Agent (MCP)
creation_date: '2026-07-03'
updated_date: '2026-07-03'
issue_type: use-case
status: ready
assignee: dev-1
labels:
  - frontend
relations:
  - type: relates_to
    id: "e264912e-9fb3-46ba-b80d-dd357645b040"
---

<!-- [SECTION_START: description] -->

El Administrador accede a la pantalla principal del panel de control para observar los Indicadores Clave de Rendimiento (KPIs) de alto nivel del canal mayorista (ej. Ingresos totales, número de clientes mayoristas activos, ticket promedio).

<!-- [SECTION_END: description] -->

<!-- [SECTION_START: exceptions] -->

1. Un usuario con perfil de Vendedor o Comprador intenta acceder a la URL /dashboard. -> El sistema bloquea inmediatamente el acceso y redirige al usuario a la página de inicio, registrando el intento de acceso no autorizado (HTTP 403).

<!-- [SECTION_END: exceptions] -->

<!-- [SECTION_START: postconditions] -->

El sistema despliega las tarjetas de resumen (KPI Cards) con información consolidada en tiempo real.

<!-- [SECTION_END: postconditions] -->

<!-- [SECTION_START: preconditions] -->

El usuario debe poseer una sesión activa y tener asignado el permiso de superusuario ROLES_MANAGE.

<!-- [SECTION_END: preconditions] -->

<!-- [SECTION_START: sequence] -->

1. El Administrador navega a la ruta protegida /dashboard. -> El sistema (vía Middleware) intercepta la petición y verifica el token JWT y el permiso ROLES_MANAGE del usuario.
2. Una vez autorizado, el sistema ejecuta consultas SQL de agregación (COUNT, SUM) en la base de datos de Supabase.
3. El sistema procesa los datos y renderiza la interfaz gráfica mostrando los indicadores numéricos principales.

<!-- [SECTION_END: sequence] -->
