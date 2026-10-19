import {useEffect,useRef,useState} from 'react';
import {Bell} from 'lucide-react';
import {toast} from 'sonner';
import {adminRpc,subscribeAdminTables,timeInManila} from '../adminData';
import type {PortalNotification} from '../notificationNavigation';
import {Popover,PopoverContent,PopoverTrigger} from './ui/popover';
type Feed={rows:PortalNotification[];total:number;unread:number};
const empty:Feed={rows:[],total:0,unread:0};
const button='min-h-11 rounded border border-[#c9d1ca] bg-white px-3 text-sm font-semibold text-[#123323] disabled:opacity-50';
export default function NotificationBell({role,scope,onOpenRecord,onOpenInbox}:{role:'staff'|'resident';scope:string;onOpenRecord:(item:PortalNotification)=>void;onOpenInbox?:()=>void}){
 const [latest,setLatest]=useState<Feed>(empty),[older,setOlder]=useState<Feed>(empty),[open,setOpen]=useState(false),[page,setPage]=useState(0),[busy,setBusy]=useState(false),[loading,setLoading]=useState(true),[error,setError]=useState(''),[revision,setRevision]=useState(0);
 const callbacks=useRef({onOpenRecord,onOpenInbox});callbacks.current={onOpenRecord,onOpenInbox};
 const mounted=useRef(true);
 const read=(value:number)=>adminRpc<Feed>(role==='staff'?'staff_inbox':'resident_notification_feed',{p_page:value});
 const mark=async(ids:string[])=>{await adminRpc(role==='staff'?'mark_staff_notifications_read':'mark_resident_notifications_read',{p_ids:ids});};
 const openRecord=async(item:PortalNotification)=>{if(busy)return;setBusy(true);try{await mark([item.id]);if(mounted.current){setRevision(value=>value+1);setOpen(false);callbacks.current.onOpenRecord(item);}}catch(cause){if(mounted.current)setError(cause instanceof Error?cause.message:'Could not open this notification.');}finally{if(mounted.current)setBusy(false);}};
 const openRef=useRef(openRecord);openRef.current=openRecord;
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;};},[]);
 useEffect(()=>{
  let active=true,generation=0;const seen=new Set<string>(),toastIds=new Set<string|number>();let ready=false,watermark=-Infinity;
  const load=async()=>{const requested=++generation;try{const result=await read(0);if(!active||requested!==generation)return;
   if(ready){const added=result.rows.filter(item=>!item.read&&!seen.has(item.id)&&Date.parse(item.created_at)>=watermark);for(const item of added.slice(0,3)){const id='portal-notice-'+item.id;toastIds.add(id);toast(item.title,{id,description:item.body.slice(0,180),duration:9000,action:{label:'Open update',onClick:()=>{void openRef.current(item);}}});}}
   for(const item of result.rows){seen.add(item.id);watermark=Math.max(watermark,Date.parse(item.created_at)||0);}if(seen.size>500){seen.clear();for(const item of result.rows)seen.add(item.id);}
   ready=true;setLatest(result);setError('');
  }catch(cause){if(active&&requested===generation)setError(cause instanceof Error?cause.message:'Could not load notifications.');}finally{if(active&&requested===generation)setLoading(false);}};
  void load();const stop=subscribeAdminTables(role==='staff'?['staff_notifications','staff_notification_reads']:['resident_notifications'],()=>void load());
  const refresh=()=>void load();window.addEventListener('portal-notifications-refresh',refresh);
  return()=>{active=false;stop();window.removeEventListener('portal-notifications-refresh',refresh);for(const id of toastIds)toast.dismiss(id);};
 },[role,scope]);
 useEffect(()=>{if(revision)window.dispatchEvent(new Event('portal-notifications-refresh'));},[revision]);
 useEffect(()=>{if(!open||page===0)return;let active=true;setLoading(true);void read(page).then(result=>{if(active){setOlder(result);setError('');}}).catch(cause=>{if(active)setError(cause instanceof Error?cause.message:'Could not load older notifications.');}).finally(()=>{if(active)setLoading(false);});return()=>{active=false;};},[open,page,latest,role,scope]);
 const data=page===0?latest:older;
 return <Popover open={open} onOpenChange={value=>{setOpen(value);if(value)setPage(0);}}><PopoverTrigger asChild><button type="button" aria-label={`Notifications${latest.unread?`, ${latest.unread} unread`:''}`} title={error?'Notifications unavailable. Open to retry.':'Notifications'} className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded border border-[#c9d1ca] bg-white text-[#123323] hover:bg-[#edf5ee]"><Bell className="h-5 w-5" aria-hidden="true"/>{latest.unread>0&&<span data-notification-count={latest.unread} aria-hidden="true" className="absolute -right-1 -top-1 min-w-5 rounded-full bg-red-700 px-1 text-center text-xs font-bold leading-5 text-white">{latest.unread>99?'99+':latest.unread}</span>}</button></PopoverTrigger>
 <PopoverContent align="end" collisionPadding={8} aria-label="Notifications" className="flex max-h-[min(75dvh,640px)] w-[min(400px,calc(100vw-16px))] flex-col gap-3 p-4"><div className="flex items-center justify-between gap-3"><h2 className="text-lg font-bold">Notifications</h2><span role="status" className="text-sm">{latest.unread} unread</span></div>
 {error&&<div role="alert" className="space-y-2 text-sm text-red-900"><p>{error}</p><button type="button" className={button} onClick={()=>setRevision(value=>value+1)}>Retry notifications</button></div>}
 {loading&&<p role="status" className="text-sm">Loading notifications...</p>}
 <div className="min-h-0 space-y-3 overflow-y-auto" aria-label="Recent notification updates">{data.rows.map(item=><article key={item.id} className={`space-y-2 rounded border p-3 ${item.read?'bg-white':'border-green-300 bg-[#f0f7f1]'}`}><p className="break-words text-sm font-bold">{!item.read&&<span className="mr-2 text-green-800">Unread</span>}{item.title}</p><p className="whitespace-pre-line break-words text-sm">{item.body}</p><p className="break-words text-xs text-[#53645b]">{timeInManila(item.created_at)}</p><button type="button" disabled={busy} className={button} onClick={()=>void openRecord(item)}>Open update</button></article>)}{!loading&&!error&&!data.rows.length&&<p className="text-sm">No notifications yet.</p>}</div>
 <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-3"><button type="button" className={button} disabled={loading||page===0} onClick={()=>setPage(value=>value-1)}>Newer updates</button><span className="text-xs">Page {page+1} of {Math.max(1,Math.ceil(latest.total/25))}</span><button type="button" className={button} disabled={loading||(page+1)*25>=latest.total} onClick={()=>setPage(value=>value+1)}>Older updates</button></div>
 <div className="flex flex-wrap gap-2"><button type="button" className={button} disabled={busy||!data.rows.some(item=>!item.read)} onClick={()=>{setBusy(true);void mark(data.rows.map(item=>item.id)).then(()=>{if(mounted.current)setRevision(value=>value+1);}).catch(cause=>{if(mounted.current)setError(cause instanceof Error?cause.message:'Could not mark notifications read.');}).finally(()=>{if(mounted.current)setBusy(false);});}}>Mark these read</button>{onOpenInbox&&<button type="button" className={button} onClick={()=>{setOpen(false);callbacks.current.onOpenInbox?.();}}>Open notification inbox</button>}</div>
 </PopoverContent></Popover>;
}
