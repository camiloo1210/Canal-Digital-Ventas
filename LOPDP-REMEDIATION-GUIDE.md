# Ecuador LOPDP review and remediation guide

**Project:** Canal Digital Ventas.  
**Audit reference date:** October 25, 2026.  
**Status:** proposed plan; unchecked items do not represent completed work.

This guide turns the audit's thirteen findings into reviewable steps. It distinguishes software changes, infrastructure verification, and legal or organizational decisions. This document does not implement changes.

## Contents

1. Reviewing the evidence package.
2. Preparation and ownership.
3. Priority corrections.
4. Information, purposes, and data subject rights.
5. Retention and deletion.
6. Providers, chat, and incidents.
7. Encryption and access security.
8. Risk, DPO, and impact assessment.
9. Implementation within the project's architecture.
10. Schedule and acceptance evidence.
11. Tracking templates.

## 1. Reviewing the evidence package

Read in this order:

| Document                                                                                                          | Review focus                                                                        |
| ----------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| [Main report](T:/Camilo/Canal-Digital-Ventas/docs/audits/lopdp-ecuador-2026-10-25/REPORT.md)                      | Assessment, legal framework, processed data, thirteen gaps, and recommended design. |
| [Technical evidence](T:/Camilo/Canal-Digital-Ventas/docs/audits/lopdp-ecuador-2026-10-25/FINDINGS-DETAIL.md)      | Paths, lines, conditions, and acceptance tests for each finding.                    |
| [Architecture and scope](T:/Camilo/Canal-Digital-Ventas/docs/audits/lopdp-ecuador-2026-10-25/architecture.md)     | Systems, boundaries, and review limitations.                                        |
| [Completed validation](T:/Camilo/Canal-Digital-Ventas/docs/audits/lopdp-ecuador-2026-10-25/VALIDATION.md)         | Actual test/lint results and controls that remain unverified.                       |
| [Structured matrix](T:/Camilo/Canal-Digital-Ventas/docs/audits/lopdp-ecuador-2026-10-25/compliance-findings.json) | Findings L01–L13 for conversion into implementation tasks.                          |

For each finding:

- [ ] Read the evidence and check whether the code or deployment has changed since the audit.
- [ ] Separate source-confirmed behavior from outstanding operational configuration checks.
- [ ] Request organizational documentation that may exist outside the repository.
- [ ] Assign an owner and target date.
- [ ] Approve the solution and its acceptance test.
- [ ] Close the finding only with verifiable evidence.

**Interpretation:** exploitation in production was not confirmed, and comprehensive compliance was not established. A policy's absence from Git does not prove that the organization lacks one; absence of field encryption does not prove that the provider's disks are unencrypted.

## 2. Preparation and ownership

### Step 1. Identify responsibility for the data

**Related findings:** L06 and L13.  
**Proposed owners:** management and privacy legal counsel.

- [ ] Identify the legal name/RUC of the merchant and technology operator, if different.
- [ ] Determine who decides purposes and means for accounts, orders, support, invoicing, and security.
- [ ] Identify the controller, processor, or recipient acting for its own purposes for each processing activity.
- [ ] Document the duties of store staff, administrators, and technical support.
- [ ] Appoint a plan coordinator; assess separately whether a DPO is required.
- [ ] Determine who approves policies, contracts, risks, and responses to data subjects.

**Deliverable:** responsibility map for each processing activity. Do not automatically equate `tenantId` or the OWNER role with a legal classification.

### Step 2. Prepare safe verification

**Owners:** backend, database, and operations.

- [ ] Create or use isolated staging and synthetic accounts for two stores.
- [ ] Separate credentials, test SMTP, queues, and buckets from production.
- [ ] Prepare anon, buyer A/B, seller, OWNER/ADMIN, and restricted worker profiles.
- [ ] Record code version, migrations, and effective configuration.
- [ ] Define how to preserve results without real personal data or secrets.

**Deliverable:** environment and fixture record. Requests in the technical appendix must not target real records.

## 3. Priority corrections

### Step 3. Restrict privileged SQL functions — L01

**Priority:** high.  
**Owners:** backend/database and security.

Functions to review:

- `public.upsert_user_transactional`.
- `public.upsert_tenant_transactional`.
- `core.onboard_tenant_transactional`.

Sequence:

