import {supabase,requireSupabase} from './supabase';
export interface ListOptions {page?:number;size?:number;query?:string;sort?:string;archived?:boolean|null;status?:string|null;date?:string|null;owner?:string|null}
export async function portalList<T>(kind:string,options:ListOptions={}){const{data,error}=await requireSupabase().rpc(options.sort?'portal_list_sorted':'portal_list',{p_kind:kind,p_page:options.page??0,p_size:options.size??25,p_query:options.query?.trim()??'',p_archived:options.archived??null,p_status:options.status??null,p_date:options.date||null,p_owner:options.owner??null,...(options.sort?{p_sort:options.sort}:{})});if(error)throw new Error(error.message);return data as {rows:T[];total:number};}
export async function allPortalRows<T>(kind:string,options:ListOptions={}){const rows:T[]=[];for(let page=0;;page++){const result=await portalList<T>(kind,{...options,page,size:100});rows.push(...result.rows);if(rows.length>=result.total||!result.rows.length)return rows;}}
export async function readAll<T>(build:(from:number,to:number)=>PromiseLike<{data:T[]|null;error:{message:string}|null}>){const rows:T[]=[];for(let from=0;;from+=500){const result=await build(from,from+499);if(result.error)throw new Error(result.error.message);rows.push(...result.data??[]);if((result.data?.length??0)<500)return rows;}}
export function reliableSubscription(tables:string[],refresh:()=>void){
 let stopped=false,pending=false;const update=()=>{if(stopped||pending)return;pending=true;queueMicrotask(()=>{pending=false;if(!stopped)refresh();});};
 const reconnect=()=>{if(document.visibilityState==='visible')update();};
 window.addEventListener('focus',reconnect);window.addEventListener('online',reconnect);document.addEventListener('visibilitychange',reconnect);
 const interval=window.setInterval(reconnect,30000),client=supabase,channel=client?.channel(`live-${crypto.randomUUID()}`);
 for(const table of tables)channel?.on('postgres_changes',{event:'*',schema:'public',table},update);
 channel?.subscribe(status=>{if(['SUBSCRIBED','CHANNEL_ERROR','TIMED_OUT','CLOSED'].includes(status))update();});
 return()=>{stopped=true;clearInterval(interval);window.removeEventListener('focus',reconnect);window.removeEventListener('online',reconnect);document.removeEventListener('visibilitychange',reconnect);if(channel)void client?.removeChannel(channel);};
}
export function checkRevision(error:{message:string}|null,data:unknown){if(error||!data)throw new Error(error?.message&& !/0 rows|multiple.*rows|single.*object/i.test(error.message)?error.message:'Another staff member changed this record. Reload and review it before saving.');}
