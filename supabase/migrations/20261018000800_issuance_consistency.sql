begin;
create function public.protect_registered_issuance() returns trigger language plpgsql security definer set search_path=public as $$
begin
 if new.status is distinct from old.status and new.status in ('CANCELLED','REJECTED','NO_SHOW','EXPIRED') and exists(select 1 from public.certificate_register where request_reference=new.reference and status='ISSUED') then raise exception 'Revoke the issued certificate with its reason before closing this appointment without fulfillment.';end if;
 return new;
end;
$$;
create trigger protect_registered_issuance before update on public.appointment_requests for each row execute function public.protect_registered_issuance();
create function public.protect_registered_walk_in() returns trigger language plpgsql security definer set search_path=public as $$
begin
 if new.status='CANCELLED' and old.status<>'CANCELLED' and exists(select 1 from public.certificate_register where walk_in_id=new.id and status='ISSUED') then raise exception 'Revoke the issued certificate before cancelling this walk-in.';end if;return new;
end;
$$;
create trigger protect_registered_walk_in before update on public.walk_in_transactions for each row execute function public.protect_registered_walk_in();
create index concern_messages_thread_idx on public.concern_messages(reference,created_at,id);
create index concern_events_thread_idx on public.concern_events(reference,created_at,id);
create index notification_reads_notice_idx on public.staff_notification_reads(notification_id);
create index queue_appointment_idx on public.appointment_requests(appointment_date,time_slot,reference) where not archived;
create index walkin_created_idx on public.walk_in_transactions(created_at,id);
create index certificate_register_request_idx on public.certificate_register(request_reference,issued_at);
create index fee_records_request_idx on public.fee_records(request_reference,recorded_at);
commit;
