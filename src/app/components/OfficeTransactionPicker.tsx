import {useEffect,useState} from 'react';
import {adminRpc,subscribeAdminTables} from '../adminData';
import type {OfficeTransaction,WorkflowMode} from '../workflowNavigation';
import {formatServiceFee} from '../serviceFee';
import ListTools from './ListTools';
import ListPager from './ListPager';
import LoadFeedback from './LoadFeedback';

export default function OfficeTransactionPicker({kind,onSelect,busy=false,revision=0}:{kind:'fees'|'certificates';onSelect:(row:OfficeTransaction,mode:WorkflowMode)=>void;busy?:boolean;revision?:number}){
 const [query,setQuery]=useState(''),[sort,setSort]=useState('oldest'),[filter,setFilter]=useState('needs_recording'),[page,setPage]=useState(0);
 const [data,setData]=useState<{rows:OfficeTransaction[];total:number}>({rows:[],total:0}),[loading,setLoading]=useState(true),[error,setError]=useState(''),[retry,setRetry]=useState(0);
 useEffect(()=>{let active=true,generation=0;const load=async()=>{const requested=++generation;setLoading(true);try{
  const result=await adminRpc<typeof data>('office_transaction_list',{p_kind:kind,p_page:page,p_query:query.trim(),p_sort:sort,p_filter:filter});
  if(active&&requested===generation){setData(result);setError('');}
 }catch(cause){if(active&&requested===generation){setData({rows:[],total:0});setError(cause instanceof Error?cause.message:'Could not load eligible transactions.');}}
 finally{if(active&&requested===generation)setLoading(false);}};void load();const unsubscribe=subscribeAdminTables(['appointment_requests','walk_in_transactions','fee_records','certificate_register','service_catalog'],()=>void load());return()=>{active=false;unsubscribe();};},[kind,page,query,sort,filter,revision,retry]);
 const fees=kind==='fees';
 return <section className="space-y-4 rounded-lg border border-[#c9d1ca] bg-white p-4 text-[#122d1f] sm:p-6" aria-label={fees?'Transactions awaiting fee records':'Transactions ready for issuance'}>
  <h2 className="text-lg font-bold">{fees?'Choose a request or walk-in for fee recording':'Choose a request or walk-in for issuance'}</h2>
  <p className="text-sm text-[#53645b]">{fees?'Approved requests appear here automatically. Select a resident to fill the payment form. Approval does not record a payment.':'Select an approved request or eligible walk-in to fill the issuance form.'}</p>
  <ListTools label={fees?'transactions for fee recording':'transactions for issuance'} query={query} onQuery={value=>{setQuery(value);setPage(0);}} sort={sort} onSort={value=>{setSort(value);setPage(0);}} options={[["oldest","Oldest first"],["newest","Newest first"],["name_asc","Resident A–Z"],["name_desc","Resident Z–A"]]}/>
  <label className="grid gap-1 text-sm font-semibold">Show transactions<select value={filter} onChange={event=>{setFilter(event.target.value);setPage(0);}} className="min-h-11 w-full rounded border bg-white px-3 text-base"><option value="needs_recording">{fees?'Awaiting first fee record':'Awaiting issuance'}</option><option value="all">All eligible transactions, including recorded ones</option></select></label>
  <LoadFeedback loading={loading} error={error} onRetry={()=>setRetry(value=>value+1)} label="eligible transactions"/>
  {!loading&&!error&&!data.rows.length&&<p className="text-sm text-[#53645b]">{query?'No transactions match this search.':fees?'No approved requests or walk-ins are awaiting a first fee record.':'No eligible transactions are awaiting issuance.'}</p>}
  <div className="space-y-3">{data.rows.map(row=>{const recorded=fees?row.fee_recorded:row.issued;return <article key={row.reference} className="space-y-2 rounded border p-4 text-sm"><h3 className="break-words font-bold">{row.resident}</h3><p className="break-words">{row.service}</p><p className="break-words text-[#53645b]">{row.reference} · {row.status.replaceAll('_',' ')} · {row.transaction_date}</p>{fees&&<p className="font-semibold">Service fee: {formatServiceFee(row)}</p>}<p>{recorded?fees?'Fee record already exists.':'Current issuance already recorded.':fees?'Awaiting fee recording':'Awaiting issuance'}</p><button type="button" disabled={busy} className="min-h-11 rounded border border-[#aebeb2] px-4 font-semibold disabled:opacity-50" aria-label={`${recorded?'View history':'Select'} for ${row.reference}`} onClick={()=>onSelect(row,recorded?'history':'record')}>{recorded?fees?'View fee history':'View issuance history':fees?Number(row.fee_amount)===0&&row.fee_amount!==null?'Select for exemption':'Select for payment':'Select for issuance'}</button></article>;})}</div>
  <ListPager page={page} total={data.total} onPage={setPage} busy={loading}/>
 </section>;
}
