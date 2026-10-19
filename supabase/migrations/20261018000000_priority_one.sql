begin;

create function public.trimmed_input(value text) returns text
language sql immutable set search_path = public as $$
  select regexp_replace(value, '^[[:space:]]+|[[:space:]]+$', '', 'g');
$$;

-- Validate new profiles and edited contact details without rewriting legacy records.
create function public.normalized_contact(value text) returns text
language sql immutable set search_path = public as $$
  select regexp_replace(btrim(coalesce(value, '')), '[[:space:]().-]', '', 'g');
$$;

create function public.validate_resident_profile() returns trigger
language plpgsql set search_path = public as $$
begin
  if TG_OP = 'UPDATE' and row(new.first_name,new.last_name,new.email,new.contact_number,new.address)
    is not distinct from row(old.first_name,old.last_name,old.email,old.contact_number,old.address) then return new; end if;
  new.first_name := public.trimmed_input(new.first_name); new.last_name := public.trimmed_input(new.last_name);
  new.address := public.trimmed_input(new.address); new.email := lower(public.trimmed_input(new.email));
  new.contact_number := public.normalized_contact(new.contact_number);
  if char_length(new.first_name) not between 1 and 100 or char_length(new.last_name) not between 1 and 100
    or char_length(new.address) not between 1 and 500 then
    raise exception 'Enter a first name, last name (up to 100 characters each), and address (up to 500 characters).'; end if;
  if new.contact_number !~ '^\+?[0-9]{7,15}$' then
    raise exception 'Enter a valid contact number with 7 to 15 digits and an optional leading +.'; end if;
  if char_length(new.email) > 254 or new.email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
    raise exception 'Enter a valid email address.'; end if;
  return new;
end;
$$;
create trigger validate_resident_contact before insert or update on public.resident_profiles
for each row execute function public.validate_resident_profile();

create function public.validate_new_concern() returns trigger
language plpgsql set search_path = public as $$
begin
  if new.status <> 'RECEIVED' or new.archived then
    raise exception 'New concerns must start as Received and cannot be archived.'; end if;
  new.name := public.trimmed_input(new.name); new.contact := public.trimmed_input(new.contact); new.message := public.trimmed_input(new.message);
  if char_length(new.name) not between 1 and 200 or char_length(new.contact) not between 1 and 254
    or char_length(new.message) not between 1 and 2000
    or new.category not in ('Service concern','Feedback','Suggestion','Other') then
    raise exception 'Provide a valid name, contact, category, and concern (up to 2000 characters).'; end if;
  new.submitted_at := now();
  return new;
end;
$$;
create trigger validate_concern_submission before insert on public.resident_concerns
for each row execute function public.validate_new_concern();

alter table public.appointment_requests drop constraint appointment_requests_status_check;
alter table public.appointment_requests add constraint appointment_requests_status_check
check (status in ('PENDING','APPROVED','COMPLETED','REJECTED','CANCELLED','NO_SHOW','EXPIRED'));
alter table public.appointment_requests
  add column version integer not null default 1,
  add column status_reason text,
  add column reschedule_reason text,
  add column hardcopy_collected_at timestamptz,
  add column hardcopy_collected_by uuid references public.resident_profiles(id),
  add column hardcopy_collected_name text;
create index appointment_capacity_idx on public.appointment_requests(appointment_date,time_slot)
  where status in ('PENDING','APPROVED');
create index appointment_school_image_idx on public.appointment_requests(school_id_image_path)
  where school_id_image_path is not null;

-- Lock the upload path during both submission and cleanup. Submitted evidence stays private to staff.
create function public.school_id_can_be_removed(p_path text) returns boolean
language plpgsql volatile security definer set search_path = public as $$
begin
  if auth.uid() is null or split_part(p_path,'/',1) <> auth.uid()::text then return false; end if;
  perform pg_advisory_xact_lock(hashtextextended('school-id:' || p_path,0));
  return not exists(select 1 from public.appointment_requests where school_id_image_path=p_path);
