**System completion review — 19 October 2026, Asia/Manila**

Reviewed application: <https://barangay-certification-system-eta.vercel.app>.
The appointment, request review, private conversations, resident records,
certificate delivery, staff permissions, and manual fee ledger are implemented.
The system still needs office configuration, several workflow fixes, and
production acceptance before full office sign-off. Completing Priorities 1–3
does not resolve these newly identified gaps or the separate operational checks.

This review inspected source code and deployed configuration. Production checks
were read-only; workflow probes used an isolated in-memory database. No resident
records, payments, office settings, or provider settings were changed during
this review. No emails or invitations were sent.

Follow-up release: resident **Fees & receipts** and shared portal scrolling
fixes are now published in deployment `wQupoqAzi45e3B9gSYzrrSaJwTCR`, with
migration `20261019000800` applied. Residents can read their own appointment's
office fee history, including archived requests and linked corrections. This
does not resolve R01, R02, R03, or R06 below. See
[the release notes](./ADMIN_PRODUCT_SETUP.md) for scope and verification.

The live configuration at the audit snapshot showed:

Later configuration update: the [approved service release](./APPROVED_SERVICE_SETUP.md)
sets numeric fees and ID instructions for all 21 current services and adds the
required Agrarian ownership/tenancy upload. R01's fee setup portion is resolved;
office hours, processing times, and any further office-approved requirements
still need review. R02, R03, and R06 remain open.

| Area | Verified result |
|---|---|
| Fee recording | Enabled |
| Services | 20 active services; all 20 have an empty numeric `fee_amount` |
| Fee notes | Barangay Clearance has the text `200`; Certificate of Residency has `test`. These notes are separate from the numeric amount and are not evidence of office approval. |
| Service instructions | 18 services have no requirements; 19 have no processing time |
| Required upload checklists | No active required service-specific upload checklist; the separate booking ID requirement still applies |
| Office hours | The configured public value is `ttest` |
| Public content | No saved `site_content` records; the website uses its bundled defaults and marks mission/vision as drafts for confirmation |
| Staff security | Four active staff accounts, one active superadmin, zero active staff with a verified MFA factor |
| Transfer instructions | Zero payment methods configured or active |
| Certificate formats | Five services have no active template and are configured for hardcopy only |
| Deployment | All repository migrations through `20261019000700` are applied; public tables have row-level security enabled |

The following items should form the next completion checklist. “Confirmed” means
observed in source/live configuration; “reproduced” means exercised in the
isolated database. Policy choices need the office's decision before enforcement.

| ID | Priority and evidence | Remaining work and practical effect |
|---|---|---|
| R01 | High — confirmed live | **Finish approved office and service settings.** Replace test office hours and fee notes; enter numeric fees or explicit zero for free services; publish requirements, processing times, and any required upload checklists. Fee lookup cannot prefill an amount while its numeric field is empty. Require a setup review before activating an incomplete service, or show a clear “confirm with office” state. |
| R02 | High — reproduced | **Allow an incorrect exemption or waiver to be corrected.** Only `PAID` entries can currently be refunded/voided. An `EXEMPT` entry cannot be voided, and the duplicate-payment guard then blocks a replacement paid record. Add an authorized, reasoned reversal that preserves the original audit history, and cover both exemptions and waivers. |
| R03 | High — reproduced | **Preserve the agreed fee on a request.** An existing request showed PHP 75, then PHP 125 after the catalog changed. Store a quoted/confirmed amount and any authorized adjustment history, or explicitly obtain agreement to a revised amount. The current lookup reads the latest service catalog rather than a request fee snapshot. |
| R04 | High — confirmed missing workflow | **Publish privacy information and implement a retention/data-request process.** The ID checkbox permits staff review of that appointment's image, but no complete privacy notice, retention schedule, or resident data-request/account-deletion process is connected. Define how long IDs, evidence, PDFs, conversations, and concerns are retained, who can access them, and how requests are handled while preserving required records. Existing unused-ID cleanup is not a retention system for submitted records. |
| R05 | High — confirmed live and in code | **Add staff MFA and administrator recovery arrangements.** No active staff member has enrolled MFA, and the app has no enrollment/challenge flow or staff assurance-level enforcement. There is also only one active superadmin. Provide MFA setup and recovery, then enforce the chosen policy for privileged actions; designate and test a second authorized administrator. |
| R06 | Medium — reproduced; office policy required | **Connect payment, issuance, and completion.** A positive-fee appointment could be issued a certificate and completed with zero fee records. A completed hardcopy request could also have zero register entries. Define which services require payment/exemption and an issuance record before release, enforce those rules on the server, and show staff the remaining steps in one request workspace. Free services and authorized waivers need an explicit supported path. |
| R07 | Medium — confirmed live | **Approve and publish public content.** Confirm mission, vision, officials, office information, and wording through Public site content. The bundled defaults are not saved office-approved content. Decide whether to retain the current `noindex, nofollow` setting for a demo or allow public search indexing after approval. |
| R08 | Medium — source finding | **Extend unsaved-edit protection to newer forms.** Fees, the certificate register, walk-in entry, staff access, and public content editors do not register with the existing dirty-form guard. Navigation or editor replacement can discard unfinished work even though booking and several older editors are protected. Add consistent prompts or recoverable drafts, including destructive reload/replace actions. |
| R09 | High acceptance check — not established by this audit | **Verify backups and restoration for database and files.** No completed restore drill or file-backup coverage was established. Document recovery for database rows and all private/public Storage buckets, retention, recovery owner, and expected recovery time. A resident's reference download is not a system backup. |
| R10 | Medium — repository gaps; external setup unverified | **Finish monitoring, CI, and release operations.** There is no checked-in CI workflow, and page failures mainly go to the browser console. Add automated checks, actionable worker/delivery failure alerts, deployment verification, and rollback instructions. Staff inbox delivery warnings already exist; they do not establish an external alert when the worker itself stops. The scheduler has recent successful runs; five older failures in the preceding day warrant log review, not a claim of a current outage. |
| R11 | Medium — source finding; load acceptance pending | **Add volume limits and run concurrency/abuse tests.** File size and per-message attachment limits exist, and Banoy/payment proofs have explicit rate limits. Concerns, request/concern messages, and evidence uploads still need suitable account-volume/storage controls. Exercise simultaneous booking and capacity changes against real PostgreSQL, along with upload and repeated-submission scenarios. |
| R12 | High acceptance check — not completed by this audit | **Record an end-to-end office acceptance run.** Use authorized test resident/staff accounts to verify confirmation/reset emails, approval/rejection/rescheduling, required uploads, payment/exemption/correction, certificate registration, Word-to-PDF delivery, actual email delivery/webhook status, download, collection, and recovery from failures. Assign support ownership and complete staff training/sign-off. The isolated browser suite cannot establish the behavior of these real providers and office procedures. |

