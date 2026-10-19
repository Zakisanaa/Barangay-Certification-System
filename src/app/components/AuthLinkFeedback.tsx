import {useEffect,useState} from 'react';
import {authLinkNotice,clearAuthLinkNotice,pendingEmailNotice,readAuthLinkNotice} from '../authLinkNotice';
import type {AuthLinkNotice} from '../authLinkNotice';
import {supabase} from '../supabase';
const completed:AuthLinkNotice={error:false,status:'complete',text:'Your email address has been updated. Use the new address next time you sign in.'};
const accepted:AuthLinkNotice={error:false,status:'accepted',text:'Email confirmation accepted. Open My profile to check your current sign-in email and any pending change.'};
export default function AuthLinkFeedback(){
 const [initial]=useState(()=>authLinkNotice??readAuthLinkNotice(window.location));
 const [notice,setNotice]=useState(initial);
 const visible=notice!==null;
 useEffect(()=>{
  if(!initial||!visible)return;
  let active=true,generation=0,timer:ReturnType<typeof setTimeout>|undefined;
  const client=supabase;
  const refresh=async()=>{
   if(!client||initial.error)return;
   const requested=++generation;
   try{
    const {data,error}=await client.auth.getUser();
    if(!active||requested!==generation)return;
    if(error||!data.user){setNotice(initial.status==='pending'?pendingEmailNotice:accepted);return;}
    setNotice(data.user.new_email?pendingEmailNotice:completed);
   }catch{if(active&&requested===generation)setNotice(initial.status==='pending'?pendingEmailNotice:accepted);}
  };
  // Await SDK initialization before removing callback parameters it may still need.
  void (client?client.auth.getSession():Promise.resolve()).catch(()=>{}).then(()=>{clearAuthLinkNotice();if(active)void refresh();});
  const schedule=()=>{clearTimeout(timer);timer=setTimeout(()=>void refresh(),0);};
  const subscription=!initial.error?client?.auth.onAuthStateChange(event=>{
   if(event==='SIGNED_OUT'){generation++;setNotice(null);}
   else if(['SIGNED_IN','USER_UPDATED','TOKEN_REFRESHED'].includes(event))schedule();
  }).data.subscription:undefined;
  const onVisible=()=>{if(document.visibilityState==='visible')schedule();};
  window.addEventListener('focus',schedule);document.addEventListener('visibilitychange',onVisible);
  return()=>{active=false;generation++;clearTimeout(timer);subscription?.unsubscribe();window.removeEventListener('focus',schedule);document.removeEventListener('visibilitychange',onVisible);};
 },[initial,visible]);
 useEffect(()=>{
  if(notice?.status!=='complete')return;
  const timer=setTimeout(()=>setNotice(null),6000);return()=>clearTimeout(timer);
 },[notice]);
 if(!notice)return null;
 return <div aria-label="Email confirmation" role={notice.error?'alert':'status'} className="fixed left-3 right-3 top-3 z-[100] mx-auto max-w-xl rounded border border-[#aebeb2] bg-white p-4 text-sm text-[#122d1f] shadow-lg"><p>{notice.text}</p><button type="button" className="mt-2 min-h-11 rounded border px-4 font-semibold" onClick={()=>setNotice(null)}>Dismiss message</button></div>;
}
