---
id: a034516a-e038-4aee-9548-67f1490b551d
immutable: false
integrity_hash: "sha256:51d12a897f052cc509d4a459ccfc01b7a363b00deb8613db3885a7e96b21ead5"
---

# es/0001-arquitectura-base-y-stack-tecnologico

## Status
Accepted

## Context
El proyecto requiere la construcción de un canal de ventas B2B robusto y escalable para la Papelería Costa Azul. Se dispone de recursos técnicos y tiempos limitados (4-6 meses, 2 desarrolladores), lo que exige la adopción de herramientas gestionadas en la nube y paradigmas de desarrollo eficientes y mantenibles.

## Decision
Se decide adoptar el siguiente stack tecnológico y arquitectónico obligatorio:
1. Arquitectura Hexagonal combinada con Vertical Slicing para desacoplar el dominio del framework.
2. Framework de frontend/backend unificado: Next.js con App Router.
3. Despliegue serverless y de borde (Edge): Vercel.
4. Base de Datos y Autenticación: Supabase (PostgreSQL y Auth) gestionado.
5. Protección y Rate Limiting: Upstash Redis para evitar ataques de fuerza bruta (1000 req/min por IP).
6. Pagos: Lemon Squeezy (Verificación criptográfica HMAC-SHA256 obligatoria para webhooks).

## Consequences
El equipo debe apegarse al uso de Next.js, delegando la gestión de la infraestructura subyacente a Vercel y Supabase. La arquitectura Hexagonal introduce una ligera curva de aprendizaje inicial pero previene el acoplamiento con la base de datos y la pasarela de pagos. Permite alcanzar tiempos de despliegue ultrarrápidos y alta tolerancia a concurrencia comercial, a cambio de la dependencia o lock-in de proveedores de nube (Vercel, Supabase, Upstash).