import {test,before,after,beforeEach,afterEach} from 'node:test';
import assert from 'node:assert/strict';
import {createTestDatabase,residentA,residentB,staff,uploadBookingId} from './helpers/database.mjs';
import {getRecognizedServiceFaq} from '../src/app/serviceFaq.ts';
let db,asUser,day;
before(async()=>{({db,asUser,day}=await createTestDatabase());});
after(async()=>{await db?.close();});
beforeEach(async()=>{await db.exec('begin');await asUser(residentA);});
afterEach(async()=>{await db.exec('rollback;reset role');});
async function rejected(work,pattern){await db.exec('savepoint expected_failure');try{await assert.rejects(work,pattern);}finally{await db.exec('rollback to savepoint expected_failure;release savepoint expected_failure');}}
const payload=(type='Barangay Agrarian Certificate')=>({reference:'APPROVED-SERVICE',full_name:'Juan Dela Cruz',address:'Barangay Lagasit',voter_id:'Passport: 123',id_review_acknowledged:true,request_type:type,purpose:'Certification',appointment_date:day,time_slot:'8:00 AM - 9:00 AM',delivery_format:'Hardcopy'});
const submit=async(data,files=[])=>(await db.query('select * from public.submit_document_request($1,$2)',[JSON.stringify(data),JSON.stringify(files)])).rows[0];

test('approved catalog fees and Banoy answers agree, including all other booking options',async()=>{
 const services=(await db.query('select * from public.service_catalog order by request_type')).rows;
 const free=new Set(['Certificate of Indigency','First-Time Job Seeker Certificate','Attestation']);
 assert.equal(services.filter(s=>s.request_type==='Barangay Agrarian Certificate').length,1);
 for(const service of services){assert.equal(Number(service.fee_amount),free.has(service.request_type)?0:100);assert.match(service.requirements,/Valid ID/);}
 await asUser(staff);
 const knowledge=(await db.query("select * from public.chatbot_knowledge where source_key like 'service:%'")).rows;
 for(const service of services){const answer=knowledge.find(k=>k.source_key==='service:'+service.request_type);assert.ok(answer?.active);assert.match(answer.answer,free.has(service.request_type)?/Free \(no fee\)/:/PHP 100\.00/);assert.ok(answer.answer.includes(service.requirements));}
 const config={services,office:{}};
 for(const [question,name] of [['Does brgy clearance need a valid ID?','Barangay Clearance'],['Magkano ang cert of residence?','Certificate of Residency'],['What ID for certificate of good moral character?','Good Moral Certificate'],['Requirements for agrarian certificate?','Barangay Agrarian Certificate'],['Cert of attestation fee?','Attestation']])assert.ok(getRecognizedServiceFaq(question,config).startsWith(name));
 assert.match(getRecognizedServiceFaq('Does Good Moral need an ID?',config),/Valid ID is required.*Additional requirements: None/);
});

test('Agrarian requires an additional document and a failed submission saves no request',async()=>{
 const data={...payload(),school_id_image_path:await uploadBookingId(db,residentA,'APPROVED-SERVICE')};
 await rejected(()=>submit(data),/Upload all required supporting documents/);
 assert.equal((await db.query('select count(*)::int n from public.appointment_requests')).rows[0].n,0);
 assert.equal((await db.query('select count(*)::int n from public.notification_outbox')).rows[0].n,0);
});

test('Agrarian accepts one owned proof of ownership or tenancy and preserves its required checklist',async()=>{
 const data={...payload(),school_id_image_path:await uploadBookingId(db,residentA,'APPROVED-SERVICE')};
 const path=`${residentA}/APPROVED-SERVICE/tenancy.pdf`;
 await db.query("insert into storage.objects(bucket_id,name,metadata) values('request-attachments',$1,'{\"mimetype\":\"application/pdf\",\"size\":100}')",[path]);
 const file={id:crypto.randomUUID(),requirement_id:'ca318b92-ce77-4fe8-9ee7-a2a33a023c62',storage_path:path};
 await rejected(()=>submit(data,[{...file,storage_path:`${residentB}/APPROVED-SERVICE/tenancy.pdf`}]),/missing or belongs/);
 const row=await submit(data,[file]);assert.equal(row.request_type,'Barangay Agrarian Certificate');
 const proof=(await db.query('select * from public.request_attachments where request_reference=$1',[row.reference])).rows[0];
 assert.equal(proof.required,true);assert.equal(proof.requirement_title,'Proof of land ownership or tenancy');
 await asUser(residentB);assert.equal((await db.query('select * from public.request_attachments')).rows.length,0);
});

test('Good Moral needs the booking ID and no extra documents',async()=>{
 await rejected(()=>submit(payload('Good Moral Certificate')),/Attach an image of your valid ID/);
 const row=await submit({...payload('Good Moral Certificate'),school_id_image_path:await uploadBookingId(db,residentA,'APPROVED-SERVICE')});
 assert.ok(row.school_id_image_path);
 assert.equal((await db.query('select count(*)::int n from public.request_attachments')).rows[0].n,0);
 assert.equal((await db.query("select count(*)::int n from public.service_requirements where request_type='Good Moral Certificate' and active and required")).rows[0].n,0);
});

test('a direct Agrarian insert cannot skip its additional requirement',async()=>{
 const image=await uploadBookingId(db,residentA,'APPROVED-DIRECT');
 await rejected(async()=>{await db.query("insert into public.appointment_requests(reference,owner_id,full_name,address,voter_id,request_type,purpose,appointment_date,time_slot,delivery_format,id_review_acknowledged,school_id_image_path) values('APPROVED-DIRECT',$1,'Juan Dela Cruz','Barangay Lagasit','Passport: 123','Barangay Agrarian Certificate','Certification',$2,'8:00 AM - 9:00 AM','Hardcopy',true,$3)",[residentA,day,image]);await db.exec('set constraints all immediate');},/Upload all required supporting documents/);
});
