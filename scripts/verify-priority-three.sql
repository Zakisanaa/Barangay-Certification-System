select jsonb_build_object(
 'migration',exists(select 1 from supabase_migrations.schema_migrations where version='20261019000400'),
 'announcement_updated_at',exists(select 1 from information_schema.columns where table_schema='public' and table_name='public_posts' and column_name='updated_at' and is_nullable='YES'),
 'announcement_timestamp_guard',exists(select 1 from pg_trigger where tgrelid='public.public_posts'::regclass and tgname='stamp_announcement_update' and not tgisinternal),
 'banoy_snapshot_columns',(select count(*)=4 from information_schema.columns where table_schema='public' and table_name='chatbot_questions' and column_name in ('answer_text','answer_source','answer_method','answered_at')),
 'banoy_snapshot_guard',exists(select 1 from pg_trigger where tgrelid='public.chatbot_questions'::regclass and tgname='protect_banoy_answer_snapshot' and not tgisinternal),
 'snapshots_are_not_client_editable',not has_column_privilege('authenticated','public.chatbot_questions','answer_text','UPDATE'),
 'banoy_history_rls',(select relrowsecurity from pg_class where oid='public.chatbot_questions'::regclass),
 'active_slot_index_valid',exists(select 1 from pg_index where indexrelid=to_regclass('public.appointment_active_slot_counts_idx') and indisvalid),
 'owner_history_index_valid',exists(select 1 from pg_index where indexrelid=to_regclass('public.banoy_owner_history_idx') and indisvalid),
 'source_retirement_triggers',(select count(*)=2 from pg_trigger where tgname in ('retire_missing_post_sources','retire_missing_service_sources') and not tgisinternal),
 'source_retirement_not_client_callable',not has_function_privilege('anon','public.retire_missing_banoy_sources()','EXECUTE') and not has_function_privilege('authenticated','public.retire_missing_banoy_sources()','EXECUTE'),
 'no_active_orphaned_sources',not exists(select 1 from public.chatbot_knowledge k where k.active and ((k.source_key like 'post:%' and not exists(select 1 from public.public_posts p where k.source_key='post:'||p.id)) or (k.source_key like 'service:%' and not exists(select 1 from public.service_catalog s where k.source_key='service:'||s.request_type))))
) as verification;
