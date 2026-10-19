import { Home, MessageSquare, Calendar, LayoutDashboard, Shield, X, Clock, MessageSquareText, UserRound, Settings, Receipt } from "lucide-react";
import { publicAsset } from "../publicAsset";
import { useEffect, useRef } from "react";
import { canManage } from '../access';
import type { ResidentAccount } from '../residentAuth';

type Page = "home" | "chat" | "book" | "dashboard" | "admin" | "schedule" | "concerns" | "profile" | "staff-concerns" | "staff-residents" | "staff-schedule" | "staff-news" | "staff-settings" | "staff-banoy" | "staff-inbox" | "staff-queue" | "staff-register" | "staff-payments" | "staff-reports" | "staff-audit" | "staff-accounts" | "staff-content" | "fees";

interface SidebarProps {
  activePage: Page;
  setActivePage: (page: Page) => void;
  userName: string;
  userType: "user" | "admin";
  userId: string;
  isOpen: boolean;
  onClose: () => void;
  account?: ResidentAccount | null;
}

const navItems = [
  { id: "home" as Page, label: "Home", icon: Home },
  { id: "chat" as Page, label: "Banoy", icon: MessageSquare },
  { id: "book" as Page, label: "Book", icon: Calendar },
  { id: "dashboard" as Page, label: "Dashboard", icon: LayoutDashboard },
  { id: "fees" as Page, label: "Fees & receipts", icon: Receipt },
  { id: "schedule" as Page, label: "Walk-in schedule", icon: Clock },
  { id: "concerns" as Page, label: "Concerns & feedback", icon: MessageSquareText },
  { id: "profile" as Page, label: "My profile", icon: UserRound },
];

const staffNavItems = [
  { id: "staff-inbox" as Page, label: "Notification inbox", icon: MessageSquare },
  { id: "admin" as Page, label: "Admin dashboard", icon: Shield },
  { id: "staff-concerns" as Page, label: "Concerns & feedback", icon: MessageSquareText },
  { id: "staff-residents" as Page, label: "Resident masterlist", icon: UserRound },
  { id: "staff-schedule" as Page, label: "Walk-in schedule", icon: Clock },
  { id: "staff-news" as Page, label: "Landing page news", icon: MessageSquare },
  { id: "staff-settings" as Page, label: "Services & booking", icon: Settings },
  { id: "staff-banoy" as Page, label: "Banoy knowledge", icon: MessageSquare },
  { id: "staff-queue" as Page, label: "Office queue", icon: Calendar },
  { id: "staff-register" as Page, label: "Certificate register", icon: Shield },
  { id: "staff-payments" as Page, label: "Fee records", icon: Shield },
  { id: "staff-reports" as Page, label: "Operational reports", icon: LayoutDashboard },
  { id: "staff-content" as Page, label: "Public site content", icon: Settings },
  { id: "staff-audit" as Page, label: "Audit history", icon: Clock },
  { id: "staff-accounts" as Page, label: "Staff accounts", icon: UserRound },
  { id: "profile" as Page, label: "My profile", icon: UserRound },
];

