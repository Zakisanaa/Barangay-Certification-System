import { useEffect, useState } from "react";
import { Bell, ChevronRight, MapPin, Phone, Clock } from "lucide-react";
import { getPublicPosts, PublicPost, subscribePublicPosts } from "../portalData";
import { publicAsset } from "../publicAsset";

type Page = "home" | "chat" | "book" | "dashboard" | "admin";

interface HomePageProps {
  setActivePage: (page: Page) => void;
}

const quickLinks = [
  { name: "Barangay Clearance", desc: "For employment, business, or travel" },
  { name: "Certificate of Residency", desc: "Proof of address for official use" },
  { name: "Business Permit", desc: "Local business registration support" },
  { name: "Certificate of Indigency", desc: "For social welfare assistance" },
];

const systemStatuses = [
  { name: "Online Booking", status: "ACTIVE" },
  { name: "LagaBot FAQ", status: "AVAILABLE" },
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
  const [posts, setPosts] = useState<PublicPost[]>([]);
  useEffect(() => {
    let active = true;
    const refreshPosts = async () => {
      try {
        const loadedPosts = await getPublicPosts();
        if (active) setPosts(loadedPosts);
      } catch (error) {
        console.error("Unable to load resident announcements.", error);
      }
    };
    void refreshPosts();
    const unsubscribe = subscribePublicPosts(() => { void refreshPosts(); });
    return () => { active = false; unsubscribe(); };
  }, []);

  const announcements = posts
    .filter((post) => !post.archived)
    .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt))
    .slice(0, 3)
    .map((post) => {
      const date = new Date(post.publishedAt);
      return {
        ...post,
        month: date.toLocaleDateString("en-US", { month: "short" }).toUpperCase(),
        day: date.toLocaleDateString("en-US", { day: "2-digit" }),
        date: date.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" }),
      };
    });

  return (
    <div className="min-h-screen bg-[#edf1ee] p-4 md:p-7" style={{ fontFamily: "'Segoe UI', 'Arial', sans-serif" }}>

      {/* ── Hero Banner ─────────────────────────────────────────── */}
      <div className="mb-7 border border-[#c9d1ca] bg-white shadow-[0_12px_28px_rgba(18,51,35,0.05)]">

        {/* Hero body */}
        <div className="bg-white px-5 pt-8 pb-6 md:px-10 md:pt-10 md:pb-8">
          <p className="mb-4 text-sm font-bold tracking-wide uppercase text-[#6a766e]">
            Public Service Portal
          </p>
          <div className="mb-3 flex flex-wrap items-center gap-4">
            <img
              src={publicAsset("officials/brgylagasit.png")}
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
          <p className="mb-8 max-w-lg text-base leading-relaxed text-[#53645b]">
            Official certification appointment and inquiry system. Book appointments, track
            requests, and get quick answers from LagaBot.
          </p>
          <div className="flex gap-3 flex-wrap">
            <button
              onClick={() => setActivePage("book")}
              className="flex min-h-12 items-center gap-2 px-6 py-3 text-sm font-bold text-white transition-opacity hover:opacity-90"
              style={{ background: "#123323" }}
            >
              BOOK APPOINTMENT <ChevronRight className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setActivePage("chat")}
              className="flex min-h-12 items-center gap-2 border border-[#c9d1ca] bg-[#f4f8f4] px-6 py-3 text-sm font-bold text-[#123323] transition-all hover:bg-[#edf5ee]"
            >
              ASK LAGABOT <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Info strip */}
        <div
          className="flex flex-wrap items-center gap-x-8 gap-y-3 px-5 py-4 md:px-10"
          style={{ background: "#f4f8f4", borderTop: "1px solid #c9d1ca" }}
        >
          {[
            { icon: MapPin, text: "Barangay Hall, San Quintin, Pangasinan" },
            { icon: Phone, text: "Contact information to be confirmed" },
            { icon: Clock,  text: "Mon-Fri: 8:00 AM – 5:00 PM" },
          ].map(({ icon: Icon, text }) => (
            <span key={text} className="flex items-center gap-1.5 text-sm" style={{ color: "#53645b" }}>
              <Icon className="w-3 h-3" style={{ color: "#bf6318" }} />
              {text}
            </span>
          ))}
        </div>
      </div>

      {/* ── Grid ────────────────────────────────────────────────── */}
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px] lg:gap-7">

        {/* Announcements */}
<div className="bg-white" style={{ border: "1px solid #c9d1ca" }}>
          <div
            className="flex justify-between items-center px-5 py-3"
            style={{ background: "#f4f8f4", borderBottom: "1px solid #c9d1ca" }}
          >
            <span className="text-sm font-bold tracking-wide uppercase text-[#51635d]">Latest Announcements</span>
            <span className="text-sm font-bold tracking-wide text-[#6a766e]">
              {announcements.length} ITEMS
            </span>
          </div>

          {announcements.map((a, i) => (
            <div
              key={a.id}
              className="flex gap-5 px-5 py-5 transition-colors"
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
                <div className="text-xs font-bold tracking-wide" style={{ color: "#6e6b65" }}>{a.month}</div>
                <div className="text-2xl font-bold leading-tight mt-0.5">{a.day}</div>
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2.5 mb-2">
                  <span
                    className="text-xs font-bold tracking-wide px-2 py-1"
                    style={typeBadgeStyle(a.type)}
                  >
                    {a.type}
                  </span>
                  <span className="text-sm font-semibold" style={{ color: "#6e6b65" }}>{a.date}</span>
                </div>
                <p className="text-base font-bold leading-snug mb-1.5">{a.title}</p>
                <p className="text-sm leading-relaxed line-clamp-2" style={{ color: "#53645b" }}>{a.content}</p>
              </div>

            </div>
          ))}

          <div className="px-5 py-3.5" style={{ borderTop: "1px solid #c4c0b9" }}>
            <p className="text-sm font-semibold text-[#53645b]">Showing the latest public announcements.</p>
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
              <span className="text-sm font-bold tracking-wide">QUICK LINKS</span>
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
                  <p className="text-base font-bold mb-0.5">{link.name}</p>
                  <p className="text-sm" style={{ color: "#53645b" }}>{link.desc}</p>
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
              <span className="text-sm font-bold tracking-wide">SYSTEM STATUS</span>
            </div>
            {systemStatuses.map((s, i) => (
              <div
                key={s.name}
                className="flex justify-between items-center px-4 py-3.5"
                style={{ borderBottom: i < systemStatuses.length - 1 ? "1px solid #c4c0b9" : "none" }}
              >
                <span className="text-base font-bold">{s.name}</span>
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

      {/* Floating FAQ assistant shortcut */}
      <button
        onClick={() => setActivePage("chat")}
        className="fixed bottom-7 right-7 w-14 h-14 text-white flex items-center justify-center shadow-xl transition-opacity hover:opacity-80 z-10"
        style={{ background: "#0f0e0c", borderRadius: "50%" }}
      >
        <span className="text-[8px] font-bold tracking-[0.08em] leading-tight text-center">ASK<br />FAQ</span>
      </button>
    </div>
  );
}
