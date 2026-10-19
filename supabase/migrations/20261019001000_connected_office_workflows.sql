begin;

-- Internal projection exposes only the fields needed to identify a transaction.
-- Permission checks are performed by the two public entry points below.
create function public.office_transaction_rows()
returns table(kind text,id text,reference text,resident text,service text,service_key text,status text,archived boolean,transaction_date date,created_at timestamptz,fee_amount numeric,fee_description text,fee_recorded boolean,issued boolean)
language sql stable security definer set search_path=public as $$
 with transactions as(
  select 'appointment'::text kind,r.reference id,r.reference,r.full_name resident,r.request_type service,
   coalesce(r.service_key,(select s.request_type from public.service_catalog s where s.request_type=r.request_type),'Other barangay document') service_key,
   r.status,r.archived,r.appointment_date transaction_date,r.submitted_at created_at
  from public.appointment_requests r
  union all
  select 'walk_in',w.id::text,w.reference,w.full_name,w.request_type,w.request_type,w.status,false,(w.created_at at time zone 'Asia/Manila')::date,w.created_at
  from public.walk_in_transactions w
 )
 select t.*,s.fee_amount,coalesce(s.fee_description,''),
  exists(select 1 from public.fee_records f where (t.kind='appointment' and f.request_reference=t.id) or (t.kind='walk_in' and f.walk_in_id::text=t.id)),
  exists(select 1 from public.certificate_register c where c.status='ISSUED' and ((t.kind='appointment' and c.request_reference=t.id) or (t.kind='walk_in' and c.walk_in_id::text=t.id)))
 from transactions t left join public.service_catalog s on s.request_type=t.service_key;
$$;
revoke all on function public.office_transaction_rows() from public,anon,authenticated;

create function public.office_transaction_list(p_kind text,p_page integer default 0,p_query text default '',p_sort text default 'oldest',p_filter text default 'needs_recording')
returns jsonb language plpgsql stable security definer set search_path=public as $$
declare result jsonb;
begin
 if p_kind='fees' then perform public.require_staff_permission('payments');
 elsif p_kind='certificates' then perform public.require_staff_permission('certificates');
 else raise exception 'Choose fees or certificates.';end if;
 if p_page is null or p_page<0 or p_page>1000000 or char_length(coalesce(p_query,''))>200 then raise exception 'Choose a valid page and search up to 200 characters.';end if;
 if p_sort is null or p_sort not in ('oldest','newest','name_asc','name_desc') or p_filter is null or p_filter not in ('needs_recording','all') then raise exception 'Choose an available filter and sort order.';end if;
 with matched as materialized(
  select * from public.office_transaction_rows() t
  where not t.archived and ((t.kind='appointment' and t.status in ('APPROVED','COMPLETED'))
   or (t.kind='walk_in' and (t.status in ('IN_PROGRESS','COMPLETED') or (p_kind='fees' and t.status='WAITING'))))
   and (p_filter='all' or case when p_kind='fees' then not t.fee_recorded else not t.issued end)
   and strpos(lower(concat_ws(' ',t.reference,t.resident,t.service,t.status)),lower(btrim(coalesce(p_query,''))))>0
 ),page_rows as(
  select * from matched order by
   case when p_sort='oldest' then created_at end asc,
   case when p_sort='newest' then created_at end desc,
   case when p_sort='name_asc' then lower(resident) end asc,
   case when p_sort='name_desc' then lower(resident) end desc,reference
  limit 25 offset p_page::bigint*25
 )
 select jsonb_build_object('total',(select count(*) from matched),'rows',coalesce((select jsonb_agg(to_jsonb(p)) from page_rows p),'[]'::jsonb)) into result;
 return result;
end;$$;
revoke all on function public.office_transaction_list(text,integer,text,text,text) from public,anon;
grant execute on function public.office_transaction_list(text,integer,text,text,text) to authenticated;

-- Preserve the existing contract and add the catalog key/fee for custom names.
create or replace function public.find_office_transaction(p_reference text) returns jsonb
language plpgsql stable security definer set search_path=public as $$
declare result jsonb;
begin
 if not(public.has_staff_permission('requests') or public.has_staff_permission('certificates') or public.has_staff_permission('payments')) then raise exception 'Transaction access required.';end if;
 select to_jsonb(t) into result from public.office_transaction_rows() t where t.reference=btrim(p_reference) or (t.kind='walk_in' and t.id=btrim(p_reference));
 if result is null then raise exception 'No appointment or walk-in matches this reference.';end if;
 return result;
end;$$;

commit;
