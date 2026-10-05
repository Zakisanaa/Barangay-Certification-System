import { useEffect, useState } from "react";
import { LogOut, Menu } from "lucide-react";
import { Toaster } from "./components/ui/sonner";
import AuthPage from "./components/AuthPage";
import LandingPage from "./components/LandingPage";
import Sidebar from "./components/Sidebar";
import HomePage from "./components/HomePage";
import ChatPage from "./components/ChatPage";
import BookPage from "./components/BookPage";
import DashboardPage from "./components/DashboardPage";
import AdminPage from "./components/AdminPage";
import AdminServicesPage from "./components/AdminServicesPage";
import LandingNewsManager from "./components/LandingNewsManager";
import WalkInSchedulePage from "./components/WalkInSchedulePage";
import ConcernsPage from "./components/ConcernsPage";
import ResidentProfilePage from "./components/ResidentProfilePage";
import { publicAsset } from "./publicAsset";
import { getResidentProfile, getResidentSession, ResidentAccount, signOutResident } from "./residentAuth";
import { isSupabaseConfigured, requireSupabase } from "./supabase";

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
type Page = "home" | "chat" | "book" | "dashboard" | "admin" | "schedule" | "concerns" | "profile" | "staff-concerns" | "staff-residents" | "staff-schedule" | "staff-news";

const PAGE_LABELS: Record<Page, string> = {
  home: "HOME",
  chat: "LAGABOT",
  book: "BOOK",
  dashboard: "DASHBOARD",
  admin: "ADMIN",
  schedule: "WALK-IN SCHEDULE",
  concerns: "CONCERNS & FEEDBACK",
  profile: "MY PROFILE",
  "staff-concerns": "CONCERNS & FEEDBACK",
  "staff-residents": "RESIDENT MASTERLIST",
  "staff-schedule": "WALK-IN SCHEDULE",
  "staff-news": "LANDING PAGE NEWS",
};

