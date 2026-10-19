import {useEffect,useState} from 'react';
import {requireSupabase} from '../supabase';
import {subscribeAdminTables} from '../adminData';
import type {SupportingRequirement,TemplateVersion} from '../adminData';
import type {DocumentService} from '../serviceData';
import {getCertificateTemplateFile} from '../portalData';
import {formatServiceFee} from '../serviceFee';
import {workflowButton as button,workflowField as field} from './AdminWorkflowUi';

export default function OfficeDocumentPreparation({service,canDownload,onOpenSettings}:{service:string;canDownload:boolean;onOpenSettings?:()=>void}){
 const [details,setDetails]=useState<DocumentService|null>(null),[requirements,setRequirements]=useState<SupportingRequirement[]>([]),[templates,setTemplates]=useState<TemplateVersion[]>([]);
 const [selected,setSelected]=useState(''),[loading,setLoading]=useState(true),[error,setError]=useState(''),[retry,setRetry]=useState(0);
 const [downloading,setDownloading]=useState(false),[downloadError,setDownloadError]=useState('');
 useEffect(()=>{
  let active=true,generation=0;
  const load=async()=>{
   const requested=++generation;setLoading(true);
   try{
    const client=requireSupabase();
    const results=await Promise.all([
     client.from('service_catalog').select('*').eq('request_type',service).maybeSingle(),
     client.from('service_requirements').select('*').eq('request_type',service).eq('active',true).order('title'),
     client.from('certificate_templates').select('*').eq('request_type',service).eq('active',true).order('label'),
    ]);
    for(const result of results)if(result.error)throw new Error(result.error.message);
    if(!active||requested!==generation)return;
    const current=results[2].data as TemplateVersion[];
    setDetails(results[0].data);setRequirements(results[1].data??[]);setTemplates(current);
    setSelected(previous=>current.some(item=>item.id===previous)?previous:current.length===1?current[0].id:'');setError('');setDownloadError('');
   }catch(cause){if(active&&requested===generation){setDetails(null);setRequirements([]);setTemplates([]);setSelected('');setError(cause instanceof Error?cause.message:'Could not load the document requirements and templates.');}}
   finally{if(active&&requested===generation)setLoading(false);}
  };
  void load();const unsubscribe=subscribeAdminTables(['service_catalog','service_requirements','certificate_templates'],()=>void load());
  return()=>{active=false;unsubscribe();};
 },[service,retry]);
 const download=async()=>{
  const template=templates.find(item=>item.id===selected);
  if(!template||!canDownload||downloading||loading)return;
  setDownloading(true);setDownloadError('');
  try{
   const bytes=await getCertificateTemplateFile(template.storage_path);
   const url=URL.createObjectURL(new Blob([bytes],{type:'application/vnd.openxmlformats-officedocument.wordprocessingml.document'}));
   const anchor=document.createElement('a');anchor.href=url;anchor.download=template.label.replace(/[<>:"/\\|?*\x00-\x1f]/g,'-')+'.docx';anchor.click();
   window.setTimeout(()=>URL.revokeObjectURL(url),1000);
  }catch(cause){setDownloadError(cause instanceof Error?cause.message:'Could not download the Word template. Try again.');}
  finally{setDownloading(false);}
 };
 return <section className="min-w-0 space-y-4" aria-label="Document preparation">
  <h3 className="text-lg font-bold">Prepare {service}</h3>
  {loading&&<p role="status" className="text-sm">Loading document requirements and Word templates…</p>}
  {error&&<div role="alert" className="space-y-2 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-900"><p>{error}</p><button type="button" className={button} onClick={()=>setRetry(value=>value+1)}>Retry document details</button></div>}
  {!loading&&!error&&<>
   <div className="space-y-3 rounded border bg-[#f7faf7] p-4 text-sm">
    <h4 className="font-bold">1. Check requirements and fee</h4>
    <p>Check the resident’s valid ID and the listed requirements at the office.</p>
    {details?.requirements&&<p className="break-words whitespace-pre-wrap">{details.requirements}</p>}
    {requirements.map(item=><div key={item.id} className="space-y-1 border-t pt-2"><p className="font-semibold">{item.title} · {item.required?'Required':'Optional'}</p>{item.instructions&&<p className="break-words whitespace-pre-wrap">{item.instructions}</p>}</div>)}
    <p className="break-words"><strong>Service fee: </strong>{formatServiceFee(details??{fee_amount:null,fee_description:''})}</p>
    {details?.processing_time&&<p className="break-words"><strong>Processing time: </strong>{details.processing_time}</p>}
   </div>
   <div className="space-y-3 rounded border p-4 text-sm">
    <h4 className="font-bold">2. Prepare the Word document</h4>
    {templates.length?<>
     <label className="grid gap-1 font-semibold">Word template for {service}<select aria-label="Office document template" className={field} value={selected} disabled={!canDownload||downloading} onChange={event=>{setSelected(event.target.value);setDownloadError('');}}><option value="" disabled>Choose the required certificate</option>{templates.map(item=><option key={item.id} value={item.id}>{item.label} · Version {item.version}</option>)}</select></label>
     <p>Download the matching DOCX, fill in the resident’s details and purpose in Word, then print it for signing and release.</p>
     {canDownload?<button type="button" className={button} disabled={!selected||downloading} onClick={()=>void download()}>{downloading?'Downloading…':'Download Word template (DOCX)'}</button>:<p className="rounded border border-amber-200 bg-amber-50 p-3 text-amber-950">Ask a staff member with certificate access to download and prepare this document.</p>}
     {downloadError&&<p role="alert" className="text-red-900">{downloadError}</p>}
    </>:<div className="space-y-2"><p>No Word template is saved for {service}. Use the office’s approved paper form, or add its Word template in Services &amp; booking.</p>{onOpenSettings&&<button type="button" className={button} onClick={onOpenSettings}>Open service template settings</button>}</div>}
   </div>
  </>}
 </section>;
}
