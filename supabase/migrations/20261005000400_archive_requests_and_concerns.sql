alter table public.appointment_requests
  add column if not exists archived boolean not null default false;

alter table public.resident_concerns
  add column if not exists archived boolean not null default false;
