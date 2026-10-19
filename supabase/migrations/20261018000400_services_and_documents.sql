begin;
create table public.service_requirements (
 id uuid primary key default gen_random_uuid(),request_type text not null references public.service_catalog(request_type),title text not null check(char_length(btrim(title)) between 1 and 200),
 instructions text not null default '' check(char_length(instructions)<=2000),required boolean not null default true,active boolean not null default true,version integer not null default 1
);
alter table public.service_requirements enable row level security;grant select on public.service_requirements to anon,authenticated;
create policy "Published document requirements" on public.service_requirements for select to anon,authenticated using(active or public.has_staff_permission('settings'));
create function public.save_service_requirement(p_id uuid,p_service text,p_title text,p_instructions text,p_required boolean,p_active boolean,p_version integer default null)
returns public.service_requirements language plpgsql security definer set search_path=public as $$
declare result public.service_requirements;
begin
 perform public.require_staff_permission('settings');perform pg_advisory_xact_lock(hashtextextended('barangay-booking-configuration',0));
 select * into result from public.service_requirements where id=p_id for update;
 if (found and (p_version is null or result.version<>p_version)) or (not found and p_version is not null) then raise exception 'The requirement changed. Refresh before saving.'; end if;
 if found and result.request_type<>p_service then raise exception 'A saved requirement cannot move to another service.'; end if;
 if p_active and (select count(*) from public.service_requirements where request_type=p_service and active and id<>p_id)>=20 then raise exception 'Use up to 20 active supporting-document requirements per service.';end if;
 insert into public.service_requirements(id,request_type,title,instructions,required,active) values(p_id,p_service,btrim(p_title),btrim(p_instructions),p_required,p_active)
 on conflict(id) do update set title=excluded.title,instructions=excluded.instructions,required=excluded.required,active=excluded.active,version=service_requirements.version+1 returning * into result;return result;
end;
$$;
revoke all on function public.save_service_requirement(uuid,text,text,text,boolean,boolean,integer) from public,anon;
grant execute on function public.save_service_requirement(uuid,text,text,text,boolean,boolean,integer) to authenticated;
create function public.create_document_service(p_name text,p_requirements text,p_fee text,p_processing text) returns public.service_catalog
language plpgsql security definer set search_path=public as $$
declare result public.service_catalog;
begin
 perform public.require_staff_permission('settings');perform pg_advisory_xact_lock(hashtextextended('barangay-booking-configuration',0));
 if char_length(btrim(coalesce(p_name,''))) not between 1 and 200 then raise exception 'Enter a document service name.'; end if;
 if exists(select 1 from public.service_catalog where lower(btrim(regexp_replace(request_type,'[[:space:]]+',' ','g')))=lower(btrim(regexp_replace(p_name,'[[:space:]]+',' ','g')))) then raise exception 'A service with this name already exists.'; end if;
 insert into public.service_catalog(request_type,requirements,fee_description,processing_time,softcopy_available) values(btrim(regexp_replace(p_name,'[[:space:]]+',' ','g')),btrim(p_requirements),btrim(p_fee),btrim(p_processing),false) returning * into result;return result;
end;
$$;
revoke all on function public.create_document_service(text,text,text,text) from public,anon;
grant execute on function public.create_document_service(text,text,text,text) to authenticated;

