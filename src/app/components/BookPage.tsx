import {formatServiceFee} from '../serviceFee';
import {useUnsavedChanges} from '../useUnsavedChanges';
import {validateBookingFields} from '../bookingValidation';
import {manilaTime} from '../manilaTime';
import { useEffect, useRef, useState } from "react";
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
import { useCertificateTemplates } from "../certificateTemplates";
import { getServiceConfiguration, getSlotAvailability, subscribeServiceData } from "../serviceData";
import type { ServiceConfiguration, SlotAvailability } from "../serviceData";
import { removeUnusedPrivateFile,todayInManila,uploadPrivateFile,validatePrivateFile } from '../adminData';
import { requireSupabase } from '../supabase';
import { validateAnnouncementImage } from '../announcementImages';
import {
  format, startOfMonth, endOfMonth, eachDayOfInterval, getDay,
  isSameDay, isWeekend, isBefore, isAfter, startOfDay, addDays, addMonths, subMonths,
} from "date-fns";

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
                  className="w-5 h-5 flex-shrink-0 flex items-center justify-center text-xs font-bold mt-0.5"
                  style={{
                    border: active ? "1.5px solid #fff" : "1.5px solid #c4c0b9",
                    color: active ? "#fff" : done ? "#0f0e0c" : "#61645f",
                    background: done ? "#0f0e0c" : "transparent",
                  }}
                >
                  {done ? <Check className="w-2.5 h-2.5" style={{ color: "#fff" }} /> : s.num}
                </div>
                <div>
                  <div
                    className="text-xs font-bold tracking-wide leading-none"
                    style={{ color: active ? "#fff" : done ? "#0f0e0c" : "#61645f" }}
                  >
                    {s.id}
                  </div>
                  <div
                    className="text-xs mt-1 leading-tight"
                    style={{ color: active ? "rgba(255,255,255,0.65)" : "#61645f" }}
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