1. Inspect the effective catalog: definitions, owners, SECURITY DEFINER, and EXECUTE privileges by role.
2. Check Data API exposed schemas and each function owner's privileges.
3. Review repository calls to identify dependent flows.
4. Decide whether to remove the functions or replace them with authorized operations through ports and transactions.
5. If an RPC remains, enforce authorization inside it, use a trusted actor, and apply least privilege.
6. Create a new migration that restricts access; editing historical migrations alone is insufficient.
7. Run the test matrix and verify that legitimate flows still work.
8. After applying the change in the relevant environment, inspect effective permissions again.

**Acceptance tests:**

- [ ] Anon cannot modify profiles or stores.
- [ ] User A cannot modify B, even with B's UUID and a higher submitted version.
- [ ] Store A's administrator cannot modify store B.
- [ ] Onboarding does not accept another person's identity supplied by the client.
- [ ] Authorized operations preserve atomicity and concurrency control.

**Evidence:** migration, catalog before/after, and results. Do not describe the defect as password theft: the identified flow does not modify `auth.users`.

### Step 4. Correct repeated-purchase email delivery — L08

**Priority:** medium, with immediate review if complaints or compromised addresses exist.  
**Owners:** product and backend.

Problem: checkout accepts a new email, but the existing customer is not updated and notifications use the historical email.

1. Decide whether the recipient is a verified account contact or a verified order contact.
2. Explain the decision in the interface; do not present an editable email that is subsequently ignored.
3. Implement the authorized change and verification of the new contact.
4. Define handling of pending notifications, retries, and the revoked previous contact.
5. Preserve only the historical evidence required for earlier orders.

**Test:** first purchase with email A; second purchase with email B and a different address. Capture email in test SMTP. After B is approved, A must not receive new data. Test retries and rejection of unauthorized changes too.

### Step 5. Minimize data in logs — L10

**Owners:** backend and operations.

- [ ] Remove complete event printing from LocalEventBus.
- [ ] Replace indiscriminate `console.error(error)` calls with structured events containing allowed fields.
- [ ] Use codes, outcomes, and minimal correlation; exclude passwords, tokens, documents, and addresses.
- [ ] Review log access, exports, and support tools.
- [ ] Approve log retention and expiration.
- [ ] Assess historical log copies and their deletion under the policy.

**Test:** run onboarding and synthetic failures; inspect output and confirm excluded fixture data is absent.

## 4. Information, purposes, and data subject rights

### Step 6. Inventory data and justify each field — L09/L13

**Owners:** product, privacy, and backend.

- [ ] Enumerate account, merchant, buyer, order, payment, notification, browser, and chat data.
- [ ] Identify where each item is collected, who accesses it, and where it is copied.
- [ ] Assign a purpose and legal basis to each processing activity.
- [ ] Justify identity documents, phone numbers, and addresses according to delivery, pickup, invoicing, and actual obligations.
- [ ] Make unnecessary fields optional or conditional.
- [ ] Review reference/free-text fields to prevent excessive collection.
- [ ] Confirm whether minors or special categories of personal data may be involved.

**Deliverable:** inventory and Record of Processing Activities (RAT), based on actual data and processes. Do not assume that a small business is exempt.

### Step 7. Publish notices and manage preferences — L02

**Owners:** privacy and product; frontend implementation.

1. Draft complete information and a brief first layer for registration, checkout, and support/chat.
2. Include the controller's identity/contact, purposes, legal bases, retention, recipients, rights, and complaints.
3. Check that each statement corresponds to a real capability and existing contracts.
4. Publish accessible notices before collection, in Spanish and English as required by the project.
5. Version the texts and retain appropriate evidence of the information provided.
6. For purposes requiring consent, implement specific choices and verifiable withdrawal.
7. Separate advertising and promotions from order execution.

**Acceptance:** a person can understand who uses their data and how to exercise rights without registering or completing a purchase. Do not use an “accept everything” checkbox as a universal legal basis.

### Step 8. Provide a rights-request channel — L03

**Owners:** privacy, customer support, and backend.

A correctly managed assisted channel can be used while a portal is implemented.

- [ ] Publish the channel and procedure.
- [ ] Record receipt, requested right, and case owner.
- [ ] Verify identity proportionately; do not request an identity-card copy by default.
- [ ] Identify the person's records across Auth and store-specific profiles.
- [ ] Define deadlines for each right, alerts, and legal escalation.
- [ ] Provide secure access/export without including third-party data.
- [ ] Implement rectification and communication of changes to recipients where applicable.
- [ ] Resolve objections and suspension/restriction as appropriate.
- [ ] Carry out deletion or blocking with reasoned exceptions and minimum scope.
- [ ] Coordinate requests with processors and record completion.
- [ ] Provide an understandable response and closure record.

