import { useState } from "react";
import { Menu } from "lucide-react";
import { Toaster } from "./components/ui/sonner";
import AuthPage from "./components/AuthPage";
import LandingPage from "./components/LandingPage";
import Sidebar from "./components/Sidebar";
import HomePage from "./components/HomePage";
import ChatPage from "./components/ChatPage";
import BookPage from "./components/BookPage";
import DashboardPage from "./components/DashboardPage";
import AdminPage from "./components/AdminPage";
import PrototypeDocs from "./components/PrototypeDocs";

/* MARKER-MAKE-KIT-INVOKED */

export interface RegisteredUser {
  firstName: string;
  lastName: string;
  email: string;
  contactNumber: string;
  address: string;
  password: string;
}

type UserType = "user" | "admin" | null;
type Page = "home" | "chat" | "book" | "dashboard" | "admin" | "docs";

const PAGE_LABELS: Record<Page, string> = {
  home: "HOME",
  chat: "CHAT",
  book: "BOOK",
  dashboard: "DASHBOARD",
  admin: "ADMIN",
  docs: "PROTOTYPE",
};

export default function App() {
  const [loggedInAs, setLoggedInAs] = useState<UserType>(null);
  const [userName, setUserName] = useState("");
  const [userId] = useState("RES-00142");
  const [activePage, setActivePage] = useState<Page>("home");
  const [registeredUsers, setRegisteredUsers] = useState<RegisteredUser[]>([]);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showLanding, setShowLanding] = useState(true);

  const handleRegister = (user: RegisteredUser) => {
    setRegisteredUsers((prev) => [...prev, user]);
  };

  const handlePasswordReset = (email: string, newPassword: string) => {
    setRegisteredUsers((prev) =>
      prev.map((u) => (u.email === email ? { ...u, password: newPassword } : u))
    );
  };

  const handleLogin = (userType: UserType, name: string) => {
    setLoggedInAs(userType);
    setUserName(name);
    setActivePage("home");
  };

  const handleLogout = () => {
    setLoggedInAs(null);
    setUserName("");
    setActivePage("home");
    setSidebarOpen(false);
    setShowLanding(true);
  };

  if (!loggedInAs) {
    return showLanding ? (
      <LandingPage onContinue={() => setShowLanding(false)} />
    ) : (
      <div className="min-h-screen bg-background">
        <Toaster />
        <AuthPage
          onLogin={handleLogin}
          onRegister={handleRegister}
          onPasswordReset={handlePasswordReset}
          registeredUsers={registeredUsers}
        />
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <Toaster />

      <Sidebar
        activePage={activePage}
        setActivePage={setActivePage}
        userName={userName}
        userType={loggedInAs}
        userId={userId}
        onLogout={handleLogout}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      {/* Main content area — shifted right on desktop, full width on mobile */}
      <div className="flex flex-col flex-1 md:ml-[192px] min-w-0 overflow-hidden">

        {/* Mobile top bar */}
        <header
          className="md:hidden flex items-center gap-3 px-4 py-3 bg-white flex-shrink-0"
          style={{ borderBottom: "1px solid #c4c0b9" }}
        >
          <button
            onClick={() => setSidebarOpen(true)}
            className="w-8 h-8 flex items-center justify-center text-foreground hover:bg-secondary transition-colors"
            aria-label="Open menu"
          >
            <Menu className="w-4 h-4" />
          </button>
          <div className="flex items-center gap-2.5 min-w-0">
            <img
              src="officials/brgylagasit.png"
              alt="Barangay Lagasit logo"
              className="w-8 h-8 object-contain rounded-full flex-shrink-0"
            />
            <div className="min-w-0">
              <div className="text-[10px] font-bold tracking-[0.12em] leading-none truncate">BARANGAY LAGASIT</div>
              <div className="text-[8px] tracking-[0.1em] text-muted-foreground leading-tight">PORTAL SYSTEM</div>
            </div>
          </div>
          <div className="ml-auto text-[9px] font-bold tracking-[0.14em] text-muted-foreground">
            {PAGE_LABELS[activePage]}
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto">
          {activePage === "home" && <HomePage setActivePage={setActivePage} />}
          {activePage === "chat" && <ChatPage />}
          {activePage === "book" && <BookPage />}
          {activePage === "dashboard" && (
            <DashboardPage userName={userName} userId={userId} setActivePage={setActivePage} />
          )}
          {activePage === "admin" && loggedInAs === "admin" && <AdminPage />}
          {activePage === "docs" && <PrototypeDocs />}
          {activePage === "admin" && loggedInAs !== "admin" && (
            <div className="p-6">
              <div className="border border-border bg-white p-8 max-w-md">
                <div className="text-[10px] font-bold tracking-widest text-muted-foreground mb-2">ACCESS_DENIED</div>
                <div className="text-sm font-bold">Admin access is restricted to staff only.</div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
