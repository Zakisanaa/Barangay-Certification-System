# Supabase backend setup

The application uses Supabase Auth, Postgres, row-level security (RLS), and Realtime. It does not fall back to browser storage for resident or transaction data.

Current release notes are in [PRIORITY_THREE_SETUP.md](./PRIORITY_THREE_SETUP.md), with earlier rules in [PRIORITY_ONE_SETUP.md](./PRIORITY_ONE_SETUP.md), [PRIORITY_TWO_SETUP.md](./PRIORITY_TWO_SETUP.md), and [ADMIN_PRODUCT_SETUP.md](./ADMIN_PRODUCT_SETUP.md). Ordinary update emails use the transactional outbox and `process-notifications`; `notify-resident` handles completed PDFs and saved PDF delivery retries.

## Create and configure a project

The required-ID follow-up migration is `20261019000000_require_booking_id.sql`. All new appointments require a private ID image for every selected ID type; existing requests remain processable. The storage bucket and database column retain their original School ID names for compatibility.

1. Create a Supabase project and keep its database password and service-role key private.
2. Apply every migration in `supabase/migrations` in filename order. The current final migration is [`20261019000400_priority_three.sql`](./supabase/migrations/20261019000400_priority_three.sql). Prefer the linked CLI's `supabase db push` to preserve migration tracking. For an existing project, apply only unapplied migrations; do not rerun initial setup over existing tables.
3. Copy `.env.example` to `.env.local` and set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` from the project API settings. The browser is allowed to use only the publishable/anon key; never use `service_role` in a `VITE_` variable.
4. Restart the Vite server after setting environment values. For deployment, add those same two public values to the host's environment settings.
5. In **Authentication → URL Configuration**, set the production app URL as the Site URL and add each app origin to the Redirect URLs allowlist. Registration redirects to the app origin after email confirmation, so include your production Vercel URL and local development URL (for example, `http://localhost:5173`). Enable email confirmations in **Authentication → Providers → Email** and configure Supabase email delivery. Residents must confirm their address before they can sign in. For Vercel preview deployments, allowlist the preview origins you intend to use.
6. Use **Staff accounts** in the superadmin portal to invite staff or add an existing confirmed account and assign permissions. A new project's one-time superadmin bootstrap requires an explicitly selected, confirmed account and server credentials; follow [ADMIN_PRODUCT_SETUP.md](./ADMIN_PRODUCT_SETUP.md). Do not grant staff access by changing a resident's role alone. Staff sign in at `/staff`.

## Resident email notifications

Authentication SMTP settings send account confirmation and other Supabase Auth emails. Database transactions enqueue ordinary appointment/concern updates and staff replies in `notification_outbox`; the scheduled `process-notifications` worker sends them with safe retries. `notify-resident` separately sends completed certificate PDFs and resumes saved delivery attempts.

1. Upload the supplied DOCX templates to the private bucket after applying the migrations. From the repository root, set `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` in your terminal environment and run:

   ```sh
   node scripts/upload-certificate-templates.mjs
   ```

   Keep the service-role key out of `.env.local`, source control, and all `VITE_` variables. The uploader reads DOCX files from `BRGY. CERTS AND ETC`.
2. Deploy the function to the same Supabase project connected to the app:

   ```sh
   supabase functions deploy notify-resident --use-api
   supabase functions deploy process-notifications --use-api
   ```

   If using the Supabase CLI for the first time, log in and link the CLI to the correct project before deploying.
3. In **Project Settings → Edge Functions → Secrets** (or the project’s Edge Function secrets page), set:
   - `RESEND_API_KEY`: a Resend API key with email sending access.
   - `RESEND_FROM_EMAIL`: a sender using the verified Resend domain, for example `Barangay Lagasit Portal <no-reply@auth.example.com>`.
   - `APP_SITE_URL`: the deployed portal origin, for example `https://your-project.vercel.app`.

   Keep these values in Supabase Edge Function secrets. Do not put the Resend key in frontend environment variables or commit it to Git.
