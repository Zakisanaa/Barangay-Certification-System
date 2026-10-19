begin;
alter table public.service_catalog add column fee_amount numeric(12,2) check(fee_amount>=0);
alter table public.fee_records add column payment_method text not null default 'Not recorded',add column payer_reference text;
create table public.payment_methods(
 id uuid primary key,name text not null check(char_length(btrim(name)) between 1 and 100),kind text not null check(kind in ('GCASH','MAYA','BANK_TRANSFER','OTHER')),
 account_name text not null check(char_length(btrim(account_name)) between 1 and 200),account_details text not null check(char_length(btrim(account_details)) between 1 and 1000),
 instructions text not null default '' check(char_length(instructions)<=2000),active boolean not null default false,version integer not null default 1,updated_at timestamptz not null default now()
);
alter table public.payment_methods enable row level security;grant select on public.payment_methods to authenticated;
create policy "Read available payment instructions" on public.payment_methods for select to authenticated using(active or public.has_staff_permission('payments') or public.has_staff_permission('settings'));
create table public.payment_submissions(
 id uuid primary key,owner_id uuid not null references public.resident_profiles(id),request_reference text not null references public.appointment_requests(reference),method_id uuid not null references public.payment_methods(id),
 method_snapshot jsonb not null,amount numeric(12,2) not null check(amount>0),payer_reference text not null check(char_length(btrim(payer_reference)) between 1 and 200),
 proof_path text not null unique,status text not null default 'PENDING' check(status in ('PENDING','ACCEPTED','DECLINED')),review_note text not null default '',
 submitted_at timestamptz not null default now(),reviewed_at timestamptz,reviewed_by uuid references public.resident_profiles(id),fee_record_id uuid unique references public.fee_records(id),version integer not null default 1
);
create unique index one_pending_payment on public.payment_submissions(request_reference) where status='PENDING';
create unique index unique_live_transfer_reference on public.payment_submissions(method_id,lower(btrim(payer_reference))) where status in ('PENDING','ACCEPTED');
create index payment_review_queue on public.payment_submissions(status,submitted_at desc,id);
create index payment_owner_history on public.payment_submissions(owner_id,request_reference,submitted_at desc);
alter table public.payment_submissions enable row level security;grant select on public.payment_submissions to authenticated;
create policy "Private payment submission review" on public.payment_submissions for select to authenticated using(owner_id=auth.uid() or public.has_staff_permission('payments'));

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('payment-proofs','payment-proofs',false,5242880,array['image/jpeg','image/png','image/webp','application/pdf']);
create policy "Upload owned payment proof" on storage.objects for insert to authenticated with check(bucket_id='payment-proofs' and (storage.foldername(name))[1]=auth.uid()::text and exists(select 1 from public.appointment_requests r where r.reference=(storage.foldername(name))[2] and r.owner_id=auth.uid() and r.status='APPROVED') and (select fee_tracking_enabled from public.office_settings where id=1));
create policy "Read private payment proof" on storage.objects for select to authenticated using(bucket_id='payment-proofs' and ((storage.foldername(name))[1]=auth.uid()::text or public.has_staff_permission('payments')));
create policy "Remove unsubmitted payment proof" on storage.objects for delete to authenticated using(bucket_id='payment-proofs' and (storage.foldername(name))[1]=auth.uid()::text and not exists(select 1 from public.payment_submissions p where p.proof_path=name));

create function public.save_payment_method(p_id uuid,p_name text,p_kind text,p_account_name text,p_account_details text,p_instructions text,p_active boolean,p_version integer default null) returns public.payment_methods language plpgsql security definer set search_path=public as $$
declare result public.payment_methods;begin
 perform public.require_staff_permission('settings');perform pg_advisory_xact_lock(hashtextextended('payment-method:'||p_id,0));
 select * into result from public.payment_methods where id=p_id;
 if found and result.version is distinct from p_version or not found and p_version is not null then raise exception 'Payment instructions changed. Reload and review before saving.';end if;
 insert into public.payment_methods(id,name,kind,account_name,account_details,instructions,active) values(p_id,btrim(p_name),p_kind,btrim(p_account_name),btrim(p_account_details),btrim(coalesce(p_instructions,'')),p_active)
 on conflict(id) do update set name=excluded.name,kind=excluded.kind,account_name=excluded.account_name,account_details=excluded.account_details,instructions=excluded.instructions,active=excluded.active,version=payment_methods.version+1,updated_at=now() returning * into result;return result;
end;$$;
create function public.set_fee_tracking(p_enabled boolean,p_revision integer) returns public.office_settings language plpgsql security definer set search_path=public as $$
declare result public.office_settings;begin perform public.require_staff_permission('settings');update public.office_settings set fee_tracking_enabled=p_enabled where id=1 and revision=p_revision returning * into result;if not found then raise exception 'Office settings changed. Reload before saving.';end if;return result;end;$$;

