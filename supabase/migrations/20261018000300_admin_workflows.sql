begin;

create table public.resident_verifications (
 id uuid primary key default gen_random_uuid(),resident_id uuid not null references public.resident_profiles(id),
 kind text not null check(kind in ('identity','residency')),status text not null default 'unverified' check(status in ('unverified','in_review','verified','needs_correction','rejected')),
 review_method text check(review_method in ('in_person','uploaded_evidence')),note text not null default '',reviewed_by uuid references public.resident_profiles(id),reviewed_at timestamptz,
 version integer not null default 1,unique(resident_id,kind)
);
create table public.resident_evidence (
 id uuid primary key default gen_random_uuid(),resident_id uuid not null references public.resident_profiles(id),
 kind text not null check(kind in ('identity','residency')),label text not null check(char_length(btrim(label)) between 1 and 200),
 storage_path text not null unique,created_at timestamptz not null default now()
);
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values
 ('resident-evidence','resident-evidence',false,5242880,array['application/pdf','image/jpeg','image/png','image/webp']),
 ('request-attachments','request-attachments',false,5242880,array['application/pdf','image/jpeg','image/png','image/webp']);
create policy "Residents upload own evidence" on storage.objects for insert to authenticated
with check(bucket_id in ('resident-evidence','request-attachments') and (storage.foldername(name))[1]=auth.uid()::text);
create policy "Owners and permitted reviewers read evidence" on storage.objects for select to authenticated
using((bucket_id='resident-evidence' and ((storage.foldername(name))[1]=auth.uid()::text or public.has_staff_permission('residents')))
 or (bucket_id='request-attachments' and ((storage.foldername(name))[1]=auth.uid()::text or public.has_staff_permission('requests'))));
create function public.validate_resident_evidence() returns trigger language plpgsql security definer set search_path=public as $$
begin
 if auth.uid() is null or new.resident_id<>auth.uid() then raise exception 'Upload evidence for your own account.'; end if;
 perform pg_advisory_xact_lock(hashtextextended('private-upload:resident-evidence:'||new.storage_path,0));
 if split_part(new.storage_path,'/',1)<>new.resident_id::text or not exists(select 1 from storage.objects where bucket_id='resident-evidence' and name=new.storage_path) then raise exception 'Upload the evidence file before saving.'; end if;
 new.created_at:=now();return new;
end;
$$;
create trigger validate_evidence before insert on public.resident_evidence for each row execute function public.validate_resident_evidence();
alter table public.resident_evidence enable row level security;alter table public.resident_verifications enable row level security;
grant select,insert on public.resident_evidence to authenticated;grant select on public.resident_verifications to authenticated;
create policy "Own evidence or assigned reviewers" on public.resident_evidence for select to authenticated using(resident_id=auth.uid() or public.has_staff_permission('residents'));
create policy "Submit own evidence" on public.resident_evidence for insert to authenticated with check(resident_id=auth.uid());
create policy "Own verification or assigned reviewers" on public.resident_verifications for select to authenticated using(resident_id=auth.uid() or public.has_staff_permission('residents'));
create function public.review_resident(p_resident uuid,p_kind text,p_status text,p_method text,p_note text,p_version integer default null)
returns public.resident_verifications language plpgsql security definer set search_path=public as $$
declare result public.resident_verifications;
begin
 perform public.require_staff_permission('residents');
 if char_length(btrim(coalesce(p_note,''))) not between 1 and 2000 then raise exception 'Record the verification decision and supporting details.'; end if;
 if not exists(select 1 from public.resident_profiles where id=p_resident and role='resident') then raise exception 'Resident not found.'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_resident::text||':'||p_kind,0));
 select * into result from public.resident_verifications where resident_id=p_resident and kind=p_kind for update;
 if (found and (p_version is null or result.version<>p_version)) or (not found and p_version is not null) then raise exception 'Verification changed. Refresh before saving.'; end if;
 if p_status='verified' and (p_method is null or p_method not in ('in_person','uploaded_evidence')) then raise exception 'Record how the identity or residency was verified.'; end if;
 if p_status='verified' and p_method='uploaded_evidence' and not exists(select 1 from public.resident_evidence where resident_id=p_resident and kind=p_kind) then raise exception 'No uploaded evidence is available for this review.'; end if;
 insert into public.resident_verifications(resident_id,kind,status,review_method,note,reviewed_by,reviewed_at)
 values(p_resident,p_kind,p_status,p_method,btrim(p_note),auth.uid(),now()) on conflict(resident_id,kind) do update set
 status=excluded.status,review_method=excluded.review_method,note=excluded.note,reviewed_by=auth.uid(),reviewed_at=now(),version=resident_verifications.version+1 returning * into result;
 perform public.enqueue_resident_email('verification:'||result.id||':'||result.version,p_resident,p_resident::text,'verification','Resident verification update',p_kind||' verification: '||replace(p_status,'_',' ')||E'\n'||p_note);
 return result;
