import ListTools,{requestSorts} from './ListTools';
import LoadFeedback from './LoadFeedback';
import {manilaTime} from '../manilaTime';
import { FormEvent, useEffect, useMemo, useState } from "react";
import { CalendarDays, FileCheck2, Search, Copy, Download, ClipboardList, Archive } from "lucide-react";
import { format, parseISO } from "date-fns";
import { toast } from "sonner";
import {
  getAppointmentRequestPage,getAppointmentRequest,AppointmentRequest,
  getAppointmentRequests,
  subscribeAppointmentRequests,
} from "../portalData";
import ListPager from './ListPager';
import TransactionChat from "./TransactionChat";
import RequestHistory from "./RequestHistory";
import SupportingDocuments from './SupportingDocuments';
import ResidentTransactionRecords from './ResidentTransactionRecords';
import AppointmentActions from "./AppointmentActions";
import { ResidentAccount } from "../residentAuth";

type Page = "home" | "chat" | "book" | "dashboard" | "admin" | "schedule" | "concerns" | "fees";

interface DashboardPageProps {
  userName: string;
  userId: string;
  resident: ResidentAccount;
  focusReference?: string;
  focusToken?: string;
  setActivePage: (page: Page) => void;
}

const statusStyle: Record<AppointmentRequest["status"], string> = {
  PENDING: "border-amber-300 bg-amber-50 text-amber-900",
  APPROVED: "border-green-300 bg-green-50 text-green-900",
  COMPLETED: "border-slate-300 bg-slate-100 text-slate-800",
  REJECTED: "border-red-300 bg-red-50 text-red-900",
  CANCELLED: "border-slate-300 bg-slate-50 text-slate-700",
  NO_SHOW: "border-orange-300 bg-orange-50 text-orange-900",
  EXPIRED: "border-slate-300 bg-slate-50 text-slate-700",
};

