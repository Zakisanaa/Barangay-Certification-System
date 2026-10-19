-- Inspect deployed notification access without reading private content or marking updates read.
begin;
do $$ begin
 perform set_config('request.jwt.claim.sub',(
  select p.id::text from public.resident_profiles p left join public.resident_notifications n on n.owner_id=p.id
  where p.role='resident' group by p.id order by count(n.id) desc limit 1
 ),true);
 perform set_config('request.jwt.claim.role','authenticated',true);
end;$$;
set local role authenticated;
select jsonb_build_object(
 'resident_feed_loaded',result ? 'rows',
 'returned_records',jsonb_array_length(result->'rows'),
 'total_records',result->'total',
 'unread_records',result->'unread',
 'rls_enabled',(select relrowsecurity from pg_class where oid='public.resident_notifications'::regclass),
 'published_for_realtime',exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='resident_notifications'),
 'source_triggers_installed',(select count(*)=3 from pg_trigger where not tgisinternal and tgname in ('resident_notice_email_event','resident_notice_fee_event','resident_notice_certificate_pdf')),
 'creation_helper_is_private',not has_function_privilege('authenticated','public.create_resident_notification()','execute'),
 'content_is_read_only',not has_table_privilege('authenticated','public.resident_notifications','insert,update,delete'),
 'only_owned_notifications_visible',not exists(select 1 from public.resident_notifications where owner_id<>auth.uid())
) as checks from (select public.resident_notification_feed(0) result) checked;
rollback;