create table public.certificate_templates (
 id uuid primary key default gen_random_uuid(),request_type text not null references public.service_catalog(request_type),
 label text not null check(char_length(btrim(label)) between 1 and 200),storage_path text not null,version integer not null default 1,active boolean not null default true,
 created_by uuid references public.resident_profiles(id),created_at timestamptz not null default now(),unique(request_type,label,version)
);
insert into public.certificate_templates(request_type,label,storage_path) values
 ('Attestation','Attestation','ATTESTATION.docx'),('Business Permit Clearance','Barangay Business Clearance','BARANGAY BUSINESS CLEARANCE.docx'),
 ('Barangay Clearance','Barangay Clearance','BARANGAY CLEARANCE.docx'),('First-Time Job Seeker Certificate','First-Time Job Seeker','FIRST TIME JOB SEEKER.docx'),
 ('Certificate of Indigency','Indigency - Financial Assistance','INDIGENCY (FINANCIAL ASSISTANCE).docx'),('Certificate of Indigency','Indigency - IMSWD & Hospital','INDIGENCY (IMSWD & HOSPITAL).docx'),('Certificate of Indigency','Indigency - Indigent Only','INDIGENCY (INDIGENT ONLY).docx'),
 ('Certificate of Indigency (Financial Assistance)','Indigency - Financial Assistance','INDIGENCY (FINANCIAL ASSISTANCE).docx'),('Certificate of Indigency (IMSWD & Hospital)','Indigency - IMSWD & Hospital','INDIGENCY (IMSWD & HOSPITAL).docx'),('Certificate of Indigency (Indigent Only)','Indigency - Indigent Only','INDIGENCY (INDIGENT ONLY).docx'),
 ('Lagasit Poorest to the Poor','Lagasit Poorest to the Poor','LAGASIT POOREST TO THE POOR.docx'),('Late Registration','Late Registration','LATE REGISTRATION.docx'),('Livestock','Livestock','LIVESTOCK.docx'),('Certificate of Non-Residency','Non-Residency','NON-RESIDENCY.docx'),('PWD Certificate','PWD Certificate','PWD CERTIFICATE.docx'),('Certificate of Residency','Residency','RESIDENCY.docx'),('Tenancy','Tenancy','TENANCY.docx');
alter table public.certificate_templates enable row level security;grant select on public.certificate_templates to anon,authenticated;
create policy "Public active template metadata" on public.certificate_templates for select to anon,authenticated using(active or public.has_staff_permission('settings'));
create policy "Settings staff upload new template versions" on storage.objects for insert to authenticated with check(bucket_id='certificate-templates' and public.has_staff_permission('settings'));
drop policy "Barangay staff can read certificate templates" on storage.objects;
create policy "Permitted staff read template files" on storage.objects for select to authenticated using(bucket_id='certificate-templates' and (public.has_staff_permission('certificates') or public.has_staff_permission('settings')));
create function public.publish_certificate_template(p_service text,p_label text,p_path text,p_expected_version integer default 0)
returns public.certificate_templates language plpgsql security definer set search_path=public as $$
declare latest integer;result public.certificate_templates;
begin
 perform public.require_staff_permission('settings');
 perform pg_advisory_xact_lock(hashtextextended('template:'||p_service||':'||p_label,0));
 select coalesce(max(version),0) into latest from public.certificate_templates where request_type=p_service and label=btrim(p_label);
 if latest<>p_expected_version then raise exception 'A newer template exists. Refresh before publishing.'; end if;
 perform pg_advisory_xact_lock(hashtextextended('private-upload:certificate-templates:'||p_path,0));
 if p_path !~ '\.docx$' or not exists(select 1 from storage.objects where bucket_id='certificate-templates' and name=p_path) then raise exception 'Upload the DOCX before publishing its template version.'; end if;
 update public.certificate_templates set active=false where request_type=p_service and label=btrim(p_label) and active;
 insert into public.certificate_templates(request_type,label,storage_path,version,created_by) values(p_service,btrim(p_label),p_path,latest+1,auth.uid()) returning * into result;return result;
end;
$$;
revoke all on function public.publish_certificate_template(text,text,text,integer) from public,anon;
grant execute on function public.publish_certificate_template(text,text,text,integer) to authenticated;

alter table public.appointment_requests add column service_key text references public.service_catalog(request_type);
create function public.capture_request_service() returns trigger language plpgsql security definer set search_path=public as $$
begin
 if TG_OP='UPDATE' then if new.service_key is distinct from old.service_key then raise exception 'Submitted service information cannot be changed.'; end if;return new;end if;
 select request_type into new.service_key from public.service_catalog where lower(btrim(regexp_replace(request_type,'[[:space:]]+',' ','g')))=lower(btrim(regexp_replace(new.request_type,'[[:space:]]+',' ','g')));
 if not found then new.service_key:='Other barangay document';end if;return new;
