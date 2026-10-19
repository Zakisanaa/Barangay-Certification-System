import {test,before,after,beforeEach,afterEach} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {createTestDatabase,residentA,residentB,staff,uploadBookingId} from './helpers/database.mjs';
let db,asUser,day;
before(async()=>{({db,asUser,day}=await createTestDatabase());});
after(async()=>{await db?.close();});
beforeEach(async()=>{await db.exec('begin');});
afterEach(async()=>{await db.exec('rollback; reset role');});
async function rejected(work,pattern){await db.exec('savepoint expected_failure');try{await assert.rejects(work,pattern);}finally{await db.exec('rollback to savepoint expected_failure; release savepoint expected_failure');}}
async function thread(kind){await asUser(residentA);if(kind==='concern'){await db.query("insert into public.resident_concerns(reference,owner_id,name,contact,category,message) values('CHAT-CON',$1,'Juan Dela Cruz','09931411699','Feedback','Please review my concern')",[residentA]);return'CHAT-CON';}const ref='CHAT-REQ',image=await uploadBookingId(db,residentA,ref);await db.query("insert into public.appointment_requests(reference,owner_id,full_name,address,voter_id,request_type,purpose,appointment_date,time_slot,delivery_format,school_id_image_path,id_review_acknowledged) values($1,$2,'Juan Dela Cruz','Barangay Lagasit','Voter''s ID: 123','Barangay Clearance','Employment',$3,'8:00 AM - 9:00 AM','Hardcopy',$4,true)",[ref,residentA,day,image]);return ref;}
async function file(kind,message,owner=residentA,options={}){const id=randomUUID(),ext=options.ext??'pdf',storage_path=`${owner}/${kind}/${message}/${id}.${ext}`;await db.query("insert into storage.objects(bucket_id,name,metadata) values('conversation-attachments',$1,$2)",[storage_path,JSON.stringify({mimetype:options.mime??'application/pdf',size:options.size??123})]);return{id,storage_path,file_name:options.name??`proof.${ext}`};}
async function send(kind,ref,id,body,files=[],internal=false){const args=[ref,id,body];if(kind==='concern')args.push(internal);args.push(JSON.stringify(files));return(await db.query(`select * from public.${kind==='request'?'send_transaction_message':'send_concern_message'}(${args.map((_,i)=>'$'+(i+1)).join(',')})`,args)).rows[0];}
const count=async table=>(await db.query(`select count(*)::int n from public.${table}`)).rows[0].n;

