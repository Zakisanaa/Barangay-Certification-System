begin;

create table public.service_catalog (
  request_type text primary key,
  requirements text not null default '',
  fee_description text not null default '',
  processing_time text not null default '',
  active boolean not null default true,
  softcopy_available boolean not null default false,
  updated_at timestamptz not null default now()
  ,check (char_length(requirements) <= 4000 and char_length(fee_description) <= 1000 and char_length(processing_time) <= 500)
  ,check (not softcopy_available or request_type in (
    'Barangay Clearance', 'Certificate of Residency', 'Certificate of Indigency', 'Business Permit Clearance',
    'Attestation', 'Certificate of Indigency (Financial Assistance)', 'Certificate of Indigency (IMSWD & Hospital)',
    'Certificate of Indigency (Indigent Only)', 'Lagasit Poorest to the Poor', 'Late Registration', 'Livestock',
    'Certificate of Non-Residency', 'PWD Certificate', 'Tenancy', 'First-Time Job Seeker Certificate'
  ))
);

insert into public.service_catalog (request_type, softcopy_available) values
  ('Barangay Clearance', true), ('Certificate of Residency', true),
  ('Certificate of Indigency', true), ('Business Permit Clearance', true),
  ('Attestation', true), ('Certificate of Indigency (Financial Assistance)', true),
  ('Certificate of Indigency (IMSWD & Hospital)', true), ('Certificate of Indigency (Indigent Only)', true),
  ('Lagasit Poorest to the Poor', true), ('Late Registration', true),
  ('Livestock', true), ('Certificate of Non-Residency', true), ('PWD Certificate', true),
  ('Tenancy', true), ('Good Moral Certificate', false), ('Community Tax Certificate (Cedula)', false),
  ('First-Time Job Seeker Certificate', true), ('Certificate of No Business', false),
  ('Certificate of No Property', false), ('Other barangay document', false);

create table public.office_settings (
  id integer primary key check (id = 1),
  contact_number text not null default '',
  contact_email text not null default '',
  office_hours text not null default '',
  address text not null default 'Barangay Lagasit',
  booking_days_ahead integer not null default 90 check (booking_days_ahead between 1 and 365)
);
insert into public.office_settings (id, contact_number, contact_email)
values (1, '09931411699', 'barangaylagasit00@gmail.com');

create table public.appointment_slots (
  label text primary key,
  start_time time not null,
  capacity integer not null default 10 check (capacity between 1 and 200),
  active boolean not null default true
);
insert into public.appointment_slots (label, start_time) values
  ('8:00 AM - 9:00 AM', '08:00'), ('9:00 AM - 10:00 AM', '09:00'),
  ('10:00 AM - 11:00 AM', '10:00'), ('11:00 AM - 12:00 PM', '11:00'),
  ('1:00 PM - 2:00 PM', '13:00'), ('2:00 PM - 3:00 PM', '14:00'),
  ('3:00 PM - 4:00 PM', '15:00');

create table public.office_closures (
  closed_date date primary key,
  reason text not null check (char_length(btrim(reason)) between 1 and 300)
);

alter table public.appointment_requests add column rejection_reason text;

create table public.request_events (
  id uuid primary key default gen_random_uuid(),
  request_reference text not null references public.appointment_requests(reference),
  actor_id uuid references public.resident_profiles(id),
  actor_name text not null,
  status text not null,
  description text not null,
  created_at timestamptz not null default now()
);
create index request_events_reference_idx on public.request_events(request_reference, created_at);

create table public.certificate_deliveries (
  id uuid primary key,
  request_reference text not null references public.appointment_requests(reference),
  owner_id uuid not null references public.resident_profiles(id),
  sent_by uuid not null references public.resident_profiles(id),
  sender_name text not null,
  recipient_email text not null,
  template_name text not null,
  storage_path text not null unique,
  pdf_hash text not null,
  provider_id text unique,
  status text not null default 'pending' check (status in ('pending', 'sent', 'delivered', 'delayed', 'bounced', 'failed')),
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_event_at timestamptz
);
create index certificate_deliveries_reference_idx on public.certificate_deliveries(request_reference, created_at desc);
create table public.email_webhook_events (
  event_id text primary key,
  received_at timestamptz not null default now()
);
create table public.delivery_tracking_settings (
  id integer primary key check (id = 1),
  webhook_id text not null,
  signing_secret text not null,
  endpoint text not null
);
alter table public.delivery_tracking_settings enable row level security;
revoke all on public.delivery_tracking_settings from public, anon, authenticated;
grant all on public.delivery_tracking_settings to service_role;

