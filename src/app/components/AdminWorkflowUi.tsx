import { useEffect,useRef,useState } from 'react';
import { adminRpc,subscribeAdminTables } from '../adminData';
export const workflowField='min-h-11 w-full rounded border border-[#aebeb2] bg-white px-3 py-2 text-base text-[#122d1f] disabled:opacity-60';
export const workflowButton='min-h-11 rounded border border-[#c9d1ca] bg-white px-4 py-2 text-sm font-semibold disabled:opacity-50';
export const workflowPrimary='min-h-11 rounded bg-[#123323] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50';
export const workflowCard='min-w-0 space-y-4 rounded-lg border border-[#c9d1ca] bg-white p-4 text-[#122d1f] shadow-sm sm:p-6';
export function useWorkflowAction(){
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');const lock=useRef(false);
 const run=async(job:()=>Promise<void>,success?:string)=>{if(lock.current)return;lock.current=true;setBusy(true);setError('');setNotice('');try{await job();if(success)setNotice(success);}catch(cause){setError(cause instanceof Error?cause.message:'Could not finish this action. Your entries are still here.');}finally{lock.current=false;setBusy(false);}};
 return {busy,error,notice,run,setError,setNotice};
}
export function WorkflowFeedback({busy,error,notice}:{busy?:boolean;error?:string;notice?:string}){return <>{busy&&<p role="status" className="text-sm">Saving…</p>}{error&&<p role="alert" className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-900">{error}</p>}{notice&&<p role="status" className="rounded border border-green-200 bg-green-50 p-3 text-sm text-green-900">{notice}</p>}</>;}
export function PageControls({page,total,onPage}:{page:number;total:number;onPage:(page:number)=>void}){return <div className="flex flex-wrap items-center gap-3 text-sm"><button type="button" disabled={page===0} className={workflowButton} onClick={()=>onPage(page-1)}>Previous</button><span>{total?`${page*25+1}–${Math.min((page+1)*25,total)} of ${total}`:'No records'}</span><button type="button" disabled={(page+1)*25>=total} className={workflowButton} onClick={()=>onPage(page+1)}>Next</button></div>;}
export function useWorkflowRecords<T>(table:string,filters:Record<string,string|boolean>={},order='created_at'){
 const [rows,setRows]=useState<T[]>([]),[total,setTotal]=useState(0),[page,setPage]=useState(0),[loading,setLoading]=useState(true),[error,setError]=useState(''),[revision,setRevision]=useState(0);
 const [query,setQueryValue]=useState(''),[sort,setSortValue]=useState('newest'),[summary,setSummary]=useState<{net:number}>({net:0});
 const filterKey=JSON.stringify(filters);
 useEffect(()=>{let alive=true,generation=0;const load=async()=>{const requested=++generation;setLoading(true);try{const kinds:Record<string,string>={fee_records:'fees',certificate_register:'certificates',audit_log:'audit',walk_in_transactions:'walk_ins'};const result=await adminRpc<{rows:T[];total:number;summary?:{net:number}}>('office_record_list',{p_kind:kinds[table],p_page:page,p_query:query.trim(),p_sort:sort,p_entity:filters.entity||null,p_status:filters.status||null});if(alive&&requested===generation){setRows(result.rows);setTotal(result.total);setSummary(result.summary??{net:0});setError('');}}catch(cause){if(alive&&requested===generation){setRows([]);setError(cause instanceof Error?cause.message:'Could not load records.');}}finally{if(alive&&requested===generation)setLoading(false);}};void load();const unsubscribe=subscribeAdminTables(table==='fee_records'||table==='certificate_register'?[table,'walk_in_transactions']:[table],()=>void load());return()=>{alive=false;unsubscribe();};},[table,filterKey,order,page,revision,query,sort]);
 return {rows,setRows,total,page,setPage,loading,error,summary,query,sort,setQuery:(value:string)=>{setPage(0);setQueryValue(value);},setSort:(value:string)=>{setPage(0);setSortValue(value);},reload:()=>setRevision(value=>value+1)};
}
