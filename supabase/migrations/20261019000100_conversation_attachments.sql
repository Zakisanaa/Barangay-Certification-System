begin;
create table public.chat_attachments(
 id uuid primary key,kind text not null check(kind in ('request','concern')),reference text not null,
 request_message_id uuid references public.transaction_messages(id),concern_message_id uuid references public.concern_messages(id),
 uploaded_by uuid not null references public.resident_profiles(id),storage_path text not null unique,
 file_name text not null check(char_length(file_name) between 1 and 180 and file_name !~ '[[:cntrl:]/\\]'),
 mime_type text not null check(mime_type in ('image/jpeg','image/png','image/webp','application/pdf','application/vnd.openxmlformats-officedocument.wordprocessingml.document','text/plain')),
 file_size integer not null check(file_size between 1 and 5242880),created_at timestamptz not null default now(),
 check((kind='request' and request_message_id is not null and concern_message_id is null) or (kind='concern' and concern_message_id is not null and request_message_id is null))
);
create index chat_attachments_thread_idx on public.chat_attachments(kind,reference,created_at,id);
create index chat_attachments_request_message_idx on public.chat_attachments(request_message_id);
create index chat_attachments_concern_message_idx on public.chat_attachments(concern_message_id);
alter table public.chat_attachments enable row level security;
grant select on public.chat_attachments to authenticated;
grant all on public.chat_attachments to service_role;

create function public.can_read_chat_attachment(p_id uuid) returns boolean language sql stable security definer set search_path=public as $$
 select exists(select 1 from public.chat_attachments a join public.transaction_messages m on m.id=a.request_message_id join public.appointment_requests r on r.reference=m.request_reference where a.id=p_id and a.kind='request' and a.reference=r.reference and (r.owner_id=auth.uid() or public.has_staff_permission('requests')))
 or exists(select 1 from public.chat_attachments a join public.concern_messages m on m.id=a.concern_message_id join public.resident_concerns c on c.reference=m.reference where a.id=p_id and a.kind='concern' and a.reference=c.reference and (public.has_staff_permission('concerns') or (not m.internal and c.owner_id=auth.uid())));
$$;
revoke all on function public.can_read_chat_attachment(uuid) from public,anon;
grant execute on function public.can_read_chat_attachment(uuid) to authenticated;
create policy "Conversation participants read attached files" on public.chat_attachments for select to authenticated using(public.can_read_chat_attachment(id));

create function public.can_upload_chat_files() returns boolean language sql stable security definer set search_path=public as $$
 select exists(select 1 from public.resident_profiles where id=auth.uid() and (role='resident' or public.is_barangay_staff()));
$$;
revoke all on function public.can_upload_chat_files() from public,anon;
grant execute on function public.can_upload_chat_files() to authenticated;
create function public.can_read_chat_file(p_path text) returns boolean language plpgsql stable security definer set search_path=public as $$
declare attachment uuid;
begin
 select id into attachment from public.chat_attachments where storage_path=p_path;
 if found then return public.can_read_chat_attachment(attachment);end if;
 return split_part(p_path,'/',1)=auth.uid()::text and public.can_upload_chat_files();
end;
$$;
create function public.can_remove_chat_file(p_path text) returns boolean language plpgsql security definer set search_path=public as $$
begin
 if split_part(p_path,'/',1) is distinct from auth.uid()::text or not public.can_upload_chat_files() then return false;end if;
 perform pg_advisory_xact_lock(hashtextextended('private-upload:conversation-attachments:'||p_path,0));
 return not exists(select 1 from public.chat_attachments where storage_path=p_path);
end;
$$;
revoke all on function public.can_read_chat_file(text),public.can_remove_chat_file(text) from public,anon;
grant execute on function public.can_read_chat_file(text),public.can_remove_chat_file(text) to authenticated;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('conversation-attachments','conversation-attachments',false,5242880,array['image/jpeg','image/png','image/webp','application/pdf','application/vnd.openxmlformats-officedocument.wordprocessingml.document','text/plain']);
create policy "Participants upload their own conversation files" on storage.objects for insert to authenticated with check(bucket_id='conversation-attachments' and split_part(name,'/',1)=auth.uid()::text and split_part(name,'/',2) in ('request','concern') and public.can_upload_chat_files());
create policy "Private conversation file reading" on storage.objects for select to authenticated using(bucket_id='conversation-attachments' and public.can_read_chat_file(name));
create policy "Remove only unsubmitted conversation files" on storage.objects for delete to authenticated using(bucket_id='conversation-attachments' and public.can_remove_chat_file(name));

