# System completion and issue checklist

Reviewed: 18 October 2026 (Asia/Manila).

Follow-up completion review (19 October 2026): the remaining office configuration,
new fee/workflow findings, security/privacy work, and operational acceptance are
recorded as **R01–R12** in
[SYSTEM_COMPLETION_REVIEW.md](./SYSTEM_COMPLETION_REVIEW.md). These are separate
from the completed original A01–A59 and F01–F14 checklist. This follow-up used
read-only production checks and isolated workflow probes.

Usability update (19 October 2026): search and sort controls, clearer table titles
and field labels, larger desktop text, Superadmin feature navigation, editable
suggestions, staff-role presets, and service-fee/receipt safeguards are published
at <https://barangay-certification-system-eta.vercel.app> in deployment
`6uQR3GdMmFM4ca6F1zcEyY28456L`. Priority 3 was reverified, including a fix for
dashboard overflow at 200% zoom. **95 automated tests and 187 isolated browser
checks passed**, with both TypeScript checks, all six Deno checks, and the
production build. Migrations `20261019000500`–`20261019000700` and Banoy's shared
fee wording are deployed. All twelve Priority 3 and twelve new search/fee live
schema checks passed, along with private API denial, worker readiness, and live
public/staff mobile checks. No real submissions or emails were sent. The fee
guide is in [ADMIN_PRODUCT_SETUP.md](./ADMIN_PRODUCT_SETUP.md).

Priority 3 release (19 October 2026): **A33–A59 are completed and published** at <https://barangay-certification-system-eta.vercel.app>. Migration `20261019000400` and the updated `banoy-chat` function are deployed. Validation passed: **89 automated tests, 175 isolated browser checks, active-app and all-source TypeScript, all six Deno function checks, and production build**. Live read-only checks passed for the timestamp/snapshot guards, private history RLS, source retirement, valid indexes, existing private APIs and worker, split page modules, and public/staff pages at 320px. Initial JavaScript is 494,017 bytes (about 142 KB gzip); portal pages/charts load on demand. The logo and Banoy assets total 79,456 bytes. See [PRIORITY_THREE_SETUP.md](./PRIORITY_THREE_SETUP.md). O01–O08 production acceptance and U01–U05 optional upgrades remain separate; no real test submissions or emails were sent.

Priority 2 release (19 October 2026): **A13–A32 are completed and published** at <https://barangay-certification-system-eta.vercel.app>. Migrations `20261019000200` and `20261019000300` are deployed, along with updated certificate delivery and Banoy functions. Validation passed: **81 automated tests, 130 isolated browser checks, TypeScript, six Deno function checks, and production build**. Read-only live checks passed for the migration/identity/revision guards, private-list access, certificate file availability, existing admin/chat/ID features, and public/staff mobile pages. No real test submissions or emails were sent. See [PRIORITY_TWO_SETUP.md](./PRIORITY_TWO_SETUP.md) for the item-by-item results and operations. At that release, Priority 3 and production acceptance remained separate follow-up work.

Additional release (19 October 2026): every new appointment requires a private ID photo for every ID type. Request and concern conversations now accept private images, PDF, DOCX, and TXT files (three per message, 5 MB each), including file-only replies. Internal-note files remain staff-only. Migrations `20261019000000` and `20261019000100` are deployed. Validation passed: **68 automated tests, 107 isolated browser checks, TypeScript, and production build**. Read-only production checks confirmed the required-ID guard, private chat bucket/RLS, message functions, and anonymous-access rejection. This earlier release adds the requested features; the later Priority 2 release above completes the independent work.

Production update (19 October 2026): Priority 1 and the F01–F14 admin/product features are published at <https://barangay-certification-system-eta.vercel.app>. All seven admin migrations and three updated Edge functions are deployed. The confirmed account **barangaylagasit813@gmail.com** has verified active superadmin access. Read-only live checks passed for public/staff pages, mobile layout, Supabase calls, anonymous-access rejection, and the email worker.

Admin/product verification: **53 automated tests and 79 isolated browser checks passed**, along with TypeScript, all six Deno function checks, and the production build. Fee tracking is implemented and starts disabled pending office configuration. A15, A16, and A20 were also resolved as dependencies of permission separation and concern handling; other independent Priority 2 items remained open at that release. No real invitations, test emails, payment transfers, or test resident submissions were made. See [ADMIN_PRODUCT_SETUP.md](./ADMIN_PRODUCT_SETUP.md) for operation and validation details. Initial audit descriptions below are retained as historical findings; checked entries are implemented.

Update: Priority 1 items A01–A12 are implemented. Supabase migrations, functions, Vault configuration, and the maintenance schedule are deployed and verified. The frontend passed 38 automated tests and 51 browser checks, type checking, and a production build. See [PRIORITY_ONE_SETUP.md](./PRIORITY_ONE_SETUP.md) for implementation and operations notes. The descriptions and initial verification results below preserve the original audit findings; checked items are addressed by this update. Lower-priority items remain open. Real email delivery to a recipient was not tested.

This combines the initial review and a deeper read-only code/database review, including minor issues. It contains **86 tracked items**: 59 code/workflow findings, 14 admin/product feature gaps, 8 production checks, and 5 optional upgrades. These counts are an inventory, not a claim that all entries are separate bugs or equally urgent.

The evidence applies to the checked-out source and supplied migrations. Live hosting, database policies added outside these migrations, provider settings, backups, and real email delivery were not verified. Items marked Reproduced were checked in an isolated local database or by directly calling the pure retrieval helper. Markup findings are not a completed browser accessibility audit. Application code was not changed for this review.