end;
$$;
create trigger capture_request_service before insert or update on public.appointment_requests for each row execute function public.capture_request_service();
create table public.request_attachments (
 id uuid primary key,request_reference text not null references public.appointment_requests(reference),requirement_id uuid not null references public.service_requirements(id),
 requirement_title text not null,required boolean not null default true,owner_id uuid not null references public.resident_profiles(id),storage_path text not null unique,
 status text not null default 'SUBMITTED' check(status in ('SUBMITTED','ACCEPTED','REPLACEMENT_REQUESTED','REPLACED')),
 review_note text,reviewed_by uuid references public.resident_profiles(id),reviewed_at timestamptz,replaces uuid references public.request_attachments(id),
 created_at timestamptz not null default now(),version integer not null default 1
);
create unique index one_current_requirement_file on public.request_attachments(request_reference,requirement_id) where status<>'REPLACED';
alter table public.request_attachments enable row level security;grant select on public.request_attachments to authenticated;
create policy "Owners and reviewers read attachments" on public.request_attachments for select to authenticated using(owner_id=auth.uid() or public.has_staff_permission('requests'));
create function public.check_required_attachments() returns trigger language plpgsql security definer set search_path=public as $$
begin
 if exists(select 1 from public.service_requirements r where r.request_type=new.service_key and r.active and r.required and not exists(select 1 from public.request_attachments a where a.request_reference=new.reference and a.requirement_id=r.id)) then raise exception 'Upload all required supporting documents before submitting.';end if;return new;
end;
$$;
create constraint trigger check_required_attachments after insert on public.appointment_requests deferrable initially deferred for each row execute function public.check_required_attachments();
create function public.submit_document_request(p_request jsonb,p_attachments jsonb default '[]') returns public.appointment_requests
language plpgsql security definer set search_path=public as $$
declare result public.appointment_requests; attachment jsonb; requirement public.service_requirements;
begin
 if auth.uid() is null then raise exception 'Sign in to submit a request.'; end if;
 if jsonb_typeof(p_attachments)<>'array' or jsonb_array_length(p_attachments)>20 then raise exception 'Submit up to 20 supporting documents.'; end if;
 perform pg_advisory_xact_lock(hashtextextended('submission:'||(p_request->>'reference'),0));
 select * into result from public.appointment_requests where reference=p_request->>'reference';
 if found then
 if result.owner_id<>auth.uid() or result.request_type<>p_request->>'request_type' or result.purpose<>p_request->>'purpose' then raise exception 'The request reference is already in use.';end if;return result;end if;
 insert into public.appointment_requests(reference,owner_id,full_name,address,voter_id,request_type,purpose,appointment_date,time_slot,delivery_format,school_id_image_path)
 values(p_request->>'reference',auth.uid(),p_request->>'full_name',p_request->>'address',p_request->>'voter_id',p_request->>'request_type',p_request->>'purpose',(p_request->>'appointment_date')::date,p_request->>'time_slot',p_request->>'delivery_format',p_request->>'school_id_image_path') returning * into result;
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
create function public.review_request_attachment(p_id uuid,p_version integer,p_status text,p_note text) returns public.request_attachments
language plpgsql security definer set search_path=public as $$
declare result public.request_attachments;
begin
 perform public.require_staff_permission('requests');
 if p_status not in ('ACCEPTED','REPLACEMENT_REQUESTED') then raise exception 'Select an attachment review decision.';end if;
 if p_status='REPLACEMENT_REQUESTED' and char_length(btrim(coalesce(p_note,''))) not between 1 and 2000 then raise exception 'Explain which document or correction is required.';end if;
 select * into result from public.request_attachments where id=p_id;
 if not found then raise exception 'Attachment not found.';end if;
 perform 1 from public.appointment_requests where reference=result.request_reference and status in ('PENDING','APPROVED') and not archived for update;
 if not found then raise exception 'Review documents while the request is active.';end if;
 update public.request_attachments set status=p_status,review_note=btrim(p_note),reviewed_by=auth.uid(),reviewed_at=now(),version=version+1 where id=p_id and version=p_version and status<>'REPLACED' returning * into result;
 if not found then raise exception 'The attachment changed. Refresh before reviewing.';end if;
 perform public.enqueue_resident_email('attachment:'||result.id||':'||result.version,result.owner_id,result.request_reference,'attachment_review','Supporting document review',result.requirement_title||': '||replace(result.status,'_',' ')||coalesce(E'\n'||result.review_note,''));
 return result;