for(const kind of ['request','concern']){
 test(`${kind} chat permits private file-only messages and immutable retries without duplicate alerts`,async()=>{
  const ref=await thread(kind),id=randomUUID(),attachment=await file(kind,id);
  const first=await send(kind,ref,id,'',[attachment]);assert.equal(first.body,'Sent an attachment.');
  const before=[await count('staff_notifications'),await count('notification_outbox')];
  const retry=await send(kind,ref,id,'',[attachment]);assert.equal(retry.id,first.id);assert.equal(await count('chat_attachments'),1);
  assert.deepEqual([await count('staff_notifications'),await count('notification_outbox')],before);
  await rejected(()=>send(kind,ref,id,'Changed',[attachment]),/identifier.*in use/);
  await rejected(()=>send(kind,ref,id,'',[]),/Write a message/);
  await rejected(()=>send(kind,ref,id,'Sent an attachment.',[]),/different attachments/);
  assert.equal((await db.query('delete from storage.objects where name=$1 returning name',[attachment.storage_path])).rows.length,0);
  await rejected(()=>db.query('delete from public.chat_attachments'),/permission denied/);
  await asUser(residentB);assert.equal(await count('chat_attachments'),0);assert.equal((await db.query('select * from storage.objects where name=$1',[attachment.storage_path])).rows.length,0);
  await rejected(()=>send(kind,ref,randomUUID(),'Intrusion'),/access denied/i);
  await asUser(staff);assert.equal(await count('chat_attachments'),1);assert.equal((await db.query('select * from storage.objects where name=$1',[attachment.storage_path])).rows.length,1);
 });
 test(`${kind} chat validates real owned Storage metadata and rolls back incomplete sends`,async()=>{
  const ref=await thread(kind),id=randomUUID(),good=await file(kind,id);
  const before=[await count(kind==='request'?'transaction_messages':'concern_messages'),await count('staff_notifications'),await count('notification_outbox')];
  for(const bad of [{...good,storage_path:good.storage_path.replace(residentA,residentB)},{...good,storage_path:good.storage_path.replace(id,randomUUID())},{...good,file_name:'../proof.pdf'},{...good,file_name:'proof.exe'}])await rejected(()=>send(kind,ref,id,'Draft',[bad]),/Upload each attachment|file name|Use JPG/);
  const missing={...good,id:randomUUID()};missing.storage_path=missing.storage_path.replace(good.id,missing.id);await rejected(()=>send(kind,ref,id,'Draft',[missing]),/Upload a nonempty/);
  const huge=await file(kind,id,residentA,{size:5242881}),empty=await file(kind,id,residentA,{size:0}),wrong=await file(kind,id,residentA,{mime:'application/octet-stream'});
  for(const bad of [huge,empty,wrong])await rejected(()=>send(kind,ref,id,'Draft',[bad]),/nonempty|Use JPG/);
  await rejected(()=>send(kind,ref,id,'Draft',[good,good,good,good]),/up to three/);
  assert.equal(await count('chat_attachments'),0);assert.deepEqual([await count(kind==='request'?'transaction_messages':'concern_messages'),await count('staff_notifications'),await count('notification_outbox')],before);
  assert.equal((await db.query('delete from storage.objects where name=$1 returning name',[good.storage_path])).rows.length,1);
 });
 test(`${kind} chat cannot append files to saved text or bypass privileged metadata storage`,async()=>{
  const ref=await thread(kind),id=randomUUID();await send(kind,ref,id,'Already saved');const attachment=await file(kind,id);
  await rejected(()=>send(kind,ref,id,'Already saved',[attachment]),/different attachments/);
  await rejected(()=>db.query("select public.store_chat_attachments($1,$2,$3,$4,false)",[kind,ref,id,JSON.stringify([attachment])]),/permission denied/);
  await rejected(()=>db.query('insert into public.chat_attachments(id) values(gen_random_uuid())'),/permission denied/);
  assert.equal(await count('chat_attachments'),0);
 });
}
test('internal concern files remain staff-only after the uploading staff member loses access',async()=>{
 const ref=await thread('concern');await asUser(staff);const id=randomUUID(),attachment=await file('concern',id,staff);
 const before=await count('notification_outbox');await send('concern',ref,id,'Private office note',[attachment],true);assert.equal(await count('notification_outbox'),before);
 await asUser(residentA);assert.equal(await count('chat_attachments'),0);assert.equal(await count('concern_messages'),0);assert.equal((await db.query('select * from storage.objects where name=$1',[attachment.storage_path])).rows.length,0);
 await rejected(()=>send('concern',ref,randomUUID(),'Not staff',[],true),/access denied/i);
 await db.exec('reset role');await db.query('update public.staff_access set active=false where user_id=$1',[staff]);await asUser(staff);
 assert.equal(await count('chat_attachments'),0);assert.equal((await db.query('select * from storage.objects where name=$1',[attachment.storage_path])).rows.length,0);
});
test('staff concern attachments enqueue exactly one resident email and support legacy text calls',async()=>{
 const ref=await thread('concern');await asUser(staff);const id=randomUUID(),attachment=await file('concern',id,staff);
 await send('concern',ref,id,'See attached',[attachment]);await send('concern',ref,id,'See attached',[attachment]);
 assert.equal((await db.query("select count(*)::int n from public.notification_outbox where kind='concern_reply'")).rows[0].n,1);
 await db.query('select * from public.send_concern_message($1,gen_random_uuid(),$2,false)',[ref,'Legacy text reply']);
 await asUser(residentA);assert.equal(await count('concern_messages'),2);assert.equal(await count('chat_attachments'),1);
});
test('chat accepts all approved MIME types and the exact size/count boundary while rejecting anonymous callers',async()=>{
 const ref=await thread('request');
 for(const formats of [[['jpg','image/jpeg'],['png','image/png'],['webp','image/webp']],[['pdf','application/pdf'],['docx','application/vnd.openxmlformats-officedocument.wordprocessingml.document'],['txt','text/plain']]]){
  const id=randomUUID(),files=[];for(const [ext,mime]of formats)files.push(await file('request',id,residentA,{ext,mime,size:5242880}));
  await send('request',ref,id,'Boundary upload',files);
 }
 assert.equal(await count('chat_attachments'),6);
 await asUser('','anon');await rejected(()=>send('request',ref,randomUUID(),'Anonymous'),/permission denied/);await rejected(()=>db.query('select * from public.chat_attachments'),/permission denied/);
});
