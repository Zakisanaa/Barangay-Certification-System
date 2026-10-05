# Supabase backend setup

The application uses Supabase Auth, Postgres, row-level security (RLS), and Realtime. It does not fall back to browser storage for resident or transaction data.

## Create and configure a project

1. Create a Supabase project and keep its database password and service-role key private.
2. In the Supabase SQL editor, run the migrations in `supabase/migrations` in filename order, including [`supabase/migrations/20261005000000_initial_schema.sql`](./supabase/migrations/20261005000000_initial_schema.sql), [`supabase/migrations/20261005000200_staff_edit_resident_profiles.sql`](./supabase/migrations/20261005000200_staff_edit_resident_profiles.sql), [`supabase/migrations/20261005000300_school_id_image_upload.sql`](./supabase/migrations/20261005000300_school_id_image_upload.sql), and [`supabase/migrations/20261005000400_archive_requests_and_concerns.sql`](./supabase/migrations/20261005000400_archive_requests_and_concerns.sql).
3. Copy `.env.example` to `.env.local` and set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` from the project API settings. The browser is allowed to use only the publishable/anon key; never use `service_role` in a `VITE_` variable.
4. Restart the Vite server after setting environment values. For deployment, add those same two public values to the host's environment settings.
5. In **Authentication → URL Configuration**, set the production app URL as the Site URL and add each app origin to the Redirect URLs allowlist. Registration redirects to the app origin after email confirmation, so include your production Vercel URL and local development URL (for example, `http://localhost:5173`). Enable email confirmations in **Authentication → Providers → Email** and configure Supabase email delivery. Residents must confirm their address before they can sign in. For Vercel preview deployments, allowlist the preview origins you intend to use.
6. Register a staff identity through the resident registration form and confirm its email before promoting it using the SQL editor:

   ```sql
   update public.resident_profiles
   set role = 'staff'
   where email = 'official-staff-email@example.org';
   ```

   Do this only for verified, authorized staff. Staff sign in at `/staff`.

## Resident email notifications

Authentication SMTP settings send account confirmation and other Supabase Auth emails only. The `notify-resident` Edge Function separately sends email when staff change an appointment or concern status, and when staff reply in an appointment conversation.

1. Deploy the function to the same Supabase project connected to the app:

   ```sh
   supabase functions deploy notify-resident
   ```

   If using the Supabase CLI for the first time, log in and link the CLI to the correct project before deploying.
2. In **Project Settings → Edge Functions → Secrets** (or the project’s Edge Function secrets page), set:
   - `RESEND_API_KEY`: a Resend API key with email sending access.
   - `RESEND_FROM_EMAIL`: a sender using the verified Resend domain, for example `Barangay Lagasit Portal <no-reply@auth.example.com>`.
   - `APP_SITE_URL`: the deployed portal origin, for example `https://your-project.vercel.app`.

   Keep these values in Supabase Edge Function secrets. Do not put the Resend key in frontend environment variables or commit it to Git.
3. Verify that Supabase Auth SMTP is also configured if account-confirmation emails are needed; Edge Function secrets and Auth SMTP settings are separate configurations.
4. Sign in as staff and change one appointment or concern status, or send a staff reply in an appointment conversation. The resident’s profile email receives the message. If a record update succeeds but delivery fails, the staff screen reports the email error; check the function logs and Resend logs.

The schema enables RLS for all private records. Residents can read their own profile, requests, concerns, and request conversations; staff roles are assigned only by trusted database administrators. Public visitors can read active announcements and walk-in shifts. Records have no delete policy; staff can archive and restore appointment requests and concerns, and residents can view their own archived items.

Residents can update their name, contact number, and address from **My profile**. Staff can edit these same fields in the resident masterlist. The sign-in email is read-only in both views because changing it requires a separate Supabase Auth email-update flow; the account role is only changed by a trusted database administrator.

Appointment applicants selecting **School ID** must upload a JPG, PNG, or WebP photo (maximum 5 MB) and agree to staff review. Images are stored in a private Supabase Storage bucket; residents can upload only into their own account folder, and only staff can read the stored images.

## Existing browser-only demo data

Previously stored localStorage accounts, requests, messages, concerns, and schedules are not copied automatically. Local browser storage is not a trustworthy import source. Do not import resident information without reviewing and authorizing a secure migration process.

## External integrations

Supabase database setup does not by itself activate OpenAI, email/SMS delivery, or file storage. Those require separately deployed Edge Functions/storage policies and provider credentials stored as server-side secrets, never in the frontend environment.
