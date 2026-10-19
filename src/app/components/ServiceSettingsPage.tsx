import ChoiceOrCustom from './ChoiceOrCustom';
import ServiceFeeFields from './ServiceFeeFields';
import {useUnsavedChanges,confirmDiscardChanges} from '../useUnsavedChanges';
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { getCertificateTemplates } from "../certificateTemplates";
import {adminRpc} from '../adminData';
import ServiceEditorExtensions from './ServiceEditorExtensions';
import {
  getServiceConfiguration, saveDocumentService, saveOfficeSettings, saveAppointmentSlot,
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
  const [service, setService] = useState<DocumentService | null>(null);
  const [closure, setClosure] = useState({ closed_date: "", reason: "" });
  const officeBaseline=useRef('');
  const current=useRef({config,service});current.current={config,service};
  useUnsavedChanges(!!config&&(JSON.stringify(config.office)!==officeBaseline.current||!!service&&JSON.stringify(service)!==JSON.stringify(config.services.find(item=>item.request_type===service.request_type)))||!!closure.reason||!!closure.closed_date);
  const load = async () => {
    try { const data = await getServiceConfiguration(); const existing=current.current;const officeDirty=!!existing.config&&JSON.stringify(existing.config.office)!==officeBaseline.current;const serviceDirty=!!existing.service&&JSON.stringify(existing.service)!==JSON.stringify(existing.config?.services.find(item=>item.request_type===existing.service?.request_type));officeBaseline.current=JSON.stringify(data.office);setConfig({...data,office:officeDirty?existing.config!.office:data.office});setService(previous=>serviceDirty?previous:data.services.find(item=>item.request_type===previous?.request_type)??data.services[0]??null); setError(""); }
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
        <p className="text-sm leading-relaxed text-[#53645b]">Set up document services, fees, required uploads, and office availability. Residents see the saved service information in booking and Banoy.</p>
        <label className="grid gap-2 text-sm font-semibold">What would you like to manage?<select defaultValue="" className={inputClass} onChange={event=>{document.getElementById(event.target.value)?.scrollIntoView({behavior:'smooth',block:'start'});}}><option value="">Choose a feature...</option><option value="office-information">Office contact details and fee tracking</option><option value="document-services">Edit a service, its requirements, or fee</option><option value="create-service">Add a document service</option><option value="supporting-checklist">Add a required upload</option><option value="certificate-templates">Upload a certificate template</option><option value="appointment-slots">Add or change appointment times</option><option value="operating-weekdays">Choose open weekdays</option><option value="office-closures">Add a holiday or closure</option></select></label>
        <p className="text-sm text-[#53645b]">Choose a section to jump to it. To add an item, use a suggested option or type your own. Each section has its own Save button.</p>
      </header>
      {error && <div role="alert" className={cardClass}><p className="text-red-800">{error}</p><button type="button" onClick={() => {if(confirmDiscardChanges())void load();}} className={buttonClass}>Retry loading</button></div>}
      {!config && !error && <p role="status">Loading settings…</p>}
      {config && <>
        <form id="office-information" className={cardClass} onSubmit={event => { event.preventDefault(); void save(async()=>{await saveOfficeSettings(config.office);officeBaseline.current=JSON.stringify(config.office);}); }}>
          <h2 className="text-lg font-bold text-[#122d1f]">Office information</h2>
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
          <label className="flex min-h-11 items-start gap-2 text-sm"><input type="checkbox" checked={config.office.fee_tracking_enabled??false} disabled={busy} onChange={event=>setConfig({...config,office:{...config.office,fee_tracking_enabled:event.target.checked}})}/>Enable fee and receipt recording for office payments.</label><p className="text-sm text-[#53645b]">Set each service amount below. This switch enables payment records; it does not collect money. Save office information to apply.</p><button disabled={busy} className={buttonClass}>Save office information</button>
        </form>
        <section className={cardClass}>
          <h2 id="document-services" className="text-lg font-bold text-[#122d1f]">Document requirements and fees</h2><p className="text-sm text-[#53645b]">Choose an existing service to edit it. To add another document, choose Add a document service in the feature menu above.</p>
          <label className="grid gap-1.5 text-sm font-semibold">Document service
            <select aria-label="Document service" className={inputClass} value={service?.request_type ?? ""} disabled={busy} onChange={event => {if(!confirmDiscardChanges())return;setService(config.services.find(item => item.request_type === event.target.value) ?? null);}}>
              {config.services.map(item => <option key={item.request_type}>{item.request_type}</option>)}
            </select>
          </label>
          {service && <form className="space-y-4" onSubmit={event => { event.preventDefault(); void save(async () => {
            await saveDocumentService(service);
            setConfig(previous => previous && ({ ...previous, services: previous.services.map(item => item.request_type === service.request_type ? service : item) }));
          }); }}>
            <label className="grid gap-1.5 text-sm font-semibold">Verified requirements
              <textarea rows={4} value={service.requirements} maxLength={4000} disabled={busy} className={inputClass} onChange={event => setService({ ...service, requirements: event.target.value })} placeholder="Enter the requirements approved by the barangay." />
            </label>
            <div className="grid gap-4 sm:grid-cols-2">
<ServiceFeeFields amount={service.fee_amount} description={service.fee_description} disabled={busy} onChange={(fee_amount,fee_description)=>setService({...service,fee_amount,fee_description})}/>
              <ChoiceOrCustom label="Expected processing time" value={service.processing_time} disabled={busy} onChange={processing_time=>setService({...service,processing_time})} choices={["Same day after verification","1-2 working days","3-5 working days","Confirm with the barangay office"]} maxLength={500}/>
            </div>
            <div className="flex flex-wrap gap-4">
              <label className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" checked={service.active} disabled={busy} onChange={event => setService({ ...service, active: event.target.checked })} />Available for booking</label>
              <label className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" checked={service.softcopy_available} disabled={busy || !getCertificateTemplates(service.request_type).length} onChange={event => setService({ ...service, softcopy_available: event.target.checked })} />Softcopy available</label>
            </div>
            {!getCertificateTemplates(service.request_type).length && <p className="text-sm text-[#53645b]">This service has no matching certificate template. Booking offers hardcopy only.</p>}
            <button disabled={busy} className={buttonClass}>Save document service</button>
          </form>}
        </section>
        <section className={cardClass}>
          <h2 id="office-closures" className="text-lg font-bold text-[#122d1f]">Holidays and office closures</h2>
          <p className="text-sm text-[#53645b]">Operating weekdays are configured below. Add specific dates when appointments cannot be accepted.</p>
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
            <button type="button" disabled={busy} className="min-h-11 rounded border border-red-200 px-3 text-sm font-semibold text-red-800" onClick={() => void save(async () => { await removeOfficeClosure(item.closed_date,item.revision); setConfig(previous => previous && ({ ...previous, closures: previous.closures.filter(closure => closure.closed_date !== item.closed_date) })); })}>Remove closure</button>
          </div>)}
        </section>
        <ServiceEditorExtensions configuration={config} selectedService={service?.request_type??''} onChanged={()=>void load()} onOpenRequest={onOpenRequest}/>
      </>}
    </div>
  );
}
