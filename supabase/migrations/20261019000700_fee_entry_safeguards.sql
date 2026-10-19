begin;

alter table public.service_catalog add constraint service_fee_is_finite check(fee_amount is null or fee_amount<>'NaN'::numeric);

-- Keep creation of the service and its numeric fee in one transaction.
create function public.create_document_service_with_fee(p_name text,p_requirements text,p_fee text,p_processing text,p_amount numeric default null)
returns public.service_catalog language plpgsql security definer set search_path=public as $$
declare result public.service_catalog;
begin
 perform public.require_staff_permission('settings');
 if p_amount is not null and (p_amount<0 or p_amount>9999999999.99 or p_amount<>round(p_amount,2) or p_amount::text in ('NaN','Infinity','-Infinity')) then
  raise exception 'Enter a fee of zero or more with up to two decimal places, or leave it unconfirmed.';
 end if;
 result:=public.create_document_service(p_name,p_requirements,p_fee,p_processing);
 update public.service_catalog set fee_amount=p_amount where request_type=result.request_type returning * into result;
 return result;
end;$$;
revoke all on function public.create_document_service_with_fee(text,text,text,text,numeric) from public,anon;
grant execute on function public.create_document_service_with_fee(text,text,text,text,numeric) to authenticated;

-- Protect both the original fee RPC and the newer office entry RPC.
create function public.guard_fee_entry() returns trigger language plpgsql security definer set search_path=public as $$
begin
 if new.request_reference is not null then
  perform pg_advisory_xact_lock(hashtextextended('fee-request:'||new.request_reference,0));
 else
  perform pg_advisory_xact_lock(hashtextextended('fee-walk-in:'||new.walk_in_id,0));
 end if;
 if new.amount='NaN'::numeric then raise exception 'Enter a valid numeric fee amount.';end if;
 if new.status='PAID' and new.amount<=0 then raise exception 'A paid record must be greater than zero. Use Exempt or Fee waived for a zero fee.';end if;
 if new.status in ('PAID','EXEMPT','WAIVED') and exists(
  select 1 from public.fee_records f where f.request_reference is not distinct from new.request_reference
   and f.walk_in_id is not distinct from new.walk_in_id and f.status in ('PAID','EXEMPT','WAIVED')
   and not exists(select 1 from public.fee_records c where c.previous_record=f.id)
 ) then raise exception 'A payment or exemption is already recorded. Review or correct the existing entry first.';end if;
 return new;
end;$$;
revoke all on function public.guard_fee_entry() from public,anon,authenticated;
create trigger guard_fee_entry before insert on public.fee_records for each row execute function public.guard_fee_entry();

create function public.service_fee_label(p_amount numeric,p_description text) returns text language sql immutable as $$
 select case when p_amount is null then coalesce(nullif(btrim(p_description),''),'Confirm the fee with the barangay office.')
 else (case when p_amount=0 then 'Free (no fee)' else 'PHP '||to_char(p_amount,'FM9999999990.00') end)
  ||case when nullif(btrim(p_description),'') is null then '' else ' · '||btrim(p_description) end end;
$$;

-- A numeric fee change must also update the approved chatbot answer.
create or replace function public.sync_banoy_sources() returns trigger language plpgsql security definer set search_path=public as $$
begin
 insert into public.chatbot_knowledge(title,question,answer,examples,active,source_key)
 select s.request_type,'What are the requirements for '||s.request_type||'?',
  s.request_type||E'\n\nRequirements:\n'||coalesce(nullif(s.requirements,''),'Not yet confirmed by staff. Contact the barangay office.')
  ||E'\n\nFee: '||public.service_fee_label(s.fee_amount,s.fee_description)
  ||E'\nProcessing time: '||coalesce(nullif(s.processing_time,''),'Confirm with the barangay office.')
  ||E'\nFormat: '||case when s.softcopy_available then 'Hardcopy, softcopy, or both' else 'Hardcopy only' end,
  array[s.request_type,s.request_type||' requirements',s.request_type||' fees',s.request_type||' processing time'],s.active,'service:'||s.request_type
 from public.service_catalog s
 on conflict(source_key) do update set title=excluded.title,question=excluded.question,answer=excluded.answer,examples=excluded.examples,active=excluded.active;
 insert into public.chatbot_knowledge(title,question,answer,examples,active,source_key)
 select p.title,'What is the announcement about '||left(p.title,120)||'?',
  p.title||E'\nPublished: '||to_char(p.published_at at time zone 'Asia/Manila','FMMonth DD, YYYY')||E'\n\n'||p.content,
  array[p.title],not p.archived,'post:'||p.id from public.public_posts p
 on conflict(source_key) do update set title=excluded.title,question=excluded.question,answer=excluded.answer,examples=excluded.examples,active=excluded.active;
 return null;
end;$$;
-- Existing numeric fees are unconfirmed. Staff service edits run the normal
-- source synchronization; migrations do not impersonate a signed-in editor.

commit;
