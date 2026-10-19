export function readAuthLinkNotice(location:{search:string;hash:string}){
 const query=new URLSearchParams(location.search),fragment=new URLSearchParams(location.hash.slice(1));
 if(query.has('error')||fragment.has('error')||query.has('error_code')||fragment.has('error_code'))return {error:true,text:'This confirmation link has expired or is invalid. Request a new link from the sign-in page or My profile.'};
 const message=query.get('message')??fragment.get('message')??'';
 if(query.get('type')==='email_change'||fragment.get('type')==='email_change'||message.toLowerCase().includes('confirmation link accepted'))return {error:false,text:'Email confirmation accepted. If your email change is still pending, confirm the newest link sent to your other inbox. Check My profile for the current status.'};
 return null;
}
// Capture before the auth SDK consumes the URL fragment.
export const authLinkNotice=typeof window==='undefined'?null:readAuthLinkNotice(window.location);
