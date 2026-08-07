---
id: 09aca8ee-13df-411d-9ff2-feb88ada8232
title: "CU-MOD4-01: Visualizar KPIs del Canal Digital"
author: AI Agent (MCP)
creation_date: "2026-07-29"
updated_date: "2026-07-29"
issue_type: use-case
status: open
labels:
  - ai-generated
relations:
  - type: parent
    id: d8174760-fde6-41ca-9d33-30567f9a1ca6
integrity_hash: "sha256:5dcb85b6c3a1ea949cde1783a0050dfaca6efe268144ce9cf262c46fa2bdf17c"
---

## Actores
<!-- [SECTION_START: Actores] -->
Administrador.
<!-- [SECTION_END: Actores] -->

## Descripción
<!-- [SECTION_START: Descripción] -->
El Administrador accede a la pantalla principal del panel de control para observar los Indicadores Clave de Rendimiento (KPIs) de alto nivel del canal mayorista(ej. Ingresos totales, número de clientes mayoristas activos, ticket promedio).
<!-- [SECTION_END: Descripción] -->

## Excepciones
<!-- [SECTION_START: Excepciones] -->
1 Un usuario con perfil de Vendedor o Comprador intenta acceder a la URL /dashboard. -> El sistema bloquea inmediatamente el acceso y redirige al usuario a la página de inicio, registrando el intento de acceso no autorizado (HTTP 403).
<!-- [SECTION_END: Excepciones] -->

## Secuencia Normal
<!-- [SECTION_START: Secuencia Normal] -->
1 El Administrador navega a la ruta protegida /dashboard. -> El sistema (vía Middleware) intercepta la petición y verifica el token JWT y el permiso ROLES_MANAGE del usuario.
2 -> Una vez autorizado, el sistema ejecuta consultas SQL de agregación (COUNT, SUM) en la base de datos de Supabase.
3 -> El sistema procesa los datos y renderiza la interfaz gráfica mostrando los indicadores numéricos principales.
<!-- [SECTION_END: Secuencia Normal] -->

## Post-condiciones
<!-- [SECTION_START: Post-condiciones] -->
El sistema despliega las tarjetas de resumen (KPI Cards) con información consolidada en tiempo real.
<!-- [SECTION_END: Post-condiciones] -->

## Pre-condiciones
<!-- [SECTION_START: Pre-condiciones] -->
El usuario debe poseer una sesión activa y tener asignado el permiso de superusuario ROLES_MANAGE.
<!-- [SECTION_END: Pre-condiciones] -->

## Rendimiento
<!-- [SECTION_START: Rendimiento] -->
Las consultas de agregación a la base de datos deben resolverse en menos de 800 milisegundos para garantizar una carga fluida de la pantalla inicial.
<!-- [SECTION_END: Rendimiento] -->
