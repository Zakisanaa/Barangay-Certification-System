begin;
create function public.staff_directory() returns table(user_id uuid,name text,email text,active boolean,superadmin boolean,permissions text[],version integer,email_confirmed boolean)
language plpgsql security definer set search_path=public as $$
begin
 if not public.is_barangay_staff() then raise exception 'Staff access required.';end if;
 return query select p.id,p.first_name||' '||p.last_name,case when public.is_superadmin() then p.email else null end,a.active,a.superadmin,a.permissions,a.version,u.email_confirmed_at is not null
 from public.staff_access a join public.resident_profiles p on p.id=a.user_id join auth.users u on u.id=p.id where public.is_superadmin() or a.active order by p.last_name,p.first_name;
end;
$$;
revoke all on function public.staff_directory() from public,anon;
grant execute on function public.staff_directory() to authenticated;

create view public.admin_report_rows as
 select 'requests'::text report,r.reference id,r.submitted_at created_at,jsonb_build_object('reference',r.reference,'resident',r.full_name,'service',r.request_type,'status',r.status,'appointment_date',r.appointment_date,'time',r.time_slot,'format',r.delivery_format,'archived',r.archived,'checked_in_at',r.checked_in_at,'assigned_staff',p.first_name||' '||p.last_name,'processing_hours',case when r.status='COMPLETED' then (select round(extract(epoch from(min(e.created_at)-r.submitted_at))/3600,2) from public.request_events e where e.request_reference=r.reference and e.status='COMPLETED' and e.description='Request marked completed.') else null end) data
 from public.appointment_requests r left join public.resident_profiles p on p.id=r.assigned_to
 union all select 'certificates',c.id::text,c.issued_at,jsonb_build_object('register_number',c.register_number,'official_number',c.official_number,'request_reference',c.request_reference,'walk_in_id',c.walk_in_id,'signatory',c.signatory,'status',c.status,'issued_at',c.issued_at,'issued_by',p.first_name||' '||p.last_name,'replaces',c.replaces,'revocation_reason',c.revocation_reason) from public.certificate_register c left join public.resident_profiles p on p.id=c.issued_by
 union all select 'fees',f.id::text,f.recorded_at,jsonb_build_object('request_reference',f.request_reference,'walk_in_id',f.walk_in_id,'amount',f.amount,'currency',f.currency,'status',f.status,'receipt_reference',f.receipt_reference,'note',f.note,'recorded_by',p.first_name||' '||p.last_name,'recorded_at',f.recorded_at,'previous_record',f.previous_record) from public.fee_records f left join public.resident_profiles p on p.id=f.recorded_by
 union all select 'concerns',c.reference,c.submitted_at,jsonb_build_object('reference',c.reference,'category',c.category,'resident',c.name,'status',c.status,'archived',c.archived,'submitted_at',c.submitted_at,'resolution_note',c.resolution_note) from public.resident_concerns c
 union all select 'walk_ins',w.reference,w.created_at,jsonb_build_object('reference',w.reference,'resident',w.full_name,'service',w.request_type,'status',w.status,'assigned_staff',p.first_name||' '||p.last_name,'created_at',w.created_at,'completed_at',w.completed_at) from public.walk_in_transactions w left join public.resident_profiles p on p.id=w.assigned_to;
revoke all on public.admin_report_rows from public,anon,authenticated;
create function public.get_operational_report(p_report text,p_from date,p_to date,p_offset integer default 0,p_limit integer default 100) returns jsonb
language plpgsql security definer set search_path=public as $$
declare result jsonb;first_time timestamptz:=p_from::timestamp at time zone 'Asia/Manila';last_time timestamptz:=(p_to+1)::timestamp at time zone 'Asia/Manila';
begin
 perform public.require_staff_permission('reports');
 if p_from is null or p_to is null or p_to<p_from or p_to-p_from>366 then raise exception 'Choose a reporting range of up to one year.';end if;
 if p_offset is null or p_limit is null or p_offset<0 or p_limit not between 1 and 200 then raise exception 'Invalid report page.';end if;
 if p_report='workload' then
 with transactions as (
 select assigned_to,status,'appointment' source from public.appointment_requests where submitted_at>=first_time and submitted_at<last_time
 union all select assigned_to,status,'walk_in' from public.walk_in_transactions where created_at>=first_time and created_at<last_time
 ), grouped as (
 select p.id,p.last_name,p.first_name,jsonb_build_object('staff',coalesce(p.first_name||' '||p.last_name,'Unassigned'),'requests',count(*) filter(where r.source='appointment'),'walk_ins',count(*) filter(where r.source='walk_in'),'completed',count(*) filter(where r.status='COMPLETED'),'pending',count(*) filter(where r.status in ('PENDING','WAITING')),'approved_or_in_progress',count(*) filter(where r.status in ('APPROVED','IN_PROGRESS')),'no_shows',count(*) filter(where r.status='NO_SHOW')) data
 from transactions r left join public.resident_profiles p on p.id=r.assigned_to group by p.id,p.first_name,p.last_name)
 select jsonb_build_object('total',(select count(*) from grouped),'rows',coalesce(jsonb_agg(data),'[]')) into result from(select data from grouped order by last_name nulls last,first_name,id limit p_limit offset p_offset)s;
 return result;
 end if;
 if p_report not in ('requests','certificates','fees','concerns','walk_ins') then raise exception 'Unknown report.';end if;
 select jsonb_build_object('total',(select count(*) from public.admin_report_rows where report=p_report and created_at>=first_time and created_at<last_time),'rows',coalesce(jsonb_agg(data),'[]')) into result
 from(select data from public.admin_report_rows where report=p_report and created_at>=first_time and created_at<last_time order by created_at,id limit p_limit offset p_offset)s;
 return result;
