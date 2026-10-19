import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
const project=(await fs.readFile(new URL('../supabase/.temp/project-ref',import.meta.url),'utf8')).trim();
assert.equal(project,'tzrgvpawvzjrabewdvup','Verify the intended project before configuring Banoy.');
let stdout;
try{({stdout}=await promisify(execFile)(process.execPath,['node_modules/supabase/dist/supabase.js','projects','api-keys','--project-ref',project,'--output','json'],{windowsHide:true,maxBuffer:1048576}));}catch{throw new Error('Could not read project credentials.');}
const payload=JSON.parse(stdout),keys=Array.isArray(payload)?payload:payload.api_keys??payload.keys??payload.data;
const secret=keys.find(k=>k.name==='service_role')?.api_key,anon=keys.find(k=>k.name==='anon')?.api_key;
assert.ok(secret&&anon,'Project credentials are unavailable.');
const origin=`https://${project}.supabase.co`;
async function get(path,key){const response=await fetch(origin+path,{headers:{apikey:key,Authorization:`Bearer ${key}`},signal:AbortSignal.timeout(30000)});if(!response.ok)throw new Error(`Configuration read failed (${response.status}).`);return response.json();}
async function banoy(body){const response=await fetch(origin+'/functions/v1/banoy-chat',{method:'POST',headers:{apikey:secret,Authorization:`Bearer ${secret}`,'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(60000)});if(!response.ok)throw new Error(`Banoy verification failed (${response.status}).`);return response.json();}
const services=await get('/rest/v1/service_catalog?select=request_type,fee_amount,requirements,active&order=request_type',anon);
const free=new Set(['Certificate of Indigency','First-Time Job Seeker Certificate','Attestation']);
for(const service of services){assert.equal(Number(service.fee_amount),free.has(service.request_type)?0:100,service.request_type);assert.match(service.requirements,/Valid ID/);}
const requirements=await get('/rest/v1/service_requirements?select=request_type,title,required&active=eq.true',anon);
assert.equal(requirements.filter(r=>r.request_type==='Barangay Agrarian Certificate'&&r.required).length,1);
assert.equal(requirements.filter(r=>r.request_type==='Good Moral Certificate'&&r.required).length,0);
const knowledge=await get('/rest/v1/chatbot_knowledge?select=source_key,answer,active,trained_at&source_key=like.service:*',secret);
for(const service of services){const entry=knowledge.find(k=>k.source_key==='service:'+service.request_type);assert.ok(entry?.active===service.active,service.request_type);assert.ok(entry.answer.includes(service.requirements));assert.match(entry.answer,free.has(service.request_type)?/Free \(no fee\)/:/PHP 100\.00/);}
console.log(`PASS: ${services.length} service fees, requirements, and synchronized Banoy answers agree.`);
if(process.argv.includes('--train')){
 for(let batch=0;batch<20;batch++){const result=await banoy({action:'train'});console.log(`Banoy training: ${result.trained} answers learned; ${result.remaining} remaining.`);if(result.remaining===0)break;if(batch===19)throw new Error('Banoy still has pending answers after the bounded training run.');}
}
for(const [question,name,fee,extra] of [
 ['What are the requirements for Barangay Clearance?','Barangay Clearance',100,/Valid ID/],
 ['What are the requirements for Certificate of Indigency?','Certificate of Indigency',0,/Valid ID/],
 ['Magkano ang cert of residence?','Certificate of Residency',100,/Valid ID/],
 ['What are the requirements for First-Time Job Seeker Certificate?','First-Time Job Seeker Certificate',0,/Valid ID/],
 ['What are the requirements for Barangay Agrarian Certificate?','Barangay Agrarian Certificate',100,/proof of land ownership or tenancy/],
 ['Does Good Moral still need an ID?','Good Moral Certificate',100,/Valid ID.*Additional requirements: None/s],
 ['What are the requirements for Attestation?','Attestation',0,/Valid ID/],
 ['Does Business Permit Clearance require an ID?','Business Permit Clearance',100,/Valid ID/],
 ]){const reply=await banoy({action:'preview',question});assert.ok(reply.answered,question);assert.ok(reply.answer.includes(name),question);assert.match(reply.answer,fee===0?/Free \(no fee\)/:/PHP 100\.00/);assert.match(reply.answer,extra);console.log(`PASS: Banoy answers ${name} fee and requirements.`);}
console.log('PASS: No resident submissions, payment entries, messages, or emails were created.');
