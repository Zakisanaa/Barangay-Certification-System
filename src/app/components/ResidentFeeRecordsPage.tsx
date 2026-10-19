import {useEffect,useState} from 'react';
import {adminRpc,subscribeAdminTables,timeInManila} from '../adminData';
import type {FeeRecord} from '../adminData';
import ListTools from './ListTools';
import ListPager from './ListPager';
import LoadFeedback from './LoadFeedback';

type ResidentFee=FeeRecord&{request_type:string;request_status:string;archived:boolean};
type FeePage={rows:ResidentFee[];total:number;net:number};
const labels:Record<FeeRecord['status'],string>={PAID:'Payment received',EXEMPT:'Exempt — no payment required',WAIVED:'Fee waived',REFUNDED:'Refund recorded',VOIDED:'Payment voided'};
const money=(amount:number)=>`PHP ${Number(amount).toLocaleString('en-PH',{minimumFractionDigits:2,maximumFractionDigits:2})}`;
const sorts=[['newest','Newest first'],['oldest','Oldest first'],['name_asc','Reference A–Z'],['name_desc','Reference Z–A'],['amount_high','Amount: highest first'],['amount_low','Amount: lowest first']] as const;

export default function ResidentFeeRecordsPage({ownerId,focusReference,focusToken}:{ownerId:string;focusReference?:string;focusToken?:string}){
 const [data,setData]=useState<FeePage>({rows:[],total:0,net:0});
 const [page,setPage]=useState(0),[query,setQuery]=useState(''),[sort,setSort]=useState('newest'),[loading,setLoading]=useState(true),[error,setError]=useState(''),[revision,setRevision]=useState(0);
 useEffect(()=>{if(focusReference){setQuery(focusReference);setPage(0);}},[focusReference,focusToken]);
 useEffect(()=>{
  let active=true,generation=0;
  const load=async()=>{const requested=++generation;setLoading(true);try{
   const result=await adminRpc<FeePage>('resident_fee_records',{p_page:page,p_query:query.trim(),p_sort:sort});
   if(active&&requested===generation){setData(result);setError('');}
  }catch(cause){if(active&&requested===generation){setData({rows:[],total:0,net:0});setError(cause instanceof Error?cause.message:'Could not load your fee records.');}}
  finally{if(active&&requested===generation)setLoading(false);}};
  void load();const unsubscribe=subscribeAdminTables(['fee_records','appointment_requests'],()=>void load());
  return()=>{active=false;unsubscribe();};
 },[ownerId,page,query,sort,revision]);
 return <div className="min-h-full space-y-5 bg-[#f4f7f4] p-4 text-[#122d1f] md:p-7">
  <header className="space-y-2 rounded-lg border bg-white p-5"><h1 className="text-2xl font-bold">My fees & receipts</h1><p className="text-sm text-[#53645b]">Payments, receipts, exemptions, and corrections recorded by the barangay office for your appointments appear here, including archived requests.</p><p className="text-sm text-[#53645b]">This page updates when the office saves a fee record. Contact the office if a receipt or amount needs correction.</p><button type="button" className="min-h-11 rounded border px-4 text-sm font-semibold" onClick={()=>setRevision(value=>value+1)}>Refresh my fee records</button></header>
  <ListTools label="your fee records" query={query} onQuery={value=>{setPage(0);setQuery(value);}} sort={sort} onSort={value=>{setPage(0);setSort(value);}} options={sorts}/>
  <LoadFeedback loading={loading} error={error} onRetry={()=>setRevision(value=>value+1)} label="your fee records"/>
  {!error&&<p className="rounded border bg-white p-4 text-sm font-semibold">{data.total} matching records · Net payment recorded: {money(data.net)}<span className="mt-1 block font-normal text-[#53645b]">Payments minus refunds and voids for this search. This is not a remaining balance.</span></p>}
  {!loading&&!error&&!data.rows.length&&<p className="rounded border bg-white p-5 text-sm text-[#53645b]">{query?'No fee records match your search.':'No payments or exemptions have been recorded for your appointments yet. Office entries will appear here once saved.'}</p>}
  <div className="space-y-4">{data.rows.map(item=><article key={item.id} className="space-y-3 rounded-lg border bg-white p-5" aria-label={`Fee record for ${item.request_reference}`}>
   <div className="flex flex-wrap items-start justify-between gap-2"><div><h2 className="break-words text-lg font-bold">{item.request_type}</h2><p className="break-words text-sm text-[#53645b]">{item.request_reference}{item.archived?' · Archived request':''}</p></div><span className="rounded bg-[#eef5ef] px-3 py-1 text-sm font-semibold">{item.corrected?item.correction_status==='VOIDED'?'Original payment — voided':'Original payment — refunded':labels[item.status]}</span></div>
   <dl className="grid gap-4 sm:grid-cols-2"><div><dt className="text-sm text-[#53645b]">Amount</dt><dd className="text-xl font-bold">{money(item.amount)}</dd></div><div><dt className="text-sm text-[#53645b]">Receipt / reference</dt><dd className="break-words font-semibold">{item.receipt_reference||'Not required'}</dd></div><div><dt className="text-sm text-[#53645b]">Payment method</dt><dd>{item.status==='EXEMPT'||item.status==='WAIVED'?'No payment required':item.payment_method||'Recorded by the office'}</dd></div><div><dt className="text-sm text-[#53645b]">Recorded at (Manila)</dt><dd>{timeInManila(item.recorded_at)}</dd></div></dl>
   {item.note&&<p className="whitespace-pre-wrap break-words text-sm">{item.note}</p>}{item.previous_record&&<p className="text-sm text-[#53645b]">This correction is linked to the original payment, which remains in your history.</p>}
  </article>)}</div>
  <ListPager page={page} total={data.total} onPage={setPage} busy={loading}/>
 </div>;
}
