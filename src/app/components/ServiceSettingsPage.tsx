import { useEffect, useState } from "react";
import { toast } from "sonner";
import { getCertificateTemplates } from "../certificateTemplates";
import {
  getServiceConfiguration, saveDocumentService, saveOfficeSettings, saveAppointmentSlot,
  saveOfficeClosure, removeOfficeClosure,
} from "../serviceData";
import type { ServiceConfiguration, DocumentService } from "../serviceData";

const inputClass = "min-h-11 w-full rounded-md border border-[#c9d1ca] bg-white px-3 py-2 text-base text-[#24362a]";
const buttonClass = "min-h-11 rounded-md bg-[#123323] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50";
const cardClass = "space-y-4 rounded-lg border border-[#d9e2da] bg-white p-4 sm:p-6";

export default function ServiceSettingsPage() {
  const [config, setConfig] = useState<ServiceConfiguration | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [service, setService] = useState<DocumentService | null>(null);
  const [closure, setClosure] = useState({ closed_date: "", reason: "" });
  const load = async () => {
    try { const data = await getServiceConfiguration(); setConfig(data); setService(data.services[0] ?? null); setError(""); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Could not load settings."); }
  };
  useEffect(() => { void load(); }, []);
  const save = async (action: () => Promise<void>) => {
    if (busy) return;
    setBusy(true);
    try { await action(); toast.success("Settings saved."); }
    catch (cause) { toast.error(cause instanceof Error ? cause.message : "Could not save settings."); }
    finally { setBusy(false); }
  };
  return (
    <div className="space-y-5 bg-[#f4f7f4] p-4 md:p-7">
      <header className={cardClass}>
        <h1 className="text-2xl font-bold text-[#122d1f]">Services & booking settings</h1>
        <p className="text-sm leading-relaxed text-[#53645b]">Maintain the information residents see in booking and Banoy. Changes apply to new requests.</p>
      </header>
      {error && <div role="alert" className={cardClass}><p className="text-red-800">{error}</p><button type="button" onClick={() => void load()} className={buttonClass}>Retry loading</button></div>}
      {!config && !error && <p role="status">Loading settings…</p>}
      {config && <>
        <form className={cardClass} onSubmit={event => { event.preventDefault(); void save(() => saveOfficeSettings(config.office)); }}>
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
          <button disabled={busy} className={buttonClass}>Save office information</button>
        </form>
        <section className={cardClass}>
          <h2 className="text-lg font-bold text-[#122d1f]">Document requirements and fees</h2>
          <label className="grid gap-1.5 text-sm font-semibold">Document service
            <select className={inputClass} value={service?.request_type ?? ""} disabled={busy} onChange={event => setService(config.services.find(item => item.request_type === event.target.value) ?? null)}>
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
              <label className="grid gap-1.5 text-sm font-semibold">Verified fee or payment instructions
                <input value={service.fee_description} maxLength={1000} disabled={busy} className={inputClass} onChange={event => setService({ ...service, fee_description: event.target.value })} placeholder="Leave blank until confirmed." />
              </label>
              <label className="grid gap-1.5 text-sm font-semibold">Expected processing time
                <input value={service.processing_time} maxLength={500} disabled={busy} className={inputClass} onChange={event => setService({ ...service, processing_time: event.target.value })} />
              </label>
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
          <h2 className="text-lg font-bold text-[#122d1f]">Appointment slot limits</h2>
          <p className="text-sm text-[#53645b]">Each slot starts with a limit of 10 requests. Set the limit to the number your office can handle. Pending and approved requests reserve a place.</p>
          <div className="space-y-3">
            {config.slots.map((slot, index) => <form key={slot.label} className="grid items-end gap-3 rounded-md border border-[#d9e2da] p-3 sm:grid-cols-[1fr_100px_auto]" onSubmit={event => { event.preventDefault(); void save(() => saveAppointmentSlot(slot)); }}>
              <label className="flex min-h-11 items-center gap-2 text-sm font-semibold"><input type="checkbox" checked={slot.active} disabled={busy} onChange={event => setConfig({ ...config, slots: config.slots.map((item, i) => i === index ? { ...item, active: event.target.checked } : item) })} />{slot.label}</label>
              <label className="grid gap-1 text-sm">Capacity<input type="number" min={1} max={200} required value={slot.capacity} disabled={busy} className={inputClass} onChange={event => setConfig({ ...config, slots: config.slots.map((item, i) => i === index ? { ...item, capacity: Number(event.target.value) } : item) })} /></label>
              <button disabled={busy} className={buttonClass}>Save slot</button>
            </form>)}
          </div>
        </section>
        <section className={cardClass}>
          <h2 className="text-lg font-bold text-[#122d1f]">Holidays and office closures</h2>
          <p className="text-sm text-[#53645b]">Weekends are already closed. Add other dates when appointments cannot be accepted.</p>
          <form className="grid gap-3 sm:grid-cols-[180px_1fr_auto]" onSubmit={event => { event.preventDefault(); void save(async () => {
            await saveOfficeClosure({ ...closure, reason: closure.reason.trim() });
            setConfig(previous => previous && ({ ...previous, closures: [...previous.closures.filter(item => item.closed_date !== closure.closed_date), closure].sort((a, b) => a.closed_date.localeCompare(b.closed_date)) }));
            setClosure({ closed_date: "", reason: "" });
          }); }}>
            <label className="grid gap-1 text-sm">Date<input type="date" required disabled={busy} value={closure.closed_date} className={inputClass} onChange={event => setClosure({ ...closure, closed_date: event.target.value })} /></label>
            <label className="grid gap-1 text-sm">Reason<input required maxLength={300} disabled={busy} value={closure.reason} className={inputClass} onChange={event => setClosure({ ...closure, reason: event.target.value })} placeholder="Holiday or office closure" /></label>
            <button disabled={busy || !closure.reason.trim()} className={`${buttonClass} self-end`}>Add closure</button>
          </form>
          {config.closures.map(item => <div key={item.closed_date} className="flex flex-wrap items-center justify-between gap-3 border-t border-[#d9e2da] pt-3">
            <p className="min-w-0 break-words text-sm"><strong>{item.closed_date}</strong> · {item.reason}</p>
            <button type="button" disabled={busy} className="min-h-11 rounded border border-red-200 px-3 text-sm font-semibold text-red-800" onClick={() => void save(async () => { await removeOfficeClosure(item.closed_date); setConfig(previous => previous && ({ ...previous, closures: previous.closures.filter(closure => closure.closed_date !== item.closed_date) })); })}>Remove closure</button>
          </div>)}
        </section>
      </>}
    </div>
  );
}
