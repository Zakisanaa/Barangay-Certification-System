import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { validateProfileFields } from '../../../src/app/profileValidation.ts';
const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization,x-client-info,apikey,content-type','Access-Control-Allow-Methods':'POST,OPTIONS'};
const json=(value:unknown,status=200)=>Response.json(value,{status,headers:cors});
const permissions=new Set(['requests','certificates','residents','concerns','schedules','content','settings','knowledge','reports','payments','audit']);
Deno.serve(async request=>{
 if(request.method==='OPTIONS')return new Response('ok',{headers:cors});
 if(request.method!=='POST')return json({error:'Method not allowed.'},405);
 const url=Deno.env.get('SUPABASE_URL'),key=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'),anon=Deno.env.get('SUPABASE_ANON_KEY');
 if(!url||!key||!anon)return json({error:'Staff management is not configured.'},503);
 const authorization=request.headers.get('Authorization');if(!authorization?.startsWith('Bearer '))return json({error:'Superadmin sign-in required.'},403);
 const caller=createClient(url,anon,{auth:{persistSession:false,autoRefreshToken:false},global:{headers:{Authorization:authorization}}});
 const identity=await caller.auth.getUser(authorization.slice(7));
 if(identity.error||!identity.data.user)return json({error:'Sign in again as superadmin.'},401);
 const permission=await caller.rpc('is_superadmin');if(permission.error||permission.data!==true)return json({error:'Only superadmins manage staff accounts.'},403);
 let input:Record<string,unknown>;try{input=await request.json();if(!input||typeof input!=='object')throw new Error();}catch{return json({error:'Provide valid staff account details.'},400);}
 const server=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
 try{
  const requested=input.permissions;
  if(!Array.isArray(requested)||requested.some(value=>typeof value!=='string'||!permissions.has(value)))return json({error:'Select valid staff permissions.'},400);
  if(input.action==='invite'||input.action==='add_existing'){
   if(typeof input.email!=='string'||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email)||input.email.length>254)return json({error:'Enter a valid staff email address.'},400);
   const email=input.email.trim().toLowerCase();let userId:string;
   if(input.action==='invite'){
    const profile=validateProfileFields({firstName:String(input.firstName??''),lastName:String(input.lastName??''),contactNumber:String(input.contactNumber??''),address:String(input.address??'')});
    const origin=Deno.env.get('APP_SITE_URL');if(!origin||!/^https:\/\//.test(origin))return json({error:'Configure the production site URL before inviting staff.'},503);
    const setupUrl=new URL('/staff',origin);setupUrl.searchParams.set('recovery','1');setupUrl.searchParams.set('staff','1');
    const invited=await server.auth.admin.inviteUserByEmail(email,{redirectTo:setupUrl.toString(),data:{first_name:profile.firstName,last_name:profile.lastName,contact_number:profile.contactNumber,address:profile.address}});
    if(invited.error||!invited.data.user)return json({error:'Could not invite this account. If it is already registered, use Add existing account instead.'},409);
    userId=invited.data.user.id;
   }else{
    const existing=await server.from('resident_profiles').select('id').eq('email',email).maybeSingle();
    if(existing.error||!existing.data)return json({error:'No matching registered account was found.'},404);
    const confirmed=await server.auth.admin.getUserById(existing.data.id);
    if(confirmed.error||!confirmed.data.user?.email_confirmed_at)return json({error:'Ask this account to confirm its email before assigning staff access.'},409);
    userId=existing.data.id;
   }
   const current=await server.from('staff_access').select('version').eq('user_id',userId).maybeSingle();if(current.error)throw current.error;
   const saved=await caller.rpc('set_staff_access',{p_user:userId,p_version:current.data?.version??null,p_active:true,p_superadmin:false,p_permissions:requested});
   if(saved.error)return json({error:input.action==='invite'?'Invitation created, but access could not be assigned. After email confirmation, use Add existing account to finish setup.':'Staff access could not be assigned. Refresh the account list and retry.'},409);
   return json({success:true,invited:input.action==='invite'});
  }
  if(input.action==='update'){
   if(typeof input.userId!=='string'||typeof input.version!=='number'||typeof input.active!=='boolean'||typeof input.superadmin!=='boolean')return json({error:'Refresh the staff account before saving.'},400);
   const saved=await caller.rpc('set_staff_access',{p_user:input.userId,p_version:input.version,p_active:input.active,p_superadmin:input.superadmin,p_permissions:requested});
   if(saved.error)return json({error:saved.error.message},409);
   const login=await server.auth.admin.updateUserById(input.userId,{ban_duration:input.active?'none':'876000h'});
   return json({success:true,accessUpdated:true,loginRestrictionUpdated:!login.error,...(login.error?{warning:'Access permissions were saved. The authentication login restriction needs administrator review.'}:{})});
  }
  return json({error:'Unknown staff management action.'},400);
 }catch(cause){console.error('Staff management failed.',cause instanceof Error?cause.message:'Unexpected error');return json({error:'Could not finish staff management. Check the account details and try again.'},503);}
});
