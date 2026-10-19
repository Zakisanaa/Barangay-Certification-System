# Admin and product features

Scope: F01–F14 from `SYSTEM_AUDIT_CHECKLIST.md`. The separate Priority 2 A13–A32 list is outside this release. Existing Priority 1 booking safeguards remain in force.

## Finding records and adding items

Search controls have a labeled sort menu. Requests, residents, concerns,
announcements, fees, certificates, walk-ins, and audit history are searched and
sorted before database pagination. Saved Banoy answers and the staff directory
sort their complete loaded list. Changing a search or sort resets pagination.
Tables retain a visible title; phone layouts show a label for each field.

In **Services & booking**, use **What would you like to manage?** to jump to
service creation, fees, supporting uploads, templates, appointment slots, open
weekdays, or closures. Suggested values fill an editable text field, so staff
can select a common value or enter their own. **Staff accounts** offers role
suggestions and plain-language descriptions of each permission.

## Service fees and receipt records

Set **Fee amount (PHP)** for each service: a positive amount for a payable
service, `0` for a free service, or blank for an unconfirmed amount. Payment
instructions describe when and how to pay. Booking and Banoy display the same
amount. Creating a service saves its amount in the same database transaction.

Enable fee recording under **Office information**, then save that section.
In **Fee records**, look up an appointment or walk-in reference to confirm the
resident, service, and configured fee. Paid entries require a positive amount
and an official receipt; exemptions and waivers use zero. Full refunds and
voids link to their original payment, retain history, and cannot be recorded
twice. These entries record office actions; recording a refund does not move
money. The displayed net amount covers all matching records and reflects the
current search and type filter.

Before publishing this frontend, apply all repository migrations in order,
including `20261019000500_search_and_sort.sql`,
`20261019000600_resident_payments.sql`, and
`20261019000700_fee_entry_safeguards.sql`. The last migration also protects the
older fee RPC against duplicate and zero-value paid records. New checks run in
`tests/search-and-fees-database.test.mjs`, `tests/service-fee.test.mjs`, and the
browser suite's usability checks.

Published on 19 October 2026 in deployment `6uQR3GdMmFM4ca6F1zcEyY28456L` at
<https://barangay-certification-system-eta.vercel.app>. All three migrations and
the Banoy fee update are deployed. Validation passed: 95 automated tests, 187
isolated browser checks, both TypeScript checks, all six Deno checks, production
build, live schema checks, private API denial, and public/staff mobile rendering.

## Resident fees and scrolling follow-up — 19 October 2026

Published in deployment `wQupoqAzi45e3B9gSYzrrSaJwTCR` at
<https://barangay-certification-system-eta.vercel.app>, with migration
`20261019000800_resident_fee_history.sql` applied.

Residents can open **Fees & receipts** in the menu or **View fees & receipts**
on their Dashboard. Office entries linked to their own appointments appear
there, including archived requests, receipt references, exemptions, waivers,
refunds, and voids. Search, sorting, pagination, refresh, and retry are available.
Corrections preserve the original entry. The net recorded amount is payments
minus refunds and voids for the current search; it is not a balance due.
Unowned walk-in records are not matched to accounts by name. Residents cannot
change the ledger or view another resident's records.

The signed-in portal uses one page scroller. Request dialogs and mobile menus
lock background scrolling, long request conversations flow through their page
or dialog, and navigation opens the next page at the top. Banoy retains its
conversation scroller with the composer visible. Public pages retain ordinary
browser scrolling.

Validation passed: **98 automated tests and 211 isolated browser checks**,
both TypeScript checks, all six Deno checks, and production build. Live checks
confirmed the migration, ownership/RLS protections, anonymous denial, enabled
fee tracking, realtime publication, published frontend modules, notification
worker readiness, and public/staff rendering at 320px without uncaught errors
or failed public API responses. Staff-to-resident fee workflows were exercised
with isolated fixtures; live verification created no resident or payment data
and sent no emails. The completion review's remaining office configuration,
exemption reversal, and request fee snapshot items remain open.

Read-only verification:

```powershell
.\node_modules\.bin\supabase.cmd db query --linked --file scripts/verify-resident-fees.sql
node scripts/verify-admin-api.mjs
node scripts/verify-published-site.mjs
```

The later [approved service setup](./APPROVED_SERVICE_SETUP.md) records the
office-supplied fees, mandatory booking ID for every service, Agrarian proof
upload, and Good Moral's “no additional requirements” clarification. It includes
the deployed migration, Banoy training, and current verification results.

The [connected workflow release](./CONNECTED_WORKFLOWS_SETUP.md) adds approved
transaction selection in Fee records and Certificate register, direct request
and walk-in actions, exact inbox links, and supported audit/report links. The
current verification baseline is 110 automated tests and 247 browser checks.