end;
$$;
revoke all on function public.review_resident(uuid,text,text,text,text,integer) from public,anon;
grant execute on function public.review_resident(uuid,text,text,text,text,integer) to authenticated;

alter table public.appointment_requests add column assigned_to uuid references public.resident_profiles(id),add column checked_in_at timestamptz,add column checked_in_by uuid references public.resident_profiles(id);
create function public.manage_queue_entry(p_reference text,p_version integer,p_assignee uuid default null,p_check_in boolean default false)
returns public.appointment_requests language plpgsql security definer set search_path=public as $$
declare result public.appointment_requests;
begin
 perform public.require_staff_permission('requests');
 select * into result from public.appointment_requests where reference=p_reference for update;
 if not found or p_version is null or result.version<>p_version then raise exception 'The request changed or was not found. Refresh the queue.'; end if;
 if result.archived or result.status not in ('PENDING','APPROVED') then raise exception 'Choose an active request.'; end if;
 if p_assignee is not null and not exists(select 1 from public.staff_access a join public.resident_profiles p on p.id=a.user_id where a.user_id=p_assignee and a.active and p.role='staff' and (a.superadmin or 'requests'=any(a.permissions))) then raise exception 'Choose active staff with request permission.'; end if;
 if p_check_in and (result.status<>'APPROVED' or result.checked_in_at is not null) then raise exception 'Check in an approved appointment once.'; end if;
 update public.appointment_requests set assigned_to=case when p_check_in then assigned_to else p_assignee end,
 checked_in_at=case when p_check_in then now() else checked_in_at end,checked_in_by=case when p_check_in then auth.uid() else checked_in_by end where reference=p_reference returning * into result;
 insert into public.request_events(request_reference,actor_id,actor_name,status,description)
 select p_reference,auth.uid(),first_name||' '||last_name,result.status,case when p_check_in then 'Resident checked in.' when p_assignee is null then 'Staff assignment removed.' else 'Request assigned to staff.' end from public.resident_profiles where id=auth.uid();
 return result;
end;
$$;
revoke all on function public.manage_queue_entry(text,integer,uuid,boolean) from public,anon;
grant execute on function public.manage_queue_entry(text,integer,uuid,boolean) to authenticated;
create table public.walk_in_transactions (
 id uuid primary key,reference text not null unique default 'WALK-'||to_char(now() at time zone 'Asia/Manila','YYYY')||'-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,12)),
 resident_id uuid references public.resident_profiles(id),full_name text not null check(char_length(btrim(full_name)) between 1 and 200),
 contact text not null default '',request_type text not null,purpose text not null check(char_length(btrim(purpose)) between 1 and 2000),
 status text not null default 'WAITING' check(status in ('WAITING','IN_PROGRESS','COMPLETED','CANCELLED')),
 assigned_to uuid references public.resident_profiles(id),created_by uuid not null references public.resident_profiles(id),
 created_at timestamptz not null default now(),completed_at timestamptz,reason text,version integer not null default 1
);
alter table public.walk_in_transactions enable row level security;
grant select on public.walk_in_transactions to authenticated;
create policy "Permitted staff read walk-in transactions" on public.walk_in_transactions for select to authenticated using(public.has_staff_permission('requests') or public.has_staff_permission('reports') or public.has_staff_permission('payments'));
create function public.save_walk_in(p_id uuid,p_name text,p_contact text,p_service text,p_purpose text,p_status text default 'WAITING',p_assignee uuid default null,p_reason text default null,p_version integer default null)
returns public.walk_in_transactions language plpgsql security definer set search_path=public as $$
declare result public.walk_in_transactions;
begin
 perform public.require_staff_permission('requests');
 if not exists(select 1 from public.service_catalog where request_type=p_service and active) then raise exception 'Select an available service.'; end if;
 if p_assignee is not null and not exists(select 1 from public.staff_access where user_id=p_assignee and active and (superadmin or 'requests'=any(permissions))) then raise exception 'Select active staff with request permission.'; end if;
 select * into result from public.walk_in_transactions where id=p_id for update;
 if found then
 if p_version is null then
 if result.full_name=btrim(p_name) and result.contact=btrim(p_contact) and result.assigned_to is not distinct from p_assignee and result.request_type=p_service and result.purpose=btrim(p_purpose) and result.created_by=auth.uid() then return result; end if;
 raise exception 'This walk-in identifier is already in use.'; end if;
 if result.version<>p_version then raise exception 'The walk-in transaction changed. Refresh before saving.'; end if;
 if result.status in ('COMPLETED','CANCELLED') then raise exception 'Completed or cancelled walk-ins cannot be rewritten.'; end if;
 if p_status='CANCELLED' and char_length(btrim(coalesce(p_reason,''))) not between 1 and 1000 then raise exception 'Provide a cancellation reason.'; end if;
 update public.walk_in_transactions set status=p_status,assigned_to=p_assignee,reason=p_reason,completed_at=case when p_status='COMPLETED' then now() else null end,version=version+1 where id=p_id returning * into result;
 else
 if p_version is not null or p_status<>'WAITING' then raise exception 'A new walk-in starts as Waiting.'; end if;
 insert into public.walk_in_transactions(id,full_name,contact,request_type,purpose,assigned_to,created_by) values(p_id,btrim(p_name),btrim(p_contact),p_service,btrim(p_purpose),p_assignee,auth.uid()) returning * into result;
 end if;return result;