end;
$$;
revoke all on function public.get_operational_report(text,date,date,integer,integer) from public,anon;
grant execute on function public.get_operational_report(text,date,date,integer,integer) to authenticated;

create function public.notify_closure_impact() returns trigger language plpgsql security definer set search_path=public as $$
declare item public.appointment_requests;
begin
 if TG_OP='UPDATE' then if new.reason=old.reason then return new;end if;end if;
 for item in select * from public.appointment_requests where appointment_date=new.closed_date and status in ('PENDING','APPROVED') loop
 perform public.enqueue_resident_email('closure:'||item.reference||':'||gen_random_uuid(),item.owner_id,item.reference,'office_closure','Office closure affects your appointment',new.closed_date||': '||new.reason||E'\nPlease contact staff to arrange another schedule. Your appointment has not automatically moved.');
 end loop;
 insert into public.staff_notifications(permission,kind,reference,title,body) values('requests','closure',new.closed_date::text,'Review appointments affected by closure',new.reason);
 return new;
end;
$$;
create trigger notify_closure_impact after insert or update on public.office_closures for each row execute function public.notify_closure_impact();

drop policy "Participants and staff read request messages" on public.transaction_messages;
create policy "Permitted request conversations" on public.transaction_messages for select to authenticated using(public.has_staff_permission('requests') or exists(select 1 from public.appointment_requests r where r.reference=request_reference and r.owner_id=auth.uid()));
drop policy "Participants send request messages" on public.transaction_messages;
create policy "Authorized conversation senders" on public.transaction_messages for insert to authenticated with check(author_id=auth.uid() and ((author_role='Staff' and public.has_staff_permission('requests')) or (author_role='Resident' and exists(select 1 from public.appointment_requests r where r.reference=request_reference and r.owner_id=auth.uid()))));
create function public.stamp_request_message() returns trigger language plpgsql security definer set search_path=public as $$
begin
 if new.author_id<>auth.uid() then raise exception 'Send messages as your own account.';end if;
 select first_name||' '||last_name into new.author_name from public.resident_profiles where id=auth.uid();
 new.author_role:=case when public.has_staff_permission('requests') then 'Staff' else 'Resident' end;
 new.sent_at:=now();return new;
end;
$$;
create trigger stamp_request_message before insert on public.transaction_messages for each row execute function public.stamp_request_message();
drop policy "Read own request history or staff" on public.request_events;
create policy "Authorized request history" on public.request_events for select to authenticated using(public.has_staff_permission('requests') or public.has_staff_permission('certificates') or exists(select 1 from public.appointment_requests r where r.reference=request_reference and r.owner_id=auth.uid()));
drop policy "Read own certificate history or staff" on public.certificate_deliveries;
create policy "Authorized certificate history" on public.certificate_deliveries for select to authenticated using(owner_id=auth.uid() or public.has_staff_permission('certificates'));
drop policy "Read own notification history or staff" on public.notification_outbox;
create policy "Authorized notification history" on public.notification_outbox for select to authenticated using(owner_id=auth.uid() or (kind like 'concern%' and public.has_staff_permission('concerns')) or (kind='certificate_register' and public.has_staff_permission('certificates')) or (kind='verification' and public.has_staff_permission('residents')) or (kind not like 'concern%' and kind not in ('certificate_register','verification') and public.has_staff_permission('requests')));
create or replace function public.retry_notification(p_id uuid) returns void language plpgsql security definer set search_path=public as $$
declare job public.notification_outbox;
begin
 select * into job from public.notification_outbox where id=p_id for update;
 if not found then raise exception 'Notification not found.';end if;
 if not public.has_staff_permission(case when job.kind like 'concern%' then 'concerns' when job.kind='certificate_register' then 'certificates' when job.kind='verification' then 'residents' else 'requests' end) then raise exception 'Only staff with appropriate permission can retry notifications.';end if;
 if job.status in ('sent','needs_review') or job.first_attempt_at<=now()-interval '23 hours' then raise exception 'Check the provider delivery logs. This notification cannot be safely sent again.';end if;
 if job.status='sending' and job.claimed_at>=now()-interval '5 minutes' then raise exception 'This notification is already being sent.';end if;
 update public.notification_outbox set status='pending',attempts=0,next_attempt_at=now(),lease_token=null,last_error=null,updated_at=now() where id=p_id;
