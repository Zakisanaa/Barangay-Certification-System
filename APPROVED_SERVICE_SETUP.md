# Approved service fees and requirements — 19 October 2026

The user supplied these fees and requirements, then clarified that every
booking still requires a valid ID. “None” for Good Moral means no additional
supporting documents. The remaining existing booking options use PHP 100 and a
valid ID, as requested.

| Booking option | Fee (PHP) | Booking identification | Additional upload |
|---|---:|---|---|
| Barangay Clearance | 100 | Valid ID details and photo | None |
| Certificate of Indigency | 0 | Valid ID details and photo | None |
| Certificate of Residency | 100 | Valid ID details and photo | None |
| First-Time Job Seeker Certificate | 0 | Valid ID details and photo | None |
| Barangay Agrarian Certificate | 100 | Valid ID details and photo | Proof of land ownership **or** tenancy |
| Good Moral Certificate | 100 | Valid ID details and photo | None |
| Attestation | 0 | Valid ID details and photo | None |
| Other existing booking options | 100 | Valid ID details and photo | None |

Existing service names and templates were preserved. Agrarian Certificate was
added as hardcopy only because no approved template was supplied. No processing
time or office hours were invented. The three named free options above are
explicit exceptions to the other-option PHP 100 rate.

Residents complete **Personal Information** with ID type, number, private image,
and review acknowledgment. In **Document & Purpose**, selecting a service shows
the fee, attached booking ID, and additional uploads. Agrarian requires one
readable PDF, JPG, PNG, or WebP up to 5 MB. Invalid files cannot advance to
scheduling; changing services clears the previous supporting upload. Final
review shows the fee and supporting filenames. Both the submission RPC and the
database's deferred requirement guard reject a missing Agrarian proof.

Staff can adjust saved service fees/instructions under **Services & booking**.
The supporting-document editor maintains the additional upload checklist. The
service sync updates Banoy's source answers when service facts change. Banoy
also recognizes abbreviated residence, clearance, good moral, attestation,
and agrarian questions. Its generic booking answer explains that Good Moral's
additional requirements are separate from the mandatory booking ID.

Migration `20261019000900_approved_service_fees.sql`, the updated `banoy-chat`
function, and Vercel deployment `5iSgq2k6GwkiUdmqFNnAj3roFbLG` are published at
<https://barangay-certification-system-eta.vercel.app>. All 21 catalog entries
and matching Banoy source answers were verified live. Training completed with
zero pending active answers, and eight live preview questions returned the
approved fee and requirements. Preview checks do not create resident questions
or email jobs; training updates model vectors only.

Validation passed: **103 automated tests, 231 isolated browser checks**, both
TypeScript checks, all six Deno checks, and the production build. Live public
and staff rendering and private API protections were checked separately. Tests
and previews created no production resident bookings, fee records, messages,
or emails. Office configuration and workflow gaps in the completion review
remain separate from this release.

```powershell
node scripts/verify-approved-services.mjs
# Train newly changed approved answers when needed:
node scripts/verify-approved-services.mjs --train
node scripts/verify-published-site.mjs
node scripts/verify-admin-api.mjs
```