alter table public.service_catalog enable row level security;
alter table public.office_settings enable row level security;
alter table public.appointment_slots enable row level security;
alter table public.office_closures enable row level security;
alter table public.request_events enable row level security;
alter table public.certificate_deliveries enable row level security;
alter table public.email_webhook_events enable row level security;

grant select on public.service_catalog, public.office_settings, public.appointment_slots, public.office_closures to anon, authenticated;
grant update on public.service_catalog, public.office_settings, public.appointment_slots to authenticated;
grant insert, update, delete on public.office_closures to authenticated;
grant select on public.request_events, public.certificate_deliveries to authenticated;
grant all on public.certificate_deliveries, public.email_webhook_events to service_role;

create policy "Read service information" on public.service_catalog for select to anon, authenticated using (true);
create policy "Staff maintain service information" on public.service_catalog for update to authenticated using (public.is_barangay_staff()) with check (public.is_barangay_staff());
create policy "Read office information" on public.office_settings for select to anon, authenticated using (true);
create policy "Staff maintain office information" on public.office_settings for update to authenticated using (public.is_barangay_staff()) with check (public.is_barangay_staff());
create policy "Read appointment slots" on public.appointment_slots for select to anon, authenticated using (true);
create policy "Staff maintain appointment slots" on public.appointment_slots for update to authenticated using (public.is_barangay_staff()) with check (public.is_barangay_staff());
create policy "Read office closures" on public.office_closures for select to anon, authenticated using (true);
create policy "Staff maintain closures" on public.office_closures for all to authenticated using (public.is_barangay_staff()) with check (public.is_barangay_staff());
create policy "Read own request history or staff" on public.request_events for select to authenticated using (
  public.is_barangay_staff() or exists (select 1 from public.appointment_requests r where r.reference = request_reference and r.owner_id = auth.uid())
);
create policy "Read own certificate history or staff" on public.certificate_deliveries for select to authenticated using (owner_id = auth.uid() or public.is_barangay_staff());
create policy "Residents download their completed PDFs" on storage.objects for select to authenticated using (
  bucket_id = 'completed-certificates' and exists (
    select 1 from public.certificate_deliveries d where d.storage_path = name and d.owner_id = auth.uid()
  )
);

-- Counts are aggregated here; residents never receive another resident's request.
create function public.get_slot_availability(day date)
returns table (label text, start_time time, capacity integer, remaining integer, available boolean, reason text)
language sql stable security definer set search_path = public as $$
  select s.label, s.start_time, s.capacity,
    greatest(0, s.capacity - (select count(*)::integer from public.appointment_requests r
      where r.appointment_date = day and r.time_slot = s.label and r.status in ('PENDING', 'APPROVED'))),
    s.active and extract(isodow from day) < 6
      and day between (now() at time zone 'Asia/Manila')::date and (now() at time zone 'Asia/Manila')::date + o.booking_days_ahead
      and (day + s.start_time) at time zone 'Asia/Manila' > now()
      and not exists (select 1 from public.office_closures c where c.closed_date = day)
      and (select count(*) from public.appointment_requests r where r.appointment_date = day and r.time_slot = s.label and r.status in ('PENDING', 'APPROVED')) < s.capacity,
    case
      when not s.active then 'Slot disabled'
      when extract(isodow from day) >= 6 then 'Office closed on weekends'
      when exists (select 1 from public.office_closures c where c.closed_date = day) then (select c.reason from public.office_closures c where c.closed_date = day)
      when day > (now() at time zone 'Asia/Manila')::date + o.booking_days_ahead then 'Outside booking window'
      when (day + s.start_time) at time zone 'Asia/Manila' <= now() then 'Time has passed'
      when (select count(*) from public.appointment_requests r where r.appointment_date = day and r.time_slot = s.label and r.status in ('PENDING', 'APPROVED')) >= s.capacity then 'Fully booked'
      else '' end
  from public.appointment_slots s cross join public.office_settings o where o.id = 1 order by s.start_time;
