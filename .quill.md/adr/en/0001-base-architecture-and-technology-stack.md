---
id: 0956a991-d1fb-4a35-b6ca-827a5317e102
immutable: false
integrity_hash: "sha256:367cd36f16d88f760876575a73cb8ccd69245127a483d54e32f82fade7673488"
---

# en/0001-base-architecture-and-technology-stack

## Status
Accepted

## Context
The project requires building a robust and scalable B2B sales channel for the Costa Azul Stationery Store. Technical resources and time are limited (4-6 months, 2 developers), which requires adopting managed cloud tools and efficient, maintainable development paradigms.

## Decision
We decided to adopt the following mandatory technology and architecture stack:
1. Hexagonal Architecture combined with Vertical Slicing to decouple the domain from the framework.
2. Unified frontend/backend framework: Next.js with App Router.
3. Serverless and Edge deployment: Vercel.
4. Database and Authentication: Managed Supabase (PostgreSQL and Auth).
5. Protection and Rate Limiting: Upstash Redis to prevent brute force attacks (1000 req/min per IP).
6. Payments: Lemon Squeezy (Mandatory HMAC-SHA256 cryptographic verification for webhooks).

## Consequences
The team must stick to using Next.js, delegating underlying infrastructure management to Vercel and Supabase. Hexagonal architecture introduces a slight initial learning curve but prevents coupling with the database and payment gateway. It enables ultra-fast deployment times and high commercial concurrency tolerance, in exchange for cloud provider dependency or lock-in (Vercel, Supabase, Upstash).