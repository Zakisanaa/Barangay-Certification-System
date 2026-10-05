import { useEffect, useMemo, useState } from "react";
import { FileText, Clock, Users, CheckCircle2, Eye, Check, X, Archive, RotateCcw } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, ResponsiveContainer,
  Tooltip, TooltipProps,
} from "recharts";
import TransactionChat from "./TransactionChat";
import { toast } from "sonner";
import { ResidentAccount } from "../residentAuth";
import { format, getMonth, getYear, parseISO } from "date-fns";
import {
  AppointmentRequest,
  getAppointmentRequests,
  getSchoolIdImageUrl,
  sendResidentNotification,
  subscribeAppointmentRequests,
  setAppointmentArchived,
  updateAppointmentStatus,
} from "../portalData";

type FilterStatus = "ALL" | "PENDING" | "APPROVED" | "COMPLETED" | "REJECTED";
type ActiveTab = "verification" | "analytics";
const STATUS_CONFIG: Record<AppointmentRequest["status"], { bg: string; color: string; border?: string }> = {
  APPROVED: { bg: "#ecfdf3", color: "#166534" },
  PENDING: { bg: "#fffbeb", color: "#92400e" },
  COMPLETED: { bg: "#f1f5f9", color: "#334155" },
  REJECTED: { bg: "#fef2f2", color: "#991b1b" },
};

function SchoolIdImage({ path }: { path: string }) {
  const [url, setUrl] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    let active = true;
    void getSchoolIdImageUrl(path).then(
      (signedUrl) => { if (active) setUrl(signedUrl); },
      (error: unknown) => {
        console.error("Unable to open resident school ID image.", error);
        if (active) setErrorMessage(error instanceof Error ? error.message : "Unable to load the private image.");
      },
    );
    return () => { active = false; };
  }, [path]);

  if (errorMessage) return <p role="alert" className="text-sm text-red-800">{errorMessage}</p>;
  if (!url) return <p className="text-sm text-[#53645b]">Loading school ID image…</p>;
  return (
    <a href={url} target="_blank" rel="noreferrer" className="block">
      <img src={url} alt="Resident-submitted school ID" className="max-h-64 w-full rounded border border-[#d9e2da] bg-[#f7faf7] object-contain" />
      <span className="mt-1 block text-xs font-semibold text-[#53645b]">Open image in a new tab</span>
    </a>
  );
}

function DetailModal({ request, onClose, resident }: { request: AppointmentRequest; onClose: () => void; resident: ResidentAccount }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: "rgba(15,14,12,0.55)" }}
      onClick={onClose}
    >
      <div
        className="mx-4 max-h-[90vh] w-full overflow-y-auto bg-white md:mx-0 md:w-[520px]"
        style={{ border: "1px solid #c4c0b9", boxShadow: "0 16px 48px rgba(0,0,0,0.18)" }}
        onClick={e => e.stopPropagation()}
      >
        <div
          className="flex items-center justify-between px-6 py-3.5"
          style={{ background: "#f5f3f0", borderBottom: "1px solid #c4c0b9" }}
        >
          <span className="text-base font-bold">Request details</span>
          <button
            onClick={onClose}
            className="transition-opacity hover:opacity-60"
            style={{ color: "#6e6b65" }}
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="px-6 py-5 space-y-4">
          {[
            { label: "REFERENCE", value: request.reference, amber: true },
            { label: "RESIDENT", value: request.fullName, amber: true },
            { label: "VALID ID", value: request.voterId, amber: false },
            { label: "REQUEST TYPE", value: request.requestType, amber: false },
            { label: "APPOINTMENT", value: `${format(parseISO(request.date), "MMMM d, yyyy")} · ${request.timeSlot}`, amber: true },
            { label: "DOCUMENT FORMAT", value: request.deliveryFormat, amber: false },
            { label: "PURPOSE",       value: request.purpose, amber: false },
            { label: "STATUS",        value: request.status,    amber: true },
          ].map(row => (
            <div key={row.label} className="flex gap-6">
              <div
                className="text-[9px] font-bold tracking-[0.16em] flex-shrink-0 pt-0.5"
                style={{ width: 110, color: "#9e9b96" }}
              >
                {row.label}
              </div>
              <div
                className="text-[11px] font-bold"
                style={{ color: row.amber ? "#bf6318" : "#0f0e0c" }}
              >
                {row.value}
              </div>
            </div>
          ))}
          {request.schoolIdImagePath && (
            <section className="space-y-2 border-t border-[#e3e8e3] pt-4">
              <h3 className="text-sm font-bold text-[#122d1f]">School ID image</h3>
              <SchoolIdImage path={request.schoolIdImagePath} />
            </section>
          )}
          <TransactionChat reference={request.reference} resident={resident} />
        </div>
      </div>
    </div>
  );
}

