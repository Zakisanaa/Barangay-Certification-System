import { Bell, ChevronRight, MapPin, Phone, Clock } from "lucide-react";

type Page = "home" | "chat" | "book" | "dashboard" | "admin";

interface HomePageProps {
  setActivePage: (page: Page) => void;
}

const announcements = [
  {
    id: 1,
    month: "JUN",
    day: "15",
    type: "NOTICE",
    date: "2024-06-15",
    title: "Schedule of Barangay Certification Issuance — June 2024",
    content:
      "The barangay hall will be open for certification requests every Monday to Friday, 8:00 AM to 5:00 PM. Walk-ins and online bookings are both accepted.",
  },
  {
    id: 2,
    month: "JUN",
    day: "10",
    type: "ADVISORY",
    date: "2024-06-10",
    title: "Required Documents for Business Permit Applications",
    content:
      "All applicants for business permits must present a valid government-issued ID, proof of business address, and completed application form.",
  },
  {
    id: 3,
    month: "JUN",
    day: "04",
    type: "UPDATE",
    date: "2024-06-04",
    title: "System Maintenance — Online Booking Temporarily Unavailable",
    content:
      "The online booking system will undergo scheduled maintenance on June 20, 2024, from 12:00 AM to 4:00 AM. Please plan your appointments accordingly.",
  },
];

const quickLinks = [
  { name: "Barangay Clearance", desc: "For employment, business, or travel" },
  { name: "Certificate of Residency", desc: "Proof of address for official use" },
  { name: "Business Permit", desc: "Local business registration support" },
  { name: "Certificate of Indigency", desc: "For social welfare assistance" },
];

const systemStatuses = [
  { name: "Online Booking", status: "ACTIVE" },
  { name: "AI Assistant", status: "ONLINE" },
  { name: "Walk-in Service", status: "OPEN" },
];

const typeBadgeStyle = (type: string) => {
  switch (type) {
    case "ADVISORY": return { background: "#7c3a00", color: "#fff" };
    case "UPDATE":   return { background: "#1a4a1a", color: "#fff" };
    default:         return { background: "#0f0e0c", color: "#fff" };
  }
};

export default function HomePage({ setActivePage }: HomePageProps) {
  return (
    <div className="min-h-screen bg-[#edf1ee] p-7" style={{ fontFamily: "'Segoe UI', 'Arial', sans-serif" }}>

      {/* ── Hero Banner ─────────────────────────────────────────── */}
      <div className="mb-7 border border-[#c9d1ca] bg-white shadow-[0_12px_28px_rgba(18,51,35,0.05)]">

        {/* Hero body */}
        <div className="bg-white px-10 pt-10 pb-8">
          <p className="mb-4 text-[9px] font-bold tracking-[0.18em] uppercase text-[#6a766e]">
            Public Service Portal
          </p>
          <div className="mb-3 flex flex-wrap items-center gap-4">
            <img
              src="officials/brgylagasit.png"
              alt="Barangay Lagasit logo"
              className="h-16 w-16 rounded-full border border-[#d3d9d4] object-contain bg-[#f8faf8] p-1"
            />
            <h1
              className="font-black leading-none tracking-[-0.03em] text-[#122d1f]"
              style={{ fontSize: "clamp(36px, 5vw, 64px)" }}
            >
              Barangay Lagasit
            </h1>
          </div>
          <p className="mb-2 text-base font-bold tracking-wide text-[#51635d]">
            San Quintin, Pangasinan
          </p>
          <p className="mb-8 max-w-lg text-xs leading-relaxed text-[#53645b]">
            Official certification appointment and inquiry system. Book appointments, track
            requests, and get instant answers through our AI assistant.
          </p>
          <div className="flex gap-3 flex-wrap">
            <button
              onClick={() => setActivePage("book")}
              className="flex items-center gap-2 px-6 py-3 text-[11px] font-bold tracking-[0.12em] text-white transition-opacity hover:opacity-90"
              style={{ background: "#123323" }}
            >
              BOOK APPOINTMENT <ChevronRight className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setActivePage("chat")}
              className="flex items-center gap-2 border border-[#c9d1ca] bg-[#f4f8f4] px-6 py-3 text-[11px] font-bold tracking-[0.12em] text-[#123323] transition-all hover:bg-[#edf5ee]"
            >
              ASK AI ASSISTANT <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Info strip */}
        <div
          className="flex items-center gap-8 px-10 py-3"
          style={{ background: "#f4f8f4", borderTop: "1px solid #c9d1ca" }}
        >
          {[
            { icon: MapPin, text: "[Street Address], [City]" },
            { icon: Phone, text: "(02) 8XXX-XXXX" },
            { icon: Clock,  text: "Mon-Fri: 8:00 AM – 5:00 PM" },
          ].map(({ icon: Icon, text }) => (
            <span key={text} className="flex items-center gap-1.5 text-[10px]" style={{ color: "#6e6b65" }}>
              <Icon className="w-3 h-3" style={{ color: "#bf6318" }} />
              {text}
            </span>
          ))}
        </div>
      </div>

      {/* ── Grid ────────────────────────────────────────────────── */}
      <div className="grid gap-7" style={{ gridTemplateColumns: "1fr 340px" }}>

        {/* Announcements */}
