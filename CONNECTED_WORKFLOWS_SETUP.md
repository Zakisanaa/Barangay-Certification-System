# Connected office workflows — 19 October 2026

Approved requests now appear in the existing Fee records and Certificate
register pages. Staff select a transaction by resident, document, or reference;
the appropriate form is filled automatically. Approval does not create a
payment, exemption, receipt, or issuance record.

## Using the connected pages

1. Approve an appointment in Admin dashboard.
2. Open **Fee records**. The transaction appears under **Awaiting first fee
   record**. Select it, confirm the payment/exemption, enter the receipt and
   details, and save. Free services select Exempt with amount zero.
3. Open **Certificate register** and select an eligible transaction under
   **Awaiting issuance**. Confirm the signatory and actual issuance, then save.
4. Existing transactions can also be opened directly through **Record fee**,
   **View fee history**, **Record issuance**, and **View issuance history** in
   request details. Actions follow the signed-in staff member's permissions.

The new lists search/sort the complete result before pagination. Completed
requests with missing records are included. Archived, cancelled, rejected, and
no-show appointments are excluded from the ordinary selector. Existing fee
entries, including refunded/voided payments, stay in history rather than
becoming new automatic charges. Recorded issuance leaves the awaiting list.
The **All eligible transactions** filter provides access to recorded history.
Manual lookup remains available for exceptional cases.

Cashiers can select eligible transactions entirely within Fee records without
requiring the dashboard feature permission. The new selector returns only
transaction-identifying fields, catalog fee information, and recorded-state
flags. It returns no ID numbers/images, addresses, contact details, staff notes,
or collector identifiers. It does not change existing table policies.

Fee recording remains controlled by the existing office switch. Settings
administrators can now click **Enable fee recording** directly in Fee records.
This explicitly invokes the existing version-checked setting action. Deployment
does not toggle the office setting. The final live verification found the
setting enabled and 12 eligible appointments awaiting a first fee record.

## Other connected records

- Walk-in rows open their fee or issuance form with the WALK transaction
  already selected. Issuance shortcuts require an in-progress/completed walk-in.
- Verification inbox notices open the exact resident's review window, even
  when the resident is outside the current masterlist page. Closure notices
  open the queue for the affected date.
- Audit history and supported report-preview rows link to the related request,
  concern, resident verification, fee history, or issuance history according to
  existing permissions. Aggregate workload rows have no transaction action.
- Fee, issuance/revocation, and walk-in drafts now use the existing unsaved-edit
  guard. Replacing a selected transaction asks before discarding unfinished
  form entries.

## Release and verification

Migration `20261019001000_connected_office_workflows.sql` is deployed. The
frontend is published in Vercel deployment `GBBNRvYS8UjcjVAnXRPtuG7B8hkt` at
<https://barangay-certification-system-eta.vercel.app>. No Edge function change
was required for these connections.

Validation passed: **110 automated tests and 247 isolated browser checks**,
both TypeScript checks, all six Deno checks, and production build. Eager
JavaScript remains 495,814 bytes before compression, under the 500 KB budget.
The seven new database checks cover permission boundaries, approval visibility,
absence of automatic payments/issuance, recorded/refunded history, custom
service fee resolution, walk-in selection, full-result pagination/search, and
completed/archived records. Sixteen new browser checks cover linked forms,
cashier-only work, draft protection, mobile sizing, inbox/report links, and
recoverable selector errors.

Live verification checks the migration, private internal projection, anonymous
denial, configured fee switch, published modules, mobile public/staff pages,
and notification worker dry-run readiness. Verification creates no production
appointments, fee entries, certificate entries, messages, or emails. Only the
authorized migration and frontend publication change production.

```powershell
.\node_modules\.bin\supabase.cmd db query --linked --file scripts/verify-connected-workflows.sql
node scripts/verify-admin-api.mjs
node scripts/verify-published-site.mjs
```

This release also resolves custom-document fee lookup finding F03 in the
earlier issue review and addresses the fee/register/walk-in portions of its
draft-protection finding. Incorrect exemption reversals, booking fee snapshots,
public-content draft protection, and the Banoy fallback routing issue remain
separate findings.
