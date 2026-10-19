import fs from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

export const residentA='00000000-0000-4000-8000-000000000001';
export const residentB='00000000-0000-4000-8000-000000000002';
export const staff='00000000-0000-4000-8000-000000000003';

export async function uploadBookingId(db,owner,reference){
 const path=`${owner}/${reference}/school-id.png`;
 await db.query("insert into storage.objects(bucket_id,name) values('resident-school-ids',$1)",[path]);
 return path;
}

export async function createTestDatabase({migrationRoles={}}={}) {
  const db=new PGlite();
  await db.exec(`
    create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth;
    create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz default now(),invited_at timestamptz,raw_user_meta_data jsonb default '{}');
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    create function auth.role() returns text language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claim.role',true),''),'service_role') $$;
    grant usage on schema auth to anon,authenticated,service_role;
    grant execute on function auth.uid(),auth.role() to anon,authenticated,service_role;
    create schema storage;
    create function storage.foldername(name text) returns text[] language sql immutable as $$ select (string_to_array(name,'/'))[1:array_length(string_to_array(name,'/'),1)-1] $$;
    create table storage.objects(id uuid default gen_random_uuid(),bucket_id text,name text,metadata jsonb,created_at timestamptz default now());
    alter table storage.objects enable row level security;
    grant usage on schema storage to authenticated,service_role;
    grant select,insert,delete on storage.objects to authenticated;
    create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
    create publication supabase_realtime;
  `);
  const migrations=new URL('../../supabase/migrations/',import.meta.url);
  for(const name of (await fs.readdir(migrations)).filter(name=>name.endsWith('.sql')).sort()) {
    try{if(migrationRoles[name])await db.query("select set_config('request.jwt.claim.role',$1,false)",[migrationRoles[name]]);await db.exec((await fs.readFile(new URL(name,migrations),'utf8')).replace('create extension if not exists pgcrypto;',''));if(migrationRoles[name])await db.query("select set_config('request.jwt.claim.role','',false)");}catch(error){await db.close();throw new Error(`${name}: ${error.message}`);}
  }
  for(const [id,first,last,email] of [[residentA,'Juan','Dela Cruz','a@example.test'],[residentB,'Maria','Santos','b@example.test'],[staff,'Test','Staff','staff@example.test']]) {
    await db.query('insert into auth.users(id,email,raw_user_meta_data) values($1,$2,$3)',[id,email,JSON.stringify({first_name:first,last_name:last,contact_number:'09931411699',address:'Barangay Lagasit'})]);
  }
  await db.query("update public.resident_profiles set role='staff' where id=$1",[staff]);
  await db.query("insert into public.staff_access(user_id,superadmin) values($1,true)",[staff]);
  const day=(await db.query(`select d::date::text as day from generate_series((now() at time zone 'Asia/Manila')::date+1,(now() at time zone 'Asia/Manila')::date+7,'1 day') d where extract(isodow from d)<6 limit 1`)).rows[0].day;
  const asUser=async(id,role='authenticated')=>{
    await db.exec('reset role');
    await db.query("select set_config('request.jwt.claim.sub',$1,false),set_config('request.jwt.claim.role',$2,false)",[id,role]);
    await db.exec(`set role ${role}`);
  };
  return {db,day,asUser};
}