export default function Sidebar({ activePage, setActivePage, userName, userType, userId, isOpen, onClose, account }: SidebarProps) {
  const panel = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!isOpen) return;
    const previousFocus = document.activeElement as HTMLElement | null;
    const close = panel.current?.querySelector<HTMLButtonElement>('[aria-label="Close navigation"]');
    close?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") { onClose(); return; }
      if (event.key !== "Tab") return;
      const buttons = Array.from(panel.current?.querySelectorAll<HTMLElement>('button, a[href]') ?? []).filter(element => element.getClientRects().length);
      const first = buttons[0]; const last = buttons[buttons.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => { document.removeEventListener("keydown", onKeyDown); previousFocus?.focus(); };
  }, [isOpen, onClose]);
  const visibleNavItems = userType === "admin"
    ? staffNavItems.filter(item=>{
      if(item.id==='admin')return canManage(account,'requests')||canManage(account,'certificates');
      const permission=({'staff-concerns':'concerns','staff-residents':'residents','staff-schedule':'schedules','staff-news':'content','staff-settings':'settings','staff-banoy':'knowledge','staff-queue':'requests','staff-register':'certificates','staff-payments':'payments','staff-reports':'reports','staff-audit':'audit','staff-content':'content'} as Partial<Record<Page,import('../adminData').StaffPermission>>)[item.id];
      return item.id==='staff-accounts'?account?.superadmin===true:permission?canManage(account,permission):true;
    })
    : navItems;
  const handleNav = (page: Page) => {
    setActivePage(page);
    onClose();
  };

  return (
    <>
      {/* Mobile overlay backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/40 md:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar panel */}
      <aside
        ref={panel}
        id="portal-navigation"
        aria-label="Portal navigation"
        className={[
          "fixed left-0 top-0 z-40 flex h-dvh flex-col bg-white transition-transform duration-300 ease-in-out",
          "w-[260px] max-w-[calc(100vw-2rem)] md:w-[192px]",
          // Mobile: slide in/out; Desktop: always visible
          isOpen ? "translate-x-0" : "-translate-x-full",
          "md:translate-x-0",
        ].join(" ")}
        style={{ borderRight: "1px solid #c4c0b9", boxShadow: "2px 0 12px rgba(0,0,0,0.06)" }}
      >
        {/* Logo + mobile close */}
        <div className="flex items-center gap-3 px-4 py-4" style={{ borderBottom: "1px solid #c4c0b9" }}>
          <img
            src={publicAsset("officials/brgylagasit.webp")}
            alt="Barangay Lagasit logo"
            className="w-9 h-9 object-contain rounded-full flex-shrink-0"
          />
          <div className="flex-1 min-w-0">
            <div className="text-xs font-bold tracking-[0.12em] leading-none text-foreground truncate">BARANGAY LAGASIT</div>
            <div className="text-xs tracking-[0.1em] leading-tight mt-1 text-muted-foreground">PORTAL SYSTEM</div>
          </div>
          <button
            type="button"
            aria-label="Close navigation"
            onClick={onClose}
            className="md:hidden w-6 h-6 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Nav */}
        <nav className="portal-nav-scroll min-h-0 flex-1 overflow-y-auto overscroll-y-contain py-3 space-y-0.5 px-2">
          <div className="px-3 pb-2 pt-1 text-xs font-bold uppercase tracking-[0.14em] text-[#758179]">
            {userType === "admin" ? "Staff workspace" : "Resident services"}
          </div>
          {visibleNavItems.map((item) => {
            const Icon = item.icon;
            const isActive = activePage === item.id;
            return (
              <button
                key={item.id}
                onClick={() => handleNav(item.id)}
                className="w-full flex min-h-11 items-center gap-2.5 px-3 py-2.5 text-sm font-semibold text-left transition-all duration-150"
                style={{
                  background: isActive ? "#f0ede8" : "transparent",
                  color: isActive ? "#0f0e0c" : "#6e6b65",
                  borderLeft: isActive ? "2px solid #0f0e0c" : "2px solid transparent",
                }}
              >
                <Icon className="w-3.5 h-3.5 flex-shrink-0" />
                {item.label}
              </button>
            );
          })}
        </nav>

        {/* Resident User */}
        <div className="px-4 py-3" style={{ borderTop: "1px solid #c4c0b9" }}>
          <div className="text-xs font-bold tracking-[0.15em] mb-2.5" style={{ color: "#61645f" }}>
            {userType === "admin" ? "STAFF USER" : "RESIDENT USER"}
          </div>
          <div className="flex items-center gap-2.5 mb-2.5">
            <div
              className="w-7 h-7 flex items-center justify-center text-xs flex-shrink-0 font-bold"
              style={{ background: "#eae7e2", border: "1px solid #c4c0b9", color: "#6e6b65" }}
            >
              {userName.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <div className="text-xs font-bold truncate tracking-wide">{userName}</div>
              <div className="truncate text-xs tracking-[0.06em]" style={{ color: "#61645f" }} title={userId}>ID: {userId}</div>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
