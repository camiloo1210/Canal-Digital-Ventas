---
id: f085dd55-874a-4410-9518-370a12ffce86
immutable: false
integrity_hash: "sha256:9e77aff5314991bae052df1b7fde5afb86ed56e2032eaad7315797c7a69073a1"
---

# Alcance y Exclusiones del Proyecto

## Alcance de la solución seleccionada
El proyecto inicia con la fase de levantamiento de requerimientos y diseño de la arquitectura, y abarca hasta el desarrollo, pruebas y despliegue en producción de la aplicación web responsive. Dentro de esta delimitación, el sistema cuenta exclusivamente con funcionalidades de:
- Notificaciones automatizadas vía WhatsApp.
- Exploración y búsqueda en el catálogo digital.
- Gestión de pedidos comerciales y procesamiento de pagos.
- Visualización de métricas en un dashboard analítico.
- Control de perfiles y permisos.
- Administración general de productos y precios al por mayor.

Todo dividido en seis módulos principales. Dentro del proyecto también se delimitan ciertas actividades que no forman parte del alcance.

## Exclusiones del proyecto
El proyecto no contempla las siguientes funcionalidades:
- **Logística de envío nacional**: El sistema gestionará los estados internos del pedido (ej. Confirmado, Enviado, Entregado), pero no contará con integraciones a plataformas de terceros (couriers como Servientrega o LaarCourier) para el rastreo satelital o cotización dinámica de fletes.
- **Facturación electrónica automatizada (SRI)**: El sistema no emitirá facturas electrónicas de forma automática. La Papelería operará bajo su régimen RIMPE Negocios Populares, emitiendo notas de venta físicas o gestionando facturas por fuera del sistema a petición del comprador.
- **Aplicación móvil nativa**: No se desarrollarán aplicaciones descargables para Android (APK) ni iOS (IPA). La solución será estrictamente una aplicación web responsive.
- **Módulo de compras a proveedores e inventario físico automatizado**: No se manejará la cadena de suministro hacia atrás (proveedores de la papelería), cuentas por pagar, gestión de gastos internos ni integración con hardware de escaneo de código de barras en el mostrador físico.
- **Mantenimiento de hardware**: El proyecto excluye cualquier tipo de soporte técnico a los equipos de cómputo físicos de la papelería.