## Staff access

The office selected **barangaylagasit813@gmail.com** for superadmin. This account was registered and email-confirmed by the user before setup. Sign in through `/staff` after deployment. If a previously opened session still shows the resident portal, sign out and sign in through `/staff`.

Superadmins manage **Staff accounts**: invite personnel, add an existing confirmed account, assign feature permissions, deactivate/reactivate staff, and appoint another superadmin. A superadmin cannot remove their own administrator access; another superadmin must make that change. Invitations provide email/password setup. There is no public staff registration or resident-controlled role assignment.

Existing staff retain ordinary feature access during migration. Review these assignments and narrow them to the office's responsibilities. Deactivated accounts lose database/function access immediately; an already-open screen refreshes access on focus, authentication changes, or its periodic refresh. Provider login restrictions are also updated; any provider failure is explicitly reported.

| Permission | Office responsibility |
|---|---|
| requests | Request decisions, document review, conversations, arrivals, assignment, walk-ins |
| certificates | Completed PDF delivery and issuance register |
| residents | Resident masterlist and identity/residency review |
| concerns | Concern replies, internal notes, resolution/reopening, related email retries |
| schedules | Posted walk-in personnel shifts |
| content | Announcements, officials, about text, mission, vision |
| settings | Services, document requirements, templates, appointment schedules, office settings |
| knowledge | Banoy knowledge and question review |
| reports | Operational CSV exports |
| payments | Manual fee/receipt ledger |
| audit | Read-only before/after audit history |

Superadmin includes all permissions. Permissions are enforced by PostgreSQL policies, guarded functions/triggers, private Storage rules, and Edge functions.

## Resident and document review

**Every new appointment now requires a private ID photo for every ID type.** Residents select the ID type, enter its number, attach a readable JPG/PNG/WebP up to 5 MB, and confirm staff review. Changing ID type clears the attachment and confirmation. The booking RPC and direct database inserts reject missing, nonexistent, expired, or wrongly owned/requested images. Request reviewers see **Attached ID** in request details. Existing appointments without an image remain processable.

Migration `20261019000000_require_booking_id.sql` applies this rule to new requests. Existing private Storage and legacy `school_id_image_path` naming are retained for compatibility. New upload attempts use separate object paths, so failed submissions can retry without overwriting submitted identification. Banoy's booking/ID instructions also explain the requirement.

Residents submit private identity/residency evidence in **My profile**. Authorized staff select **Review verification** in the masterlist, record the method (in person or uploaded evidence), decision, explanation, reviewer, and date. Email confirmation and barangay verification are separate records.

In **Services & booking**, select a service and create its supporting-document checklist. Requirements can be required/optional and active/inactive. New bookings enforce required uploads in one database transaction. Requirements are snapshotted on submitted attachments; later configuration changes do not silently rewrite old submissions.

Staff use **Supporting documents** in request details to accept files or request a correction with instructions. Residents upload requested replacements from their Dashboard. Old files and review history remain available. All required current files must be accepted before approval/completion. Closed requests cannot acquire new correction decisions. PDF/JPG/PNG/WebP uploads are limited to 5 MB; evidence and request files use private buckets and expiring signed links.

## Daily operations and certificates

**Office queue** provides day/seven-day appointment views, overdue work, arrival records, staff assignment, and real walk-in transactions with their own `WALK-...` references. Posted walk-in shifts remain separate from visitor transactions.

**Certificate register** records actual issuance, an internal `REG-...` number, optional official number, signatory, date, issuer, replacements, and revocations. Enter an approved/completed appointment reference or in-progress/completed walk-in reference. Record issuance when the office actually issues the certificate. PDF email delivery and hardcopy collection retain their existing separate histories. Register entries do not replace those fulfillment steps. Replacements preserve previous entries; revocations require a reason. An issued register entry must be revoked before its source transaction can be cancelled without fulfillment.

New services start with hardcopy availability. Upload a checked DOCX under **Certificate template versions**, then enable softcopy when the service is ready. Reusing a label creates a new version while preserving earlier files. The browser checks DOCX container/document parts; review the actual form, wording, and signatory before publishing. Email delivery accepts the currently published template for that service.

Configure **Operating weekdays** and create slots with start/end times. Slot time changes use a new slot so existing records keep their original schedules. Review affected bookings before disabling a reserved slot or reducing capacity below reservations. Changes do not automatically reschedule residents. Open affected requests, arrange a new schedule or cancellation, and record the reason. Closures notify affected residents and create staff notices.

## Concern handling, inbox, reports, and content

