begin;

create table public.staff_access (
  user_id uuid primary key references public.resident_profiles(id),
  active boolean not null default true,
  superadmin boolean not null default false,
  permissions text[] not null default '{}',
  version integer not null default 1,
  updated_at timestamptz not null default now(),
  check (permissions <@ array['requests','certificates','residents','concerns','schedules','content','settings','knowledge','reports','payments','audit']::text[])
);
-- Keep existing staff workflows available; only the explicitly selected account is bootstrapped as superadmin.
insert into public.staff_access(user_id,permissions)
select id,array['requests','certificates','residents','concerns','schedules','content','settings','knowledge','reports','payments','audit'] from public.resident_profiles where role='staff';

create function public.is_superadmin() returns boolean language sql stable security definer set search_path=public as $$
 select exists(select 1 from public.staff_access a join public.resident_profiles p on p.id=a.user_id
 where p.id=auth.uid() and p.role='staff' and a.active and a.superadmin);
$$;
create or replace function public.is_barangay_staff() returns boolean language sql stable security definer set search_path=public as $$
 select exists(select 1 from public.staff_access a join public.resident_profiles p on p.id=a.user_id
 where p.id=auth.uid() and p.role='staff' and a.active);
$$;
create function public.has_staff_permission(p_permission text) returns boolean language sql stable security definer set search_path=public as $$
 select exists(select 1 from public.staff_access a join public.resident_profiles p on p.id=a.user_id
 where p.id=auth.uid() and p.role='staff' and a.active and (a.superadmin or p_permission=any(a.permissions)));
$$;
create function public.require_staff_permission(p_permission text) returns void language plpgsql security definer set search_path=public as $$
begin if not public.has_staff_permission(p_permission) then raise exception 'You do not have permission to manage %.',p_permission; end if; end;
$$;
revoke all on function public.require_staff_permission(text) from public,anon,authenticated;
alter table public.staff_access enable row level security;
grant select on public.staff_access to authenticated;
grant all on public.staff_access to service_role;
create policy "Read own access or administrator" on public.staff_access for select to authenticated using(user_id=auth.uid() or public.is_superadmin());

create function public.bootstrap_superadmin(p_email text) returns boolean language plpgsql security definer set search_path=public as $$
declare target uuid;
begin
 perform pg_advisory_xact_lock(hashtextextended('barangay-superadmin-bootstrap',0));
 select p.id into target from public.resident_profiles p join auth.users u on u.id=p.id
 where lower(p.email)=lower(btrim(p_email)) and lower(u.email)=lower(btrim(p_email)) and u.email_confirmed_at is not null;
 if not found then raise exception 'The selected account must be an existing email-confirmed account.'; end if;
 if exists(select 1 from public.staff_access where superadmin and user_id<>target) then raise exception 'A different superadmin already exists. Use the staff access screen.'; end if;
 update public.resident_profiles set role='staff' where id=target;
 insert into public.staff_access(user_id,active,superadmin) values(target,true,true)
 on conflict(user_id) do update set active=true,superadmin=true,version=staff_access.version+1,updated_at=now();
 return true;
end;
$$;
revoke all on function public.bootstrap_superadmin(text) from public,anon,authenticated;
grant execute on function public.bootstrap_superadmin(text) to service_role;

create function public.set_staff_access(p_user uuid,p_version integer,p_active boolean,p_superadmin boolean,p_permissions text[]) returns public.staff_access
language plpgsql security definer set search_path=public as $$
declare result public.staff_access;
begin
 if not public.is_superadmin() then raise exception 'Superadmin access required.'; end if;
 perform pg_advisory_xact_lock(hashtextextended('barangay-superadmin-bootstrap',0));
 if p_user=auth.uid() and (not p_active or not p_superadmin) then raise exception 'Ask another superadmin to change your administrator access.'; end if;
 if not exists(select 1 from public.resident_profiles where id=p_user) then raise exception 'Account not found.'; end if;
 select * into result from public.staff_access where user_id=p_user for update;
 if found and (p_version is null or result.version<>p_version) then raise exception 'Staff access changed. Refresh before saving.'; end if;
 if not found and p_version is not null then raise exception 'Refresh the staff account before saving.'; end if;
 update public.resident_profiles set role='staff' where id=p_user;
 insert into public.staff_access(user_id,active,superadmin,permissions) values(p_user,p_active,p_superadmin,coalesce(p_permissions,'{}'))
 on conflict(user_id) do update set active=excluded.active,superadmin=excluded.superadmin,permissions=excluded.permissions,version=staff_access.version+1,updated_at=now()
 returning * into result;
 return result;
