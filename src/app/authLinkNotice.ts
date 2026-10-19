export type AuthLinkNotice={error:boolean;status:'error'|'pending'|'accepted'|'complete';text:string};
export const pendingEmailNotice:AuthLinkNotice={error:false,status:'pending',text:'Email confirmation accepted. Confirm the newest link sent to your other inbox to finish changing your email.'};
export function readAuthLinkNotice(location:{search:string;hash:string}):AuthLinkNotice|null{
 const query=new URLSearchParams(location.search),fragment=new URLSearchParams(location.hash.slice(1));
 if(query.has('error')||fragment.has('error')||query.has('error_code')||fragment.has('error_code'))return {error:true,status:'error',text:'This confirmation link has expired or is invalid. Request a new link from the sign-in page or My profile.'};
 const message=query.get('message')??fragment.get('message')??'';
 if(message.toLowerCase().includes('confirmation link accepted'))return pendingEmailNotice;
 if(query.get('type')==='email_change'||fragment.get('type')==='email_change')return {error:false,status:'accepted',text:'Email confirmation accepted. Checking your current email status…'};
 return null;
}
export function authLinkNoticePath(location:{pathname:string;search:string;hash:string}){
 const clean=(value:string,prefix:string)=>{
  const params=new URLSearchParams(value.slice(1));let changed=false;
  for(const key of ['error','error_code','error_description'])if(params.has(key)){params.delete(key);changed=true;}
  if(params.get('type')==='email_change'){params.delete('type');changed=true;}
  if(params.get('message')?.toLowerCase().includes('confirmation link accepted')){params.delete('message');changed=true;}
  const result=params.toString();return changed?(result?prefix+result:''):value;
 };
 return location.pathname+clean(location.search,'?')+clean(location.hash,'#');
}
// Capture before the auth SDK consumes the URL fragment.
export let authLinkNotice=typeof window==='undefined'?null:readAuthLinkNotice(window.location);
export function clearAuthLinkNotice(){
 authLinkNotice=null;
 if(typeof window==='undefined')return;
 const path=authLinkNoticePath(window.location);
 try{window.history.replaceState(window.history.state,'',path);}catch{/* The banner can still be dismissed if browser history is unavailable. */}
}