const monoTick = { fontSize: 9, fontFamily: "'Space Mono', monospace", fill: "#9e9b96" };

function ChartTooltipContent({ active, payload, label }: TooltipProps<number, string>) {
  if (!active || !payload?.length) return null;
  return (
    <div
      className="px-3 py-2 text-[10px] font-bold"
      style={{ background: "#0f0e0c", color: "#fff", fontFamily: "'Space Mono', monospace" }}
    >
      {label}: {payload[0].value}
    </div>
  );
}

export default function AdminPage({ resident }: { resident: ResidentAccount }) {
  const [requests, setRequests] = useState<AppointmentRequest[]>([]);
  const [filter, setFilter] = useState<FilterStatus>("ALL");
  const [showArchivedRequests, setShowArchivedRequests] = useState(false);
  const [tab, setTab] = useState<ActiveTab>("verification");
  const [selectedReq, setSelectedReq] = useState<AppointmentRequest | null>(null);

  useEffect(() => {
    let active = true;
    const refresh = async () => {
      try {
        const loaded = await getAppointmentRequests();
        if (active) setRequests(loaded);
      } catch (error) {
        console.error("Unable to load staff appointment requests.", error);
        if (active) toast.error(error instanceof Error ? error.message : "Could not load requests.");
      }
    };
    void refresh();
    const unsubscribe = subscribeAppointmentRequests(() => { void refresh(); });
    return () => { active = false; unsubscribe(); };
  }, []);

  const activeRequests = requests.filter((request) => !request.archived);
  const total = activeRequests.length;
  const pending = activeRequests.filter((request) => request.status === "PENDING").length;
  const approved = activeRequests.filter((request) => request.status === "APPROVED").length;
  const residentCount = new Set(activeRequests.map((request) => request.fullName.trim().toLowerCase())).size;
  const requestCollection = requests.filter((request) => request.archived === showArchivedRequests);
  const filtered = filter === "ALL" ? requestCollection : requestCollection.filter((request) => request.status === filter);

  const updateStatus = async (ref: string, status: AppointmentRequest["status"]) => {
    try {
      await updateAppointmentStatus(ref, status);
      setRequests(await getAppointmentRequests());
      try {
        await sendResidentNotification({ type: "appointment_status", reference: ref, status });
        toast.success(`Request marked ${status.toLowerCase()}; resident email notification sent.`);
      } catch (notificationError) {
        console.error("Appointment status updated, but its resident email could not be sent.", notificationError);
        toast.error(`Request updated, but the resident email failed: ${notificationError instanceof Error ? notificationError.message : "Unknown email delivery error."}`);
      }
    } catch (error) {
      console.error("Unable to update appointment request status.", error);
      toast.error(error instanceof Error ? error.message : "Could not update request.");
    }
  };

  const toggleRequestArchive = async (request: AppointmentRequest) => {
    try {
      await setAppointmentArchived(request.reference, !request.archived);
      setRequests(await getAppointmentRequests());
      toast.success(request.archived ? "Request restored." : "Request moved to the archive.");
    } catch (error) {
      console.error("Unable to update appointment archive status.", error);
      toast.error(error instanceof Error ? error.message : "Could not update archive.");
    }
  };

  const { monthlyData, typeData } = useMemo(() => {
    const year = new Date().getFullYear();
    const months = Array.from({ length: 12 }, (_, month) => ({
      month: format(new Date(year, month, 1), "MMM"),
      count: 0,
    }));
    const types = new Map<string, number>();

    activeRequests.forEach((request) => {
      const submittedAt = parseISO(request.submittedAt);
      if (getYear(submittedAt) === year) months[getMonth(submittedAt)].count += 1;
      types.set(request.requestType, (types.get(request.requestType) ?? 0) + 1);
    });

    return {
      monthlyData: months,
      typeData: Array.from(types, ([name, count]) => ({ name, count })),
    };
  }, [activeRequests]);

  const breakdown = (["PENDING", "APPROVED", "COMPLETED", "REJECTED"] as AppointmentRequest["status"][]).map((status) => {
    const count = activeRequests.filter((request) => request.status === status).length;
    return { label: status, count, pct: total ? Math.round((count / total) * 100) : 0 };
  });

  return (
    <div className="min-h-full bg-[#f4f7f4] p-4 md:p-7" style={{ fontFamily: "'Segoe UI', 'Arial', sans-serif" }}>
      {selectedReq && <DetailModal request={selectedReq} resident={resident} onClose={() => setSelectedReq(null)} />}

      {/* Header */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4 rounded-lg border border-[#d9e2da] bg-white p-5 md:p-6">
        <div>
          <p className="text-sm font-semibold text-[#53645b]">{format(new Date(), "EEEE, MMMM d, yyyy")}</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-[#122d1f] md:text-3xl">Admin dashboard</h1>
          <p className="mt-1 text-base text-[#53645b]">Manage resident requests and barangay announcements.</p>
        </div>
        <div className="flex items-center gap-2 rounded-full border border-green-200 bg-green-50 px-3 py-2 text-sm font-semibold text-green-900">
          <span className="h-2.5 w-2.5 rounded-full bg-green-600" aria-hidden="true" />
          Staff workspace
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-7">
        {[
          { label: "Total requests", value: total, Icon: FileText },
          { label: "Awaiting review", value: pending, Icon: Clock },
          { label: "Residents served", value: residentCount, Icon: Users },
          { label: "Approved", value: approved, Icon: CheckCircle2 },
        ].map(({ label, value, Icon }) => (
          <div
            key={label}
            className="flex items-start gap-3.5 rounded-lg border border-[#d9e2da] bg-white px-5 py-5 shadow-sm"
          >
            <div
              className="w-9 h-9 flex items-center justify-center flex-shrink-0"
              style={{ background: "#edf5ee", border: "1px solid #d9e2da" }}
            >
              <Icon className="w-5 h-5" style={{ color: "#123323" }} />
            </div>
            <div>
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
          {/* Filter bar */}
          <div
            className="flex flex-wrap items-center gap-2.5 px-4 py-4 md:px-5"
            style={{ background: "#f7faf7", borderBottom: "1px solid #d9e2da" }}
          >
            <span className="text-sm font-semibold mr-1" style={{ color: "#53645b" }}>
              Filter:
            </span>
            {(["ALL", "PENDING", "APPROVED", "COMPLETED", "REJECTED"] as FilterStatus[]).map(f => (
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
              {filtered.length} {filtered.length === 1 ? "request" : "requests"}
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr style={{ borderBottom: "1px solid #d9e2da", background: "#f7faf7" }}>
                  {["Reference", "Resident", "Request type", "Appointment", "Submitted", "Status", "Actions"].map(h => (
                    <th
                      key={h}
                      className="px-5 py-3 text-left text-xs font-bold uppercase tracking-wide whitespace-nowrap"
                      style={{ color: "#53645b" }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {!filtered.length && (
                  <tr>
                    <td colSpan={7} className="px-6 py-14 text-center">
                      <FileText className="mx-auto h-9 w-9 text-[#87968a]" />
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
                      <td className="px-5 py-4">
                        <span className="text-sm font-bold text-[#123323]">{req.reference}</span>
                      </td>
                      <td className="px-5 py-4">
                        <span className="text-sm font-semibold text-[#122d1f]">{req.fullName}</span>
                      </td>
                      <td className="px-5 py-4">
                        <span className="text-sm text-[#34483a]">{req.requestType}</span>
                      </td>
                      <td className="px-5 py-4">
                        <span className="text-sm font-semibold text-[#34483a]">
                          {format(parseISO(req.date), "MMM d, yyyy")}
                        </span>
                        <span className="mt-1 block text-xs text-[#53645b]">{req.timeSlot}</span>
                      </td>
                      <td className="px-5 py-4">
                        <span className="text-sm text-[#53645b]">{format(parseISO(req.submittedAt), "MMM d, yyyy")}</span>
                      </td>
                      <td className="px-5 py-4">
                        <span
                          className="inline-block rounded-full px-3 py-1.5 text-xs font-bold"
                          style={{ background: s.bg, color: s.color, border: s.border || "none" }}
                        >
                          {req.status}
                        </span>
                      </td>
                      <td className="px-5 py-4">
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
                            className="flex min-h-9 items-center gap-1.5 rounded border border-[#c9d1ca] px-3 py-1.5 text-sm font-semibold text-[#34483a] hover:bg-[#f7faf7]"
                          >
                            {req.archived ? <RotateCcw className="w-3 h-3" /> : <Archive className="w-3 h-3" />}
                            {req.archived ? "RESTORE" : "ARCHIVE"}
                          </button>
                          {!req.archived && req.status === "PENDING" && (
                            <>
                              <button
                                onClick={() => updateStatus(req.reference, "APPROVED")}
                                className="flex min-h-9 items-center gap-1.5 rounded border border-green-300 bg-green-50 px-3 py-1.5 text-sm font-semibold text-green-900 transition-all hover:bg-green-100"
                              >
                                <Check className="w-3 h-3" /> APPROVE
                              </button>
                              <button
                                onClick={() => updateStatus(req.reference, "REJECTED")}
                                className="flex min-h-9 items-center gap-1.5 rounded border border-red-200 px-3 py-1.5 text-sm font-semibold text-red-800 transition-all hover:bg-red-50"
                              >
                                <X className="w-3 h-3" /> REJECT
                              </button>
                            </>
                          )}
                          {!req.archived && req.status === "APPROVED" && (
                            <button
                              onClick={() => updateStatus(req.reference, "COMPLETED")}
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
