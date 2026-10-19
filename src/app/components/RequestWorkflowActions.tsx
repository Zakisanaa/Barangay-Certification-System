import {useEffect,useState} from 'react';
import {adminRpc,subscribeAdminTables} from '../adminData';
import {canManage} from '../access';
import type {ResidentAccount} from '../residentAuth';
import type {OfficeTransaction,WorkflowNavigate} from '../workflowNavigation';

export default function RequestWorkflowActions({reference,ownerId,account,onNavigate,disabled=false}:{reference:string;ownerId:string;account:ResidentAccount;onNavigate:WorkflowNavigate;disabled?:boolean}){
 const [row,setRow]=useState<OfficeTransaction|null>(null),[error,setError]=useState(''),[revision,setRevision]=useState(0);
 useEffect(()=>{let active=true,generation=0;const load=async()=>{const requested=++generation;try{const result=await adminRpc<OfficeTransaction>('find_office_transaction',{p_reference:reference});if(active&&requested===generation){setRow(result);setError('');}}catch{if(active&&requested===generation)setError('Could not load the recorded steps.');}};void load();const unsubscribe=subscribeAdminTables(['appointment_requests','fee_records','certificate_register'],()=>void load());return()=>{active=false;unsubscribe();};},[reference,revision]);
 const eligible=row&&!row.archived&&['APPROVED','COMPLETED'].includes(row.status);
 const button='min-h-11 rounded border border-[#c9d1ca] px-3 text-sm font-semibold disabled:opacity-50';
 return <section className="space-y-3 rounded border bg-[#f7faf7] p-3" aria-label="Request workflow"><h3 className="font-bold">Next steps and related records</h3>
  {error&&<p role="alert" className="text-sm text-red-900">{error} <button type="button" className="underline" onClick={()=>setRevision(value=>value+1)}>Retry recorded steps</button></p>}
  {row&&<div className="space-y-1 text-sm"><p>Fee record: {row.fee_recorded?'Recorded':row.fee_amount===0?'No service fee; exemption not recorded':'Not recorded'}</p><p>Certificate register: {row.issued?'Current issuance recorded':'No current issuance'}</p>{!eligible&&<p className="text-[#53645b]">Payment and issuance actions are available for approved or completed requests.</p>}</div>}
  <div className="flex flex-wrap gap-2">
   {canManage(account,'payments')&&(eligible||row?.fee_recorded)&&<button type="button" disabled={disabled} className={button} onClick={()=>onNavigate('staff-payments',reference,row?.fee_recorded?'history':'record')}>{row?.fee_recorded?'View fee history':row?.fee_amount===0?'Record exemption':'Record fee'}</button>}
   {canManage(account,'certificates')&&(eligible||row?.issued)&&<button type="button" disabled={disabled} className={button} onClick={()=>onNavigate('staff-register',reference,row?.issued?'history':'record')}>{row?.issued?'View issuance history':'Record issuance'}</button>}
   {canManage(account,'residents')&&<button type="button" disabled={disabled} className={button} onClick={()=>onNavigate('staff-residents',ownerId)}>Review resident verification</button>}
  </div>
 </section>;
}