end;
$$;
create function public.replace_request_attachment(p_previous uuid,p_version integer,p_id uuid,p_path text) returns public.request_attachments
language plpgsql security definer set search_path=public as $$
declare previous public.request_attachments;result public.request_attachments;
begin
 select * into result from public.request_attachments where id=p_id;
 if found then if result.owner_id<>auth.uid() or result.replaces<>p_previous or result.storage_path<>p_path then raise exception 'The upload identifier is already in use.';end if;return result;end if;
 select * into previous from public.request_attachments where id=p_previous;
 if auth.uid() is null or not found or previous.owner_id<>auth.uid() or previous.version<>p_version or previous.status<>'REPLACEMENT_REQUESTED' then raise exception 'Only the owner can replace a document that staff requested again. Refresh its details.';end if;
 perform 1 from public.appointment_requests where reference=previous.request_reference and status in ('PENDING','APPROVED') and not archived for update;
 if not found then raise exception 'This request is no longer open for corrections.';end if;
 select * into previous from public.request_attachments where id=p_previous for update;
 if previous.version<>p_version or previous.status<>'REPLACEMENT_REQUESTED' then raise exception 'The attachment changed. Refresh before uploading its replacement.';end if;
 perform pg_advisory_xact_lock(hashtextextended('private-upload:request-attachments:'||p_path,0));
 if split_part(p_path,'/',1)<>auth.uid()::text or split_part(p_path,'/',2)<>previous.request_reference or not exists(select 1 from storage.objects where bucket_id='request-attachments' and name=p_path) then raise exception 'Upload the replacement for this request before saving.';end if;
 update public.request_attachments set status='REPLACED',version=version+1 where id=p_previous;
 insert into public.request_attachments(id,request_reference,requirement_id,requirement_title,required,owner_id,storage_path,replaces) values(p_id,previous.request_reference,previous.requirement_id,previous.requirement_title,previous.required,auth.uid(),p_path,p_previous) returning * into result;return result;
end;
$$;
revoke all on function public.submit_document_request(jsonb,jsonb),public.review_request_attachment(uuid,integer,text,text),public.replace_request_attachment(uuid,integer,uuid,text) from public,anon;
grant execute on function public.submit_document_request(jsonb,jsonb),public.review_request_attachment(uuid,integer,text,text),public.replace_request_attachment(uuid,integer,uuid,text) to authenticated;

create table public.office_weekdays(iso_day integer primary key check(iso_day between 1 and 7),open boolean not null);
insert into public.office_weekdays select n,n<6 from generate_series(1,7)n;
alter table public.office_weekdays enable row level security;grant select on public.office_weekdays to anon,authenticated;
create policy "Public operating weekdays" on public.office_weekdays for select to anon,authenticated using(true);
alter table public.appointment_slots add column end_time time;
alter table public.appointment_slots disable trigger authorize_slots;
update public.appointment_slots set end_time=start_time+interval '1 hour';
alter table public.appointment_slots enable trigger authorize_slots;
alter table public.appointment_slots alter column end_time set not null;
alter table public.appointment_slots add constraint valid_slot_times check(end_time>start_time);
create function public.lock_booking_configuration() returns trigger language plpgsql security definer set search_path=public as $$
begin perform pg_advisory_xact_lock(hashtextextended('barangay-booking-configuration',0));return coalesce(new,old);end;
$$;
create trigger lock_slot_configuration before insert or update on public.appointment_slots for each row execute function public.lock_booking_configuration();
create trigger lock_closure_configuration before insert or update or delete on public.office_closures for each row execute function public.lock_booking_configuration();