$$;
revoke all on function public.get_slot_availability(date) from public;
grant execute on function public.get_slot_availability(date) to authenticated;

create function public.validate_appointment_request()
returns trigger language plpgsql security definer set search_path = public as $$
declare service public.service_catalog; slot public.appointment_slots; booking_limit integer;
begin
  if TG_OP = 'UPDATE' then
    if not public.is_barangay_staff() and auth.role() <> 'service_role' then raise exception 'Only staff can update requests.'; end if;
    if (new.reference, new.owner_id, new.full_name, new.address, new.voter_id, new.request_type, new.purpose, new.appointment_date, new.time_slot, new.delivery_format, new.submitted_at, new.school_id_image_path)
      is distinct from (old.reference, old.owner_id, old.full_name, old.address, old.voter_id, old.request_type, old.purpose, old.appointment_date, old.time_slot, old.delivery_format, old.submitted_at, old.school_id_image_path)
      then raise exception 'Request details cannot be changed after submission.'; end if;
    if new.status <> old.status and not ((old.status = 'PENDING' and new.status in ('APPROVED', 'REJECTED')) or (old.status = 'APPROVED' and new.status in ('COMPLETED', 'REJECTED')))
      then raise exception 'This request status transition is not allowed.'; end if;
    if new.status = 'REJECTED' and (new.status <> old.status or new.rejection_reason is distinct from old.rejection_reason) and char_length(btrim(coalesce(new.rejection_reason, ''))) not between 1 and 1000 then
      raise exception 'Provide a rejection reason (1 to 1000 characters).';
    end if;
    if new.status <> 'REJECTED' then new.rejection_reason := null; end if;
    return new;
  end if;
  if new.status <> 'PENDING' or new.archived then raise exception 'New requests must start as Pending and cannot be archived.'; end if;
  if new.reference !~ '^[A-Za-z0-9-]{1,100}$' then raise exception 'The request reference is invalid.'; end if;
  if new.school_id_image_path is not null and (split_part(new.school_id_image_path, '/', 1) <> new.owner_id::text or split_part(new.school_id_image_path, '/', 2) <> new.reference or new.school_id_image_path !~ '/school-id\.(jpg|png|webp)$') then
    raise exception 'The school ID upload must belong to this resident and request.';
  end if;
  if new.voter_id like 'School ID:%' and new.school_id_image_path is null then raise exception 'Upload the school ID image for staff review.'; end if;
  if char_length(btrim(new.full_name)) not between 1 and 200 or char_length(btrim(new.address)) not between 1 and 500 or char_length(btrim(new.purpose)) not between 1 and 2000 or char_length(btrim(new.voter_id)) not between 1 and 300 then
    raise exception 'Provide valid resident details, identification, and purpose.';
  end if;
  select * into service from public.service_catalog where request_type = new.request_type and active;
  if not found then
    select * into service from public.service_catalog where request_type = 'Other barangay document' and active;
    if not found or char_length(btrim(new.request_type)) not between 1 and 200 then raise exception 'This document service is unavailable.'; end if;
    if exists (select 1 from public.service_catalog where request_type = new.request_type) then raise exception 'This document service is unavailable.'; end if;
  end if;
  if new.delivery_format in ('Softcopy', 'Both') and not service.softcopy_available then raise exception 'This document is currently available as a hardcopy only.'; end if;
  select booking_days_ahead into booking_limit from public.office_settings where id = 1;
  if new.appointment_date not between (now() at time zone 'Asia/Manila')::date and (now() at time zone 'Asia/Manila')::date + booking_limit
    or extract(isodow from new.appointment_date) >= 6 then raise exception 'Choose an available weekday within the booking window.'; end if;
  if exists (select 1 from public.office_closures where closed_date = new.appointment_date) then raise exception 'The office is closed on the selected date.'; end if;
  select * into slot from public.appointment_slots where label = new.time_slot and active;
  if not found or (new.appointment_date + slot.start_time) at time zone 'Asia/Manila' <= now() then raise exception 'Choose a valid upcoming appointment time.'; end if;
  perform pg_advisory_xact_lock(hashtextextended(new.owner_id::text || ':' || lower(btrim(new.request_type)), 0));
  if exists (select 1 from public.appointment_requests where owner_id = new.owner_id and lower(btrim(request_type)) = lower(btrim(new.request_type)) and status in ('PENDING', 'APPROVED')) then
    raise exception 'You already have an active request for this document. View it in your dashboard.';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(new.appointment_date::text || ':' || new.time_slot, 0));
  if (select count(*) from public.appointment_requests where appointment_date = new.appointment_date and time_slot = new.time_slot and status in ('PENDING', 'APPROVED')) >= slot.capacity then
    raise exception 'This appointment slot is full. Choose another time.';
  end if;
  new.submitted_at := now(); new.rejection_reason := null;
  return new;