end;
$$;
revoke all on function public.school_id_can_be_removed(text) from public, anon;
grant execute on function public.school_id_can_be_removed(text) to authenticated;
drop policy "Residents remove unsubmitted school ID images" on storage.objects;
create policy "Residents read unsubmitted own school ID images" on storage.objects for select to authenticated
using (bucket_id='resident-school-ids' and public.school_id_can_be_removed(name));
create policy "Residents remove unsubmitted school ID images" on storage.objects for delete to authenticated
using (bucket_id='resident-school-ids' and public.school_id_can_be_removed(name));

create function public.request_has_certificate(p_reference text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.certificate_deliveries d join storage.objects o
    on o.bucket_id='completed-certificates' and o.name=d.storage_path where d.request_reference=p_reference);
$$;
revoke all on function public.request_has_certificate(text) from public, anon, authenticated;

create or replace function public.validate_appointment_request() returns trigger
language plpgsql security definer set search_path = public as $$
declare service public.service_catalog; slot public.appointment_slots; booking_limit integer;
  staff boolean := public.is_barangay_staff() or auth.role()='service_role';
  schedule_changed boolean; automatic_expiry boolean := false;
begin
  if TG_OP = 'UPDATE' then
    schedule_changed := row(new.appointment_date,new.time_slot) is distinct from row(old.appointment_date,old.time_slot);
    automatic_expiry := new.status='EXPIRED' and old.status='PENDING'
      and old.appointment_date < (now() at time zone 'Asia/Manila')::date
      and old.hardcopy_collected_at is null and not public.request_has_certificate(old.reference);
    if not staff and not automatic_expiry and not (old.owner_id=auth.uid() and new.status='CANCELLED'
      and old.status in ('PENDING','APPROVED') and not old.archived) then
      raise exception 'Only authorized staff or the cancelling resident can update this request.'; end if;
    if row(new.reference,new.owner_id,new.full_name,new.address,new.voter_id,new.request_type,new.purpose,new.delivery_format,new.submitted_at,new.school_id_image_path)
      is distinct from row(old.reference,old.owner_id,old.full_name,old.address,old.voter_id,old.request_type,old.purpose,old.delivery_format,old.submitted_at,old.school_id_image_path) then
      raise exception 'Submitted identity and document details cannot be changed.'; end if;
    if not staff and row(new.archived,new.hardcopy_collected_at,new.hardcopy_collected_by,new.hardcopy_collected_name,new.reschedule_reason)
      is distinct from row(old.archived,old.hardcopy_collected_at,old.hardcopy_collected_by,old.hardcopy_collected_name,old.reschedule_reason) then
      raise exception 'Only staff can change fulfillment or archive details.'; end if;
    if old.archived and (new.status<>old.status or schedule_changed or new.hardcopy_collected_at is distinct from old.hardcopy_collected_at) and not automatic_expiry then
      raise exception 'Restore the request before changing it.'; end if;
    if new.archived and not old.archived and new.status in ('PENDING','APPROVED') then
      raise exception 'Resolve or cancel an active request before archiving.'; end if;
    if new.status<>old.status and not (
      (old.status='PENDING' and new.status in ('APPROVED','REJECTED','CANCELLED'))
      or (old.status='APPROVED' and new.status in ('COMPLETED','REJECTED','CANCELLED','NO_SHOW'))
      or automatic_expiry) then raise exception 'This request status transition is not allowed.'; end if;
    if new.status in ('REJECTED','CANCELLED','NO_SHOW') and new.status<>old.status then
      if char_length(public.trimmed_input(coalesce(case when new.status='REJECTED' then new.rejection_reason else new.status_reason end,''))) not between 1 and 1000 then
        if new.status='REJECTED' then raise exception 'Provide a rejection reason (1 to 1000 characters).'; end if;
        raise exception 'Provide a reason (1 to 1000 characters).'; end if;
      if old.hardcopy_collected_at is not null or public.request_has_certificate(old.reference) then
        raise exception 'A certificate has already been issued or collected. Contact staff about a correction instead.'; end if;
    end if;
    if new.status='NO_SHOW' and new.status<>old.status then
      select * into slot from public.appointment_slots where label=old.time_slot;
      if not found or ((old.appointment_date+slot.start_time) at time zone 'Asia/Manila') + interval '1 hour' > now() then
        raise exception 'Mark a no-show only after the appointment slot has ended.'; end if;
    end if;
    if row(new.hardcopy_collected_at,new.hardcopy_collected_by,new.hardcopy_collected_name)
      is distinct from row(old.hardcopy_collected_at,old.hardcopy_collected_by,old.hardcopy_collected_name) then
      if not staff or auth.uid() is null or old.status<>'APPROVED' or new.status<>old.status or old.hardcopy_collected_at is not null
        or old.delivery_format not in ('Hardcopy','Both')
        or char_length(public.trimmed_input(coalesce(new.hardcopy_collected_name,''))) not between 1 and 200 then
        raise exception 'Record the recipient of an approved hardcopy request once.'; end if;
      new.hardcopy_collected_at:=now(); new.hardcopy_collected_by:=auth.uid();
      new.hardcopy_collected_name:=public.trimmed_input(new.hardcopy_collected_name);
    end if;
    if new.status='COMPLETED' and new.status<>old.status then
      if new.delivery_format in ('Softcopy','Both') and not public.request_has_certificate(old.reference) then
        raise exception 'Save the completed certificate PDF before completing this request.'; end if;
      if new.delivery_format in ('Hardcopy','Both') and new.hardcopy_collected_at is null then
        raise exception 'Record hardcopy collection before completing this request.'; end if;
    end if;
    if schedule_changed then
      if not staff or old.status not in ('PENDING','APPROVED') or new.status<>old.status
        or old.hardcopy_collected_at is not null or public.request_has_certificate(old.reference)
        or char_length(public.trimmed_input(coalesce(new.reschedule_reason,''))) not between 1 and 1000 then
        raise exception 'Only staff can reschedule an unfulfilled active request, with a reason.'; end if;
    elsif new.reschedule_reason is distinct from old.reschedule_reason then
      raise exception 'A rescheduling reason requires a changed appointment.';
    end if;
    if new.status<>'REJECTED' then new.rejection_reason:=null;
    elsif new.rejection_reason is distinct from old.rejection_reason and char_length(public.trimmed_input(coalesce(new.rejection_reason,''))) not between 1 and 1000 then
      raise exception 'Provide a rejection reason (1 to 1000 characters).'; end if;
    if automatic_expiry then new.status_reason:='The unfulfilled appointment date has passed.'; end if;
    if not automatic_expiry and new.status=old.status and new.status_reason is distinct from old.status_reason then
      raise exception 'A status reason requires a status change.'; end if;
    new.version:=old.version+1;
    if not schedule_changed then return new; end if;
  else
    if new.status<>'PENDING' or new.archived or new.hardcopy_collected_at is not null
      or new.hardcopy_collected_by is not null or new.hardcopy_collected_name is not null then
      raise exception 'New requests must start as Pending without fulfillment or archive details.'; end if;
    if new.reference !~ '^[A-Za-z0-9-]{1,100}$' then raise exception 'The request reference is invalid.'; end if;
    if char_length(public.trimmed_input(new.full_name)) not between 1 and 200 or char_length(public.trimmed_input(new.address)) not between 1 and 500
      or char_length(public.trimmed_input(new.purpose)) not between 1 and 2000 or char_length(public.trimmed_input(new.voter_id)) not between 1 and 300 then
      raise exception 'Provide valid resident details, identification, and purpose.'; end if;
    if lower(regexp_replace(new.voter_id,'[[:space:]_-]','','g')) like 'schoolid:%' and new.school_id_image_path is null then
      raise exception 'Upload the school ID image for staff review.'; end if;
    if new.school_id_image_path is not null then
      if split_part(new.school_id_image_path,'/',1)<>new.owner_id::text
        or split_part(new.school_id_image_path,'/',2)<>new.reference
        or new.school_id_image_path !~ '/school-id\.(jpg|png|webp)$' then
        raise exception 'The school ID upload must belong to this resident and request.'; end if;
      perform pg_advisory_xact_lock(hashtextextended('school-id:' || new.school_id_image_path,0));
      if not exists(select 1 from storage.objects where bucket_id='resident-school-ids' and name=new.school_id_image_path
        and created_at>now()-interval '24 hours') then
        raise exception 'Upload a new School ID image before submitting. The uploaded file is missing or expired.'; end if;
    end if;
    -- Resolve known services before the custom-document fallback, regardless of case or whitespace.
    select * into service from public.service_catalog
      where lower(btrim(regexp_replace(request_type,'[[:space:]]+',' ','g')))=lower(btrim(regexp_replace(new.request_type,'[[:space:]]+',' ','g')));
    if found then
      if not service.active then raise exception 'This document service is unavailable.'; end if;
      new.request_type:=service.request_type;
    else
      select * into service from public.service_catalog where request_type='Other barangay document' and active;
      if not found or char_length(public.trimmed_input(new.request_type)) not between 1 and 200 then
        raise exception 'This document service is unavailable.'; end if;
      new.request_type:=btrim(regexp_replace(new.request_type,'[[:space:]]+',' ','g'));
    end if;
    if new.delivery_format in ('Softcopy','Both') and not service.softcopy_available then
      raise exception 'This document is currently available as a hardcopy only.'; end if;
    perform pg_advisory_xact_lock(hashtextextended(new.owner_id::text || ':' || lower(btrim(new.request_type)),0));
    if exists(select 1 from public.appointment_requests where owner_id=new.owner_id
      and lower(btrim(request_type))=lower(btrim(new.request_type)) and status in ('PENDING','APPROVED')
      and appointment_date >= (now() at time zone 'Asia/Manila')::date) then
      raise exception 'You already have an active request for this document. View it in your dashboard.'; end if;
    new.submitted_at:=now(); new.rejection_reason:=null; new.status_reason:=null; new.reschedule_reason:=null; new.version:=1;
  end if;
  select booking_days_ahead into booking_limit from public.office_settings where id=1;
  if new.appointment_date not between (now() at time zone 'Asia/Manila')::date and (now() at time zone 'Asia/Manila')::date+booking_limit
    or extract(isodow from new.appointment_date)>=6 then raise exception 'Choose an available weekday within the booking window.'; end if;
  if exists(select 1 from public.office_closures where closed_date=new.appointment_date) then
    raise exception 'The office is closed on the selected date.'; end if;
  select * into slot from public.appointment_slots where label=new.time_slot and active;
  if not found or (new.appointment_date+slot.start_time) at time zone 'Asia/Manila'<=now() then
    raise exception 'Choose a valid upcoming appointment time.'; end if;
  perform pg_advisory_xact_lock(hashtextextended(new.appointment_date::text || ':' || new.time_slot,0));
  if (select count(*) from public.appointment_requests where appointment_date=new.appointment_date and time_slot=new.time_slot
    and status in ('PENDING','APPROVED') and reference<>new.reference)>=slot.capacity then
    raise exception 'This appointment slot is full. Choose another time.'; end if;
  return new;
