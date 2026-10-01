import { useState } from "react";
import { FileText, Clock, Users, AlertTriangle, Eye, Check, X } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Cell,
  Tooltip, TooltipProps,
} from "recharts";

type FilterStatus = "ALL" | "PENDING" | "APPROVED" | "COMPLETED" | "REJECTED";
type ActiveTab = "verification" | "analytics";

interface Request {
  ref: string;
  resident: string;
  type: string;
  apptDate: string;
  submitted: string;
  status: "PENDING" | "APPROVED" | "COMPLETED" | "REJECTED";
}

const initialRequests: Request[] = [
  { ref: "BRG-2024-4890", resident: "Maria Santos",    type: "Barangay Clearance",       apptDate: "June 20, 2024", submitted: "June 12", status: "PENDING"   },
  { ref: "BRG-2024-4882", resident: "Pedro Reyes",     type: "Business Permit",           apptDate: "June 19, 2024", submitted: "June 11", status: "PENDING"   },
  { ref: "BRG-2024-4875", resident: "Ana Lim",         type: "Certificate of Residency",  apptDate: "June 18, 2024", submitted: "June 10", status: "APPROVED"  },
  { ref: "BRG-2024-4821", resident: "Juan dela Cruz",  type: "Barangay Clearance",        apptDate: "June 18, 2024", submitted: "June 9",  status: "APPROVED"  },
  { ref: "BRG-2024-4810", resident: "Rosa Fernandez",  type: "Certificate of Indigency",  apptDate: "June 17, 2024", submitted: "June 8",  status: "COMPLETED" },
  { ref: "BRG-2024-4799", resident: "Carlos Mendoza",  type: "Good Moral Certificate",    apptDate: "June 16, 2024", submitted: "June 7",  status: "REJECTED"  },
  { ref: "BRG-2024-4785", resident: "Luz Aquino",      type: "Business Permit",           apptDate: "June 15, 2024", submitted: "June 6",  status: "COMPLETED" },
];

const monthlyData = [
  { month: "Jan", count: 18 },
  { month: "Feb", count: 22 },
  { month: "Mar", count: 30 },
  { month: "Apr", count: 27 },
  { month: "May", count: 42 },
  { month: "Jun", count: 35 },
];

const typeData = [
  { name: "Clearance",  count: 52 },
  { name: "Residency",  count: 33 },
  { name: "Business",   count: 24 },
  { name: "Indigency",  count: 18 },
  { name: "Moral",      count: 12 },
];

const STATUS_CONFIG: Record<Request["status"], { bg: string; color: string; border?: string }> = {
  APPROVED:  { bg: "#0f0e0c", color: "#fff" },
  PENDING:   { bg: "transparent", color: "#0f0e0c", border: "1.5px solid #0f0e0c" },
  COMPLETED: { bg: "#3d3b38", color: "#fff" },
  REJECTED:  { bg: "#6e6b65", color: "#fff" },
};

function DetailModal({ request, onClose }: { request: Request; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: "rgba(15,14,12,0.55)" }}
      onClick={onClose}
    >
      <div
        className="bg-white w-full mx-4 md:mx-0 md:w-[420px]"
        style={{ border: "1px solid #c4c0b9", boxShadow: "0 16px 48px rgba(0,0,0,0.18)" }}
        onClick={e => e.stopPropagation()}
      >
        <div
          className="flex items-center justify-between px-6 py-3.5"
          style={{ background: "#f5f3f0", borderBottom: "1px solid #c4c0b9" }}
        >
          <span className="text-[10px] font-bold tracking-[0.18em]">REQUEST_DETAIL</span>
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
            { label: "REF NO.",       value: request.ref,       amber: true },
            { label: "RESIDENT",      value: request.resident,  amber: true },
            { label: "REQUEST TYPE",  value: request.type,      amber: false },
            { label: "APPT. DATE",    value: request.apptDate,  amber: true },
            { label: "PURPOSE",       value: "Employment — ABC Corp", amber: false },
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