create function public.store_chat_attachments(p_kind text,p_reference text,p_message uuid,p_files jsonb,p_existing boolean) returns void language plpgsql security definer set search_path=public as $$
declare entry jsonb;path text;filename text;mime text;bytes integer;actual jsonb;expected jsonb;
begin
 if p_files is null or jsonb_typeof(p_files)<>'array' or jsonb_array_length(p_files)>3 then raise exception 'Attach up to three files per message.';end if;
 if p_existing then
 select coalesce(jsonb_agg(jsonb_build_object('id',id::text,'storage_path',storage_path,'file_name',file_name) order by id),'[]') into actual from public.chat_attachments where kind=p_kind and case when p_kind='request' then request_message_id=p_message else concern_message_id=p_message end;
 select coalesce(jsonb_agg(jsonb_build_object('id',(value->>'id')::uuid::text,'storage_path',value->>'storage_path','file_name',btrim(value->>'file_name')) order by (value->>'id')::uuid),'[]') into expected from jsonb_array_elements(p_files);
 if actual<>expected then raise exception 'This message was already saved with different attachments. Reload the conversation before sending another message.';end if;return;
 end if;
 for entry in select * from jsonb_array_elements(p_files) loop
 path:=entry->>'storage_path';filename:=btrim(entry->>'file_name');
 if path is null or split_part(path,'/',1) is distinct from auth.uid()::text or split_part(path,'/',2) is distinct from p_kind or split_part(path,'/',3) is distinct from p_message::text or split_part(split_part(path,'/',4),'.',1) is distinct from (entry->>'id')::uuid::text or array_length(string_to_array(path,'/'),1)<>4 then raise exception 'Upload each attachment for your account and this message.';end if;
 if filename is null or char_length(filename) not between 1 and 180 or filename ~ '[[:cntrl:]/\\]' then raise exception 'Use a file name up to 180 characters without path separators.';end if;
 perform pg_advisory_xact_lock(hashtextextended('private-upload:conversation-attachments:'||path,0));
 select metadata->>'mimetype',(metadata->>'size')::integer into mime,bytes from storage.objects where bucket_id='conversation-attachments' and name=path;
 if not found or bytes is null or bytes not between 1 and 5242880 or mime is null then raise exception 'Upload a nonempty file up to 5 MB before sending.';end if;
 if not((mime='image/jpeg' and lower(filename)~'\.jpe?g$' and path~'\.jpg$') or (mime='image/png' and lower(filename)~'\.png$' and path~'\.png$') or (mime='image/webp' and lower(filename)~'\.webp$' and path~'\.webp$') or (mime='application/pdf' and lower(filename)~'\.pdf$' and path~'\.pdf$') or (mime='application/vnd.openxmlformats-officedocument.wordprocessingml.document' and lower(filename)~'\.docx$' and path~'\.docx$') or (mime='text/plain' and lower(filename)~'\.txt$' and path~'\.txt$')) then raise exception 'Use JPG, PNG, WebP, PDF, DOCX, or TXT attachments.';end if;
 insert into public.chat_attachments(id,kind,reference,request_message_id,concern_message_id,uploaded_by,storage_path,file_name,mime_type,file_size)
 values((entry->>'id')::uuid,p_kind,p_reference,case when p_kind='request' then p_message end,case when p_kind='concern' then p_message end,auth.uid(),path,filename,mime,bytes);
 end loop;
end;
$$;
revoke all on function public.store_chat_attachments(text,text,uuid,jsonb,boolean) from public,anon,authenticated;

