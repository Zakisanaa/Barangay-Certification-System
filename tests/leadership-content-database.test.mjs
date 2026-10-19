import {test,before,after,beforeEach,afterEach} from 'node:test';
import assert from 'node:assert/strict';
import {createTestDatabase,residentA,staff} from './helpers/database.mjs';
let db,asUser;
const path='a90c4acf-cac5-4d9f-9d90-24328a725113.png';
const image={image:'official-images/'+path,alt:'Barangay leaders at the office'};
before(async()=>{({db,asUser}=await createTestDatabase());});
after(async()=>{await db?.close();});
beforeEach(async()=>{await db.exec('begin');await asUser(staff);});
afterEach(async()=>{await db.exec('rollback;reset role');});
const save=(value,version=null)=>db.query("select * from public.save_site_content('leadership',$1,$2)",[JSON.stringify(value),version]);
async function rejected(work,pattern){await db.exec('savepoint denied');try{await assert.rejects(work,pattern);}finally{await db.exec('rollback to savepoint denied;release savepoint denied');}}
const upload=()=>db.query("insert into storage.objects(bucket_id,name) values('official-images',$1)",[path]);

test('leadership publishing is versioned, audited and readable on the public landing page',async()=>{
 await upload();const first=(await save(image)).rows[0];assert.equal(first.version,1);assert.deepEqual(first.value,image);
 await rejected(()=>save({...image,alt:'Stale edit'},0),/changed/);
 assert.deepEqual((await db.query("select value from public.site_content where key='leadership'")).rows[0].value,image);
 const second=(await save({...image,alt:'Updated leadership description'},first.version)).rows[0];assert.equal(second.version,2);
 const audit=(await db.query("select before_data,after_data from public.audit_log where entity='site_content' and record_id='leadership' order by created_at,id")).rows;
 assert.equal(audit.length,2);assert.ok(audit.some(row=>row.before_data?.value.alt===image.alt&&row.after_data.value.alt==='Updated leadership description'));
 await asUser('','anon');assert.equal((await db.query("select value->>'alt' as alt from public.site_content where key='leadership'")).rows[0].alt,'Updated leadership description');
});

test('leadership publishing rejects missing photos, external URLs and invalid image descriptions',async()=>{
 await rejected(()=>save(image),/Upload.*before publishing/);
 await upload();
 for(const value of [null,[],{}, {...image,image:null},{...image,image:'https://example.test/image.png'},{...image,image:'officials/../private.png'},{...image,image:'officials/different.jpg'},{...image,alt:''},{...image,alt:'x'.repeat(241)}])await rejected(()=>save(value),/leadership image|describe the photo/);
 assert.equal((await db.query("select count(*)::int n from public.site_content where key='leadership'")).rows[0].n,0);
});

test('draft cleanup cannot delete a published leadership image or a photo used in the official list',async()=>{
 await upload();const first=(await save(image)).rows[0];
 assert.equal((await db.query("delete from storage.objects where bucket_id='official-images' and name=$1 returning name",[path])).rows.length,0);
 const original={image:'officials/group photo.jpg',alt:'Original barangay leadership photo'};
 await save(original,first.version);
 await db.query("select public.save_site_content('officials',$1,null)",[JSON.stringify([{name:'Test official',role:'Punong Barangay',image:image.image}])]);
 assert.equal((await db.query("delete from storage.objects where bucket_id='official-images' and name=$1 returning name",[path])).rows.length,0);
 await db.query("select public.save_site_content('officials','[]',1)");
 assert.equal((await db.query("delete from storage.objects where bucket_id='official-images' and name=$1 returning name",[path])).rows.length,1);
});

