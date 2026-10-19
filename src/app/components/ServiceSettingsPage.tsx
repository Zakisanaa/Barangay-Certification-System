import ChoiceOrCustom from './ChoiceOrCustom';
import ServiceFeeFields from './ServiceFeeFields';
import {useUnsavedChanges,confirmDiscardChanges} from '../useUnsavedChanges';
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { getCertificateTemplates } from "../certificateTemplates";
import {adminRpc} from '../adminData';
import ServiceEditorExtensions from './ServiceEditorExtensions';
import {
  getServiceConfiguration, saveDocumentService, saveOfficeSettings,
  saveOfficeClosure, removeOfficeClosure,
} from "../serviceData";
import type { ServiceConfiguration, DocumentService } from "../serviceData";

const inputClass = "min-h-11 w-full rounded-md border border-[#c9d1ca] bg-white px-3 py-2 text-base text-[#24362a]";
const buttonClass = "min-h-11 rounded-md bg-[#123323] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50";
const cardClass = "space-y-4 rounded-lg border border-[#d9e2da] bg-white p-4 sm:p-6";

export default function ServiceSettingsPage({onOpenRequest}:{onOpenRequest?:(reference:string)=>void}) {
  const [closureImpact,setClosureImpact]=useState<{rows:{reference:string;full_name:string}[];total:number}|null>(null),[closureReviewed,setClosureReviewed]=useState(false);const lock=useRef(false);
  const [config, setConfig] = useState<ServiceConfiguration | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [section, setSection] = useState('document-services');
  const [creating, setCreating] = useState(false);
  const [savedService,setSavedService] = useState('');
  const [service, setService] = useState<DocumentService | null>(null);
  const [closure, setClosure] = useState({ closed_date: "", reason: "" });
  const officeBaseline=useRef('');
  const current=useRef({config,service});current.current={config,service};
  useUnsavedChanges(!!config&&(JSON.stringify(config.office)!==officeBaseline.current||!!service&&JSON.stringify(service)!==JSON.stringify(config.services.find(item=>item.request_type===service.request_type)))||!!closure.reason||!!closure.closed_date);
  const load = async (createdService?:string) => {
    try { const data = await getServiceConfiguration(); const existing=current.current;const officeDirty=!!existing.config&&JSON.stringify(existing.config.office)!==officeBaseline.current;const serviceDirty=!!existing.service&&JSON.stringify(existing.service)!==JSON.stringify(existing.config?.services.find(item=>item.request_type===existing.service?.request_type));officeBaseline.current=JSON.stringify(data.office);setConfig({...data,office:officeDirty?existing.config!.office:data.office});setService(previous=>createdService?data.services.find(item=>item.request_type===createdService)??null:serviceDirty?previous:data.services.find(item=>item.request_type===previous?.request_type)??data.services[0]??null);if(createdService)setCreating(false);setError(""); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Could not load settings."); }
  };
  useEffect(() => { void load(); }, []);
  const save = async (action: () => Promise<void>) => {
    if (lock.current) return;
    lock.current=true;setBusy(true);
    try { await action();setError(""); toast.success("Settings saved."); }
    catch (cause) { const message=cause instanceof Error?cause.message:"Could not save settings.";setError(message);toast.error(message); }
    finally { lock.current=false;setBusy(false); }
  };
  return (
    <div className="space-y-5 bg-[#f4f7f4] p-4 md:p-7">
      <header className={cardClass}>
        <h1 className="text-2xl font-bold text-[#122d1f]">Services & booking settings</h1>
        <p className="text-sm leading-relaxed text-[#53645b]">Manage each document in one place, or update the office schedule and contact details.</p>
        <label className="grid gap-2 text-sm font-semibold">What would you like to manage?<select aria-label="What would you like to manage?" value={section} className={inputClass} onChange={event=>setSection(event.target.value)}><option value="document-services">Document services - fees, requirements and templates</option><option value="booking-schedule">Booking schedule - days, times and holidays</option><option value="office-information">Office details and payment recording</option></select></label>
        <p className="text-sm text-[#53645b]">Related settings are together. Your unsaved entries stay here when you switch groups. Use the Save button beside each part to apply it.</p>
      </header>
      {error && <div role="alert" className={cardClass}><p className="text-red-800">{error}</p><button type="button" onClick={() => {if(confirmDiscardChanges())void load();}} className={buttonClass}>Retry loading</button></div>}
      {!config && !error && <p role="status">Loading settings…</p>}
      {config && <>
        <div hidden={section!=='office-information'}><form id="office-information" className={cardClass} onSubmit={event => { event.preventDefault(); void save(async()=>{await saveOfficeSettings(config.office);officeBaseline.current=JSON.stringify(config.office);}); }}>
          <h2 className="text-lg font-bold text-[#122d1f]">Office information</h2><p className="text-sm text-[#53645b]">Update the contact details residents see, how far ahead they can book, and whether staff can record office payments.</p>
          <div className="grid gap-4 sm:grid-cols-2">
            {([
              ["contact_number", "Contact number"], ["contact_email", "Contact email"],
              ["office_hours", "Verified office hours"], ["address", "Office address"],
            ] as const).map(([key, label]) => <label key={key} className="grid gap-1.5 text-sm font-semibold">{label}
              <input type={key === "contact_email" ? "email" : key === "contact_number" ? "tel" : "text"} value={config.office[key]} maxLength={500} disabled={busy} className={inputClass} onChange={event => setConfig({ ...config, office: { ...config.office, [key]: event.target.value } })} />
            </label>)}
            <label className="grid gap-1.5 text-sm font-semibold">Booking window (days ahead)
              <input type="number" min={1} max={365} required value={config.office.booking_days_ahead} disabled={busy} className={inputClass} onChange={event => setConfig({ ...config, office: { ...config.office, booking_days_ahead: Number(event.target.value) } })} />
            </label>
          </div>
          <label className="flex min-h-11 items-start gap-2 text-sm"><input type="checkbox" checked={config.office.fee_tracking_enabled??false} disabled={busy} onChange={event=>setConfig({...config,office:{...config.office,fee_tracking_enabled:event.target.checked}})}/>Allow staff to record payments and receipts.</label><p className="text-sm text-[#53645b]">Set the amount for each document in Document services. After the office receives a payment, staff enter its receipt in Fee records. Save office information to apply this setting.</p><button disabled={busy} className={buttonClass}>Save office information</button>
        </form></div>
        <div hidden={section!=='document-services'} className={cardClass}>
          <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-lg font-bold">Document services</h2><p className="text-sm text-[#53645b]">Choose a document once. Its details, fee, required uploads and certificate template are together below.</p></div><button type="button" className="min-h-11 rounded border border-[#c9d1ca] px-4 text-sm font-semibold" disabled={busy} onClick={()=>{if(!confirmDiscardChanges())return;setService(config.services.find(item=>item.request_type===service?.request_type)??config.services[0]??null);setCreating(value=>!value);setSavedService('');}}>{creating?'Back to existing documents':'Add a document service'}</button></div>
          <div hidden={creating}><label className="grid gap-1.5 text-sm font-semibold">Document service
            <select aria-label="Document service" className={inputClass} value={service?.request_type ?? ""} disabled={busy} onChange={event => {if(!confirmDiscardChanges())return;setService(config.services.find(item => item.request_type === event.target.value) ?? null);}}>
              {config.services.map(item => <option key={item.request_type}>{item.request_type}</option>)}
            </select>
          </label><p className="mt-2 break-words text-sm font-semibold text-[#123323]">Editing: {service?.request_type??'No document selected'}</p></div>
        </div>
        <div hidden={section!=='document-services'||creating}><section className={cardClass}>
          <h2 id="document-services" className="text-lg font-bold text-[#122d1f]">1. Document details and fee</h2><p className="text-sm text-[#53645b]">Write what residents should prepare, set the amount, and choose how they can receive this document. Saved details appear in booking and Banoy.</p>
          {service && <form className="space-y-4" onSubmit={event => { event.preventDefault(); void save(async () => {
            await saveDocumentService(service);
            setConfig(previous => previous && ({ ...previous, services: previous.services.map(item => item.request_type === service.request_type ? service : item) }));
            setSavedService(service.request_type);
          }); }}>
            <label className="grid gap-1.5 text-sm font-semibold">Requirements shown to residents
              <textarea rows={4} value={service.requirements} maxLength={4000} disabled={busy} className={inputClass} onChange={event => setService({ ...service, requirements: event.target.value })} placeholder="Enter the requirements approved by the barangay." />
            </label>
            <p className="text-sm text-[#53645b]">A valid ID is required for every booking. If residents must attach another file, add it under Required uploads below.</p>
            <div className="grid gap-4 sm:grid-cols-2">
<ServiceFeeFields amount={service.fee_amount} description={service.fee_description} disabled={busy} onChange={(fee_amount,fee_description)=>setService({...service,fee_amount,fee_description})}/>
              <ChoiceOrCustom label="Expected processing time" value={service.processing_time} disabled={busy} onChange={processing_time=>setService({...service,processing_time})} choices={["Same day after verification","1-2 working days","3-5 working days","Confirm with the barangay office"]} maxLength={500}/>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="flex min-h-11 items-start gap-2 rounded border p-3 text-sm"><input type="checkbox" checked={service.active} disabled={busy} onChange={event => setService({ ...service, active: event.target.checked })} /><span><strong>Available for booking</strong><span className="mt-1 block text-[#53645b]">Residents can choose this document. Turn this off to stop new bookings for it.</span></span></label>
              <label className="flex min-h-11 items-start gap-2 rounded border p-3 text-sm"><input type="checkbox" checked={service.softcopy_available} disabled={busy || !getCertificateTemplates(service.request_type).length} onChange={event => setService({ ...service, softcopy_available: event.target.checked })} /><span><strong>Softcopy available</strong><span className="mt-1 block text-[#53645b]">Residents can request an emailed PDF. A certificate template must be ready first.</span></span></label>
            </div>
            {!getCertificateTemplates(service.request_type).length && <p className="text-sm text-[#53645b]">This document currently offers office collection only. Add its Word file in Certificate template below before enabling an emailed PDF.</p>}
            <button disabled={busy} className={buttonClass}>Save document service</button>
            {savedService===service.request_type&&JSON.stringify(service)===JSON.stringify(config.services.find(item=>item.request_type===service.request_type))&&<p role="status" className="rounded border border-green-200 bg-green-50 p-3 text-sm">Saved for {service.request_type}. Add any extra required uploads below. The certificate template is optional for office collection.</p>}
          </form>}
        </section></div>
        <ServiceEditorExtensions section={section} creating={creating} configuration={config} selectedService={creating?'':service?.request_type??''} onChanged={load} onOpenRequest={onOpenRequest} renderClosures={review=>(<>
        <div hidden={section!=='booking-schedule'}><section className={cardClass}>
          <h2 id="office-closures" className="text-lg font-bold text-[#122d1f]">Holidays and office closures</h2>
          <p className="text-sm text-[#53645b]">Add dates when the office will not accept appointments, such as public holidays. Check affected bookings before saving a closure.</p>
          <form className="grid gap-3 sm:grid-cols-[180px_1fr_auto]" onSubmit={event => { event.preventDefault(); void save(async () => {
            const impacted=await adminRpc<{rows:{reference:string;full_name:string}[];total:number}>('affected_appointments',{p_date:closure.closed_date});setClosureImpact(impacted);if(impacted.total&&!closureReviewed)throw new Error('Review the affected bookings and confirm the closure before saving.');
            const saved=await saveOfficeClosure({ ...closure,revision:config.closures.find(item=>item.closed_date===closure.closed_date)?.revision, reason: closure.reason.trim() },closureReviewed);
            setConfig(previous => previous && ({ ...previous, closures: [...previous.closures.filter(item => item.closed_date !== closure.closed_date), saved].sort((a, b) => a.closed_date.localeCompare(b.closed_date)) }));
            setClosure({ closed_date: "", reason: "" });setClosureImpact(null);setClosureReviewed(false);
          }); }}>
            <label className="grid gap-1 text-sm">Date<input type="date" required disabled={busy} value={closure.closed_date} className={inputClass} onChange={event => {setClosure({ ...closure, closed_date: event.target.value });setClosureImpact(null);setClosureReviewed(false);}} /></label>
            <ChoiceOrCustom label="Reason" required maxLength={300} disabled={busy} value={closure.reason} onChange={reason=>setClosure({...closure,reason})} choices={["Public holiday","Barangay event","Office maintenance","Emergency closure","Staff training"]}/>
            <button disabled={busy || !closure.reason.trim()} className={`${buttonClass} self-end`}>Add closure</button>
          </form>
          {!!closureImpact?.total&&<section className="space-y-2 rounded border border-amber-300 bg-amber-50 p-3 text-sm" aria-label="Closure affected bookings"><p>{closureImpact.total} existing bookings need review. Residents will receive an email update when the closure is saved.</p>{closureImpact.rows.map(item=><div key={item.reference} className="flex flex-wrap items-center justify-between gap-2"><span>{item.reference} · {item.full_name}</span>{onOpenRequest&&<button type="button" className="min-h-11 underline" onClick={()=>onOpenRequest(item.reference)}>Open affected request</button>}</div>)}<label className="flex min-h-11 items-center gap-2"><input type="checkbox" checked={closureReviewed} onChange={event=>setClosureReviewed(event.target.checked)}/>I reviewed the affected bookings and will arrange rescheduling or cancellation.</label></section>}
          {config.closures.map(item => <div key={item.closed_date} className="flex flex-wrap items-center justify-between gap-3 border-t border-[#d9e2da] pt-3">
            <p className="min-w-0 break-words text-sm"><strong>{item.closed_date}</strong> · {item.reason}</p>
            <button type="button" disabled={busy} className="min-h-11 rounded border px-3 text-sm font-semibold" onClick={()=>review(item.closed_date)}>Review affected appointments</button><button type="button" disabled={busy} className="min-h-11 rounded border border-red-200 px-3 text-sm font-semibold text-red-800" onClick={() => void save(async () => { await removeOfficeClosure(item.closed_date,item.revision); setConfig(previous => previous && ({ ...previous, closures: previous.closures.filter(closure => closure.closed_date !== item.closed_date) })); })}>Remove closure</button>
          </div>)}
        </section></div>
        </>)}/>
      </>}
    </div>
  );
}
