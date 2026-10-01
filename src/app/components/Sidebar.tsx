import { Home, MessageSquare, Calendar, LayoutDashboard, Shield, LogOut, BookOpen, X } from "lucide-react";

type Page = "home" | "chat" | "book" | "dashboard" | "admin" | "docs";

interface SidebarProps {
  activePage: Page;
  setActivePage: (page: Page) => void;
  userName: string;
  userType: "user" | "admin";
  userId: string;
  onLogout: () => void;
  isOpen: boolean;
  onClose: () => void;
}

const navItems = [
  { id: "home" as Page, label: "Home", icon: Home },
  { id: "chat" as Page, label: "Chat", icon: MessageSquare },
  { id: "book" as Page, label: "Book", icon: Calendar },
  { id: "dashboard" as Page, label: "Dashboard", icon: LayoutDashboard },
  { id: "docs" as Page, label: "Prototype", icon: BookOpen },
];

export default function Sidebar({ activePage, setActivePage, userName, userType, userId, onLogout, isOpen, onClose }: SidebarProps) {
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
            src="officials/brgylagasit.png"
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
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activePage === item.id;
            return (
              <button
                key={item.id}
                onClick={() => handleNav(item.id)}
                className="w-full flex items-center gap-2.5 px-3 py-2.5 text-[11px] tracking-[0.08em] font-bold text-left transition-all duration-150"
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

        {/* Admin Access */}
        <div className="px-4 py-3" style={{ borderTop: "1px solid #c4c0b9" }}>
          <div className="text-[9px] font-bold tracking-[0.15em] mb-2.5" style={{ color: "#9e9b96" }}>
            ADMIN_ACCESS
          </div>
          {userType === "admin" ? (
            <button
              onClick={() => handleNav("admin")}
              className="w-full flex items-center gap-2 py-2 text-[11px] tracking-[0.06em] text-left transition-colors"
              style={{ color: activePage === "admin" ? "#0f0e0c" : "#6e6b65", fontWeight: activePage === "admin" ? 700 : 400 }}
            >
              <Shield className="w-3.5 h-3.5 flex-shrink-0" />
              <span>Admin</span>
              <span
                className="ml-auto text-white text-[8px] px-1.5 py-0.5 font-bold tracking-[0.1em]"
                style={{ background: "#0f0e0c" }}
              >
                STAFF
              </span>
            </button>
          ) : (
            <div className="text-[10px] italic" style={{ color: "#c4c0b9" }}>No admin access</div>
          )}
        </div>

        {/* Resident User */}
        <div className="px-4 py-3" style={{ borderTop: "1px solid #c4c0b9" }}>
          <div className="text-[9px] font-bold tracking-[0.15em] mb-2.5" style={{ color: "#9e9b96" }}>
            RESIDENT USER
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
          <button
            onClick={() => { onLogout(); onClose(); }}
            className="flex items-center gap-1.5 text-[9px] font-bold tracking-[0.1em] transition-colors hover:text-foreground"
            style={{ color: "#9e9b96" }}
          >
            <LogOut className="w-3 h-3" />
            LOGOUT
          </button>
        </div>
      </aside>
    </>
  );
}
