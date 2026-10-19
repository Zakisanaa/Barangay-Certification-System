import ListTools,{requestSorts} from './ListTools';
import LoadFeedback from './LoadFeedback';
import {manilaTime} from '../manilaTime';
import { useEffect, useMemo, useRef, useState } from "react";
import { FileText, Clock, Users, CheckCircle2, Eye, Check, X, Archive, RotateCcw, Search } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, ResponsiveContainer,
  Tooltip, TooltipProps,
} from "recharts";
import ListPager from './ListPager';
import TransactionChat from "./TransactionChat";
import { toast } from "sonner";
import { ResidentAccount } from "../residentAuth";
import CertificateDelivery from "./CertificateDelivery";
import RequestHistory from "./RequestHistory";
import AppointmentActions from "./AppointmentActions";
import SupportingDocuments from './SupportingDocuments';
import ResidentTransactionRecords from './ResidentTransactionRecords';
import RequestWorkflowActions from './RequestWorkflowActions';
import type {WorkflowNavigate} from '../workflowNavigation';
import { canManage } from '../access';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "./ui/dialog";
import { format, getMonth, getYear, parseISO } from "date-fns";
import {
  getAppointmentRequestPage,getRequestSummary,AppointmentRequest,
  getAppointmentRequests,
  getAppointmentRequest,
  getSchoolIdImageUrl,
  sendResidentNotification,
  subscribeAppointmentRequests,
  setAppointmentArchived,
  updateAppointmentStatus,
  REQUEST_STATUSES,
} from "../portalData";

type FilterStatus = "ALL" | AppointmentRequest["status"];
type ActiveTab = "verification" | "analytics";
const STATUS_CONFIG: Record<AppointmentRequest["status"], { bg: string; color: string; border?: string }> = {
  APPROVED: { bg: "#ecfdf3", color: "#166534" },
  PENDING: { bg: "#fffbeb", color: "#92400e" },
  COMPLETED: { bg: "#f1f5f9", color: "#334155" },
  REJECTED: { bg: "#fef2f2", color: "#991b1b" },
  CANCELLED: { bg: "#f1f5f9", color: "#475569" },
  NO_SHOW: { bg: "#fff7ed", color: "#9a3412" },
  EXPIRED: { bg: "#f1f5f9", color: "#475569" },
};

function SchoolIdImage({ path }: { path: string }) {
  const [url, setUrl] = useState("");const [revision,setRevision]=useState(0);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    let active = true;
    void getSchoolIdImageUrl(path).then(
      (signedUrl) => { if (active) setUrl(signedUrl); },
      (error: unknown) => {
        console.error("Unable to open resident ID image.", error);
        if (active) setErrorMessage(error instanceof Error ? error.message : "Unable to load the private image.");
      },
    );
    return () => { active = false; };
  }, [path,revision]);

  return <div className="space-y-2"><button type="button" className="min-h-11 rounded border px-3 text-sm font-semibold" onClick={()=>{setErrorMessage('');setUrl('');setRevision(value=>value+1);}}>Refresh ID image link</button>{errorMessage?<p role="alert" className="text-sm text-red-900">{errorMessage}</p>:!url?<p role="status" className="text-sm">Loading ID image…</p>:<a href={url} target="_blank" rel="noreferrer"><img src={url} onError={()=>setErrorMessage('This private link expired or the image could not load. Refresh the ID image link to retry.')} alt="Resident-submitted ID" className="max-h-64 w-full rounded border bg-[#f7faf7] object-contain"/><span className="text-sm underline">Open image in a new tab</span></a>}<p className="text-xs text-[#53645b]">Private links expire after five minutes. Refresh before opening an older link.</p></div>;
}