end;
$$;
revoke all on function public.set_staff_access(uuid,integer,boolean,boolean,text[]) from public,anon;
grant execute on function public.set_staff_access(uuid,integer,boolean,boolean,text[]) to authenticated;

create table public.audit_log (
 id uuid primary key default gen_random_uuid(),actor_id uuid,actor_name text not null,
 entity text not null,record_id text not null,action text not null,before_data jsonb,after_data jsonb,created_at timestamptz not null default now()
);
create index audit_log_created_idx on public.audit_log(created_at desc,id);
alter table public.audit_log enable row level security;
grant select on public.audit_log to authenticated;
create policy "Authorized audit access" on public.audit_log for select to authenticated using(public.has_staff_permission('audit'));
create function public.record_audit_change() returns trigger language plpgsql security definer set search_path=public as $$
declare before_row jsonb; after_row jsonb; actor text; record_key text;
begin
 if TG_OP<>'INSERT' then before_row:=to_jsonb(old); end if;
 if TG_OP<>'DELETE' then after_row:=to_jsonb(new); end if;
 if before_row is not distinct from after_row then return coalesce(new,old); end if;
 select first_name||' '||last_name into actor from public.resident_profiles where id=auth.uid();
 record_key:=coalesce(after_row->>TG_ARGV[0],before_row->>TG_ARGV[0],'');
 insert into public.audit_log(actor_id,actor_name,entity,record_id,action,before_data,after_data)
 values(auth.uid(),coalesce(actor,'System'),TG_TABLE_NAME,record_key,TG_OP,before_row-'embedding',after_row-'embedding');
 return coalesce(new,old);
end;
$$;
revoke all on function public.record_audit_change() from public,anon,authenticated;
create function public.protect_staff_write() returns trigger language plpgsql security definer set search_path=public as $$
begin
 if auth.role()='service_role' then return coalesce(new,old); end if;
 perform public.require_staff_permission(TG_ARGV[0]); return coalesce(new,old);
end;
$$;
revoke all on function public.protect_staff_write() from public,anon,authenticated;

create trigger audit_staff_access after insert or update or delete on public.staff_access for each row execute function public.record_audit_change('user_id');
create trigger audit_profiles after insert or update on public.resident_profiles for each row execute function public.record_audit_change('id');
create trigger audit_requests after insert or update on public.appointment_requests for each row execute function public.record_audit_change('reference');
create trigger audit_concerns after insert or update on public.resident_concerns for each row execute function public.record_audit_change('reference');
create trigger audit_services after insert or update on public.service_catalog for each row execute function public.record_audit_change('request_type');
create trigger audit_office after update on public.office_settings for each row execute function public.record_audit_change('id');
create trigger audit_slots after insert or update on public.appointment_slots for each row execute function public.record_audit_change('label');
create trigger audit_closures after insert or update or delete on public.office_closures for each row execute function public.record_audit_change('closed_date');
create trigger audit_posts after insert or update on public.public_posts for each row execute function public.record_audit_change('id');
create trigger audit_shifts after insert or update on public.walk_in_shifts for each row execute function public.record_audit_change('id');
create trigger audit_knowledge after insert or update or delete on public.chatbot_knowledge for each row execute function public.record_audit_change('id');
create trigger authorize_services before insert or update on public.service_catalog for each row execute function public.protect_staff_write('settings');
create trigger authorize_office before update on public.office_settings for each row execute function public.protect_staff_write('settings');
create trigger authorize_slots before insert or update on public.appointment_slots for each row execute function public.protect_staff_write('settings');
create trigger authorize_closures before insert or update or delete on public.office_closures for each row execute function public.protect_staff_write('settings');
create trigger authorize_posts before insert or update or delete on public.public_posts for each row execute function public.protect_staff_write('content');
create trigger authorize_shifts before insert or update or delete on public.walk_in_shifts for each row execute function public.protect_staff_write('schedules');