The isolated probes make the fee/workflow findings reproducible:

| Probe | Current result |
|---|---|
| Void an incorrect exemption | Rejected: “Select the original payment record for this transaction.” |
| Record payment after that exemption | Rejected: “A payment or exemption is already recorded.” |
| Change a service fee after the request exists | Existing request's returned amount changed from 75 to 125 |
| Issue a positive-fee request without payment/exemption | Allowed |
| Collect and complete its hardcopy without a fee record | Completed with zero fee records |
| Complete hardcopy without a register entry | Completed with zero register entries |

Reproduce these probes with `node scripts/audit-completion-probes.mjs`.
The output is saved to `test-results/completion-workflow-probes.json`; it uses
only isolated fixtures. The payment/issuance probes demonstrate missing policy
enforcement and integration, rather than establish that every service must be
paid or require the same release process.

Some extensions are optional until the office chooses them:

| Extension | Current state and work needed |
|---|---|
| GCash/Maya/bank-transfer proof workflow | The database already contains payment methods, submissions, private proof storage, and review RPCs. There are no corresponding resident upload, staff proof-review, or account-instruction setup screens in the app, and no configured methods. Finish these screens and tests if transfers are in scope. Automatic provider settlement would be additional integration work. Manual office receipt recording already works. |
| Automatic certificate preparation | Staff currently download DOCX, edit it in Word, export PDF, then upload/email. Prefilling and staff-reviewed generation would reduce manual work; the existing manual process remains usable. |
| More softcopy services | Certificate of No Business, Certificate of No Property, Community Tax Certificate (Cedula), Good Moral Certificate, and Other barangay document have no active template and are hardcopy-only. Add approved templates if those services should support digital delivery. |
| Appointment reminders and SMS | Status email updates exist. Scheduled appointment reminders and SMS are separate additions. |
| Public QR certificate verification | Add a deliberately limited lookup with current/revoked/replaced status if the office needs authenticity checking. |
| Printed/downloadable confirmations | Provide an approved appointment confirmation and payment acknowledgment format; current fee entries store receipt references. Calendar `.ics` export is also optional. |
| Filipino resident interface | Alternate Filipino Banoy questions are supported. Full screen translation and evaluation with local wording remain separate work. |

Evidence is in
[the service editor](./src/app/components/ServiceSettingsPage.tsx),
[fee records](./src/app/components/FeeRecordsPage.tsx),
[fee/payment RPCs](./supabase/migrations/20261019000600_resident_payments.sql),
[fee safeguards](./supabase/migrations/20261019000700_fee_entry_safeguards.sql),
[issuance rules](./supabase/migrations/20261018000300_admin_workflows.sql),
[completion rules](./supabase/migrations/20261018000000_priority_one.sql),
[resident authentication](./src/app/residentAuth.ts),
[account security](./src/app/components/AccountSecurity.tsx),
[default public content](./src/app/publicSite.ts),
[certificate preparation](./src/app/components/CertificateDelivery.tsx),
and [maintenance](./supabase/functions/process-notifications/index.ts).
The read-only live queries are
[configuration](./scripts/audit-completion-readonly.sql) and
[security/readiness](./scripts/audit-security-readonly.sql).

Fresh live verification passed for public/staff sign-in pages at 320px, deployed
frontend modules, anonymous denial at the checked private APIs, and the
notification worker's dry-run readiness. There were no uncaught browser errors
or failed public Supabase responses during that check. All public application
tables had RLS enabled. The latest release baseline is 103 automated tests and
231 isolated browser checks; those counts are not proof that the new findings
above are covered. MFA enrollment counts were checked directly, but provider
password/SMTP/session settings, external monitoring, backup coverage, and actual
restore outcomes were not independently established.

Recommended order:

1. Obtain approved office values and complete service/public setup (R01, R07).
2. Fix exemption reversals and request fee history; agree and connect release
   requirements (R02, R03, R06). Include transfer screens only if selected.
3. Finish privacy/retention, staff MFA/recovery, and newer-form draft protection
   (R04, R05, R08).
4. Complete backup restoration, operational alerts/CI, volume/concurrency checks,
   and the real office acceptance run (R09–R12), then obtain sign-off.
