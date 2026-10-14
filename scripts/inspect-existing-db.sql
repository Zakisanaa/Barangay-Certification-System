select jsonb_build_object(
  'tables', (select jsonb_agg(t) from (
    select table_name, string_agg(column_name, ', ' order by ordinal_position) as columns
    from information_schema.columns
    where table_schema = 'public' and table_name in (
      'resident_profiles', 'appointment_requests', 'transaction_messages', 'resident_concerns',
      'service_catalog', 'office_settings', 'appointment_slots', 'office_closures',
      'request_events', 'certificate_deliveries', 'email_webhook_events'
    ) group by table_name order by table_name
  ) t),
  'policies', (select jsonb_agg(p) from (select tablename, policyname from pg_policies where schemaname = 'public' order by tablename, policyname) p),
  'buckets', (select jsonb_agg(b) from (select id, public, file_size_limit from storage.buckets where id in ('certificate-templates', 'completed-certificates', 'resident-school-ids')) b)
) as existing_schema;
