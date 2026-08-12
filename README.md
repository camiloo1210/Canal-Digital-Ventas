# Papelería Costa Azul - Canal de Ventas Digital

<p align="center">
  <img 
    src="/public/Logo.svg" 
    alt="Logo" 
    width="200" 
  />
</p>

## Resumen del Proyecto

Este proyecto consiste en el diseño e implementación de un **sistema web responsive** orientado a transformar y expandir el alcance comercial de la **Papelería Costa Azul** (ubicada en Manta, Ecuador). La plataforma actúa como un canal de ventas digital para mayoristas conectando el extenso inventario de la papelería directamente con compradores corporativos, negocios e instituciones.

## ¿Qué problema busca solucionar?

Actualmente, la Papelería Costa Azul opera bajo un modelo exclusivamente presencial y minorista, lo que genera limitaciones críticas para su crecimiento:

1. **Frontera Física y Operativa:** El negocio pierde oportunidades de venta al no tener cómo exponer su catálogo y precios al por mayor a clientes externos sin que visiten físicamente el local.
2. **Estacionalidad Extrema:** Alta dependencia económica de la temporada escolar, con caídas de ingresos el resto del año.
3. **Carencia Tecnológica:** Ausencia total de herramientas digitales estructuradas para gestionar pedidos mayoristas.

## La Solución

Se desarrolló un **Canal de Ventas Digital Exclusivo para Mayoristas** que expone más de 450 productos con precios escalonados y disponibilidad en tiempo real. Automatiza el flujo de compra, pago en línea y notificación logística.

## Arquitectura y Stack Tecnológico

El sistema está construido sobre un "Monolito Modular" siguiendo el patrón de **Arquitectura Hexagonal con Vertical Slicing**, lo que garantiza un bajo acoplamiento, alta cohesión y una separación estricta entre la lógica de dominio (en TypeScript puro) y las dependencias externas.

- **Core / Framework:** **Next.js (App Router)** combinado con **TypeScript** para mantener tipado estricto de extremo a extremo. El uso de _Server Components_ y _Server Actions_ optimiza la carga inicial y reduce la latencia de las operaciones.
- **Base de Datos y Autenticación:** **Supabase (PostgreSQL)** como plataforma gestionada. Se utiliza _Supabase Auth_ para el control de sesiones y políticas de seguridad a nivel de fila (RLS - Row Level Security) directamente en el motor de base de datos.
- **Validación de Datos:** **Zod** se emplea para la validación estricta de esquemas tanto en el cliente como en el servidor. Esto es fundamental para el cumplimiento de la Ley Orgánica de Protección de Datos Personales (LOPDP), garantizando la integridad de cada entrada antes de llegar a la base de datos.
- **Rate Limiting y Caché:** **Upstash Redis** se utiliza en el Edge Middleware de Vercel para controlar el tráfico (límite de 1000 solicitudes por 60s por IP) y prevenir ataques de fuerza bruta.
- **Pasarela de Pagos:** Integración con **Lemon Squeezy**, procesando webhooks asíncronos verificados criptográficamente (HMAC-SHA256) con comparación de tiempo constante.
- **Mensajería Automatizada:** **WhatsApp Business Cloud API** (Meta) para notificaciones asíncronas y soporte de comandos de autoservicio (`!pedido`, `!factura`).
- **UI/Estilos:** Interfaz responsiva y accesible ("mobile-first") apoyada en la librería de componentes **Shadcn**.
- **Despliegue y CI/CD:** Infraestructura stateless sobre **Vercel** (Edge Network), orquestada mediante pipelines estrictos en **GitHub Actions** (que incluyen análisis SAST/DAST con OWASP ZAP, escaneos de contenedores con Trivy, seguridad de infraestructura con Checkov, así como pruebas unitarias y E2E). Monitoreo de errores a través de **Sentry**.

## Módulos Principales

- **Catálogo Digital:** Búsqueda optimizada con _debounce_ (300ms) en tiempo real, filtros por categoría y generación dinámica de URLs firmadas temporales para el consumo seguro de imágenes.
- **Gestión de Pedidos:** Carrito transaccional con orquestación asíncrona del ciclo de vida de la orden (PENDING, CONFIRMED, SHIPPED, DELIVERED, CANCELLED) e idempotencia en pagos.
- **Notificaciones WhatsApp:** Desacopladas del flujo principal mediante comunicación asíncrona; si la API de Meta cae, no se interrumpe la conversión del carrito.
- **Dashboard Analítico (BI):** Panel de acceso restringido que ejecuta consultas relacionales (JOINs, agregaciones SQL) para auditar KPIs y productos de mayor rotación.
- **Control de Perfiles (RBAC):** Modelo de 14 permisos discretos por rol (Administrador, Vendedor, Comprador Mayorista).

## Impacto

Alineado con el régimen RIMPE y la LOPDP, el sistema digitaliza el 100% del catálogo, proyectando un incremento en ventas mensuales del 20% al 30% fuera de la temporada escolar y llevando el Índice de Rotación de Inventario (IRI) de 6 hasta 10 veces por año.
