---
id: e8ff14cb-b501-46ec-922a-e53baf0c9193
title: "DOC-01: Alcance y Exclusiones"
author: AI Agent (MCP)
creation_date: "2026-07-29"
updated_date: "2026-07-29"
issue_type: documentation
status: open
labels:
  - ai-generated
integrity_hash: "sha256:ae09f9810e342196bb4c1eb312875075336a79df2625bdb2fd737cd6d1f49452"
---

## Contenido
<!-- [SECTION_START: Contenido] -->
## Alcance de la solución seleccionada
El proyecto inicia con la fase de levantamiento de requerimientos y diseño de la arquitectura, y abarca hasta el desarrollo, pruebas y despliegue en producción de la aplicación web responsive. Dentro de esta delimitación y como se puede observar en la Figura 13, el sistema cuenta exclusivamente con funcionalidades de notificaciones automatizadas vía WhatsApp, exploración y búsqueda en el catálogo digital, gestión de pedidos comerciales y procesamiento de pagos, visualización de métricas en un dashboard analítico, control de perfiles y permisos, y administración general de productos y precios al por mayor, todo dividido en seis módulos principales.

## Exclusiones del proyecto
El proyecto no contempla las siguientes funcionalidades:
- **Logística de envío nacional**: El sistema gestionará los estados internos del pedido (ej. Confirmado, Enviado, Entregado), pero no contará con integraciones a plataformas de terceros (couriers como Servientrega o LaarCourier) para el rastreo satelital o cotización dinámica de fletes.
- **Facturación electrónica automatizada (SRI)**: El sistema no emitirá facturas electrónicas de forma automática. La Papelería operará bajo su régimen RIMPE Negocios Populares, emitiendo notas de venta físicas o gestionando facturas por fuera del sistema a petición del comprador.
- **Aplicación móvil nativa**: No se desarrollarán aplicaciones descargables para Android (APK) ni iOS (IPA). La solución será estrictamente una aplicación web responsive.
- **Módulo de compras a proveedores e inventario físico automatizado**: No se manejará la cadena de suministro hacia atrás (proveedores de la papelería), cuentas por pagar, gestión de gastos internos ni integración con hardware de escaneo de código de barras en el mostrador físico.
- **Mantenimiento de hardware**: El proyecto excluye cualquier tipo de soporte técnico a los equipos de cómputo físicos de la papelería.
<!-- [SECTION_END: Contenido] -->