## Initial audit verification results and limits

- Normal frontend typecheck: passed.
- Production build: passed, with a large JavaScript chunk warning.
- Existing automated suite: 18 of 18 passed during the initial review. Passing coverage does not include all newly identified edge cases.
- All-source TypeScript check using an ignored temporary config: failed with one diagnostic, TS2503 at src/app/legacy/PrototypeDocs.tsx:483. The active application build is unaffected by this unused file.
- Deno typecheck for notify-resident, resend-webhook, banoy-chat, and configure-delivery-tracking: passed.
- Isolated probes reproduced missing School ID objects, ineffective upload cleanup, completion without a PDF delivery record, resident-created resolved/archived concerns, invalid profile data, disabled-service case bypass, forged message display metadata, editable original concern fields, and stale knowledge after a server-side source deletion.
- A pure retrieval probe reproduced the three-conflicting-exact-matches bug in Banoy.
- The earlier browser smoke run stalled and was stopped. Mobile interaction, keyboard behavior, and actual production integrations remain unverified.
- No real resident records were changed and no real emails were sent.

## Priority 1 — resolve before real resident use

- [x] **A01 — Cancellation has no end-to-end workflow.** *Workflow gap.* Add a Cancelled state, authorization rules, a reason, capacity release, history, and resident confirmation. Current request statuses do not include cancellation.
  Evidence: [supabase/migrations/20261005000000_initial_schema.sql](supabase/migrations/20261005000000_initial_schema.sql), [src/app/portalData.ts](src/app/portalData.ts).

- [x] **A02 — Staff cannot reschedule an appointment.** *Reproduced in isolated database.* The validation trigger rejects changes to appointment_date and time_slot. Add a controlled rescheduling operation that checks capacity and records the old and new schedule.
  Evidence: [supabase/migrations/20261015000000_booking_and_request_history.sql](supabase/migrations/20261015000000_booking_and_request_history.sql), [src/app/serviceFaq.ts](src/app/serviceFaq.ts).

- [x] **A03 — Missed and expired requests remain active.** *Code finding / workflow gap.* There are no No-show or Expired states. An old Pending or Approved request can keep blocking another request for the same document. Archiving active requests also preserves their reservation.
  Evidence: [supabase/migrations/20261015000000_booking_and_request_history.sql](supabase/migrations/20261015000000_booking_and_request_history.sql).

- [x] **A04 — Completion does not require fulfillment evidence.** *Reproduced in isolated database.* A Softcopy request can be approved and completed without any certificate delivery record. Define completion requirements separately for Softcopy, Hardcopy, and Both, including hardcopy collection where applicable.
  Evidence: [supabase/migrations/20261015000000_booking_and_request_history.sql](supabase/migrations/20261015000000_booking_and_request_history.sql), [src/app/components/AdminPage.tsx](src/app/components/AdminPage.tsx).

- [x] **A05 — A School ID request can reference a nonexistent file.** *Reproduced in isolated database.* The trigger validates the storage-path format and owner but does not verify the object exists. Validate the actual private upload before accepting the request.
  Evidence: [supabase/migrations/20261015000000_booking_and_request_history.sql](supabase/migrations/20261015000000_booking_and_request_history.sql).

- [x] **A06 — Unsubmitted School ID cleanup does not work under the supplied policies.** *Reproduced in isolated database.* Resident deletion with a path filter removed zero rows because residents have no matching SELECT visibility. Provide narrowly scoped cleanup that cannot remove submitted evidence, plus orphan cleanup.
  Evidence: [supabase/migrations/20261005000300_school_id_image_upload.sql](supabase/migrations/20261005000300_school_id_image_upload.sql), [src/app/portalData.ts](src/app/portalData.ts).

- [x] **A07 — A disabled service can be requested through a case variation.** *Reproduced in isolated database.* After disabling Barangay Clearance, a Hardcopy request named 'barangay clearance' was accepted through the Other document fallback. Use service IDs and normalize custom names before resolving services.
  Evidence: [supabase/migrations/20261015000000_booking_and_request_history.sql](supabase/migrations/20261015000000_booking_and_request_history.sql), [src/app/components/BookPage.tsx](src/app/components/BookPage.tsx).

- [x] **A08 — Residents can create their own concerns already resolved and archived.** *Reproduced in isolated database.* The INSERT policy only checks ownership. Enforce Received, not archived, and a server-generated submission time when creating a concern.
  Evidence: [supabase/migrations/20261005000000_initial_schema.sql](supabase/migrations/20261005000000_initial_schema.sql), [supabase/migrations/20261005000400_archive_requests_and_concerns.sql](supabase/migrations/20261005000400_archive_requests_and_concerns.sql).

- [x] **A09 — Profile validation can be bypassed.** *Reproduced in isolated database.* Empty first and last names and malformed contact details were accepted directly by the database. Enforce trimmed, bounded fields on the server and validate contact formats.
  Evidence: [supabase/migrations/20261005000000_initial_schema.sql](supabase/migrations/20261005000000_initial_schema.sql), [src/app/residentAuth.ts](src/app/residentAuth.ts).

- [x] **A10 — Saved updates can lose their email notification.** *Code finding.* Status changes and messages are saved before a separate browser-driven email call. Closing the page or encountering an error can leave no durable notification job. Add an outbox, retries, and delivery records for ordinary notifications.
  Evidence: [src/app/components/AdminPage.tsx](src/app/components/AdminPage.tsx), [src/app/components/AdminServicesPage.tsx](src/app/components/AdminServicesPage.tsx), [src/app/components/TransactionChat.tsx](src/app/components/TransactionChat.tsx).

