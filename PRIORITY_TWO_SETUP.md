# Priority 2 implementation

Scope: A13–A32 in `SYSTEM_AUDIT_CHECKLIST.md`. A15, A16, A20, and the saved-address display were already implemented; their behavior remains covered. Independent Priority 3 and production acceptance items remain separate.

Apply `supabase/migrations/20261019000200_priority_two.sql` and `20261019000300_private_list_access.sql`, deploy `notify-resident` and `banoy-chat`, and publish the frontend. The private-list sign-in guard works independently of differences in live table grants; queries also retain RLS. The existing Priority 1 notification worker and schedule continue to process closure and request updates.

| Items | Result |
| --- | --- |
| A13 | Adding a closure checks existing reservations and requires an affected-booking review. Staff can open affected requests and arrange a reschedule or cancellation; residents receive the existing durable closure email, and staff receive a notice. Bookings are not automatically moved. |
| A14, A29 | New requests store an allowed ID type, bounded ID number, review acknowledgment, fixed acknowledgment version `id-review-v1`, and server time. The database validates the fields and preserves them after submission. Legacy requests retain their original data; no acknowledgment is inferred for them. |
| A15, A16, A20 | Message identity/time remain server-derived. Original concerns remain immutable with handling history. Each staff module loads its own dataset. |
| A17–A19 | Concern and schedule forms lock while saving. Concerns use a UUID submission key and a server RPC that returns the existing row on an identical retry. Schedule creation also supports identical retries. A successful save updates local state independently of background reload failures. |
| A21–A22 | Shift changes write one selected record with its expected revision. Existing text shift IDs remain supported. Announcement, profile/masterlist, service, office, and basic slot updates use database-incremented revisions and conditional updates. Stale saves are rejected while the draft remains available for review. Reopen or reload the current record before editing again. |
| A23 | Request, concern, resident, and announcement working lists have server-side filters, counts, stable ordering, and page controls. Exports/reference backups and public reads retrieve all server pages. The list RPC runs as the caller and retains table RLS. |
| A24 | Residents served counts distinct resident account IDs with completed requests, including archived completed requests. Pending and rejected work does not count. Dashboard totals and charts are calculated by PostgreSQL. |
| A25–A26 | Identity/role/permission changes reset private page state. An unverified or revoked staff session hides cached private screens. Subscriptions reread on reconnect, online/focus/visibility changes, and every 30 seconds while visible. Failed main-list reads show a retry action; slower refreshes cannot overwrite a newer result. |
| A27–A28 | Certificate history tracks actual Storage availability. Incomplete uploads show **Resume PDF upload** with the saved attempt ID; reselect the original PDF. Saved PDFs expose **Retry saved certificate email**. Retries use the saved provider key and exact frozen payload, even after staff/profile/template changes. Known accepted sends are not resent. Old unknown outcomes without a frozen payload, and attempts beyond the safe 23-hour retry period, require provider-log review. |
| A30–A31 | Authorized staff can reject an approved request with a reason, subject to the existing fulfillment/issuance safeguards. Request details show the saved application address. |
| A32 | Banoy reads every page of active approved knowledge. Admin knowledge and unanswered-question retrieval also read all pages, with page controls for review. The former 1,000-answer and 100-question caps are removed. |

The acknowledgment version corresponds to the booking checkbox authorizing barangay staff to review the attached ID for the appointment. It records that specific review acknowledgment and does not backfill historical consent.

Verification covers SQL authorization, stale updates, idempotent submissions, 1,030-row pagination, stable completed-resident counts, file availability, closure notification, approved rejection, the actual certificate Edge handler with an isolated provider, Banoy retrieval beyond 1,000 answers, and mobile browser workflows. Production checks read routes and configuration; no test resident submissions, actual certificate emails, or payment transactions are created.

Use `scripts/verify-priority-two.sql`, `node scripts/verify-admin-api.mjs`, and `node scripts/verify-published-site.mjs` for read-only release verification. Database and file retention/backup policy, office information approval, and real end-to-end acceptance remain listed in the audit's production section.

## Verified release — 19 October 2026

Published at <https://barangay-certification-system-eta.vercel.app>. Both migrations and the two updated Edge Functions are deployed. **81 automated tests and 130 isolated browser checks passed**, with TypeScript, all six Deno checks, and a production build. Live checks confirmed seven versioned tables, structured identity and immutable acknowledgment guards, legacy shift-ID compatibility, caller RLS, explicit anonymous denial for private lists, accurate certificate availability, the existing confirmed superadmin, required IDs and private chat, and working public/staff pages at 320px. Production verification was read-only and sent no emails or resident submissions.
