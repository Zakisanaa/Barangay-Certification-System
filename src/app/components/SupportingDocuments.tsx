import { useEffect,useState } from 'react';
import { requireSupabase } from '../supabase';
import { adminRpc,removeUnusedPrivateFile,subscribeAdminTables,timeInManila,uploadPrivateFile } from '../adminData';
import type { RequestAttachment } from '../adminData';
import { PrivateDocumentLink } from './ResidentVerification';
import { WorkflowFeedback,useWorkflowAction,workflowButton as button,workflowField as field } from './AdminWorkflowUi';

export default function SupportingDocuments({reference,ownerId,staff,active=true}:{reference:string;ownerId:string;staff:boolean;active?:boolean}){
 const [documents,setDocuments]=useState<RequestAttachment[]>([]),[loadError,setLoadError]=useState(''),[revision,setRevision]=useState(0);
 const [selected,setSelected]=useState<RequestAttachment|null>(null),[decision,setDecision]=useState('ACCEPTED'),[note,setNote]=useState(''),[file,setFile]=useState<File|null>(null);const action=useWorkflowAction();
 useEffect(()=>{let active=true;const load=async()=>{try{const {data,error}=await requireSupabase().from('request_attachments').select('*').eq('request_reference',reference).order('created_at');if(error)throw new Error(error.message);if(active){setDocuments(data);setLoadError('');}}catch(cause){if(active)setLoadError(cause instanceof Error?cause.message:'Could not load supporting documents.');}};void load();const unsubscribe=subscribeAdminTables(['request_attachments'],()=>void load());return()=>{active=false;unsubscribe();};},[reference,revision]);
 if(!documents.length&&!loadError)return null;
 return <section className="space-y-3 border-t pt-4" aria-label="Supporting documents"><h3 className="font-bold">Supporting documents</h3>{loadError&&<p role="alert" className="text-sm text-red-900">{loadError}</p>}<WorkflowFeedback {...action}/>
 {documents.map(item=><article key={item.id} className="space-y-2 rounded border p-3 text-sm"><p className="font-semibold">{item.requirement_title} · {item.status.replaceAll('_',' ')}</p><p className="text-xs text-[#53645b]">Submitted {timeInManila(item.created_at)}</p>{item.review_note&&<p className="whitespace-pre-wrap">{item.review_note}</p>}<PrivateDocumentLink bucket="request-attachments" path={item.storage_path}/>
 {active&&item.status!=='REPLACED'&&(staff||item.status==='REPLACEMENT_REQUESTED')&&<button type="button" disabled={action.busy} className={button} onClick={()=>{setSelected(item);setNote('');setFile(null);}}>{staff?'Review document':'Upload requested correction'}</button>}
 </article>)}
 {selected&&<form className="space-y-3 rounded border bg-[#f7faf7] p-3" onSubmit={event=>{event.preventDefault();void action.run(async()=>{
 if(staff){const updated=await adminRpc<RequestAttachment>('review_request_attachment',{p_id:selected.id,p_version:selected.version,p_status:decision,p_note:note});setDocuments(current=>current.map(item=>item.id===updated.id?updated:item));}
 else{if(!file)throw new Error('Choose the replacement file.');const path=await uploadPrivateFile('request-attachments',`${ownerId}/${reference}/${selected.requirement_id}`,file);try{await adminRpc('replace_request_attachment',{p_previous:selected.id,p_version:selected.version,p_id:crypto.randomUUID(),p_path:path});}catch(cause){await removeUnusedPrivateFile('request-attachments',path);throw cause;}setRevision(value=>value+1);}
 setSelected(null);},staff?'Document review saved.':'Replacement submitted for staff review.');}}>
 <h4 className="font-semibold">{selected.requirement_title}</h4>
 {staff?<><label className="grid gap-1 text-sm font-semibold">Review decision<select className={field} value={decision} disabled={action.busy} onChange={event=>setDecision(event.target.value)}><option value="ACCEPTED">Accept document</option><option value="REPLACEMENT_REQUESTED">Request correction or replacement</option></select></label><label className="grid gap-1 text-sm font-semibold">Instructions or review note<textarea required={decision==='REPLACEMENT_REQUESTED'} rows={3} maxLength={2000} value={note} disabled={action.busy} onChange={event=>setNote(event.target.value)} className={field}/></label></>:<label className="grid gap-1 text-sm font-semibold">Replacement file (PDF, JPG, PNG, or WebP, up to 5 MB)<input required type="file" accept="application/pdf,image/jpeg,image/png,image/webp" disabled={action.busy} onChange={event=>setFile(event.target.files?.[0]??null)} className={field}/></label>}
 <div className="flex flex-wrap gap-2"><button className={button} disabled={action.busy||(!staff&&!file)}>Save supporting document</button><button type="button" disabled={action.busy} className={button} onClick={()=>setSelected(null)}>Cancel</button></div>
 </form>}
 </section>;
}