export default function AdminPage() {
  const [requests, setRequests] = useState<Request[]>(initialRequests);
  const [filter, setFilter] = useState<FilterStatus>("ALL");
  const [tab, setTab] = useState<ActiveTab>("verification");
  const [selectedReq, setSelectedReq] = useState<Request | null>(null);

  const total    = requests.length;
  const pending  = requests.filter(r => r.status === "PENDING").length;
  const filtered = filter === "ALL" ? requests : requests.filter(r => r.status === filter);

  const updateStatus = (ref: string, status: "APPROVED" | "REJECTED") => {
    setRequests(prev => prev.map(r => r.ref === ref ? { ...r, status } : r));
  };

  const breakdown = (["PENDING", "APPROVED", "COMPLETED", "REJECTED"] as Request["status"][]).map(s => ({
    label: s,
    count: requests.filter(r => r.status === s).length,
    pct: Math.round((requests.filter(r => r.status === s).length / total) * 100),
  }));

  return (
    <div className="p-4 md:p-7" style={{ fontFamily: "'Space Mono', monospace" }}>
      {selectedReq && <DetailModal request={selectedReq} onClose={() => setSelectedReq(null)} />}

      {/* Header */}
      <div className="flex items-start justify-between mb-7 pb-5" style={{ borderBottom: "1px solid #c4c0b9" }}>
        <div>
          <h2 className="text-sm font-bold tracking-[0.12em]">ADMIN_PANEL.MODULE</h2>
          <p className="text-[10px] mt-1" style={{ color: "#6e6b65" }}>Request verification and system analytics</p>
        </div>
        <div
          className="px-5 py-2.5 text-[10px] font-bold tracking-[0.16em] text-white"
          style={{ background: "#0f0e0c" }}
        >
          ADMIN ACCESS
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-7">
        {[
          { label: "TOTAL REQUESTS", value: total,     Icon: FileText    },
          { label: "PENDING",        value: pending,   Icon: Clock        },
          { label: "RESIDENTS",      value: 142,       Icon: Users       },
          { label: "NEEDS REVIEW",   value: pending,   Icon: AlertTriangle},
        ].map(({ label, value, Icon }) => (
          <div
            key={label}
            className="bg-white px-5 py-5 flex items-start gap-3.5"
            style={{ border: "1px solid #c4c0b9" }}
          >
            <div
              className="w-9 h-9 flex items-center justify-center flex-shrink-0"
              style={{ background: "#f5f3f0", border: "1px solid #c4c0b9" }}
            >
              <Icon className="w-4 h-4" style={{ color: "#6e6b65" }} />
            </div>
            <div>
              <div className="text-[9px] font-bold tracking-[0.16em] mb-2" style={{ color: "#9e9b96" }}>{label}</div>
              <div className="text-4xl font-bold tracking-tight leading-none">{value}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex" style={{ borderBottom: "1px solid #c4c0b9" }}>
        {[
          { id: "verification" as ActiveTab, label: "REQUEST_VERIFICATION" },
          { id: "analytics"    as ActiveTab, label: "ANALYTICS" },
        ].map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className="px-6 py-3 text-[10px] font-bold tracking-[0.14em] transition-all"
            style={
              tab === t.id
                ? { background: "#0f0e0c", color: "#fff" }
                : { color: "#9e9b96", borderBottom: "2px solid transparent" }
            }
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── VERIFICATION ── */}
      {tab === "verification" && (
        <div className="bg-white" style={{ border: "1px solid #c4c0b9", borderTop: "none" }}>
          {/* Filter bar */}
          <div
            className="flex items-center gap-2.5 px-5 py-3.5"
            style={{ background: "#f5f3f0", borderBottom: "1px solid #c4c0b9" }}
          >
            <span className="text-[9px] font-bold tracking-[0.18em] mr-1" style={{ color: "#9e9b96" }}>
              FILTER:
            </span>
            {(["ALL", "PENDING", "APPROVED", "COMPLETED", "REJECTED"] as FilterStatus[]).map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className="px-3 py-1.5 text-[9px] font-bold tracking-[0.1em] transition-all"
                style={
                  filter === f
                    ? { background: "#0f0e0c", color: "#fff", border: "1.5px solid #0f0e0c" }
                    : { background: "transparent", color: "#6e6b65", border: "1.5px solid #c4c0b9" }
                }
              >
                {f}
              </button>
            ))}
            <span className="ml-auto text-[9px] font-bold tracking-[0.1em]" style={{ color: "#9e9b96" }}>
              {filtered.length} RECORDS
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr style={{ borderBottom: "1px solid #c4c0b9", background: "#faf9f7" }}>
                  {["REF NO.", "RESIDENT", "REQUEST TYPE", "APPT. DATE", "SUBMITTED", "STATUS", "ACTIONS"].map(h => (
                    <th
                      key={h}
                      className="px-5 py-3 text-left text-[9px] font-bold tracking-[0.16em] whitespace-nowrap"
                      style={{ color: "#9e9b96" }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((req, i) => {
                  const s = STATUS_CONFIG[req.status];
                  return (
                    <tr
                      key={req.ref}
                      style={{ borderBottom: i < filtered.length - 1 ? "1px solid #e8e5e0" : "none" }}
                      onMouseEnter={e => (e.currentTarget.style.background = "#faf9f7")}
                      onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                    >
                      <td className="px-5 py-4">
                        <span className="text-[10px] font-bold" style={{ color: "#bf6318" }}>{req.ref}</span>
                      </td>
                      <td className="px-5 py-4">
                        <span className="text-[11px] font-bold" style={{ color: "#bf6318" }}>{req.resident}</span>
                      </td>
                      <td className="px-5 py-4">
                        <span className="text-[11px]" style={{ color: "#0f0e0c" }}>{req.type}</span>
                      </td>
                      <td className="px-5 py-4">
                        <span className="text-[11px] font-bold" style={{ color: "#bf6318" }}>{req.apptDate}</span>
                      </td>
                      <td className="px-5 py-4">
                        <span className="text-[10px]" style={{ color: "#9e9b96" }}>{req.submitted}</span>
                      </td>
                      <td className="px-5 py-4">
                        <span
                          className="text-[9px] font-bold tracking-[0.1em] px-2.5 py-1.5"
                          style={{ background: s.bg, color: s.color, border: s.border || "none" }}
                        >
                          {req.status}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex gap-2 flex-wrap">
                          <button
                            onClick={() => setSelectedReq(req)}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-[9px] font-bold tracking-[0.1em] transition-all"
                            style={{ border: "1.5px solid #c4c0b9" }}
                            onMouseEnter={e => (e.currentTarget.style.borderColor = "#0f0e0c")}
                            onMouseLeave={e => (e.currentTarget.style.borderColor = "#c4c0b9")}
                          >
                            <Eye className="w-3 h-3" /> VIEW
                          </button>
                          {req.status === "PENDING" && (
                            <>
                              <button
                                onClick={() => updateStatus(req.ref, "APPROVED")}
                                className="flex items-center gap-1.5 px-3 py-1.5 text-[9px] font-bold tracking-[0.1em] transition-all hover:bg-black hover:text-white"
                                style={{ border: "1.5px solid #c4c0b9" }}
                              >
                                <Check className="w-3 h-3" /> APPROVE
                              </button>
                              <button
                                onClick={() => updateStatus(req.ref, "REJECTED")}
                                className="flex items-center gap-1.5 px-3 py-1.5 text-[9px] font-bold tracking-[0.1em] transition-all"
                                style={{ border: "1.5px solid #c4c0b9" }}
                                onMouseEnter={e => { e.currentTarget.style.background = "#b91c1c"; e.currentTarget.style.color = "#fff"; e.currentTarget.style.borderColor = "#b91c1c"; }}
                                onMouseLeave={e => { e.currentTarget.style.background = ""; e.currentTarget.style.color = ""; e.currentTarget.style.borderColor = "#c4c0b9"; }}
                              >
                                <X className="w-3 h-3" /> REJECT
                              </button>
                            </>
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

      {/* ── ANALYTICS ── */}
      {tab === "analytics" && (
        <div
          className="bg-white p-7 space-y-6"
          style={{ border: "1px solid #c4c0b9", borderTop: "none" }}
        >
          <div className="grid grid-cols-2 gap-6">
            {/* Monthly bar chart */}
            <div style={{ border: "1px solid #c4c0b9" }}>
              <div
                className="px-5 py-3"
                style={{ background: "#f5f3f0", borderBottom: "1px solid #c4c0b9" }}
              >
                <span className="text-[9px] font-bold tracking-[0.16em]" style={{ color: "#bf6318" }}>
                  MONTHLY_REQUESTS_2024
                </span>
              </div>
              <div className="p-5">
                <ResponsiveContainer width="100%" height={190}>
                  <BarChart data={monthlyData} barSize={22} margin={{ top: 4, right: 4, bottom: 0, left: -16 }}>
                    <XAxis dataKey="month" tick={monoTick} axisLine={false} tickLine={false} />
                    <YAxis tick={monoTick} axisLine={false} tickLine={false} />
                    <Tooltip content={<ChartTooltipContent />} cursor={{ fill: "rgba(15,14,12,0.05)" }} />
                    <Bar dataKey="count" fill="#0f0e0c" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Type horizontal bar */}
            <div style={{ border: "1px solid #c4c0b9" }}>
              <div
                className="px-5 py-3"
                style={{ background: "#f5f3f0", borderBottom: "1px solid #c4c0b9" }}
              >
                <span className="text-[9px] font-bold tracking-[0.16em]" style={{ color: "#bf6318" }}>
                  REQUESTS_BY_TYPE
                </span>
              </div>
              <div className="p-5">
                <ResponsiveContainer width="100%" height={190}>
                  <BarChart
                    data={typeData}
                    layout="vertical"
                    barSize={14}
                    margin={{ top: 4, right: 4, bottom: 0, left: 0 }}
                  >
                    <XAxis type="number" tick={monoTick} axisLine={false} tickLine={false} />
                    <YAxis
                      dataKey="name"
                      type="category"
                      tick={monoTick}
                      axisLine={false}
                      tickLine={false}
                      width={62}
                    />
                    <Tooltip content={<ChartTooltipContent />} cursor={{ fill: "rgba(15,14,12,0.05)" }} />
                    <Bar dataKey="count">
                      {typeData.map((_, idx) => (
                        <Cell key={idx} fill={`hsl(0,0%,${20 + idx * 14}%)`} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Status breakdown */}
          <div style={{ border: "1px solid #c4c0b9" }}>
            <div
              className="px-5 py-3"
              style={{ background: "#f5f3f0", borderBottom: "1px solid #c4c0b9" }}
            >
              <span className="text-[9px] font-bold tracking-[0.16em]">STATUS_BREAKDOWN_JUNE_2024</span>
            </div>
            <div className="grid grid-cols-4 divide-x" style={{ borderColor: "#c4c0b9" }}>
              {breakdown.map(b => (
                <div key={b.label} className="px-5 py-5 text-center">
                  <div className="text-[9px] font-bold tracking-[0.16em] mb-2.5" style={{ color: "#9e9b96" }}>
                    {b.label}
                  </div>
                  <div className="text-4xl font-bold tracking-tight leading-none mb-1.5">{b.count}</div>
                  <div className="text-[10px]" style={{ color: "#9e9b96" }}>{b.pct}% of total</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
