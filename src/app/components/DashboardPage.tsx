import { Calendar, Plus, FileText, Activity, CheckCircle, XCircle } from "lucide-react";

type Page = "home" | "chat" | "book" | "dashboard" | "admin";

interface DashboardPageProps {
  userName: string;
  userId: string;
  setActivePage: (page: Page) => void;
}

interface Appointment {
  ref: string;
  type: string;
  date: string;
  time: string;
  purpose: string;
  status: "APPROVED" | "PENDING" | "COMPLETED" | "REJECTED";
}

const mockAppointments: Appointment[] = [
  {
    ref: "BRG-2024-4821",
    type: "Barangay Clearance",
    date: "June 18, 2024",
    time: "9:00 AM",
    purpose: "Employment application at ABC Corp",
    status: "APPROVED",
  },
  {
    ref: "BRG-2024-4755",
    type: "Certificate of Residency",
    date: "June 14, 2024",
    time: "10:30 AM",
    purpose: "Enrollment requirements for university",
    status: "PENDING",
  },
  {
    ref: "BRG-2024-4699",
    type: "Business Permit",
    date: "June 10, 2024",
    time: "8:00 AM",
    purpose: "New business registration — sari-sari store",
    status: "COMPLETED",
  },
  {
    ref: "BRG-2024-4612",
    type: "Certificate of Indigency",
    date: "June 5, 2024",
    time: "11:00 AM",
    purpose: "DSWD scholarship application",
    status: "REJECTED",
  },
];

const STATUS_CONFIG: Record<Appointment["status"], { bg: string; color: string; label: string }> = {
  APPROVED:  { bg: "#0f0e0c", color: "#fff",    label: "APPROVED"  },
  PENDING:   { bg: "transparent", color: "#0f0e0c", label: "PENDING"  },
  COMPLETED: { bg: "#3d3b38", color: "#fff",    label: "COMPLETED" },
  REJECTED:  { bg: "#6e6b65", color: "#fff",    label: "REJECTED"  },
};

const STAT_ICONS = [FileText, Activity, CheckCircle, XCircle];

