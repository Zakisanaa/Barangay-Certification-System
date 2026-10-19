# Existing feature issue review — 19 October 2026

Follow-up: the [connected workflow release](./CONNECTED_WORKFLOWS_SETUP.md)
resolves F03 and protects fee, issuance, and walk-in drafts. The public-content
part of F04 remains open. Fee recording was enabled at the later release check;
C01 below records the earlier disabled-setting snapshot. The other findings
remain separate from the workflow connections.

Scope: review the existing application and published configuration. No application
code, migrations, production records, settings, or deployments were changed by
this review. Browser reproductions used mock services; database reproductions
used an isolated in-memory database. Only this report and local audit artifacts
were written.

Reviewed site: <https://barangay-certification-system-eta.vercel.app>.

## Confirmed code issues

| ID | Priority | Existing feature | Finding and evidence |
|---|---|---|---|
| F01 | High | Fee corrections | An incorrect **Exempt** entry cannot be voided, and the duplicate-entry check blocks its replacement with a paid record. The correction UI only offers actions for paid entries, and the server only accepts a paid original. This also affects the waiver correction path. An isolated exemption reversal returned “Select the original payment record for this transaction”; recording the payment afterward returned “A payment or exemption is already recorded.” |
| F02 | Medium | Booking fees and staff fee lookup | The amount shown at booking is not retained as a request fee snapshot. Staff lookup reads the current catalog amount; the resident payment-information RPC also reads it dynamically. In an isolated request, changing the catalog from PHP 75 to PHP 125 changed that existing request's returned fee. **Saved payment/receipt amounts themselves remain unchanged.** |
| F03 | Medium | Other/custom document fee lookup | A request created under **Other barangay document** stores the resident's custom document name. Staff fee lookup searches the catalog using that name, rather than the request's saved service key or Other-document fallback. Reproduced in the browser: the configured Other fee was PHP 100, but the lookup left Amount blank and asked staff to confirm with the office. Staff must enter it manually. |
| F04 | Medium | Admin form drafts | Unfinished fee and walk-in forms are lost when navigating away without a discard warning. **Reload published values** also overwrites unfinished public-content edits without a warning. The isolated browser reproduction recorded zero confirmation prompts, an unprotected fee-form refresh event, and discarded receipt, walk-in, and About-text drafts. The certificate-register and staff-access editors also lack the shared dirty-form guard in source; these two additional forms were not exercised by this reproduction. |
| F05 | Low | Banoy service FAQ fallback | The fallback checks for words such as **office** before recognizing the document service. A local reproduction of “How much is Good Moral Certificate?” returned PHP 100, while adding “at the office” returned office hours and omitted the fee. This is a defect in the fallback path; the hosted model's wording/semantic answer may answer some such questions before the fallback runs. |

Source references:

- F01: [correction restriction](./supabase/migrations/20261018000300_admin_workflows.sql:195), [duplicate-entry guard](./supabase/migrations/20261019000600_resident_payments.sql:81), [paid-only correction UI](./src/app/components/FeeRecordsPage.tsx:67).
- F02: [booking summary](./src/app/components/BookPage.tsx:818), [staff catalog lookup](./src/app/components/FeeRecordsPage.tsx:27), [resident payment information](./supabase/migrations/20261019000600_resident_payments.sql:43).
- F03: [transaction lookup returns the custom request name](./supabase/migrations/20261018000600_admin_reports_and_permissions.sql:151), [exact catalog lookup](./src/app/components/FeeRecordsPage.tsx:27).
- F04: [fee form state](./src/app/components/FeeRecordsPage.tsx:19), [walk-in form state](./src/app/components/OfficeQueuePage.tsx:12), [public-content reload](./src/app/components/PublicContentManager.tsx:14), [existing draft guard](./src/app/useUnsavedChanges.ts:3).
- F05: [office question handling precedes service matching](./src/app/serviceFaq.ts:18).

## Existing configuration and workflow issues

| ID | Type | Current observation | Practical effect |
|---|---|---|---|
| C01 | Live setting | **Fee recording is currently disabled** in `office_settings.fee_tracking_enabled`. | The staff payment-entry form is unavailable until a settings administrator enables the existing switch and saves Office information. This is a configuration state, not evidence of a broken resident-history page. |
| C02 | Incomplete service setup | **20 of 21 active services have no processing time saved.** Barangay Clearance currently has `1-5hours`. | Most service pages and Banoy answers must ask residents to confirm processing time with the office. Approved values are needed in the existing settings fields. |
| W01 | Workflow gap; office procedure dependent | A paid-fee appointment can be issued a register entry and completed without a payment/exemption record. Hardcopy completion can also occur without a certificate-register entry. | The payment ledger, register, and completion actions do not cross-check each other. The isolated probe completed a request with zero fee records and zero register entries. Whether these must block release depends on the office's procedure; this review does not assume that every transaction must be paid. |

W01 evidence: [issuance validation](./supabase/migrations/20261018000300_admin_workflows.sql:128)
and [completion validation](./supabase/migrations/20261019000000_require_booking_id.sql:56).

The live settings changed after the earlier release: office hours now read
**8:00 am - 5:00 pm**, and fee recording is off. The earlier completion review's
snapshot should not be treated as the current configuration.

The general Certificate of Indigency is free, while its three separately named
variants remain PHP 100 under the requested other-option rate. This matches the
current saved configuration and is not counted as a confirmed code defect.

## Checks that passed and practical limits

- Live public and staff sign-in pages loaded at 320px with no uncaught JavaScript errors or failed public API responses during the check.
- All 21 current services have numeric fees and ID instructions. Agrarian has its required ownership/tenancy checklist. Good Moral still requires the booking ID with no additional upload.
- All repository migrations through `20261019000900` are deployed. Public application tables have row-level security enabled.
- Checked private APIs reject anonymous access. The notification worker's dry run is ready with email configured; all 19 current outbox entries are marked sent. This does not establish inbox receipt.
- The scheduler has recent successful runs. Five older failures occurred on 18 October; the latest read found 1,246 successful runs in the preceding day. This is not evidence of a current worker outage.
- The latest release baseline is 103 automated tests and 231 isolated browser checks. This review ran additional focused reproductions, the existing workflow probes, live configuration queries, and published/API checks; it did not rerun the entire release suite.

Real resident/staff password sessions, actual inbox delivery, backup restoration,
and concurrent production writes were not exercised. There are four active staff
accounts, one superadmin, and no verified staff MFA factors in the live aggregate
check. These observations do not establish a complete security assessment.

Local reproduction artifacts:

- [Fee and completion workflow results](./test-results/completion-workflow-probes.json).
- [Custom fee lookup and discarded-draft results](./test-results/current-feature-review-ui.json).
- [Isolated browser review runner](./test-results/review-existing-features.mjs).

The supporting-document approval guard was also inspected. It checks submitted
required-file snapshots rather than reapplying newly added catalog requirements
to old requests; the suspected retrospective requirement problem was not
confirmed and is not included as a finding.
