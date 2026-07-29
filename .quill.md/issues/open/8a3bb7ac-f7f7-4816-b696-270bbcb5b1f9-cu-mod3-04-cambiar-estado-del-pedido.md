---
id: 8a3bb7ac-f7f7-4816-b696-270bbcb5b1f9
title: "CU-MOD3-04: Cambiar Estado del Pedido"
author: AI Agent (MCP)
creation_date: "2026-07-29"
updated_date: "2026-07-29"
issue_type: use-case
status: open
labels:
  - ai-generated
relations:
  - type: parent
    id: a80dfdb8-a769-4a1a-8f93-ba7c29cd16a6
frecuencia: Alta
importancia: Alta
urgencia: Media
integrity_hash: "sha256:49080beaf288ee5b9b0c97083c337fa4000c95851ffd3ff010262a725dad4f41"
---

## Actores
<!-- [SECTION_START: Actores] -->
Vendedor.
<!-- [SECTION_END: Actores] -->

## Descripción
<!-- [SECTION_START: Descripción] -->
El Vendedor gestiona el ciclo de vida logístico del pedido una vez que ha sido confirmado. Utiliza la interfaz operativa interna para transicionar la orden a los estados SHIPPED (Enviado) y DELIVERED (Entregado).
<!-- [SECTION_END: Descripción] -->

## Excepciones
<!-- [SECTION_START: Excepciones] -->
1 Un usuario sin permisos operativos intenta acceder al endpoint de actualización de estado. -> El sistema bloquea la acción mediante Middleware devolviendo un error 403 Forbidden.
<!-- [SECTION_END: Excepciones] -->

## Secuencia Normal
<!-- [SECTION_START: Secuencia Normal] -->
1 El Vendedor accede a la bandeja de gestión de pedidos en el panel de control. -> El sistema despliega la lista de pedidos activos.
2 El Vendedor selecciona un pedido confirmado y hace clic en "Marcar como Enviado". -> El sistema valida la autorización del vendedor.
3 -> El sistema actualiza el registro en la base de datos, cambiando el estado a SHIPPED.
<!-- [SECTION_END: Secuencia Normal] -->

## Post-condiciones
<!-- [SECTION_START: Post-condiciones] -->
El estado de la orden se actualiza en la base de datos (lo que dispara el Módulo de Notificaciones al cliente).
<!-- [SECTION_END: Post-condiciones] -->

## Pre-condiciones
<!-- [SECTION_START: Pre-condiciones] -->
El usuario debe estar autenticado con un perfil operativo válido. El pedido debe estar en estado CONFIRMED o superior.
<!-- [SECTION_END: Pre-condiciones] -->

## Rendimiento
<!-- [SECTION_START: Rendimiento] -->
La actualización de estado es una operación ligera que debe resolverse en < 200ms.
<!-- [SECTION_END: Rendimiento] -->
