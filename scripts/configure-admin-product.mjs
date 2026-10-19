import fs from 'node:fs/promises';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {createClient} from '@supabase/supabase-js';
const apply=process.argv.includes('--apply');
const email=process.argv.find(value=>value.startsWith('--email='))?.slice(8)?.trim().toLowerCase();
if(!email||!/^\S+@\S+\.\S+$/.test(email))throw new Error('Provide the exact office-authorized superadmin email with --email=.');
const project=(await fs.readFile(new URL('../supabase/.temp/project-ref',import.meta.url),'utf8')).trim();
if(project!=='tzrgvpawvzjrabewdvup')throw new Error('This setup is restricted to the linked barangay project.');
let stdout;try{({stdout}=await promisify(execFile)(process.execPath,['node_modules/supabase/dist/supabase.js','projects','api-keys','--project-ref',project,'--output','json'],{windowsHide:true,maxBuffer:1048576}));}catch{throw new Error('Could not read server credentials from the logged-in Supabase CLI.');}
let payload;try{payload=JSON.parse(stdout);}catch{throw new Error('Unexpected CLI response. No credentials were displayed.');}
const keys=Array.isArray(payload)?payload:payload.api_keys??payload.keys??payload.data;
const key=keys?.find(item=>item.name==='service_role')?.api_key;if(!key)throw new Error('The project server key is unavailable.');
const client=createClient(`https://${project}.supabase.co`,key,{auth:{persistSession:false,autoRefreshToken:false}});
const found=await client.from('resident_profiles').select('id,email,role').eq('email',email).maybeSingle();if(found.error)throw new Error('Could not check the selected profile.');
let userId=found.data?.id;
if(!apply){let confirmed=false;if(userId){const user=await client.auth.admin.getUserById(userId);if(user.error)throw new Error('Could not verify the account email.');confirmed=!!user.data.user?.email_confirmed_at;}console.log(JSON.stringify({project,email,exists:!!userId,role:found.data?.role??null,emailConfirmed:confirmed,readOnly:true},null,2));process.exit(0);}
if(!userId)throw new Error('Register and confirm the exact authorized account before assigning superadmin access.');
const identity=await client.auth.admin.getUserById(userId);if(identity.error||!identity.data.user)throw new Error('Could not verify the selected authentication account.');
const confirmed=!!identity.data.user.email_confirmed_at;
if(!confirmed)throw new Error('Confirm the selected account email before assigning superadmin access.');
const saved=await client.rpc('bootstrap_superadmin',{p_email:email});if(saved.error||saved.data!==true)throw new Error('Superadmin assignment failed. Check the deployed staff setup RPC before retrying.');
const access=await client.from('staff_access').select('active,superadmin').eq('user_id',userId).single();if(access.error||!access.data.active||!access.data.superadmin)throw new Error('The saved superadmin access could not be verified.');
console.log(JSON.stringify({project,email,superadmin:true,active:true,emailConfirmed:confirmed,invitationSent:false,passwordSetupRequired:!confirmed},null,2));