end;
$$;
create trigger validate_appointment before insert or update on public.appointment_requests for each row execute function public.validate_appointment_request();

create function public.record_request_event()
returns trigger language plpgsql security definer set search_path = public as $$
declare actor text; description text;
begin
  select first_name || ' ' || last_name into actor from public.resident_profiles where id = auth.uid();
  if TG_OP = 'INSERT' then description := 'Request submitted for staff review.';
  elsif new.status <> old.status then description := case when new.status = 'REJECTED' then new.rejection_reason else 'Request marked ' || lower(new.status) || '.' end;
  elsif new.archived <> old.archived then description := case when new.archived then 'Request archived.' else 'Request restored from archive.' end;
  elsif new.rejection_reason is distinct from old.rejection_reason then description := 'Rejection reason updated: ' || new.rejection_reason;
  else return new; end if;
  insert into public.request_events (request_reference, actor_id, actor_name, status, description)
  values (new.reference, auth.uid(), coalesce(actor, 'Barangay staff'), new.status, description);
  return new;
end;
$$;
create trigger appointment_history after insert or update on public.appointment_requests for each row execute function public.record_request_event();

-- Existing requests get a clearly marked starting point, not invented past transitions.
insert into public.request_events (request_reference, actor_name, status, description)
select reference, 'System', status, 'History tracking enabled. Current status: ' || lower(status) || '.' from public.appointment_requests;

create function public.apply_email_event(p_event_id text, p_email_id text, p_next_status text, p_event_time timestamptz)
returns boolean language plpgsql security definer set search_path = public as $$
declare delivery public.certificate_deliveries;
begin
  select * into delivery from public.certificate_deliveries where provider_id = p_email_id for update;
  if not found then return false; end if;
  insert into public.email_webhook_events (event_id) values (p_event_id) on conflict do nothing;
  if not found then return true; end if;
  if p_next_status not in ('sent', 'delivered', 'delayed', 'bounced', 'failed') then return true; end if;
  if delivery.last_event_at is not null and p_event_time <= delivery.last_event_at then return true; end if;
  if delivery.status in ('bounced', 'failed') and p_next_status not in ('bounced', 'failed') then return true; end if;
  if delivery.status = 'delivered' and p_next_status in ('sent', 'delayed') then return true; end if;
  update public.certificate_deliveries set status = p_next_status, last_event_at = p_event_time, updated_at = now(), error_message = case when p_next_status in ('bounced', 'failed') then 'The email provider reported ' || p_next_status || ' delivery.' else null end where id = delivery.id;
  return true;
end;
$$;
revoke all on function public.apply_email_event(text, text, text, timestamptz) from public, anon, authenticated;
grant execute on function public.apply_email_event(text, text, text, timestamptz) to service_role;

alter publication supabase_realtime add table public.request_events, public.certificate_deliveries, public.service_catalog, public.office_settings, public.appointment_slots, public.office_closures;

commit;
