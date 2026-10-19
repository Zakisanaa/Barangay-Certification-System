begin;
alter table public.public_posts add column updated_at timestamptz;
create function public.stamp_announcement_update() returns trigger language plpgsql set search_path=public as $$begin
 if tg_op='INSERT' then new.updated_at:=now();elsif row(new.title,new.content,new.type,new.image_path,new.image_alt,new.archived) is distinct from row(old.title,old.content,old.type,old.image_path,old.image_alt,old.archived) then new.updated_at:=now();else new.updated_at:=old.updated_at;end if;return new;
end;$$;
create trigger stamp_announcement_update before insert or update on public.public_posts for each row execute function public.stamp_announcement_update();
alter table public.chatbot_questions add column answer_text text,add column answer_source text,add column answer_method text,add column answered_at timestamptz;
create function public.protect_banoy_answer_snapshot() returns trigger language plpgsql set search_path=public as $$begin
 if coalesce(auth.role(),'')<>'service_role' then
 if tg_op='INSERT' then if new.answer_text is not null or new.answer_source is not null or new.answer_method is not null or new.answered_at is not null then raise exception 'Banoy answer snapshots are server-managed.';end if;
 elsif row(new.answer_text,new.answer_source,new.answer_method,new.answered_at) is distinct from row(old.answer_text,old.answer_source,old.answer_method,old.answered_at) then raise exception 'Banoy answer snapshots are server-managed.';end if;end if;return new;
end;$$;
create trigger protect_banoy_answer_snapshot before insert or update on public.chatbot_questions for each row execute function public.protect_banoy_answer_snapshot();
create index appointment_active_slot_counts_idx on public.appointment_requests(appointment_date,time_slot) where status in ('PENDING','APPROVED');
create index banoy_owner_history_idx on public.chatbot_questions(owner_id,created_at desc,id desc);
-- Missing source records must never remain active approved knowledge.
create function public.retire_missing_banoy_sources() returns trigger language plpgsql security definer set search_path=public as $$begin
 update public.chatbot_knowledge k set active=false,embedding=null,trained_at=null where k.active and ((k.source_key like 'post:%' and not exists(select 1 from public.public_posts p where k.source_key='post:'||p.id)) or (k.source_key like 'service:%' and not exists(select 1 from public.service_catalog s where k.source_key='service:'||s.request_type)));return null;
end;$$;
revoke all on function public.retire_missing_banoy_sources() from public,anon,authenticated;
create trigger retire_missing_post_sources after delete on public.public_posts for each statement execute function public.retire_missing_banoy_sources();
create trigger retire_missing_service_sources after delete on public.service_catalog for each statement execute function public.retire_missing_banoy_sources();
-- Reconcile any source deleted before this migration, preserving its history.
update public.chatbot_knowledge k set active=false,embedding=null,trained_at=null where k.active and ((k.source_key like 'post:%' and not exists(select 1 from public.public_posts p where k.source_key='post:'||p.id)) or (k.source_key like 'service:%' and not exists(select 1 from public.service_catalog s where k.source_key='service:'||s.request_type)));
commit;
