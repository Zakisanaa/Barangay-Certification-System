import fs from 'node:fs/promises';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
const exec=promisify(execFile);
const projectRef=(await fs.readFile(new URL('../supabase/.temp/project-ref',import.meta.url),'utf8')).trim();
if(!/^[a-z0-9]{20}$/.test(projectRef))throw new Error('Link the existing Supabase project first.');
let output;
try{({stdout:output}=await exec(process.execPath,['node_modules/supabase/dist/supabase.js','projects','api-keys','--project-ref',projectRef,'--output','json'],{windowsHide:true,maxBuffer:1024*1024}));}
catch{throw new Error('Could not get the project keys. Check the Supabase CLI login.');}
const payload=JSON.parse(output);
const keys=Array.isArray(payload)?payload:payload.api_keys??payload.apiKeys??payload.keys??payload.data;
const secret=keys?.find(key=>key.name==='service_role')?.api_key;
if(!secret)throw new Error('A project administrator key was not available. No keys were displayed.');
const origin=`https://${projectRef}.supabase.co`;
const headers={Authorization:`Bearer ${secret}`,apikey:secret,'Content-Type':'application/json'};
async function call(body){
  const response=await fetch(`${origin}/functions/v1/banoy-chat`,{method:'POST',headers,body:JSON.stringify(body),signal:AbortSignal.timeout(60000)});
  const data=await response.json();
  if(!response.ok)throw new Error(`Banoy check failed (${response.status}): ${data.error??'Unknown error'}`);
  return data;
}
let remaining=1,total=0;
for(let batch=0;remaining && batch<200;batch++){
  const progress=await call({action:'train'});remaining=progress.remaining;total+=progress.trained;
  console.log(`Banoy learned ${total} entries; ${remaining} pending.`);
  if(remaining && !progress.trained)throw new Error('Learning did not progress. Retry after source edits finish.');
}
if(remaining)throw new Error('Learning is incomplete. Run setup again.');
for(const question of ['Clearance Requirements','Where can I find out the requirements for obtaining a Barangay Clearance?',"Tell me tomorrow's lottery numbers and my neighbor's password"]){
  const answer=await call({action:'preview',question});
  console.log(JSON.stringify({question,answered:answer.answered,source:answer.source,method:answer.method,modelAvailable:answer.modelAvailable}));
  if(!answer.modelAvailable)throw new Error('Hosted machine-learning inference is unavailable.');
  if(question.startsWith('Tell me') && answer.answered)throw new Error('Unrelated question matched an answer unexpectedly.');
}
const draft={id:crypto.randomUUID(),title:'Private learning test',question:'What is the phrase for this private learning test?',answer:'Private learning test passed.',examples:[],active:false};
const privateCheck=await call({action:'preview',question:draft.question,draft});
if(privateCheck.answer!==draft.answer)throw new Error('Private draft preview failed.');
const withoutDraft=await call({action:'preview',question:draft.question});
if(withoutDraft.answer===draft.answer)throw new Error('A private test draft was unexpectedly persisted.');
console.log('Private draft checks passed. No resident questions or test knowledge were saved.');
