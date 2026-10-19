begin;

-- Residents read only ledger entries attached to their own appointments,
-- including archived requests. No client-supplied owner identifier is accepted.
create function public.resident_fee_records(p_page integer default 0,p_query text default '',p_sort text default 'newest')
returns jsonb language plpgsql security invoker set search_path=public as $$
declare result jsonb;
begin
 if auth.uid() is null then raise exception 'Sign in to view your fee records.' using errcode='42501';end if;
 if p_page is null or p_page<0 or p_page>1000000 or char_length(coalesce(p_query,''))>200 then raise exception 'Choose a valid page and search up to 200 characters.';end if;
 if p_sort is null or p_sort not in ('newest','oldest','name_asc','name_desc','amount_high','amount_low') then raise exception 'Choose an available sort order.';end if;
 with matched as materialized(
  select f.id,f.request_reference,f.amount,f.currency,f.status,f.receipt_reference,f.note,f.recorded_at,f.previous_record,f.payment_method,
   r.request_type,r.status request_status,r.archived,
   exists(select 1 from public.fee_records c where c.previous_record=f.id) corrected,
   (select c.status from public.fee_records c where c.previous_record=f.id order by c.recorded_at,c.id limit 1) correction_status
  from public.fee_records f join public.appointment_requests r on r.reference=f.request_reference
  where r.owner_id=auth.uid()
   and strpos(lower(concat_ws(' ',f.request_reference,r.request_type,f.receipt_reference,f.note,f.status,f.payment_method,f.amount::text)),lower(btrim(coalesce(p_query,''))))>0
 ),page_rows as(
  select * from matched order by
   case when p_sort='newest' then recorded_at end desc,
   case when p_sort='oldest' then recorded_at end asc,
   case when p_sort='name_asc' then request_reference end asc,
   case when p_sort='name_desc' then request_reference end desc,
   case when p_sort='amount_high' then amount end desc,
   case when p_sort='amount_low' then amount end asc,id
  limit 25 offset p_page::bigint*25
 )
 select jsonb_build_object('total',(select count(*) from matched),
  'rows',coalesce((select jsonb_agg(to_jsonb(p)) from page_rows p),'[]'::jsonb),
  'net',coalesce((select sum(case when status='PAID' then amount when status in ('REFUNDED','VOIDED') then -amount else 0 end) from matched),0)) into result;
 return result;
end;$$;
revoke all on function public.resident_fee_records(integer,text,text) from public,anon;
grant execute on function public.resident_fee_records(integer,text,text) to authenticated;

commit;
