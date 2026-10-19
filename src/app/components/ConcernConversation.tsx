import { useEffect,useRef,useState } from 'react';
import { Dialog,DialogContent,DialogDescription,DialogTitle } from './ui/dialog';
import { requireSupabase } from '../supabase';
import { adminRpc,subscribeAdminTables,timeInManila } from '../adminData';
import type { ConcernEvent,ConcernMessage } from '../adminData';
import type { ResidentConcern } from '../portalData';
import {readChatAttachments,sendChatMessage} from '../chatAttachments';
import ChatFilePicker from './ChatFilePicker';
import ChatAttachmentList from './ChatAttachmentList';

const field='min-h-11 w-full rounded border border-[#c9d1ca] bg-white px-3 py-2 text-base';
async function readHistory(table:string,reference:string){const rows:any[]=[];for(let page=0;;page++){const result=await requireSupabase().from(table).select('*').eq('reference',reference).order('created_at',{ascending:false}).order('id').range(page*500,page*500+499);if(result.error)return result;rows.push(...result.data);if(result.data.length<500)return {...result,data:rows};}}
const button='min-h-11 rounded border border-[#c9d1ca] bg-white px-4 py-2 text-sm font-semibold disabled:opacity-50';
export default function ConcernConversation({concern,staff,onClose,onUpdated}:{concern:ResidentConcern;staff:boolean;onClose:()=>void;onUpdated:(next:ResidentConcern)=>void}){
 const [current,setCurrent]=useState(concern),[messages,setMessages]=useState<ConcernMessage[]>([]),[events,setEvents]=useState<ConcernEvent[]>([]);
 const [body,setBody]=useState(''),[internal,setInternal]=useState(false),[note,setNote]=useState(''),[status,setStatus]=useState(concern.status);
 const [error,setError]=useState(''),[loadError,setLoadError]=useState(''),[busy,setBusy]=useState(false),[loading,setLoading]=useState(true),[revision,setRevision]=useState(0);
 const lock=useRef(false),messageId=useRef(crypto.randomUUID());
 const [files,setFiles]=useState<File[]>([]),[checkingFiles,setCheckingFiles]=useState(false);
 useEffect(()=>{let active=true;const load=async()=>{try{
 const client=requireSupabase();const [row,conversation,history,attachments]=await Promise.all([
 client.from('resident_concerns').select('*').eq('reference',concern.reference).single(),
 readHistory('concern_messages',concern.reference),
 readHistory('concern_events',concern.reference),readChatAttachments('concern',concern.reference)]);
 if(row.error||conversation.error||history.error)throw new Error(row.error?.message??conversation.error?.message??history.error?.message);
 if(active){const next:ResidentConcern={reference:row.data.reference,ownerId:row.data.owner_id,name:row.data.name,contact:row.data.contact,category:row.data.category,message:row.data.message,status:row.data.status,archived:row.data.archived,submittedAt:row.data.submitted_at,version:row.data.version,resolutionNote:row.data.resolution_note};setCurrent(next);setMessages(conversation.data.slice().reverse().map((item:ConcernMessage)=>({...item,attachments:attachments.filter(file=>file.concern_message_id===item.id)})));setEvents(history.data.slice().reverse());setLoadError('');}
 }catch(cause){if(active)setLoadError(cause instanceof Error?cause.message:'Could not load this concern.');}finally{if(active)setLoading(false);}};
 void load();const unsubscribe=subscribeAdminTables(['resident_concerns','concern_messages','concern_events','chat_attachments'],()=>void load());return()=>{active=false;unsubscribe();};},[concern.reference,revision]);
 const update=async(archive?:boolean)=>{if(lock.current)return;lock.current=true;setBusy(true);setError('');try{
 const row=await adminRpc<Record<string,any>>('manage_concern',{p_reference:current.reference,p_version:current.version,p_status:archive===undefined?status:null,p_note:archive===undefined?note:null,p_archived:archive??null});
 const next={...current,status:row.status,archived:row.archived,version:row.version,resolutionNote:row.resolution_note};setCurrent(next);onUpdated(next);setNote('');setRevision(value=>value+1);
 }catch(cause){setError(cause instanceof Error?cause.message:'Could not update the concern.');setRevision(value=>value+1);}finally{lock.current=false;setBusy(false);}};
 return <Dialog open onOpenChange={open=>{if(!open&&!busy)onClose();}}><DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl">
 <DialogTitle>Concern {current.reference}</DialogTitle><DialogDescription>Review the original submission, conversation, and handling history.</DialogDescription>
 <p className="text-sm text-[#53645b]">{current.name} · {current.category} · {timeInManila(current.submittedAt)} · {current.status.replaceAll('_',' ')}</p>
 <p className="whitespace-pre-wrap rounded border p-3 text-sm">{current.message}</p>
 {current.resolutionNote&&<p className="whitespace-pre-wrap text-sm"><strong>Staff explanation:</strong> {current.resolutionNote}</p>}
 {loading&&<p role="status">Loading conversation…</p>}{(error||loadError)&&<p role="alert" className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-900">{error||loadError} <button type="button" className="underline" onClick={()=>setRevision(value=>value+1)}>Reload</button></p>}
 <section className="space-y-3" aria-label="Concern conversation"><h3 className="font-bold">Conversation</h3>
 {messages.map(item=><article key={item.id} className={`space-y-1 rounded border p-3 ${item.internal?'border-amber-300 bg-amber-50':'bg-[#f7faf7]'}`}><p className="text-xs font-semibold">{item.author_name} · {item.staff?'Staff':'Resident'}{item.internal?' · Internal note':''} · {timeInManila(item.created_at)}</p><p className="whitespace-pre-wrap break-words text-sm">{item.body}</p><ChatAttachmentList files={item.attachments}/></article>)}
 {!messages.length&&!loading&&<p className="text-sm text-[#53645b]">No messages yet.</p>}
 {!current.archived&&<form className="space-y-2" onSubmit={async event=>{event.preventDefault();if(lock.current||checkingFiles||(!body.trim()&&!files.length))return;lock.current=true;setBusy(true);setError('');try{
 const saved=await sendChatMessage<ConcernMessage>('concern',current.reference,messageId.current,body,files,staff&&internal);setMessages(previous=>[...previous.filter(item=>item.id!==saved.id),saved]);setBody('');setFiles([]);messageId.current=crypto.randomUUID();
 }catch(cause){setError(cause instanceof Error?cause.message:'Could not send the message. Your text is still here.');}finally{lock.current=false;setBusy(false);}}}>
 <label className="grid gap-1 text-sm font-semibold">{internal&&staff?'Internal staff note':'Message'}<textarea required={!files.length} rows={3} maxLength={2000} value={body} disabled={busy} onChange={event=>{setBody(event.target.value);messageId.current=crypto.randomUUID();}} className={field}/></label>
 {staff&&<label className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" checked={internal} disabled={busy} onChange={event=>{setInternal(event.target.checked);messageId.current=crypto.randomUUID();}}/>Internal note — visible to authorized staff</label>}
 <ChatFilePicker files={files} onChange={next=>{setFiles(next);messageId.current=crypto.randomUUID();}} disabled={busy} onChecking={setCheckingFiles}/><button disabled={busy||checkingFiles||(!body.trim()&&!files.length)} className={button}>{busy?'Saving…':internal&&staff?'Save internal note':'Send message'}</button>
 </form>}
 </section>
 {staff&&<section className="space-y-3 border-t pt-3"><h3 className="font-bold">Handle concern</h3>
 {!current.archived&&<form className="space-y-2" onSubmit={event=>{event.preventDefault();void update();}}>
 <label className="grid gap-1 text-sm font-semibold">Status<select className={field} value={status} disabled={busy} onChange={event=>setStatus(event.target.value as ResidentConcern['status'])}><option value="RECEIVED">Received</option><option value="IN_REVIEW">In review / reopen</option><option value="RESOLVED">Resolved</option></select></label>
 <label className="grid gap-1 text-sm font-semibold">Resolution or reason for this update<textarea required maxLength={2000} rows={3} className={field} value={note} disabled={busy} onChange={event=>setNote(event.target.value)}/></label><button className={button} disabled={busy||!note.trim()}>Save concern update</button>
 </form>}
 <button type="button" disabled={busy} onClick={()=>void update(!current.archived)} className={button}>{current.archived?'Restore concern':'Archive concern'}</button>
 </section>}
 <section className="space-y-2 border-t pt-3"><h3 className="font-bold">Handling history</h3>{events.map(item=><article key={item.id} className="border-l-2 pl-3 text-sm"><p className="whitespace-pre-wrap">{item.description}</p><p className="text-xs text-[#53645b]">{item.actor_name} · {timeInManila(item.created_at)}</p></article>)}</section>
 </DialogContent></Dialog>;
}