4. Verify that Supabase Auth SMTP is also configured if account-confirmation emails are needed; Edge Function secrets and Auth SMTP settings are separate configurations.
5. For an appointment request marked **Softcopy** or **Both**, staff can open its details, select the matching form, download the original DOCX, complete it in Word, and export a PDF. In **Certificate delivery**, upload the completed PDF, preview it, and email it to the resident’s registered address. This workflow applies to all forms, including the scanned **Lagasit Poorest to the Poor** and **Late Registration** forms. Only staff can download the private DOCX templates.
6. To send a resident’s completed certificate:
   1. Sign in to the staff portal, open **Requests**, and choose an appointment marked **Softcopy** or **Both**.
   2. Approve the request. Certificate sending is disabled until the request is approved.
   3. Open the request details, choose the matching certificate template, and click **Download original DOCX**.
   4. Complete the document in Word, check the resident details and signatures, and export it as a PDF.
   5. Click **Choose completed PDF** and select the exported file (maximum 5 MB). Open **Preview selected PDF** to review every page. Check the resident’s registered email address displayed above the upload control. Use **Choose a different PDF** if you need to replace the attachment.
   6. Click **Save & email PDF to resident**. The uploaded PDF is saved in the private certificate archive and emailed directly to the resident. A success message appears after sending; delivery errors leave the file selected so staff can retry.
7. Sign in as staff and change one appointment or concern status, send a staff reply, or send a completed PDF to verify email delivery. If delivery fails, the staff screen reports the error; check the function logs and Resend logs.

The schema enables RLS for all private records. Residents can read their own profile, requests, concerns, and request conversations; staff roles are assigned only by trusted database administrators. Public visitors can read active announcements and walk-in shifts. Records have no delete policy; staff can archive and restore appointment requests and concerns, and residents can view their own archived items.

Residents can update their name, contact number, and address from **My profile**. Staff can edit these same fields in the resident masterlist. The sign-in email is read-only in both views because changing it requires a separate Supabase Auth email-update flow; the account role is only changed by a trusted database administrator.

Appointment applicants selecting **School ID** must upload a JPG, PNG, or WebP photo (maximum 5 MB) and agree to staff review. Images are stored in a private Supabase Storage bucket; residents can upload only into their own account folder, and only staff can read the stored images.

## Booking and service configuration

Staff maintain **Services & booking** from the sidebar. Set verified requirements, fees, processing times, contact details, and office hours there. Unconfirmed fields are explicitly identified in the resident FAQ. Contact details are initially taken from the supplied `BRGY. CERTS AND ETC/Contact Information.txt`.

Each weekday slot initially accepts 10 active requests and the booking window is 90 days. Staff can change these limits, disable slots, and add holidays or office closures. The database checks availability at submission and rescheduling, reserves places for Pending and Approved requests, and prevents a resident from opening another current or future active request for the same document. Past Pending requests expire automatically; staff review attendance for Approved requests. Active requests must be resolved before archiving. Services without a matching template offer hardcopy only.

New requests must begin as Pending. Residents can cancel their own unfulfilled requests with a reason. Staff can approve, reject, cancel, reschedule, record collection or a no-show, complete, archive, and restore requests subject to the fulfillment and transition checks described in the Priority 1 guide. Rejections require a reason. Request history records the actor and timestamp for each change; existing requests start with a clearly identified current-status entry because prior transitions were not recorded.

## Certificate delivery tracking

Deploy all functions with `supabase functions deploy --use-api`. The notification function uses the existing Resend API key and sender. Completed PDFs are stored under a distinct delivery ID, so sending a revised certificate does not overwrite a previous copy. Staff and the owning resident can download the completed PDFs from request history. DOCX templates remain private to staff.

The **Sent to email provider** status means the API accepted the message. Delivery, delay, bounce, and failure updates require the signed webhook endpoint:

```text
https://YOUR_PROJECT_REF.supabase.co/functions/v1/resend-webhook
```

For manual setup, create a webhook in the Resend dashboard for `email.sent`, `email.delivered`, `email.delivery_delayed`, `email.bounced`, and `email.failed`. Copy its signing secret into Supabase Edge Function secrets as `RESEND_WEBHOOK_SECRET`. The webhook is publicly reachable, but verifies the signature and timestamp before processing events. Events for unrelated emails are ignored; certificate emails carry a `delivery_id` tag.

Alternatively, if the existing `RESEND_API_KEY` can manage webhooks, run `node scripts/configure-delivery-tracking.mjs` using a Supabase administrator CLI login. It registers the webhook and stores its signing secret in `delivery_tracking_settings`, a table accessible only to the service role. If `RESEND_WEBHOOK_SECRET` is already configured, the same script verifies the endpoint with a signed check instead. The script keeps project keys in memory and never displays them or sends test emails.

Retries of the same PDF use the same delivery ID and provider idempotency key. The UI identifies provider acceptance separately from mail-server delivery. Delivery confirmation does not prove that the resident opened the email.

## Password recovery and validation

