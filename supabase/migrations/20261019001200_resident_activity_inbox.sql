begin;

-- One notification per source event, including when pending work is reconciled.
alter table public.staff_notifications add column event_key text unique;
create index staff_notifications_permission_created_idx on public.staff_notifications(permission,created_at desc,id);

create function public.notify_resident_activity() returns trigger
language plpgsql security definer set search_path=public as $$
declare access_key text;event_kind text;ref text;heading text;message text;event_id text;
begin
 case TG_TABLE_NAME
 when 'resident_profiles' then
  if new.role<>'resident' then return new;end if;
  access_key:='residents';ref:=new.id::text;event_kind:='resident_profile';
  if TG_OP='INSERT' then
   if exists(select 1 from auth.users where id=new.id and invited_at is not null) then return new;end if;
   event_kind:='resident_account';heading:='New resident account';message:=new.first_name||' '||new.last_name||' registered a resident account.';
  else
   if row(new.first_name,new.last_name,new.email,new.contact_number,new.address) is not distinct from row(old.first_name,old.last_name,old.email,old.contact_number,old.address) then return new;end if;
   heading:='Resident profile updated';message:=new.first_name||' '||new.last_name||' updated their account or contact details.';
  end if;
  event_id:=event_kind||':'||ref||':'||new.revision;
 when 'resident_evidence' then
  access_key:='residents';event_kind:='verification_evidence';ref:=new.resident_id::text;
  heading:='Resident verification evidence uploaded';message:=initcap(new.kind)||': '||new.label;event_id:='resident-evidence:'||new.id;
 when 'request_attachments' then
  if new.status<>'SUBMITTED' then return new;end if;
  access_key:='requests';event_kind:='document_upload';ref:=new.request_reference;
  heading:=case when new.replaces is null then 'Supporting document uploaded' else 'Replacement document uploaded' end;
  message:=new.requirement_title||' is ready for review.';event_id:='request-attachment:'||new.id;
 when 'appointment_requests' then
  if new.owner_id is distinct from auth.uid() or new.status<>'CANCELLED' or old.status=new.status then return new;end if;
  access_key:='requests';event_kind:='resident_cancellation';ref:=new.reference;
  heading:='Resident cancelled a booking';message:=new.full_name||': '||new.request_type;event_id:='resident-cancellation:'||ref||':'||new.version;
 when 'chatbot_questions' then
  -- The initial question is pending while Banoy answers. Notify after the result,
  -- or when the resident marks an answer unhelpful, rather than on every ask.
  if new.resolved or (new.answered and new.helpful is distinct from false) or (new.answered_at is null and new.helpful is distinct from false) then return new;end if;
  if not exists(select 1 from public.resident_profiles where id=new.owner_id and role='resident') then return new;end if;
  access_key:='knowledge';event_kind:='banoy_review';ref:=new.id::text;heading:='Banoy question needs review';message:=left(new.question,200);event_id:='banoy-review:'||new.id;
 when 'fee_records' then
  access_key:='payments';event_kind:='fee_record';ref:=coalesce(new.request_reference,(select reference from public.walk_in_transactions where id=new.walk_in_id));
  heading:='Fee or receipt record updated';message:=replace(initcap(lower(new.status)),'_',' ')||': PHP '||new.amount;event_id:='fee-record:'||new.id;
 when 'certificate_register' then
  access_key:='certificates';event_kind:='certificate_record';ref:=coalesce(new.request_reference,(select reference from public.walk_in_transactions where id=new.walk_in_id));
  heading:='Certificate record updated';message:=new.register_number||': '||lower(new.status);event_id:='certificate-record:'||new.id||':'||new.version;
 else return new;
 end case;
 insert into public.staff_notifications(permission,kind,reference,title,body,event_key)
 values(access_key,event_kind,ref,heading,message,event_id) on conflict(event_key) do nothing;
 return new;
