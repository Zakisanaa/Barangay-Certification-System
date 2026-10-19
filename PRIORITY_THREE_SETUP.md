# Priority 3 implementation — A33–A59

This release implements the 27 minor behavior, accessibility, performance, and
maintenance findings in [SYSTEM_AUDIT_CHECKLIST.md](./SYSTEM_AUDIT_CHECKLIST.md).
Existing appointment, ID, attachment, staff permission, and fulfillment rules
remain in force.

## Published usability update — 19 October 2026

The Priority 3 checks were rerun with the search, sorting, Superadmin form, and
fee improvements. **95 automated tests and 187 isolated browser checks passed**,
along with both TypeScript checks, all six Deno checks, and the production build.
The larger desktop text exposed a dashboard overflow at 200% zoom; summary
cards now size themselves to their available width, and the zoom check passes.

Deployment `6uQR3GdMmFM4ca6F1zcEyY28456L` is published at
<https://barangay-certification-system-eta.vercel.app>. Migrations
`20261019000500` through `20261019000700` and the updated `banoy-chat` are
deployed. The twelve Priority 3 live schema checks and twelve new search/fee
schema checks all passed. Live checks also verified private API denial,
notification-worker readiness, the new frontend modules, and public/staff pages
at 320px without uncaught browser errors or failed public Supabase responses.

The eager JavaScript totals 494,242 bytes (142,088 gzip); portal pages and charts
continue to load on demand. Production checks created no resident submissions,
payment records, invitations, or emails. Actual office rates remain for the
office to confirm in Services & booking. See
[ADMIN_PRODUCT_SETUP.md](./ADMIN_PRODUCT_SETUP.md) for the fee and form guide.

## Rollout

Apply `20261019000400_priority_three.sql`, deploy `banoy-chat`, then publish:

```powershell
.\node_modules\.bin\supabase.cmd db push
.\node_modules\.bin\supabase.cmd functions deploy banoy-chat --use-api
vercel.cmd --prod --yes
```

The migration adds server-stamped announcement modification times, private
Banoy answer snapshots, history/active-slot indexes, and retirement triggers for
deleted knowledge sources. Older announcements retain a null modification time
until a real editorial change; publication time remains their fallback. Earlier
Banoy questions without saved replies display an explicit unavailable message.
No earlier reply is fabricated from later staff knowledge.

## Implemented behavior

| Audit items | Result |
|---|---|
| A33–A35 | Review shows the exact custom document. Client limits match the server: name 200, address 500, ID number 120, document name 200, purpose 2,000. Validation precedes uploads. Disabled services have visible feedback and a route back to selection. |
| A36–A38 | Booking/auth controls have associated visible labels and correct autofill metadata. Request details use the shared dialog, focus trap, Escape, focus restoration, and background scroll lock. Closing is blocked during certificate sending. |
| A39 | Navigation and browser refresh/closure protect booking, profile/masterlist, announcement, settings, and Banoy drafts. Editors ask before replacing or clearing drafts. Saving another settings section preserves pending office/service edits. Forced account/session changes still clear private state. |
| A40–A42 | Staff can renew private ID links. Main lists distinguish loading, failure with Retry, and empty results. Residents can open complete announcements and browse earlier posts. |
| A43–A46 | Public activity uses real server modification/publication times and honest unavailable/empty labels. Static health claims become feature descriptions. Office timestamps use Asia/Manila. Active service quick links preselect the document. |
| A47–A49 | Banoy stores original replies, sources, feedback, and times in account-owned history, read 25 at a time. Account changes clear private page state. RLS retains ownership and permitted staff review. Deleted source announcements/services deactivate derived knowledge and clear learned vectors. Non-JSON notification failures retain the underlying service error. |
| A50 | Every booking ID is checked for nonzero size, allowed MIME/signature, and actual image decoding. Residents see a preview; the upload path also validates the image. |
| A51–A53 | Portal pages and charts load on demand, checked through the eager module graph. Existing logo/Banoy artwork is resized to WebP; below-fold portraits load lazily. Active date/slot counts have a partial index measured against an isolated 18,000-row fixture. |
| A54–A58 | Prototype JSX typing is fixed. Commands cover the active app, every source file, and all six functions. Browser tests use dynamic ports, unique profiles, connection/command deadlines, process-exit handling, and a three-minute suite deadline. Unused demos live under `src/app/legacy`; setup documents point to current migrations and workflows. |
| A59 | Active labels/timestamps and chart ticks use at least 12px text, with darker small gray labels. Tests exercise mobile, keyboard, and 200% zoom. This targeted review is not a formal accessibility certification. |

The logo is 59,296 bytes and Banoy is 20,160 bytes, down from a combined
1,644,458 bytes. Originals remain for compatibility. Recreate the optimized
files with `node scripts/optimize-public-images.mjs` and inspect before release.

## Verification and operations

Run `npm run check` and `npm run test:ui`. Tests use isolated fixtures and send
no production submissions or emails. The index test writes both query plans
and matching counts to `test-results/priority-three-index.json`. Local timings
are not production latency guarantees. Build verification enforces a 500 KB
public initial JavaScript budget before compression and checks lazy routes.

Read-only release checks:

```powershell
.\node_modules\.bin\supabase.cmd db query --linked --file scripts/verify-priority-three.sql
node scripts/verify-admin-api.mjs
node scripts/verify-published-site.mjs
```

The published-site verifier follows split modules and checks that public and
staff sign-in pages avoid downloading charts or protected workflow pages.
Approved office facts, real integration acceptance, retention, backup
restoration, and monitoring remain separate O01–O08 production checks.

## Earlier verified release — 19 October 2026

Published at <https://barangay-certification-system-eta.vercel.app>, deployment
`5X4qVNNVqsY7iywrzqE28Pq4c3UD`. Migration `20261019000400` and `banoy-chat`
are deployed. **89 automated tests and 175 isolated browser checks passed**,
with both TypeScript checks, all six Deno function checks, and production build.
The final build's eager JavaScript totals 494,017 bytes (141,970 bytes gzip).
The deployment package includes `scripts/verify-build.mjs`; other maintenance
and test scripts remain excluded.

Live read-only checks verified all twelve Priority 3 schema/guard/index checks,
anonymous denial for Banoy and existing private APIs, the configured notification
worker, public/staff pages at 320px, and the absence of chart/workflow downloads
on sign-in/public pages. No uncaught browser errors or failed public Supabase
responses were observed. No real emails or resident submissions were created.

The isolated 18,000-row slot-count fixture returned the same count of 11 with
both plans: indexed execution 0.190 ms versus sequential execution 2.201 ms in
the recorded local run. These timings describe that fixture and environment.
