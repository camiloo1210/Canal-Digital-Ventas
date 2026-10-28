# Kivi messaging code audit

Date: October 28, 2026.

Scope: the 43 files modified or untracked at the start of this audit, covering Kivi messaging, notification delivery, storefront integration, configuration, translations, the SQL migration, and two documentation files. Three domain files were added to address recipient validation: a value object, its exception, and its unit tests.

## Findings and corrections

| Finding                                                                                    | Correction                                                                                                                                                                                                           |
| ------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Recipient normalization and invariants were embedded in the PostgreSQL adapter.            | Moved them into `KiviNotificationRecipient`, a framework-independent value object with a private constructor and validated factories. The adapter translates its domain exception into a permanent delivery failure. |
| Invalid notification checkbox values were silently interpreted as disabled preferences.    | Parse the original form entries with Zod and reject unexpected strings and files before invoking the use case.                                                                                                       |
| An invalid phone number ID was truncated in the returned action state.                     | Preserve the original non-secret value on rejection.                                                                                                                                                                 |
| Notification configuration did not distinguish an unlinked connection.                     | Map `KiviConnectionNotFoundException` to the existing localized recovery message.                                                                                                                                    |
| Three test fixtures constructed generic errors.                                            | Use custom infrastructure exceptions, preserving the test that checks secret-bearing error messages are masked.                                                                                                      |
| Messaging documentation was written in Spanish.                                            | Translate it into English and rename it to `KIVI-MESSAGING.md`. Preserve historical validation as explicitly attributed implementation notes.                                                                        |
| The English privacy guide had a Spanish filename, and some comments repeated declarations. | Rename the guide to `LOPDP-REMEDIATION-GUIDE.md`, update its location, and remove redundant comments.                                                                                                                |

## Architecture review

- Next.js pages and actions resolve dependencies through server-only DI. Pages read through ports; actions parse input and invoke Core use cases.
- Store owner authorization runs in Core using the authenticated actor and server-resolved tenant. Submitted actor and tenant fields do not override this context.
- Ownership and connection reads share a transaction. Remote HTTP calls run after that transaction completes.
- Order mutation and outbox publication remain in the existing Core flow. The new SQL functions provide restricted projections and an idempotency fence.
- The storefront receives only its public widget key. Credentials remain in server adapters, and action responses exclude submitted tokens.
- Domain recipient validation has no framework, persistence, or HTTP dependency.
- User-facing messages remain localized in English and Spanish. Code, comments, and the reviewed documentation use English.

## Verification

- `pnpm lint`: passed with zero warnings.
- `pnpm test`: 1,313 passed; 42 skipped across eight integration test files.
- TypeScript checks for Core, Web, and Worker: passed.
- AST inspection of all 38 pending TypeScript files: no explicit `any`, relative static or dynamic imports, generic error construction, or missing function return types.
- All 49 `KiviMessaging` translation keys match between English and Spanish.
- `git diff --check`: passed.

Fifteen regression cases were added for recipient invariants, malformed form inputs, input retention, connection error mapping, and unauthenticated requests. The passing suite includes the existing web architecture enforcement tests.

The skipped integration tests require external-service configuration. This audit did not re-run the historical temporary-PostgreSQL or separate Kivi-repository checks described in the messaging guide, validate production RLS, apply migrations, or send real messages. Deployment acceptance with PostgreSQL, RabbitMQ, Meta, and the tenant widget remains outstanding.
