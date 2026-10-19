begin;
-- Separate RPC preserves clients using the original, fixed-order list contract.
create function public.portal_list_sorted(p_kind text,p_page integer default 0,p_size integer default 25,p_query text default '',p_archived boolean default null,p_status text default null,p_date date default null,p_owner uuid default null,p_sort text default 'newest') returns jsonb language plpgsql security invoker set search_path=public as $$
declare tab text;search_fields text;ordering text;predicate text;time_field text;name_field text;tie text;result jsonb;
begin
 if p_kind<>'posts' and auth.uid() is null then raise exception 'Permission denied: sign in to view private records.' using errcode='42501';end if;
 if p_page is null or p_page<0 or p_page>1000000 or p_size is null or p_size not between 1 and 100 or char_length(coalesce(p_query,''))>200 then raise exception 'Choose a valid page and search up to 200 characters.';end if;
 case p_kind
 when 'requests' then tab:='appointment_requests';search_fields:='reference,full_name,request_type,address';time_field:='submitted_at';name_field:='lower(full_name)';tie:='reference';predicate:='($2 is null or archived=$2) and ($3 is null or status=$3) and ($4 is null or appointment_date=$4) and ($5 is null or owner_id=$5)';
 when 'concerns' then tab:='resident_concerns';search_fields:='reference,name,contact,category,message';time_field:='submitted_at';name_field:='lower(name)';tie:='reference';predicate:='($2 is null or archived=$2) and ($3 is null or status=$3) and ($5 is null or owner_id=$5)';
 when 'residents' then tab:='resident_profiles';search_fields:='first_name,last_name,email,contact_number,address';time_field:='created_at';name_field:='lower(first_name),lower(last_name)';tie:='id';predicate:='role=''resident''';
 when 'posts' then tab:='public_posts';search_fields:='title,content';time_field:='published_at';name_field:='lower(title)';tie:='id';predicate:='($2 is null or archived=$2)';
 else raise exception 'Unknown list.';end case;
 case p_sort
 when 'newest' then ordering:=time_field||' desc';when 'oldest' then ordering:=time_field||' asc';
 when 'name_asc' then ordering:=name_field||' asc';when 'name_desc' then ordering:=replace(name_field,',',' desc,')||' desc';
 when 'date_asc' then if p_kind<>'requests' then raise exception 'Appointment sorting is only available for requests.';end if;ordering:='appointment_date asc,(select s.start_time from public.appointment_slots s where s.label=matched.time_slot) asc nulls last,time_slot asc';
 when 'date_desc' then if p_kind<>'requests' then raise exception 'Appointment sorting is only available for requests.';end if;ordering:='appointment_date desc,(select s.start_time from public.appointment_slots s where s.label=matched.time_slot) desc nulls last,time_slot desc';
 else raise exception 'Choose an available sort order.';end case;
 execute format('with matched as materialized(select * from public.%I where %s and strpos(lower(concat_ws('' '',%s)),lower(coalesce($1,'''')))>0) select jsonb_build_object(''total'',(select count(*) from matched),''rows'',coalesce((select jsonb_agg(to_jsonb(page)) from(select * from matched order by %s,%I limit $6 offset $7)page),''[]''))',tab,predicate,search_fields,ordering,tie) into result using btrim(p_query),p_archived,p_status,p_date,p_owner,p_size,p_page::bigint*p_size;return result;
end;$$;
revoke all on function public.portal_list_sorted(text,integer,integer,text,boolean,text,date,uuid,text) from public;
grant execute on function public.portal_list_sorted(text,integer,integer,text,boolean,text,date,uuid,text) to authenticated,anon;

create function public.office_record_list(p_kind text,p_page integer default 0,p_query text default '',p_sort text default 'newest',p_entity text default null,p_status text default null) returns jsonb language plpgsql security invoker set search_path=public as $$
declare source text;search text;ordering text;stamp text;result jsonb;
begin
 if auth.uid() is null then raise exception 'Sign in to view staff records.' using errcode='42501';end if;
 if p_page is null or p_page<0 or p_page>1000000 or char_length(coalesce(p_query,''))>200 then raise exception 'Choose a valid page and search up to 200 characters.';end if;
 case p_kind
 when 'fees' then if not(public.has_staff_permission('payments') or public.has_staff_permission('reports')) then raise exception 'Fee record access required.' using errcode='42501';end if;
 source:='select to_jsonb(r)||jsonb_build_object(''display_reference'',coalesce(r.request_reference,w.reference),''corrected'',exists(select 1 from public.fee_records c where c.previous_record=r.id),''correction_status'',(select c.status from public.fee_records c where c.previous_record=r.id limit 1)) data from public.fee_records r left join public.walk_in_transactions w on w.id=r.walk_in_id';stamp:='recorded_at';search:='display_reference,receipt_reference,note,status';
 when 'certificates' then if not(public.has_staff_permission('certificates') or public.has_staff_permission('reports')) then raise exception 'Certificate access required.' using errcode='42501';end if;
 source:='select to_jsonb(r)||jsonb_build_object(''display_reference'',coalesce(r.request_reference,w.reference)) data from public.certificate_register r left join public.walk_in_transactions w on w.id=r.walk_in_id';stamp:='issued_at';search:='display_reference,register_number,official_number,signatory,status';
 when 'audit' then perform public.require_staff_permission('audit');source:='select to_jsonb(r) data from public.audit_log r';stamp:='created_at';search:='entity,record_id,action,actor_name';
 when 'walk_ins' then if not(public.has_staff_permission('requests') or public.has_staff_permission('certificates') or public.has_staff_permission('payments') or public.has_staff_permission('reports')) then raise exception 'Walk-in access required.' using errcode='42501';end if;
 source:='select to_jsonb(r) data from public.walk_in_transactions r';stamp:='created_at';search:='reference,full_name,contact,request_type,status';
 else raise exception 'Unknown staff record list.';end case;
 case p_sort
 when 'newest' then ordering:=format('(data->>%L)::timestamptz desc',stamp);when 'oldest' then ordering:=format('(data->>%L)::timestamptz asc',stamp);
 when 'name_asc' then ordering:='lower(coalesce(data->>''full_name'',data->>''signatory'',data->>''actor_name'',data->>''display_reference'')) asc';
 when 'name_desc' then ordering:='lower(coalesce(data->>''full_name'',data->>''signatory'',data->>''actor_name'',data->>''display_reference'')) desc';
 when 'amount_high' then if p_kind<>'fees' then raise exception 'Amount sorting is only available for fees.';end if;ordering:='(data->>''amount'')::numeric desc';
 when 'amount_low' then if p_kind<>'fees' then raise exception 'Amount sorting is only available for fees.';end if;ordering:='(data->>''amount'')::numeric asc';
 else raise exception 'Choose an available sort order.';end case;
 select string_agg(format('data->>%L',x),',') into search from unnest(string_to_array(search,','))x;
 execute format('with source as (%s),matched as materialized(select data from source where ($2 is null or data->>''entity''=$2) and ($3 is null or data->>''status''=$3) and strpos(lower(concat_ws('' '',%s)),lower(coalesce($1,'''')))>0) select jsonb_build_object(''total'',(select count(*) from matched),''rows'',coalesce((select jsonb_agg(data) from(select data from matched order by %s,data->>''id'' limit 25 offset $4)p),''[]''),''summary'',(select jsonb_build_object(''net'',coalesce(sum(case when data->>''status''=''PAID'' then (data->>''amount'')::numeric when data->>''status'' in (''REFUNDED'',''VOIDED'') then -(data->>''amount'')::numeric else 0 end),0)) from matched where $5=''fees''))',source,search,ordering) into result using btrim(p_query),p_entity,p_status,p_page::bigint*25,p_kind;return result;
end;$$;
revoke all on function public.office_record_list(text,integer,text,text,text,text) from public,anon;
grant execute on function public.office_record_list(text,integer,text,text,text,text) to authenticated;
commit;
