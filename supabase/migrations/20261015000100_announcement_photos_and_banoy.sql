begin;

alter table public.public_posts add column image_path text;
alter table public.public_posts add column image_alt text not null default '' check (char_length(image_alt) <= 240);
alter table public.public_posts add constraint announcement_image_path check (
  image_path is null or image_path ~ '^[a-f0-9-]{36}/[a-f0-9-]{36}\.(jpg|png|webp)$'
);
insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values ('announcement-images', 'announcement-images', true, 5242880, array['image/jpeg','image/png','image/webp']);
create policy "Staff upload announcement photos" on storage.objects for insert to authenticated
with check (bucket_id = 'announcement-images' and public.is_barangay_staff());
create policy "Staff read announcement photos" on storage.objects for select to authenticated
using (bucket_id = 'announcement-images' and public.is_barangay_staff());
create policy "Staff remove unused announcement photos" on storage.objects for delete to authenticated
using (bucket_id = 'announcement-images' and public.is_barangay_staff()
  and not exists (select 1 from public.public_posts p where p.image_path = name));

create table public.chatbot_knowledge (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(btrim(title)) between 1 and 160),
  question text not null check (char_length(btrim(question)) between 1 and 500),
  answer text not null check (char_length(btrim(answer)) between 1 and 20000),
  examples text[] not null default '{}' check (cardinality(examples) <= 15 and char_length(array_to_string(examples, ' ')) <= 3000),
  active boolean not null default false,
  source_key text unique,
  embedding real[] check (embedding is null or cardinality(embedding) = 384),
  trained_at timestamptz,
  updated_at timestamptz not null default clock_timestamp(),
  created_at timestamptz not null default now()
);
create table public.chatbot_questions (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  question text not null check (char_length(btrim(question)) between 1 and 1000),
  knowledge_id uuid references public.chatbot_knowledge(id) on delete set null,
  answered boolean not null default false,
  helpful boolean,
  resolved boolean not null default false,
  created_at timestamptz not null default now()
);
create index chatbot_questions_owner_time on public.chatbot_questions(owner_id, created_at desc);
create index chatbot_questions_review on public.chatbot_questions(created_at desc) where not resolved;
alter table public.chatbot_knowledge enable row level security;
alter table public.chatbot_questions enable row level security;
revoke all on public.chatbot_knowledge, public.chatbot_questions from anon, authenticated;
grant select on public.chatbot_knowledge, public.chatbot_questions to authenticated;
grant insert(id, title, question, answer, examples, active) on public.chatbot_knowledge to authenticated;
grant update(title, question, answer, examples, active) on public.chatbot_knowledge to authenticated;
grant update(resolved) on public.chatbot_questions to authenticated;
grant all on public.chatbot_knowledge, public.chatbot_questions to service_role;
create policy "Staff read Banoy knowledge" on public.chatbot_knowledge for select to authenticated using (public.is_barangay_staff());
create policy "Staff add approved Banoy knowledge" on public.chatbot_knowledge for insert to authenticated with check (public.is_barangay_staff() and source_key is null);
create policy "Staff edit custom Banoy knowledge" on public.chatbot_knowledge for update to authenticated using (public.is_barangay_staff() and source_key is null) with check (public.is_barangay_staff() and source_key is null);
create policy "Staff review Banoy questions" on public.chatbot_questions for select to authenticated using (public.is_barangay_staff() or owner_id = auth.uid());
create policy "Staff resolve Banoy questions" on public.chatbot_questions for update to authenticated using (public.is_barangay_staff()) with check (public.is_barangay_staff());

create function public.invalidate_chatbot_embedding() returns trigger language plpgsql set search_path = public as $$
begin
  if row(new.title,new.question,new.answer,new.examples,new.active) is distinct from row(old.title,old.question,old.answer,old.examples,old.active) then
    new.embedding := null;
    new.trained_at := null;
    new.updated_at := clock_timestamp();
  end if;
  return new;
end;
$$;
create trigger invalidate_chatbot_embedding before update on public.chatbot_knowledge for each row execute function public.invalidate_chatbot_embedding();