end;
$$;

create function public.manage_appointment(p_reference text,p_action text,p_expected_version integer,
  p_reason text default null,p_date date default null,p_time_slot text default null,p_recipient text default null)
returns public.appointment_requests language plpgsql security definer set search_path = public as $$
declare current_request public.appointment_requests; staff boolean:=public.is_barangay_staff();
begin
  if auth.uid() is null then raise exception 'Sign in to continue.'; end if;
  select * into current_request from public.appointment_requests where reference=p_reference for update;
  if not found or (not staff and current_request.owner_id<>auth.uid()) then raise exception 'Request not found or access denied.'; end if;
  if p_expected_version is null or current_request.version<>p_expected_version then
    raise exception 'This request changed. Refresh its details before trying again.'; end if;
  if not staff and p_action<>'cancel' then raise exception 'Only staff can perform this action.'; end if;
  if current_request.archived then raise exception 'Restore the request before changing it.'; end if;
  if p_action='reschedule' then
    if p_date is null or p_time_slot is null or row(p_date,p_time_slot)=row(current_request.appointment_date,current_request.time_slot) then
      raise exception 'Choose a different appointment date or time.'; end if;
    update public.appointment_requests set appointment_date=p_date,time_slot=p_time_slot,reschedule_reason=public.trimmed_input(p_reason)
      where reference=p_reference returning * into current_request;
  elsif p_action='collect' then
    update public.appointment_requests set hardcopy_collected_at=now(),hardcopy_collected_by=auth.uid(),hardcopy_collected_name=public.trimmed_input(p_recipient)
      where reference=p_reference returning * into current_request;
  elsif p_action in ('approve','reject','complete','cancel','no_show') then
    update public.appointment_requests set status=case p_action when 'approve' then 'APPROVED' when 'reject' then 'REJECTED'
      when 'complete' then 'COMPLETED' when 'cancel' then 'CANCELLED' else 'NO_SHOW' end,
      rejection_reason=case when p_action='reject' then public.trimmed_input(p_reason) else null end,
      status_reason=case when p_action in ('cancel','no_show') then public.trimmed_input(p_reason) else status_reason end
      where reference=p_reference returning * into current_request;
  else raise exception 'Unknown appointment action.'; end if;
  return current_request;
