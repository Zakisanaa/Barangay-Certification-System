import {test,before,after,beforeEach,afterEach} from 'node:test';
import assert from 'node:assert/strict';
import {createTestDatabase,residentA,residentB,staff,uploadBookingId} from './helpers/database.mjs';
let db,asUser,day;
before(async()=>{({db,asUser,day}=await createTestDatabase());});
after(async()=>{await db?.close();});
beforeEach(async()=>{await db.exec('begin');await asUser(residentA);});
afterEach(async()=>{await db.exec('rollback;reset role');});
async function rejected(work,pattern){await db.exec('savepoint expected_failure');try{await assert.rejects(work,pattern);}finally{await db.exec('rollback to savepoint expected_failure;release savepoint expected_failure');}}
async function booking(type='Barangay Clearance'){
 const reference='CONNECTED-'+crypto.randomUUID(),path=await uploadBookingId(db,residentA,reference);
 return(await db.query("select * from public.submit_document_request($1,'[]')",[JSON.stringify({reference,full_name:'Juan Dela Cruz',address:'Barangay Lagasit',voter_id:'Passport: 123',id_review_acknowledged:true,request_type:type,purpose:'Workflow test',appointment_date:day,time_slot:'8:00 AM - 9:00 AM',delivery_format:'Hardcopy',school_id_image_path:path})])).rows[0];
}
async function list(kind='fees',overrides={}){return(await db.query('select public.office_transaction_list($1,$2,$3,$4,$5) result',[kind,overrides.page??0,overrides.query??'',overrides.sort??'oldest',overrides.filter??'needs_recording'])).rows[0].result;}
async function approve(row){await asUser(staff);return(await db.query("select * from public.manage_appointment($1,'approve',$2)",[row.reference,row.version])).rows[0];}
async function limitedStaff(permissions){await asUser('','service_role');await db.exec('reset role');await db.query("update public.resident_profiles set role='staff' where id=$1",[residentB]);await db.query('insert into public.staff_access(user_id,permissions) values($1,$2)',[residentB,permissions]);await asUser(residentB);}

test('approving a request adds it to both existing workflows without creating a payment or issuance',async()=>{
 let request=await booking();await asUser(staff);assert.equal((await list()).total,0);
 request=await approve(request);const fees=await list(),certificates=await list('certificates');
 assert.equal(fees.rows[0].reference,request.reference);assert.equal(certificates.rows[0].reference,request.reference);
 assert.equal(fees.rows[0].fee_amount,100);assert.equal(fees.rows[0].fee_recorded,false);
 assert.equal((await db.query('select count(*)::int n from public.fee_records')).rows[0].n,0);
 assert.equal((await db.query('select count(*)::int n from public.certificate_register')).rows[0].n,0);
});

test('cashiers can select transactions without dashboard access, while private fields and unrelated workflows stay protected',async()=>{
 await approve(await booking());await limitedStaff(['payments']);
 assert.equal((await db.query("select public.has_staff_permission('requests') allowed")).rows[0].allowed,false);
 const fees=await list();assert.equal(fees.total,1);const row=fees.rows[0];
 for(const field of ['address','voter_id','id_number','school_id_image_path','owner_id','purpose','note','recorded_by'])assert.equal(field in row,false,field);
 await rejected(()=>list('certificates'),/permission/);
 await rejected(()=>db.query('select * from public.office_transaction_rows()'),/permission denied/);
 await asUser(residentA);await rejected(()=>list(),/permission/);
 await asUser('', 'anon');await rejected(()=>list(),/permission denied/);
});

test('payments and exemptions leave the awaiting list; refunds preserve history without becoming automatic charges',async()=>{
 const request=await approve(await booking());await db.query('update public.office_settings set fee_tracking_enabled=true where id=1');
 const id=crypto.randomUUID();await db.query("select public.record_office_fee($1,$2,null,100,'PAID','CONNECTED-OR','Office payment')",[id,request.reference]);
 assert.equal((await list()).total,0);assert.equal((await list('fees',{filter:'all'})).rows[0].fee_recorded,true);
 await db.query("select public.record_office_fee(gen_random_uuid(),$1,null,100,'REFUNDED',null,'Refund approved',$2)",[request.reference,id]);
 assert.equal((await list()).total,0);assert.equal((await list('fees',{filter:'all'})).total,1);
 await asUser(residentA);const free=await approve(await booking('Attestation'));
 await db.query("select public.record_office_fee(gen_random_uuid(),$1,null,0,'EXEMPT',null,'Free service')",[free.reference]);
 assert.equal((await list()).total,0);
});

test('recorded issuance leaves its queue and is still available through history',async()=>{
 const request=await approve(await booking());await limitedStaff(['certificates']);
 assert.equal((await list('certificates')).total,1);
 await db.query("select public.issue_certificate(gen_random_uuid(),$1,null,'Approved signatory')",[request.reference]);
 assert.equal((await list('certificates')).total,0);assert.equal((await list('certificates',{filter:'all'})).rows[0].issued,true);
 await rejected(()=>list('fees'),/permission/);
});

test('custom document lookup uses its saved catalog key and walk-in links accept the selected id',async()=>{
 const request=await approve(await booking('Custom requested certificate'));
 const source=(await db.query('select public.find_office_transaction($1) result',[request.reference])).rows[0].result;
 assert.equal(source.service,'Custom requested certificate');assert.equal(source.service_key,'Other barangay document');assert.equal(source.fee_amount,100);
 const walk=(await db.query("select * from public.save_walk_in(gen_random_uuid(),'Walk-in resident','','Barangay Clearance','Workflow')")).rows[0];
 const byId=(await db.query('select public.find_office_transaction($1) result',[walk.id])).rows[0].result;
 assert.equal(byId.reference,walk.reference);assert.equal((await list()).total,2);assert.equal((await list('certificates')).total,1);
});

test('transaction search and name sorting cover all pages and reject unsupported inputs',async()=>{
 await asUser(staff);
 for(let i=0;i<31;i++)await db.query("select public.save_walk_in(gen_random_uuid(),$1,'','Barangay Clearance','Workflow')",['Resident '+String(i).padStart(2,'0')]);
 const first=await list('fees',{sort:'name_desc'}),second=await list('fees',{sort:'name_desc',page:1});
 assert.equal(first.total,31);assert.equal(first.rows.length,25);assert.equal(second.rows.length,6);assert.equal(first.rows[0].resident,'Resident 30');
 assert.equal((await list('fees',{query:'Resident 00'})).total,1);assert.equal((await list('fees',{query:'%'})).total,0);
 await rejected(()=>list('fees',{sort:'malicious'}),/filter and sort/);await rejected(()=>list('fees',{page:-1}),/valid page/);
});

test('completed omissions remain selectable and archived requests leave the ordinary queue',async()=>{
 let request=await approve(await booking());
 request=(await db.query("select * from public.manage_appointment(p_reference=>$1,p_action=>'collect',p_expected_version=>$2,p_recipient=>'Juan')",[request.reference,request.version])).rows[0];
 request=(await db.query("select * from public.manage_appointment($1,'complete',$2)",[request.reference,request.version])).rows[0];
 assert.equal((await list()).rows[0].status,'COMPLETED');
 await db.query('update public.appointment_requests set archived=true where reference=$1',[request.reference]);assert.equal((await list()).total,0);
});