end;
$$;
revoke all on function public.save_walk_in(uuid,text,text,text,text,text,uuid,text,integer) from public,anon;
grant execute on function public.save_walk_in(uuid,text,text,text,text,text,uuid,text,integer) to authenticated;

create sequence public.certificate_register_sequence;
create table public.certificate_register (
 id uuid primary key,register_number text not null unique default 'REG-'||to_char(now() at time zone 'Asia/Manila','YYYY')||'-'||lpad(nextval('public.certificate_register_sequence')::text,8,'0'),
 official_number text unique,request_reference text references public.appointment_requests(reference),walk_in_id uuid references public.walk_in_transactions(id),
 signatory text not null check(char_length(btrim(signatory)) between 1 and 200),issued_by uuid not null references public.resident_profiles(id),issued_at timestamptz not null default now(),
 replaces uuid references public.certificate_register(id),replacement_reason text,status text not null default 'ISSUED' check(status in ('ISSUED','SUPERSEDED','REVOKED')),
 revoked_by uuid references public.resident_profiles(id),revoked_at timestamptz,revocation_reason text,version integer not null default 1,
 check(num_nonnulls(request_reference,walk_in_id)=1)
);
create unique index current_certificate_per_request on public.certificate_register(request_reference) where status='ISSUED';
create unique index current_certificate_per_walkin on public.certificate_register(walk_in_id) where status='ISSUED';
alter table public.certificate_register enable row level security;grant select on public.certificate_register to authenticated;
create policy "Authorized staff and owning resident read register" on public.certificate_register for select to authenticated
using(public.has_staff_permission('certificates') or public.has_staff_permission('reports') or exists(select 1 from public.appointment_requests r where r.reference=request_reference and r.owner_id=auth.uid()));
create function public.issue_certificate(p_id uuid,p_reference text,p_walk_in uuid,p_signatory text,p_official_number text default null,p_replaces uuid default null,p_reason text default null)
returns public.certificate_register language plpgsql security definer set search_path=public as $$
declare result public.certificate_register; previous public.certificate_register;
begin
 perform public.require_staff_permission('certificates');
 if num_nonnulls(p_reference,p_walk_in)<>1 then raise exception 'Select one appointment or walk-in transaction.'; end if;
 perform pg_advisory_xact_lock(hashtextextended(coalesce(p_reference,p_walk_in::text),0));
 select * into result from public.certificate_register where id=p_id;
 if found then
 if result.request_reference is not distinct from p_reference and result.walk_in_id is not distinct from p_walk_in and result.issued_by=auth.uid() and result.signatory=btrim(p_signatory) and result.official_number is not distinct from nullif(btrim(p_official_number),'') and result.replaces is not distinct from p_replaces and result.replacement_reason is not distinct from p_reason then return result; end if;
 raise exception 'This issuance identifier is already in use.'; end if;
 if p_reference is not null then
 perform 1 from public.appointment_requests where reference=p_reference and status in ('APPROVED','COMPLETED') and not archived for update;
 if not found then raise exception 'Select an approved or completed appointment.';end if;end if;
 if p_walk_in is not null then
 perform 1 from public.walk_in_transactions where id=p_walk_in and status in ('IN_PROGRESS','COMPLETED') for update;
 if not found then raise exception 'Select an in-progress or completed walk-in.';end if;end if;
 if p_replaces is not null then
 select * into previous from public.certificate_register where id=p_replaces for update;
 if not found or previous.request_reference is distinct from p_reference or previous.walk_in_id is distinct from p_walk_in or previous.status='SUPERSEDED' then raise exception 'Select the certificate being replaced for this transaction.'; end if;
 if char_length(btrim(coalesce(p_reason,''))) not between 1 and 1000 then raise exception 'Record the replacement reason.'; end if;
 update public.certificate_register set status='SUPERSEDED',version=version+1 where id=p_replaces;
 end if;
 insert into public.certificate_register(id,official_number,request_reference,walk_in_id,signatory,issued_by,replaces,replacement_reason)
 values(p_id,nullif(btrim(p_official_number),''),p_reference,p_walk_in,btrim(p_signatory),auth.uid(),p_replaces,p_reason) returning * into result;
 return result;