function CalendarPicker({ selected, onSelect, closures, daysAhead,weekdays }: { selected: Date | null; onSelect: (d: Date) => void; closures: string[]; daysAhead: number;weekdays?:{iso_day:number;open:boolean}[] }) {
  const [viewDate, setViewDate] = useState(new Date());
  const today = startOfDay(new Date(new Date().toLocaleDateString("en-US", { timeZone: "Asia/Manila" })));
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
          type="button"
          aria-label="Previous month"
          onClick={() => setViewDate(v => subMonths(v, 1))}
          className="transition-opacity hover:opacity-60"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <div className="flex items-center gap-4">
          <span className="text-xs font-bold tracking-[0.12em]">
            {format(viewDate, "MMMM yyyy").toUpperCase()}
          </span>
          <span className="text-xs font-bold tracking-[0.1em]" style={{ color: "#61645f" }}>
            CALENDAR_GRID
          </span>
        </div>
        <button
          type="button"
          aria-label="Next month"
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
            className="py-2.5 text-center text-xs font-bold tracking-[0.1em]"
            style={{ color: "#61645f" }}
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
          const closedWeekday=weekdays?.length?!weekdays.some(item=>item.iso_day===(day.getDay()||7)&&item.open):isWeekend(day);
          const unavail = closedWeekday || isBefore(startOfDay(day), today) || isAfter(day, addDays(today, daysAhead)) || closures.includes(format(day, "yyyy-MM-dd"));
          const isSel = selected && isSameDay(day, selected);
          const col = (startPad + i) % 7;
          return (
            <button
              key={day.toISOString()}
              type="button"
              aria-label={format(day, "EEEE, MMMM d, yyyy")}
              aria-pressed={!!isSel}
              disabled={unavail}
              onClick={() => onSelect(day)}
              className="py-4 text-center text-xs font-bold transition-colors relative"
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
            <span className="text-xs font-bold" style={{ color: "#6e6b65" }}>{l.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

const inputCls = "w-full min-h-12 px-4 py-3 text-sm outline-none transition-all bg-white";
const inputStyle = { fontFamily: "'Space Mono', monospace", border: "1.5px solid #c4c0b9" };
const labelCls = "block text-xs font-bold tracking-wide mb-2";

export default function BookPage({ setActivePage, resident,initialService }: { setActivePage: (page: Page) => void; resident: ResidentAccount;initialService?:string }) {
  const [step, setStep] = useState<Step>(1);
  const [submitted, setSubmitted] = useState(false);
  const [submittedReference, setSubmittedReference] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [idImage, setIdImage] = useState<File | null>(null);
  const [idConsent, setIdConsent] = useState(false);
  const [checkingIdImage, setCheckingIdImage] = useState(false);
  const idSelectionVersion = useRef(0);
  const [configuration, setConfiguration] = useState<ServiceConfiguration | null>(null);
  const [supportingFiles,setSupportingFiles]=useState<Record<string,File>>({});
  const [supportingErrors,setSupportingErrors]=useState<Record<string,string>>({});
  const [checkingSupporting,setCheckingSupporting]=useState<Record<string,boolean>>({});
  const supportingSelections=useRef<Record<string,number>>({});
  const supportingServiceVersion=useRef(0);
  const submissionReference=useRef(`BRG-${todayInManila().slice(0,4)}-${crypto.randomUUID().replaceAll('-','').slice(0,12).toUpperCase()}`);
  const [settingsError, setSettingsError] = useState("");
  const [reloadSettings, setReloadSettings] = useState(0);
  const [availableSlots, setAvailableSlots] = useState<SlotAvailability[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [slotError, setSlotError] = useState("");
  const [form, setForm] = useState<FormData>({
    fullName: resident.name, address: resident.address, validIdType: "", validIdNumber: "", requestType: initialService??"", otherRequestType: "", purpose: "", date: null,
    timeSlot: "", deliveryFormat: "",
  });

  useEffect(() => {
    let active = true;
    const refresh = () => void getServiceConfiguration().then(
      data => { if (active) { setConfiguration(data); setSettingsError(""); } },
      cause => { if (active) setSettingsError(cause instanceof Error ? cause.message : "Could not load booking information."); },
    );
    refresh();
    const unsubscribe = subscribeServiceData(["service_catalog", "office_settings", "appointment_slots", "office_closures",'service_requirements','certificate_templates','office_weekdays'], refresh);
    return () => { active = false; unsubscribe(); };
  }, [reloadSettings]);

  useEffect(() => {
    if (!form.date || step !== 3) return;
    let active = true;
    const day = format(form.date, "yyyy-MM-dd");
    const refresh = () => {
      setLoadingSlots(true);
      void getSlotAvailability(day).then(
        slots => {
          if (!active) return;
          setAvailableSlots(slots); setSlotError("");
          setForm(previous => previous.timeSlot && !slots.some(slot => slot.label === previous.timeSlot && slot.available) ? { ...previous, timeSlot: "" } : previous);
        },
        cause => { if (active) { setAvailableSlots([]); setSlotError(cause instanceof Error ? cause.message : "Could not check appointment availability."); } },
      ).finally(() => { if (active) setLoadingSlots(false); });
    };
    refresh();
    const timer = window.setInterval(refresh, 30000);
    window.addEventListener("focus", refresh);
    const unsubscribe = subscribeServiceData(["appointment_slots", "office_closures", "appointment_requests"], refresh);
    return () => { active = false; window.clearInterval(timer); window.removeEventListener("focus", refresh); unsubscribe(); };
  }, [form.date, step, reloadSettings]);

  const selectedService = configuration?.services.find(service => service.request_type === form.requestType && service.active);
  const supportingRequirements=configuration?.requirements?.filter(item=>item.request_type===form.requestType&&item.active)??[];
  const templates=useCertificateTemplates(form.requestType);
  const supportsSoftcopy = !!selectedService?.softcopy_available && !!templates.length;
  useEffect(() => {
    if (!supportsSoftcopy) setForm(previous => previous.deliveryFormat && previous.deliveryFormat !== "Hardcopy" ? { ...previous, deliveryFormat: "Hardcopy" } : previous);
  }, [supportsSoftcopy]);

  const [idPreview,setIdPreview]=useState(''),[validationError,setValidationError]=useState<{field:string;message:string;step:1|2}|null>(null);
  useEffect(()=>{if(!idImage){setIdPreview('');return;}const url=URL.createObjectURL(idImage);setIdPreview(url);return()=>URL.revokeObjectURL(url);},[idImage]);
  useUnsavedChanges(!submitted&&!!(form.validIdType||form.validIdNumber||form.requestType||form.purpose||form.date||idImage||Object.keys(supportingFiles).length));
  const set = (k: keyof FormData, v: string | Date | null) =>
    {setValidationError(null);setForm(prev => ({ ...prev, [k]: v }));};
  useEffect(()=>()=>{supportingServiceVersion.current++;},[]);
  const selectSupportingFile=async(id:string,input:HTMLInputElement)=>{
    const file=input.files?.[0],version=supportingServiceVersion.current,selection=(supportingSelections.current[id]??0)+1;
    supportingSelections.current[id]=selection;
    const current=()=>version===supportingServiceVersion.current&&selection===supportingSelections.current[id];
    setSupportingFiles(previous=>{const next={...previous};delete next[id];return next;});
    setSupportingErrors(previous=>({...previous,[id]:''}));setCheckingSupporting(previous=>({...previous,[id]:!!file}));
    if(!file)return;
    try{await validatePrivateFile(file);if(current())setSupportingFiles(previous=>({...previous,[id]:file}));}
    catch(cause){if(current()){input.value='';setSupportingErrors(previous=>({...previous,[id]:cause instanceof Error?cause.message:'Choose a valid supporting document.'}));}}
    finally{if(current())setCheckingSupporting(previous=>({...previous,[id]:false}));}
  };

  const canNext = () => {
    if (step === 1) return !!(
      form.fullName
      && form.address
      && form.validIdType
      && form.validIdNumber.trim() && form.validIdNumber.trim().length<=120 && form.fullName.trim().length<=200 && form.address.trim().length<=500
      && idImage && idConsent && !checkingIdImage
    );
    if (step === 2) return !!(selectedService && (form.requestType !== "Other barangay document" || form.otherRequestType.trim()) && form.purpose.trim() && form.purpose.trim().length<=2000 && form.otherRequestType.trim().length<=200 && form.deliveryFormat && supportingRequirements.every(item=>!checkingSupporting[item.id]&&!supportingErrors[item.id]&&(!item.required||supportingFiles[item.id])));
    if (step === 3) return form.date !== null && !!form.timeSlot && !loadingSlots && !slotError && availableSlots.some(slot => slot.label === form.timeSlot && slot.available);
    return true;
  };

  const submitRequest = async () => {
    if(submitting)return;
    if(!selectedService){setSettingsError('The selected service is no longer available. Choose an available document.');setStep(2);return;}
    if(supportingRequirements.some(item=>checkingSupporting[item.id]||supportingErrors[item.id]||(item.required&&!supportingFiles[item.id]))){toast.error('Upload the required supporting documents before submitting.');setStep(2);return;}
    const problem=validateBookingFields(form);if(problem){setValidationError(problem);setStep(problem.step);return;}
    if(!form.date||!form.deliveryFormat){toast.error('Select a document format, appointment date, and time.');setStep(3);return;}
    if (!idImage || !idConsent || checkingIdImage) {
      toast.error("Attach a clear photo of your valid ID and confirm staff review before booking.");
      setStep(1);
      return;
    }
    setSubmitting(true);

    const request: AppointmentRequest = {
      reference: submissionReference.current,
      ownerId: resident.id,
      fullName: form.fullName.trim(),
      address: form.address.trim(),
      voterId: `${form.validIdType}: ${form.validIdNumber.trim()}`,idType:form.validIdType,idNumber:form.validIdNumber.trim(),idReviewAcknowledged:idConsent,
      schoolIdImagePath: null,
      requestType: form.requestType === "Other barangay document" ? form.otherRequestType.trim() : form.requestType,
      purpose: form.purpose.trim(),
      date: format(form.date, "yyyy-MM-dd"),
      timeSlot: form.timeSlot,
      deliveryFormat: form.deliveryFormat,
      status: "PENDING",
      archived: false,
      submittedAt: new Date().toISOString(),
      version: 1, statusReason: null, rescheduleReason: null,
      hardcopyCollectedAt: null, hardcopyCollectedBy: null, hardcopyCollectedName: null,
    };

    let uploadedSchoolIdPath: string | null = null;
    const supportingUploads:{id:string;requirement_id:string;storage_path:string}[]=[];
    try {
      const previous=await requireSupabase().from('appointment_requests').select('reference').eq('reference',request.reference).maybeSingle();
      if(previous.error)throw new Error('Could not confirm the request reference. Try again when connected.');
      if(previous.data){setSubmittedReference(request.reference);setSubmitted(true);return;}
      uploadedSchoolIdPath = await uploadSchoolIdImage(idImage, resident.id, request.reference);
      request.schoolIdImagePath = uploadedSchoolIdPath;
      for(const requirement of supportingRequirements){const file=supportingFiles[requirement.id];if(!file){if(requirement.required)throw new Error(`Upload ${requirement.title} before submitting.`);continue;}const path=await uploadPrivateFile('request-attachments',`${resident.id}/${request.reference}/${requirement.id}`,file);supportingUploads.push({id:crypto.randomUUID(),requirement_id:requirement.id,storage_path:path});}
      await addAppointmentRequest(request,supportingUploads);
      setSubmittedReference(request.reference);
      setSubmitted(true);
      toast.success("Request submitted for barangay review.");
    } catch (error) {
      const recovered=await Promise.resolve(requireSupabase().from('appointment_requests').select('reference').eq('reference',request.reference).maybeSingle()).catch(()=>({data:null}));
      if(recovered.data){setSubmittedReference(request.reference);setSubmitted(true);toast.success('Your request was saved.');return;}
      for(const upload of supportingUploads)await removeUnusedPrivateFile('request-attachments',upload.storage_path);
      if (uploadedSchoolIdPath) {
        try {
          await removeSchoolIdImage(uploadedSchoolIdPath);
        } catch (cleanupError) {
          console.error("Unable to remove the unsubmitted ID image.", cleanupError);
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
      toast.error("The saved request could not be found in your account.");
      return;
    }
    const receipt = [
      "BARANGAY LAGASIT - REQUEST REFERENCE BACKUP",
      `Reference: ${request.reference}`,
      `Document: ${request.requestType}`,
      `Appointment: ${format(new Date(`${request.date}T00:00:00`), "MMMM d, yyyy")} · ${request.timeSlot}`,
      `Status: ${request.status}`,
      `Submitted: ${manilaTime(request.submittedAt)} (Asia/Manila)`,
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
        <div className="w-full bg-white p-5 text-center sm:p-10" style={{ border: "1px solid #c4c0b9", maxWidth: 420 }}>
          <div
            className="w-14 h-14 flex items-center justify-center text-2xl text-white mx-auto mb-5"
            style={{ background: "#0f0e0c" }}
          >
            ✓
          </div>
          <div className="text-xs font-bold tracking-[0.2em] mb-3" style={{ color: "#61645f" }}>
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
            Your request is saved to your account and has been submitted to Barangay staff for review.
          </p>
          {(form.deliveryFormat === "Softcopy" || form.deliveryFormat === "Both") && (
            <p className="text-sm mb-8 leading-relaxed" style={{ color: "#6e6b65" }}>
              You requested a softcopy. Staff will email the completed PDF to your registered address. You can also download it from your dashboard once it is saved.
            </p>
          )}
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
                idSelectionVersion.current++;setIdImage(null);setIdConsent(false);setCheckingIdImage(false);
                setSupportingFiles({});submissionReference.current=`BRG-${todayInManila().slice(0,4)}-${crypto.randomUUID().replaceAll('-','').slice(0,12).toUpperCase()}`;
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
        <div className="text-xs font-bold tracking-[0.2em] text-[#6a766e]">
          STEP {step} / 4
        </div>
      </div>

      <div className="flex flex-col gap-4 md:flex-row md:gap-6">
        <StepIndicator current={step} />

        {/* Content card */}
        <div className="flex-1 bg-white" style={{ border: "1px solid #c4c0b9" }}>
          {/* Step title */}
          <div
            className="px-4 py-4 sm:px-7"
            style={{ background: "#f5f3f0", borderBottom: "1px solid #c4c0b9" }}
          >
            <span className="text-xs font-bold tracking-[0.15em]">
              STEP {step}: {steps[step - 1].label.toUpperCase()}
            </span>
          </div>

          <div className="p-4 sm:p-7">
            {configuration&&form.requestType&&!selectedService&&<div role="alert" className="mb-4 rounded border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950"><p>The selected service is no longer available. Choose an available document.</p><button type="button" className="mt-2 min-h-11 rounded border px-3 font-semibold" onClick={()=>setStep(2)}>Choose another document</button></div>}
            {settingsError && <div role="alert" className="mb-4 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-800"><p>{settingsError}</p><button type="button" onClick={() => setReloadSettings(value => value + 1)} className="mt-2 min-h-11 rounded border border-red-200 px-3">Retry booking information</button></div>}
            <p id="booking-validation" role={validationError?"alert":undefined} className={validationError?"rounded border border-red-200 p-3 text-sm text-red-900":"sr-only"}>{validationError?.message??"Complete required fields. ID number: up to 120 characters. Purpose: up to 2000 characters."}</p>
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
                    <label htmlFor={'booking-'+f.key} className={labelCls}>
                      {f.label}{" "}
                      <span style={{ color: "#b91c1c" }}>*</span>
                    </label>
                    <input id={'booking-'+f.key} maxLength={f.key==='fullName'?200:500} aria-describedby="booking-validation" aria-invalid={validationError?.field===f.key}
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
                  <label htmlFor="booking-validIdType" className={labelCls}>
                    VALID ID TYPE <span style={{ color: "#b91c1c" }}>*</span>
                  </label>
                  <select id="booking-validIdType" aria-describedby="booking-validation" aria-invalid={validationError?.field==='validIdType'}
                    required
                    value={form.validIdType}
                    onChange={event => {
                      setForm(previous=>({...previous,validIdType:event.target.value,validIdNumber:''}));
                      idSelectionVersion.current++;setIdImage(null);setIdConsent(false);setCheckingIdImage(false);
                    }}
                    className={inputCls}
                    style={inputStyle}
                  >
                    <option value="">Select the ID you will attach</option>
                    {validIdTypes.map(idType => <option key={idType} value={idType}>{idType}</option>)}
                  </select>
                </div>
                <div>
                  <label htmlFor="booking-validIdNumber" className={labelCls}>
                    ID NUMBER <span style={{ color: "#b91c1c" }}>*</span>
                  </label>
                  <input id="booking-validIdNumber" aria-describedby="booking-validation" aria-invalid={validationError?.field==='validIdNumber'}
                    required
                    maxLength={120} value={form.validIdNumber}
                    onChange={event => set("validIdNumber", event.target.value)}
                    placeholder="Enter the number shown on your ID"
                    className={inputCls}
                    style={inputStyle}
                  />
                </div>
                  <div className="space-y-3 rounded border border-[#d9e2da] bg-[#f7faf7] p-4" aria-label="Required ID attachment">
                    <label className="grid gap-2 text-sm font-bold text-[#34483a]">
                      Attach a photo of your valid ID <span className="text-red-700">*</span>
                      <input
                        required
                        key={form.validIdType}
                        type="file"
                        aria-label="Attach a photo of your ID"
                        accept="image/jpeg,image/png,image/webp"
                        disabled={checkingIdImage}
                        onChange={async event => {
                          const input=event.currentTarget,file=input.files?.[0]??null;
                          const selection=++idSelectionVersion.current;
                          setIdImage(null);setIdConsent(false);
                          if(!file){setCheckingIdImage(false);return;}
                          setCheckingIdImage(true);
                          try{await validateAnnouncementImage(file);if(selection===idSelectionVersion.current)setIdImage(file);}
                          catch(cause){if(selection===idSelectionVersion.current){input.value='';toast.error(cause instanceof Error?cause.message:'Choose a valid ID image.');}}
                          finally{if(selection===idSelectionVersion.current)setCheckingIdImage(false);}
                        }}
                        className="min-h-11 w-full rounded border border-[#c9d1ca] bg-white p-2 text-sm file:mr-3 file:min-h-8 file:rounded file:border-0 file:bg-[#123323] file:px-3 file:font-semibold file:text-white"
                      />
                    </label>
                    <p className="text-xs leading-relaxed text-[#53645b]">
                      Required for every ID type. Upload a clear, readable JPG, PNG, or WebP photo, up to 5 MB. Only authorized barangay staff can view it for this request.
                    </p>
                    {checkingIdImage&&<p role="status" className="text-xs text-[#53645b]">Checking ID image…</p>}
                    {idPreview&&<img src={idPreview} alt="Selected ID preview" className="max-h-48 w-full rounded border object-contain"/>}
                    {idImage && (
                      <p className="break-all text-xs font-semibold text-[#34483a]">Selected: {idImage.name}</p>
                    )}
                    <label className="flex items-start gap-2 text-sm leading-relaxed text-[#34483a]">
                      <input
                        type="checkbox"
                        checked={idConsent}
                        onChange={event => setIdConsent(event.target.checked)}
                        className="mt-1 h-4 w-4 accent-[#123323]"
                      />
                      <span>I confirm this ID belongs to me and allow authorized barangay staff to review this image for this appointment.</span>
                    </label>
                  </div>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-5 max-w-lg">
                <p className="text-sm leading-relaxed" style={{ color: "#53645b" }}>
                  Select the type of document you need and briefly explain the purpose.
                </p>
                <div>
                  <label htmlFor="booking-requestType" className={labelCls}>
                    REQUEST TYPE <span style={{ color: "#b91c1c" }}>*</span>
                  </label>
                  <select id="booking-requestType" aria-describedby="booking-validation" aria-invalid={validationError?.field==='requestType'}
                    value={form.requestType}
                    onChange={e => {supportingServiceVersion.current++;setSettingsError("");setValidationError(null);setSupportingFiles({});setSupportingErrors({});setCheckingSupporting({});setForm(previous => ({ ...previous, requestType: e.target.value, deliveryFormat: "" }));}}
                    disabled={!configuration}
                    className={inputCls}
                    style={{ ...inputStyle, cursor: "pointer", appearance: "none" }}
                    onFocus={e => (e.currentTarget.style.borderColor = "#0f0e0c")}
                    onBlur={e => (e.currentTarget.style.borderColor = "#c4c0b9")}
                  >
                    <option value="">-- Select document type --</option>
                    {configuration?.services.filter(service => service.active).map(service => <option key={service.request_type} value={service.request_type}>{service.request_type}</option>)}
                  </select>
                </div>
                {selectedService && <div className="space-y-2 rounded border border-[#d9e2da] bg-[#f7faf7] p-3 text-sm text-[#34483a]"><p className="whitespace-pre-wrap break-words"><strong>Requirements:</strong> {selectedService.requirements || "Contact the barangay office to confirm requirements."}</p><p className="break-words"><strong>Booking ID:</strong> {idImage?`${idImage.name} attached in Personal Information`:'A valid ID photo is required for every booking.'}</p><p><strong>Additional document uploads:</strong> {supportingRequirements.length?supportingRequirements.map(item=>`${item.title}${item.required?' (required)':' (optional)'}`).join('; '):'None.'}</p><p><strong>Fee:</strong> {formatServiceFee(selectedService)}</p><p><strong>Processing:</strong> {selectedService.processing_time || "Confirm with the barangay office."}</p></div>}
                {form.requestType === "Other barangay document" && (
                  <div>
                    <label htmlFor="booking-otherRequestType" className={labelCls}>
                      DOCUMENT NAME <span style={{ color: "#b91c1c" }}>*</span>
                    </label>
                    <input id="booking-otherRequestType" aria-describedby="booking-validation" aria-invalid={validationError?.field==='otherRequestType'}
                      required
                      maxLength={200}
                      value={form.otherRequestType}
                      onChange={e => set("otherRequestType", e.target.value)}
                      placeholder="Enter the barangay document you need"
                      className={inputCls}
                      style={inputStyle}
                    />
                  </div>
                )}
                <div>
                  <label htmlFor="booking-purpose" className={labelCls}>
                    PURPOSE <span style={{ color: "#b91c1c" }}>*</span>
                  </label>
                  <textarea id="booking-purpose" aria-describedby="booking-validation" aria-invalid={validationError?.field==='purpose'}
                    maxLength={2000} value={form.purpose}
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
                    {((supportsSoftcopy ? ["Softcopy", "Hardcopy", "Both"] : ["Hardcopy"]) as DeliveryFormat[]).map((formatOption) => (
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
                {form.requestType && !supportsSoftcopy && <p className="text-sm text-[#53645b]">This document is currently available as a hardcopy only.</p>}
                {!!supportingRequirements.length&&<section className="space-y-3 rounded border border-[#c9d1ca] p-3" aria-label="Required supporting documents"><h3 className="font-bold">Supporting documents</h3><p className="text-sm text-[#53645b]">PDF, JPG, PNG, or WebP, up to 5 MB each. Staff will review your uploads.</p>{supportingRequirements.map(requirement=><label key={requirement.id} className="grid gap-1 text-sm font-semibold">{requirement.title} {requirement.required?'(Required)':'(Optional)'}{requirement.instructions&&<span className="whitespace-pre-wrap font-normal">{requirement.instructions}</span>}<input required={requirement.required} aria-invalid={!!supportingErrors[requirement.id]} type="file" accept="application/pdf,image/jpeg,image/png,image/webp" onChange={event=>void selectSupportingFile(requirement.id,event.currentTarget)} className="min-h-11 w-full rounded border border-[#c9d1ca] bg-white px-3 py-2"/>{checkingSupporting[requirement.id]&&<span role="status" className="font-normal">Checking document…</span>}{supportingErrors[requirement.id]&&<span role="alert" className="font-normal text-red-800">{supportingErrors[requirement.id]}</span>}{supportingFiles[requirement.id]&&<span className="break-all font-normal">Selected: {supportingFiles[requirement.id].name}</span>}</label>)}</section>}
              </div>
            )}

            {step === 3 && (
              <div className="space-y-4 max-w-xl">
                <p className="text-sm leading-relaxed" style={{ color: "#53645b" }}>
                  Select an available weekday and appointment time.
                </p>
                <CalendarPicker selected={form.date} weekdays={configuration?.weekdays} closures={configuration?.closures.map(closure => closure.closed_date) ?? []} daysAhead={configuration?.office.booking_days_ahead ?? 90} onSelect={date => setForm(previous => ({ ...previous, date, timeSlot: "" }))} />
                <fieldset>
                  <legend className="mb-2 text-sm font-bold text-[#34483a]">Preferred appointment time</legend>
                  {loadingSlots && <p role="status" className="mb-2 text-sm text-[#53645b]">Checking available places…</p>}
                  {slotError && <p role="alert" className="mb-2 text-sm text-red-800">{slotError}</p>}
                  {!form.date && <p className="mb-2 text-sm text-[#53645b]">Choose a date to see available times.</p>}
                  <div className="grid grid-cols-1 gap-2 min-[400px]:grid-cols-2 sm:grid-cols-3">
                    {availableSlots.map((slot) => { const timeSlot = slot.label; return (
                      <button
                        key={timeSlot}
                        type="button"
                        disabled={!slot.available || loadingSlots}
                        aria-pressed={form.timeSlot === timeSlot}
                        onClick={() => set("timeSlot", timeSlot)}
                        className="min-h-14 border px-2 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50"
                        style={{
                          borderColor: form.timeSlot === timeSlot ? "#123323" : "#c4c0b9",
                          background: form.timeSlot === timeSlot ? "#edf5ee" : "#fff",
                          color: "#123323",
                        }}
                      >
                        <span className="block">{timeSlot}</span>
                        <span className="mt-1 block text-xs font-normal">{slot.available ? `${slot.remaining} places available` : slot.reason}</span>
                      </button>
                    ); })}
                  </div>
                </fieldset>
                {form.date && (
                  <div
                    className="px-5 py-3.5"
                    style={{ background: "#f5f3f0", border: "1px solid #c4c0b9" }}
                  >
                    <div className="text-xs font-bold tracking-[0.1em]">
                      SELECTED: {format(form.date, "MMMM d, yyyy (EEEE)").toUpperCase()}
                    </div>
                    <div className="text-xs mt-1" style={{ color: "#6e6b65" }}>
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
                    <span className="text-xs font-bold tracking-[0.16em]">REQUEST_SUMMARY (READ-ONLY)</span>
                  </div>
                  {[
                    { label: "FULL NAME", value: form.fullName },
                    { label: "ADDRESS", value: form.address },
                    { label: "VALID ID", value: `${form.validIdType} · ${form.validIdNumber}` },
                    { label: "ID ATTACHMENT", value: idImage?.name??"Missing ID attachment" },
                    { label: "REQUEST TYPE", value: form.requestType === "Other barangay document" ? form.otherRequestType.trim() : form.requestType },
                    { label: "SERVICE FEE", value: selectedService?formatServiceFee(selectedService):'Confirm with the barangay office.' },
                    { label: "ADDITIONAL FILES", value: supportingRequirements.map(item=>`${item.title}: ${supportingFiles[item.id]?.name??(item.required?'Missing':'Not attached')}`).join('; ')||'None required' },
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
                        className="text-xs font-bold tracking-[0.14em] flex-shrink-0 pt-0.5"
                        style={{ width: 120, color: "#61645f" }}
                      >
                        {row.label}
                      </div>
                      <div className="min-w-0 break-words text-xs font-bold [overflow-wrap:anywhere]" style={{ color: "#bf6318" }}>{row.value}</div>
                    </div>
                  ))}
                </div>
                <div className="px-5 py-4" style={{ background: "#fdf7f0", border: "1px solid #e8c99a" }}>
                  <p className="text-xs leading-relaxed" style={{ color: "#6e6b65" }}>
                    ⚠ By submitting, you confirm that all information provided is accurate. False declarations are subject to penalties under applicable laws.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Nav */}
          <div
            className="flex flex-col gap-2 px-4 py-5 sm:flex-row sm:justify-between sm:px-7"
            style={{ borderTop: "1px solid #c4c0b9" }}
          >
            <button
              onClick={() => setStep(s => (s - 1) as Step)}
              disabled={step === 1}
              className="flex min-h-11 items-center justify-center gap-2 px-4 py-2.5 text-sm font-bold transition-all disabled:opacity-30"
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
                className="flex min-h-11 items-center justify-center gap-2 px-4 py-2.5 text-sm font-bold text-white transition-opacity disabled:opacity-35"
                style={{ background: "#0f0e0c" }}
              >
                NEXT <ChevronRight className="w-3.5 h-3.5" />
              </button>
            ) : (
              <button
                disabled={submitting}
                onClick={submitRequest}
                className="flex min-h-12 items-center justify-center gap-2 px-4 py-2.5 text-sm font-bold text-white transition-opacity hover:opacity-80"
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
