-- Supabase supplies these extensions. Isolated database tests do not provide network/cron workers.
do $install$
begin
  if exists(select 1 from pg_available_extensions where name='pg_cron')
    and exists(select 1 from pg_available_extensions where name='pg_net') then
    create extension if not exists pg_cron;
    create extension if not exists pg_net;
  end if;
end;
$install$;

create function public.invoke_barangay_maintenance() returns bigint
language plpgsql security definer set search_path = public as $$
declare project_url text; worker_key text; request_id bigint;
begin
  select decrypted_secret into project_url from vault.decrypted_secrets where name='barangay_project_url';
  select decrypted_secret into worker_key from vault.decrypted_secrets where name='barangay_worker_service_key';
  if project_url is null or worker_key is null then
    raise exception 'Configure barangay_project_url and barangay_worker_service_key in Supabase Vault. See PRIORITY_ONE_SETUP.md.'; end if;
  if project_url !~ '^https://[a-z0-9-]+\.supabase\.co/?$' then raise exception 'The maintenance project URL must be the HTTPS Supabase project origin.'; end if;
  select net.http_post(url:=rtrim(project_url,'/') || '/functions/v1/process-notifications',
    headers:=jsonb_build_object('Content-Type','application/json','Authorization','Bearer ' || worker_key,'apikey',worker_key),
    body:='{}'::jsonb,timeout_milliseconds:=55000) into request_id;
  return request_id;
end;
$$;
revoke all on function public.invoke_barangay_maintenance() from public,anon,authenticated;
grant execute on function public.invoke_barangay_maintenance() to service_role;

-- Called over HTTPS by the setup script; never place the server key in SQL files or CLI arguments.
create function public.configure_barangay_maintenance(p_project_url text,p_worker_key text) returns boolean
language plpgsql security definer set search_path = public as $$
declare secret_id uuid;
begin
  if p_project_url is null or p_project_url !~ '^https://[a-z0-9-]+\.supabase\.co/?$'
    or p_worker_key is null or length(p_worker_key)<100 then
    raise exception 'Provide the linked Supabase origin and server service-role JWT.'; end if;
  perform pg_advisory_xact_lock(hashtextextended('barangay-maintenance-configuration',0));
  select id into secret_id from vault.secrets where name='barangay_project_url';
  if found then perform vault.update_secret(secret_id,rtrim(p_project_url,'/'));
  else perform vault.create_secret(rtrim(p_project_url,'/'),'barangay_project_url','Barangay maintenance project origin'); end if;
  select id into secret_id from vault.secrets where name='barangay_worker_service_key';
  if found then perform vault.update_secret(secret_id,p_worker_key);
  else perform vault.create_secret(p_worker_key,'barangay_worker_service_key','Server-only scheduled maintenance credential'); end if;
  return true;
end;
$$;
revoke all on function public.configure_barangay_maintenance(text,text) from public,anon,authenticated;
grant execute on function public.configure_barangay_maintenance(text,text) to service_role;

do $schedule$
begin
  if exists(select 1 from pg_extension where extname='pg_cron') and exists(select 1 from pg_extension where extname='pg_net') then
    perform cron.schedule('barangay-priority-one-maintenance','* * * * *','select public.invoke_barangay_maintenance();');
  end if;
end;
$schedule$;