function DetailModal({
  request,
  onClose,
  resident,
  onSendSoftcopy,
  sendingSoftcopy,
  onUpdated,
  onWorkflow,
}: {
  request: AppointmentRequest;
  onClose: () => void;
  resident: ResidentAccount;
  onSendSoftcopy: (templateName: string, pdfBase64: string, deliveryId: string) => Promise<void>;
  sendingSoftcopy: boolean;
  onUpdated: (request: AppointmentRequest) => void;
  onWorkflow?:WorkflowNavigate;
}) {
  const previousFocus=useRef(document.activeElement as HTMLElement|null);
  const wantsSoftcopy = request.deliveryFormat === "Softcopy" || request.deliveryFormat === "Both";

  return (
    <Dialog open onOpenChange={open=>{if(!open&&!sendingSoftcopy)onClose();}}><DialogContent showCloseButton={false} aria-labelledby="request-details-title" className="max-h-[90dvh] overflow-y-auto p-0 sm:max-w-[640px]" onEscapeKeyDown={event=>{if(sendingSoftcopy)event.preventDefault();}} onInteractOutside={event=>{if(sendingSoftcopy)event.preventDefault();}} onCloseAutoFocus={event=>{event.preventDefault();previousFocus.current?.focus();}}>
      <DialogDescription className="sr-only">Review the resident's saved request, identification, history, and available staff actions.</DialogDescription>
        <div
          className="sticky top-0 z-10 flex items-center justify-between px-4 py-3.5 sm:px-6"
          style={{ background: "#f5f3f0", borderBottom: "1px solid #c4c0b9" }}
        >
          <DialogTitle id="request-details-title" className="text-base font-bold">Request details</DialogTitle>
          <button
            type="button"
            onClick={onClose}
            disabled={sendingSoftcopy}
            aria-label="Close request details"
            className="flex h-10 w-10 items-center justify-center rounded-md transition-opacity hover:opacity-60 disabled:cursor-not-allowed disabled:opacity-50"
            style={{ color: "#6e6b65" }}
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="space-y-4 px-4 py-5 sm:px-6">
          {[
            { label: "REFERENCE", value: request.reference, amber: true },
            { label: "RESIDENT", value: request.fullName, amber: true },
            { label: "ADDRESS", value: request.address, amber: false },
            { label: "VALID ID", value: request.voterId, amber: false },
            { label: "REQUEST TYPE", value: request.requestType, amber: false },
            { label: "APPOINTMENT", value: `${format(parseISO(request.date), "MMMM d, yyyy")} · ${request.timeSlot}`, amber: true },
            { label: "DOCUMENT FORMAT", value: request.deliveryFormat, amber: false },
            { label: "PURPOSE",       value: request.purpose, amber: false },
            { label: "STATUS",        value: request.status,    amber: true },
          ].map(row => (
            <div key={row.label} className="flex gap-3 sm:gap-6">
              <div
                className="shrink-0 pt-0.5 text-xs font-semibold"
                style={{ width: 110, color: "#61645f" }}
              >
                {row.label}
              </div>
              <div
                className="min-w-0 break-words text-sm font-semibold"
                style={{ color: row.amber ? "#bf6318" : "#0f0e0c" }}
              >
                {row.value}
              </div>
            </div>
          ))}
          {request.idAcknowledgedAt&&<p className="text-xs text-[#53645b]">ID review acknowledged {new Date(request.idAcknowledgedAt).toLocaleString('en-PH',{timeZone:'Asia/Manila'})} · {request.idAcknowledgmentVersion}</p>}
          {request.schoolIdImagePath && (canManage(resident,'requests')||canManage(resident,'residents')) && (
            <section className="space-y-2 border-t border-[#e3e8e3] pt-4">
              <h3 className="text-sm font-bold text-[#122d1f]">Attached ID</h3>
              <SchoolIdImage path={request.schoolIdImagePath} />
            </section>
          )}
          {wantsSoftcopy && canManage(resident,'certificates') && (
            <CertificateDelivery
              key={request.reference}
              request={request}
              onSend={onSendSoftcopy}
              sending={sendingSoftcopy}
            />
          )}
          {request.rejectionReason && <p className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-800"><strong>Reason for rejection:</strong> {request.rejectionReason}</p>}
          {request.statusReason && <p className="rounded border border-[#d9e2da] p-3 text-sm"><strong>Status details:</strong> {request.statusReason}</p>}
          {canManage(resident,'requests')&&<AppointmentActions request={request} staff onUpdated={onUpdated} />}
          {canManage(resident,'requests')&&<SupportingDocuments active={!request.archived&&['PENDING','APPROVED'].includes(request.status)} reference={request.reference} ownerId={request.ownerId} staff/>}
          {onWorkflow&&<RequestWorkflowActions reference={request.reference} ownerId={request.ownerId} account={resident} onNavigate={onWorkflow} disabled={sendingSoftcopy}/>}
          <ResidentTransactionRecords reference={request.reference}/>
          <RequestHistory reference={request.reference} staff certificateStaff={canManage(resident,"certificates")} />
          {canManage(resident,'requests')&&<TransactionChat reference={request.reference} resident={resident} />}
        </div>
    </DialogContent></Dialog>
  );
}

const monoTick = { fontSize: 12, fontFamily: "'Space Mono', monospace", fill: "#61645f" };

function ChartTooltipContent({ active, payload, label }: TooltipProps<number, string>) {
  if (!active || !payload?.length) return null;
  return (
    <div
      className="px-3 py-2 text-xs font-bold"
      style={{ background: "#0f0e0c", color: "#fff", fontFamily: "'Space Mono', monospace" }}
    >
      {label}: {payload[0].value}
    </div>
  );
}

export default function AdminPage({ resident,focusReference,onWorkflow }: { resident: ResidentAccount;focusReference?:string;onWorkflow?:WorkflowNavigate }) {
  const [loading,setLoading]=useState(true);
  const [page,setPage]=useState(0),[matching,setMatching]=useState(0),[revision,setRevision]=useState(0),[loadError,setLoadError]=useState('');
  const [summary,setSummary]=useState({total:0,pending:0,approved:0,served:0,statuses:{} as Record<string,number>,months:{} as Record<string,number>,types:[] as {name:string;count:number}[]});
  const [requests, setRequests] = useState<AppointmentRequest[]>([]);
  const [filter, setFilter] = useState<FilterStatus>("ALL");
  const [showArchivedRequests, setShowArchivedRequests] = useState(false);
  const [tab, setTab] = useState<ActiveTab>("verification");
  const [selectedReq, setSelectedReq] = useState<AppointmentRequest | null>(null);
  const [sendingSoftcopyReference, setSendingSoftcopyReference] = useState<string | null>(null);
  const [requestQuery, setRequestQuery] = useState("");
  const [sort,setSort]=useState("newest");
  const [appointmentDateFilter, setAppointmentDateFilter] = useState("");
  const [updatingReference, setUpdatingReference] = useState<string | null>(null);
  const [rejectingRequest, setRejectingRequest] = useState<AppointmentRequest | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  useEffect(()=>{if(!focusReference)return;let active=true;void getAppointmentRequest(focusReference).then(row=>{if(active)setSelectedReq(row);},()=>{if(active)toast.error('Could not open that request. Refresh its details.');});return()=>{active=false;};},[focusReference]);

  useEffect(() => {
    let active = true;
    let refreshGeneration=0;
    const refresh = async () => {
      const generation=++refreshGeneration;setLoading(true);
      try {
        const [loaded,totals]=await Promise.all([getAppointmentRequestPage({page,sort,query:requestQuery,archived:showArchivedRequests,status:filter==='ALL'?null:filter,date:appointmentDateFilter}),getRequestSummary()]);
        const detail=selectedReq?.reference?await getAppointmentRequest(selectedReq.reference).catch(()=>null):null;
        if(active&&generation===refreshGeneration){if(selectedReq)setSelectedReq(detail);setRequests(loaded.rows);setMatching(loaded.total);setSummary(totals);setLoadError('');}
      } catch (error) {
        console.error("Unable to load staff appointment requests.", error);
        if(active&&generation===refreshGeneration)setLoadError(error instanceof Error?error.message:"Could not load requests.");
      }finally{if(active&&generation===refreshGeneration)setLoading(false);}
    };
    void refresh();
    const unsubscribe = subscribeAppointmentRequests(() => { void refresh(); });
    return () => { active = false; unsubscribe(); };
  }, [page,sort,requestQuery,showArchivedRequests,filter,appointmentDateFilter,revision,selectedReq?.reference]);
  useEffect(()=>setPage(0),[sort,requestQuery,showArchivedRequests,filter,appointmentDateFilter]);

  const total=summary.total,pending=summary.pending,approved=summary.approved,residentCount=summary.served;
  const filtered=requests;

  const updateStatus = async (ref: string, status: AppointmentRequest["status"], reason?: string): Promise<boolean> => {
    if (updatingReference) return false;
    setUpdatingReference(ref);
    try {
      const current = requests.find(request => request.reference === ref);
      if (!current) throw new Error("Refresh the request before changing it.");
      const updated = await updateAppointmentStatus(current, status, reason);
      setRequests(previous => previous.map(request => request.reference === ref ? updated : request));
      toast.success(`Request marked ${status.toLowerCase().replaceAll("_", " ")}. Email update queued.`);
      setRevision(value=>value+1);return true;
    } catch (error) {
      console.error("Unable to update appointment request status.", error);
      toast.error(error instanceof Error ? error.message : "Could not update request.");
      return false;
    } finally {
      setUpdatingReference(null);
    }
  };

  const sendSoftcopy = async (reference: string, templateName: string, pdfBase64: string, deliveryId: string) => {
    setSendingSoftcopyReference(reference);
    try {
      await sendResidentNotification({
        type: "appointment_pdf",
        reference,
        templateName,
        pdfBase64,
        deliveryId,
      });
      toast.success("Certificate saved. Email submitted for delivery; follow its status in request history.");
    } catch (error) {
      console.error("Unable to email the resident's completed certificate PDF.", error);
      toast.error(error instanceof Error ? error.message : "Could not send the certificate PDF.");
      throw error;
    } finally {
      setSendingSoftcopyReference(null);
    }
  };

  const toggleRequestArchive = async (request: AppointmentRequest) => {
    try {
      await setAppointmentArchived(request.reference, !request.archived);
      setRequests(previous=>previous.filter(item=>item.reference!==request.reference));setRevision(value=>value+1);
      toast.success(request.archived ? "Request restored." : "Request moved to the archive.");
    } catch (error) {
      console.error("Unable to update appointment archive status.", error);
      toast.error(error instanceof Error ? error.message : "Could not update archive.");
    }
  };

  const monthlyData=Array.from({length:12},(_,month)=>({month:format(new Date(2026,month,1),'MMM'),count:summary.months[String(month+1)]??0}));
  const typeData=summary.types;

  const breakdown = REQUEST_STATUSES.map((status) => {
    const count=summary.statuses[status]??0;
    return { label: status, count, pct: total ? Math.round((count / total) * 100) : 0 };
  });

  return (
    <div className="min-h-full bg-[#f4f7f4] p-4 md:p-7" style={{ fontFamily: "'Segoe UI', 'Arial', sans-serif" }}>
      <LoadFeedback loading={loading} error={loadError} onRetry={()=>setRevision(value=>value+1)} label="requests"/>
      {selectedReq && (
        <DetailModal
          request={requests.find(request => request.reference === selectedReq.reference) ?? selectedReq}
          resident={resident}
          onClose={() => setSelectedReq(null)}
          onSendSoftcopy={(templateName, pdfBase64, deliveryId) => sendSoftcopy(selectedReq.reference, templateName, pdfBase64, deliveryId)}
          sendingSoftcopy={sendingSoftcopyReference === selectedReq.reference}
          onWorkflow={onWorkflow}
          onUpdated={updated => {setSelectedReq(updated);setRequests(previous => previous.map(request => request.reference === updated.reference ? updated : request));setRevision(value=>value+1);}}
        />
      )}

      <Dialog open={!!rejectingRequest} onOpenChange={open => { if (!open && !updatingReference) setRejectingRequest(null); }}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto bg-white">
          <DialogTitle>Reject request {rejectingRequest?.reference}</DialogTitle>
          <DialogDescription>Explain what the resident needs to correct. This reason will appear in their dashboard and request history.</DialogDescription>
          <form className="space-y-4" onSubmit={event => { event.preventDefault(); if (rejectingRequest && rejectionReason.trim()) void updateStatus(rejectingRequest.reference, "REJECTED", rejectionReason).then(success => { if (success) setRejectingRequest(null); }); }}>
            <label className="grid gap-2 text-sm font-semibold">Reason for rejection<textarea required maxLength={1000} rows={5} value={rejectionReason} disabled={!!updatingReference} onChange={event => setRejectionReason(event.target.value)} className="w-full rounded border border-[#c9d1ca] p-3 text-base" /></label>
            <div className="flex flex-col gap-2 sm:flex-row sm:justify-end"><button type="button" disabled={!!updatingReference} onClick={() => setRejectingRequest(null)} className="min-h-11 rounded border border-[#c9d1ca] px-4 text-sm font-semibold">Cancel</button><button disabled={!!updatingReference || !rejectionReason.trim()} className="min-h-11 rounded bg-red-800 px-4 text-sm font-semibold text-white disabled:opacity-50">{updatingReference ? "Saving…" : "Reject with reason"}</button></div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Header */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4 rounded-lg border border-[#d9e2da] bg-white p-5 md:p-6">
        <div>
          <p className="text-sm font-semibold text-[#53645b]">{manilaTime(new Date(),{weekday:"long",month:"long",day:"numeric",year:"numeric"})}</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-[#122d1f] md:text-3xl">Admin dashboard</h1>
          <p className="mt-1 text-base text-[#53645b]">Manage resident requests and barangay announcements.</p>
        </div>
        <div className="flex items-center gap-2 rounded-full border border-green-200 bg-green-50 px-3 py-2 text-sm font-semibold text-green-900">
          <span className="h-2.5 w-2.5 rounded-full bg-green-600" aria-hidden="true" />
          Staff workspace
        </div>
      </div>

      {/* Stats */}
      <div className="mb-7 grid gap-3 md:gap-4" style={{gridTemplateColumns:'repeat(auto-fit,minmax(min(100%, 190px),1fr))'}}>
        {[
          { label: "Total requests", value: total, Icon: FileText },
          { label: "Awaiting review", value: pending, Icon: Clock },
          { label: "Residents served", value: residentCount, Icon: Users },
          { label: "Approved", value: approved, Icon: CheckCircle2 },
        ].map(({ label, value, Icon }) => (
          <div
            key={label}
            className="flex min-w-0 items-start gap-3.5 rounded-lg border border-[#d9e2da] bg-white px-5 py-5 shadow-sm"
          >
            <div
              className="w-9 h-9 flex items-center justify-center flex-shrink-0"
              style={{ background: "#edf5ee", border: "1px solid #d9e2da" }}
            >
              <Icon className="w-5 h-5" style={{ color: "#123323" }} />
            </div>
            <div className="min-w-0 break-words">
              <div className="text-sm font-semibold mb-2" style={{ color: "#53645b" }}>{label}</div>
              <div className="text-4xl font-bold tracking-tight leading-none">{value}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="mb-4 flex flex-wrap gap-2 rounded-lg border border-[#d9e2da] bg-white p-2">
        {[
          { id: "verification" as ActiveTab, label: "Requests" },
          { id: "analytics" as ActiveTab, label: "Analytics" },
        ].map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className="min-h-11 rounded-md px-4 py-2 text-sm font-semibold transition-all"
            style={
              tab === t.id
                ? { background: "#123323", color: "#fff" }
                : { color: "#53645b", background: "transparent" }
            }
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── VERIFICATION ── */}
      {tab === "verification" && (
        <div className="overflow-hidden rounded-lg border border-[#d9e2da] bg-white shadow-sm">
          <div className="flex flex-wrap gap-2 border-b border-[#d9e2da] p-3">
            {([false, true] as const).map((archived) => (
              <button
                key={String(archived)}
                type="button"
                onClick={() => setShowArchivedRequests(archived)}
                aria-pressed={showArchivedRequests === archived}
                className={`flex min-h-10 items-center gap-2 rounded px-4 text-sm font-bold ${showArchivedRequests === archived ? "bg-[#123323] text-white" : "border border-[#c9d1ca] text-[#53645b]"}`}
              >
                {archived ? <Archive className="h-4 w-4" /> : <FileText className="h-4 w-4" />}
                {archived ? "Archive" : "Active requests"}
              </button>
            ))}
          </div>
          <div className="p-4"><ListTools label="requests" query={requestQuery} onQuery={setRequestQuery} sort={sort} onSort={setSort} options={requestSorts}/></div>
          {/* Filter bar */}
          <div className="grid gap-3 border-b border-[#d9e2da] bg-white p-4 sm:grid-cols-[1fr_auto]">
            <label className="block"><span className="mb-1 block text-sm font-semibold">Filter by appointment date</span><input type="date" value={appointmentDateFilter} onChange={event => setAppointmentDateFilter(event.target.value)} className="min-h-11 w-full rounded border border-[#c9d1ca] px-3 text-base" /></label>
            <button type="button" onClick={() => { setRequestQuery(""); setAppointmentDateFilter(""); setFilter("ALL"); }} className="min-h-11 rounded border border-[#c9d1ca] px-3 text-sm font-semibold">Clear filters</button>
          </div>
          <div
            className="flex flex-wrap items-center gap-2.5 px-4 py-4 md:px-5"
            style={{ background: "#f7faf7", borderBottom: "1px solid #d9e2da" }}
          >
            <span className="text-sm font-semibold mr-1" style={{ color: "#53645b" }}>
              Filter:
            </span>
            {(["ALL", ...REQUEST_STATUSES] as FilterStatus[]).map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className="min-h-10 rounded-md px-3 py-1.5 text-sm font-semibold transition-all"
                style={
                  filter === f
                    ? { background: "#123323", color: "#fff", border: "1px solid #123323" }
                    : { background: "#fff", color: "#53645b", border: "1px solid #c9d1ca" }
                }
              >
                {f}
              </button>
            ))}
            <span className="ml-auto text-sm font-semibold" style={{ color: "#53645b" }}>
              {matching} {matching === 1 ? "request" : "requests"}
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="responsive-table w-full"><caption>{showArchivedRequests?"Archived appointment requests":"Appointment requests - review and processing"}</caption>
              <thead>
                <tr style={{ borderBottom: "1px solid #d9e2da", background: "#f7faf7" }}>
                  {["Reference", "Resident", "Request type", "Appointment", "Submitted", "Status", "Actions"].map(h => (
                    <th
                      key={h}
                      className="px-5 py-3 text-left text-sm font-bold"
                      style={{ color: "#53645b" }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {!loading&&!loadError&&!filtered.length && (
                  <tr>
                    <td colSpan={7} className="px-6 py-14 text-center">
                      <FileText className="mx-auto h-9 w-9 text-[#53645b]" />
                      <p className="mt-3 text-lg font-semibold text-[#122d1f]">No requests to show</p>
                      <p className="mt-1 text-sm text-[#53645b]">
                        {showArchivedRequests ? "No archived requests." : filter === "ALL" ? "New resident requests will appear here." : `There are no ${filter.toLowerCase()} requests.`}
                      </p>
                    </td>
                  </tr>
                )}
                {filtered.map((req, i) => {
                  const s = STATUS_CONFIG[req.status];
                  return (
                    <tr
                      key={req.reference}
                      style={{ borderBottom: i < filtered.length - 1 ? "1px solid #e8e5e0" : "none" }}
                      onMouseEnter={e => (e.currentTarget.style.background = "#faf9f7")}
                      onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                    >
                      <td data-label="Reference" className="px-5 py-4">
                        <span className="text-sm font-bold text-[#123323]">{req.reference}</span>
                      </td>
                      <td data-label="Resident" className="px-5 py-4">
                        <span className="text-sm font-semibold text-[#122d1f]">{req.fullName}</span>
                      </td>
                      <td data-label="Request type" className="px-5 py-4">
                        <span className="text-sm text-[#34483a]">{req.requestType}</span>
                      </td>
                      <td data-label="Appointment" className="px-5 py-4">
                        <span className="text-sm font-semibold text-[#34483a]">
                          {format(parseISO(req.date), "MMM d, yyyy")}
                        </span>
                        <span className="mt-1 block text-xs text-[#53645b]">{req.timeSlot}</span>
                      </td>
                      <td data-label="Submitted" className="px-5 py-4">
                        <span className="text-sm text-[#53645b]">{manilaTime(req.submittedAt,{dateStyle:'medium'})}</span>
                      </td>
                      <td data-label="Status" className="px-5 py-4">
                        <span
                          className="inline-block rounded-full px-3 py-1.5 text-xs font-bold"
                          style={{ background: s.bg, color: s.color, border: s.border || "none" }}
                        >
                          {req.status}
                        </span>
                      </td>
                      <td data-label="Actions" className="px-5 py-4">
                        <div className="flex gap-2 flex-wrap">
                          <button
                            onClick={() => setSelectedReq(req)}
                            className="flex min-h-9 items-center gap-1.5 rounded border border-[#c9d1ca] px-3 py-1.5 text-sm font-semibold text-[#34483a] transition-all"
                            style={{ border: "1.5px solid #c4c0b9" }}
                            onMouseEnter={e => (e.currentTarget.style.borderColor = "#0f0e0c")}
                            onMouseLeave={e => (e.currentTarget.style.borderColor = "#c4c0b9")}
                          >
                            <Eye className="w-3 h-3" /> VIEW
                          </button>
                          <button
                            type="button"
                            onClick={() => void toggleRequestArchive(req)}
                            disabled={!canManage(resident,'requests')||(!req.archived && ["PENDING", "APPROVED"].includes(req.status))}
                            title={!req.archived && ["PENDING", "APPROVED"].includes(req.status) ? "Resolve or cancel the active request before archiving." : undefined}
                            className="flex min-h-9 items-center gap-1.5 rounded border border-[#c9d1ca] px-3 py-1.5 text-sm font-semibold text-[#34483a] hover:bg-[#f7faf7]"
                          >
                            {req.archived ? <RotateCcw className="w-3 h-3" /> : <Archive className="w-3 h-3" />}
                            {req.archived ? "RESTORE" : "ARCHIVE"}
                          </button>
                          {canManage(resident,'requests') && !req.archived && req.status === "PENDING" && (
                            <>
                              <button
                                disabled={!!updatingReference}
                                onClick={() => void updateStatus(req.reference, "APPROVED")}
                                className="flex min-h-9 items-center gap-1.5 rounded border border-green-300 bg-green-50 px-3 py-1.5 text-sm font-semibold text-green-900 transition-all hover:bg-green-100"
                              >
                                <Check className="w-3 h-3" /> APPROVE
                              </button>
                              <button
                                disabled={!!updatingReference}
                                onClick={() => { setRejectingRequest(req); setRejectionReason(""); }}
                                className="flex min-h-9 items-center gap-1.5 rounded border border-red-200 px-3 py-1.5 text-sm font-semibold text-red-800 transition-all hover:bg-red-50"
                              >
                                <X className="w-3 h-3" /> REJECT
                              </button>
                            </>
                          )}
                          {canManage(resident,'requests') && !req.archived && req.status === "APPROVED" && (
                            <button
                              disabled={!!updatingReference}
                              onClick={() => void updateStatus(req.reference, "COMPLETED")}
                              className="flex min-h-9 items-center gap-1.5 rounded border border-blue-200 bg-blue-50 px-3 py-1.5 text-sm font-semibold text-blue-900 transition-all hover:bg-blue-100"
                            >
                              <CheckCircle2 className="w-4 h-4" /> Complete
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
              <ListPager page={page} total={matching} onPage={setPage}/>
          </div>
        </div>
      )}

      {tab === "analytics" && (
        <div
          className="space-y-5 rounded-lg border border-[#d9e2da] bg-white p-4 shadow-sm md:p-6"
        >
          <div className="flex flex-wrap items-end justify-between gap-2">
            <div>
              <h2 className="text-xl font-bold text-[#122d1f]">Request analytics</h2>
              <p className="mt-1 text-sm text-[#53645b]">Based on appointment requests currently recorded in this system.</p>
            </div>
            <p className="text-sm font-semibold text-[#53645b]">Year: {new Date().getFullYear()}</p>
          </div>

          {total === 0 ? (
            <div className="rounded-lg border border-dashed border-[#c9d1ca] bg-[#f7faf7] px-5 py-12 text-center">
              <FileText className="mx-auto h-9 w-9 text-[#758179]" />
              <h3 className="mt-3 text-lg font-bold text-[#122d1f]">Analytics will appear as requests come in</h3>
              <p className="mt-1 text-sm text-[#53645b]">There are no appointment requests to analyze yet.</p>
            </div>
          ) : (
            <>
              <div className="grid gap-5 lg:grid-cols-2">
                <section className="rounded-lg border border-[#d9e2da] p-4">
                  <h3 className="text-base font-bold text-[#122d1f]">Requests submitted by month</h3>
                  <div className="mt-3 h-[240px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={monthlyData} barSize={22} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
                        <XAxis dataKey="month" tick={monoTick} axisLine={false} tickLine={false} />
                        <YAxis allowDecimals={false} tick={monoTick} axisLine={false} tickLine={false} />
                        <Tooltip content={<ChartTooltipContent />} cursor={{ fill: "rgba(18,51,35,0.06)" }} />
                        <Bar dataKey="count" fill="#24613d" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </section>

                <section className="rounded-lg border border-[#d9e2da] p-4">
                  <h3 className="text-base font-bold text-[#122d1f]">Requests by document type</h3>
                  {typeData.length ? (
                    <div className="mt-3 h-[240px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={typeData} layout="vertical" barSize={18} margin={{ top: 8, right: 12, bottom: 0, left: 8 }}>
                          <XAxis type="number" allowDecimals={false} tick={monoTick} axisLine={false} tickLine={false} />
                          <YAxis dataKey="name" type="category" tick={monoTick} axisLine={false} tickLine={false} width={130} />
                          <Tooltip content={<ChartTooltipContent />} cursor={{ fill: "rgba(18,51,35,0.06)" }} />
                          <Bar dataKey="count" fill="#567a5f" radius={[0, 4, 4, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    <p className="py-12 text-center text-sm text-[#53645b]">No document requests recorded.</p>
                  )}
                </section>
              </div>

              <section className="rounded-lg border border-[#d9e2da]">
                <div className="border-b border-[#d9e2da] bg-[#f7faf7] px-4 py-3">
                  <h3 className="text-base font-bold text-[#122d1f]">Request status overview</h3>
                </div>
                <div className="grid grid-cols-2 divide-x divide-y divide-[#e3e8e3] md:grid-cols-4 md:divide-y-0">
                  {breakdown.map((item) => (
                    <div key={item.label} className="px-4 py-5 text-center">
                      <div className="text-xs font-bold tracking-wide text-[#53645b]">{item.label}</div>
                      <div className="mb-1 mt-2 text-3xl font-bold text-[#122d1f]">{item.count}</div>
                      <div className="text-sm text-[#53645b]">{item.pct}% of requests</div>
                    </div>
                  ))}
                </div>
              </section>
            </>
          )}
        </div>
      )}
    </div>
  );
}