end;
$$;
create function public.revoke_certificate(p_id uuid,p_version integer,p_reason text) returns public.certificate_register
language plpgsql security definer set search_path=public as $$
declare result public.certificate_register;
begin
 perform public.require_staff_permission('certificates');
 if char_length(btrim(coalesce(p_reason,''))) not between 1 and 1000 then raise exception 'Record the revocation reason.'; end if;
 update public.certificate_register set status='REVOKED',revoked_by=auth.uid(),revoked_at=now(),revocation_reason=btrim(p_reason),version=version+1
 where id=p_id and version=p_version and status='ISSUED' returning * into result;
 if not found then raise exception 'The issuance changed or cannot be revoked. Refresh the register.'; end if;return result;
end;
$$;
revoke all on function public.issue_certificate(uuid,text,uuid,text,text,uuid,text),public.revoke_certificate(uuid,integer,text) from public,anon;
grant execute on function public.issue_certificate(uuid,text,uuid,text,text,uuid,text),public.revoke_certificate(uuid,integer,text) to authenticated;

alter table public.office_settings add column fee_tracking_enabled boolean not null default false;
create table public.fee_records (
 id uuid primary key,request_reference text references public.appointment_requests(reference),walk_in_id uuid references public.walk_in_transactions(id),
 amount numeric(12,2) not null check(amount>=0),currency text not null default 'PHP' check(currency='PHP'),
 status text not null check(status in ('PAID','EXEMPT','WAIVED','REFUNDED','VOIDED')),receipt_reference text unique,
 note text not null check(char_length(btrim(note)) between 1 and 1000),recorded_by uuid not null references public.resident_profiles(id),recorded_at timestamptz not null default now(),
 previous_record uuid references public.fee_records(id),check(num_nonnulls(request_reference,walk_in_id)=1),check(status not in ('EXEMPT','WAIVED') or amount=0)
);
alter table public.fee_records enable row level security;grant select on public.fee_records to authenticated;
create policy "Permitted fee access" on public.fee_records for select to authenticated using(public.has_staff_permission('payments') or public.has_staff_permission('reports') or exists(select 1 from public.appointment_requests r where r.reference=request_reference and r.owner_id=auth.uid()));
create function public.record_fee(p_id uuid,p_reference text,p_walk_in uuid,p_amount numeric,p_status text,p_receipt text,p_note text,p_previous uuid default null)
returns public.fee_records language plpgsql security definer set search_path=public as $$
declare result public.fee_records; previous public.fee_records;
begin
 perform public.require_staff_permission('payments');
 if not (select fee_tracking_enabled from public.office_settings where id=1) then raise exception 'Fee tracking must be enabled after the office confirms its payment process.'; end if;
 if p_status='PAID' and nullif(btrim(p_receipt),'') is null then raise exception 'Record the receipt reference for a payment.'; end if;
 if p_amount is null or p_amount<0 or p_amount<>round(p_amount,2) then raise exception 'Enter a nonnegative amount with up to two decimal places.'; end if;
 if p_status not in ('REFUNDED','VOIDED') and p_previous is not null then raise exception 'Link an original payment only when recording a refund or void.';end if;
 select * into result from public.fee_records where id=p_id;
 if found then
 if result.request_reference is not distinct from p_reference and result.walk_in_id is not distinct from p_walk_in and result.amount=p_amount and result.status=p_status and result.recorded_by=auth.uid() and result.receipt_reference is not distinct from nullif(btrim(p_receipt),'') and result.note=btrim(p_note) and result.previous_record is not distinct from p_previous then return result; end if;
 raise exception 'The fee identifier is already in use.'; end if;
 if p_status in ('REFUNDED','VOIDED') then
 select * into previous from public.fee_records where id=p_previous for update;
 if not found or previous.status<>'PAID' or previous.request_reference is distinct from p_reference or previous.walk_in_id is distinct from p_walk_in then raise exception 'Select the original payment record for this transaction.'; end if;
 if exists(select 1 from public.fee_records where previous_record=p_previous) then raise exception 'A correction was already recorded for this payment.'; end if;
 if p_amount<>previous.amount then raise exception 'The correction amount must match the original payment.'; end if;
 end if;
 insert into public.fee_records(id,request_reference,walk_in_id,amount,status,receipt_reference,note,recorded_by,previous_record)
 values(p_id,p_reference,p_walk_in,p_amount,p_status,nullif(btrim(p_receipt),''),btrim(p_note),auth.uid(),p_previous) returning * into result;return result;
