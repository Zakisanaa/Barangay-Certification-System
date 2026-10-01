import { useState } from "react";
import { ChevronLeft, ChevronRight, Check } from "lucide-react";
import { toast } from "sonner";
import {
  format, startOfMonth, endOfMonth, eachDayOfInterval, getDay,
  isSameDay, isWeekend, isBefore, startOfDay, addMonths, subMonths,
} from "date-fns";

const certificateTypes = [
  "Barangay Clearance",
  "Certificate of Residency",
  "Certificate of Indigency",
  "Business Permit Clearance",
  "Good Moral Certificate",
  "Community Tax Certificate (Cedula)",
];

type Step = 1 | 2 | 3 | 4;

interface FormData {
  fullName: string;
  address: string;
  voterId: string;
  requestType: string;
  purpose: string;
  date: Date | null;
}

const steps = [
  { num: 1, id: "INFO", label: "Personal Information" },
  { num: 2, id: "TYPE", label: "Request Type & Purpose" },
  { num: 3, id: "DATE", label: "Schedule Appointment" },
  { num: 4, id: "SUMMARY", label: "Review & Submit" },
];

function StepIndicator({ current }: { current: Step }) {
  return (
    <div
      className="flex-shrink-0 bg-white"
      style={{ width: 180, border: "1px solid #c4c0b9" }}
    >
      <div
        className="px-4 py-3"
        style={{ background: "#f5f3f0", borderBottom: "1px solid #c4c0b9" }}
      >
        <span className="text-[9px] font-bold tracking-[0.18em]" style={{ color: "#9e9b96" }}>
          STEP_INDICATOR
        </span>
      </div>

      <div className="p-3 space-y-0">
        {steps.map((s, i) => {
          const done = s.num < current;
          const active = s.num === current;
          return (
            <div key={s.num}>
              <div
                className="flex items-start gap-2.5 px-3 py-3 transition-colors"
                style={{
                  background: active ? "#0f0e0c" : done ? "#f5f3f0" : "transparent",
                }}
              >
                <div
                  className="w-5 h-5 flex-shrink-0 flex items-center justify-center text-[9px] font-bold mt-0.5"
                  style={{
                    border: active ? "1.5px solid #fff" : "1.5px solid #c4c0b9",
                    color: active ? "#fff" : done ? "#0f0e0c" : "#9e9b96",
                    background: done ? "#0f0e0c" : "transparent",
                  }}
                >
                  {done ? <Check className="w-2.5 h-2.5" style={{ color: "#fff" }} /> : s.num}
                </div>
                <div>
                  <div
                    className="text-[9px] font-bold tracking-[0.12em] leading-none"
                    style={{ color: active ? "#fff" : done ? "#0f0e0c" : "#9e9b96" }}
                  >
                    {s.id}
                  </div>
                  <div
                    className="text-[9px] mt-0.5 leading-tight"
                    style={{ color: active ? "rgba(255,255,255,0.65)" : "#9e9b96" }}
                  >
                    {s.label}
                  </div>
                </div>
              </div>
              {i < steps.length - 1 && (
                <div className="h-5 flex items-center" style={{ paddingLeft: 22 }}>
                  <div className="w-px h-full" style={{ background: "#c4c0b9" }} />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function CalendarPicker({ selected, onSelect }: { selected: Date | null; onSelect: (d: Date) => void }) {
  const [viewDate, setViewDate] = useState(new Date());
  const today = startOfDay(new Date());
  const monthStart = startOfMonth(viewDate);
  const monthEnd = endOfMonth(viewDate);
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });
  const startPad = getDay(monthStart);
  const dayNames = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];

  return (
    <div className="bg-white" style={{ border: "1px solid #c4c0b9" }}>
      {/* Month nav */}
      <div
        className="flex items-center justify-between px-5 py-3"
        style={{ background: "#f5f3f0", borderBottom: "1px solid #c4c0b9" }}
      >
        <button
          onClick={() => setViewDate(v => subMonths(v, 1))}
          className="transition-opacity hover:opacity-60"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <div className="flex items-center gap-4">
          <span className="text-[11px] font-bold tracking-[0.12em]">
            {format(viewDate, "MMMM yyyy").toUpperCase()}
          </span>
          <span className="text-[9px] font-bold tracking-[0.1em]" style={{ color: "#9e9b96" }}>
            CALENDAR_GRID
          </span>
        </div>
        <button
          onClick={() => setViewDate(v => addMonths(v, 1))}
          className="transition-opacity hover:opacity-60"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-7" style={{ borderBottom: "1px solid #c4c0b9" }}>
        {dayNames.map(d => (
          <div
            key={d}
            className="py-2.5 text-center text-[9px] font-bold tracking-[0.1em]"
            style={{ color: "#9e9b96" }}
          >
            {d}
          </div>
        ))}
      </div>

      {/* Days */}
      <div className="grid grid-cols-7">
        {Array.from({ length: startPad }).map((_, i) => (
          <div
            key={`pad-${i}`}
            className="py-4"
            style={{
              background: "#f9f8f6",
              borderRight: "1px solid #e8e5e0",
              borderBottom: "1px solid #e8e5e0",
            }}
          />
        ))}
        {days.map((day, i) => {
          const unavail = isWeekend(day) || isBefore(startOfDay(day), today);
          const isSel = selected && isSameDay(day, selected);
          const col = (startPad + i) % 7;
          return (
            <button
              key={day.toISOString()}
              disabled={unavail}
              onClick={() => onSelect(day)}
              className="py-4 text-center text-[11px] font-bold transition-colors relative"
              style={{
                borderRight: col < 6 ? "1px solid #e8e5e0" : "none",
                borderBottom: "1px solid #e8e5e0",
                background: isSel ? "#0f0e0c" : unavail ? "#f9f8f6" : "transparent",
                color: isSel ? "#fff" : unavail ? "#c4c0b9" : "#0f0e0c",
                cursor: unavail ? "not-allowed" : "pointer",
              }}
              onMouseEnter={e => { if (!unavail && !isSel) e.currentTarget.style.background = "#f0ede8"; }}
              onMouseLeave={e => { if (!unavail && !isSel) e.currentTarget.style.background = "transparent"; }}
            >
              {format(day, "d")}
            </button>
          );
        })}
      </div>

      {/* Legend */}
      <div
        className="flex items-center gap-5 px-5 py-3"
        style={{ borderTop: "1px solid #c4c0b9" }}
      >
        {[
          { label: "Available", bg: "#fff", bd: "#c4c0b9" },
          { label: "Selected", bg: "#0f0e0c", bd: "transparent" },
          { label: "Unavailable", bg: "#f9f8f6", bd: "#e8e5e0" },
        ].map(l => (
          <div key={l.label} className="flex items-center gap-1.5">
            <div className="w-3 h-3" style={{ background: l.bg, border: `1px solid ${l.bd}` }} />
            <span className="text-[9px] font-bold" style={{ color: "#6e6b65" }}>{l.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

const inputCls = "w-full px-4 py-3 text-[11px] outline-none transition-all bg-white";
const inputStyle = { fontFamily: "'Space Mono', monospace", border: "1.5px solid #c4c0b9" };
const labelCls = "block text-[9px] font-bold tracking-[0.18em] mb-2";

export default function BookPage() {
  const [step, setStep] = useState<Step>(1);
  const [submitted, setSubmitted] = useState(false);
  const [form, setForm] = useState<FormData>({
    fullName: "", address: "", voterId: "", requestType: "", purpose: "", date: null,
  });

  const set = (k: keyof FormData, v: string | Date | null) =>
    setForm(prev => ({ ...prev, [k]: v }));

  const canNext = () => {
    if (step === 1) return !!(form.fullName && form.address && form.voterId);
    if (step === 2) return !!(form.requestType && form.purpose);
    if (step === 3) return form.date !== null;
    return true;
  };

  if (submitted) {
    return (
      <div
        className="p-7 flex items-center justify-center min-h-[70vh]"
        style={{ fontFamily: "'Space Mono', monospace" }}
      >
        <div className="bg-white p-12 text-center" style={{ border: "1px solid #c4c0b9", maxWidth: 420 }}>
          <div
            className="w-14 h-14 flex items-center justify-center text-2xl text-white mx-auto mb-5"
            style={{ background: "#0f0e0c" }}
          >
            ✓
          </div>
          <div className="text-[9px] font-bold tracking-[0.2em] mb-3" style={{ color: "#9e9b96" }}>
            REQUEST SUBMITTED
          </div>
          <div className="text-lg font-bold tracking-tight mb-3">Appointment Confirmed</div>
          <p className="text-[11px] mb-1" style={{ color: "#6e6b65" }}>
            Reference:{" "}
            <span className="font-bold" style={{ color: "#bf6318" }}>
              BRG-2024-{Math.floor(Math.random() * 1000 + 4900)}
            </span>
          </p>
          <p className="text-[11px] mb-8 leading-relaxed" style={{ color: "#6e6b65" }}>
            You will be notified within 24 hours via SMS or email.
          </p>
          <button
            onClick={() => { setSubmitted(false); setStep(1); setForm({ fullName: "", address: "", voterId: "", requestType: "", purpose: "", date: null }); }}
            className="px-8 py-3 text-[10px] font-bold tracking-[0.14em] text-white transition-opacity hover:opacity-80"
            style={{ background: "#0f0e0c" }}
          >
            BOOK ANOTHER
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-[#edf1ee] p-7" style={{ fontFamily: "'Segoe UI', 'Arial', sans-serif" }}>
      {/* Header */}
      <div className="mb-7 flex items-start justify-between pb-5" style={{ borderBottom: "1px solid #c9d1ca" }}>
        <div>
          <h2 className="text-sm font-bold tracking-[0.12em] uppercase text-[#122d1f]">Appointment Request</h2>
          <p className="mt-1 text-[10px] text-[#53645b]">
            Book an appointment for barangay certification services
          </p>
        </div>
        <div className="text-[10px] font-bold tracking-[0.2em] text-[#6a766e]">
          STEP {step} / 4
        </div>
      </div>

      <div className="flex gap-6">
        <StepIndicator current={step} />

        {/* Content card */}
        <div className="flex-1 bg-white" style={{ border: "1px solid #c4c0b9" }}>
          {/* Step title */}
          <div
            className="px-7 py-4"
            style={{ background: "#f5f3f0", borderBottom: "1px solid #c4c0b9" }}
          >
            <span className="text-[10px] font-bold tracking-[0.15em]">
              STEP {step}: {steps[step - 1].label.toUpperCase()}
            </span>
          </div>

          <div className="p-7">
            {step === 1 && (
              <div className="space-y-5 max-w-lg">
                <p className="text-[10px] leading-relaxed" style={{ color: "#bf6318" }}>
                  Provide your personal information as it appears on your valid ID.
                </p>
                {[
                  { label: "FULL NAME", key: "fullName", placeholder: "e.g. Juan dela Cruz" },
                  { label: "COMPLETE ADDRESS", key: "address", placeholder: "e.g. 123 Rizal St., [Barangay Name]" },
                  { label: "VOTER ID NUMBER", key: "voterId", placeholder: "e.g. 1234-5678-9012" },
                ].map(f => (
                  <div key={f.key}>
                    <label className={labelCls}>
                      {f.label}{" "}
                      <span style={{ color: "#b91c1c" }}>*</span>
                    </label>
                    <input
                      value={form[f.key as keyof FormData] as string}
                      onChange={e => set(f.key as keyof FormData, e.target.value)}
                      placeholder={f.placeholder}
                      className={inputCls}
                      style={inputStyle}
                      onFocus={e => (e.currentTarget.style.borderColor = "#0f0e0c")}
                      onBlur={e => (e.currentTarget.style.borderColor = "#c4c0b9")}
                    />
                  </div>
                ))}
              </div>
            )}

            {step === 2 && (
              <div className="space-y-5 max-w-lg">
                <p className="text-[10px] leading-relaxed" style={{ color: "#bf6318" }}>
                  Select the type of document you need and briefly explain the purpose.
                </p>
                <div>
                  <label className={labelCls}>
                    REQUEST TYPE <span style={{ color: "#b91c1c" }}>*</span>
                  </label>
                  <select
                    value={form.requestType}
                    onChange={e => set("requestType", e.target.value)}
                    className={inputCls}
                    style={{ ...inputStyle, cursor: "pointer", appearance: "none" }}
                    onFocus={e => (e.currentTarget.style.borderColor = "#0f0e0c")}
                    onBlur={e => (e.currentTarget.style.borderColor = "#c4c0b9")}
                  >
                    <option value="">-- Select document type --</option>
                    {certificateTypes.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>
                    PURPOSE <span style={{ color: "#b91c1c" }}>*</span>
                  </label>
                  <textarea
                    value={form.purpose}
                    onChange={e => set("purpose", e.target.value)}
                    placeholder="Briefly describe the purpose of your request (e.g., For employment application at ABC Company)..."
                    rows={6}
                    className={inputCls}
                    style={{ ...inputStyle, resize: "none" }}
                    onFocus={e => (e.currentTarget.style.borderColor = "#0f0e0c")}
                    onBlur={e => (e.currentTarget.style.borderColor = "#c4c0b9")}
                  />
                </div>
              </div>
            )}

            {step === 3 && (
              <div className="space-y-4 max-w-xl">
                <p className="text-[10px] leading-relaxed" style={{ color: "#bf6318" }}>
                  Select an available appointment date. Grayed-out dates are unavailable.
                </p>
                <CalendarPicker selected={form.date} onSelect={d => set("date", d)} />
                {form.date && (
                  <div
                    className="px-5 py-3.5"
                    style={{ background: "#f5f3f0", border: "1px solid #c4c0b9" }}
                  >
                    <div className="text-[10px] font-bold tracking-[0.1em]">
                      SELECTED: {format(form.date, "MMMM d, yyyy (EEEE)").toUpperCase()}
                    </div>
                    <div className="text-[10px] mt-1" style={{ color: "#6e6b65" }}>
                      Appointment time: 8:00 AM – 12:00 PM (walk-in order)
                    </div>
                  </div>
                )}
              </div>
            )}

            {step === 4 && (
              <div className="space-y-5 max-w-xl">
                <p className="text-[10px] leading-relaxed" style={{ color: "#bf6318" }}>
                  Please review your request details before submitting. This information will be forwarded to the Barangay office.
                </p>
                <div style={{ border: "1px solid #c4c0b9" }}>
                  <div
                    className="px-5 py-3"
                    style={{ background: "#f5f3f0", borderBottom: "1px solid #c4c0b9" }}
                  >
                    <span className="text-[9px] font-bold tracking-[0.16em]">REQUEST_SUMMARY (READ-ONLY)</span>
                  </div>
                  {[
                    { label: "FULL NAME", value: form.fullName },
                    { label: "ADDRESS", value: form.address },
                    { label: "VOTER ID", value: form.voterId },
                    { label: "REQUEST TYPE", value: form.requestType },
                    { label: "PURPOSE", value: form.purpose },
                    { label: "APPOINTMENT DATE", value: form.date ? format(form.date, "MMMM d, yyyy") : "—" },
                  ].map((row, i, arr) => (
                    <div
                      key={row.label}
                      className="flex gap-8 px-5 py-3.5"
                      style={{ borderBottom: i < arr.length - 1 ? "1px solid #c4c0b9" : "none" }}
                    >
                      <div
                        className="text-[9px] font-bold tracking-[0.14em] flex-shrink-0 pt-0.5"
                        style={{ width: 120, color: "#9e9b96" }}
                      >
                        {row.label}
                      </div>
                      <div className="text-[11px] font-bold" style={{ color: "#bf6318" }}>{row.value}</div>
                    </div>
                  ))}
                </div>
                <div className="px-5 py-4" style={{ background: "#fdf7f0", border: "1px solid #e8c99a" }}>
                  <p className="text-[10px] leading-relaxed" style={{ color: "#6e6b65" }}>
                    ⚠ By submitting, you confirm that all information provided is accurate. False declarations are subject to penalties under applicable laws.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Nav */}
          <div
            className="flex justify-between px-7 py-5"
            style={{ borderTop: "1px solid #c4c0b9" }}
          >
            <button
              onClick={() => setStep(s => (s - 1) as Step)}
              disabled={step === 1}
              className="flex items-center gap-2 px-6 py-2.5 text-[10px] font-bold tracking-[0.12em] transition-all disabled:opacity-30"
              style={{ border: "1.5px solid #c4c0b9" }}
              onMouseEnter={e => { if (step > 1) e.currentTarget.style.borderColor = "#0f0e0c"; }}
              onMouseLeave={e => (e.currentTarget.style.borderColor = "#c4c0b9")}
            >
              <ChevronLeft className="w-3.5 h-3.5" /> BACK
            </button>

            {step < 4 ? (
              <button
                onClick={() => { if (canNext()) setStep(s => (s + 1) as Step); }}
                disabled={!canNext()}
                className="flex items-center gap-2 px-6 py-2.5 text-[10px] font-bold tracking-[0.12em] text-white transition-opacity disabled:opacity-35"
                style={{ background: "#0f0e0c" }}
              >
                NEXT <ChevronRight className="w-3.5 h-3.5" />
              </button>
            ) : (
              <button
                onClick={() => { setSubmitted(true); toast.success("Appointment submitted successfully!"); }}
                className="flex items-center gap-2 px-7 py-2.5 text-[10px] font-bold tracking-[0.12em] text-white transition-opacity hover:opacity-80"
                style={{ background: "#0f0e0c" }}
              >
                SUBMIT REQUEST <Check className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
