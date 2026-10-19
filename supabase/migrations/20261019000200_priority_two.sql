begin;
-- Revisions are checked in UPDATE predicates and advanced by the database.
create function public.advance_record_revision() returns trigger language plpgsql set search_path=public as $$begin new.revision:=old.revision+1;return new;end;$$;
do $$declare item text;begin foreach item in array array['resident_profiles','public_posts','walk_in_shifts','service_catalog','office_settings','office_closures','appointment_slots'] loop
 execute format('alter table public.%I add column revision integer not null default 1',item);
 execute format('create trigger advance_revision before update on public.%I for each row execute function public.advance_record_revision()',item);
end loop;end;$$;

alter table public.appointment_requests add column id_type text,add column id_number text,add column id_review_acknowledged boolean not null default false,add column id_acknowledgment_version text,add column id_acknowledged_at timestamptz;
create function public.validate_request_identity() returns trigger language plpgsql set search_path=public as $$
declare allowed text[]:=array['Philippine National ID (PhilID)','Driver''s License','Passport','UMID','PRC ID','Postal ID','Voter''s ID','Senior Citizen ID','PWD ID','Barangay ID','School ID','Other government-issued ID'];
begin
 if tg_op='UPDATE' then
 if row(new.id_type,new.id_number,new.id_review_acknowledged,new.id_acknowledgment_version,new.id_acknowledged_at) is distinct from row(old.id_type,old.id_number,old.id_review_acknowledged,old.id_acknowledgment_version,old.id_acknowledged_at) then raise exception 'Submitted identity and acknowledgment cannot be changed.';end if;return new;end if;
 new.id_type:=coalesce(nullif(btrim(new.id_type),''),split_part(new.voter_id,':',1));
 new.id_number:=coalesce(nullif(btrim(new.id_number),''),nullif(btrim(substr(new.voter_id,strpos(new.voter_id,':')+1)),''));
 if not(new.id_type=any(allowed)) or new.id_type is null or new.id_number is null or char_length(new.id_number) not between 1 and 120 or new.id_number ~ '[[:cntrl:]]' then raise exception 'Select a supported ID type and enter its number (up to 120 characters).';end if;
 if not new.id_review_acknowledged then raise exception 'Confirm that authorized staff may review the attached ID for this appointment.';end if;
 new.voter_id:=new.id_type||': '||new.id_number;new.id_acknowledgment_version:='id-review-v1';new.id_acknowledged_at:=now();return new;
end;$$;
create trigger identity_request before insert or update on public.appointment_requests for each row execute function public.validate_request_identity();

create function public.submit_resident_concern(p_id uuid,p_contact text,p_category text,p_message text) returns public.resident_concerns language plpgsql security definer set search_path=public as $$
declare result public.resident_concerns;actor text;ref text:='CON-'||p_id::text;
begin
 if auth.uid() is null or not exists(select 1 from public.resident_profiles where id=auth.uid() and role='resident') then raise exception 'Sign in as a resident to submit a concern.';end if;
 if p_id is null or char_length(btrim(coalesce(p_contact,''))) not between 1 and 200 or p_category not in ('Service concern','Feedback','Suggestion','Other') or char_length(btrim(coalesce(p_message,''))) not between 1 and 2000 then raise exception 'Complete the concern category, contact details, and message.';end if;
 perform pg_advisory_xact_lock(hashtextextended('concern-submission:'||ref,0));
 select * into result from public.resident_concerns where reference=ref;
 if found then if result.owner_id<>auth.uid() or row(result.contact,result.category,result.message) is distinct from row(btrim(p_contact),p_category,btrim(p_message)) then raise exception 'This submission identifier is already in use.';end if;return result;end if;
 select first_name||' '||last_name into actor from public.resident_profiles where id=auth.uid();
 insert into public.resident_concerns(reference,owner_id,name,contact,category,message) values(ref,auth.uid(),actor,btrim(p_contact),p_category,btrim(p_message)) returning * into result;return result;
end;$$;
revoke all on function public.submit_resident_concern(uuid,text,text,text) from public,anon;grant execute on function public.submit_resident_concern(uuid,text,text,text) to authenticated;

