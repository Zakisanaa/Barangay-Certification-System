import { useState } from "react";
import { ChevronLeft, ChevronRight, Check, Copy, Download } from "lucide-react";
import { toast } from "sonner";
import {
  addAppointmentRequest,
  AppointmentRequest,
  DeliveryFormat,
  getAppointmentRequests,
  removeSchoolIdImage,
  uploadSchoolIdImage,
} from "../portalData";
import { ResidentAccount } from "../residentAuth";
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
  "First-Time Job Seeker Certificate",
  "Certificate of No Business",
  "Certificate of No Property",
  "Other barangay document",
];

const validIdTypes = [
  "Philippine National ID (PhilID)",
  "Driver's License",
  "Passport",
  "UMID",
  "PRC ID",
  "Postal ID",
  "Voter's ID",
  "Senior Citizen ID",
  "PWD ID",
  "Barangay ID",
  "School ID",
  "Other government-issued ID",
];

const schoolIdType = "School ID";
const maxSchoolIdImageBytes = 5 * 1024 * 1024;
const schoolIdImageTypes = ["image/jpeg", "image/png", "image/webp"];

type Step = 1 | 2 | 3 | 4;
type Page = "home" | "chat" | "book" | "dashboard" | "admin" | "schedule" | "concerns";

interface FormData {
  fullName: string;
  address: string;
  validIdType: string;
  validIdNumber: string;
  requestType: string;
  otherRequestType: string;
  purpose: string;
  date: Date | null;
  timeSlot: string;
  deliveryFormat: DeliveryFormat | "";
}

const steps = [
  { num: 1, id: "INFO", label: "Personal Information" },
  { num: 2, id: "TYPE", label: "Document & Purpose" },
  { num: 3, id: "DATE", label: "Schedule Appointment" },
  { num: 4, id: "SUMMARY", label: "Review & Submit" },
];

const timeSlots = [
  "8:00 AM - 9:00 AM",
  "9:00 AM - 10:00 AM",
  "10:00 AM - 11:00 AM",
  "11:00 AM - 12:00 PM",
  "1:00 PM - 2:00 PM",
  "2:00 PM - 3:00 PM",
  "3:00 PM - 4:00 PM",
];

