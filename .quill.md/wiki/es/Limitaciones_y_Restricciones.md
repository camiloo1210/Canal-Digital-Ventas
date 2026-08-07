---
id: df4ed31b-b2f4-4bfb-b1c5-0369e492372d
immutable: false
integrity_hash: "sha256:38b4cee8854682363dfcefb9b89c069377f1d15de8cd69d02496191566803c29"
---

# Limitaciones y Restricciones del Proyecto

La ejecución y viabilidad del canal de ventas digital requiere establecer parámetros claros que delimiten su entorno operativo y de desarrollo. 

## Limitaciones
Factores externos, capacidad de recursos y dependencias de terceros:
- El desarrollo del sistema estará limitado al tiempo estipulado para la culminación del proyecto Capstone (4 - 6 meses), abarcando todas las fases de diseño, arquitectura, desarrollo y pruebas.
- El sistema será desarrollado por un equipo de dos personas dentro del plazo establecido.
- El funcionamiento del módulo de notificaciones automatizadas dependerá estrictamente de los tiempos de aprobación, las políticas y la disponibilidad de la API de WhatsApp Business Cloud (Meta).
- La pasarela de pagos estará restringida a una única integración oficial de procesamiento transaccional mediante Lemon Squeezy.
- El rendimiento inicial y la tolerancia de carga estarán condicionados a las cuotas de procesamiento de los servicios en la nube en sus planes adoptados (ej. límites de transferencia en Vercel o cuotas de base de datos en Supabase).

## Restricciones
Directrices arquitectónicas innegociables y normativas legales obligatorias:
- El sistema debe ser construido obligatoriamente bajo el patrón de Arquitectura Hexagonal combinado con Vertical Slicing, utilizando el framework Next.js con App Router.
- El despliegue de la Aplicación Web y el Middleware de Edge se realizará de forma exclusiva en Vercel.
- La base de datos y la autenticación de usuarios (Administrador, Vendedor, Comprador Mayorista) deberán delegarse obligatoriamente a Supabase (PostgreSQL y Supabase Auth) como plataforma gestionada.
- La protección contra ataques de fuerza bruta y el control de tráfico (rate-limiting) deberán implementarse utilizando Upstash Redis, con un límite estricto de 1000 solicitudes por 60 segundos por IP.
- Las transacciones y comunicaciones asíncronas externas (como los webhooks de Lemon Squeezy y Meta) deben ser verificadas criptográficamente de manera obligatoria mediante la firma HMAC-SHA256 con comparación de tiempo constante.
- El sistema deberá cumplir rigurosamente con los principios rectores de la Ley Orgánica de Protección de Datos Personales (LOPDP) de Ecuador, validando estrictamente las entradas con la librería Zod en todas las Server Actions.