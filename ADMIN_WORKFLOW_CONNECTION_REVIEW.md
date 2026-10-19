# Existing admin workflow connections — 19 October 2026

**Implemented:** see [Connected office workflows](./CONNECTED_WORKFLOWS_SETUP.md)
for the published behavior and validation. The proposal below records the
review that preceded implementation.

The current forms preserve their records correctly in several areas, but Fee
records and Certificate register expect a reference copied from another page.
The recommended changes below connect existing pages and retain the current
staff permissions. This is a review proposal; no application changes or
production writes were made.

## Recommended fee flow

1. Staff approve a document request from the dashboard.
2. It appears automatically in **Fee records → Needs recording**, with resident
   name, document, reference, appointment date, and configured fee.
3. The cashier finds it by name, document, or reference and chooses **Record
   payment** or **Record exemption**. The selected transaction and amount fill
   the existing form.
4. Staff confirm the actual payment method, receipt, and details, then save.
5. The saved entry appears in fee history and the owning resident's Fees &
   receipts page. It no longer appears as awaiting its first fee record.

Approval only makes the request available for fee recording. It does not mean
that money was received. Free services can appear as **No fee** and open an
exemption entry for staff confirmation. A refund remains a correction linked
to the original payment; it must not silently become a new overdue charge.

The list should also make completed requests with a missing fee record
discoverable, so earlier omissions can be recorded. Cancelled, rejected,
archived, and no-show requests should not enter the ordinary approval queue.
Walk-in transactions should be selectable from their existing records.

Retain manual reference lookup for exceptional cases. New staff should be able
to do their usual work through the selectable list. The pending list must
refresh after approvals and fee saves, support search/sort/pagination, and
avoid showing duplicate payment actions for already recorded transactions.

Cashiers need only the transaction identity, resident name, document, fee, and
payment state. They should be able to work inside their permitted Fee records
page without needing dashboard access or access to private ID files. Custom
document requests must resolve their saved Other-document service when filling
the fee. The separate quoted-fee issue remains relevant when catalog prices
change after booking.

## Other existing pages checked

| Page or handoff | Current behavior | Recommended connection | Priority |
|---|---|---|---|
| Fee records | Reference must be typed; approved requests are absent until an actual fee entry is saved. | Selectable approved/completed requests needing recording, with automatic transaction and fee selection. | First |
| Certificate register | Reference must be typed before issuance can be recorded. | List eligible approved/completed requests and in-progress/completed walk-ins. Selecting a transaction fills its reference and details. Staff still confirm issuance and signatory. | First |
| Dashboard request details | Shows related fee/register history, document review, delivery, collection, and conversations. It has no direct payment-entry or register-entry handoff. | Add permission-aware **Record fee**, **View receipt**, and **Record issuance** actions that retain the selected request. Show which existing steps are recorded. Stay on the dashboard after approval so batch review remains usable. | First |
| Office queue / walk-ins | Appointments already load automatically. Appointment rows open the selected request. Walk-in rows only expose their status editor. | Let staff open fee recording and issuance for the selected walk-in without copying its WALK reference. | Next |
| Notification inbox → resident verification | The shortcut opens Resident masterlist, but the selected resident identifier is not passed into its verification view. | Open the exact resident's verification record from the notice. | Next |
| Audit history and report previews | Display record references, but offer no direct record navigation. | Where the row has an identifiable supported record, provide an authorized link to that exact record. Reports containing aggregates do not need record actions. | Later |

These flows already retain the selected context:

- Supporting-document review, request conversations, and PDF delivery are
  inside the selected request.
- Office queue appointment rows open the related request.
- Concern notifications can open the selected concern conversation.
- Service requirements and certificate templates share the selected service.
- Service facts and published announcements synchronize into Banoy source
  answers; staff do not have to retype the same fees into separate answers.
- Banoy question review can carry the selected question into the answer editor.

## Source evidence

- [Manual fee reference and lookup](./src/app/components/FeeRecordsPage.tsx:46).
- [Manual issuance reference](./src/app/components/CertificateRegisterPage.tsx:18).
- [Request details already show delivery and transaction records](./src/app/components/AdminPage.tsx:137).
- [Walk-in status actions](./src/app/components/OfficeQueuePage.tsx:28).
- [Inbox navigation](./src/app/components/StaffInboxPage.tsx:11).
- [Resident masterlist receives no focused reference](./src/app/App.tsx:311).
- [Fee and register pages receive no selected-transaction context](./src/app/App.tsx:318).
- [Transaction lookup already supports permitted cashiers](./supabase/migrations/20261018000600_admin_reports_and_permissions.sql:147).

The earlier live review found fee recording disabled. The current existing
Office information switch must be enabled before staff can save fee entries.
Any future UI connection should explain that setting and provide an authorized
route to it, rather than silently changing the office's configuration.