create function public.resident_payment_info(p_reference text) returns jsonb language plpgsql security definer set search_path=public as $$
declare request public.appointment_requests;service public.service_catalog;enabled boolean;begin
 select * into request from public.appointment_requests where reference=p_reference and owner_id=auth.uid();if not found then raise exception 'This payment request is unavailable.' using errcode='42501';end if;
 select * into service from public.service_catalog where request_type=request.request_type;if not found then select * into service from public.service_catalog where request_type='Other barangay document';end if;
 select fee_tracking_enabled into enabled from public.office_settings where id=1;
 return jsonb_build_object('enabled',enabled,'amount',service.fee_amount,'description',service.fee_description,'status',request.status,
 'paid',exists(select 1 from public.fee_records f where f.request_reference=p_reference and f.status in ('PAID','EXEMPT','WAIVED') and not exists(select 1 from public.fee_records c where c.previous_record=f.id)),
 'methods',case when enabled then(select coalesce(jsonb_agg(to_jsonb(m) order by name,id),'[]') from public.payment_methods m where active)else '[]'::jsonb end,
 'submissions',(select coalesce(jsonb_agg(to_jsonb(p) order by submitted_at desc,id),'[]') from public.payment_submissions p where p.request_reference=p_reference and p.owner_id=auth.uid()));
end;$$;

create function public.submit_payment_proof(p_id uuid,p_reference text,p_method uuid,p_amount numeric,p_transfer_reference text,p_proof text) returns public.payment_submissions language plpgsql security definer set search_path=public as $$
declare request public.appointment_requests;method public.payment_methods;service public.service_catalog;result public.payment_submissions;obj storage.objects;begin
 if auth.uid() is null then raise exception 'Sign in before submitting payment proof.' using errcode='42501';end if;
 perform pg_advisory_xact_lock(hashtextextended('fee-request:'||p_reference,0));
 select * into request from public.appointment_requests where reference=p_reference and owner_id=auth.uid();if not found then raise exception 'This payment request is unavailable.' using errcode='42501';end if;
 select * into result from public.payment_submissions where id=p_id;if found then
 if result.owner_id=auth.uid() and result.request_reference=p_reference and result.method_id=p_method and result.amount=p_amount and result.payer_reference=btrim(p_transfer_reference) and result.proof_path=p_proof then return result;end if;raise exception 'This submission identifier is already in use.';end if;
 if request.status<>'APPROVED' then raise exception 'Online payments are available after staff approves the request.';end if;
 if not(select fee_tracking_enabled from public.office_settings where id=1) then raise exception 'The office has not enabled fee recording.';end if;
 select * into method from public.payment_methods where id=p_method and active;if not found then raise exception 'Choose an available payment method.';end if;
 select * into service from public.service_catalog where request_type=request.request_type;if not found then select * into service from public.service_catalog where request_type='Other barangay document';end if;
 if service.fee_amount is null or service.fee_amount<=0 then raise exception 'Ask the office to confirm a payable fee before transferring money.';end if;
 if p_amount is distinct from service.fee_amount then raise exception 'The service fee changed. Reload the payment instructions.';end if;
 if exists(select 1 from public.fee_records f where f.request_reference=p_reference and f.status in ('PAID','EXEMPT','WAIVED') and not exists(select 1 from public.fee_records c where c.previous_record=f.id)) then raise exception 'A payment or fee exemption is already recorded for this request.';end if;
 if exists(select 1 from public.payment_submissions where request_reference=p_reference and status='PENDING') then raise exception 'Your earlier payment proof is awaiting review.';end if;
 if(select count(*) from public.payment_submissions where owner_id=auth.uid() and submitted_at>now()-interval '1 day')>=10 then raise exception 'Please contact the office before sending more payment proofs today.';end if;
 if p_proof not like auth.uid()::text||'/'||p_reference||'/'||p_id::text||'/%' then raise exception 'Upload proof for your own payment request.';end if;
 select * into obj from storage.objects where bucket_id='payment-proofs' and name=p_proof;
 if not found or obj.created_at<now()-interval '1 day' or coalesce((obj.metadata->>'size')::bigint,0) not between 1 and 5242880 or coalesce(obj.metadata->>'mimetype','') not in ('image/jpeg','image/png','image/webp','application/pdf') then raise exception 'Upload a valid payment proof file of up to 5 MB.';end if;
 insert into public.payment_submissions(id,owner_id,request_reference,method_id,method_snapshot,amount,payer_reference,proof_path) values(p_id,auth.uid(),p_reference,p_method,to_jsonb(method),p_amount,btrim(p_transfer_reference),p_proof) returning * into result;return result;
exception when unique_violation then raise exception 'This transfer reference or payment proof was already submitted. Check your payment history.';
end;$$;

