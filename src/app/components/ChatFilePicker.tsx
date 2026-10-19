import {useRef,useState} from 'react';
import {CHAT_FILE_ACCEPT,CHAT_MAX_FILES,validateChatFile} from '../chatFiles';
export default function ChatFilePicker({files,onChange,disabled,onChecking}:{files:File[];onChange:(files:File[])=>void;disabled:boolean;onChecking:(checking:boolean)=>void}){
 const [checking,setChecking]=useState(false),[error,setError]=useState('');const version=useRef(0);
 return <div className="min-w-0 space-y-2" aria-label="Message attachments">
 <label className="grid gap-1 text-sm font-semibold">Attach images or files<input type="file" multiple accept={CHAT_FILE_ACCEPT} aria-label="Attach images or files" disabled={disabled||checking} className="min-h-11 w-full min-w-0 rounded border border-[#c9d1ca] bg-white p-2 text-sm" onChange={async event=>{
  const input=event.currentTarget,selected=Array.from(input.files??[]),selection=++version.current;input.value='';setError('');
  if(files.length+selected.length>CHAT_MAX_FILES){setError('Attach up to three files per message.');return;}
  setChecking(true);onChecking(true);
  try{for(const file of selected)await validateChatFile(file);if(selection===version.current)onChange([...files,...selected]);}
  catch(cause){if(selection===version.current)setError(cause instanceof Error?cause.message:'Could not use this file.');}
  finally{if(selection===version.current){setChecking(false);onChecking(false);}}
 }}/></label>
 <p className="text-xs text-[#53645b]">JPG, PNG, WebP, PDF, DOCX, or TXT. Up to 3 files, 5 MB each. Files are private to this conversation.</p>
 {checking&&<p role="status" className="text-sm">Checking attachments…</p>}{error&&<p role="alert" className="text-sm text-red-900">{error}</p>}
 {files.map((file,index)=><div key={`${index}:${file.name}`} className="flex min-w-0 flex-wrap items-center justify-between gap-2 rounded border bg-white p-2 text-sm"><span className="min-w-0 break-all">{file.name} · {(file.size/1024).toFixed(1)} KB</span><button type="button" aria-label={`Remove ${file.name}`} disabled={disabled||checking} onClick={()=>{onChange(files.filter((_,position)=>position!==index));setError('');}} className="min-h-11 rounded border px-3 font-semibold disabled:opacity-50">Remove</button></div>)}
 </div>;
}
