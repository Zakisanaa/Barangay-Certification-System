import { useEffect, useState } from "react";
import { Bell, ChevronRight, MapPin, Phone, Clock } from "lucide-react";
import { getPostPage, PublicPost, subscribePublicPosts } from "../portalData";
import { publicAsset } from "../publicAsset";
import { useOfficeSettings } from "../useOfficeSettings";
import {getServiceConfiguration} from '../serviceData';
import type {DocumentService} from '../serviceData';
import ListPager from './ListPager';
import LoadFeedback from './LoadFeedback';
import AnnouncementImage from "./AnnouncementImage";

type Page = "home" | "chat" | "book" | "dashboard" | "admin";

interface HomePageProps {
  setActivePage: (page: Page) => void;onBookService?:(service:string)=>void;
}

const typeBadgeStyle = (type: string) => {
  switch (type) {
    case "ADVISORY": return { background: "#7c3a00", color: "#fff" };
    case "UPDATE":   return { background: "#1a4a1a", color: "#fff" };
    default:         return { background: "#0f0e0c", color: "#fff" };
  }
};

export default function HomePage({ setActivePage,onBookService }: HomePageProps) {
  const office = useOfficeSettings();
  const [page,setPage]=useState(0),[total,setTotal]=useState(0),[loading,setLoading]=useState(true),[error,setError]=useState(""),[revision,setRevision]=useState(0),[services,setServices]=useState<DocumentService[]>([]);
  const [servicesError,setServicesError]=useState(''),[servicesRevision,setServicesRevision]=useState(0);
  const [posts, setPosts] = useState<PublicPost[]>([]);
  useEffect(() => {
    let active = true;
    const refreshPosts = async () => {
      setLoading(true);
      try {
        const loaded=await getPostPage({page,size:5,archived:false});if(active){setPosts(loaded.rows);setTotal(loaded.total);setError("");}
      } catch (error) {
        if(active)setError(error instanceof Error?error.message:"Could not load announcements.");
      }finally{if(active)setLoading(false);}
    };
    void refreshPosts();
    const unsubscribe = subscribePublicPosts(() => { void refreshPosts(); });
    return () => { active = false; unsubscribe(); };
  }, [page,revision]);
  useEffect(()=>{let active=true;void getServiceConfiguration().then(data=>{if(active)setServices(data.services);}).catch(()=>{if(active)setServicesError('Could not load available services.');});setServicesError('');return()=>{active=false;};},[servicesRevision]);
  const quickLinks=services.filter(service=>service.active).slice(0,6).map(service=>({name:service.request_type,desc:"View requirements and book this service"}));

  const announcements = posts
    .filter((post) => !post.archived)
    .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt))
    .map((post) => {
      const date = new Date(post.publishedAt);
      return {
        ...post,
        month: date.toLocaleDateString("en-US", { timeZone:"Asia/Manila", month: "short" }).toUpperCase(),
        day: date.toLocaleDateString("en-US", { timeZone:"Asia/Manila", day: "2-digit" }),
        date: date.toLocaleDateString("en-US", { timeZone:"Asia/Manila", year: "numeric", month: "short", day: "numeric" }),
      };
    });

  return (
    <div className="min-h-full bg-[#edf1ee] p-4 md:p-7" style={{ fontFamily: "'Segoe UI', 'Arial', sans-serif" }}>

      {/* ── Hero Banner ─────────────────────────────────────────── */}
      <div className="mb-7 border border-[#c9d1ca] bg-white shadow-[0_12px_28px_rgba(18,51,35,0.05)]">

        {/* Hero body */}
        <div className="bg-white px-5 pt-8 pb-6 md:px-10 md:pt-10 md:pb-8">
          <p className="mb-4 text-sm font-bold tracking-wide uppercase text-[#6a766e]">
            Public Service Portal
          </p>
          <div className="mb-3 flex flex-wrap items-center gap-4">
            <img
              src={publicAsset("officials/brgylagasit.webp")}
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
            requests, and get quick answers from Banoy.
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
              ASK BANOY <ChevronRight className="w-3.5 h-3.5" />
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
            { icon: Phone, text: office?.contact_number || "Contact information to be confirmed" },
            { icon: Clock, text: office?.office_hours || "Office hours to be confirmed by staff" },
          ].map(({ icon: Icon, text }) => (
            <span key={text} className="flex min-w-0 items-center gap-1.5 text-sm" style={{ color: "#53645b" }}>
              <Icon className="w-3 h-3 flex-shrink-0" style={{ color: "#bf6318" }} />
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
              {total} ITEMS
            </span>
          </div>

          <LoadFeedback loading={loading} error={error} onRetry={()=>setRevision(value=>value+1)} label="announcements"/>
          {!loading&&!error&&!announcements.length&&<p className="p-5 text-sm">No announcements have been published.</p>}
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
                <details className="mt-2 text-sm"><summary className="min-h-11 cursor-pointer py-2 font-semibold text-[#123323]">Read full announcement</summary><p className="whitespace-pre-wrap break-words leading-relaxed">{a.content}</p></details>
                <AnnouncementImage post={a} />
              </div>

            </div>
          ))}

          <ListPager page={page} total={total} size={5} onPage={setPage}/>
          <div className="px-5 py-3.5" style={{ borderTop: "1px solid #c4c0b9" }}>
            <p className="text-sm font-semibold text-[#53645b]">All announcement dates use Asia/Manila.</p>
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
            {servicesError&&<LoadFeedback loading={false} error={servicesError} onRetry={()=>setServicesRevision(value=>value+1)} label="services"/>}
          {quickLinks.map((link, i) => (
              <button
                key={link.name}
                onClick={() => onBookService?onBookService(link.name):setActivePage("book")}
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

          <section className="border border-[#c9d1ca] bg-white p-4"><h2 className="mb-3 text-sm font-bold">PORTAL FEATURES</h2><p className="text-sm text-[#53645b]">Book an appointment, ask Banoy, or view the posted walk-in schedule using the navigation menu.</p></section>
        </div>
      </div>

      {/* Floating FAQ assistant shortcut */}
      <button
        type="button"
        aria-label="Ask Banoy"
        onClick={() => setActivePage("chat")}
        className="fixed bottom-4 right-4 z-10 flex h-12 w-12 items-center justify-center text-white shadow-xl transition-opacity hover:opacity-80 md:bottom-7 md:right-7 md:h-14 md:w-14"
        style={{ background: "#0f0e0c", borderRadius: "50%" }}
      >
        <span className="text-xs font-bold tracking-[0.08em] leading-tight text-center">ASK<br />FAQ</span>
      </button>
    </div>
  );
}
