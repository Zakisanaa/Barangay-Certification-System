-- Every new appointment needs its own private ID image, regardless of ID type.
-- Existing bookings keep their original records and can still be processed.
begin;

-- Use the configured weekdays and actual slot ending times consistently in booking and no-show checks.
create or replace function public.validate_appointment_request() returns trigger
language plpgsql security definer set search_path = public as $$
declare service public.service_catalog; slot public.appointment_slots; booking_limit integer;
  staff boolean := public.is_barangay_staff() or auth.role()='service_role';
  schedule_changed boolean; automatic_expiry boolean := false;
begin
  perform pg_advisory_xact_lock_shared(hashtextextended('barangay-booking-configuration',0));
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
      if not found or (old.appointment_date+slot.end_time) at time zone 'Asia/Manila' > now() then
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
    if nullif(btrim(new.school_id_image_path),'') is null then
      raise exception 'Attach an image of your valid ID before booking an appointment.'; end if;
    if new.school_id_image_path is not null then
      if split_part(new.school_id_image_path,'/',1)<>new.owner_id::text
        or split_part(new.school_id_image_path,'/',2)<>new.reference
        or new.school_id_image_path !~ '/school-id\.(jpg|png|webp)$' then
        raise exception 'The ID upload must belong to this resident and request.'; end if;
      perform pg_advisory_xact_lock(hashtextextended('school-id:' || new.school_id_image_path,0));
      if not exists(select 1 from storage.objects where bucket_id='resident-school-ids' and name=new.school_id_image_path
        and created_at>now()-interval '24 hours') then
        raise exception 'Upload a new ID image before submitting. The uploaded file is missing or expired.'; end if;
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
    or not exists(select 1 from public.office_weekdays where iso_day=extract(isodow from new.appointment_date) and open) then raise exception 'Choose an available weekday within the booking window.'; end if;
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

commit;