**Tests:** a person associated with two stores, unverified identity, third-party data in orders, and deletion subject to a retention obligation. Deactivating an account is not equivalent to deleting its data.

## 5. Retention and deletion

### Step 9. Approve a retention matrix — L04

**Owners:** legal/privacy, accounting, and operations.

Define the following for each dataset:

| Field                 | Information to complete                                                      |
| --------------------- | ---------------------------------------------------------------------------- |
| Data and location     | Table, bucket, queue, log, email, provider, and backup.                      |
| Purpose and basis     | Why retention is required.                                                   |
| Starting event        | Account closure, delivery, reconciliation, end of support, or another event. |
| Approved period       | Specific duration and justification; avoid “indefinite.”                     |
| Exceptions            | Litigation, investigation, or a specific legal obligation.                   |
| Final action          | Deletion, blocking, or validated anonymization.                              |
| Executor and evidence | Job, operator, provider, and completion record.                              |

The current thirty-day payment-payload period is an existing technical decision, not a general legal retention period. Determine tax retention periods from the applicable documents and regime before configuring them.

### Step 10. Implement and supervise the complete lifecycle

- [ ] Preserve and verify the current payment-redaction job.
- [ ] Cover stuck states excluded from its current purge.
- [ ] Add policies for customers, orders, Auth, outbox, queues, DLQ, and chat.
- [ ] Define local-cart TTL and shared-device behavior.
- [ ] Apply deletion or blocking to operational copies and exports too.
- [ ] Document backup expiration and reapplication of requests after restoration.
- [ ] Measure processed batches, failures, oldest pending data, and retries.
- [ ] Alert when a job stops running.

**Acceptance:** an expired fixture disappears or is blocked according to policy; a fixture under legal hold retains only what is necessary. A correlatable UUID remains personal data even after the name is removed.

## 6. Providers, chat, and incidents

### Step 11. Review Kivi before expanding its use — L05

**Owners:** product, security, and privacy.

1. Confirm whether the audited local code was deployed.
2. Identify the operator, contract, countries, retention, and subprocessors.
3. Determine whether AI is used, which models are involved, and whether messages are reused for training.
4. Capture traffic, cookies, and storage in staging with synthetic messages.
5. Evaluate its need separately in the catalog, purchases, and checkout.
6. Decide on suspension, loading on request, or support-only use, with a documented basis.
7. If consent is required, prevent prior loading and test withdrawal.
8. Test provider export/deletion and incident handling.

**Acceptance:** processing is known, disclosed, lawfully based, and verifiable. Downloading the script alone does not prove form-data theft; its access to page context must still be considered.

### Step 12. Formalize providers and data transfers — L06

- [ ] Complete records for Supabase, hosting, Google OAuth, Lemon Squeezy, SMTP, and Kivi.
- [ ] Identify regions, replicas, and remote support access.
- [ ] Distinguish processors from recipients acting for their own purposes.
- [ ] Review contracts, instructions, confidentiality, and subcontracting.
- [ ] Agree on assistance with rights, incidents, return, and deletion.
- [ ] Determine the applicable legal mechanism for each international transfer.
- [ ] Record evidence of the mechanism and periodic review.

**Acceptance:** every relevant provider has a known internal owner, country, data scope, function, and contract. Do not assume country adequacy or that ISO certification replaces legal assessment.

### Step 13. Prepare incident response — L07

**Owners:** security, management, privacy, and operations.

- [ ] Provide an available internal alert channel and backup owners.
- [ ] Record detection, awareness, risk assessment, and decisions.
- [ ] Define containment, evidence preservation, and recovery.
- [ ] Identify notification recipients under amended Article 43: SPDP, the competent body, and the corresponding CSIRT.
- [ ] Prepare use of SISPDP and preserve receipts.
- [ ] Prepare clear notices to data subjects and coordination with processors.
- [ ] Configure alerts for immediate action and the applicable legal deadline calculation.
- [ ] Simulate exposure of a buyer's address and document results.

The main report records deadlines and sources. Legal counsel must validate triggering conditions, calculation, and exceptions; do not automatically adopt the European 72-hour period.

## 7. Encryption and access security

### Step 14. Collect encryption evidence — L11

**Owners:** operations and security.

