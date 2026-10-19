begin;
create function public.can_remove_unused_upload(p_bucket text,p_path text) returns boolean language plpgsql security definer set search_path=public as $$
begin
 if auth.uid() is null then return false;end if;
 if p_bucket in ('resident-evidence','request-attachments') then
 if split_part(p_path,'/',1)<>auth.uid()::text then return false;end if;
 elsif p_bucket='certificate-templates' then if not public.has_staff_permission('settings') then return false;end if;
 else return false;end if;
 perform pg_advisory_xact_lock(hashtextextended('private-upload:'||p_bucket||':'||p_path,0));
 if p_bucket='resident-evidence' then return not exists(select 1 from public.resident_evidence where storage_path=p_path);
 elsif p_bucket='request-attachments' then return not exists(select 1 from public.request_attachments where storage_path=p_path);
 else return not exists(select 1 from public.certificate_templates where storage_path=p_path);end if;
end;
$$;
revoke all on function public.can_remove_unused_upload(text,text) from public,anon;
grant execute on function public.can_remove_unused_upload(text,text) to authenticated;
create policy "Remove own unsubmitted evidence or requirements" on storage.objects for delete to authenticated using(bucket_id in ('resident-evidence','request-attachments','certificate-templates') and public.can_remove_unused_upload(bucket_id,name));

create function public.can_remove_official_image(p_path text) returns boolean language plpgsql security definer set search_path=public as $$
begin
 if not public.has_staff_permission('content') then return false;end if;
 perform pg_advisory_xact_lock(hashtextextended('site-content:officials',0));
 return not exists(select 1 from public.site_content c cross join lateral jsonb_array_elements(case when c.key='officials' then c.value else '[]'::jsonb end) item where c.key='officials' and item->>'image'='official-images/'||p_path);
end;
$$;
revoke all on function public.can_remove_official_image(text) from public,anon;
grant execute on function public.can_remove_official_image(text) to authenticated;
drop policy "Content staff remove unused official photos" on storage.objects;
create policy "Content staff remove unused official photos" on storage.objects for delete to authenticated using(bucket_id='official-images' and public.can_remove_official_image(name));

create function public.require_reviewed_documents() returns trigger language plpgsql security definer set search_path=public as $$
begin
 if new.status<>old.status and new.status in ('APPROVED','COMPLETED') and exists(select 1 from public.request_attachments where request_reference=new.reference and required and status not in ('ACCEPTED','REPLACED')) then raise exception 'Review and accept all required supporting documents first.';end if;return new;
end;
$$;
create trigger require_reviewed_documents before update on public.appointment_requests for each row execute function public.require_reviewed_documents();
create function public.require_capacity_review() returns trigger language plpgsql security definer set search_path=public as $$
declare highest integer;
begin
 perform pg_advisory_xact_lock(hashtextextended('barangay-booking-configuration',0));
 select coalesce(max(n),0) into highest from(select count(*)::int n from public.appointment_requests where time_slot=old.label and appointment_date>=(now() at time zone 'Asia/Manila')::date and status in ('PENDING','APPROVED') group by appointment_date)s;
 if highest>0 and (not new.active or new.capacity<highest) and current_setting('app.capacity_reviewed',true) is distinct from new.label||':'||new.capacity||':'||new.active then raise exception 'Review and acknowledge affected reservations before reducing capacity or disabling this slot.';end if;return new;
end;
$$;
create trigger require_capacity_review before update on public.appointment_slots for each row execute function public.require_capacity_review();
create function public.notify_certificate_register_change() returns trigger language plpgsql security definer set search_path=public as $$
declare owner uuid;
begin
 if new.request_reference is null then return new;end if;
 select owner_id into owner from public.appointment_requests where reference=new.request_reference;
 perform public.enqueue_resident_email('certificate-register:'||new.id||':'||new.version,owner,new.request_reference,'certificate_register','Certificate register update',new.register_number||': '||new.status||coalesce(E'\n'||new.revocation_reason,'')||E'\nSign in to view the certificate record.');return new;
end;
$$;
create trigger notify_certificate_register after insert or update on public.certificate_register for each row execute function public.notify_certificate_register_change();

insert into public.staff_notifications(permission,kind,reference,title,body)
select 'requests','request',reference,'Existing active appointment',request_type from public.appointment_requests where status in ('PENDING','APPROVED') and not archived;
insert into public.staff_notifications(permission,kind,reference,title,body)
select 'concerns','concern',reference,'Unresolved resident concern',category from public.resident_concerns where status<>'RESOLVED' and not archived;
insert into public.staff_notifications(permission,kind,reference,outbox_id,title,body)
select case when kind like 'concern%' then 'concerns' when kind='certificate_register' then 'certificates' when kind='verification' then 'residents' else 'requests' end,'email',reference,id,'Email update needs attention',coalesce(last_error,'Review delivery status.') from public.notification_outbox where status in ('failed','needs_review');
commit;
