begin;

alter table public.site_content drop constraint site_content_key_check;
alter table public.site_content add constraint site_content_key_check check(key in ('mission','vision','about','officials','leadership'));

create or replace function public.save_site_content(p_key text,p_value jsonb,p_version integer default null) returns public.site_content
language plpgsql security definer set search_path=public as $$
declare result public.site_content; official jsonb; image_path text;
begin
 perform public.require_staff_permission('content');
 perform pg_advisory_xact_lock(hashtextextended('site-content:'||p_key,0));
 if p_key='leadership' then
  if jsonb_typeof(p_value) is distinct from 'object'
   or jsonb_typeof(p_value->'image') is distinct from 'string'
   or jsonb_typeof(p_value->'alt') is distinct from 'string'
   or char_length(btrim(coalesce(p_value->>'alt',''))) not between 1 and 240 then
   raise exception 'Choose a leadership image and describe the photo in up to 240 characters.';
  end if;
  image_path:=p_value->>'image';
  if image_path<>'officials/group photo.jpg' and image_path !~ '^official-images/[a-f0-9-]+\.(jpg|png|webp)$' then
   raise exception 'Choose the original leadership image or upload a JPG, PNG, or WebP photo.';
  end if;
  if image_path like 'official-images/%' and not exists(select 1 from storage.objects where bucket_id='official-images' and name=substr(image_path,17)) then
   raise exception 'Upload the leadership image before publishing.';
  end if;
  p_value:=jsonb_build_object('image',image_path,'alt',btrim(p_value->>'alt'));
 elsif p_key='officials' then
  if jsonb_typeof(p_value)<>'array' or jsonb_array_length(p_value)>50 then raise exception 'Provide up to 50 officials.'; end if;
  for official in select * from jsonb_array_elements(p_value) loop
   if char_length(btrim(coalesce(official->>'name',''))) not between 1 and 200 or char_length(btrim(coalesce(official->>'role',''))) not between 1 and 200
    or (coalesce(official->>'image','')<>'' and (official->>'image') !~ '^(officials/[A-Za-z0-9 ._()&-]+|official-images/[a-f0-9-]+\.(jpg|png|webp))$') then raise exception 'Provide each official name, role, and an available official image.'; end if;
   if (official->>'image') like 'official-images/%' and not exists(select 1 from storage.objects where bucket_id='official-images' and name=substr(official->>'image',17)) then raise exception 'Upload the official photo before publishing.';end if;
  end loop;
 elsif p_key in ('mission','vision','about') then
  if jsonb_typeof(p_value)<>'string' or char_length(btrim(p_value#>>'{}')) not between 1 and 4000 then raise exception 'Enter public text with up to 4000 characters.'; end if;
 else raise exception 'Unknown public content field.'; end if;
 select * into result from public.site_content where key=p_key for update;
 if (found and (p_version is null or result.version<>p_version)) or (not found and p_version is not null) then raise exception 'Public content changed. Refresh before saving.'; end if;
 insert into public.site_content(key,value,updated_by) values(p_key,p_value,auth.uid()) on conflict(key) do update set value=excluded.value,version=site_content.version+1,updated_at=now(),updated_by=auth.uid() returning * into result;
 return result;
end;
$$;

-- Publishing and draft cleanup share these locks so a published photo stays available.
create or replace function public.can_remove_official_image(p_path text) returns boolean language plpgsql security definer set search_path=public as $$
begin
 if not public.has_staff_permission('content') then return false;end if;
 perform pg_advisory_xact_lock(hashtextextended('site-content:leadership',0));
 perform pg_advisory_xact_lock(hashtextextended('site-content:officials',0));
 return not exists(select 1 from public.site_content c where c.key='leadership' and c.value->>'image'='official-images/'||p_path)
  and not exists(select 1 from public.site_content c cross join lateral jsonb_array_elements(case when c.key='officials' then c.value else '[]'::jsonb end) item where c.key='officials' and item->>'image'='official-images/'||p_path);
end;
$$;

commit;