- [x] **A11 — Logout can look successful before sign-out finishes.** *Code finding.* The interface clears its account immediately while sign-out runs in the background. If sign-out fails, a session can remain; the error is not shown on the public landing page. Await sign-out and show a recoverable failure.
  Evidence: [src/app/App.tsx](src/app/App.tsx).

- [x] **A12 — Banoy can select a conflicting exact answer.** *Reproduced with retrieval function.* With three exact matching entries whose answers are A, A, and B, confidentWordingMatch returns A because it compares only the first two. Check every equally ranked exact match and require clarification when approved answers conflict.
  Evidence: [supabase/functions/banoy-chat/retrieval.ts](supabase/functions/banoy-chat/retrieval.ts), [tests/banoy-retrieval.test.mjs](tests/banoy-retrieval.test.mjs).

## Priority 2 — reliability, data integrity, and staff operations

- [x] **A13 — New closures do not resolve existing bookings.** *Workflow gap.* Adding a closure blocks new bookings but does not identify, notify, or move appointments already on that date. Add an affected-bookings review and rescheduling workflow.
  Evidence: [src/app/components/ServiceSettingsPage.tsx](src/app/components/ServiceSettingsPage.tsx), [supabase/migrations/20261015000000_booking_and_request_history.sql](supabase/migrations/20261015000000_booking_and_request_history.sql).

- [x] **A14 — ID type and number are stored as an unchecked combined string.** *Code finding.* The database accepts arbitrary nonempty voter_id text. School-ID enforcement depends on an exact 'School ID:' prefix. Store and validate an allowed ID type separately from the number.
  Evidence: [supabase/migrations/20261015000000_booking_and_request_history.sql](supabase/migrations/20261015000000_booking_and_request_history.sql), [src/app/portalData.ts](src/app/portalData.ts).

- [x] **A15 — Message display names and timestamps can be forged.** *Reproduced in isolated database.* A resident could insert their own message with another display name and a year-2099 timestamp. Author ID and role are checked; derive display metadata and submission time on the server too.
  Evidence: [supabase/migrations/20261005000000_initial_schema.sql](supabase/migrations/20261005000000_initial_schema.sql), [src/app/portalData.ts](src/app/portalData.ts).

- [x] **A16 — Staff can rewrite original concern content and ownership without history.** *Reproduced in isolated database.* The staff UPDATE grant and policy allowed changing the original message, owner, and submitted timestamp. Restrict ordinary updates to approved fields and audit any authorized correction.
  Evidence: [supabase/migrations/20261005000000_initial_schema.sql](supabase/migrations/20261005000000_initial_schema.sql), [src/app/portalData.ts](src/app/portalData.ts).

- [x] **A17 — Concern and schedule creation have no in-flight guard.** *Code finding.* Their submit handlers and buttons do not lock while saving. Repeated clicks can create duplicate concerns or shifts. Add a saving state and server-side idempotency where needed.
  Evidence: [src/app/components/ConcernsPage.tsx](src/app/components/ConcernsPage.tsx), [src/app/components/AdminServicesPage.tsx](src/app/components/AdminServicesPage.tsx).

- [x] **A18 — Concern references can collide.** *Code finding.* References use Math.random() with only six digits per year, and duplicate-key failures have no generation retry. Use a server-generated unique reference or a sufficiently large random identifier.
  Evidence: [src/app/components/ConcernsPage.tsx](src/app/components/ConcernsPage.tsx).

- [x] **A19 — A successful save followed by a failed reload is reported as a failed operation.** *Code finding.* Some handlers wrap INSERT/UPDATE and the subsequent reload in one catch. Concern creation can leave the submitted text in the form after an already-successful save, encouraging duplicates. Track save success independently.
  Evidence: [src/app/components/ConcernsPage.tsx](src/app/components/ConcernsPage.tsx), [src/app/components/AdminServicesPage.tsx](src/app/components/AdminServicesPage.tsx), [src/app/components/AdminPage.tsx](src/app/components/AdminPage.tsx).

- [x] **A20 — Unrelated admin lists are loaded as one dependency.** *Code finding.* Each concerns, residents, or schedule page fetches all three datasets with Promise.all. A failure in one prevents the selected page from loading, and unrelated changes reload everything. Fetch only the selected page's data.
  Evidence: [src/app/components/AdminServicesPage.tsx](src/app/components/AdminServicesPage.tsx).

- [x] **A21 — Toggling one shift writes the whole shift collection.** *Code finding.* toggleShift upserts every loaded shift, including stale values for other entries. Concurrent staff changes can be overwritten. Update only the selected shift and add version checks.
  Evidence: [src/app/components/AdminServicesPage.tsx](src/app/components/AdminServicesPage.tsx), [src/app/portalData.ts](src/app/portalData.ts).

- [x] **A22 — Several staff editors can overwrite concurrent changes.** *Code finding.* Announcements, resident details, and service/office settings lack the version checks used by Banoy knowledge. Add conflict detection and reload/review feedback for simultaneous edits.
  Evidence: [src/app/components/LandingNewsManager.tsx](src/app/components/LandingNewsManager.tsx), [src/app/serviceData.ts](src/app/serviceData.ts), [src/app/portalData.ts](src/app/portalData.ts).

