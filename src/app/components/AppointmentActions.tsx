import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { getAppointmentRequest, manageAppointment } from "../portalData";
import type { AppointmentAction, AppointmentRequest } from "../portalData";
import { getSlotAvailability } from "../serviceData";
import type { SlotAvailability } from "../serviceData";
import { useOfficeSettings } from "../useOfficeSettings";

const inputClass = "min-h-11 w-full rounded border border-[#c9d1ca] bg-white px-3 py-2 text-base";
const buttonClass = "min-h-11 rounded border border-[#c9d1ca] bg-white px-4 text-sm font-semibold disabled:opacity-50";

export default function AppointmentActions({ request, staff, onUpdated }: {
  request: AppointmentRequest; staff: boolean; onUpdated: (request: AppointmentRequest) => void;
}) {
  const [action, setAction] = useState<AppointmentAction | "">("");
  const [reason, setReason] = useState("");
  const [date, setDate] = useState(request.date);
  const [timeSlot, setTimeSlot] = useState("");
  const [recipient, setRecipient] = useState(request.fullName);
  const [slots, setSlots] = useState<SlotAvailability[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [slotError, setSlotError] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const office = useOfficeSettings();
  const active = !request.archived && ["PENDING", "APPROVED"].includes(request.status);
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  const lastDay = new Date(`${today}T00:00:00Z`);
  lastDay.setUTCDate(lastDay.getUTCDate() + (office?.booking_days_ahead ?? 90));

  useEffect(() => {
    if (action !== "reschedule" || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return;
    let alive = true;
    setLoadingSlots(true); setSlotError(""); setSlots([]); setTimeSlot("");
    void getSlotAvailability(date).then(
      values => { if (alive) setSlots(values); },
      cause => { if (alive) setSlotError(cause instanceof Error ? cause.message : "Could not check appointment times."); },
    ).finally(() => { if (alive) setLoadingSlots(false); });
    return () => { alive = false; };
  }, [action, date]);

  const choose = (next: AppointmentAction) => { setAction(next); setReason(""); setError(""); setDate(request.date); setTimeSlot(""); };
  if (!active) return null;
  return <section className="space-y-3 border-t border-[#d9e2da] pt-4" aria-label="Appointment actions">
    <h3 className="text-base font-bold text-[#122d1f]">Manage appointment</h3>
    {staff && <p className="text-sm text-[#53645b]">Completion requires a saved PDF for softcopy requests and recorded collection for hardcopy requests. Both formats require both records.</p>}
    {request.hardcopyCollectedAt && <p className="text-sm text-[#34483a]">Hardcopy collected by <strong>{request.hardcopyCollectedName}</strong> on {new Date(request.hardcopyCollectedAt).toLocaleString("en-PH", { timeZone: "Asia/Manila" })}.</p>}
    <div className="flex flex-wrap gap-2">
      <button type="button" disabled={busy} className={buttonClass} onClick={() => choose("cancel")}>Cancel appointment</button>
      {staff && <button type="button" disabled={busy} className={buttonClass} onClick={() => choose("reschedule")}>Reschedule appointment</button>}
      {staff&&request.status==="APPROVED"&&<button type="button" disabled={busy} className={buttonClass} onClick={()=>choose("reject")}>Reject approved request</button>}
      {staff && request.status === "APPROVED" && <button type="button" disabled={busy} className={buttonClass} onClick={() => choose("no_show")}>Mark no-show</button>}
      {staff && request.status === "APPROVED" && request.deliveryFormat !== "Softcopy" && !request.hardcopyCollectedAt && <button type="button" disabled={busy} className={buttonClass} onClick={() => choose("collect")}>Record hardcopy collection</button>}
    </div>
    {error && <p role="alert" className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</p>}
    {action && <form className="space-y-3 rounded border border-[#d9e2da] bg-[#f7faf7] p-3" onSubmit={async event => {
      event.preventDefault();
      if (lock.current) return;
      lock.current = true; setBusy(true); setError("");
      try {
        const updated = await manageAppointment(request, action, { reason, date, timeSlot, recipient });
        onUpdated(updated); setAction(""); setReason("");
        toast.success(action === "collect" ? "Hardcopy collection recorded. Email update queued." : "Appointment updated. Email update queued.");
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "Could not update the appointment.");
        try { onUpdated(await getAppointmentRequest(request.reference)); } catch { /* Preserve the error and let the user retry. */ }
      } finally { lock.current = false; setBusy(false); }
    }}>
      <h4 className="font-semibold">{action === "reject" ? "Reject approved request" : action === "cancel" ? "Confirm cancellation" : action === "reschedule" ? "Choose a new schedule" : action === "collect" ? "Record collection" : "Confirm no-show"}</h4>
      {action === "cancel" && <p className="text-sm text-[#53645b]">Cancellation releases the reserved appointment. A certificate that has already been issued or collected requires staff assistance.</p>}
      {action === "no_show" && <p className="text-sm text-[#53645b]">Staff may record a no-show after the appointment hour has ended. Use this only after confirming the resident did not attend.</p>}
      {action === "reschedule" && <>
        <label className="grid gap-1 text-sm font-semibold">New appointment date
          <input required type="date" value={date} min={today} max={lastDay.toISOString().slice(0, 10)} disabled={busy} onChange={event => setDate(event.target.value)} className={inputClass} />
        </label>
        {loadingSlots && <p role="status" className="text-sm">Checking available times…</p>}
        {slotError && <p role="alert" className="text-sm text-red-800">{slotError}</p>}
        <label className="grid gap-1 text-sm font-semibold">New appointment time
          <select required value={timeSlot} disabled={busy || loadingSlots || !!slotError} onChange={event => setTimeSlot(event.target.value)} className={inputClass}>
            <option value="">Select an available time</option>
            {slots.map(slot => <option key={slot.label} value={slot.label} disabled={!slot.available || (date === request.date && slot.label === request.timeSlot)}>{slot.label}{slot.available ? ` (${slot.remaining} remaining)` : ` — ${slot.reason}`}</option>)}
          </select>
        </label>
      </>}
      {action === "collect" ? <label className="grid gap-1 text-sm font-semibold">Name of person who collected the hardcopy
        <input required maxLength={200} value={recipient} disabled={busy} onChange={event => setRecipient(event.target.value)} className={inputClass} />
      </label> : <label className="grid gap-1 text-sm font-semibold">Reason
        <textarea required maxLength={1000} rows={3} value={reason} disabled={busy} onChange={event => setReason(event.target.value)} className={inputClass} />
      </label>}
      <div className="flex flex-wrap gap-2">
        <button type="submit" disabled={busy || (action === "collect" ? !recipient.trim() : !reason.trim()) || (action === "reschedule" && (!timeSlot || loadingSlots || !!slotError))} className="min-h-11 rounded bg-[#123323] px-4 text-sm font-semibold text-white disabled:opacity-50">{busy ? "Saving…" : "Confirm change"}</button>
        <button type="button" disabled={busy} onClick={() => setAction("")} className={buttonClass}>Keep current appointment</button>
      </div>
    </form>}
  </section>;
}
