---
id: a5e30029-f97c-48ff-ad04-7fadfc9003a2
title: "CU-MOD4-03: Consultar Métricas de Pedidos"
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
integrity_hash: "sha256:9ea9b71bb3599e95751bd76c06b29126b0efa5cfe65466bc98fef92bb6e67836"
---

## Actores
<!-- [SECTION_START: Actores] -->
Administrador.
<!-- [SECTION_END: Actores] -->

## Descripción
<!-- [SECTION_START: Descripción] -->
El Administrador audita la eficiencia operativa del canal revisando el volumen de pedidos agrupados por su estado actual (Pendientes, Confirmados, Cancelados), lo que permite identificar cuellos de botella en el despacho.
<!-- [SECTION_END: Descripción] -->

## Excepciones
<!-- [SECTION_START: Excepciones] -->
1 El sistema experimenta un error de conexión con la base de datos de Supabase. -> El componente muestra un mensaje de error encapsulado ("Error al cargar las métricas operativas") sin hacer colapsar el resto del Dashboard.
<!-- [SECTION_END: Excepciones] -->

## Secuencia Normal
<!-- [SECTION_START: Secuencia Normal] -->
1 El Administrador navega a la sección de Métricas Operativas. -> El sistema consulta el total de pedidos históricos en la base de datos.
2 -> El sistema agrupa los registros por la columna status y calcula los porcentajes correspondientes de cada fase.
3 -> El sistema renderiza el componente visual segmentando los pedidos cancelados vs. los completados.
<!-- [SECTION_END: Secuencia Normal] -->

## Post-condiciones
<!-- [SECTION_START: Post-condiciones] -->
El sistema muestra un desglose visual de los estados de los pedidos.
<!-- [SECTION_END: Post-condiciones] -->

## Pre-condiciones
<!-- [SECTION_START: Pre-condiciones] -->
El Administrador debe estar dentro del Dashboard.
<!-- [SECTION_END: Pre-condiciones] -->

## Rendimiento
<!-- [SECTION_START: Rendimiento] -->
Tiempo de carga < 500ms.
<!-- [SECTION_END: Rendimiento] -->
