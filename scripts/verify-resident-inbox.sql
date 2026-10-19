-- Inspect only aggregate counts and flags; do not return resident data.
begin;
do $$ begin
 perform set_config('request.jwt.claim.sub',(
  select p.id::text from public.resident_profiles p join public.staff_access a on a.user_id=p.id
  where p.role='staff' and a.active and a.superadmin limit 1
 ),true);
 perform set_config('request.jwt.claim.role','authenticated',true);
end;$$;
set local role authenticated;
select jsonb_build_object(
 'inbox_loaded',result ? 'rows',
 'returned_records',jsonb_array_length(result->'rows'),
 'total_records',result->'total',
 'unread_records',result->'unread',
 'activity_triggers_installed',(select count(*)=7 from pg_trigger where not tgisinternal and tgname in ('notify_resident_accounts','notify_resident_evidence','notify_request_uploads','notify_resident_cancellation','notify_banoy_review','notify_fee_records','notify_certificate_records')),
 'notification_rls_enabled',(select relrowsecurity from pg_class where oid='public.staff_notifications'::regclass),
 'trigger_helper_is_private',not has_function_privilege('authenticated','public.notify_resident_activity()','execute'),
 'feature_filter_works',(select bool_and(item->>'permission'='knowledge') from jsonb_array_elements(public.staff_inbox(0,false,'','oldest','knowledge')->'rows') item),
 'legacy_calls_work',public.staff_inbox(0,false) ? 'rows'
) as checks from (select public.staff_inbox(0,false,'','unread_first','') result) checked;
rollback;