create function public.send_transaction_message(p_reference text,p_id uuid,p_body text,p_attachments jsonb default '[]') returns public.transaction_messages language plpgsql security definer set search_path=public as $$
declare result public.transaction_messages;clean text:=public.trimmed_input(coalesce(p_body,''));existing boolean;
begin
 if auth.uid() is null or not exists(select 1 from public.appointment_requests where reference=p_reference and (owner_id=auth.uid() or public.has_staff_permission('requests'))) then raise exception 'Request conversation access denied.';end if;
 if jsonb_typeof(p_attachments) is distinct from 'array' or jsonb_array_length(p_attachments)>3 then raise exception 'Attach up to three files per message.';end if;
 if clean='' and jsonb_array_length(p_attachments)>0 then clean:='Sent an attachment.';end if;
 if char_length(clean) not between 1 and 1000 then raise exception 'Write a message up to 1000 characters or attach a file.';end if;
 insert into public.transaction_messages(id,request_reference,author_id,author_name,author_role,body)
 values(p_id,p_reference,auth.uid(),'','Resident',clean) on conflict(id) do nothing returning * into result;
 existing:=not found;
 if existing then select * into result from public.transaction_messages where id=p_id;end if;
 if result.request_reference<>p_reference or result.author_id<>auth.uid() or result.body<>clean then raise exception 'The message identifier is already in use.';end if;
 perform public.store_chat_attachments('request',p_reference,p_id,p_attachments,existing);return result;
end;
$$;
revoke all on function public.send_transaction_message(text,uuid,text,jsonb) from public,anon;
grant execute on function public.send_transaction_message(text,uuid,text,jsonb) to authenticated;

drop function public.send_concern_message(text,uuid,text,boolean);
create function public.send_concern_message(p_reference text,p_id uuid,p_body text,p_internal boolean default false,p_attachments jsonb default '[]') returns public.concern_messages language plpgsql security definer set search_path=public as $$
declare item public.resident_concerns;result public.concern_messages;staff boolean:=public.has_staff_permission('concerns');actor text;clean text:=public.trimmed_input(coalesce(p_body,''));existing boolean;
begin
 select * into item from public.resident_concerns where reference=p_reference for share;
 if auth.uid() is null or not found or (not staff and item.owner_id<>auth.uid()) or (p_internal and not staff) then raise exception 'Concern access denied.';end if;
 if item.archived then raise exception 'Restore this concern before sending a message.';end if;
 if jsonb_typeof(p_attachments) is distinct from 'array' or jsonb_array_length(p_attachments)>3 then raise exception 'Attach up to three files per message.';end if;
 if clean='' and jsonb_array_length(p_attachments)>0 then clean:='Sent an attachment.';end if;
 if char_length(clean) not between 1 and 2000 then raise exception 'Write a message up to 2000 characters or attach a file.';end if;
 select first_name||' '||last_name into actor from public.resident_profiles where id=auth.uid();
 insert into public.concern_messages(id,reference,author_id,author_name,staff,internal,body) values(p_id,p_reference,auth.uid(),actor,staff,p_internal,clean) on conflict(id) do nothing returning * into result;
 existing:=not found;
 if existing then select * into result from public.concern_messages where id=p_id;end if;
 if result.reference<>p_reference or result.author_id<>auth.uid() or result.body<>clean or result.internal<>p_internal then raise exception 'The message identifier is already in use.';end if;
 perform public.store_chat_attachments('concern',p_reference,p_id,p_attachments,existing);
 if not existing and staff and not p_internal then perform public.enqueue_resident_email('concern-reply:'||result.id,item.owner_id,item.reference,'concern_reply','Reply about concern '||item.reference,result.body||E'\n\nSign in to the portal to view attachments and reply.');end if;
 return result;
end;
$$;
revoke all on function public.send_concern_message(text,uuid,text,boolean,jsonb) from public,anon;
grant execute on function public.send_concern_message(text,uuid,text,boolean,jsonb) to authenticated;
create trigger audit_chat_attachments after insert on public.chat_attachments for each row execute function public.record_audit_change('id');
alter publication supabase_realtime add table public.chat_attachments;
commit;
