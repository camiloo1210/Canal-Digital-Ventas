---
id: b1256ad9-ee54-4f0a-a666-8ce70c231c94
immutable: false
integrity_hash: "sha256:9da06269ccf418bf9df407abafeaf93d4bf47081f01ddce747b797eafafc3a71"
---

# Project Limitations and Restrictions

The execution and viability of the digital sales channel requires establishing clear parameters that delimit its operational and development environment.

## Limitations
External factors, resource capacity, and third-party dependencies:
- System development will be limited to the time stipulated for the completion of the Capstone project (4 - 6 months), covering all phases of design, architecture, development, and testing.
- The system will be developed by a team of two people within the established timeframe.
- The operation of the automated notifications module will strictly depend on the approval times, policies, and availability of the WhatsApp Business Cloud (Meta) API.
- The payment gateway will be restricted to a single official transactional processing integration through Lemon Squeezy.
- Initial performance and load tolerance will be conditioned by the processing quotas of the cloud services in their adopted plans (e.g. transfer limits in Vercel or database quotas in Supabase).

## Restrictions
Non-negotiable architectural guidelines and mandatory legal regulations:
- The system must obligatorily be built under the Hexagonal Architecture pattern combined with Vertical Slicing, using the Next.js framework with App Router.
- The deployment of the Web Application and the Edge Middleware will be done exclusively on Vercel.
- The database and user authentication (Administrator, Seller, Wholesale Buyer) must obligatorily be delegated to Supabase (PostgreSQL and Supabase Auth) as a managed platform.
- Protection against brute force attacks and traffic control (rate-limiting) must be implemented using Upstash Redis, with a strict limit of 1000 requests per 60 seconds per IP.
- External asynchronous transactions and communications (such as Lemon Squeezy and Meta webhooks) must be cryptographically verified obligatorily through HMAC-SHA256 signing with constant-time comparison.
- The system must rigorously comply with the guiding principles of the Organic Law on Personal Data Protection (LOPDP) of Ecuador, strictly validating inputs with the Zod library in all Server Actions.