-- Apply permission checks inside security-definer appointment actions as well as ordinary table writes.
create function public.authorize_appointment_change() returns trigger language plpgsql security definer set search_path=public as $$
begin
 if auth.role()='service_role' or public.has_staff_permission('requests') then return new; end if;
 if old.owner_id=auth.uid() and new.status='CANCELLED' and old.status in ('PENDING','APPROVED') then return new; end if;
 raise exception 'You do not have permission to manage requests.';
end;
$$;
create trigger authorize_request_changes before update on public.appointment_requests for each row execute function public.authorize_appointment_change();

-- Replace broad SELECT policies with scoped access. Public service information stays public.
drop policy "Residents can read own profile; staff can read all" on public.resident_profiles;
create policy "Read own profile or permitted staff" on public.resident_profiles for select to authenticated
using(id=auth.uid() or public.has_staff_permission('residents') or public.has_staff_permission('certificates') or public.is_superadmin());
create policy "Staff update own contact profile" on public.resident_profiles for update to authenticated
using(id=auth.uid() and public.is_barangay_staff()) with check(id=auth.uid() and role='staff');
drop policy "Staff can update resident contact details" on public.resident_profiles;
create policy "Permitted staff update resident contacts" on public.resident_profiles for update to authenticated
using(public.has_staff_permission('residents') and role='resident') with check(public.has_staff_permission('residents') and role='resident');
drop policy "Residents read own requests; staff read all" on public.appointment_requests;
create policy "Read own requests or permitted staff" on public.appointment_requests for select to authenticated
using(owner_id=auth.uid() or public.has_staff_permission('requests') or public.has_staff_permission('certificates') or public.has_staff_permission('reports') or public.has_staff_permission('payments'));
drop policy "Staff update request status" on public.appointment_requests;
create policy "Permitted staff update requests" on public.appointment_requests for update to authenticated
using(public.has_staff_permission('requests')) with check(public.has_staff_permission('requests'));
drop policy "Residents read own concerns; staff read all" on public.resident_concerns;
create policy "Read own concerns or permitted staff" on public.resident_concerns for select to authenticated using(owner_id=auth.uid() or public.has_staff_permission('concerns'));
drop policy "Staff update concern status" on public.resident_concerns;
create policy "Permitted staff update concerns" on public.resident_concerns for update to authenticated using(public.has_staff_permission('concerns')) with check(public.has_staff_permission('concerns'));

alter table public.resident_concerns add column version integer not null default 1,add column resolution_note text;
create table public.concern_events (
 id uuid primary key default gen_random_uuid(),reference text not null references public.resident_concerns(reference),
 actor_id uuid,actor_name text not null,description text not null,status text not null,created_at timestamptz not null default now()
);
create table public.concern_messages (
 id uuid primary key default gen_random_uuid(),reference text not null references public.resident_concerns(reference),
 author_id uuid not null references public.resident_profiles(id),author_name text not null,staff boolean not null,
 internal boolean not null default false,body text not null check(char_length(btrim(body)) between 1 and 2000),created_at timestamptz not null default now()
);
create index concern_events_reference_idx on public.concern_events(reference,created_at);
create index concern_messages_reference_idx on public.concern_messages(reference,created_at);
alter table public.concern_events enable row level security; alter table public.concern_messages enable row level security;
grant select on public.concern_events,public.concern_messages to authenticated;
create policy "Concern participants read history" on public.concern_events for select to authenticated using(public.has_staff_permission('concerns') or exists(select 1 from public.resident_concerns c where c.reference=concern_events.reference and c.owner_id=auth.uid()));
create policy "Concern participants read permitted messages" on public.concern_messages for select to authenticated using(public.has_staff_permission('concerns') or (not internal and exists(select 1 from public.resident_concerns c where c.reference=concern_messages.reference and c.owner_id=auth.uid())));

