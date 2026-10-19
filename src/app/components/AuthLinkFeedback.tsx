import {useState} from 'react';
import {authLinkNotice,readAuthLinkNotice} from '../authLinkNotice';
export default function AuthLinkFeedback(){
 const [notice,setNotice]=useState(()=>authLinkNotice??readAuthLinkNotice(window.location));
 if(!notice)return null;
 return <div role={notice.error?'alert':'status'} className="fixed left-3 right-3 top-3 z-[100] mx-auto max-w-xl rounded border border-[#aebeb2] bg-white p-4 text-sm text-[#122d1f] shadow-lg"><p>{notice.text}</p><button type="button" className="mt-2 min-h-11 rounded border px-4 font-semibold" onClick={()=>setNotice(null)}>Dismiss message</button></div>;
}
