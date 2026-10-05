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

The schema enables RLS for all private records. Residents can read their own profile, requests, concerns, and request conversations; staff roles are assigned only by trusted database administrators. Public visitors can read active announcements and walk-in shifts. Records have no delete policy; staff can archive and restore appointment requests and concerns, and residents can view their own archived items.

Residents can update their name, contact number, and address from **My profile**. Staff can edit these same fields in the resident masterlist. The sign-in email is read-only in both views because changing it requires a separate Supabase Auth email-update flow; the account role is only changed by a trusted database administrator.

Appointment applicants selecting **School ID** must upload a JPG, PNG, or WebP photo (maximum 5 MB) and agree to staff review. Images are stored in a private Supabase Storage bucket; residents can upload only into their own account folder, and only staff can read the stored images.

## Existing browser-only demo data

Previously stored localStorage accounts, requests, messages, concerns, and schedules are not copied automatically. Local browser storage is not a trustworthy import source. Do not import resident information without reviewing and authorizing a secure migration process.

## External integrations

Supabase database setup does not by itself activate OpenAI, email/SMS delivery, or file storage. Those require separately deployed Edge Functions/storage policies and provider credentials stored as server-side secrets, never in the frontend environment.