end;$$;
revoke all on function public.notify_resident_activity() from public,anon,authenticated;
create trigger notify_resident_accounts after insert or update on public.resident_profiles for each row execute function public.notify_resident_activity();
create trigger notify_resident_evidence after insert on public.resident_evidence for each row execute function public.notify_resident_activity();
create trigger notify_request_uploads after insert on public.request_attachments for each row execute function public.notify_resident_activity();
create trigger notify_resident_cancellation after update of status on public.appointment_requests for each row execute function public.notify_resident_activity();
create trigger notify_banoy_review after insert or update on public.chatbot_questions for each row execute function public.notify_resident_activity();
create trigger notify_fee_records after insert on public.fee_records for each row execute function public.notify_resident_activity();
create trigger notify_certificate_records after insert or update on public.certificate_register for each row execute function public.notify_resident_activity();

-- Bring existing pending work into the same inbox, keeping its original date.
insert into public.staff_notifications(permission,kind,reference,title,body,event_key,created_at)
select 'requests','document_upload',a.request_reference,'Supporting document needs review',a.requirement_title,'request-attachment:'||a.id,a.created_at
from public.request_attachments a join public.appointment_requests r on r.reference=a.request_reference
where a.status='SUBMITTED' and r.status in ('PENDING','APPROVED') and not r.archived on conflict(event_key) do nothing;
insert into public.staff_notifications(permission,kind,reference,title,body,event_key,created_at)
select 'residents','verification_evidence',e.resident_id::text,'Resident verification evidence needs review',initcap(e.kind)||': '||e.label,'resident-evidence:'||e.id,e.created_at
from public.resident_evidence e where not exists(select 1 from public.resident_verifications v where v.resident_id=e.resident_id and v.kind=e.kind and v.status in ('verified','rejected','needs_correction') and v.reviewed_at>=e.created_at)
on conflict(event_key) do nothing;
insert into public.staff_notifications(permission,kind,reference,title,body,event_key,created_at)
select 'knowledge','banoy_review',q.id::text,'Banoy question needs review',left(q.question,200),'banoy-review:'||q.id,q.created_at
from public.chatbot_questions q join public.resident_profiles p on p.id=q.owner_id
where p.role='resident' and not q.resolved and (not q.answered or q.helpful=false) on conflict(event_key) do nothing;

-- Defaults retain compatibility with callers supplying only page and unread.
drop function public.staff_inbox(integer,boolean);
create function public.staff_inbox(p_page integer default 0,p_unread boolean default false,p_query text default '',p_sort text default 'newest',p_feature text default '') returns jsonb
language plpgsql security definer set search_path=public as $$
declare result jsonb;
begin
 if not public.is_barangay_staff() then raise exception 'Staff sign-in required.' using errcode='42501';end if;
 if p_page is null or p_page<0 or p_page>1000000 or char_length(coalesce(p_query,''))>200 then raise exception 'Choose a valid inbox page and search up to 200 characters.';end if;
 if p_sort is null or p_sort not in ('newest','oldest','unread_first','name_asc','name_desc') then raise exception 'Choose an available inbox sort order.';end if;
 if p_feature is null or p_feature not in ('','requests','concerns','residents','knowledge','payments','certificates','schedules','settings','content','reports','audit') then raise exception 'Choose an available inbox feature.';end if;
 with accessible as materialized(
  select n.*,exists(select 1 from public.staff_notification_reads r where r.notification_id=n.id and r.user_id=auth.uid()) as read
  from public.staff_notifications n where public.has_staff_permission(n.permission)
 ),matched as materialized(
  select * from accessible where (not coalesce(p_unread,false) or not read) and (p_feature='' or permission=p_feature)
   and strpos(lower(concat_ws(' ',title,body,reference)),lower(btrim(coalesce(p_query,''))))>0
 ),ordered as(
  select * from matched order by
   case when p_sort='unread_first' then read end asc,
   case when p_sort='name_asc' then lower(title) end asc,
   case when p_sort='name_desc' then lower(title) end desc,
   case when p_sort='oldest' then created_at end asc,
   case when p_sort in ('newest','unread_first') then created_at end desc,
   created_at desc,id limit 25 offset p_page::bigint*25
 )select jsonb_build_object('unread',(select count(*) from accessible where not read),'total',(select count(*) from matched),
  'rows',coalesce((select jsonb_agg(to_jsonb(ordered)-'event_key') from ordered),'[]')) into result;
 return result;
end;$$;
revoke all on function public.staff_inbox(integer,boolean,text,text,text) from public,anon;
grant execute on function public.staff_inbox(integer,boolean,text,text,text) to authenticated;
commit;