<div className="bg-white" style={{ border: "1px solid #c9d1ca" }}>
          <div
            className="flex justify-between items-center px-5 py-3"
            style={{ background: "#f4f8f4", borderBottom: "1px solid #c9d1ca" }}
          >
            <span className="text-[10px] font-bold tracking-[0.15em] uppercase text-[#51635d]">Latest Announcements</span>
            <span className="text-[10px] font-bold tracking-[0.1em] text-[#6a766e]">
              {announcements.length} ITEMS
            </span>
          </div>

          {announcements.map((a, i) => (
            <div
              key={a.id}
              className="flex gap-5 px-5 py-5 cursor-pointer group transition-colors"
              style={{
                borderBottom: i < announcements.length - 1 ? "1px solid #c4c0b9" : "none",
              }}
              onMouseEnter={e => (e.currentTarget.style.background = "#faf9f7")}
              onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
            >
              {/* Date block */}
              <div
                className="text-center flex-shrink-0 pt-0.5"
                style={{ width: 40 }}
              >
                <div className="text-[9px] font-bold tracking-[0.1em]" style={{ color: "#9e9b96" }}>{a.month}</div>
                <div className="text-2xl font-bold leading-tight mt-0.5">{a.day}</div>
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2.5 mb-2">
                  <span
                    className="text-[9px] font-bold tracking-[0.12em] px-2 py-0.5"
                    style={typeBadgeStyle(a.type)}
                  >
                    {a.type}
                  </span>
                  <span className="text-[9px] font-bold tracking-[0.06em]" style={{ color: "#9e9b96" }}>{a.date}</span>
                </div>
                <p className="text-[12px] font-bold leading-snug mb-1.5">{a.title}</p>
                <p className="text-[11px] leading-relaxed line-clamp-2" style={{ color: "#bf6318" }}>{a.content}</p>
              </div>

              <ChevronRight className="w-4 h-4 flex-shrink-0 self-center transition-transform group-hover:translate-x-0.5" style={{ color: "#c4c0b9" }} />
            </div>
          ))}

          <div className="px-5 py-3.5" style={{ borderTop: "1px solid #c4c0b9" }}>
            <button className="text-[10px] font-bold tracking-[0.1em] transition-opacity hover:opacity-70" style={{ color: "#bf6318" }}>
              VIEW ALL ANNOUNCEMENTS &rsaquo;
            </button>
          </div>
        </div>

        {/* Right column */}
        <div className="flex flex-col gap-5">

          {/* Quick Links */}
          <div className="bg-white" style={{ border: "1px solid #c4c0b9" }}>
            <div
              className="px-4 py-3"
              style={{ background: "#f5f3f0", borderBottom: "1px solid #c4c0b9" }}
            >
              <span className="text-[10px] font-bold tracking-[0.15em]">QUICK_LINKS</span>
            </div>
            {quickLinks.map((link, i) => (
              <button
                key={link.name}
                onClick={() => setActivePage("book")}
                className="w-full flex justify-between items-center px-4 py-3.5 text-left group transition-colors"
                style={{ borderBottom: i < quickLinks.length - 1 ? "1px solid #c4c0b9" : "none" }}
                onMouseEnter={e => (e.currentTarget.style.background = "#faf9f7")}
                onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
              >
                <div>
                  <p className="text-[11px] font-bold tracking-[0.04em] mb-0.5">{link.name}</p>
                  <p className="text-[10px]" style={{ color: "#9e9b96" }}>{link.desc}</p>
                </div>
                <ChevronRight className="w-3.5 h-3.5 flex-shrink-0 transition-transform group-hover:translate-x-0.5" style={{ color: "#c4c0b9" }} />
              </button>
            ))}
          </div>

          {/* System Status */}
          <div className="bg-white" style={{ border: "1px solid #c4c0b9" }}>
            <div
              className="px-4 py-3"
              style={{ background: "#f5f3f0", borderBottom: "1px solid #c4c0b9" }}
            >
              <span className="text-[10px] font-bold tracking-[0.15em]">SYSTEM_STATUS</span>
            </div>
            {systemStatuses.map((s, i) => (
              <div
                key={s.name}
                className="flex justify-between items-center px-4 py-3.5"
                style={{ borderBottom: i < systemStatuses.length - 1 ? "1px solid #c4c0b9" : "none" }}
              >
                <span className="text-[11px] font-bold">{s.name}</span>
                <span
                  className="text-[9px] font-bold tracking-[0.12em] px-2.5 py-1 text-white"
                  style={{ background: "#0f0e0c" }}
                >
                  {s.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Floating ASK AI */}
      <button
        onClick={() => setActivePage("chat")}
        className="fixed bottom-7 right-7 w-14 h-14 text-white flex items-center justify-center shadow-xl transition-opacity hover:opacity-80 z-10"
        style={{ background: "#0f0e0c", borderRadius: "50%" }}
      >
        <span className="text-[8px] font-bold tracking-[0.08em] leading-tight text-center">ASK<br />AI</span>
      </button>
    </div>
  );
}
