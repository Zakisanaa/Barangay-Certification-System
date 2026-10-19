import {useEffect,useRef,useState} from 'react';
import {requireSupabase} from '../supabase';
import {adminRpc,subscribeAdminTables,timeInManila} from '../adminData';
import type {FeeRecord} from '../adminData';
import {formatServiceFee} from '../serviceFee';
import ChoiceOrCustom from './ChoiceOrCustom';
import ListTools,{nameSorts} from './ListTools';
import OfficeTransactionPicker from './OfficeTransactionPicker';
import {confirmDiscardChanges,useUnsavedChanges} from '../useUnsavedChanges';
import type {OfficeTransaction,WorkflowMode,WorkflowTarget} from '../workflowNavigation';
import {PageControls,WorkflowFeedback,useWorkflowAction,useWorkflowRecords,workflowButton as button,workflowCard as card,workflowField as field,workflowPrimary as primary} from './AdminWorkflowUi';
type Transaction=OfficeTransaction;
type ServiceFee={fee_amount:number|null;fee_description:string};
const money=(amount:number)=>`PHP ${Number(amount).toLocaleString('en-PH',{minimumFractionDigits:2,maximumFractionDigits:2})}`;
const feeSorts=[...nameSorts.map(([key,label])=>[key,key.startsWith('name_')?label.replace('Name','Reference'):label] as const),['amount_high','Amount: highest first'],['amount_low','Amount: lowest first']] as const;
const statusLabels:Record<FeeRecord['status'],string>={PAID:'Paid',EXEMPT:'Exempt',WAIVED:'Fee waived',REFUNDED:'Refund recorded',VOIDED:'Payment voided'};
export default function FeeRecordsPage({target,canConfigureFees=false}:{target?:WorkflowTarget;canConfigureFees?:boolean}){
 const [filter,setFilter]=useState('');
 const records=useWorkflowRecords<FeeRecord>('fee_records',filter?{status:filter}:{},'recorded_at');
 const action=useWorkflowAction(),attempt=useRef(crypto.randomUUID()),lookupVersion=useRef(0);
 const [enabled,setEnabled]=useState<boolean|null>(null),[settingsError,setSettingsError]=useState(''),[settingsRevision,setSettingsRevision]=useState(0);
 const [reference,setReference]=useState(''),[amount,setAmount]=useState(''),[status,setStatus]=useState<FeeRecord['status']>('PAID'),[receipt,setReceipt]=useState(''),[note,setNote]=useState(''),[method,setMethod]=useState('Cash at barangay office');
 const [previous,setPrevious]=useState<FeeRecord|null>(null),[transaction,setTransaction]=useState<Transaction|null>(null),[serviceFee,setServiceFee]=useState<ServiceFee|null>(null),[lookingUp,setLookingUp]=useState(false);
 const [dirty,setDirty]=useState(false),[historyOnly,setHistoryOnly]=useState(false),[pickerRevision,setPickerRevision]=useState(0);
 const formRef=useRef<HTMLFormElement>(null),historyRef=useRef<HTMLElement>(null);useUnsavedChanges(dirty);
 useEffect(()=>{let active=true;const load=async()=>{const result=await requireSupabase().from('office_settings').select('fee_tracking_enabled').eq('id',1).single();if(active){if(result.error){setEnabled(null);setSettingsError('Could not load fee tracking settings. Retry before recording a payment.');}else{setEnabled(Boolean(result.data.fee_tracking_enabled));setSettingsError('');}}};void load();const unsubscribe=subscribeAdminTables(['office_settings'],()=>void load());return()=>{active=false;unsubscribe();};},[settingsRevision]);
 useEffect(()=>()=>{lookupVersion.current++;},[]);
 const clear=()=>{lookupVersion.current++;setLookingUp(false);setReference('');setAmount('');setStatus('PAID');setReceipt('');setNote('');setPrevious(null);setTransaction(null);setServiceFee(null);setMethod('Cash at barangay office');setDirty(false);setHistoryOnly(false);attempt.current=crypto.randomUUID();};
 const chooseTransaction=(row:OfficeTransaction,mode:WorkflowMode,prompt=true)=>{
  if(prompt&&!confirmDiscardChanges())return;
  clear();setReference(row.reference);setTransaction(row);setServiceFee(row);setAmount(row.fee_amount==null?'':String(row.fee_amount));setStatus(row.fee_amount===0?'EXEMPT':'PAID');setFilter('');records.setQuery(row.reference);
  const history=mode==='history'||row.fee_recorded;setHistoryOnly(history);
  requestAnimationFrame(()=>{(history?historyRef.current:formRef.current)?.scrollIntoView({block:'start',behavior:'smooth'});});
 };
 useEffect(()=>{if(!target)return;let active=true;void action.run(async()=>{const source=await adminRpc<Transaction>('find_office_transaction',{p_reference:target.reference});if(active)chooseTransaction(source,target.mode,false);});return()=>{active=false;};},[target?.token]);
 const lookup=()=>void action.run(async()=>{
  const requested=++lookupVersion.current;setLookingUp(true);
  try{const source=await adminRpc<Transaction>('find_office_transaction',{p_reference:reference.trim()});
   if(requested!==lookupVersion.current)return;
   setTransaction(source);setServiceFee(source);setHistoryOnly(false);if(source.fee_amount!=null){setAmount(String(source.fee_amount));setStatus(Number(source.fee_amount)===0?'EXEMPT':'PAID');}
  }finally{if(requested===lookupVersion.current)setLookingUp(false);}
 });
 return <div className="space-y-5 p-4 md:p-7">
  <header className={card}><h1 className="text-2xl font-bold">Fees and receipt records</h1><p className="text-sm text-[#53645b]">Look up a request, confirm its service fee, and record the office payment or exemption. Refunds and voids stay linked to the original receipt.</p>
   {enabled===false&&<p className="rounded border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950">Fee tracking is disabled. In Services & booking, choose Office details and payment recording, turn on Allow staff to record payments and receipts, then save office information. A staff member with settings access can make this change.</p>}
   {enabled===null&&!settingsError&&<p role="status">Loading fee tracking settings…</p>}
   <p className="text-sm text-[#53645b]">Set the amount residents see in Services & booking → Document services. Choose the document and edit its fee amount. This page records payments already handled by the office.</p>
  </header>
  <WorkflowFeedback error={settingsError||action.error} notice={action.notice}/>{settingsError&&<button type="button" className={button} onClick={()=>setSettingsRevision(value=>value+1)}>Retry fee settings</button>}
  {enabled===false&&canConfigureFees&&<button type="button" disabled={action.busy} className={primary} onClick={()=>void action.run(async()=>{const current=await requireSupabase().from('office_settings').select('revision').eq('id',1).single();if(current.error)throw new Error('Could not load office settings. Retry.');await adminRpc<{revision:number}>('set_fee_tracking',{p_enabled:true,p_revision:current.data.revision});setSettingsRevision(value=>value+1);},'Fee recording enabled.')}>Enable fee recording</button>}
  <OfficeTransactionPicker kind="fees" busy={action.busy} revision={pickerRevision} onSelect={chooseTransaction}/>
  {historyOnly&&transaction&&<p className={card}>Showing fee history for <strong>{transaction.resident} · {transaction.reference}</strong>.</p>}
  {enabled&&!historyOnly&&<form ref={formRef} className={card} onChange={()=>setDirty(true)} onSubmit={event=>{event.preventDefault();void action.run(async()=>{
   if(!Number.isFinite(Number(amount))||amount.trim()===''||(status==='PAID'&&Number(amount)<=0))throw new Error('Enter an amount greater than zero for a payment. Choose Exempt or Fee waived for a zero fee.');
   let source:Transaction;
   if(previous)source={kind:previous.walk_in_id?'walk_in':'appointment',id:previous.walk_in_id??previous.request_reference!} as Transaction;
   else source=transaction??await adminRpc<Transaction>('find_office_transaction',{p_reference:reference.trim()});
   await adminRpc('record_office_fee',{p_id:attempt.current,p_reference:source.kind==='appointment'?source.id:null,p_walk_in:source.kind==='walk_in'?source.id:null,p_amount:Number(amount),p_status:status,p_receipt:receipt.trim()||null,p_note:note.trim(),p_previous:previous?.id??null,p_method:method});
   clear();records.reload();setPickerRevision(value=>value+1);
  },'Fee record saved.');}}>
   <h2 className="text-lg font-bold">{previous?'Record a payment correction':'Record payment or exemption'}</h2>
   <label className="grid gap-1 text-sm font-semibold">Appointment or walk-in reference<input required maxLength={100} value={reference} disabled={action.busy||!!previous} onChange={event=>{lookupVersion.current++;setReference(event.target.value);setTransaction(null);setServiceFee(null);setAmount('');setStatus('PAID');attempt.current=crypto.randomUUID();}} placeholder="BRG-… or WALK-…" className={field}/></label>
   {!previous&&<button type="button" className={button} disabled={action.busy||!reference.trim()} onClick={lookup}>{lookingUp?'Looking up request…':'Look up request and fee'}</button>}
   {transaction&&<div className="space-y-1 rounded border border-green-200 bg-green-50 p-3 text-sm"><p className="font-bold">{transaction.resident} · {transaction.reference}</p><p>Service: {transaction.service}</p><p>Approved service fee: {serviceFee?formatServiceFee(serviceFee):'Confirm with the barangay office.'}</p></div>}
   {previous&&<p className="rounded border border-amber-300 bg-amber-50 p-3 text-sm">Original receipt: {previous.receipt_reference||'No receipt'} · {money(previous.amount)}. This records a full refund or void. Arrange any actual refund through the office.</p>}
   <div className="grid gap-4 sm:grid-cols-2">
    <label className="grid gap-1 text-sm font-semibold">Record type<select value={status} disabled={action.busy} className={field} onChange={event=>{const next=event.target.value as typeof status;setStatus(next);if(next==='EXEMPT'||next==='WAIVED')setAmount('0');else if(!previous)setAmount(serviceFee?.fee_amount&&Number(serviceFee.fee_amount)>0?String(serviceFee.fee_amount):'');}}>{previous?<><option value="REFUNDED">Refund recorded — return the original payment</option><option value="VOIDED">Void — cancel an incorrect payment entry</option></>:<><option value="PAID">Paid — payment received</option><option value="EXEMPT">Exempt — no payment required</option><option value="WAIVED">Fee waived — authorized fee removal</option></>}</select></label>
    <label className="grid gap-1 text-sm font-semibold">Amount (PHP)<input required type="number" min={status==='PAID'?'0.01':'0'} max="9999999999.99" step="0.01" value={amount} readOnly={!!previous||status==='EXEMPT'||status==='WAIVED'} disabled={action.busy} onChange={event=>setAmount(event.target.value)} className={field}/></label>
   </div>
   {status==='PAID'&&<ChoiceOrCustom label="Payment method" required value={method} onChange={setMethod} choices={['Cash at barangay office','GCash verified by office','Maya verified by office','Bank transfer verified by office']} disabled={action.busy} maxLength={100}/>}
   <label className="grid gap-1 text-sm font-semibold">{previous?'Correction receipt/reference (optional)':status==='PAID'?'Official receipt reference':'Exemption or waiver reference (optional)'}<input required={status==='PAID'} maxLength={200} value={receipt} disabled={action.busy} onChange={event=>setReceipt(event.target.value)} className={field}/></label>
   <label className="grid gap-1 text-sm font-semibold">Payment details or reason<textarea required rows={3} maxLength={1000} value={note} disabled={action.busy} onChange={event=>setNote(event.target.value)} placeholder={status==='PAID'?'Describe the payment received.':'Explain the exemption, waiver, refund, or correction.'} className={field}/></label>
   <div className="flex flex-wrap gap-2"><button className={primary} disabled={action.busy}>{action.busy?'Saving…':'Save fee record'}</button>{previous&&<button type="button" disabled={action.busy} className={button} onClick={clear}>Cancel correction</button>}</div>
  </form>}
  <section ref={historyRef} className={card}><h2 className="text-lg font-bold">Recorded fees and corrections</h2><button type="button" className={button} disabled={action.busy} onClick={()=>{if(!confirmDiscardChanges())return;clear();records.setQuery('');setFilter('');}}>Show all fee records</button>
   <ListTools label="fee records" query={records.query} onQuery={records.setQuery} sort={records.sort} onSort={records.setSort} options={feeSorts}/>
   <label className="grid gap-1 text-sm font-semibold">Filter fee records<select className={field} value={filter} onChange={event=>{setFilter(event.target.value);records.setPage(0);}}><option value="">All payment and correction types</option>{Object.entries(statusLabels).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label>
   <WorkflowFeedback error={records.error}/>{records.error&&<button type="button" className={button} onClick={records.reload}>Retry fee records</button>}
   {records.loading?<p role="status">Loading fee records…</p>:!records.error&&<p className="rounded bg-[#eef5ef] p-3 text-sm font-semibold">{records.total} matching records · Net recorded amount: {money(records.summary.net)}<span className="mt-1 block text-xs font-normal">Payments minus refunds and voids across all matching records. Filters affect this total.</span></p>}
   {!records.loading&&!records.error&&!records.rows.length&&<p className="text-sm text-[#53645b]">No fee records match this view.</p>}
   <div className="space-y-3">{records.rows.map(item=><article key={item.id} className="space-y-3 rounded border border-[#c9d1ca] p-4 text-sm"><div className="flex flex-wrap justify-between gap-2"><p className="font-bold">{item.display_reference??item.request_reference??'Walk-in transaction'}</p><span className="rounded bg-[#eef5ef] px-2 py-1 font-semibold">{statusLabels[item.status]}</span></div><dl className="grid gap-3 sm:grid-cols-2"><div><dt className="text-[#53645b]">Amount</dt><dd className="text-lg font-bold">{money(item.amount)}</dd></div><div><dt className="text-[#53645b]">Receipt / reference</dt><dd className="break-words font-semibold">{item.receipt_reference??'Not required'}</dd></div><div><dt className="text-[#53645b]">Payment method</dt><dd>{item.payment_method??'Not recorded'}</dd></div><div><dt className="text-[#53645b]">Recorded at (Manila)</dt><dd>{timeInManila(item.recorded_at)}</dd></div></dl><p className="whitespace-pre-wrap break-words">{item.note}</p>{item.previous_record&&<p className="text-[#53645b]">Correction linked to the original payment. The original remains in history.</p>}{item.corrected&&<p className="font-semibold text-amber-900">This payment already has a {item.correction_status==='VOIDED'?'void':'refund'} record.</p>}{enabled&&item.status==='PAID'&&!item.corrected&&<button type="button" disabled={action.busy} className={button} onClick={()=>{if(!confirmDiscardChanges())return;setHistoryOnly(false);setDirty(false);setPrevious(item);setReference(item.display_reference??item.request_reference??`Walk-in ${item.walk_in_id}`);setAmount(String(item.amount));setStatus('REFUNDED');setReceipt('');setNote('');setMethod(item.payment_method??'Not recorded');setTransaction(null);attempt.current=crypto.randomUUID();document.querySelector('main')?.scrollTo({top:0,behavior:'smooth'});}}>Record refund or void</button>}</article>)}</div>
   <PageControls page={records.page} total={records.total} onPage={records.setPage}/>
  </section>
 </div>;
}