end;
$$;

-- Policies defined as ALL also grant reads, so replace them with separate scoped policies.
drop policy "Anyone can read published announcements" on public.public_posts;
drop policy "Staff manage announcements" on public.public_posts;
create policy "Public published announcements" on public.public_posts for select to anon,authenticated using(not archived or public.has_staff_permission('content'));
create policy "Permitted announcement inserts" on public.public_posts for insert to authenticated with check(public.has_staff_permission('content'));
create policy "Permitted announcement updates" on public.public_posts for update to authenticated using(public.has_staff_permission('content')) with check(public.has_staff_permission('content'));
drop policy "Anyone can read active walk-in schedule" on public.walk_in_shifts;
drop policy "Staff manage walk-in schedule" on public.walk_in_shifts;
create policy "Public active shifts" on public.walk_in_shifts for select to anon,authenticated using(active or public.has_staff_permission('schedules'));
create policy "Permitted shift inserts" on public.walk_in_shifts for insert to authenticated with check(public.has_staff_permission('schedules'));
create policy "Permitted shift updates" on public.walk_in_shifts for update to authenticated using(public.has_staff_permission('schedules')) with check(public.has_staff_permission('schedules'));

drop policy "Staff view school ID images" on storage.objects;
create policy "Permitted staff review school IDs" on storage.objects for select to authenticated using(bucket_id='resident-school-ids' and (public.has_staff_permission('requests') or public.has_staff_permission('residents')));
grant select on public.certificate_templates,public.service_requirements,public.staff_access to service_role;
drop policy "Staff read Banoy knowledge" on public.chatbot_knowledge;
drop policy "Staff add approved Banoy knowledge" on public.chatbot_knowledge;
drop policy "Staff edit custom Banoy knowledge" on public.chatbot_knowledge;
drop policy "Staff review Banoy questions" on public.chatbot_questions;
drop policy "Staff resolve Banoy questions" on public.chatbot_questions;
create policy "Permitted knowledge reading" on public.chatbot_knowledge for select to authenticated using(public.has_staff_permission('knowledge'));
create policy "Permitted custom knowledge creation" on public.chatbot_knowledge for insert to authenticated with check(public.has_staff_permission('knowledge') and source_key is null);
create policy "Permitted custom knowledge updates" on public.chatbot_knowledge for update to authenticated using(public.has_staff_permission('knowledge') and source_key is null) with check(public.has_staff_permission('knowledge') and source_key is null);
create policy "Own questions or permitted knowledge reviewers" on public.chatbot_questions for select to authenticated using(owner_id=auth.uid() or public.has_staff_permission('knowledge'));
create policy "Permitted question resolution" on public.chatbot_questions for update to authenticated using(public.has_staff_permission('knowledge')) with check(public.has_staff_permission('knowledge'));
drop policy "Staff upload announcement photos" on storage.objects;
drop policy "Staff read announcement photos" on storage.objects;
drop policy "Staff remove unused announcement photos" on storage.objects;
create policy "Content staff upload photos" on storage.objects for insert to authenticated with check(bucket_id='announcement-images' and public.has_staff_permission('content'));
create policy "Content staff read photos" on storage.objects for select to authenticated using(bucket_id='announcement-images' and public.has_staff_permission('content'));
create policy "Content staff remove unused photos" on storage.objects for delete to authenticated using(bucket_id='announcement-images' and public.has_staff_permission('content') and not exists(select 1 from public.public_posts where image_path=name));
drop policy "Barangay staff can read completed certificates" on storage.objects;
create policy "Certificate staff read completed PDFs" on storage.objects for select to authenticated using(bucket_id='completed-certificates' and public.has_staff_permission('certificates'));