export default function DashboardPage({ userName, userId, resident, focusReference,focusToken, setActivePage }: DashboardPageProps) {
  const [loading,setLoading]=useState(true);
  const [page,setPage]=useState(0),[total,setTotal]=useState(0),[loadError,setLoadError]=useState(""),[revision,setRevision]=useState(0);
  const [query,setQuery]=useState(""),[sort,setSort]=useState("newest");
  const [reference, setReference] = useState("");
  const [searched, setSearched] = useState(false);
  const [request, setRequest] = useState<AppointmentRequest | null>(null);
  const [allRequests, setAllRequests] = useState<AppointmentRequest[]>([]);
  const [showArchivedRequests, setShowArchivedRequests] = useState(false);
  useEffect(()=>{if(!focusReference)return;let active=true;void getAppointmentRequest(focusReference).then(item=>{if(active&&item.ownerId===userId){setReference(item.reference);setRequest(item);setSearched(true);}}).catch(()=>{if(active)toast.error('This request could not be opened. Refresh your dashboard and try again.');});return()=>{active=false;};},[focusReference,focusToken,userId]);

  useEffect(() => {
    let active = true;
    let refreshGeneration=0;
    const refresh = async () => {
      const generation=++refreshGeneration;setLoading(true);
      try {
        const result=await getAppointmentRequestPage({owner:userId,page,query,sort,archived:showArchivedRequests});const loaded=result.rows;const detail=request?.reference?await getAppointmentRequest(request.reference).catch(()=>null):null;
        if (active&&generation===refreshGeneration) {
          setAllRequests(loaded);setTotal(result.total);setLoadError("");
          setRequest(previous=>previous?.reference===request?.reference?detail:previous);
        }
      } catch (error) {
        console.error("Unable to load resident requests.", error);
        if(active&&generation===refreshGeneration)setLoadError(error instanceof Error?error.message:"Could not load your requests.");
      }finally{if(active&&generation===refreshGeneration)setLoading(false);}
    };
    void refresh();
    const unsubscribe = subscribeAppointmentRequests(() => { void refresh(); });
    return () => { active = false; unsubscribe(); };
  }, [userId,page,query,sort,showArchivedRequests,revision,request?.reference]);

  const savedRequests = useMemo(
    () => [...allRequests]
      .filter((item) => item.archived === showArchivedRequests),
    [allRequests, showArchivedRequests],
  );

  const findRequest = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const normalizedReference = reference.trim().toUpperCase();
    try {
      const foundRequest=await getAppointmentRequest(normalizedReference).catch(()=>null);
      setRequest(foundRequest);
      setRevision(value=>value+1);
      setSearched(true);
    } catch (error) {
      console.error("Unable to search resident requests.", error);
      toast.error(error instanceof Error ? error.message : "Could not check that reference.");
    }
  };

  const showRequest = (savedRequest: AppointmentRequest) => {
    setReference(savedRequest.reference);
    setRequest(savedRequest);
    setSearched(true);
  };

  const copyReference = async (savedReference: string) => {
    try {
      await navigator.clipboard.writeText(savedReference);
      toast.success("Reference number copied.");
    } catch (error) {
      console.error("Unable to copy the request reference.", error);
      toast.error("Could not copy automatically. Please select and copy the reference number.");
    }
  };

  const downloadBackup = async () => {
    try{const backupRequests=(await getAppointmentRequests(userId)).filter(item=>item.archived===showArchivedRequests);
    if (!savedRequests.length) {
      toast.error("There are no saved request references to back up yet.");
      return;
    }

    const backup = {
      title: "Barangay Lagasit request reference backup",
      createdAt: new Date().toISOString(),
      note: "Reference and status summary only. Keep this file private. It is not an official Barangay confirmation.",
      requests: backupRequests.map((savedRequest) => ({
        reference: savedRequest.reference,
        document: savedRequest.requestType,
        appointmentDate: savedRequest.date,
        appointmentTime: savedRequest.timeSlot,
        status: savedRequest.status,
        submittedAt: savedRequest.submittedAt,
      })),
    };
    const file = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(file);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "barangay-request-references-backup.json";
    anchor.click();
    URL.revokeObjectURL(url);
    toast.success("Request reference backup downloaded.");
    }catch(cause){toast.error(cause instanceof Error?cause.message:"Could not download all reference records.");}
  };

  return (
    <div className="min-h-full bg-[#edf1ee] p-4 md:p-7" style={{ fontFamily: "'Segoe UI', 'Arial', sans-serif" }}>
      <div className="mx-auto max-w-4xl">
        <LoadFeedback loading={loading} error={loadError} onRetry={()=>setRevision(value=>value+1)} label="requests"/>
        <header className="mb-6 border-b border-[#c9d1ca] pb-5">
          <p className="text-sm font-bold tracking-wide text-[#53645b]">RESIDENT SERVICES · DASHBOARD</p>
          <h1 className="mt-1 text-3xl font-black text-[#122d1f]">Your resident dashboard</h1>
          <p className="mt-2 text-base leading-relaxed text-[#53645b]">
            Welcome, {userName}. Review your requests and check their latest status.
          </p>
          <button type="button" onClick={()=>setActivePage('fees')} className="mt-3 min-h-11 rounded border border-[#c9d1ca] bg-white px-4 text-sm font-semibold">View fees & receipts</button>
        </header>

        <section className="mb-5 rounded border border-[#c9d1ca] bg-white p-5 md:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-start gap-3">
              <ClipboardList className="mt-1 h-5 w-5 shrink-0 text-[#123323]" />
              <div>
                <h2 className="text-lg font-bold text-[#122d1f]">{showArchivedRequests ? "Archived requests" : "Your saved requests"}</h2>
                <p className="mt-1 text-sm text-[#53645b]">
                  {savedRequests.length
                    ? `${total} request${total === 1 ? "" : "s"} found in your account.`
                    : loading ? "Loading your requests…" : loadError ? "Request list is unavailable. Retry loading requests." : showArchivedRequests ? "No archived requests." : "Requests submitted from your account will appear here so you can retrieve their reference numbers."}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => {setPage(0);setShowArchivedRequests(value => !value);}}
                className="flex min-h-10 items-center gap-2 rounded border border-[#c9d1ca] px-3 text-sm font-bold text-[#123323]"
              >
                <Archive className="h-4 w-4" /> {showArchivedRequests ? "View active" : "View archive"}
              </button>
              {!showArchivedRequests && (
                <button
                  type="button"
                  onClick={downloadBackup}
                  disabled={!savedRequests.length}
                  className="flex min-h-10 items-center gap-2 rounded border border-[#c9d1ca] px-3 text-sm font-bold text-[#123323] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Download className="h-4 w-4" /> Download backup
                </button>
              )}
            </div>
          </div>

          <div className="mt-4"><ListTools label="your requests" query={query} onQuery={value=>{setPage(0);setQuery(value);}} sort={sort} onSort={value=>{setPage(0);setSort(value);}} options={requestSorts.filter(([key])=>!key.startsWith("name_"))}/></div>
          <ListPager page={page} total={total} onPage={setPage}/>
          {savedRequests.length ? (
            <div className="mt-4 divide-y divide-[#e3e8e3] border-y border-[#e3e8e3]">
              {savedRequests.map((savedRequest) => (
                <article key={savedRequest.reference} className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="font-bold text-[#123323]">{savedRequest.reference}</p>
                    <p className="mt-1 text-sm text-[#34483a]">{savedRequest.requestType}</p>
                    <p className="mt-1 text-xs text-[#53645b]">
                      {format(parseISO(savedRequest.date), "MMM d, yyyy")} · {savedRequest.status}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => void copyReference(savedRequest.reference)}
                      className="flex min-h-10 items-center gap-2 rounded border border-[#c9d1ca] px-3 text-sm font-semibold text-[#34483a]"
                    >
                      <Copy className="h-4 w-4" /> Copy
                    </button>
                    <button
                      type="button"
                      onClick={() => showRequest(savedRequest)}
                      className="min-h-10 rounded bg-[#123323] px-4 text-sm font-bold text-white"
                    >
                      View status
                    </button>
                  </div>
                </article>
              ))}
            </div>
          ) : null}
          <p className="mt-3 text-xs leading-relaxed text-[#6e6b65]">
            Requests are loaded from your account in the shared Barangay database. Download a copy of reference numbers for your records.
          </p>
        </section>

        <section className="border border-[#c9d1ca] bg-white p-5 md:p-7">
          <h2 className="mb-1 text-lg font-bold text-[#122d1f]">Find a request by reference</h2>
          <p className="mb-4 text-sm text-[#53645b]">Use this if you have a reference number from another device or an older request.</p>
          <form onSubmit={findRequest} className="flex flex-col gap-3 sm:flex-row">
            <label htmlFor="request-reference" className="sr-only">Request reference number</label>
            <input
              id="request-reference"
              required
              value={reference}
              onChange={(event) => setReference(event.target.value)}
              placeholder="Example: BRG-2026-123456"
              className="min-h-12 min-w-0 flex-1 border border-[#aeb8af] px-4 text-base"
            />
            <button
              type="submit"
              className="flex min-h-12 items-center justify-center gap-2 bg-[#123323] px-6 text-base font-bold text-white"
            >
              <Search className="h-5 w-5" /> Check status
            </button>
          </form>

          {searched && !request && (
            <p role="status" className="mt-4 border border-amber-300 bg-amber-50 p-4 text-base text-amber-950">
              No request with that reference was found in your account. Check the number and try again.
            </p>
          )}

          {request && (
            <article className="mt-6 border border-[#d7ddd7]" aria-live="polite">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#d7ddd7] bg-[#f7faf7] p-4">
                <div>
                  <p className="text-sm font-semibold text-[#53645b]">REFERENCE NUMBER</p>
                  <p className="mt-1 text-lg font-bold text-[#123323]">{request.reference}</p>
                </div>
                <span className={`border px-3 py-2 text-sm font-bold ${statusStyle[request.status]}`}>
                  {request.status}
                </span>
              </div>
              <dl className="grid gap-0 sm:grid-cols-2">
                {[
                  ["Resident", request.fullName],
                  ["Document", request.requestType],
                  ["Appointment", `${format(parseISO(request.date), "MMMM d, yyyy")} · ${request.timeSlot}`],
                  ["Document format", request.deliveryFormat],
                  ["Purpose", request.purpose],
                  ["Submitted", manilaTime(request.submittedAt)],
                ].map(([label, value]) => (
                  <div key={label} className="border-b border-[#e3e8e3] p-4 last:border-b-0">
                    <dt className="text-sm font-semibold text-[#53645b]">{label}</dt>
                    <dd className="mt-1 break-words text-base font-medium text-[#122d1f]">{value}</dd>
                  </div>
                ))}
              </dl>
              <div className="flex items-start gap-3 border-t border-[#d7ddd7] bg-[#f7faf7] p-4">
                <CalendarDays className="mt-0.5 h-5 w-5 shrink-0 text-[#123323]" />
                <p className="text-base leading-relaxed text-[#34483a]">
                  {request.status === "PENDING"
                    ? "Your request is waiting for staff review. The selected date and time are a request, not a confirmed appointment."
                    : `Your request status is ${request.status.toLowerCase()}. Contact the Barangay office if you need help.`}
                </p>
              </div>
              {request.rejectionReason && <p className="mx-4 mb-4 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-800"><strong>Reason for rejection:</strong> {request.rejectionReason}</p>}
              {request.statusReason && <p className="mx-4 mb-4 rounded border border-[#d9e2da] p-3 text-sm text-[#34483a]"><strong>Status details:</strong> {request.statusReason}</p>}
              <div className="space-y-4 px-4 pb-4">
                <AppointmentActions key={`actions-${request.reference}`} request={request} staff={false} onUpdated={updated => {
                  setRequest(updated); setAllRequests(previous => previous.map(item => item.reference === updated.reference ? updated : item));
                }} />
                <SupportingDocuments active={!request.archived&&['PENDING','APPROVED'].includes(request.status)} reference={request.reference} ownerId={request.ownerId} staff={false}/>
                <ResidentTransactionRecords reference={request.reference}/>
                <RequestHistory key={request.reference} reference={request.reference} />
                <TransactionChat reference={request.reference} resident={resident} />
              </div>
            </article>
          )}
        </section>

        <div className="mt-5 flex flex-col items-start gap-3 rounded border border-[#c9d1ca] bg-white p-4 sm:flex-row sm:items-center">
          <FileCheck2 className="h-5 w-5 shrink-0 text-[#123323]" />
          <p className="flex-1 text-sm leading-relaxed text-[#53645b]">
            Requests and status updates are saved in the shared database and visible to authorized Barangay staff.
          </p>
          <button
            onClick={() => setActivePage("book")}
            className="min-h-11 bg-[#123323] px-4 text-sm font-bold text-white"
          >
            Make a request
          </button>
        </div>
      </div>
    </div>
  );
}