create function public.protect_concern_record() returns trigger language plpgsql security definer set search_path=public as $$
declare actor text; description text;
begin
 if row(new.reference,new.owner_id,new.name,new.contact,new.category,new.message,new.submitted_at) is distinct from row(old.reference,old.owner_id,old.name,old.contact,old.category,old.message,old.submitted_at) then
 raise exception 'The original concern submission cannot be rewritten.'; end if;
 if new.status<>old.status or new.archived<>old.archived or new.resolution_note is distinct from old.resolution_note then
 perform public.require_staff_permission('concerns');
 if new.status='RESOLVED' and char_length(btrim(coalesce(new.resolution_note,''))) not between 1 and 2000 then raise exception 'Explain how the concern was resolved.'; end if;
 if old.status='RESOLVED' and new.status<>'RESOLVED' and char_length(btrim(coalesce(new.resolution_note,''))) not between 1 and 2000 then raise exception 'Provide a reason for reopening the concern.'; end if;
 select first_name||' '||last_name into actor from public.resident_profiles where id=auth.uid();
 description:=case when new.archived<>old.archived then case when new.archived then 'Concern archived.' else 'Concern restored.' end
 when new.status<>old.status then replace(new.status,'_',' ')||coalesce(': '||new.resolution_note,'') else 'Resolution note updated: '||new.resolution_note end;
 insert into public.concern_events(reference,actor_id,actor_name,description,status) values(old.reference,auth.uid(),coalesce(actor,'Staff'),description,new.status);
 end if;
 new.version:=old.version+1; return new;
end;
$$;
create trigger protect_concern_record before update on public.resident_concerns for each row execute function public.protect_concern_record();
create function public.manage_concern(p_reference text,p_version integer,p_status text default null,p_note text default null,p_archived boolean default null)
returns public.resident_concerns language plpgsql security definer set search_path=public as $$
declare result public.resident_concerns;
begin
 perform public.require_staff_permission('concerns');
 select * into result from public.resident_concerns where reference=p_reference for update;
 if not found then raise exception 'Concern not found.'; end if;
 if p_version is null or result.version<>p_version then raise exception 'The concern changed. Refresh before saving.'; end if;
 update public.resident_concerns set status=coalesce(p_status,status),resolution_note=case when p_note is null then resolution_note else btrim(p_note) end,archived=coalesce(p_archived,archived)
 where reference=p_reference returning * into result; return result;
end;
$$;
revoke all on function public.manage_concern(text,integer,text,text,boolean) from public,anon;
grant execute on function public.manage_concern(text,integer,text,text,boolean) to authenticated;
create function public.send_concern_message(p_reference text,p_id uuid,p_body text,p_internal boolean default false) returns public.concern_messages
language plpgsql security definer set search_path=public as $$
declare item public.resident_concerns; result public.concern_messages; staff boolean:=public.has_staff_permission('concerns'); actor text;
begin
 select * into item from public.resident_concerns where reference=p_reference for share;
 if auth.uid() is null or not found or (not staff and item.owner_id<>auth.uid()) or (p_internal and not staff) then raise exception 'Concern access denied.'; end if;
 if item.archived then raise exception 'Restore this concern before sending a message.'; end if;
 select first_name||' '||last_name into actor from public.resident_profiles where id=auth.uid();
 select * into result from public.concern_messages where id=p_id;
 if found then
 if result.reference<>p_reference or result.author_id<>auth.uid() or result.body<>btrim(p_body) or result.internal<>p_internal then raise exception 'The message identifier is already in use.'; end if;
 return result; end if;
 insert into public.concern_messages(id,reference,author_id,author_name,staff,internal,body) values(p_id,p_reference,auth.uid(),actor,staff,p_internal,btrim(p_body)) returning * into result;
 if staff and not p_internal then perform public.enqueue_resident_email('concern-reply:'||result.id,item.owner_id,item.reference,'concern_reply','Reply about concern '||item.reference,result.body||E'\n\nSign in to the portal to reply.'); end if;
 return result;