test('only staff with public-content permission can upload or publish leadership photos',async()=>{
 await asUser(residentA);await rejected(()=>save({image:'officials/group photo.jpg',alt:'Unauthorized'}),/permission/);
 await rejected(()=>upload(),/row-level security/);
 await db.exec('reset role');await db.query("update public.staff_access set superadmin=false,permissions=array['requests'] where user_id=$1",[staff]);
 await asUser(staff);await rejected(()=>save({image:'officials/group photo.jpg',alt:'Unauthorized'}),/permission/);
 await db.exec('reset role');await db.query("update public.staff_access set permissions=array['content'] where user_id=$1",[staff]);
 await asUser(staff);await upload();assert.equal((await save(image)).rows[0].value.image,image.image);
});

const saveStatement=(key,value,version=null)=>db.query('select * from public.save_site_content($1,$2,$3)',[key,JSON.stringify(value),version]);

test('mission and vision retain existing text when upgraded to versioned, audited text and images',async()=>{
 await upload();
 for(const key of ['mission','vision']){
  const legacy=(await saveStatement(key,'Existing '+key)).rows[0];
  assert.equal(legacy.value,'Existing '+key);
  const value={text:'Updated '+key+'\nOffice-approved second paragraph.',...image};
  const saved=(await saveStatement(key,value,legacy.version)).rows[0];
  assert.equal(saved.version,2);assert.deepEqual(saved.value,value);
  await rejected(()=>saveStatement(key,{...value,text:'Stale edit'},legacy.version),/changed/);
  assert.equal((await db.query("select count(*)::int n from public.audit_log where entity='site_content' and record_id=$1",[key])).rows[0].n,2);
 }
 await asUser('','anon');
 const rows=(await db.query("select key,value from public.site_content where key in ('mission','vision') order by key")).rows;
 assert.equal(rows.length,2);assert.ok(rows.every(row=>row.value.image===image.image&&row.value.text.startsWith('Updated '+row.key)));
});

test('mission and vision images require a real upload, valid local path, text and accessible descriptions',async()=>{
 const value={text:'Office-approved mission',...image};
 await rejected(()=>saveStatement('mission',value),/Upload.*before publishing/);
 await upload();
 for(const invalid of [null,[],{}, {...value,text:null},{...value,text:' '},{...value,text:'x'.repeat(4001)},{...value,image:null},{...value,image:'https://example.test/image.png'},{...value,image:'official-images/../private.png'},{...value,alt:null},{...value,alt:''},{...value,alt:'x'.repeat(241)}]){
  await rejected(()=>saveStatement('mission',invalid),/public text|mission or vision|Describe|Upload/);
 }
 assert.equal((await db.query("select count(*)::int n from public.site_content where key='mission'")).rows[0].n,0);
 const textOnly=(await saveStatement('vision',{text:'  Text without a photo.  ',image:'',alt:'Unused description'})).rows[0];
 assert.deepEqual(textOnly.value,{text:'Text without a photo.',image:'',alt:''});
});

test('shared mission and vision photos survive cleanup until every published reference is removed',async()=>{
 await upload();
 const value={text:'Office-approved statement',...image};
 for(const key of ['mission','vision'])await saveStatement(key,value);
 const remove=()=>db.query("delete from storage.objects where bucket_id='official-images' and name=$1 returning name",[path]);
 assert.equal((await remove()).rows.length,0);
 await saveStatement('mission',{text:'Text only',image:'',alt:''},1);
 assert.equal((await remove()).rows.length,0);
 await saveStatement('vision','Legacy-compatible text only',1);
 assert.equal((await remove()).rows.length,1);
});

test('residents and staff without content access cannot change mission or vision',async()=>{
 const value={text:'Authorized public statement',image:'',alt:''};
 await asUser(residentA);
 await rejected(()=>saveStatement('mission',value),/permission/);
 await db.exec('reset role');await db.query("update public.staff_access set superadmin=false,permissions=array['requests'] where user_id=$1",[staff]);
 await asUser(staff);await rejected(()=>saveStatement('vision',value),/permission/);
 await db.exec('reset role');await db.query("update public.staff_access set permissions=array['content'] where user_id=$1",[staff]);
 await asUser(staff);assert.deepEqual((await saveStatement('mission',value)).rows[0].value,value);
});
