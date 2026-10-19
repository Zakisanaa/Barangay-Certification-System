import {test,before,after,beforeEach,afterEach} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {createTestDatabase,residentA,residentB,staff} from './helpers/database.mjs';
let db,asUser,day;
before(async()=>{({db,asUser,day}=await createTestDatabase());});
after(async()=>{await db?.close();});
beforeEach(async()=>{await db.exec('begin');});
afterEach(async()=>{await db.exec('rollback;reset role');});
async function rejected(work,pattern){await db.exec('savepoint denied');try{await assert.rejects(work,pattern);}finally{await db.exec('rollback to savepoint denied;release savepoint denied');}}
test('announcement activity is stamped by the server, ignores forged timestamps, and preserves no-op activity',async()=>{
 await asUser(staff);const id=randomUUID();
 await db.query("insert into public.public_posts(id,title,content,type,updated_at) values($1,'Community update','Verified information','NOTICE','2000-01-01')",[id]);
 const read=async()=>(await db.query('select updated_at,title from public.public_posts where id=$1',[id])).rows[0];
 const original=await read();assert.ok(new Date(original.updated_at).getUTCFullYear()>=2026);
 await db.query("update public.public_posts set updated_at='2099-01-01',title=title where id=$1",[id]);assert.deepEqual((await read()).updated_at,original.updated_at);
 await db.query("update public.public_posts set title='Updated community notice',updated_at='2099-01-01' where id=$1",[id]);assert.equal((await read()).title,'Updated community notice');assert.notEqual(new Date((await read()).updated_at).getUTCFullYear(),2099);
});
test('deleting announcement or service sources retires their approved answers and clears learned vectors',async()=>{
 await asUser(staff);const post=randomUUID();await db.query("insert into public.public_posts(id,title,content,type) values($1,'Temporary notice','Staff-confirmed notice','NOTICE')",[post]);
 await db.exec('reset role');await db.query("insert into public.service_catalog(request_type,requirements) values('Temporary service','Bring an ID')");
 const keys=['post:'+post,'service:Temporary service'];
 await db.query('update public.chatbot_knowledge set embedding=array_fill(0.1::real,array[384]),trained_at=now() where source_key=any($1)',[keys]);
 await db.query('delete from public.public_posts where id=$1',[post]);await db.query("delete from public.service_catalog where request_type='Temporary service'");
 const rows=(await db.query('select active,embedding,trained_at from public.chatbot_knowledge where source_key=any($1)',[keys])).rows;
 assert.equal(rows.length,2);for(const row of rows){assert.equal(row.active,false);assert.equal(row.embedding,null);assert.equal(row.trained_at,null);}
});
test('saved Banoy answers remain private to their owner and retain the original wording after knowledge changes',async()=>{
 await asUser(residentA);const id=(await db.query("select public.reserve_chatbot_question('What is the approved notice?') id")).rows[0].id;
 await asUser('','service_role');await db.query("update public.chatbot_questions set answered=true,answer_text='Original approved answer',answer_source='Office notice',answer_method='wording',answered_at=now() where id=$1",[id]);
 await asUser(residentA);assert.equal((await db.query('select answer_text from public.chatbot_questions where id=$1',[id])).rows[0].answer_text,'Original approved answer');
 await rejected(()=>db.query("update public.chatbot_questions set answer_text='Forged answer' where id=$1",[id]),/permission denied|server-managed/);
 await asUser(residentB);assert.equal((await db.query('select * from public.chatbot_questions where id=$1',[id])).rows.length,0);
 await asUser(staff);await db.query("insert into public.chatbot_knowledge(title,question,answer,active) values('Office notice','What is the approved notice?','Replacement answer',true)");assert.equal((await db.query('select answer_text from public.chatbot_questions where id=$1',[id])).rows[0].answer_text,'Original approved answer');
 await asUser('','service_role');await db.query('update public.chatbot_questions set helpful=false where id=$1',[id]);await asUser(residentA);assert.equal((await db.query('select helpful from public.chatbot_questions where id=$1',[id])).rows[0].helpful,false);
});
test('the snapshot trigger rejects authenticated forgeries even if a future grant exposes those columns',async()=>{
 await db.exec('grant insert,update on public.chatbot_questions to authenticated');
 await asUser(staff);await rejected(()=>db.query("insert into public.chatbot_questions(owner_id,question,answer_text) values($1,'Question','Forged answer')",[residentA]),/server-managed/);
 const id=(await db.query("select public.reserve_chatbot_question('Ordinary question') id")).rows[0].id;
 await rejected(()=>db.query("update public.chatbot_questions set answer_text='Forgery' where id=$1",[id]),/server-managed/);
 await db.query('update public.chatbot_questions set resolved=true where id=$1',[id]);
});
test('active slot counts use the partial index on a realistic isolated 18000-appointment fixture',async()=>{
 await db.exec('reset role;alter table public.appointment_requests disable trigger all');
 await db.query(`insert into public.appointment_requests(reference,owner_id,full_name,address,voter_id,request_type,purpose,appointment_date,time_slot,delivery_format,status)
 select 'PERF-'||n,$1,'Fixture resident','Barangay Lagasit','Passport: 123','Barangay Clearance','Fixture',date '2026-01-01'+(n%365),case when n%7=0 then '9:00 AM - 10:00 AM' else '8:00 AM - 9:00 AM' end,'Hardcopy',case when n%20=0 then 'PENDING' when n%20=1 then 'APPROVED' else 'COMPLETED' end from generate_series(1,18000)n`,[residentA]);
 await db.exec('alter table public.appointment_requests enable trigger all;analyze public.appointment_requests');
 const sql="select count(*) from public.appointment_requests where appointment_date='2026-02-10' and time_slot='8:00 AM - 9:00 AM' and status in ('PENDING','APPROVED')";
 const indexed=(await db.query('explain (analyze,format json) '+sql)).rows[0]['QUERY PLAN'][0];
 const count=(await db.query(sql)).rows[0].count;
 await db.exec('set local enable_indexscan=off;set local enable_indexonlyscan=off;set local enable_bitmapscan=off');
 const sequential=(await db.query('explain (analyze,format json) '+sql)).rows[0]['QUERY PLAN'][0];assert.equal((await db.query(sql)).rows[0].count,count);
 assert.ok(JSON.stringify(indexed.Plan).includes('appointment_active_slot_counts_idx'));assert.ok(JSON.stringify(sequential.Plan).includes('Seq Scan'));
 await fs.mkdir('test-results',{recursive:true});await fs.writeFile('test-results/priority-three-index.json',JSON.stringify({fixtureRows:18000,count,indexed,sequential},null,2));
});