-- Arrays hold normalized 384-dimensional model vectors. Only the server searches them.
create function public.match_chatbot_knowledge(query_embedding real[]) returns table(id uuid, similarity double precision)
language sql stable security invoker set search_path = public as $$
  select k.id, (select sum(v.x::double precision * v.y) from unnest(k.embedding, query_embedding) v(x,y)) as similarity
  from public.chatbot_knowledge k where k.active and k.embedding is not null and cardinality(query_embedding) = 384
  order by similarity desc limit 6;
$$;
revoke all on function public.match_chatbot_knowledge(real[]) from public, anon, authenticated;
grant execute on function public.match_chatbot_knowledge(real[]) to service_role;
create function public.chatbot_service_access() returns boolean language sql as $$ select true $$;
revoke all on function public.chatbot_service_access() from public, anon, authenticated;
grant execute on function public.chatbot_service_access() to service_role;

create function public.reserve_chatbot_question(p_question text) returns uuid language plpgsql security definer set search_path = public as $$
declare question_id uuid; caller uuid := auth.uid();
begin
  if caller is null then raise exception 'Sign in to ask Banoy.'; end if;
  if char_length(btrim(p_question)) not between 1 and 1000 then raise exception 'Use a question of 1 to 1000 characters.'; end if;
  perform pg_advisory_xact_lock(hashtextextended('banoy:' || caller::text, 0));
  if (select count(*) from public.chatbot_questions where owner_id = caller and created_at > now() - interval '1 minute') >= 15
    or (select count(*) from public.chatbot_questions where owner_id = caller and created_at > now() - interval '1 day') >= 150 then
    raise exception 'Please wait before sending more questions.';
  end if;
  insert into public.chatbot_questions(owner_id, question) values(caller, btrim(p_question)) returning id into question_id;
  return question_id;
end;
$$;
revoke all on function public.reserve_chatbot_question(text) from public, anon;
grant execute on function public.reserve_chatbot_question(text) to authenticated;

create function public.sync_banoy_sources() returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.chatbot_knowledge(title,question,answer,examples,active,source_key)
  select s.request_type, 'What are the requirements for ' || s.request_type || '?',
    s.request_type || E'\n\nRequirements:\n' || coalesce(nullif(s.requirements,''),'Not yet confirmed by staff. Contact the barangay office.') || E'\n\nFee: ' || coalesce(nullif(s.fee_description,''),'Not yet confirmed by staff.') || E'\nProcessing time: ' || coalesce(nullif(s.processing_time,''),'Confirm with the barangay office.') || E'\nFormat: ' || case when s.softcopy_available then 'Hardcopy, softcopy, or both' else 'Hardcopy only' end,
    array[s.request_type, s.request_type || ' requirements', s.request_type || ' fees', s.request_type || ' processing time'], s.active, 'service:' || s.request_type
  from public.service_catalog s
  on conflict(source_key) do update set title=excluded.title, question=excluded.question, answer=excluded.answer, examples=excluded.examples, active=excluded.active;
  insert into public.chatbot_knowledge(title,question,answer,examples,active,source_key)
  select p.title, 'What is the announcement about ' || left(p.title,120) || '?',
    p.title || E'\nPublished: ' || to_char(p.published_at at time zone 'Asia/Manila','FMMonth DD, YYYY') || E'\n\n' || p.content,
    array[p.title], not p.archived, 'post:' || p.id from public.public_posts p
  on conflict(source_key) do update set title=excluded.title, question=excluded.question, answer=excluded.answer, examples=excluded.examples, active=excluded.active;
  return null;
end;
$$;
revoke all on function public.sync_banoy_sources() from public;
create trigger sync_services_to_banoy after insert or update or delete on public.service_catalog for each statement execute function public.sync_banoy_sources();
create trigger sync_announcements_to_banoy after insert or update or delete on public.public_posts for each statement execute function public.sync_banoy_sources();
-- Run the source synchronization once without changing any existing service facts.
update public.service_catalog set active=active;

alter publication supabase_realtime add table public.chatbot_knowledge;
alter publication supabase_realtime add table public.chatbot_questions;
commit;