create function public.record_office_fee(p_id uuid,p_reference text,p_walk_in uuid,p_amount numeric,p_status text,p_receipt text,p_note text,p_previous uuid default null,p_method text default 'Cash at barangay office',p_payer_reference text default null) returns public.fee_records language plpgsql security definer set search_path=public as $$
declare result public.fee_records;prior public.fee_records;was_existing boolean;begin
 perform public.require_staff_permission('payments');
 if p_status='PAID' and (p_amount is null or p_amount<=0) then raise exception 'Enter a payment amount greater than zero. Use Exempt or Fee waived for a zero fee.';end if;
 if p_method is null or char_length(btrim(p_method)) not between 1 and 100 then raise exception 'Choose or enter the payment method.';end if;
 if p_reference is not null then perform pg_advisory_xact_lock(hashtextextended('fee-request:'||p_reference,0));else perform pg_advisory_xact_lock(hashtextextended('fee-walk-in:'||p_walk_in,0));end if;
 select exists(select 1 from public.fee_records where id=p_id) into was_existing;
 if not was_existing and p_status in ('PAID','EXEMPT','WAIVED') and exists(select 1 from public.fee_records f where f.request_reference is not distinct from p_reference and f.walk_in_id is not distinct from p_walk_in and f.status in ('PAID','EXEMPT','WAIVED') and not exists(select 1 from public.fee_records c where c.previous_record=f.id)) then raise exception 'A payment or exemption is already recorded. Review or correct the existing entry first.';end if;
 result:=public.record_fee(p_id,p_reference,p_walk_in,p_amount,p_status,p_receipt,p_note,p_previous);
 if was_existing then if result.payment_method<>btrim(p_method) or result.payer_reference is distinct from nullif(btrim(p_payer_reference),'') then raise exception 'The saved payment has different method details. Reload its record.';end if;return result;end if;
 update public.fee_records set payment_method=btrim(p_method),payer_reference=nullif(btrim(p_payer_reference),'') where id=p_id returning * into result;return result;
exception when unique_violation then raise exception 'That receipt reference is already recorded. Enter a new official receipt or correction reference.';
end;$$;

create function public.review_payment_proof(p_id uuid,p_version integer,p_accept boolean,p_receipt text,p_note text) returns public.payment_submissions language plpgsql security definer set search_path=public as $$
declare result public.payment_submissions;fee public.fee_records;begin
 perform public.require_staff_permission('payments');select * into result from public.payment_submissions where id=p_id for update;if not found then raise exception 'Payment proof is unavailable.';end if;
 if result.status<>'PENDING' then raise exception 'This proof was already reviewed. Reload its payment record.';end if;
 if result.version<>p_version then raise exception 'Payment proof changed. Reload before reviewing.';end if;
 if p_accept then
 if not exists(select 1 from public.appointment_requests where reference=result.request_reference and status in ('APPROVED','COMPLETED')) then raise exception 'The appointment is no longer approved. Resolve the transfer with the resident before recording it.';end if;
 fee:=public.record_office_fee(result.id,result.request_reference,null,result.amount,'PAID',p_receipt,coalesce(nullif(btrim(p_note),''),'Online transfer verified by staff'),null,result.method_snapshot->>'name',result.payer_reference);
 else if char_length(btrim(coalesce(p_note,''))) not between 1 and 1000 then raise exception 'Explain why the payment proof needs correction.';end if;end if;
 update public.payment_submissions set status=case when p_accept then 'ACCEPTED' else 'DECLINED' end,review_note=btrim(coalesce(p_note,'')),reviewed_by=auth.uid(),reviewed_at=now(),fee_record_id=case when p_accept then fee.id else null end,version=version+1 where id=p_id returning * into result;return result;
end;$$;
revoke all on function public.save_payment_method(uuid,text,text,text,text,text,boolean,integer),public.set_fee_tracking(boolean,integer),public.resident_payment_info(text),public.submit_payment_proof(uuid,text,uuid,numeric,text,text),public.record_office_fee(uuid,text,uuid,numeric,text,text,text,uuid,text,text),public.review_payment_proof(uuid,integer,boolean,text,text) from public,anon;
grant execute on function public.save_payment_method(uuid,text,text,text,text,text,boolean,integer),public.set_fee_tracking(boolean,integer),public.resident_payment_info(text),public.submit_payment_proof(uuid,text,uuid,numeric,text,text),public.record_office_fee(uuid,text,uuid,numeric,text,text,text,uuid,text,text),public.review_payment_proof(uuid,integer,boolean,text,text) to authenticated;
create trigger audit_payment_methods after insert or update on public.payment_methods for each row execute function public.record_audit_change('id');
create trigger audit_payment_submissions after insert or update on public.payment_submissions for each row execute function public.record_audit_change('id');
alter publication supabase_realtime add table public.payment_methods,public.payment_submissions;
commit;
