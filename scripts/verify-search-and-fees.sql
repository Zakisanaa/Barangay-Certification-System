select jsonb_build_object(
 'migrations_applied',(select count(*)=3 from supabase_migrations.schema_migrations where version in ('20261019000500','20261019000600','20261019000700')),
 'sorted_portal_lists',to_regprocedure('public.portal_list_sorted(text,integer,integer,text,boolean,text,date,uuid,text)') is not null,
 'sorted_office_lists',to_regprocedure('public.office_record_list(text,integer,text,text,text,text)') is not null,
 'private_office_lists',not has_function_privilege('anon','public.office_record_list(text,integer,text,text,text,text)','EXECUTE'),
 'numeric_service_fee',exists(select 1 from information_schema.columns where table_schema='public' and table_name='service_catalog' and column_name='fee_amount' and data_type='numeric'),
 'finite_service_fees',exists(select 1 from pg_constraint where conrelid='public.service_catalog'::regclass and conname='service_fee_is_finite'),
 'atomic_service_creation',to_regprocedure('public.create_document_service_with_fee(text,text,text,text,numeric)') is not null,
 'guarded_fee_entries',exists(select 1 from pg_trigger where tgrelid='public.fee_records'::regclass and tgname='guard_fee_entry' and not tgisinternal),
 'fee_guard_not_client_callable',not has_function_privilege('authenticated','public.guard_fee_entry()','EXECUTE'),
 'fee_entry_requires_sign_in',not has_function_privilege('anon','public.record_office_fee(uuid,text,uuid,numeric,text,text,text,uuid,text,text)','EXECUTE'),
 'private_fee_records',(select relrowsecurity from pg_class where oid='public.fee_records'::regclass),
 'banoy_numeric_fee_sync',position('service_fee_label' in pg_get_functiondef('public.sync_banoy_sources()'::regprocedure))>0
) as verification;
