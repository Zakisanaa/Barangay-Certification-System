import {test,before,after,beforeEach,afterEach} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {createTestDatabase,residentA,residentB,staff,uploadBookingId} from './helpers/database.mjs';
let db,asUser,day;
before(async()=>{({db,asUser,day}=await createTestDatabase({migrationRoles:{'20261019000700_fee_entry_safeguards.sql':'migration'}}));});
after(async()=>{await db?.close();});
beforeEach(async()=>{await db.exec('begin');});
afterEach(async()=>{await db.exec('rollback;reset role');});
async function rejected(work,pattern){await db.exec('savepoint denied');try{await assert.rejects(work,pattern);}finally{await db.exec('rollback to savepoint denied;release savepoint denied');}}
async function officeList(kind,options={}){return(await db.query('select public.office_record_list($1,$2,$3,$4,$5,$6) result',[kind,options.page??0,options.query??'',options.sort??'newest',options.entity??null,options.status??null])).rows[0].result;}
async function walkIn(name='Resident fee test'){return(await db.query("select * from public.save_walk_in(p_id=>gen_random_uuid(),p_name=>$1,p_contact=>'',p_service=>'Barangay Clearance',p_purpose=>'Office fee test')",[name])).rows[0];}
async function fee(walk,amount=75,status='PAID',previous=null,id=randomUUID()){
 return(await db.query('select * from public.record_office_fee($1,null,$2,$3,$4,$5,$6,$7,$8)',[id,walk.id,amount,status,status==='PAID'?'OR-'+id:null,'Office test entry',previous,'Cash at barangay office'])).rows[0];
}
test('portal search and sort apply to the whole result before pagination and preserve resident privacy',async()=>{
 await asUser(staff);
 for(let n=30;n>=0;n--)await db.query("insert into public.public_posts(id,title,content,type,published_at) values(gen_random_uuid(),$1,'Sort fixture','NOTICE',$2)",['Notice '+String(n).padStart(2,'0'),`2026-09-${String(n%28+1).padStart(2,'0')}T00:00:00Z`]);
 const list=async(kind,page,query,sort)=>(await db.query('select public.portal_list_sorted($1,$2,25,$3,null,null,null,null,$4) result',[kind,page,query,sort])).rows[0].result;
 const first=await list('posts',0,'Notice ','name_asc'),second=await list('posts',1,'Notice ','name_asc');
 assert.equal(first.total,31);assert.equal(first.rows.length,25);assert.equal(first.rows[0].title,'Notice 00');assert.equal(second.rows[0].title,'Notice 25');
 assert.equal((await list('posts',0,'Notice 30','name_desc')).rows[0].title,'Notice 30');
 assert.equal((await list('posts',0,'Notice ','name_desc')).rows[0].title,'Notice 30');
 await rejected(()=>list('posts',0,'','invalid'),/sort order/);
 await db.exec('reset role');
 await db.query("insert into public.resident_concerns(reference,owner_id,name,contact,category,message) values('SORT-A',$1,'Zed Resident','09931411699','Feedback','Private A'),('SORT-B',$2,'Amy Resident','09931411699','Feedback','Private B')",[residentA,residentB]);
 await asUser(residentA);const own=await list('concerns',0,'','name_asc');assert.deepEqual(own.rows.map(row=>row.reference),['SORT-A']);
 await asUser('','anon');assert.ok((await list('posts',0,'Notice','oldest')).rows.length);
 await rejected(()=>list('concerns',0,'','newest'),/sign in|Permission denied/);
});
test('appointment date sorting orders 9 AM before 10 AM using actual slot times',async()=>{
 await asUser(staff);await db.query("select public.save_operating_slot_versioned(p_label=>'10:00 AM - 11:00 AM',p_start=>'10:00',p_end=>'11:00',p_capacity=>10,p_active=>true,p_reviewed=>false)");
 for(const [owner,reference,slot] of [[residentA,'SORT-LATE','10:00 AM - 11:00 AM'],[residentB,'SORT-EARLY','9:00 AM - 10:00 AM']]){
  await asUser(owner);const path=await uploadBookingId(db,owner,reference);
  await db.query("insert into public.appointment_requests(reference,owner_id,full_name,address,voter_id,request_type,purpose,appointment_date,time_slot,delivery_format,school_id_image_path,id_review_acknowledged) values($1,$2,'Resident test','Barangay Lagasit','Passport: 123','Barangay Clearance','Employment',$3,$4,'Hardcopy',$5,true)",[reference,owner,day,slot,path]);
 }
 await asUser(staff);
 for(const [sort,expected] of [['date_asc',['SORT-EARLY','SORT-LATE']],['date_desc',['SORT-LATE','SORT-EARLY']]]){
  const result=(await db.query("select public.portal_list_sorted(p_kind=>'requests',p_sort=>$1) result",[sort])).rows[0].result;assert.deepEqual(result.rows.map(row=>row.reference),expected);
 }
});
test('numeric service fees save atomically, retain free and unconfirmed values, and update Banoy',async()=>{
 await asUser(staff);
 const result=(await db.query("select * from public.create_document_service_with_fee('Fee service','Bring ID','Pay at office','Same day',75.50)")).rows[0];assert.equal(Number(result.fee_amount),75.5);
 assert.match((await db.query("select answer from public.chatbot_knowledge where source_key='service:Fee service'")).rows[0].answer,/PHP 75\.50/);
 await db.query("update public.service_catalog set fee_amount=0 where request_type='Fee service'");
 assert.match((await db.query("select answer from public.chatbot_knowledge where source_key='service:Fee service'")).rows[0].answer,/Free \(no fee\)/);
 await db.query("update public.service_catalog set fee_amount=null,fee_description='' where request_type='Fee service'");
 assert.match((await db.query("select answer from public.chatbot_knowledge where source_key='service:Fee service'")).rows[0].answer,/Confirm the fee/);
 await rejected(()=>db.query("select public.create_document_service_with_fee('Invalid amount','','','',12.345)"),/two decimal/);
 assert.equal((await db.query("select count(*)::int n from public.service_catalog where request_type='Invalid amount'")).rows[0].n,0);
 await asUser(residentA);await rejected(()=>db.query("select public.create_document_service_with_fee('Forged service','','','',10)"),/permission|access/i);
});
test('fees resolve walk-in references, sort amounts, total all pages, and retain correction links',async()=>{
 await asUser(staff);await db.query('update public.office_settings set fee_tracking_enabled=true where id=1');
 const walk=await walkIn(),payment=await fee(walk,75);
 const retry=await fee(walk,75,'PAID',null,payment.id);assert.equal(retry.id,payment.id);
 await rejected(()=>fee(walk,75),/already recorded/);
 await rejected(()=>db.query("select public.record_fee(gen_random_uuid(),null,$1,75,'PAID','LEGACY-OR','Duplicate entry',null)",[walk.id]),/already recorded/);
 let list=await officeList('fees',{query:walk.reference});assert.equal(list.total,1);assert.equal(list.rows[0].display_reference,walk.reference);assert.equal(Number(list.summary.net),75);
 await fee(walk,75,'REFUNDED',payment.id);
 list=await officeList('fees',{query:walk.reference});assert.equal(list.total,2);assert.equal(Number(list.summary.net),0);assert.equal(list.rows.find(row=>row.id===payment.id).corrected,true);
 await rejected(()=>fee(walk,75,'VOIDED',payment.id),/already recorded/);
 const next=await walkIn('Another resident');await fee(next,125);
 const sorted=await officeList('fees',{sort:'amount_high'});assert.equal(Number(sorted.rows[0].amount),125);assert.equal(Number(sorted.summary.net),125);
 await asUser(residentA);await rejected(()=>officeList('fees'),/access required/);
});
test('zero payments fail through both fee entry paths while explicit exemptions stay at zero',async()=>{
 await asUser(staff);await db.query('update public.office_settings set fee_tracking_enabled=true where id=1');const walk=await walkIn();
 await rejected(()=>fee(walk,0),/greater than zero/);
 await rejected(()=>db.query("select public.record_fee(gen_random_uuid(),null,$1,0,'PAID','OR-ZERO','Zero test',null)",[walk.id]),/greater than zero/);
 const exempt=await fee(walk,0,'EXEMPT');assert.equal(Number(exempt.amount),0);
 assert.equal(Number((await officeList('fees')).summary.net),0);
});