end;
$$;
revoke all on function public.send_concern_message(text,uuid,text,boolean) from public,anon;
grant execute on function public.send_concern_message(text,uuid,text,boolean) to authenticated;

create table public.staff_notifications (
 id uuid primary key default gen_random_uuid(),permission text not null,kind text not null,reference text,outbox_id uuid references public.notification_outbox(id),
 title text not null,body text not null,created_at timestamptz not null default now()
);
create table public.staff_notification_reads(user_id uuid not null references public.resident_profiles(id),notification_id uuid not null references public.staff_notifications(id),read_at timestamptz not null default now(),primary key(user_id,notification_id));
alter table public.staff_notifications enable row level security; alter table public.staff_notification_reads enable row level security;
grant select on public.staff_notifications,public.staff_notification_reads to authenticated;
grant insert on public.staff_notification_reads to authenticated;
create policy "Staff read relevant notifications" on public.staff_notifications for select to authenticated using(public.has_staff_permission(permission));
create policy "Own notification read markers" on public.staff_notification_reads for select to authenticated using(user_id=auth.uid());
create policy "Mark accessible notifications read" on public.staff_notification_reads for insert to authenticated with check(user_id=auth.uid() and exists(select 1 from public.staff_notifications n where n.id=notification_id and public.has_staff_permission(n.permission)));
create function public.notify_staff_event() returns trigger language plpgsql security definer set search_path=public as $$
begin
 if TG_TABLE_NAME='appointment_requests' then insert into public.staff_notifications(permission,kind,reference,title,body) values('requests','request',new.reference,'New document request',new.request_type);
 elsif TG_TABLE_NAME='resident_concerns' then insert into public.staff_notifications(permission,kind,reference,title,body) values('concerns','concern',new.reference,'New resident concern',new.category);
 elsif TG_TABLE_NAME='transaction_messages' then
   if new.author_role='Resident' then insert into public.staff_notifications(permission,kind,reference,title,body) values('requests','message',new.request_reference,'New resident message',left(new.body,160)); end if;
 elsif TG_TABLE_NAME='concern_messages' then
   if not new.staff then insert into public.staff_notifications(permission,kind,reference,title,body) values('concerns','concern',new.reference,'New concern follow-up',left(new.body,160)); end if;
 elsif TG_TABLE_NAME='notification_outbox' then
   if new.status in ('failed','needs_review') and new.status<>old.status then insert into public.staff_notifications(permission,kind,reference,outbox_id,title,body) values(case when new.kind like 'concern%' then 'concerns' when new.kind='certificate_register' then 'certificates' when new.kind='verification' then 'residents' else 'requests' end,'email',new.reference,new.id,'Email update needs attention',coalesce(new.last_error,'Review delivery status.')); end if;
 end if; return new;
end;
$$;
create trigger notify_new_requests after insert on public.appointment_requests for each row execute function public.notify_staff_event();
create trigger notify_new_concerns after insert on public.resident_concerns for each row execute function public.notify_staff_event();
create trigger notify_resident_messages after insert on public.transaction_messages for each row execute function public.notify_staff_event();
create trigger notify_concern_messages after insert on public.concern_messages for each row execute function public.notify_staff_event();
create trigger notify_failed_emails after update on public.notification_outbox for each row execute function public.notify_staff_event();

alter publication supabase_realtime add table public.staff_access,public.concern_events,public.concern_messages,public.staff_notifications,public.staff_notification_reads;
commit;