- [x] **A23 — Main lists, searches, and totals depend on a single unpaginated response.** *Code finding.* Requests, concerns, residents, and posts are filtered or counted on the client. Configured API row limits can hide older records and produce incomplete totals. Use server-side pagination, search, and counts.
  Evidence: [src/app/portalData.ts](src/app/portalData.ts), [src/app/components/DashboardPage.tsx](src/app/components/DashboardPage.tsx), [src/app/components/AdminPage.tsx](src/app/components/AdminPage.tsx).

- [x] **A24 — Residents served is not a count of completed service recipients.** *Code finding.* The dashboard counts distinct lowercase names across unarchived requests, including Pending and Rejected requests. Same-name residents merge, name changes split counts, and archiving changes totals. Define the metric and count account IDs.
  Evidence: [src/app/components/AdminPage.tsx](src/app/components/AdminPage.tsx).

- [x] **A25 — Account/session changes are not fully reflected in the interface.** *Code finding.* The main auth listener handles password recovery and sign-out but does not refresh the displayed profile on other account-change events. Reconcile the account and cached private data when the session identity changes.
  Evidence: [src/app/App.tsx](src/app/App.tsx).

- [x] **A26 — Realtime failures can leave screens stale.** *Code finding.* Subscriptions generally log errors or omit status handling. Most lists have no fallback refresh after reconnection or focus. Add reconnect/refocus refresh and visible retry states where data cannot be trusted.
  Evidence: [src/app/portalData.ts](src/app/portalData.ts), [src/app/serviceData.ts](src/app/serviceData.ts), [src/app/components/AdminPage.tsx](src/app/components/AdminPage.tsx).

- [x] **A27 — Certificate retry identity is lost on navigation or refresh.** *Code finding.* The delivery ID lives in a component ref. After an uncertain send, reopening the page and selecting the same PDF creates a new attempt instead of resuming the existing one. Allow recovery/retry of the saved delivery record.
  Evidence: [src/app/components/CertificateDelivery.tsx](src/app/components/CertificateDelivery.tsx), [supabase/functions/notify-resident/index.ts](supabase/functions/notify-resident/index.ts).

- [x] **A28 — Failed PDF uploads still get a download button.** *Code finding.* Delivery history is created before storage upload. If upload fails, RequestHistory still renders Download completed PDF for that record. Track file availability and hide or disable broken downloads.
  Evidence: [supabase/functions/notify-resident/index.ts](supabase/functions/notify-resident/index.ts), [src/app/components/RequestHistory.tsx](src/app/components/RequestHistory.tsx).

- [x] **A29 — School ID review consent has no stored record.** *Code finding.* The checkbox is only component state. The request schema does not preserve consent text/version or timestamp. Record the acknowledgment if the office relies on it as part of its process.
  Evidence: [src/app/components/BookPage.tsx](src/app/components/BookPage.tsx), [src/app/portalData.ts](src/app/portalData.ts).

- [x] **A30 — Approved requests cannot be rejected through the staff interface.** *Code finding.* The database allows Approved to Rejected, but the UI offers Reject only for Pending requests. Provide the authorized reversal/cancellation action with a reason and history.
  Evidence: [src/app/components/AdminPage.tsx](src/app/components/AdminPage.tsx), [supabase/migrations/20261015000000_booking_and_request_history.sql](supabase/migrations/20261015000000_booking_and_request_history.sql).

- [x] **A31 — Request details omit the applicant's saved address.** *Code finding.* The staff details list shows identity, purpose, schedule, and format but not request.address. Show the submission-time address so staff can prepare the certificate accurately.
  Evidence: [src/app/components/AdminPage.tsx](src/app/components/AdminPage.tsx).

- [x] **A32 — Banoy knowledge and review lists have hard retrieval limits.** *Code finding.* The server loads at most 1,000 active entries; the admin list also caps at 1,000 and the review queue at 100 without pagination. Some published answers or older questions become inaccessible as data grows.
  Evidence: [supabase/functions/banoy-chat/index.ts](supabase/functions/banoy-chat/index.ts), [src/app/chatbotData.ts](src/app/chatbotData.ts).

## Priority 3 — minor behavior, accessibility, performance, and maintenance

- [x] **A33 — Other document review shows the generic category.** *Code finding.* The final booking summary displays form.requestType instead of the entered otherRequestType, although submission saves the custom name. Show the exact document name residents are about to submit.
  Evidence: [src/app/components/BookPage.tsx](src/app/components/BookPage.tsx).

- [x] **A34 — Client field limits do not consistently match database limits.** *Code finding.* ID number and purpose inputs, among others, allow more text than the server accepts. Add matching limits and validation before uploading files or reaching final submission.
  Evidence: [src/app/components/BookPage.tsx](src/app/components/BookPage.tsx), [supabase/migrations/20261015000000_booking_and_request_history.sql](supabase/migrations/20261015000000_booking_and_request_history.sql).

- [x] **A35 — Submitting after a selected service is disabled can silently do nothing.** *Code finding.* submitRequest returns without feedback when selectedService disappears following a settings update. Explain the change and send the resident back to document selection.
  Evidence: [src/app/components/BookPage.tsx](src/app/components/BookPage.tsx).

- [x] **A36 — Several booking labels are not associated with their controls.** *Accessibility finding from markup.* Labels sit beside inputs/selects without nesting or matching htmlFor/id. Associate each field with its visible label and expose validation errors to assistive technology.
  Evidence: [src/app/components/BookPage.tsx](src/app/components/BookPage.tsx).

