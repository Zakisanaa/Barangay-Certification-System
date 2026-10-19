import {useEffect,useState} from 'react';
import {requireSupabase} from '../supabase';
import type {ChatAttachment} from '../chatAttachments';
function Attachment({file}:{file:ChatAttachment}){
 const [url,setUrl]=useState(''),[error,setError]=useState(''),[revision,setRevision]=useState(0),[previewFailed,setPreviewFailed]=useState(false);
 useEffect(()=>{let active=true;setUrl('');setError('');setPreviewFailed(false);void requireSupabase().storage.from('conversation-attachments').createSignedUrl(file.storage_path,300).then(({data,error})=>{if(!active)return;if(error){setError('Could not open this private attachment. Refresh its link to retry.');return;}setUrl(data.signedUrl);setError('');}).catch(()=>{if(active)setError('Could not open this private attachment. Refresh its link to retry.');});return()=>{active=false;};},[file.storage_path,revision]);
 return <article className="min-w-0 space-y-2 rounded border border-[#d9e2da] bg-white p-3 text-sm">
 <p className="break-all font-semibold">{file.file_name}</p><p className="text-xs text-[#53645b]">{(file.file_size/1024).toFixed(1)} KB</p>
 {url&&<a href={url} target="_blank" rel="noreferrer" className="block break-words font-semibold underline">{file.mime_type.startsWith('image/')&&!previewFailed&&<img src={url} alt={`Attachment: ${file.file_name}`} loading="lazy" onError={()=>setPreviewFailed(true)} className="mb-2 max-h-48 w-full rounded object-contain"/>}Open {file.mime_type.startsWith('image/')?'image':'file'}</a>}
 {(error||previewFailed)&&<p role="alert" className="text-red-900">{error||'Preview unavailable. Refresh the file link to try again.'}</p>}
 <button type="button" className="min-h-11 underline" onClick={()=>setRevision(value=>value+1)}>Refresh file link</button>
 </article>;
}
export default function ChatAttachmentList({files=[]}:{files?:ChatAttachment[]}){return files.length?<div className="mt-2 grid min-w-0 gap-2" aria-label="Attached message files">{files.map(file=><Attachment key={file.id} file={file}/>)}</div>:null;}