| Connection or asset    | Required verification                                      | Acceptance evidence                                                     |
| ---------------------- | ---------------------------------------------------------- | ----------------------------------------------------------------------- |
| Browser–web/CDN        | TLS, certificate, HTTPS, cookies, and personalized caching | Test the actual endpoint without exposing sessions.                     |
| Web–PostgreSQL         | TLS and certificate/hostname validation                    | Effective configuration and negotiated connection.                      |
| Workers–PostgreSQL     | Preserve verify-full and inspect URL options               | Image/configuration and invalid-certificate rejection test.             |
| SMTP                   | TLS/STARTTLS and relay validation                          | Transport test; distinguish transport from end-to-end email encryption. |
| RabbitMQ               | Effective network, AMQP/AMQPS, ACL, and TLS need           | Configuration and per-process test.                                     |
| Disks/objects/replicas | Encryption at rest and operator access                     | Provider evidence applicable to the contracted service.                 |
| Backups                | Encryption, keys, permissions, and recovery                | Documented controlled restoration.                                      |

**Acceptance:** every layer has evidence, an owner, and known limitations. Web HTTPS alone does not establish that everything is encrypted.

### Step 15. Decide on and implement selective encryption

**Owners:** Core architecture, security, and database.

1. Define threats: database copy, administrative access, lost backup, and compromised application.
2. Assess identity-document, phone, and address encryption according to impact and query requirements.
3. Choose authenticated encryption, for example AES-256-GCM, with unique nonces per key.
4. Design envelope key management using KMS/HSM or an equivalent service.
5. Separate keys, data, and permissions; record key version and authenticated tenant/data context.
6. If exact search is needed, evaluate an HMAC blind index with a separate key; document equality leakage.
7. Design batch migration, reads of old/new formats, and failure recovery.
8. Test rotation, restoration, and retirement of readable copies under approved retention.

**Acceptance criteria:**

- [ ] Copying an encrypted row between tenants does not allow valid interpretation.
- [ ] Changing ciphertext or its tag causes rejection.
- [ ] A SQL role without key permissions cannot read the protected field's plaintext.
- [ ] Rotation preserves data and has execution evidence.
- [ ] Search, uniqueness, notification, and export continue to work with authorization.
- [ ] A legitimate restoration can recover keys and data under the procedure.

Do not store the master key beside the backup or in public frontend variables. Do not reversibly encrypt passwords; keep password management in Supabase Auth. AES-256-GCM is a design proposal, not a universal LOPDP requirement for every column.

### Step 16. Strengthen access — L12

- [ ] Verify effective Supabase Auth configuration; do not extrapolate from local configuration.
- [ ] Implement MFA for administration, operations, and support according to risk.
- [ ] Define when reauthentication or stronger assurance is required for sensitive operations.
- [ ] Review staff onboarding/offboarding, temporary privileges, and active sessions.
- [ ] Check the actual web connection role and remove unnecessary privileges.
- [ ] Preserve worker segregation and minimum access to data projections.
- [ ] Verify that public buckets contain only product/branding material, never customer documents.

**Acceptance:** allowed/denied access tests and a signed permission review, including human access to providers.

## 8. Risk, DPO, and impact assessment — L13

**Owners:** management and a privacy specialist, with security and product.

- [ ] Evaluate risks to people, beyond the business's financial losses.
- [ ] Analyze address exposure, impersonation, wrong contacts, and cross-store access.
- [ ] Measure actual data subjects, volume, frequency, persistence, and geographical scope.
- [ ] Determine large-scale processing under applicable rules.
- [ ] Evaluate and document whether a data protection impact assessment (EIPD) is required; perform it before processing when mandatory.
- [ ] Determine whether a data protection officer (DPD/DPO) must be appointed under the activity and rules; document the decision.
- [ ] If required, verify DPO independence, resources, appointment, contact, and applicable registration.
- [ ] Approve measures, residual risks, and monitoring owners.
- [ ] Train staff handling requests, administering stores, and operating infrastructure.

**Acceptance:** a reasoned decision supported by evidence. Do not declare an exemption solely because of company size, or a requirement solely because an online store exists.

## 9. Implementation within the project's architecture

Before writing code, read the relevant guides for the installed Next.js version and the repository rules.