create function public.affected_appointments(p_date date default null,p_slot text default null) returns jsonb
language plpgsql security definer set search_path=public as $$
declare result jsonb;
begin
 if not public.has_staff_permission('settings') and not public.has_staff_permission('requests') then raise exception 'Booking management permission required.';end if;
 select jsonb_build_object('total',count(*),'rows',coalesce(jsonb_agg(item),'[]')) into result from(select jsonb_build_object('reference',r.reference,'full_name',r.full_name,'appointment_date',r.appointment_date,'time_slot',r.time_slot,'status',r.status) item from public.appointment_requests r where r.status in ('PENDING','APPROVED') and r.appointment_date>=(now() at time zone 'Asia/Manila')::date and (p_date is null or r.appointment_date=p_date) and (p_slot is null or r.time_slot=p_slot) order by r.appointment_date,r.time_slot,r.reference)s;return result;
end;
$$;
create function public.save_operating_slot(p_label text,p_start time,p_end time,p_capacity integer,p_active boolean,p_reviewed boolean default false) returns public.appointment_slots
language plpgsql security definer set search_path=public as $$
declare result public.appointment_slots; highest integer;
begin
 perform public.require_staff_permission('settings');perform pg_advisory_xact_lock(hashtextextended('barangay-booking-configuration',0));
 if p_active and exists(select 1 from public.appointment_slots where active and label<>p_label and start_time<p_end and end_time>p_start) then raise exception 'Choose a slot that does not overlap another active slot.';end if;
 select coalesce(max(n),0) into highest from(select count(*)::int n from public.appointment_requests where time_slot=p_label and appointment_date>=(now() at time zone 'Asia/Manila')::date and status in ('PENDING','APPROVED') group by appointment_date)s;
 if highest>0 and (not p_active or p_capacity<highest) and not p_reviewed then raise exception 'Review affected reservations and acknowledge the capacity change before saving.';end if;
 select * into result from public.appointment_slots where label=p_label for update;
 if found and row(result.start_time,result.end_time) is distinct from row(p_start,p_end) then raise exception 'Create a new slot to change its times; preserve the old slot for existing appointments.';end if;
 perform set_config('app.capacity_reviewed',case when p_reviewed then p_label||':'||p_capacity||':'||p_active else '' end,true);
 insert into public.appointment_slots(label,start_time,end_time,capacity,active) values(p_label,p_start,p_end,p_capacity,p_active)
 on conflict(label) do update set capacity=excluded.capacity,active=excluded.active returning * into result;return result;
end;
$$;
create function public.save_office_weekday(p_day integer,p_open boolean,p_reviewed boolean default false) returns void
language plpgsql security definer set search_path=public as $$
begin
 perform public.require_staff_permission('settings');perform pg_advisory_xact_lock(hashtextextended('barangay-booking-configuration',0));
 if not p_open and not p_reviewed and exists(select 1 from public.appointment_requests where appointment_date>=(now() at time zone 'Asia/Manila')::date and extract(isodow from appointment_date)=p_day and status in ('PENDING','APPROVED')) then raise exception 'Review existing appointments before closing this weekday.';end if;
 update public.office_weekdays set open=p_open where iso_day=p_day;if not found then raise exception 'Choose a weekday from Monday to Sunday.';end if;
end;
$$;
revoke all on function public.affected_appointments(date,text),public.save_operating_slot(text,time,time,integer,boolean,boolean),public.save_office_weekday(integer,boolean,boolean) from public,anon;
grant execute on function public.affected_appointments(date,text),public.save_operating_slot(text,time,time,integer,boolean,boolean),public.save_office_weekday(integer,boolean,boolean) to authenticated;

create trigger audit_service_requirements after insert or update on public.service_requirements for each row execute function public.record_audit_change('id');
create trigger audit_template_versions after insert or update on public.certificate_templates for each row execute function public.record_audit_change('id');
create trigger audit_request_attachments after insert or update on public.request_attachments for each row execute function public.record_audit_change('id');
create trigger audit_operating_weekdays after update on public.office_weekdays for each row execute function public.record_audit_change('iso_day');
alter publication supabase_realtime add table public.service_requirements,public.certificate_templates,public.request_attachments,public.office_weekdays;
commit;
