import { Home, MessageSquare, Calendar, LayoutDashboard, Shield, X, Clock, MessageSquareText, UserRound } from "lucide-react";
import { publicAsset } from "../publicAsset";

type Page = "home" | "chat" | "book" | "dashboard" | "admin" | "schedule" | "concerns" | "profile" | "staff-concerns" | "staff-residents" | "staff-schedule" | "staff-news";

interface SidebarProps {
  activePage: Page;
  setActivePage: (page: Page) => void;
  userName: string;
  userType: "user" | "admin";
  userId: string;
  isOpen: boolean;
  onClose: () => void;
}

const navItems = [
  { id: "home" as Page, label: "Home", icon: Home },
  { id: "chat" as Page, label: "LagaBot", icon: MessageSquare },
  { id: "book" as Page, label: "Book", icon: Calendar },
  { id: "dashboard" as Page, label: "Dashboard", icon: LayoutDashboard },
  { id: "schedule" as Page, label: "Walk-in schedule", icon: Clock },
  { id: "concerns" as Page, label: "Concerns & feedback", icon: MessageSquareText },
  { id: "profile" as Page, label: "My profile", icon: UserRound },
];

const staffNavItems = [
  { id: "admin" as Page, label: "Admin dashboard", icon: Shield },
  { id: "staff-concerns" as Page, label: "Concerns & feedback", icon: MessageSquareText },
  { id: "staff-residents" as Page, label: "Resident masterlist", icon: UserRound },
  { id: "staff-schedule" as Page, label: "Walk-in schedule", icon: Clock },
  { id: "staff-news" as Page, label: "Landing page news", icon: MessageSquare },
];

export default function Sidebar({ activePage, setActivePage, userName, userType, userId, isOpen, onClose }: SidebarProps) {
  const visibleNavItems = userType === "admin"
    ? staffNavItems
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
        className={[
          "fixed left-0 top-0 z-40 flex flex-col h-screen bg-white transition-transform duration-300 ease-in-out",
          "w-[192px]",
          // Mobile: slide in/out; Desktop: always visible
          isOpen ? "translate-x-0" : "-translate-x-full",
          "md:translate-x-0",
        ].join(" ")}
        style={{ borderRight: "1px solid #c4c0b9", boxShadow: "2px 0 12px rgba(0,0,0,0.06)" }}
      >
        {/* Logo + mobile close */}
        <div className="flex items-center gap-3 px-4 py-4" style={{ borderBottom: "1px solid #c4c0b9" }}>
          <img
            src={publicAsset("officials/brgylagasit.png")}
            alt="Barangay Lagasit logo"
            className="w-9 h-9 object-contain rounded-full flex-shrink-0"
          />
          <div className="flex-1 min-w-0">
            <div className="text-[11px] font-bold tracking-[0.12em] leading-none text-foreground truncate">BARANGAY LAGASIT</div>
            <div className="text-[9px] tracking-[0.1em] leading-tight mt-1 text-muted-foreground">PORTAL SYSTEM</div>
          </div>
          <button
            onClick={onClose}
            className="md:hidden w-6 h-6 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 py-3 space-y-0.5 px-2 overflow-y-auto">
          <div className="px-3 pb-2 pt-1 text-[10px] font-bold uppercase tracking-[0.14em] text-[#758179]">
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
          <div className="text-[9px] font-bold tracking-[0.15em] mb-2.5" style={{ color: "#9e9b96" }}>
            {userType === "admin" ? "STAFF USER" : "RESIDENT USER"}
          </div>
          <div className="flex items-center gap-2.5 mb-2.5">
            <div
              className="w-7 h-7 flex items-center justify-center text-[9px] flex-shrink-0 font-bold"
              style={{ background: "#eae7e2", border: "1px solid #c4c0b9", color: "#6e6b65" }}
            >
              {userName.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <div className="text-[10px] font-bold truncate tracking-wide">{userName}</div>
              <div className="text-[9px] tracking-[0.06em]" style={{ color: "#9e9b96" }}>ID: {userId}</div>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