| Layer               | Proposed work                                                                       |
| ------------------- | ----------------------------------------------------------------------------------- |
| Core/domain         | Rules and states for requests, purpose, retention, and blocking.                    |
| Core/application    | Use cases and ports for rights, export, deletion, and cryptographic protection.     |
| Core/infrastructure | Repositories, KMS/encryption, Auth/Storage/provider adapters, and workers.          |
| Web                 | Localized information, channel/portal, and actions that parse input and resolve DI. |
| PostgreSQL          | New migrations, RLS, permissions, and minimal execution evidence.                   |
| Operations/legal    | Contracts, policies, approved periods, training, and exercises.                     |

Development task requirements:

- [ ] Authoritative rules in Core; no SQL or encryption keys in components.
- [ ] Trusted actor/tenant obtained server-side.
- [ ] Transactions for related changes and idempotent jobs.
- [ ] Explicit types, no `any`, and absolute imports.
- [ ] Server-only DI and translations in both languages.
- [ ] Rights, isolation, error, and recovery tests using synthetic fixtures.

## 10. Schedule and acceptance evidence

These windows are execution targets after plan approval, not extensions of legal obligations.

| Window     | Steps                                      | Expected outcome                                                       |
| ---------- | ------------------------------------------ | ---------------------------------------------------------------------- |
| 0–7 days   | 1–3 and review of 11                       | Owners identified, RPCs restricted/verified, and chat decision.        |
| 0–15 days  | 4–5, 7–8, and 13                           | Correct contact, minimal logs, notices/channel, and incident protocol. |
| 15–30 days | 6, 9, 12, 14, and 16                       | RAT, retention, providers, and encryption/access evidence.             |
| 30–60 days | 10, complete rights support, and section 8 | Supervised deletion and EIPD/DPD decisions.                            |
| 60–90 days | 15 and independent verification            | Selective encryption if approved, recovery tests, and closure.         |

Final acceptance checklist:

- [ ] L01: no privileged path can act on another user/tenant.
- [ ] L02: clear information is available before data collection.
- [ ] L03: rights requests are resolved end to end.
- [ ] L04: expiration, blocking, purging, and restoration are tested.
- [ ] L05: chat processing is known, controlled, and disclosed.
- [ ] L06: providers and data flows are documented.
- [ ] L07: an exercise includes notifications and receipts.
- [ ] L08: authorized contact changes apply to notifications.
- [ ] L09: every field has a justified need.
- [ ] L10: logs are limited and supervised.
- [ ] L11: encryption is evidenced by layer and keys are recoverable/controlled.
- [ ] L12: human and technical access has been reviewed.
- [ ] L13: RAT, risks, and reasoned EIPD/DPD decisions are approved.
- [ ] Functional, architecture, lint, and integration checks pass in a suitable environment.
- [ ] An independent reviewer verifies evidence and records outstanding items/residual risks.

Not all tests passed in the original audit, and production RLS was not verified. Consult VALIDATION.md; do not reuse that result as approval of a future change.

## 11. Tracking templates

### Task record

```text
Finding ID:
Step in this guide:
Owner and reviewer:
Priority and target date:
Current evidence:
Outstanding conditions or documentation:
Legal/functional decision:
Approved technical change:
Acceptance test:
Execution evidence:
Residual risk:
Status and closure date:
```

### Provider record

```text
Provider / service / contracting entity:
Processing activities and data categories:
Role for each processing activity:
Countries, regions, and support access:
Subprocessors:
Contract and instructions:
Legal basis / transfer mechanism where applicable:
Encryption, controls, and access:
Retention and deletion:
Rights and incident assistance:
Service exit and data return:
Internal owner and review date:
Evidence and outstanding items:
```

### Rights-request record

```text
Case identifier:
Receipt and channel:
Requested right:
Proportionate identity verification:
Case owner:
Applicable deadline and alerts:
Affected systems/stores/providers:
Third-party data to protect:
Decision and basis:
Actions taken / retention exceptions:
Response to the data subject and evidence:
Closure date:
```

### Sources and maintenance

The basis and links for each obligation are in section 2 of the main report. For maintenance, check the [SPDP official legal framework](https://www.spdp.gob.ec/marco-normativo/), its [resolutions](https://www.spdp.gob.ec/resoluciones/), and the [Official Register](https://www.registroficial.gob.ec/).

This guide reflects the dated review identified above; it does not represent a subsequent legal update. Review it when code, providers, marketing, AI, minors, purposes, or scale change.

**Location:** `T:/Camilo/Canal-Digital-Ventas/LOPDP-REMEDIATION-GUIDE.md`. This copy is at the project root. Appendices remain in `docs/audits/lopdp-ecuador-2026-10-25/`, excluded by the existing `.gitignore` rule.