create function public.staff_inbox(p_page integer default 0,p_unread boolean default false) returns jsonb
language plpgsql security definer set search_path=public as $$
declare result jsonb;
begin
 if not public.is_barangay_staff() then raise exception 'Staff sign-in required.';end if;
 if p_page<0 then raise exception 'Invalid inbox page.';end if;
 select jsonb_build_object('unread',(select count(*) from public.staff_notifications n where public.has_staff_permission(n.permission) and not exists(select 1 from public.staff_notification_reads r where r.notification_id=n.id and r.user_id=auth.uid())),
 'total',(select count(*) from public.staff_notifications n where public.has_staff_permission(n.permission) and (not p_unread or not exists(select 1 from public.staff_notification_reads r where r.notification_id=n.id and r.user_id=auth.uid()))),
 'rows',coalesce(jsonb_agg(item),'[]')) into result from(
 select to_jsonb(n)||jsonb_build_object('read',exists(select 1 from public.staff_notification_reads r where r.notification_id=n.id and r.user_id=auth.uid())) item
 from public.staff_notifications n where public.has_staff_permission(n.permission) and (not p_unread or not exists(select 1 from public.staff_notification_reads r where r.notification_id=n.id and r.user_id=auth.uid())) order by n.created_at desc,n.id limit 25 offset p_page*25)s;return result;
end;
$$;
create function public.mark_staff_notifications_read(p_ids uuid[]) returns integer language plpgsql security definer set search_path=public as $$
declare n integer;
begin
 if not public.is_barangay_staff() or cardinality(p_ids)>100 then raise exception 'Choose up to 100 accessible notifications.';end if;
 insert into public.staff_notification_reads(user_id,notification_id) select auth.uid(),id from public.staff_notifications where id=any(p_ids) and public.has_staff_permission(permission) on conflict do nothing;get diagnostics n=row_count;return n;
end;
$$;
revoke all on function public.staff_inbox(integer,boolean),public.mark_staff_notifications_read(uuid[]) from public,anon;
grant execute on function public.staff_inbox(integer,boolean),public.mark_staff_notifications_read(uuid[]) to authenticated;
create function public.find_office_transaction(p_reference text) returns jsonb language plpgsql security definer set search_path=public as $$
declare result jsonb;
begin
 if not(public.has_staff_permission('requests') or public.has_staff_permission('certificates') or public.has_staff_permission('payments')) then raise exception 'Transaction access required.';end if;
 select jsonb_build_object('kind','appointment','id',r.reference,'reference',r.reference,'resident',r.full_name,'service',r.request_type,'status',r.status) into result from public.appointment_requests r where r.reference=btrim(p_reference);
 if result is null then select jsonb_build_object('kind','walk_in','id',w.id,'reference',w.reference,'resident',w.full_name,'service',w.request_type,'status',w.status) into result from public.walk_in_transactions w where w.reference=btrim(p_reference);end if;
 if result is null then raise exception 'No appointment or walk-in matches this reference.';end if;return result;
end;
$$;
create function public.appointment_queue(p_from date,p_to date,p_page integer default 0,p_overdue boolean default false,p_finished boolean default false) returns jsonb
language plpgsql security definer set search_path=public as $$
declare result jsonb;
begin
 perform public.require_staff_permission('requests');
 if p_from is null or p_to is null or p_to<p_from or p_to-p_from>31 or p_page<0 then raise exception 'Choose a queue range of up to 31 days.';end if;
 select jsonb_build_object('total',(select count(*) from public.appointment_requests r where not r.archived and (p_finished or r.status in ('PENDING','APPROVED')) and case when p_overdue then r.appointment_date<(now() at time zone 'Asia/Manila')::date else r.appointment_date between p_from and p_to end),
 'rows',coalesce(jsonb_agg(item),'[]')) into result from(
 select to_jsonb(r)||jsonb_build_object('assigned_name',p.first_name||' '||p.last_name) item from public.appointment_requests r
 left join public.appointment_slots s on s.label=r.time_slot left join public.resident_profiles p on p.id=r.assigned_to
 where not r.archived and (p_finished or r.status in ('PENDING','APPROVED')) and case when p_overdue then r.appointment_date<(now() at time zone 'Asia/Manila')::date else r.appointment_date between p_from and p_to end
 order by r.appointment_date,s.start_time,r.reference limit 25 offset p_page*25)s;return result;
end;
$$;
revoke all on function public.find_office_transaction(text),public.appointment_queue(date,date,integer,boolean,boolean) from public,anon;
grant execute on function public.find_office_transaction(text),public.appointment_queue(date,date,integer,boolean,boolean) to authenticated;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('official-images','official-images',true,5242880,array['image/jpeg','image/png','image/webp']);
create policy "Content staff upload official photos" on storage.objects for insert to authenticated with check(bucket_id='official-images' and public.has_staff_permission('content'));
create policy "Content staff read official photo objects" on storage.objects for select to authenticated using(bucket_id='official-images' and public.has_staff_permission('content'));
create policy "Content staff remove unused official photos" on storage.objects for delete to authenticated using(bucket_id='official-images' and public.has_staff_permission('content') and not exists(select 1 from public.site_content c cross join lateral jsonb_array_elements(case when c.key='officials' then c.value else '[]'::jsonb end) item where c.key='officials' and item->>'image'='official-images/'||name));
commit;