- [x] **A37 — Auth inputs have misleading accessible names and limited autofill metadata.** *Accessibility finding from markup.* FocusInput uses placeholders such as 'Juan' or password dots as aria-label values, overriding surrounding text. Supply proper labels, unique IDs, and correct autocomplete values for login versus registration.
  Evidence: [src/app/components/AuthPage.tsx](src/app/components/AuthPage.tsx).

- [x] **A38 — The custom request-details dialog lacks keyboard focus management.** *Accessibility finding from markup.* Unlike the shared dialog component, this modal has no focus trap, Escape handler, initial focus, or focus restoration. Use the shared accessible dialog and manage background scrolling.
  Evidence: [src/app/components/AdminPage.tsx](src/app/components/AdminPage.tsx).

- [x] **A39 — Unsaved form changes are lost without an acknowledgment.** *Usability gap.* Changing pages or switching selected services/announcements can discard edits. Add dirty-state protection for booking, resident edits, announcements, settings, and Banoy drafts where appropriate.
  Evidence: [src/app/App.tsx](src/app/App.tsx), [src/app/components/ServiceSettingsPage.tsx](src/app/components/ServiceSettingsPage.tsx), [src/app/components/LandingNewsManager.tsx](src/app/components/LandingNewsManager.tsx), [src/app/components/ChatbotKnowledgePage.tsx](src/app/components/ChatbotKnowledgePage.tsx).

- [x] **A40 — Private School ID links expire while a details screen remains open.** *Code finding.* The image viewer obtains a five-minute signed URL once. Opening it later can fail with no refresh action. Reissue the URL on demand or provide an explicit retry.
  Evidence: [src/app/components/AdminPage.tsx](src/app/components/AdminPage.tsx), [src/app/portalData.ts](src/app/portalData.ts).

- [x] **A41 — Loading and error states can look like empty data.** *Code finding.* Several lists start empty and only report load failures in a toast or console; public announcements silently fall back to no posts. Distinguish Loading, Empty, and Failed, with a retry action.
  Evidence: [src/app/components/LandingPage.tsx](src/app/components/LandingPage.tsx), [src/app/components/HomePage.tsx](src/app/components/HomePage.tsx), [src/app/components/WalkInSchedulePage.tsx](src/app/components/WalkInSchedulePage.tsx), [src/app/components/AdminServicesPage.tsx](src/app/components/AdminServicesPage.tsx).

- [x] **A42 — Resident announcement text is clipped without a read-more action.** *Code finding.* Home shows at most three announcements and clamps text to two lines, without opening the full text. Add announcement details and a way to browse earlier announcements.
  Evidence: [src/app/components/HomePage.tsx](src/app/components/HomePage.tsx).

- [x] **A43 — Last updated can be misleading.** *Code finding.* The public page uses the current time when there are no announcements, and existing posts retain their original publishedAt when edited. Use a genuine modification timestamp and an honest empty-state label.
  Evidence: [src/app/components/LandingPage.tsx](src/app/components/LandingPage.tsx), [src/app/components/LandingNewsManager.tsx](src/app/components/LandingNewsManager.tsx).

- [x] **A44 — System status badges are static.** *Code finding.* Online Booking and Banoy are labeled Active/Available regardless of actual backend or model availability. Either connect them to health information or label them as feature links.
  Evidence: [src/app/components/HomePage.tsx](src/app/components/HomePage.tsx).

- [x] **A45 — Displayed timestamps use inconsistent timezones.** *Code finding.* Request history explicitly uses Asia/Manila, while several chat, concern, and public timestamps use the browser timezone without labeling it. Choose a consistent office timezone or clearly label the viewer's timezone.
  Evidence: [src/app/components/RequestHistory.tsx](src/app/components/RequestHistory.tsx), [src/app/components/TransactionChat.tsx](src/app/components/TransactionChat.tsx), [src/app/components/LandingPage.tsx](src/app/components/LandingPage.tsx), [src/app/components/AdminServicesPage.tsx](src/app/components/AdminServicesPage.tsx).

- [x] **A46 — Service quick links do not preselect the service.** *Usability gap.* Every quick link opens the same blank booking screen. Carry the chosen service into booking, and hide or explain links to disabled services.
  Evidence: [src/app/components/HomePage.tsx](src/app/components/HomePage.tsx), [src/app/components/BookPage.tsx](src/app/components/BookPage.tsx).

- [x] **A47 — The resident Banoy conversation disappears on navigation.** *Code finding / usability gap.* Chat messages live only in component state. Leaving the page clears the conversation; stored question-review records do not recreate the answered transcript. Provide history if conversation continuity is expected.
  Evidence: [src/app/components/ChatPage.tsx](src/app/components/ChatPage.tsx), [supabase/migrations/20261015000100_announcement_photos_and_banoy.sql](supabase/migrations/20261015000100_announcement_photos_and_banoy.sql).

- [x] **A48 — Deleting a source can leave active Banoy knowledge behind.** *Reproduced in isolated database; server/SQL deletion path.* Deleting a public post through an administrator database operation left its generated knowledge active. The sync trigger upserts existing sources but never deactivates missing ones. The current UI archives posts; fix deletion synchronization before adding deletion tools.
  Evidence: [supabase/migrations/20261015000100_announcement_photos_and_banoy.sql](supabase/migrations/20261015000100_announcement_photos_and_banoy.sql).

- [x] **A49 — Non-JSON notification errors can hide the useful error.** *Code finding.* sendResidentNotification calls response.json() without a parsing fallback. HTML or plain-text gateway failures can produce a JSON syntax error instead of an actionable notification error.
  Evidence: [src/app/portalData.ts](src/app/portalData.ts).

