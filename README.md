
# Barangay Certification Appointment System

Resident appointments, document requests, private conversations, concerns,
announcements, and the staff portal for Barangay Lagasit.

## Local setup

1. Install dependencies with `npm ci`.
2. Follow [SUPABASE_SETUP.md](./SUPABASE_SETUP.md) for Auth, database, Storage,
   and Edge Functions. Copy `.env.example` to `.env.local` and supply the
   project's public Supabase URL and anon/publishable key.
3. Run `npm run dev`. Residents use `/`; verified staff use `/staff`.

Superadmins manage staff accounts and permissions through the staff portal.
Deployment and workflow notes:

- [Admin and product features](./ADMIN_PRODUCT_SETUP.md)
- [Priority 1](./PRIORITY_ONE_SETUP.md)
- [Priority 2](./PRIORITY_TWO_SETUP.md)
- [Priority 3](./PRIORITY_THREE_SETUP.md)
- [Current known issues](./KNOWN_ISSUES.md)

## Verification

Use Node.js, Deno, and Chrome/Chromium (`CHROME_PATH` overrides the Windows
default). Run `npm run check` for the active app, all source files, all six Edge
Functions, automated tests, and the production build. Run `npm run test:ui` for
isolated browser workflows. Tests send no real emails or resident submissions.
The build also verifies that portal pages and charts are loaded on demand.

Production starts in `src/main.tsx` and `src/app/App.tsx`. Unused design
prototypes were removed during final cleanup. The original design came from
the supplied Figma code bundle.

Never place service-role keys or email-provider secrets in frontend environment
variables. Apply migrations before publishing a frontend that depends on them.


## Final folder cleanup

Generated dependencies, build output, browser profiles and test results are not
kept in the finished working folder. Run `npm ci` before running the app or
checks again. `npm run build` recreates `dist/`; browser checks recreate
`test-results/`. The original office Word files, local environment configuration,
Git history, hosting links, application source, migrations and tests are retained.
School upload files and the separate private handover are in `school-submission/`.