export default function DashboardPage({ userName, userId, setActivePage }: DashboardPageProps) {
  const total     = mockAppointments.length;
  const active    = mockAppointments.filter(a => a.status === "APPROVED" || a.status === "PENDING").length;
  const completed = mockAppointments.filter(a => a.status === "COMPLETED").length;
  const rejected  = mockAppointments.filter(a => a.status === "REJECTED").length;

  const stats = [
    { label: "TOTAL REQUESTS", value: total,     sub: "All time" },
    { label: "ACTIVE",         value: active,    sub: "Pending + Approved" },
    { label: "COMPLETED",      value: completed, sub: "Processed" },
    { label: "REJECTED",       value: rejected,  sub: "Review needed" },
  ];

  return (
    <div className="bg-[#edf1ee] p-4 md:p-7" style={{ fontFamily: "'Segoe UI', 'Arial', sans-serif" }}>

      {/* Header */}
      <div className="mb-7 flex items-start justify-between pb-5" style={{ borderBottom: "1px solid #c9d1ca" }}>
        <div>
          <h2 className="text-sm font-bold tracking-[0.12em] uppercase text-[#122d1f]">Resident Dashboard</h2>
          <p className="mt-1 text-[10px] text-[#53645b]">My appointments and request tracking</p>
        </div>
        <button
          onClick={() => setActivePage("book")}
          className="flex items-center gap-2 px-5 py-2.5 text-[10px] font-bold tracking-[0.12em] text-white transition-opacity hover:opacity-90"
          style={{ background: "#123323" }}
        >
          <Plus className="h-3.5 w-3.5" /> NEW BOOKING
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-7">
        {stats.map((s, i) => {
          const Icon = STAT_ICONS[i];
          return (
            <div
              key={s.label}
              className="bg-white px-5 py-5"
              style={{ border: "1px solid #c4c0b9" }}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="text-[9px] font-bold tracking-[0.16em]" style={{ color: "#9e9b96" }}>
                  {s.label}
                </div>
                <Icon className="w-4 h-4 flex-shrink-0" style={{ color: "#c4c0b9" }} />
              </div>
              <div className="text-4xl font-bold tracking-tight leading-none mb-1.5">{s.value}</div>
              <div className="text-[10px]" style={{ color: "#9e9b96" }}>{s.sub}</div>
            </div>
          );
        })}
      </div>

      {/* Resident Profile */}
      <div
        className="bg-white flex items-center gap-5 px-6 py-5 mb-7"
        style={{ border: "1px solid #c4c0b9" }}
      >
        <div
          className="w-16 h-16 flex items-center justify-center text-xl font-bold text-white flex-shrink-0"
          style={{ background: "#0f0e0c" }}
        >
          {userName.charAt(0).toUpperCase()}
        </div>
        <div className="flex-1">
          <div className="text-[9px] font-bold tracking-[0.18em] mb-1.5" style={{ color: "#9e9b96" }}>
            RESIDENT PROFILE
          </div>
          <div className="text-xl font-bold tracking-wide mb-1">
            {userName.toUpperCase()}
          </div>
          <div className="text-[10px]" style={{ color: "#9e9b96" }}>
            ID: {userId}&nbsp;&nbsp;·&nbsp;&nbsp;123 Rizal St., [Barangay Name]&nbsp;&nbsp;·&nbsp;&nbsp;Voter ID: 1234-5678-9012
          </div>
        </div>
        <button
          className="px-5 py-2 text-[9px] font-bold tracking-[0.14em] transition-all hover:bg-foreground hover:text-white"
          style={{ border: "1.5px solid #c4c0b9" }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = "#0f0e0c"; }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = "#c4c0b9"; }}
        >
          EDIT PROFILE
        </button>
      </div>

      {/* Table */}
      <div className="bg-white" style={{ border: "1px solid #c9d1ca" }}>
        <div
          className="flex items-center justify-between px-6 py-3.5"
          style={{ background: "#f4f8f4", borderBottom: "1px solid #c9d1ca" }}
        >
          <span className="text-[10px] font-bold tracking-[0.15em] uppercase text-[#51635d]">My Active Appointments</span>
          <span className="text-[10px] font-bold tracking-[0.1em]" style={{ color: "#9e9b96" }}>
            {mockAppointments.length} RECORDS
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr style={{ borderBottom: "1px solid #c4c0b9", background: "#faf9f7" }}>
                {["REF NO.", "REQUEST TYPE", "DATE & TIME", "PURPOSE", "STATUS", "ACTION"].map(h => (
                  <th
                    key={h}
                    className="px-5 py-3 text-left text-[9px] font-bold tracking-[0.16em]"
                    style={{ color: "#9e9b96" }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {mockAppointments.map((apt, i) => {
                const s = STATUS_CONFIG[apt.status];
                return (
                  <tr
                    key={apt.ref}
                    style={{ borderBottom: i < mockAppointments.length - 1 ? "1px solid #e8e5e0" : "none" }}
                    onMouseEnter={e => (e.currentTarget.style.background = "#faf9f7")}
                    onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                  >
                    <td className="px-5 py-4">
                      <span className="text-[10px] font-bold" style={{ color: "#bf6318" }}>{apt.ref}</span>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2">
                        <Calendar className="w-3.5 h-3.5 flex-shrink-0" style={{ color: "#bf6318" }} />
                        <span className="text-[11px] font-bold" style={{ color: "#bf6318" }}>{apt.type}</span>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <div className="text-[11px] font-bold" style={{ color: "#bf6318" }}>{apt.date}</div>
                      <div className="text-[9px] mt-0.5" style={{ color: "#9e9b96" }}>{apt.time}</div>
                    </td>
                    <td className="px-5 py-4">
                      <span className="text-[10px]" style={{ color: "#6e6b65" }}>{apt.purpose}</span>
                    </td>
                    <td className="px-5 py-4">
                      <span
                        className="text-[9px] font-bold tracking-[0.1em] px-2.5 py-1.5"
                        style={{
                          background: s.bg,
                          color: s.color,
                          border: apt.status === "PENDING" ? "1.5px solid #0f0e0c" : "none",
                        }}
                      >
                        {s.label}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex gap-2">
                        <button
                          className="px-3 py-1.5 text-[9px] font-bold tracking-[0.1em] transition-all"
                          style={{ border: "1.5px solid #c4c0b9" }}
                          onMouseEnter={e => (e.currentTarget.style.borderColor = "#0f0e0c")}
                          onMouseLeave={e => (e.currentTarget.style.borderColor = "#c4c0b9")}
                        >
                          VIEW
                        </button>
                        {(apt.status === "PENDING" || apt.status === "APPROVED") && (
                          <button
                            className="px-3 py-1.5 text-[9px] font-bold tracking-[0.1em] transition-all"
                            style={{ border: "1.5px solid #c4c0b9" }}
                            onMouseEnter={e => (e.currentTarget.style.borderColor = "#0f0e0c")}
                            onMouseLeave={e => (e.currentTarget.style.borderColor = "#c4c0b9")}
                          >
                            CANCEL
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
    </div>
  );
}