create function public.save_walk_in_shift(p_id text,p_staff text,p_role text,p_days text,p_hours text,p_active boolean,p_revision integer default null) returns public.walk_in_shifts language plpgsql security definer set search_path=public as $$
declare result public.walk_in_shifts;
begin
 perform public.require_staff_permission('schedules');
 if p_id is null or char_length(p_id) not between 1 and 100 or p_id ~ '[[:cntrl:]]' or char_length(btrim(coalesce(p_staff,''))) not between 1 and 80 or char_length(btrim(coalesce(p_role,''))) not between 1 and 80 or char_length(btrim(coalesce(p_days,''))) not between 1 and 80 or char_length(btrim(coalesce(p_hours,''))) not between 1 and 80 then raise exception 'Complete the staff, role, days, and hours.';end if;
 perform pg_advisory_xact_lock(hashtextextended('shift:'||p_id,0));select * into result from public.walk_in_shifts where id=p_id::text for update;
 if found then
 if p_revision is null then if row(result.staff_name,result.role,result.days,result.hours,result.active) is distinct from row(btrim(p_staff),btrim(p_role),btrim(p_days),btrim(p_hours),p_active) then raise exception 'Schedule changed. Reload and review it before saving.';end if;return result;end if;
 if result.revision<>p_revision then raise exception 'Schedule changed. Reload and review it before saving.';end if;
 update public.walk_in_shifts set staff_name=btrim(p_staff),role=btrim(p_role),days=btrim(p_days),hours=btrim(p_hours),active=p_active where id=p_id::text returning * into result;
 else if p_revision is not null then raise exception 'Schedule no longer exists. Reload the list.';end if;
 insert into public.walk_in_shifts(id,staff_name,role,days,hours,active) values(p_id::text,btrim(p_staff),btrim(p_role),btrim(p_days),btrim(p_hours),p_active) returning * into result;end if;return result;
end;$$;
revoke all on function public.save_walk_in_shift(text,text,text,text,text,boolean,integer) from public,anon;grant execute on function public.save_walk_in_shift(text,text,text,text,text,boolean,integer) to authenticated;