function StepIndicator({ current }: { current: Step }) {
  return (
    <div
      className="w-full flex-shrink-0 bg-white md:w-[180px]"
      style={{ border: "1px solid #c4c0b9" }}
    >
      <div
        className="px-4 py-3"
        style={{ background: "#f5f3f0", borderBottom: "1px solid #c4c0b9" }}
      >
        <span className="text-xs font-bold tracking-wide" style={{ color: "#6e6b65" }}>
          REQUEST STEPS
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2 p-3 md:block md:space-y-0">
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
                    className="text-xs font-bold tracking-wide leading-none"
                    style={{ color: active ? "#fff" : done ? "#0f0e0c" : "#9e9b96" }}
                  >
                    {s.id}
                  </div>
                  <div
                    className="text-xs mt-1 leading-tight"
                    style={{ color: active ? "rgba(255,255,255,0.65)" : "#9e9b96" }}
                  >
                    {s.label}
                  </div>
                </div>
              </div>
              {i < steps.length - 1 && (
                <div className="hidden h-5 items-center md:flex" style={{ paddingLeft: 22 }}>
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

const inputCls = "w-full min-h-12 px-4 py-3 text-sm outline-none transition-all bg-white";
const inputStyle = { fontFamily: "'Space Mono', monospace", border: "1.5px solid #c4c0b9" };
const labelCls = "block text-xs font-bold tracking-wide mb-2";

export default function BookPage({ setActivePage, resident }: { setActivePage: (page: Page) => void; resident: ResidentAccount }) {
  const [step, setStep] = useState<Step>(1);
  const [submitted, setSubmitted] = useState(false);
  const [submittedReference, setSubmittedReference] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [schoolIdImage, setSchoolIdImage] = useState<File | null>(null);
  const [schoolIdConsent, setSchoolIdConsent] = useState(false);
  const [form, setForm] = useState<FormData>({
    fullName: resident.name, address: resident.address, validIdType: "", validIdNumber: "", requestType: "", otherRequestType: "", purpose: "", date: null,
    timeSlot: "", deliveryFormat: "",
  });

  const set = (k: keyof FormData, v: string | Date | null) =>
    setForm(prev => ({ ...prev, [k]: v }));

  const canNext = () => {
    if (step === 1) return !!(
      form.fullName
      && form.address
      && form.validIdType
      && form.validIdNumber.trim()
      && (form.validIdType !== schoolIdType || (schoolIdImage && schoolIdConsent))
    );
    if (step === 2) return !!(form.requestType && (form.requestType !== "Other barangay document" || form.otherRequestType.trim()) && form.purpose && form.deliveryFormat);
    if (step === 3) return form.date !== null && !!form.timeSlot;
    return true;
  };

  const submitRequest = async () => {
    if (!form.date || !form.deliveryFormat || submitting) return;
    if (form.validIdType === schoolIdType && (!schoolIdImage || !schoolIdConsent)) {
      toast.error("Upload a picture of the School ID and confirm its use for this request.");
      setStep(1);
      return;
    }
    setSubmitting(true);

    const request: AppointmentRequest = {
      reference: `BRG-${new Date().getFullYear()}-${Math.floor(100000 + Math.random() * 900000)}`,
      ownerId: resident.id,
      fullName: form.fullName.trim(),
      address: form.address.trim(),
      voterId: `${form.validIdType}: ${form.validIdNumber.trim()}`,
      schoolIdImagePath: null,
      requestType: form.requestType === "Other barangay document" ? form.otherRequestType.trim() : form.requestType,
      purpose: form.purpose.trim(),
      date: format(form.date, "yyyy-MM-dd"),
      timeSlot: form.timeSlot,
      deliveryFormat: form.deliveryFormat,
      status: "PENDING",
      archived: false,
      submittedAt: new Date().toISOString(),
    };

    let uploadedSchoolIdPath: string | null = null;
    try {
      if (form.validIdType === schoolIdType && schoolIdImage) {
        uploadedSchoolIdPath = await uploadSchoolIdImage(schoolIdImage, resident.id, request.reference);
        request.schoolIdImagePath = uploadedSchoolIdPath;
      }
      await addAppointmentRequest(request);
      setSubmittedReference(request.reference);
      setSubmitted(true);
      toast.success("Request submitted for barangay review.");
    } catch (error) {
      if (uploadedSchoolIdPath) {
        try {
          await removeSchoolIdImage(uploadedSchoolIdPath);
        } catch (cleanupError) {
          console.error("Unable to remove the unsubmitted school ID image.", cleanupError);
        }
      }
      console.error("Unable to submit the appointment request.", error);
      toast.error(error instanceof Error ? error.message : "Could not submit your request.");
    } finally {
      setSubmitting(false);
    }
  };

  const copyReference = async () => {
    try {
      await navigator.clipboard.writeText(submittedReference);
      toast.success("Reference number copied.");
    } catch (error) {
      console.error("Unable to copy the request reference.", error);
      toast.error("Could not copy automatically. Please select and copy the reference number.");
    }
  };

  const downloadReceipt = async () => {
    let request: AppointmentRequest | undefined;
    try {
      request = (await getAppointmentRequests(resident.id)).find((item) => item.reference === submittedReference);
    } catch (error) {
      console.error("Unable to load the request receipt data.", error);
      toast.error(error instanceof Error ? error.message : "Could not load request details.");
      return;
    }
    if (!request) {
      toast.error("The saved request could not be found in this browser.");
      return;
    }
    const receipt = [
      "BARANGAY LAGASIT - REQUEST REFERENCE BACKUP",
      `Reference: ${request.reference}`,
      `Document: ${request.requestType}`,
      `Appointment: ${format(new Date(`${request.date}T00:00:00`), "MMMM d, yyyy")} · ${request.timeSlot}`,
      `Status: ${request.status}`,
      `Submitted: ${format(new Date(request.submittedAt), "MMMM d, yyyy h:mm a")}`,
      "",
      "Sign in to the resident portal to retrieve this request from your account.",
      "This receipt is a reference backup, not an official Barangay confirmation.",
    ].join("\n");
    const file = new Blob([receipt], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(file);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${request.reference}-receipt.txt`;
    anchor.click();
    URL.revokeObjectURL(url);
    toast.success("Request receipt downloaded.");
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
            REQUEST RECEIVED
          </div>
          <div className="text-xl font-bold tracking-tight mb-3">Your request is awaiting review</div>
          <p className="text-base mb-1" style={{ color: "#6e6b65" }}>
            Keep this reference number to check your request status:
          </p>
          <p className="text-lg font-bold mb-3" style={{ color: "#bf6318" }}>
            {submittedReference}
          </p>
          <div className="mb-5 flex flex-wrap justify-center gap-2">
            <button
              type="button"
              onClick={copyReference}
              className="flex min-h-11 items-center gap-2 border border-[#c4c0b9] px-4 text-sm font-bold text-[#123323]"
            >
              <Copy className="h-4 w-4" /> Copy reference
            </button>
            <button
              type="button"
              onClick={downloadReceipt}
              className="flex min-h-11 items-center gap-2 border border-[#c4c0b9] px-4 text-sm font-bold text-[#123323]"
            >
              <Download className="h-4 w-4" /> Download backup
            </button>
          </div>
          <p className="text-sm mb-8 leading-relaxed" style={{ color: "#6e6b65" }}>
            Your request and reference are saved in this browser. This request has not been sent to the Barangay office.
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            <button
              type="button"
              onClick={() => setActivePage("dashboard")}
              className="min-h-12 border border-[#c4c0b9] px-5 py-3 text-sm font-bold text-[#123323]"
            >
              Go to my dashboard
            </button>
            <button
              onClick={() => {
                setSubmitted(false);
                setSubmittedReference("");
                setStep(1);
                setForm({ fullName: resident.name, address: resident.address, validIdType: "", validIdNumber: "", requestType: "", otherRequestType: "", purpose: "", date: null, timeSlot: "", deliveryFormat: "" });
                setSchoolIdImage(null);
                setSchoolIdConsent(false);
              }}
              className="min-h-12 px-8 py-3 text-sm font-bold text-white transition-opacity hover:opacity-80"
              style={{ background: "#0f0e0c" }}
            >
              BOOK ANOTHER
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-[#edf1ee] p-4 md:p-7" style={{ fontFamily: "'Segoe UI', 'Arial', sans-serif" }}>
      {/* Header */}
      <div className="mb-7 flex items-start justify-between pb-5" style={{ borderBottom: "1px solid #c9d1ca" }}>
        <div>
          <h2 className="text-sm font-bold tracking-[0.12em] uppercase text-[#122d1f]">Appointment Request</h2>
          <p className="mt-1 text-sm text-[#53645b]">
            Book an appointment for barangay certification services
          </p>
        </div>
        <div className="text-[10px] font-bold tracking-[0.2em] text-[#6a766e]">
          STEP {step} / 4
        </div>
      </div>

      <div className="flex flex-col gap-4 md:flex-row md:gap-6">
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
                <p className="text-sm leading-relaxed" style={{ color: "#53645b" }}>
                  Provide your personal information as it appears on your valid ID.
                </p>
                {[
                  { label: "FULL NAME", key: "fullName", placeholder: "e.g. Juan dela Cruz" },
                  { label: "COMPLETE ADDRESS", key: "address", placeholder: "e.g. 123 Rizal St., Barangay Lagasit" },
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
                      readOnly={f.key === "fullName" || f.key === "address"}
                      className={inputCls}
                      style={{
                        ...inputStyle,
                        ...(f.key === "fullName" || f.key === "address" ? { background: "#f4f7f4", color: "#53645b" } : {}),
                      }}
                      onFocus={e => (e.currentTarget.style.borderColor = "#0f0e0c")}
                      onBlur={e => (e.currentTarget.style.borderColor = "#c4c0b9")}
                    />
                  </div>
                ))}
                <div>
                  <label className={labelCls}>
                    VALID ID TYPE <span style={{ color: "#b91c1c" }}>*</span>
                  </label>
                  <select
                    required
                    value={form.validIdType}
                    onChange={event => set("validIdType", event.target.value)}
                    className={inputCls}
                    style={inputStyle}
                  >
                    <option value="">Select the ID you will present</option>
                    {validIdTypes.map(idType => <option key={idType} value={idType}>{idType}</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>
                    ID NUMBER <span style={{ color: "#b91c1c" }}>*</span>
                  </label>
                  <input
                    required
                    value={form.validIdNumber}
                    onChange={event => set("validIdNumber", event.target.value)}
                    placeholder="Enter the number shown on your ID"
                    className={inputCls}
                    style={inputStyle}
                  />
                </div>
                {form.validIdType === schoolIdType && (
                  <div className="space-y-3 rounded border border-[#d9e2da] bg-[#f7faf7] p-4">
                    <label className="grid gap-2 text-sm font-bold text-[#34483a]">
                      Picture of school ID <span className="text-red-700">*</span>
                      <input
                        required
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        onChange={event => {
                          const file = event.target.files?.[0] ?? null;
                          if (file && !schoolIdImageTypes.includes(file.type)) {
                            toast.error("Choose a JPG, PNG, or WebP image.");
                            event.currentTarget.value = "";
                            setSchoolIdImage(null);
                            return;
                          }
                          if (file && file.size > maxSchoolIdImageBytes) {
                            toast.error("The school ID image must be 5 MB or smaller.");
                            event.currentTarget.value = "";
                            setSchoolIdImage(null);
                            return;
                          }
                          setSchoolIdImage(file);
                          setSchoolIdConsent(false);
                        }}
                        className="min-h-11 w-full rounded border border-[#c9d1ca] bg-white p-2 text-sm file:mr-3 file:min-h-8 file:rounded file:border-0 file:bg-[#123323] file:px-3 file:font-semibold file:text-white"
                      />
                    </label>
                    <p className="text-xs leading-relaxed text-[#53645b]">
                      Upload a clear picture of the school ID. JPG, PNG, or WebP; maximum 5 MB. Only authorized barangay staff can view it for this request.
                    </p>
                    {schoolIdImage && (
                      <p className="break-all text-xs font-semibold text-[#34483a]">Selected: {schoolIdImage.name}</p>
                    )}
                    <label className="flex items-start gap-2 text-sm leading-relaxed text-[#34483a]">
                      <input
                        type="checkbox"
                        checked={schoolIdConsent}
                        onChange={event => setSchoolIdConsent(event.target.checked)}
                        className="mt-1 h-4 w-4 accent-[#123323]"
                      />
                      <span>I confirm this is my school ID and allow authorized barangay staff to review this image for this request.</span>
                    </label>
                  </div>
                )}
              </div>
            )}

            {step === 2 && (
              <div className="space-y-5 max-w-lg">
                <p className="text-sm leading-relaxed" style={{ color: "#53645b" }}>
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
                {form.requestType === "Other barangay document" && (
                  <div>
                    <label className={labelCls}>
                      DOCUMENT NAME <span style={{ color: "#b91c1c" }}>*</span>
                    </label>
                    <input
                      required
                      maxLength={100}
                      value={form.otherRequestType}
                      onChange={e => set("otherRequestType", e.target.value)}
                      placeholder="Enter the barangay document you need"
                      className={inputCls}
                      style={inputStyle}
                    />
                  </div>
                )}
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
                <fieldset>
                  <legend className={labelCls}>DOCUMENT FORMAT <span style={{ color: "#b91c1c" }}>*</span></legend>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                    {(["Softcopy", "Hardcopy", "Both"] as DeliveryFormat[]).map((formatOption) => (
                      <button
                        key={formatOption}
                        type="button"
                        aria-pressed={form.deliveryFormat === formatOption}
                        onClick={() => set("deliveryFormat", formatOption)}
                        className="min-h-12 border px-3 py-2 text-sm font-bold"
                        style={{
                          borderColor: form.deliveryFormat === formatOption ? "#123323" : "#c4c0b9",
                          background: form.deliveryFormat === formatOption ? "#edf5ee" : "#fff",
                          color: "#123323",
                        }}
                      >
                        {formatOption}
                      </button>
                    ))}
                  </div>
                </fieldset>
              </div>
            )}

            {step === 3 && (
              <div className="space-y-4 max-w-xl">
                <p className="text-sm leading-relaxed" style={{ color: "#53645b" }}>
                  Select an available weekday and appointment time.
                </p>
                <CalendarPicker selected={form.date} onSelect={d => set("date", d)} />
                <fieldset>
                  <legend className="mb-2 text-sm font-bold text-[#34483a]">Preferred appointment time</legend>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {timeSlots.map((timeSlot) => (
                      <button
                        key={timeSlot}
                        type="button"
                        aria-pressed={form.timeSlot === timeSlot}
                        onClick={() => set("timeSlot", timeSlot)}
                        className="min-h-11 border px-2 py-2 text-sm font-semibold"
                        style={{
                          borderColor: form.timeSlot === timeSlot ? "#123323" : "#c4c0b9",
                          background: form.timeSlot === timeSlot ? "#edf5ee" : "#fff",
                          color: "#123323",
                        }}
                      >
                        {timeSlot}
                      </button>
                    ))}
                  </div>
                </fieldset>
                {form.date && (
                  <div
                    className="px-5 py-3.5"
                    style={{ background: "#f5f3f0", border: "1px solid #c4c0b9" }}
                  >
                    <div className="text-[10px] font-bold tracking-[0.1em]">
                      SELECTED: {format(form.date, "MMMM d, yyyy (EEEE)").toUpperCase()}
                    </div>
                    <div className="text-[10px] mt-1" style={{ color: "#6e6b65" }}>
                      Appointment time: {form.timeSlot || "Select a time above"}
                    </div>
                  </div>
                )}
              </div>
            )}

            {step === 4 && (
              <div className="space-y-5 max-w-xl">
                <p className="text-sm leading-relaxed" style={{ color: "#53645b" }}>
                  Review your details before saving the request. Appointment date and time still need staff confirmation.
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
                    { label: "VALID ID", value: `${form.validIdType} · ${form.validIdNumber}` },
                    { label: "REQUEST TYPE", value: form.requestType },
                    { label: "PURPOSE", value: form.purpose },
                    { label: "APPOINTMENT DATE", value: form.date ? format(form.date, "MMMM d, yyyy") : "—" },
                    { label: "APPOINTMENT TIME", value: form.timeSlot },
                    { label: "DOCUMENT FORMAT", value: form.deliveryFormat },
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
                disabled={submitting}
                onClick={submitRequest}
                className="flex min-h-12 items-center gap-2 px-7 py-2.5 text-sm font-bold text-white transition-opacity hover:opacity-80"
                style={{ background: "#0f0e0c" }}
              >
                {submitting ? "SAVING..." : "SUBMIT REQUEST"} <Check className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
