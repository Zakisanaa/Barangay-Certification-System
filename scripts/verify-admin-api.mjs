import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
const project=(await fs.readFile(new URL('../supabase/.temp/project-ref',import.meta.url),'utf8')).trim();
if(project!=='tzrgvpawvzjrabewdvup')throw new Error('Verify the intended linked project first.');
let stdout;try{({stdout}=await promisify(execFile)(process.execPath,['node_modules/supabase/dist/supabase.js','projects','api-keys','--project-ref',project,'--output','json'],{windowsHide:true,maxBuffer:1048576}));}catch{throw new Error('Could not read project credentials.');}
const payload=JSON.parse(stdout),keys=Array.isArray(payload)?payload:payload.api_keys??payload.keys??payload.data;
const server=keys.find(item=>item.name==='service_role')?.api_key,anon=keys.find(item=>item.name==='anon')?.api_key;
if(!server||!anon)throw new Error('The expected project keys are unavailable.');
async function call(name,key,body){const response=await fetch(`https://${project}.supabase.co/functions/v1/${name}`,{method:'POST',headers:{apikey:key,Authorization:`Bearer ${key}`,'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(30000)});return{status:response.status,data:await response.json()};}
async function anonymousChat(name){const response=await fetch(`https://${project}.supabase.co/rest/v1/rpc/${name}`,{method:'POST',headers:{apikey:anon,Authorization:`Bearer ${anon}`,'Content-Type':'application/json'},body:JSON.stringify({p_reference:'READ-ONLY-ACCESS-CHECK',p_id:crypto.randomUUID(),p_body:'Access check',p_attachments:[]}),signal:AbortSignal.timeout(30000)});return{status:response.status,data:await response.json()};}
const results=await Promise.allSettled([
 call('manage-staff',anon,{}),call('notify-resident',anon,{}),call('process-notifications',anon,{dry_run:true}),call('process-notifications',server,{dry_run:true}),anonymousChat('send_transaction_message'),anonymousChat('send_concern_message')
]);
for(const result of results)if(result.status==='rejected')throw new Error('A deployed function could not be reached.');
const [staff,notification,denied,worker,requestChat,concernChat]=results.map(result=>result.value);
assert.equal(staff.status,401,'Staff management must reject an anonymous token');
assert.equal(notification.status,401,'Certificate delivery must reject an anonymous token');
assert.equal(denied.status,403,'The scheduled worker must reject an anonymous token');
assert.equal(worker.status,200,'The scheduled worker must remain ready');
assert.equal(worker.data.ready,true);assert.equal(worker.data.emailConfigured,true);
for(const response of [requestChat,concernChat]){assert.equal(response.status,401,'Conversation messages must reject anonymous callers');assert.equal(response.data.code,'42501','The message RPC must exist and deny execution');}
const privateCalls=[['submit_resident_concern',{p_id:crypto.randomUUID(),p_contact:'Access check',p_category:'Feedback',p_message:'Access check'}],['save_walk_in_shift',{p_id:'read-only-access-check',p_staff:'Access check',p_role:'Access check',p_days:'Monday',p_hours:'8 AM',p_active:false}],['request_summary',{}],['portal_list',{p_kind:'requests'}],['portal_list_sorted',{p_kind:'requests',p_sort:'newest'}],['office_record_list',{p_kind:'fees'}],['resident_fee_records',{}],['office_transaction_list',{p_kind:'fees'}],['office_transaction_rows',{}]];
for(const [name,body]of privateCalls){const response=await fetch(`https://${project}.supabase.co/rest/v1/rpc/${name}`,{method:'POST',headers:{apikey:anon,Authorization:`Bearer ${anon}`,'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(30000)});const result=await response.json();assert.equal(response.status,401,`${name} must reject anonymous private access`);assert.equal(result.code,'42501');}
const banoy=await call('banoy-chat',anon,{action:'ask',question:'Read-only access check'});
assert.equal(banoy.status,401,'Banoy must require a resident session before creating a question');
console.log('PASS: The deployed Banoy function rejects anonymous questions before saving history.');
console.log(JSON.stringify({project,staffManagementAnonymousBlocked:true,certificateDeliveryAnonymousBlocked:true,workerAnonymousBlocked:true,requestChatAnonymousBlocked:true,concernChatAnonymousBlocked:true,workerReady:true,emailConfigured:true,priorityTwoAnonymousBlocked:true,readOnly:true,noEmailsSent:true},null,2));