end;
$$;
revoke all on function public.manage_appointment(text,text,integer,text,date,text,text) from public,anon;
grant execute on function public.manage_appointment(text,text,integer,text,date,text,text) to authenticated;

create function public.expire_overdue_appointments() returns integer
language plpgsql security definer set search_path = public as $$
declare affected integer;
begin
  update public.appointment_requests set status='EXPIRED',status_reason='The unfulfilled appointment date has passed.'
    where status='PENDING' and appointment_date<(now() at time zone 'Asia/Manila')::date
    and hardcopy_collected_at is null and not public.request_has_certificate(reference);
  get diagnostics affected=row_count; return affected;
end;
$$;
revoke all on function public.expire_overdue_appointments() from public,anon,authenticated;
grant execute on function public.expire_overdue_appointments() to service_role;

-- Transactional outbox: saving the business record and its notification succeeds or rolls back together.
create table public.notification_outbox (
  id uuid primary key default gen_random_uuid(),
  event_key text not null unique,
  owner_id uuid not null references public.resident_profiles(id),
  reference text not null,
  kind text not null,
  recipient_email text not null,
  subject text not null,
  body text not null,
  status text not null default 'pending' check(status in ('pending','sending','retry','sent','failed','needs_review')),
  attempts integer not null default 0,
  next_attempt_at timestamptz not null default now(),
  first_attempt_at timestamptz,
  lease_token uuid,
  claimed_at timestamptz,
  send_payload jsonb,
  provider_id text,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index notification_ready_idx on public.notification_outbox(next_attempt_at,created_at) where status in ('pending','retry','sending');
create index notification_reference_idx on public.notification_outbox(reference,created_at desc);
alter table public.notification_outbox enable row level security;
revoke all on public.notification_outbox from public,anon,authenticated;
grant select on public.notification_outbox to authenticated;
grant all on public.notification_outbox to service_role;
create policy "Read own notification history or staff" on public.notification_outbox for select to authenticated
using (owner_id=auth.uid() or public.is_barangay_staff());

create function public.enqueue_resident_email(p_key text,p_owner uuid,p_reference text,p_kind text,p_subject text,p_body text)
returns void language plpgsql security definer set search_path = public as $$
begin
  insert into public.notification_outbox(event_key,owner_id,reference,kind,recipient_email,subject,body)
    select p_key,id,p_reference,p_kind,email,p_subject,p_body from public.resident_profiles where id=p_owner
    on conflict(event_key) do nothing;
end;
$$;
revoke all on function public.enqueue_resident_email(text,uuid,text,text,text,text) from public,anon,authenticated;

create or replace function public.record_request_event() returns trigger
language plpgsql security definer set search_path = public as $$
declare actor text; description text; event_id uuid; system_change boolean:=false;
begin
  select first_name || ' ' || last_name into actor from public.resident_profiles where id=auth.uid();
  if TG_OP='INSERT' then description:='Request submitted for staff review.';
  elsif new.status<>old.status then
    system_change:=new.status='EXPIRED';
    description:=case when new.status='REJECTED' then new.rejection_reason when new.status in ('CANCELLED','NO_SHOW','EXPIRED') then new.status_reason else 'Request marked ' || lower(new.status) || '.' end;
  elsif row(new.appointment_date,new.time_slot) is distinct from row(old.appointment_date,old.time_slot) then
    description:='Rescheduled from ' || old.appointment_date || ' ' || old.time_slot || ' to ' || new.appointment_date || ' ' || new.time_slot || '. Reason: ' || new.reschedule_reason;
  elsif new.hardcopy_collected_at is distinct from old.hardcopy_collected_at then description:='Hardcopy collected by ' || new.hardcopy_collected_name || '.';
  elsif new.archived<>old.archived then description:=case when new.archived then 'Request archived.' else 'Request restored from archive.' end;
  elsif new.rejection_reason is distinct from old.rejection_reason then description:='Rejection reason updated: ' || new.rejection_reason;
  else return new; end if;
  insert into public.request_events(request_reference,actor_id,actor_name,status,description)
  values(new.reference,case when system_change then null else auth.uid() end,case when system_change then 'System' else coalesce(actor,'Barangay staff') end,new.status,description)
  returning id into event_id;
  if TG_OP='INSERT' or new.status<>old.status or row(new.appointment_date,new.time_slot) is distinct from row(old.appointment_date,old.time_slot)
    or new.hardcopy_collected_at is distinct from old.hardcopy_collected_at then
    perform public.enqueue_resident_email('request-event:' || event_id,new.owner_id,new.reference,'appointment_update',
      'Appointment update: ' || new.reference,new.request_type || E'\nStatus: ' || replace(new.status,'_',' ') || E'\nAppointment (Asia/Manila): '
      || new.appointment_date || ' ' || new.time_slot || E'\n\n' || description || E'\n\nSign in to the Barangay portal to view your request.');
  end if;
  return new;
end;
$$;

create function public.queue_concern_email() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.status<>old.status then
    perform public.enqueue_resident_email('concern:' || new.reference || ':' || gen_random_uuid(),new.owner_id,new.reference,'concern_status',
      'Concern update: ' || new.reference,'Your concern (' || new.category || ') is now ' || replace(new.status,'_',' ') || E'.\n\nSign in to the Barangay portal to view it.');
  end if; return new;
end;
$$;
create trigger concern_notification after update on public.resident_concerns for each row execute function public.queue_concern_email();

create function public.queue_staff_reply_email() returns trigger
language plpgsql security definer set search_path = public as $$
declare owner uuid;
begin
  if new.author_role='Staff' then
    select owner_id into owner from public.appointment_requests where reference=new.request_reference;
    perform public.enqueue_resident_email('staff-reply:' || new.id,owner,new.request_reference,'staff_reply','New message about request ' || new.request_reference,
      'The Barangay staff sent you a message:' || E'\n\n' || new.body || E'\n\nSign in to the Barangay portal to reply.');
  end if; return new;
end;
$$;
create trigger staff_reply_notification after insert on public.transaction_messages for each row execute function public.queue_staff_reply_email();

create function public.notification_worker_access() returns boolean language sql as $$ select true $$;
revoke all on function public.notification_worker_access() from public,anon,authenticated;
grant execute on function public.notification_worker_access() to service_role;

create function public.claim_notifications(p_sender text,p_limit integer default 5)
returns setof public.notification_outbox language plpgsql security definer set search_path = public as $$
begin
  if p_sender is null or char_length(p_sender) not between 3 and 320 then raise exception 'Configure the email sender.'; end if;
  update public.notification_outbox set status='needs_review',lease_token=null,updated_at=now(),
    last_error='The safe email retry window has ended. Check provider logs before sending again.'
    where status in ('pending','retry','sending','failed') and first_attempt_at<=now()-interval '23 hours';
  update public.notification_outbox set status='failed',lease_token=null,updated_at=now(),last_error='The worker stopped during its final attempt. Review or retry this notification.'
    where status='sending' and claimed_at<now()-interval '5 minutes' and attempts>=6;
  return query with ready as (
    select id from public.notification_outbox where attempts<6 and (
      (status in ('pending','retry') and next_attempt_at<=now()) or (status='sending' and claimed_at<now()-interval '5 minutes'))
      order by created_at,id for update skip locked limit greatest(1,least(p_limit,5))
  ) update public.notification_outbox o set status='sending',attempts=o.attempts+1,lease_token=gen_random_uuid(),claimed_at=now(),
    first_attempt_at=coalesce(o.first_attempt_at,now()),updated_at=now(),
    send_payload=coalesce(o.send_payload,jsonb_build_object('from',p_sender,'to',jsonb_build_array(o.recipient_email),'subject',o.subject,'text',o.body))
    from ready where o.id=ready.id returning o.*;
end;
$$;
revoke all on function public.claim_notifications(text,integer) from public,anon,authenticated;
grant execute on function public.claim_notifications(text,integer) to service_role;

create function public.finish_notification(p_id uuid,p_lease uuid,p_provider_id text default null,p_error text default null)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  update public.notification_outbox set provider_id=p_provider_id,
    status=case when p_provider_id is not null then 'sent' when attempts>=6 then 'failed' else 'retry' end,
    next_attempt_at=now()+make_interval(secs=>least(3600,30*power(2,attempts)::integer)),last_error=left(p_error,1000),lease_token=null,updated_at=now()
    where id=p_id and status='sending' and lease_token=p_lease;
  return found;
end;
$$;
revoke all on function public.finish_notification(uuid,uuid,text,text) from public,anon,authenticated;
grant execute on function public.finish_notification(uuid,uuid,text,text) to service_role;

create function public.retry_notification(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare job public.notification_outbox;
begin
  if not public.is_barangay_staff() then raise exception 'Only staff can retry notifications.'; end if;
  select * into job from public.notification_outbox where id=p_id for update;
  if not found then raise exception 'Notification not found.'; end if;
  if job.status in ('sent','needs_review') or job.first_attempt_at<=now()-interval '23 hours' then
    raise exception 'Check the provider delivery logs. This notification cannot be safely sent again.'; end if;
  if job.status='sending' and job.claimed_at>=now()-interval '5 minutes' then raise exception 'This notification is already being sent.'; end if;
  update public.notification_outbox set status='pending',attempts=0,next_attempt_at=now(),lease_token=null,last_error=null,updated_at=now() where id=p_id;
end;
$$;
revoke all on function public.retry_notification(uuid) from public,anon;
grant execute on function public.retry_notification(uuid) to authenticated;

-- List only old, unused uploads. The worker deletes them through Storage's API, never by deleting metadata in SQL.
create function public.orphan_school_id_paths() returns table(path text)
language sql security definer set search_path = public as $$
  select o.name from storage.objects o where o.bucket_id='resident-school-ids' and o.created_at<=now()-interval '24 hours'
    and not exists(select 1 from public.appointment_requests r where r.school_id_image_path=o.name)
    order by o.created_at limit 50;
$$;
revoke all on function public.orphan_school_id_paths() from public,anon,authenticated;
grant execute on function public.orphan_school_id_paths() to service_role;

alter publication supabase_realtime add table public.notification_outbox;
commit;