end;
$$;
revoke all on function public.record_fee(uuid,text,uuid,numeric,text,text,text,uuid) from public,anon;
grant execute on function public.record_fee(uuid,text,uuid,numeric,text,text,text,uuid) to authenticated;

create table public.site_content (
 key text primary key check(key in ('mission','vision','about','officials')),value jsonb not null,version integer not null default 1,updated_at timestamptz not null default now(),updated_by uuid references public.resident_profiles(id)
);
alter table public.site_content enable row level security;grant select on public.site_content to anon,authenticated;
create policy "Public site content" on public.site_content for select to anon,authenticated using(true);
create function public.save_site_content(p_key text,p_value jsonb,p_version integer default null) returns public.site_content
language plpgsql security definer set search_path=public as $$
declare result public.site_content; official jsonb;
begin
 perform public.require_staff_permission('content');
 perform pg_advisory_xact_lock(hashtextextended('site-content:'||p_key,0));
 if p_key='officials' then
 if jsonb_typeof(p_value)<>'array' or jsonb_array_length(p_value)>50 then raise exception 'Provide up to 50 officials.'; end if;
 for official in select * from jsonb_array_elements(p_value) loop
 if char_length(btrim(coalesce(official->>'name',''))) not between 1 and 200 or char_length(btrim(coalesce(official->>'role',''))) not between 1 and 200
 or (coalesce(official->>'image','')<>'' and (official->>'image') !~ '^(officials/[A-Za-z0-9 ._()&-]+|official-images/[a-f0-9-]+\.(jpg|png|webp))$') then raise exception 'Provide each official name, role, and an available official image.'; end if;
   if (official->>'image') like 'official-images/%' and not exists(select 1 from storage.objects where bucket_id='official-images' and name=substr(official->>'image',17)) then raise exception 'Upload the official photo before publishing.';end if;
   end loop;
 elsif p_key in ('mission','vision','about') then
 if jsonb_typeof(p_value)<>'string' or char_length(btrim(p_value#>>'{}')) not between 1 and 4000 then raise exception 'Enter public text with up to 4000 characters.'; end if;
 else raise exception 'Unknown public content field.'; end if;
 select * into result from public.site_content where key=p_key for update;
 if (found and (p_version is null or result.version<>p_version)) or (not found and p_version is not null) then raise exception 'Public content changed. Refresh before saving.'; end if;
 insert into public.site_content(key,value,updated_by) values(p_key,p_value,auth.uid()) on conflict(key) do update set value=excluded.value,version=site_content.version+1,updated_at=now(),updated_by=auth.uid() returning * into result;
 return result;
end;
$$;
revoke all on function public.save_site_content(text,jsonb,integer) from public,anon;
grant execute on function public.save_site_content(text,jsonb,integer) to authenticated;

create function public.sync_confirmed_account_email() returns trigger language plpgsql security definer set search_path=public as $$
begin if new.email is distinct from old.email and new.email_confirmed_at is not null then update public.resident_profiles set email=lower(new.email) where id=new.id; end if;return new;end;
$$;
create trigger sync_confirmed_email after update of email on auth.users for each row execute function public.sync_confirmed_account_email();

create trigger audit_verifications after insert or update on public.resident_verifications for each row execute function public.record_audit_change('id');
create trigger audit_evidence after insert on public.resident_evidence for each row execute function public.record_audit_change('id');
create trigger audit_walkins after insert or update on public.walk_in_transactions for each row execute function public.record_audit_change('id');
create trigger audit_issuance after insert or update on public.certificate_register for each row execute function public.record_audit_change('id');
create trigger audit_fees after insert on public.fee_records for each row execute function public.record_audit_change('id');
create trigger audit_site_content after insert or update on public.site_content for each row execute function public.record_audit_change('key');
alter publication supabase_realtime add table public.resident_verifications,public.resident_evidence,public.walk_in_transactions,public.certificate_register,public.fee_records,public.site_content;
commit;
