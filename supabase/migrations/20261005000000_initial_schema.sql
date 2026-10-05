create extension if not exists pgcrypto;

create table if not exists public.resident_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  first_name text not null,
  last_name text not null,
  email text not null unique,
  contact_number text not null,
  address text not null,
  role text not null default 'resident' check (role in ('resident', 'staff')),
  created_at timestamptz not null default now()
);

create table if not exists public.appointment_requests (
  reference text primary key,
  owner_id uuid not null references public.resident_profiles(id),
  full_name text not null,
  address text not null,
  voter_id text not null,
  request_type text not null,
  purpose text not null,
  appointment_date date not null,
  time_slot text not null,
  delivery_format text not null check (delivery_format in ('Softcopy', 'Hardcopy', 'Both')),
  status text not null default 'PENDING' check (status in ('PENDING', 'APPROVED', 'COMPLETED', 'REJECTED')),
  submitted_at timestamptz not null default now()
);

create table if not exists public.transaction_messages (
  id uuid primary key default gen_random_uuid(),
  request_reference text not null references public.appointment_requests(reference),
  author_id uuid not null references public.resident_profiles(id),
  author_name text not null,
  author_role text not null check (author_role in ('Resident', 'Staff')),
  body text not null check (char_length(body) between 1 and 1000),
  sent_at timestamptz not null default now()
);

create table if not exists public.resident_concerns (
  reference text primary key,
  owner_id uuid not null references public.resident_profiles(id),
  name text not null,
  contact text not null,
  category text not null,
  message text not null check (char_length(message) between 1 and 2000),
  status text not null default 'RECEIVED' check (status in ('RECEIVED', 'IN_REVIEW', 'RESOLVED')),
  submitted_at timestamptz not null default now()
);

create table if not exists public.public_posts (
  id text primary key,
  title text not null,
  content text not null,
  type text not null check (type in ('NOTICE', 'ADVISORY', 'UPDATE')),
  published_at timestamptz not null default now(),
  archived boolean not null default false
);

create table if not exists public.walk_in_shifts (
  id text primary key,
  staff_name text not null,
  role text not null,
  days text not null,
  hours text not null,
  active boolean not null default true,
  updated_at timestamptz not null default now()
);

create index if not exists appointment_requests_owner_submitted_idx
  on public.appointment_requests(owner_id, submitted_at desc);
create index if not exists transaction_messages_request_sent_idx
  on public.transaction_messages(request_reference, sent_at);
create index if not exists resident_concerns_owner_submitted_idx
  on public.resident_concerns(owner_id, submitted_at desc);

create or replace function public.is_barangay_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.resident_profiles
    where id = (select auth.uid()) and role = 'staff'
  );
$$;

create or replace function public.create_resident_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.resident_profiles (id, first_name, last_name, email, contact_number, address)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'first_name', ''),
    coalesce(new.raw_user_meta_data ->> 'last_name', ''),
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data ->> 'contact_number', ''),
    coalesce(new.raw_user_meta_data ->> 'address', '')
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_resident_profile on auth.users;
create trigger on_auth_user_created_resident_profile
  after insert on auth.users
  for each row execute procedure public.create_resident_profile();

alter table public.resident_profiles enable row level security;
alter table public.appointment_requests enable row level security;
alter table public.transaction_messages enable row level security;
alter table public.resident_concerns enable row level security;
alter table public.public_posts enable row level security;
alter table public.walk_in_shifts enable row level security;

grant usage on schema public to anon, authenticated;
grant select on public.public_posts, public.walk_in_shifts to anon, authenticated;
grant select, update on public.resident_profiles to authenticated;
grant select, insert, update on public.appointment_requests to authenticated;
grant select, insert on public.transaction_messages to authenticated;
grant select, insert, update on public.resident_concerns to authenticated;
grant insert, update on public.public_posts, public.walk_in_shifts to authenticated;
grant execute on function public.is_barangay_staff() to anon, authenticated;

create policy "Residents can read own profile; staff can read all"
  on public.resident_profiles for select to authenticated
  using (id = (select auth.uid()) or (select public.is_barangay_staff()));
create policy "Residents can update own contact profile"
  on public.resident_profiles for update to authenticated
  using (id = (select auth.uid()) and role = 'resident')
  with check (id = (select auth.uid()) and role = 'resident');

create policy "Residents read own requests; staff read all"
  on public.appointment_requests for select to authenticated
  using (owner_id = (select auth.uid()) or (select public.is_barangay_staff()));
create policy "Residents create own requests"
  on public.appointment_requests for insert to authenticated
  with check (owner_id = (select auth.uid()));
create policy "Staff update request status"
  on public.appointment_requests for update to authenticated
  using ((select public.is_barangay_staff()))
  with check ((select public.is_barangay_staff()));

create policy "Participants and staff read request messages"
  on public.transaction_messages for select to authenticated
  using (
    (select public.is_barangay_staff())
    or exists (
      select 1 from public.appointment_requests r
      where r.reference = request_reference and r.owner_id = (select auth.uid())
    )
  );
create policy "Participants send request messages"
  on public.transaction_messages for insert to authenticated
  with check (
    author_id = (select auth.uid())
    and (
      (author_role = 'Staff' and (select public.is_barangay_staff()))
      or (
        author_role = 'Resident'
        and exists (
          select 1 from public.appointment_requests r
          where r.reference = request_reference and r.owner_id = (select auth.uid())
        )
      )
    )
  );

create policy "Residents read own concerns; staff read all"
  on public.resident_concerns for select to authenticated
  using (owner_id = (select auth.uid()) or (select public.is_barangay_staff()));
create policy "Residents submit own concerns"
  on public.resident_concerns for insert to authenticated
  with check (owner_id = (select auth.uid()));
create policy "Staff update concern status"
  on public.resident_concerns for update to authenticated
  using ((select public.is_barangay_staff()))
  with check ((select public.is_barangay_staff()));

create policy "Anyone can read published announcements"
  on public.public_posts for select to anon, authenticated
  using (not archived or (select public.is_barangay_staff()));
create policy "Staff manage announcements"
  on public.public_posts for all to authenticated
  using ((select public.is_barangay_staff()))
  with check ((select public.is_barangay_staff()));

create policy "Anyone can read active walk-in schedule"
  on public.walk_in_shifts for select to anon, authenticated
  using (active or (select public.is_barangay_staff()));
create policy "Staff manage walk-in schedule"
  on public.walk_in_shifts for all to authenticated
  using ((select public.is_barangay_staff()))
  with check ((select public.is_barangay_staff()));

alter publication supabase_realtime add table public.appointment_requests;
alter publication supabase_realtime add table public.transaction_messages;
alter publication supabase_realtime add table public.resident_concerns;
alter publication supabase_realtime add table public.public_posts;
alter publication supabase_realtime add table public.walk_in_shifts;
alter publication supabase_realtime add table public.resident_profiles;