export default function App() {
  const staffRoute = window.location.pathname === "/staff";
  const [residentAccount, setResidentAccount] = useState<ResidentAccount | null>(() =>
    null
  );
  const [loggedInAs, setLoggedInAs] = useState<UserType>(null);
  const [userName, setUserName] = useState(() => residentAccount?.name ?? "");
  const [authReady, setAuthReady] = useState(!isSupabaseConfigured);
  const [authError, setAuthError] = useState("");
  const userId = loggedInAs === "admin" ? residentAccount?.id ?? "STAFF" : residentAccount?.id ?? "";
  const [activePage, setActivePage] = useState<Page>("home");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showLanding, setShowLanding] = useState(!staffRoute);

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    let active = true;
    const client = requireSupabase();
    const loadSession = async () => {
      try {
        const account = await getResidentSession();
        if (!active) return;
        if (staffRoute && account?.role !== "staff") {
          if (account) await signOutResident();
          setResidentAccount(null);
          setLoggedInAs(null);
          return;
        }
        if (!staffRoute && account?.role === "staff") {
          setResidentAccount(account);
          setLoggedInAs("admin");
          setUserName(account.name);
          setActivePage("admin");
          setShowLanding(false);
          return;
        }
        if (account) {
          setResidentAccount(account);
          setLoggedInAs(account.role === "staff" ? "admin" : "user");
          setUserName(account.name);
          setActivePage(account.role === "staff" ? "admin" : "home");
          setShowLanding(false);
        }
      } catch (error) {
        if (active) setAuthError(error instanceof Error ? error.message : "Unable to restore your session.");
      } finally {
        if (active) setAuthReady(true);
      }
    };

    void loadSession();
    const { data: authListener } = client.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT" && active) {
        setResidentAccount(null);
        setLoggedInAs(null);
        setUserName("");
      }
    });
    return () => {
      active = false;
      authListener.subscription.unsubscribe();
    };
  }, [staffRoute]);

  const handleLogin = (userType: UserType, name: string, account?: ResidentAccount) => {
    if (account) setResidentAccount(account);
    setLoggedInAs(userType);
    setUserName(name);
    setShowLanding(false);
    setActivePage(userType === "admin" ? "admin" : "home");
  };

  const handleResidentEntry = () => {
    setShowLanding(false);
  };

  const handleLogout = () => {
    if (isSupabaseConfigured) void signOutResident().catch((error: unknown) => {
      console.error("Unable to sign out of the resident portal.", error);
      setAuthError(error instanceof Error ? error.message : "Unable to sign out.");
    });
    setResidentAccount(null);
    setLoggedInAs(null);
    setUserName("");
    setActivePage("home");
    setSidebarOpen(false);
    setShowLanding(true);
    if (window.location.pathname === "/staff") window.history.replaceState(null, "", "/");
  };

  if (!loggedInAs) {
    if (!authReady) {
      return <div className="flex min-h-screen items-center justify-center bg-[#edf1ee] text-base font-semibold text-[#123323]">Connecting to the resident database…</div>;
    }
    return showLanding ? (
      <LandingPage onContinue={handleResidentEntry} />
    ) : (
      <div className="min-h-screen bg-background">
        <Toaster />
        {authError && <p role="alert" className="mx-auto mt-4 max-w-xl rounded border border-red-300 bg-red-50 p-3 text-sm text-red-950">{authError}</p>}
        <AuthPage
          onLogin={handleLogin}
          adminOnly={staffRoute}
          onBackToPublicSite={staffRoute ? () => {
            window.history.replaceState(null, "", "/");
            setShowLanding(true);
          } : undefined}
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
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      {/* Main content area — shifted right on desktop, full width on mobile */}
      <div className="flex flex-col flex-1 md:ml-[192px] min-w-0 overflow-hidden">

        {/* Mobile top bar */}
        <header
          className="flex items-center gap-3 px-4 py-3 bg-white flex-shrink-0 md:px-6"
          style={{ borderBottom: "1px solid #c4c0b9" }}
        >
          <button
            onClick={() => setSidebarOpen(true)}
            className="w-8 h-8 flex items-center justify-center text-foreground hover:bg-secondary transition-colors md:hidden"
            aria-label="Open menu"
          >
            <Menu className="w-4 h-4" />
          </button>
          <div className="flex items-center gap-2.5 min-w-0">
            <img
              src={publicAsset("officials/brgylagasit.png")}
              alt="Barangay Lagasit logo"
              className="w-8 h-8 object-contain rounded-full flex-shrink-0"
            />
            <div className="min-w-0">
              <div className="text-[10px] font-bold tracking-[0.12em] leading-none truncate">BARANGAY LAGASIT</div>
              <div className="text-[8px] tracking-[0.1em] text-muted-foreground leading-tight">PORTAL SYSTEM</div>
            </div>
          </div>
          <div className="ml-auto flex items-center gap-3">
            <div className="hidden text-xs font-bold tracking-wide text-muted-foreground sm:block">
              {PAGE_LABELS[activePage]}
            </div>
            <div className="flex items-center gap-2 border-l border-[#c4c0b9] pl-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#edf5ee] text-sm font-bold text-[#123323]">
                {userName.charAt(0).toUpperCase()}
              </div>
              <div className="max-w-[130px]">
                <div className="truncate text-sm font-bold text-[#122d1f]">{userName}</div>
                <div className="text-xs text-[#53645b]">{loggedInAs === "admin" ? "Staff" : "Resident"}</div>
              </div>
            </div>
            <button
              type="button"
              onClick={handleLogout}
              aria-label="Log out"
              className="flex min-h-10 items-center gap-2 rounded border border-[#c9d1ca] px-3 text-sm font-semibold text-[#53645b] transition-colors hover:border-[#123323] hover:bg-[#f0f5f1] hover:text-[#123323]"
            >
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline">Log out</span>
            </button>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto">
          {activePage === "home" && <HomePage setActivePage={setActivePage} />}
          {activePage === "chat" && <ChatPage />}
          {activePage === "book" && residentAccount?.role === "resident" && (
            <BookPage setActivePage={setActivePage} resident={residentAccount} />
          )}
          {activePage === "dashboard" && residentAccount?.role === "resident" && (
            <DashboardPage userName={userName} userId={userId} resident={residentAccount} setActivePage={setActivePage} />
          )}
          {activePage === "schedule" && loggedInAs !== "admin" && <WalkInSchedulePage />}
          {activePage === "staff-concerns" && loggedInAs === "admin" && <AdminServicesPage key="concerns" initialTab="concerns" />}
          {activePage === "staff-residents" && loggedInAs === "admin" && <AdminServicesPage key="residents" initialTab="residents" />}
          {activePage === "staff-schedule" && loggedInAs === "admin" && <AdminServicesPage key="staff-schedule" initialTab="schedule" />}
          {activePage === "staff-news" && loggedInAs === "admin" && <LandingNewsManager />}
          {activePage === "concerns" && residentAccount?.role === "resident" && (
            <ConcernsPage
              residentName={residentAccount.name}
              residentId={residentAccount.id}
              contact={residentAccount.contactNumber}
            />
          )}
          {activePage === "profile" && residentAccount?.role === "resident" && (
            <ResidentProfilePage
              resident={residentAccount}
              onProfileUpdated={(account) => {
                setResidentAccount(account);
                setUserName(account.name);
              }}
            />
          )}
          {activePage === "admin" && loggedInAs === "admin" && residentAccount && <AdminPage resident={residentAccount} />}
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
