begin;
create or replace function public.portal_list(p_kind text,p_page integer default 0,p_size integer default 25,p_query text default '',p_archived boolean default null,p_status text default null,p_date date default null,p_owner uuid default null) returns jsonb language plpgsql security invoker set search_path=public as $$
declare tab text;search_fields text;sort text;predicate text;result jsonb;
begin
 if p_kind<>'posts' and auth.uid() is null and coalesce(auth.role(),'')<>'service_role' then raise exception 'permission denied: sign in to access private records.' using errcode='42501';end if;
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
commit;