Resident and staff login pages include **Forgot password?**. Recovery redirects to the app origin with `?recovery=1` (and `staff=1` for staff); include that origin and the recovery redirect in Supabase Auth Redirect URLs. Recovery links open the new-password form and return to login after saving. The app captures recovery fragments before Supabase removes them and subscribes to `PASSWORD_RECOVERY` immediately when creating the client. A session-storage flag (no tokens) preserves the form through a refresh. Completing or cancelling recovery signs out the temporary session and clears the flag.

Run `npm run typecheck`, `npm test`, and `npm run build`. Database tests execute the migrations in an isolated PostgreSQL engine and exercise booking rules and RLS. `npm run test:ui` uses mock services and a headless Chromium browser to check mobile layouts and resident/staff interactions. Set `CHROME_PATH` if Chrome is installed elsewhere. Screenshots are written to the ignored `test-results` directory.

## Existing browser-only demo data

Previously stored localStorage accounts, requests, messages, concerns, and schedules are not copied automatically. Local browser storage is not a trustworthy import source. Do not import resident information without reviewing and authorizing a secure migration process.

## External integrations

The F01–F14 admin/product release adds granular staff permissions, private verification/supporting documents, concern conversations, queues, issuance and fee registers, reports, public content, and auditing. Apply the new migrations before publishing the frontend and deploy `manage-staff`, `notify-resident`, and `banoy-chat`. See [ADMIN_PRODUCT_SETUP.md](./ADMIN_PRODUCT_SETUP.md) for setup, the selected superadmin account, and operational instructions.

Email delivery uses the deployed `notify-resident` and `resend-webhook` functions. Banoy uses the deployed `banoy-chat` function and Supabase's built-in `gte-small` embedding model; it does not require an external AI API key. SMS is not configured.

## Announcement photos and Banoy knowledge

Apply `20261015000100_announcement_photos_and_banoy.sql` and deploy `banoy-chat`. The migration adds the public `announcement-images` bucket (JPG/PNG/WebP, 5 MB) with staff-only uploads and deletion of unused files. Photos appear on the public landing page and resident home. Photos are optional; keep important information in the announcement text for accessibility and chatbot answers. Published photos are public assets.

Staff can open **Banoy knowledge** to save drafts, publish approved question-and-answer pairs, add up to 15 alternate questions, and test a draft privately. **Refresh learning** indexes all pending published entries in small batches. Saving a published answer indexes it immediately; if inference is unavailable, it stays saved and can be indexed again later. The assistant still matches approved wording while the model is unavailable.

The pre-trained model matches questions by meaning. Teaching adds office-approved knowledge; it does not retrain the underlying model weights. The built-in model supports English. Add Filipino question examples for matching local wording. Banoy returns the approved answer with its source, rather than inventing missing information. Ambiguous or weak matches enter a staff review queue. Residents can mark replies unhelpful; staff can teach an answer from those questions or mark them reviewed. Question history is visible only to its owner and staff. Admin tests do not enter resident question history.

Service information and announcement text are synchronized into Banoy knowledge by database triggers. Editing or archiving source information invalidates its previous learned vector. Current text can be matched immediately; the function refreshes relevant pending vectors during a question, and staff can index the entire knowledge base with **Refresh learning**. No school IDs, private certificates, or resident records enter the knowledge base.

`banoy-chat` validates the signed-in user and staff role on the server, checks ownership of feedback, limits question length, and reserves a database-backed rate limit before inference (15 questions/minute and 150/day per account). Knowledge writes use version checks to protect concurrent staff edits. Training results are saved only when the source version still matches.

## Private conversation attachments

Apply `20261019000100_conversation_attachments.sql` before publishing the chat attachment frontend. Request and concern conversations share the private `conversation-attachments` bucket (JPG/PNG/WebP/PDF/DOCX/TXT, three files per message, 5 MB each). Send through `send_transaction_message` or the extended `send_concern_message`; metadata is immutable and the message/file association saves atomically. The existing four-argument concern RPC call remains compatible through the optional attachments argument. Internal-note files stay inaccessible to residents. See `ADMIN_PRODUCT_SETUP.md` for staff use and retry behavior.

## Priority 2 reliability update

Apply `20261019000200_priority_two.sql` and `20261019000300_private_list_access.sql`, deploy `notify-resident` and `banoy-chat`, and publish the matching frontend. These add structured IDs and review acknowledgment, idempotent concern/schedule submissions, staff-edit revisions, server-side list pagination/counts, completed-resident metrics, certificate availability/retry recovery, and an explicit private-list sign-in guard. Existing requests and text schedule IDs are preserved. See [PRIORITY_TWO_SETUP.md](./PRIORITY_TWO_SETUP.md) for validation and operation.