**Concerns & feedback** retains the original submission, resident/staff conversation, private staff notes, resolution explanations, reopening reasons, and an actor/timestamp history. Internal notes are excluded from resident access. Residents follow up through their own concern conversation.

Both **Request conversation** and **Concern conversation** support private JPG/PNG/WebP images, PDF, DOCX, and TXT files. Each message accepts up to three files, 5 MB per file, with or without text. Images have inline previews; other documents have an open link. Remove selected files before sending or use **Refresh file link** when a five-minute private link expires. Attachments on internal notes are visible only to authorized concern staff, including after an uploader loses staff access. Banoy remains a text conversation.

Migration `20261019000100_conversation_attachments.sql` creates the private `conversation-attachments` bucket, immutable metadata with RLS, and atomic message RPCs. The server checks file ownership, message association, actual Storage MIME/size, and limits. Browser checks validate image decoding, PDF headers, and DOCX structure. Failed sends keep their draft and remove unused attempted uploads; retries recover committed messages without duplicate messages or email jobs. Referenced files cannot be removed by conversation users.

**Notification inbox** shows accessible requests, resident messages, unresolved concerns, closure impacts, and failed email jobs. Unread state belongs to each staff account. Use **Review email delivery** to inspect and retry eligible failures. Jobs with unsafe late/unknown delivery outcomes require provider-log review. Provider acceptance does not prove that a resident read the email.

**Operational reports** exports date-filtered CSV for requests (including pending/completed/no-show states), certificate issuance, concerns, walk-ins, fees, and staff workload. Exports retrieve every result page. Processing hours appear only when a real completion event exists. Dates use Asia/Manila. Spreadsheet formula-like cells are escaped.

**Audit history** records actor, time, entity, and before/after values across resident profiles, verification, requests, concerns, walk-ins, fees, issuance, settings, schedules, requirements, templates, public content, knowledge, and staff access. Application users cannot modify it.

**Public site content** edits officials/photos, about text, mission, and vision using version checks. Publish actual office-approved information. **My profile** is available to staff and residents. Email changes require password verification and Supabase confirmation; the profile email follows the accepted Auth email.

## Optional fee ledger

Fee tracking starts **disabled**. After the office confirms its collection and official-receipt process, a settings administrator can enable it and save **Office information**. Payment staff can record amount, receipt, reason, collector/time, exemption, waiver, refund, and void records. Refunds/voids link to the original payment and preserve it. The ledger does not transfer money or implement online payments.

## Deployment and verification

Apply migrations `20261018000200` through `20261018000800`, `20261019000000`, and `20261019000100`, deploy `manage-staff`, `notify-resident`, and `banoy-chat`, and build/publish the existing Vercel project. The Priority 1 maintenance worker processes the new durable email jobs without a separate schedule.

Run `node scripts/configure-admin-product.mjs --email=barangaylagasit813@gmail.com` for a read-only account check. Add `--apply` to promote this explicitly authorized, confirmed account. The script obtains the linked project's server key only in process memory; it never prints it or writes it into frontend files.

Validation includes PostgreSQL authorization/workflow tests, isolated browser workflows at phone/tablet/desktop sizes, TypeScript, Deno checks, and a production build. Browser tests use mock services; they do not send real invitations, submit real resident data, or transfer money. Live verification reads public routes and backend configuration. Actual office business information, signatures, and fee procedures require office review.

## Verified release — 19 October 2026

Published at <https://barangay-certification-system-eta.vercel.app>. Seven admin migrations, 16 new tables with RLS, five private document buckets, 17 current template associations, and the active confirmed superadmin account were verified in the linked database. Three changed Edge functions were deployed. Anonymous callers were rejected by staff management, certificate delivery, and the maintenance worker; the authenticated worker dry run remained ready with email configured. Public and staff pages rendered at 320px with no uncaught JavaScript errors or failed public Supabase calls.

Validation: **53 automated tests, 79 isolated browser checks, TypeScript, six Deno function checks, and production build passed**. No real invitations or test emails were sent; no test resident records or payment transfers were created in production. Fee tracking remains disabled. The live staff password login and actual email inbox delivery were not exercised.

Follow-up release on 19 October: mandatory appointment ID photos and private request/concern attachments are deployed with migrations `20261019000000` and `20261019000100`. Validation now includes **68 automated tests and 107 isolated browser checks**, plus TypeScript and the production build. Read-only checks confirmed both deployed migrations, the booking guard, private chat bucket/RLS, authenticated message functions, and anonymous RPC rejection. Attachment tests include failed uploads/sends, recovery after a lost committed response, internal-note privacy after staff access revocation, immutable saved files, ownership isolation, type/size/count limits, and mobile layouts. Production validation does not submit real messages or files.