-- This function runs as the caller: every query retains the underlying RLS.
create function public.portal_list(p_kind text,p_page integer default 0,p_size integer default 25,p_query text default '',p_archived boolean default null,p_status text default null,p_date date default null,p_owner uuid default null) returns jsonb language plpgsql security invoker set search_path=public as $$
declare tab text;search_fields text;sort text;predicate text;result jsonb;
begin
 if p_page is null or p_page<0 or p_page>1000000 or p_size is null or p_size not between 1 and 100 or char_length(coalesce(p_query,''))>200 then raise exception 'Choose a valid list page and search up to 200 characters.';end if;
 case p_kind
 when 'requests' then tab:='appointment_requests';search_fields:='reference,full_name,request_type,address';sort:='submitted_at desc,reference';predicate:='($2 is null or archived=$2) and ($3 is null or status=$3) and ($4 is null or appointment_date=$4) and ($5 is null or owner_id=$5)';
 when 'concerns' then tab:='resident_concerns';search_fields:='reference,name,contact,category,message';sort:='submitted_at desc,reference';predicate:='($2 is null or archived=$2) and ($3 is null or status=$3) and ($5 is null or owner_id=$5)';
 when 'residents' then tab:='resident_profiles';search_fields:='first_name,last_name,email,contact_number,address';sort:='created_at desc,id';predicate:='role=''resident''';
 when 'posts' then tab:='public_posts';search_fields:='title,content';sort:='published_at desc,id';predicate:='($2 is null or archived=$2)';
 else raise exception 'Unknown list.';end case;
 execute format('with matched as materialized(select * from public.%I where %s and strpos(lower(concat_ws('' '',%s)),lower(coalesce($1,'''')))>0) select jsonb_build_object(''total'',(select count(*) from matched),''rows'',coalesce((select jsonb_agg(to_jsonb(page)) from(select * from matched order by %s limit $6 offset $7)page),''[]''))',tab,predicate,search_fields,sort) into result using p_query,p_archived,p_status,p_date,p_owner,p_size,p_page::bigint*p_size;return result;
end;$$;
revoke all on function public.portal_list(text,integer,integer,text,boolean,text,date,uuid) from public;grant execute on function public.portal_list(text,integer,integer,text,boolean,text,date,uuid) to authenticated,anon;
create function public.request_summary() returns jsonb language sql stable security invoker set search_path=public as $$
 select jsonb_build_object('total',count(*) filter(where not archived),'pending',count(*) filter(where not archived and status='PENDING'),'approved',count(*) filter(where not archived and status='APPROVED'),'served',count(distinct owner_id) filter(where status='COMPLETED'),
 'statuses',(select coalesce(jsonb_object_agg(status,n),'{}') from(select status,count(*) n from public.appointment_requests where not archived group by status)s),
 'months',(select coalesce(jsonb_object_agg(month_no,n),'{}') from(select extract(month from submitted_at at time zone 'Asia/Manila')::int as month_no,count(*) n from public.appointment_requests where not archived and extract(year from submitted_at at time zone 'Asia/Manila')=extract(year from now() at time zone 'Asia/Manila') group by 1)s),
 'types',(select coalesce(jsonb_agg(s),'[]') from(select request_type name,count(*) count from public.appointment_requests where not archived group by request_type order by request_type)s)) from public.appointment_requests;
$$;
revoke all on function public.request_summary() from public,anon;grant execute on function public.request_summary() to authenticated;

alter table public.certificate_deliveries add column file_available boolean not null default false;
update public.certificate_deliveries d set file_available=true where exists(select 1 from storage.objects o where o.bucket_id='completed-certificates' and o.name=d.storage_path);
create function public.track_certificate_file() returns trigger language plpgsql security definer set search_path=public as $$begin
 if tg_op='DELETE' then if old.bucket_id='completed-certificates' then update public.certificate_deliveries set file_available=false where storage_path=old.name;end if;return old;end if;
 if tg_op='UPDATE' and old.bucket_id='completed-certificates' and row(old.bucket_id,old.name) is distinct from row(new.bucket_id,new.name) then update public.certificate_deliveries set file_available=false where storage_path=old.name;end if;
 if new.bucket_id='completed-certificates' then update public.certificate_deliveries set file_available=true where storage_path=new.name;end if;return new;
end;$$;
create trigger track_certificate_file after insert or update or delete on storage.objects for each row execute function public.track_certificate_file();
create or replace function public.submit_document_request(p_request jsonb,p_attachments jsonb default '[]') returns public.appointment_requests
language plpgsql security definer set search_path=public as $$
declare result public.appointment_requests; attachment jsonb; requirement public.service_requirements;
begin
 if auth.uid() is null then raise exception 'Sign in to submit a request.'; end if;
 if jsonb_typeof(p_attachments)<>'array' or jsonb_array_length(p_attachments)>20 then raise exception 'Submit up to 20 supporting documents.'; end if;
 perform pg_advisory_xact_lock(hashtextextended('submission:'||(p_request->>'reference'),0));
 select * into result from public.appointment_requests where reference=p_request->>'reference';
 if found then
 if result.owner_id<>auth.uid() or result.request_type<>p_request->>'request_type' or result.purpose<>p_request->>'purpose' then raise exception 'The request reference is already in use.';end if;return result;end if;
 insert into public.appointment_requests(reference,owner_id,full_name,address,voter_id,request_type,purpose,appointment_date,time_slot,delivery_format,school_id_image_path,id_type,id_number,id_review_acknowledged)
 values(p_request->>'reference',auth.uid(),p_request->>'full_name',p_request->>'address',p_request->>'voter_id',p_request->>'request_type',p_request->>'purpose',(p_request->>'appointment_date')::date,p_request->>'time_slot',p_request->>'delivery_format',p_request->>'school_id_image_path',p_request->>'id_type',p_request->>'id_number',coalesce((p_request->>'id_review_acknowledged')::boolean,false)) returning * into result;
 for attachment in select * from jsonb_array_elements(p_attachments) loop
 select * into requirement from public.service_requirements where id=(attachment->>'requirement_id')::uuid and request_type=result.service_key and active;
 if not found then raise exception 'The supporting-document requirements changed. Review the service before submitting.'; end if;
 perform pg_advisory_xact_lock(hashtextextended('private-upload:request-attachments:'||(attachment->>'storage_path'),0));
 if split_part(attachment->>'storage_path','/',1)<>auth.uid()::text or split_part(attachment->>'storage_path','/',2)<>result.reference
 or not exists(select 1 from storage.objects where bucket_id='request-attachments' and name=attachment->>'storage_path') then raise exception 'A supporting upload is missing or belongs to another request.';end if;
 insert into public.request_attachments(id,request_reference,requirement_id,requirement_title,required,owner_id,storage_path) values((attachment->>'id')::uuid,result.reference,requirement.id,requirement.title,requirement.required,auth.uid(),attachment->>'storage_path');
 end loop;
 if exists(select 1 from public.service_requirements r where r.request_type=result.service_key and r.active and r.required and not exists(select 1 from public.request_attachments a where a.request_reference=result.reference and a.requirement_id=r.id)) then raise exception 'Upload all required supporting documents before submitting.';end if;
 return result;
end;
$$;

alter table public.certificate_deliveries add column email_payload jsonb;
create function public.save_operating_slot_versioned(p_label text,p_start time,p_end time,p_capacity integer,p_active boolean,p_reviewed boolean default false,p_revision integer default null) returns public.appointment_slots language plpgsql security definer set search_path=public as $$
declare current public.appointment_slots;
begin
 perform public.require_staff_permission('settings');perform pg_advisory_xact_lock(hashtextextended('barangay-booking-configuration',0));select * into current from public.appointment_slots where label=p_label for update;
 if found then
 if p_revision is null then if row(current.start_time,current.end_time,current.capacity,current.active) is not distinct from row(p_start,p_end,p_capacity,p_active) then return current;end if;raise exception 'Slot changed. Reload and review it before saving.';end if;
 if current.revision<>p_revision then raise exception 'Slot changed. Reload and review it before saving.';end if;
 elsif p_revision is not null then raise exception 'Slot no longer exists. Reload the settings.';end if;
 return public.save_operating_slot(p_label,p_start,p_end,p_capacity,p_active,p_reviewed);
end;$$;
revoke all on function public.save_operating_slot_versioned(text,time,time,integer,boolean,boolean,integer) from public,anon;grant execute on function public.save_operating_slot_versioned(text,time,time,integer,boolean,boolean,integer) to authenticated;
create function public.save_reviewed_closure(p_date date,p_reason text,p_reviewed boolean default false,p_revision integer default null) returns public.office_closures language plpgsql security definer set search_path=public as $$
declare current public.office_closures;
begin
 perform public.require_staff_permission('settings');perform pg_advisory_xact_lock(hashtextextended('barangay-booking-configuration',0));
 if p_date is null or char_length(btrim(coalesce(p_reason,''))) not between 1 and 300 then raise exception 'Choose a closure date and reason.';end if;
 select * into current from public.office_closures where closed_date=p_date for update;
 if found then if current.reason=btrim(p_reason) then return current;end if;if p_revision is null or current.revision<>p_revision then raise exception 'Closure changed. Reload and review it before saving.';end if;
 elsif p_revision is not null then raise exception 'Closure no longer exists. Reload settings.';end if;
 if not coalesce(p_reviewed,false) and exists(select 1 from public.appointment_requests where appointment_date=p_date and not archived and status in ('PENDING','APPROVED')) then raise exception 'Review affected bookings before saving this closure.';end if;
 insert into public.office_closures(closed_date,reason) values(p_date,btrim(p_reason)) on conflict(closed_date) do update set reason=excluded.reason returning * into current;return current;
end;$$;
revoke all on function public.save_reviewed_closure(date,text,boolean,integer) from public,anon;grant execute on function public.save_reviewed_closure(date,text,boolean,integer) to authenticated;
commit;