- [x] **A50 — School ID file checks rely on declared MIME type.** *Code finding.* School ID upload validates file.type and maximum size but does not decode the image, inspect its signature, or reject zero-byte files. Apply real image validation and provide preview/replacement feedback.
  Evidence: [src/app/portalData.ts](src/app/portalData.ts), [src/app/components/BookPage.tsx](src/app/components/BookPage.tsx).

- [x] **A51 — The production frontend is one large JavaScript bundle.** *Observed build warning.* The current build emits a roughly 1.07 MB JavaScript chunk, about 297 KB gzip. Split staff, charts, booking, and chatbot routes so residents load only what they need.
  Evidence: [src/app/App.tsx](src/app/App.tsx), [vite.config.ts](vite.config.ts).

- [x] **A52 — Some visual assets are unnecessarily expensive to load.** *Observed local asset sizes / markup.* The chatbot image is about 1.14 MB and the logo about 501 KB. Official portraits below the fold are eagerly loaded. Resize/compress assets and lazy-load noncritical images.
  Evidence: [public/banoy-chatbot.png](public/banoy-chatbot.png), [public/officials/brgylagasit.png](public/officials/brgylagasit.png), [src/app/components/LandingPage.tsx](src/app/components/LandingPage.tsx).

- [x] **A53 — Booking capacity checks lack an index matching their main filter.** *Schema finding; performance impact needs load measurement.* Availability repeatedly counts requests by appointment date, slot, and active status. Supplied indexes do not cover that combination. Add an appropriate index and measure query plans with realistic data.
  Evidence: [supabase/migrations/20261005000000_initial_schema.sql](supabase/migrations/20261005000000_initial_schema.sql), [supabase/migrations/20261015000000_booking_and_request_history.sql](supabase/migrations/20261015000000_booking_and_request_history.sql).

- [x] **A54 — Checking every source file exposes a TypeScript error.** *Reproduced with expanded TypeScript configuration.* PrototypeDocs.tsx:483 references the JSX namespace and fails with TS2503 under the installed types. This file is unused by the running app, so the normal build/typecheck still passes. Fix or remove the legacy component.
  Evidence: [src/app/legacy/PrototypeDocs.tsx](src/app/legacy/PrototypeDocs.tsx), [tsconfig.json](tsconfig.json).

- [x] **A55 — The normal validation command does not cover all project code.** *Tooling finding.* tsconfig starts from main.tsx and serviceFaq.ts, so unused source files and Edge Functions are outside its scope. Add explicit full-source and Edge Function checks; keep the normal active-app check too.
  Evidence: [tsconfig.json](tsconfig.json), [package.json](package.json).

- [x] **A56 — The browser smoke runner can stall or conflict with another run.** *Code finding; earlier run did not complete.* Browser connection/CDP requests lack deadlines. Fixed ports and a persistent profile also make parallel or leftover runs fragile. Add timeouts, process-exit handling, unique profiles, and dynamic ports.
  Evidence: [tests/ui-smoke.mjs](tests/ui-smoke.mjs).

- [x] **A57 — Old demo implementations remain beside the active application.** *Maintenance finding.* Unused login, booking, chatbot, and admin components retain alternative behavior and hardcoded demo information. Remove or clearly isolate them so future work does not accidentally reconnect stale logic.
  Evidence: [src/app/legacy/LoginForm.tsx](src/app/legacy/LoginForm.tsx), [src/app/legacy/RegisterForm.tsx](src/app/legacy/RegisterForm.tsx), [src/app/legacy/AppointmentBooking.tsx](src/app/legacy/AppointmentBooking.tsx), [src/app/legacy/ChatbotInterface.tsx](src/app/legacy/ChatbotInterface.tsx), [src/app/legacy/AdminPanel.tsx](src/app/legacy/AdminPanel.tsx).

- [x] **A58 — Setup documentation is inconsistent.** *Documentation finding.* SUPABASE_SETUP calls the booking/history migration the latest even though a later Banoy/photo migration exists. README only describes installing and running the frontend and does not direct readers to backend setup.
  Evidence: [SUPABASE_SETUP.md](SUPABASE_SETUP.md), [README.md](README.md).

- [x] **A59 — Small, pale labels need a readability review.** *Markup-based usability observation; visual testing pending.* Some visible labels use 9–10 px text and pale gray colors. Review them at phone widths and with zoom, especially form labels, request details, chart labels, and timestamps. No formal contrast audit was completed.
  Evidence: [src/app/components/AuthPage.tsx](src/app/components/AuthPage.tsx), [src/app/components/BookPage.tsx](src/app/components/BookPage.tsx), [src/app/components/AdminPage.tsx](src/app/components/AdminPage.tsx).

## Admin and product features — completed F01–F14

- [x] **F01 — Administrator and staff account lifecycle.** *Missing admin feature.* Provide invitation, activation, deactivation, access revocation, and a staff list. The existing administrator-looking portal is backed by the shared staff database role.
  Evidence: [src/app/residentAuth.ts](src/app/residentAuth.ts), [SUPABASE_SETUP.md](SUPABASE_SETUP.md).

- [x] **F02 — Permission separation.** *Missing admin feature.* Define who can approve requests, issue documents, edit residents, manage content, and change access. Enforce these permissions on the server, not just in navigation.
  Evidence: [supabase/migrations/20261005000000_initial_schema.sql](supabase/migrations/20261005000000_initial_schema.sql), [src/app/components/Sidebar.tsx](src/app/components/Sidebar.tsx).

