import { useEffect, useState } from 'react';
import { requireSupabase } from '../supabase';
import type { ResidentAccount } from '../residentAuth';
import {getResidentProfile} from '../residentAuth';
import { WorkflowFeedback,useWorkflowAction,workflowButton as button,workflowCard as card,workflowField as field,workflowPrimary as primary } from './AdminWorkflowUi';

export default function AccountSecurity({resident,onEmailConfirmed}:{resident:ResidentAccount;onEmailConfirmed:(account:ResidentAccount)=>void}){
 const [email,setEmail]=useState(''),[password,setPassword]=useState('');
 const [pending,setPending]=useState(''),[loading,setLoading]=useState(true),[loadError,setLoadError]=useState(''),[revision,setRevision]=useState(0);
 const action=useWorkflowAction();
 // Auth owns the pending address; never update the profile before confirmation.
 useEffect(()=>{let active=true;setLoading(true);setPending('');setLoadError('');
  void requireSupabase().auth.getUser().then(async({data,error})=>{
   if(!active)return;
   if(error||data.user?.id!==resident.id){setLoadError('Could not check your email change. Try again or sign in again.');return;}
   setPending(data.user.new_email??'');
   if(data.user.email&&data.user.email.toLowerCase()!==resident.email.toLowerCase()){
    const account=await getResidentProfile(resident.id);
    if(active){onEmailConfirmed(account);action.setNotice('Your sign-in email has been updated.');}
   }
  }).catch(()=>{if(active)setLoadError('Could not check your email change. Try again.');}).finally(()=>{if(active)setLoading(false);});
  return()=>{active=false;};
 },[resident.id,resident.email,revision]);
 const redirect=()=>new URL('/',window.location.origin).toString();
 return <section className={card}><h2 className="text-lg font-bold">Change sign-in email</h2>
 <p className="text-sm text-[#53645b]">Enter your new email and current password. Confirm the links sent to both your current and new inboxes. Your current email stays in use until all required confirmations are complete.</p>
 <WorkflowFeedback {...action}/>
 {loading&&<p role="status" className="text-sm">Checking email change status...</p>}
 {loadError&&<div role="alert" className="space-y-2 text-sm"><p>{loadError}</p><button type="button" className={button} onClick={()=>setRevision(value=>value+1)}>Retry email status</button></div>}
 {pending&&<div aria-label="Pending email change" className="space-y-3 rounded border border-amber-300 bg-amber-50 p-3 text-sm"><p className="break-words"><strong>Awaiting email confirmation:</strong> {pending}</p><p className="break-words">Check {resident.email} and {pending}, including spam folders. Open the most recent confirmation link in each inbox. Then refresh the status here.</p><div className="flex flex-wrap gap-2"><button type="button" className={button} disabled={action.busy||loading} onClick={()=>void action.run(async()=>{const result=await requireSupabase().auth.resend({type:'email_change',email:resident.email,options:{emailRedirectTo:redirect()}});if(result.error)throw new Error(result.error.message);},'Confirmation links sent. Check both inboxes and use the newest links.')}>Resend confirmation links</button><button type="button" className={button} disabled={action.busy||loading} onClick={()=>setRevision(value=>value+1)}>Refresh email status</button></div></div>}
 <form className="space-y-3" onSubmit={event=>{event.preventDefault();void action.run(async()=>{
  const next=email.trim().toLowerCase(),client=requireSupabase();
  const current=await client.auth.getUser();
  if(current.error||current.data.user?.id!==resident.id)throw new Error('Sign in again with your own account.');
  const currentEmail=current.data.user.email??resident.email;
  if(next===currentEmail.toLowerCase())throw new Error('Enter a different email address.');
  const verified=await client.auth.signInWithPassword({email:currentEmail,password});
  if(verified.error)throw new Error('Could not verify your current password.');
  if(verified.data.user?.id!==resident.id)throw new Error('Sign in again with your own account.');
  const result=await client.auth.updateUser({email:next},{emailRedirectTo:redirect()});
  if(result.error)throw new Error(result.error.message);
  setPending(result.data.user?.new_email??(result.data.user?.email===next?'':next));setPassword('');setEmail('');
 },'Email change requested. Confirm the newest links in both your current and new email inboxes.');}}>
 <label className="grid gap-1 text-sm font-semibold">New email<input required type="email" autoComplete="email" maxLength={254} disabled={action.busy||loading||!!loadError} value={email} onChange={event=>setEmail(event.target.value)} className={field}/></label>
 <label className="grid gap-1 text-sm font-semibold">Current password<input required type="password" autoComplete="current-password" disabled={action.busy||loading||!!loadError} value={password} onChange={event=>setPassword(event.target.value)} className={field}/></label>
 <button className={primary} disabled={action.busy||loading||!!loadError}>Request email change</button>
 </form></section>;
}
