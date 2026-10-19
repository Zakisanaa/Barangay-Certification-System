import {test,before,after,beforeEach,afterEach} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {createTestDatabase,residentA,residentB,staff,uploadBookingId} from './helpers/database.mjs';
let db,asUser,day,sequence=0;
before(async()=>{({db,asUser,day}=await createTestDatabase());});after(async()=>{await db?.close();});beforeEach(async()=>{await db.exec('begin');});afterEach(async()=>{await db.exec('rollback;reset role');});
async function rejected(work,pattern){await db.exec('savepoint expected_failure');try{await assert.rejects(work,pattern);}finally{await db.exec('rollback to savepoint expected_failure;release savepoint expected_failure');}}
async function booking(owner=residentA,overrides={}){await asUser(owner);const reference='P2-'+(++sequence),image=await uploadBookingId(db,owner,reference);const payload={reference,full_name:'Same Name',address:'Barangay Lagasit',voter_id:'Passport: 123',id_type:'Passport',id_number:'123',id_review_acknowledged:true,request_type:'Barangay Clearance',purpose:'Employment',appointment_date:day,time_slot:'8:00 AM - 9:00 AM',delivery_format:'Hardcopy',school_id_image_path:image,...overrides};return(await db.query("select * from public.submit_document_request($1,'[]')",[JSON.stringify(payload)])).rows[0];}
async function list(kind,page=0,size=25,query='',archived=null,status=null,owner=null){return(await db.query('select public.portal_list($1,$2,$3,$4,$5,$6,null,$7) as result',[kind,page,size,query,archived,status,owner])).rows[0].result;}
test('new requests validate structured ID type/number and retain a server-stamped immutable acknowledgment',async()=>{
 await rejected(()=>booking(residentA,{id_type:'Made up'}),/supported ID type/);
 await rejected(()=>booking(residentA,{id_number:'\n'}),/supported ID type/);
 await rejected(()=>booking(residentA,{id_review_acknowledged:false}),/Confirm.*review/);
 const row=await booking(residentA,{voter_id:'untrusted label'});assert.equal(row.id_type,'Passport');assert.equal(row.id_number,'123');assert.equal(row.voter_id,'Passport: 123');assert.equal(row.id_acknowledgment_version,'id-review-v1');assert.ok(row.id_acknowledged_at);
 await asUser(staff);await rejected(()=>db.query("update public.appointment_requests set id_number='456' where reference=$1",[row.reference]),/identity.*cannot/);
});
test('concern submission is idempotent, binds author identity, and rejects conflicting or cross-account retries',async()=>{
 await asUser(residentA);const id=randomUUID(),args=[id,'09931411699','Feedback','Review this concern'];
 const first=(await db.query('select * from public.submit_resident_concern($1,$2,$3,$4)',args)).rows[0];await db.query('select * from public.submit_resident_concern($1,$2,$3,$4)',args);
 assert.equal(first.name,'Juan Dela Cruz');assert.equal(first.reference,'CON-'+id);assert.equal((await db.query('select count(*)::int n from public.resident_concerns')).rows[0].n,1);
 await rejected(()=>db.query('select * from public.submit_resident_concern($1,$2,$3,$4)',[id,args[1],args[2],'Changed text']),/already in use/);
 await asUser(residentB);await rejected(()=>db.query('select * from public.submit_resident_concern($1,$2,$3,$4)',args),/already in use/);
});
test('schedule retries create one row and version checks prevent stale or unrelated shift updates',async()=>{
 await asUser(staff);const id=randomUUID(),second=randomUUID();const args=[id,'Service desk','Clerk','Monday','8 AM - 5 PM',true];
 await db.query('select * from public.save_walk_in_shift($1,$2,$3,$4,$5,$6)',args);await db.query('select * from public.save_walk_in_shift($1,$2,$3,$4,$5,$6)',args);
 await db.query('select * from public.save_walk_in_shift($1,$2,$3,$4,$5,$6)',[second,...args.slice(1)]);
 await db.query('select * from public.save_walk_in_shift($1,$2,$3,$4,$5,false,1)',args.slice(0,5));
 await rejected(()=>db.query('select * from public.save_walk_in_shift($1,$2,$3,$4,$5,true,1)',args.slice(0,5)),/changed.*Reload/);
 const other=(await db.query('select * from public.walk_in_shifts where id=$1',[second])).rows[0];assert.equal(other.active,true);assert.equal(other.revision,1);
 await db.query('select * from public.save_walk_in_shift($1,$2,$3,$4,$5,$6)',['shift-legacy-frontdesk',...args.slice(1)]);await db.query('select * from public.save_walk_in_shift($1,$2,$3,$4,$5,false,1)',['shift-legacy-frontdesk',...args.slice(1,5)]);assert.equal((await db.query("select active from public.walk_in_shifts where id='shift-legacy-frontdesk'")).rows[0].active,false);
 await asUser(residentA);await rejected(()=>db.query('select * from public.save_walk_in_shift($1,$2,$3,$4,$5,$6)',args),/permission/);
});
test('revision predicates reject stale office, service, resident, and announcement edits',async()=>{
 await asUser(staff);
 for(const [table,key,value,field,next]of [['office_settings','id',1,'office_hours','Verified hours'],['service_catalog','request_type','Barangay Clearance','processing_time','One day'],['resident_profiles','id',residentA,'address','New verified address']]){
  const initial=(await db.query(`select revision from public.${table} where ${key}=$1`,[value])).rows[0].revision;
  const updated=await db.query(`update public.${table} set ${field}=$1 where ${key}=$2 and revision=$3 returning revision`,[next,value,initial]);assert.equal(updated.rows[0].revision,initial+1);
  const stale=await db.query(`update public.${table} set ${field}=$1 where ${key}=$2 and revision=$3 returning revision`,['Stale overwrite',value,initial]);assert.equal(stale.rows.length,0);
 }
 const post=randomUUID();await db.query("insert into public.public_posts(id,title,content,type) values($1,'First title','Original content','NOTICE')",[post]);await db.query("update public.public_posts set title='New title' where id=$1 and revision=1",[post]);assert.equal((await db.query("update public.public_posts set title='Stale' where id=$1 and revision=1 returning id",[post])).rows.length,0);
});
test('server pagination and literal search return complete totals beyond 1000 posts without exposing private rows',async()=>{
 await asUser(staff);await db.exec("insert into public.public_posts(id,title,content,type) select gen_random_uuid(),'Record '||n,'Published information','NOTICE' from generate_series(1,1030)n");
 const first=await list('posts',0,100),last=await list('posts',10,100);assert.equal(first.total,1030);assert.equal(first.rows.length,100);assert.equal(last.rows.length,30);assert.equal((await list('posts',50,100)).total,1030);
 assert.equal((await list('posts',0,25,'Record 1030')).total,1);assert.equal((await list('posts',0,25,'%')).total,0);
 await booking();await asUser(residentB);assert.equal((await list('requests')).total,0);assert.equal((await list('concerns')).total,0);
 await db.exec('reset role;grant select on public.appointment_requests to anon');await asUser('','anon');assert.equal((await list('posts')).total,1030);await rejected(()=>list('requests'),/permission denied: sign in/);
});
test('residents served counts completed account IDs across archives and separates residents with the same name',async()=>{
 const first=await booking();const second=await booking(residentB);await asUser(staff);await db.exec('reset role;set constraints all immediate;alter table public.appointment_requests disable trigger validate_appointment');
 await db.query("update public.appointment_requests set status='COMPLETED',archived=true where reference in ($1,$2)",[first.reference,second.reference]);await db.exec('alter table public.appointment_requests enable trigger validate_appointment');
 await booking();await asUser(staff);const summary=(await db.query('select public.request_summary() as result')).rows[0].result;assert.equal(summary.served,2);assert.equal(summary.total,1);assert.equal(summary.pending,1);
 await asUser(residentA);assert.equal((await db.query('select public.request_summary() as result')).rows[0].result.served,1);
});
test('certificate file availability follows actual Storage objects and cannot be forged by residents',async()=>{
 const request=await booking(residentA,{delivery_format:'Softcopy'});const path=`${residentA}/${request.reference}/${randomUUID()}.pdf`,id=randomUUID();await db.exec('reset role');await db.query("insert into public.certificate_deliveries(id,request_reference,owner_id,sent_by,sender_name,recipient_email,template_name,storage_path,pdf_hash) values($1,$2,$3,$4,'Staff','a@example.test','BARANGAY CLEARANCE.docx',$5,repeat('a',64))",[id,request.reference,residentA,staff,path]);
 const available=async()=>(await db.query('select file_available from public.certificate_deliveries where id=$1',[id])).rows[0].file_available;
 assert.equal(await available(),false);await db.query("insert into storage.objects(bucket_id,name) values('completed-certificates',$1)",[path]);assert.equal(await available(),true);
 await db.query('delete from storage.objects where name=$1',[path]);assert.equal(await available(),false);
 await asUser(residentA);await rejected(()=>db.query('update public.certificate_deliveries set file_available=true where id=$1',[id]),/permission denied/);
});
test('closures identify existing bookings and notify residents, while approved rejection records its reason',async()=>{
 let row=await booking();await asUser(staff);const affected=(await db.query('select public.affected_appointments($1,null) result',[day])).rows[0].result;assert.equal(affected.total,1);
 await rejected(()=>db.query("select * from public.save_reviewed_closure($1,'Office closed',false)",[day]),/Review affected/);
 await db.query("select * from public.save_reviewed_closure($1,'Office closed',true)",[day]);assert.equal((await db.query("select count(*)::int n from public.notification_outbox where reference=$1 and kind='office_closure'",[row.reference])).rows[0].n,1);
 await rejected(()=>db.query("select * from public.save_reviewed_closure($1,'Stale closure',true,0)",[day]),/Closure changed/);
 await db.query('delete from public.office_closures where closed_date=$1',[day]);row=(await db.query("select * from public.manage_appointment($1,'approve',$2)",[row.reference,row.version])).rows[0];row=(await db.query("select * from public.manage_appointment($1,'reject',$2,'Identity could not be verified')",[row.reference,row.version])).rows[0];assert.equal(row.status,'REJECTED');assert.equal(row.rejection_reason,'Identity could not be verified');
});
test('operating-slot edits reject stale revisions and preserve the reservation-review safeguard',async()=>{
 await asUser(staff);const label='8:00 AM - 9:00 AM';const current=(await db.query('select * from public.appointment_slots where label=$1',[label])).rows[0];
 await db.query("select * from public.save_operating_slot_versioned($1,'08:00','09:00',11,true,false,$2)",[label,current.revision]);
 await rejected(()=>db.query("select * from public.save_operating_slot_versioned($1,'08:00','09:00',12,true,false,$2)",[label,current.revision]),/Slot changed/);
 assert.equal((await db.query('select capacity from public.appointment_slots where label=$1',[label])).rows[0].capacity,11);
});
