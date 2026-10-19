begin;

create table public.resident_notifications (
 id uuid primary key default gen_random_uuid(),
 owner_id uuid not null references public.resident_profiles(id) on delete cascade,
 kind text not null,reference text,title text not null,body text not null,
 event_key text not null unique,created_at timestamptz not null default now(),read_at timestamptz
);
create index resident_notifications_owner_created_idx on public.resident_notifications(owner_id,created_at desc,id);
create index resident_notifications_owner_unread_idx on public.resident_notifications(owner_id) where read_at is null;
alter table public.resident_notifications enable row level security;
revoke all on public.resident_notifications from public,anon,authenticated;
grant select on public.resident_notifications to authenticated;
grant all on public.resident_notifications to service_role;
create policy "Residents read only their own notifications" on public.resident_notifications for select to authenticated
 using(owner_id=auth.uid() and exists(select 1 from public.resident_profiles p where p.id=auth.uid() and p.role='resident'));

-- In-app notices are independent of whether the email provider accepts a message.
create function public.create_resident_notification() returns trigger language plpgsql security definer set search_path=public as $$
declare owner uuid;event_kind text;ref text;heading text;message text;key text;event_time timestamptz;
begin
 case TG_TABLE_NAME
 when 'notification_outbox' then
  owner:=new.owner_id;event_kind:=new.kind;ref:=new.reference;heading:=new.subject;message:=new.body;key:='email-event:'||new.id;event_time:=new.created_at;
 when 'fee_records' then
  if new.request_reference is null then return new;end if;
  select owner_id into owner from public.appointment_requests where reference=new.request_reference;
  event_kind:='fee_record';ref:=new.request_reference;heading:='Fee or receipt update';
  message:=case new.status when 'PAID' then 'The office recorded your payment' when 'REFUNDED' then 'The office recorded a refund' when 'VOIDED' then 'The office voided a payment record' when 'EXEMPT' then 'The office recorded a fee exemption' else 'The office recorded a fee waiver' end||': PHP '||new.amount||'. Open your fees and receipts to review it.';
  key:='fee-event:'||new.id;event_time:=new.recorded_at;
 when 'certificate_deliveries' then
  if not new.file_available or new.status not in ('sent','delivered') then return new;end if;
  select owner_id into owner from public.appointment_requests where reference=new.request_reference;
  event_kind:='certificate_pdf';ref:=new.request_reference;heading:='Your certificate PDF is ready';message:='Open your request to view or download the certificate saved by the barangay office.';key:='certificate-pdf:'||new.id;event_time:=new.updated_at;
 else return new;
 end case;
 if owner is null or not exists(select 1 from public.resident_profiles where id=owner and role='resident') then return new;end if;
 insert into public.resident_notifications(owner_id,kind,reference,title,body,event_key,created_at)
 values(owner,event_kind,ref,heading,message,key,event_time) on conflict(event_key) do nothing;
 return new;
end;$$;
revoke all on function public.create_resident_notification() from public,anon,authenticated;
create trigger resident_notice_email_event after insert on public.notification_outbox for each row execute function public.create_resident_notification();
create trigger resident_notice_fee_event after insert on public.fee_records for each row execute function public.create_resident_notification();
create trigger resident_notice_certificate_pdf after insert or update on public.certificate_deliveries for each row execute function public.create_resident_notification();

-- Existing recent updates become visible without re-sending any emails.
insert into public.resident_notifications(owner_id,kind,reference,title,body,event_key,created_at)
select o.owner_id,o.kind,o.reference,o.subject,o.body,'email-event:'||o.id,o.created_at
from public.notification_outbox o join public.resident_profiles p on p.id=o.owner_id
where p.role='resident' and o.created_at>=now()-interval '30 days' on conflict(event_key) do nothing;
insert into public.resident_notifications(owner_id,kind,reference,title,body,event_key,created_at)
select r.owner_id,'fee_record',r.reference,'Fee or receipt update',replace(initcap(lower(f.status)),'_',' ')||': PHP '||f.amount||'. Open your fees and receipts to review it.','fee-event:'||f.id,f.recorded_at
from public.fee_records f join public.appointment_requests r on r.reference=f.request_reference join public.resident_profiles p on p.id=r.owner_id
where p.role='resident' and f.recorded_at>=now()-interval '30 days' on conflict(event_key) do nothing;
insert into public.resident_notifications(owner_id,kind,reference,title,body,event_key,created_at)
select r.owner_id,'certificate_pdf',r.reference,'Your certificate PDF is ready','Open your request to view or download the certificate saved by the barangay office.','certificate-pdf:'||d.id,d.updated_at
from public.certificate_deliveries d join public.appointment_requests r on r.reference=d.request_reference join public.resident_profiles p on p.id=r.owner_id
where p.role='resident' and d.file_available and d.status in ('sent','delivered') and d.updated_at>=now()-interval '30 days' on conflict(event_key) do nothing;

create function public.resident_notification_feed(p_page integer default 0) returns jsonb language plpgsql security invoker set search_path=public as $$
declare result jsonb;
begin
 if auth.uid() is null or not exists(select 1 from public.resident_profiles where id=auth.uid() and role='resident') then raise exception 'Resident sign-in required.' using errcode='42501';end if;
 if p_page is null or p_page<0 or p_page>1000000 then raise exception 'Choose a valid notification page.';end if;
 with own as materialized(select * from public.resident_notifications where owner_id=auth.uid()),ordered as(
  select id,kind,reference,title,body,created_at,read_at is not null as read from own order by created_at desc,id limit 25 offset p_page::bigint*25
 )select jsonb_build_object('unread',(select count(*) from own where read_at is null),'total',(select count(*) from own),
  'rows',coalesce((select jsonb_agg(to_jsonb(ordered)) from ordered),'[]')) into result;
 return result;
end;$$;
create function public.mark_resident_notifications_read(p_ids uuid[] default null) returns integer language plpgsql security definer set search_path=public as $$
declare changed integer;
begin
 if auth.uid() is null or not exists(select 1 from public.resident_profiles where id=auth.uid() and role='resident') then raise exception 'Resident sign-in required.' using errcode='42501';end if;
 if p_ids is not null and cardinality(p_ids)>100 then raise exception 'Choose up to 100 notifications.';end if;
 update public.resident_notifications set read_at=now() where owner_id=auth.uid() and read_at is null and (p_ids is null or id=any(p_ids));
 get diagnostics changed=row_count;return changed;
end;$$;
revoke all on function public.resident_notification_feed(integer),public.mark_resident_notifications_read(uuid[]) from public,anon;
grant execute on function public.resident_notification_feed(integer),public.mark_resident_notifications_read(uuid[]) to authenticated;
alter publication supabase_realtime add table public.resident_notifications;
commit;
