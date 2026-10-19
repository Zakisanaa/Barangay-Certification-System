# Priority 1 implementation and operations

Implemented on 18 October 2026. The Priority 2 and Priority 3 audit findings remain separate work.

Deployed to Supabase project `tzrgvpawvzjrabewdvup` and the existing production site at <https://barangay-certification-system-eta.vercel.app>. The public page and `/staff` were verified against the published build, including mobile rendering, the correct backend connection, and absence of uncaught JavaScript errors or failed public API responses. No production forms were submitted.

## Backend deployment

Apply only unapplied migrations in filename order:

- `20261018000000_priority_one.sql`: controlled appointment actions, fulfillment checks, validation, protected uploads, and transactional notification outbox.
- `20261018000100_priority_one_maintenance.sql`: scheduled expiry, unused-upload cleanup, and notification processing.

```sh
supabase db push --linked
supabase functions deploy process-notifications notify-resident banoy-chat --use-api
node scripts/configure-priority-one.mjs
```

After a frontend deployment, run `node scripts/verify-published-site.mjs` for read-only checks against this production site. This uses a fresh headless Chrome profile and does not sign in or submit forms.

The setup script uses the linked project's existing CLI login. It captures the legacy service-role JWT in memory and sends it over HTTPS to a service-only configuration RPC. It never writes or displays credentials. The RPC stores the project origin and worker credential in Supabase Vault under `barangay_project_url` and `barangay_worker_service_key`. Rerun the script after rotating the legacy JWT.

The worker uses existing Edge Function secrets `RESEND_API_KEY` and `RESEND_FROM_EMAIL`. No browser or `VITE_` variable may contain a server credential. The cron job `barangay-priority-one-maintenance` runs every minute. Verify both its execution history and HTTP responses in `net._http_response`; a successful SQL invocation alone does not prove the HTTP worker succeeded. The setup script also checks a read-only worker request and verifies anonymous callers receive 403. It sends no test email and changes no appointments during verification.

## Appointment rules

- Residents can cancel their own unfulfilled Pending or Approved requests with a reason. Staff can cancel, reschedule, and record no-shows. Issued or collected certificates require staff correction rather than cancellation.
- Rescheduling checks the booking window, weekday, closures, slot time, capacity, and expected record version. History records the previous and new schedules.
- Past Pending requests expire automatically after their scheduled day in Manila. Approved requests remain available for staff attendance and fulfillment review. Staff can mark a no-show after the one-hour slot ends. Every past appointment stops blocking a new request for the same document.
- Resolve active requests before archiving. Archived requests must be restored before staff actions.
- Softcopy completion requires an actual archived certificate PDF. Hardcopy completion requires a recipient, collection time, and staff actor. Both requires both forms of evidence. Completion does not require successful email delivery because the archived PDF is also available in the resident portal.
- Existing completed records are preserved. Legacy profiles are checked when their contact details change; the migration does not rewrite old personal data.
- School ID submissions require an actual owned upload less than 24 hours old. Submitted evidence stays private to staff and cannot be removed by residents. Unsubmitted uploads can be removed by their owner; unused files older than 24 hours are cleaned through the Storage API.

## Notification behavior

Appointment creation, status changes, rescheduling, collection, concern status changes, and staff replies enqueue an email in the same transaction as the saved update. Closing a browser cannot lose the queued job. Completed PDF emails retain their existing delivery workflow and signed webhook tracking.

Ordinary notifications use bounded automatic retries, leased work claims, frozen message payloads, and stable provider idempotency keys. Staff can retry failed appointment updates from request history. Messages outside the safe retry window require provider-log review before any further sending. Outbox records report provider acceptance; they do not claim the recipient opened the message. Inspect concern notification records by their concern reference in `notification_outbox` when investigating delivery.

## Validation

- 38 automated tests passed, including isolated database permission, rollback, validation, fulfillment, expiry, and notification-lease checks.
- 51 browser checks passed with isolated mock services, including mobile layouts, cancellation, rescheduling, collection, notification retry, and delayed or failed logout.
- Frontend type check, production build, and all five Edge Function type checks passed. The existing large JavaScript bundle warning remains a lower-priority audit item.
- Live verification confirmed both migrations, configured secrets by name only, an active schedule, and an HTTP 200 worker response with no warnings. No test records or test emails were created in production.