- [x] **F03 — Recorded resident verification.** *Missing workflow.* Distinguish confirmed email from reviewed identity/residency. Record reviewer, decision, date, supporting evidence, and correction requests according to the barangay's chosen process.
  Evidence: [src/app/residentAuth.ts](src/app/residentAuth.ts), [src/app/components/AdminServicesPage.tsx](src/app/components/AdminServicesPage.tsx).

- [x] **F04 — Service-specific supporting documents.** *Missing feature.* Allow required attachments and correction/replacement workflows for each document service; booking currently has a specific School ID upload rather than a general requirements checklist.
  Evidence: [src/app/components/BookPage.tsx](src/app/components/BookPage.tsx), [src/app/components/ServiceSettingsPage.tsx](src/app/components/ServiceSettingsPage.tsx).

- [x] **F05 — Daily appointments, check-in, walk-ins, and assignment.** *Missing admin feature.* Add a day/week calendar or queue, arrival/check-in, assigned staff, walk-in transaction entry, and overdue work. Posted walk-in staff shifts do not record actual walk-in transactions.
  Evidence: [src/app/components/AdminPage.tsx](src/app/components/AdminPage.tsx), [src/app/components/WalkInSchedulePage.tsx](src/app/components/WalkInSchedulePage.tsx).

- [x] **F06 — Certificate issuance register.** *Missing admin feature.* Record certificate/serial number, issuance date, signatory, fulfillment, replacements, and authorized revocations. Preserve the existing delivery archive and request timeline.
  Evidence: [src/app/components/CertificateDelivery.tsx](src/app/components/CertificateDelivery.tsx), [supabase/migrations/20261015000000_booking_and_request_history.sql](supabase/migrations/20261015000000_booking_and_request_history.sql).

- [x] **F07 — Create services, manage templates, and edit operating schedules.** *Missing admin feature.* Provide service creation and template upload/versioning; allow structured weekday and slot-time configuration. Current controls edit predefined service fields and fixed slot capacities/activation.
  Evidence: [src/app/components/ServiceSettingsPage.tsx](src/app/components/ServiceSettingsPage.tsx), [src/app/serviceData.ts](src/app/serviceData.ts), [src/app/certificateTemplates.ts](src/app/certificateTemplates.ts).

- [x] **F08 — Concern conversation, resolution notes, and history.** *Missing admin feature.* Let staff reply to concerns, request details, explain resolutions, and record reopening reasons. Keep original submissions and an actor/timestamp history.
  Evidence: [src/app/components/ConcernsPage.tsx](src/app/components/ConcernsPage.tsx), [src/app/components/AdminServicesPage.tsx](src/app/components/AdminServicesPage.tsx).

- [x] **F09 — Staff notification inbox and unread tracking.** *Missing admin feature.* Show new requests, unread resident messages, unresolved concerns, and failed notifications with clear actions. Resident replies currently require staff to reopen individual request conversations.
  Evidence: [src/app/components/TransactionChat.tsx](src/app/components/TransactionChat.tsx), [src/app/components/Sidebar.tsx](src/app/components/Sidebar.tsx).

- [x] **F10 — Downloadable operational reports.** *Missing admin feature.* Add date-filtered exports for completed documents, pending work, processing time, staff workload, and no-shows once those states exist. Reference backups are a separate resident convenience.
  Evidence: [src/app/components/AdminPage.tsx](src/app/components/AdminPage.tsx), [src/app/components/DashboardPage.tsx](src/app/components/DashboardPage.tsx).

- [x] **F11 — Audit logging beyond appointment history.** *Missing admin feature.* Track actor, time, before/after changes, and authorized reasons across resident records, concerns, settings, content, templates, and staff access.
  Evidence: [supabase/migrations/20261015000000_booking_and_request_history.sql](supabase/migrations/20261015000000_booking_and_request_history.sql), [src/app/components/AdminServicesPage.tsx](src/app/components/AdminServicesPage.tsx).

- [x] **F12 — Review capacity changes against existing reservations.** *Missing admin safeguard.* Warn when a slot is disabled or its capacity is lowered below existing reservations. Show affected appointments and resolve them explicitly.
  Evidence: [src/app/components/ServiceSettingsPage.tsx](src/app/components/ServiceSettingsPage.tsx).

- [x] **F13 — Editable public content and safe account changes.** *Missing feature.* Provide controlled updates for officials, mission/vision, and other fixed public content. Add an authenticated email-change flow and staff profile editing if required; resident and staff email is currently read-only in the UI.
  Evidence: [src/app/components/LandingPage.tsx](src/app/components/LandingPage.tsx), [src/app/components/ResidentProfilePage.tsx](src/app/components/ResidentProfilePage.tsx), [src/app/residentAuth.ts](src/app/residentAuth.ts).

- [x] **F14 — Payment and fee records, if the office collects fees.** *Conditional feature.* Record amount, payment/exemption status, receipt reference, collector, and time where required by the actual office workflow. Residents can search their own appointment's fee history, including archived requests and linked refunds/voids, through **Fees & receipts**. Online payment is a separate scope choice. Remaining fee workflow gaps are listed in [SYSTEM_COMPLETION_REVIEW.md](SYSTEM_COMPLETION_REVIEW.md).
  Evidence: [src/app/components/FeeRecordsPage.tsx](src/app/components/FeeRecordsPage.tsx), [src/app/components/ResidentFeeRecordsPage.tsx](src/app/components/ResidentFeeRecordsPage.tsx), [supabase/migrations/20261019000800_resident_fee_history.sql](supabase/migrations/20261019000800_resident_fee_history.sql).

## Production readiness — verify outside this repository

- [ ] **O01 — Approve real service information.** *Not verified.* Confirm actual requirements, fees, processing times, office hours, staff assignments, and public wording. Several schema defaults are intentionally blank, and mission/vision are marked as drafts.
  Evidence: [SUPABASE_SETUP.md](SUPABASE_SETUP.md), [src/app/components/LandingPage.tsx](src/app/components/LandingPage.tsx).

- [ ] **O02 — Verify deployed authentication and privileged-account protection.** *Not verified.* Check production email confirmation, SMTP, reset redirects, session policy, staff access removal, and stronger staff authentication. Server password policy and provider abuse controls cannot be established from frontend code alone.
  Evidence: [SUPABASE_SETUP.md](SUPABASE_SETUP.md), [supabase/config.toml](supabase/config.toml).

- [ ] **O03 — Publish privacy information and define data retention.** *Not verified / missing app workflow.* Explain access and use of personal records, and define retention/deletion for IDs, certificates, conversations, and concerns. Account deletion or data requests need a deliberate process compatible with record relationships.
  Evidence: [SUPABASE_SETUP.md](SUPABASE_SETUP.md), [supabase/migrations/20261005000000_initial_schema.sql](supabase/migrations/20261005000000_initial_schema.sql).

- [ ] **O04 — Verify database and storage backup restoration.** *Not verified.* Confirm actual backup coverage for both database rows and private/public files, then test restoration. Do not treat the resident JSON/text reference download as a system recovery backup.
  Evidence: [src/app/components/DashboardPage.tsx](src/app/components/DashboardPage.tsx), [SUPABASE_SETUP.md](SUPABASE_SETUP.md).

- [ ] **O05 — Run a real integration acceptance test.** *Pending.* Use authorized test accounts to verify confirmation, recovery, ownership isolation, staff review, uploads, PDF download/email, webhook delivery updates, and failure recovery. Current browser smoke services are mocked.
  Evidence: [tests/ui-smoke.mjs](tests/ui-smoke.mjs), [tests/booking-database.test.mjs](tests/booking-database.test.mjs).

- [ ] **O06 — Test concurrent use and submission abuse controls.** *Pending / scope decision.* Exercise simultaneous booking against real PostgreSQL and realistic data. Define limits for concerns, request chat, custom document requests, and uploads; the supplied explicit account rate limit applies to Banoy questions.
  Evidence: [supabase/migrations/20261015000000_booking_and_request_history.sql](supabase/migrations/20261015000000_booking_and_request_history.sql), [supabase/migrations/20261015000100_announcement_photos_and_banoy.sql](supabase/migrations/20261015000100_announcement_photos_and_banoy.sql).

- [ ] **O07 — Establish monitoring and a repeatable release process.** *Not verified.* Set up actionable error/delivery alerts, automated checks, migration tracking, deployment health verification, and rollback procedures. No repository CI workflow was found in the review.
  Evidence: [package.json](package.json), [vercel.json](vercel.json), [supabase/config.toml](supabase/config.toml).

- [ ] **O08 — Finish handover and production configuration choices.** *Pending.* Provide staff/user instructions, acceptance criteria, support ownership, and recovery procedures. Confirm whether the public site should remain noindex/nofollow as currently configured.
  Evidence: [README.md](README.md), [index.html](index.html), [SUPABASE_SETUP.md](SUPABASE_SETUP.md).

## Optional upgrades — do not treat these as launch blockers unless required

- [ ] **U01 — Appointment reminders and additional channels.** *Optional.* Add scheduled email reminders and, if wanted, SMS. SMS is explicitly not configured in the current setup documentation.
  Evidence: [SUPABASE_SETUP.md](SUPABASE_SETUP.md).

- [ ] **U02 — Automatic document preparation.** *Optional.* Prefill supported DOCX/PDF templates from the verified request and keep a staff review/signing step. Current Word completion and PDF upload can remain a valid manual workflow.
  Evidence: [src/app/components/CertificateDelivery.tsx](src/app/components/CertificateDelivery.tsx).

- [ ] **U03 — QR certificate verification.** *Optional.* Add an issuance lookup with revocation/replacement status and a deliberately limited public response that avoids exposing resident details.
  Evidence: [src/app/components/CertificateDelivery.tsx](src/app/components/CertificateDelivery.tsx).

- [ ] **U04 — Filipino interface and expanded local-language evaluation.** *Optional.* Translate resident screens and evaluate Banoy with real local phrasing. Alternate Filipino questions are already supported; the underlying meaning model is documented as English.
  Evidence: [src/app/components/ChatbotKnowledgePage.tsx](src/app/components/ChatbotKnowledgePage.tsx), [SUPABASE_SETUP.md](SUPABASE_SETUP.md).

- [ ] **U05 — Calendar export and printable appointment confirmation.** *Optional.* Offer an .ics download and a clear printable appointment confirmation once approved. The current text reference download explicitly says it is not official confirmation.
  Evidence: [src/app/components/BookPage.tsx](src/app/components/BookPage.tsx).

## Suggested execution order

Resolve Priority 1, then data integrity, staff operations, and error recovery in Priority 2. Agree the admin feature scope with the barangay before building optional capabilities. Finish the appropriate minor fixes and verify production checks before sign-off. Add focused regression coverage for reproduced failures, and keep optional upgrades separate from acceptance criteria.

