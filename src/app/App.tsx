import {lazy,Suspense} from 'react';
import {confirmDiscardChanges} from './useUnsavedChanges';
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { LogOut, Menu } from "lucide-react";
import { Toaster } from "./components/ui/sonner";
import AuthPage from "./components/AuthPage";
import AuthLinkFeedback from './components/AuthLinkFeedback';
import LandingPage from "./components/LandingPage";
import Sidebar from "./components/Sidebar";
import PageBoundary from './components/PageBoundary';
const HomePage=lazy(()=>import('./components/HomePage'));
const ChatPage=lazy(()=>import('./components/ChatPage'));
const BookPage=lazy(()=>import('./components/BookPage'));
const DashboardPage=lazy(()=>import('./components/DashboardPage'));
const AdminPage=lazy(()=>import('./components/AdminPage'));
const AdminServicesPage=lazy(()=>import('./components/AdminServicesPage'));
const LandingNewsManager=lazy(()=>import('./components/LandingNewsManager'));
const WalkInSchedulePage=lazy(()=>import('./components/WalkInSchedulePage'));
const ConcernsPage=lazy(()=>import('./components/ConcernsPage'));
const ResidentProfilePage=lazy(()=>import('./components/ResidentProfilePage'));
const ServiceSettingsPage=lazy(()=>import('./components/ServiceSettingsPage'));
const ChatbotKnowledgePage=lazy(()=>import('./components/ChatbotKnowledgePage'));
import PasswordRecovery from "./components/PasswordRecovery";
import { publicAsset } from "./publicAsset";
import { getResidentProfile, getResidentSession, ResidentAccount, signOutResident } from "./residentAuth";
import { isSupabaseConfigured, requireSupabase } from "./supabase";
import { passwordRecoveryState } from "./passwordRecoveryState";
import { canManage } from './access';
import { subscribeAdminTables } from './adminData';
import type {WorkflowNavigate,WorkflowTarget} from './workflowNavigation';
const StaffManagementPage=lazy(()=>import('./components/StaffManagementPage'));
const StaffInboxPage=lazy(()=>import('./components/StaffInboxPage'));
const OfficeQueuePage=lazy(()=>import('./components/OfficeQueuePage'));
const CertificateRegisterPage=lazy(()=>import('./components/CertificateRegisterPage'));
const ResidentFeeRecordsPage=lazy(()=>import('./components/ResidentFeeRecordsPage'));
const FeeRecordsPage=lazy(()=>import('./components/FeeRecordsPage'));
const OperationalReportsPage=lazy(()=>import('./components/OperationalReportsPage'));
const AuditLogPage=lazy(()=>import('./components/AuditLogPage'));
const PublicContentManager=lazy(()=>import('./components/PublicContentManager'));

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
type Page = "home" | "chat" | "book" | "dashboard" | "admin" | "schedule" | "concerns" | "profile" | "staff-concerns" | "staff-residents" | "staff-schedule" | "staff-news" | "staff-settings" | "staff-banoy" | "staff-inbox" | "staff-queue" | "staff-register" | "staff-payments" | "staff-reports" | "staff-audit" | "staff-accounts" | "staff-content" | "fees";

const PAGE_LABELS: Record<Page, string> = {
  'staff-inbox':'NOTIFICATION INBOX','staff-queue':'OFFICE QUEUE','staff-register':'CERTIFICATE REGISTER','staff-payments':'FEE RECORDS','staff-reports':'REPORTS','staff-audit':'AUDIT HISTORY','staff-accounts':'STAFF ACCOUNTS','staff-content':'PUBLIC SITE CONTENT',
  home: "HOME",
  chat: "BANOY",
  book: "BOOK",
  dashboard: "DASHBOARD",
  admin: "ADMIN",
  schedule: "WALK-IN SCHEDULE",
  concerns: "CONCERNS & FEEDBACK",
  profile: "MY PROFILE",
  fees: "MY FEES & RECEIPTS",
  "staff-concerns": "CONCERNS & FEEDBACK",
  "staff-residents": "RESIDENT MASTERLIST",
  "staff-schedule": "WALK-IN SCHEDULE",
  "staff-news": "LANDING PAGE NEWS",
  "staff-settings": "SERVICES & BOOKING",
  "staff-banoy": "BANOY KNOWLEDGE",
};

export default function App(){return <><AuthLinkFeedback/><Portal/></>;}

function Portal() {
  const staffRoute = window.location.pathname === "/staff";
  const [residentAccount, setResidentAccount] = useState<ResidentAccount | null>(() =>
    null
  );
  const [loggedInAs, setLoggedInAs] = useState<UserType>(null);
  const [userName, setUserName] = useState(() => residentAccount?.name ?? "");
  const [authReady, setAuthReady] = useState(!isSupabaseConfigured);
  const [authError, setAuthError] = useState("");
  const [loggingOut, setLoggingOut] = useState(false);
  const logoutLock = useRef(false);
  const userId = loggedInAs === "admin" ? residentAccount?.id ?? "STAFF" : residentAccount?.id ?? "";
  const [bookingService,setBookingService]=useState<string|undefined>();
  const [activePage, setActivePage] = useState<Page>("home");
  const [focusReference,setFocusReference]=useState<string|undefined>();
  const [transactionTarget,setTransactionTarget]=useState<WorkflowTarget|undefined>();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showLanding, setShowLanding] = useState(!staffRoute);
  const recoveringPassword = useSyncExternalStore(passwordRecoveryState.subscribe, passwordRecoveryState.getSnapshot);
  const accountRef=useRef(residentAccount);accountRef.current=residentAccount;
  const mainRef=useRef<HTMLElement>(null);
  useEffect(()=>{mainRef.current?.scrollTo({top:0,left:0});},[activePage,loggedInAs]);
  useEffect(()=>{
    if(!loggedInAs||recoveringPassword)return;
    document.documentElement.classList.add('portal-active');
    return()=>document.documentElement.classList.remove('portal-active');
  },[loggedInAs,recoveringPassword]);

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    let active = true;let generation=0;
    const client = requireSupabase();
    const loadSession = async () => {
      const requested=++generation;
      try {
        const account = await getResidentSession();
        if (!active || requested!==generation || passwordRecoveryState.getSnapshot()) return;
        const sameAccount=accountRef.current?.id===account?.id&&accountRef.current?.role===account?.role;
        setAuthError('');
        if(!sameAccount){setFocusReference(undefined);setTransactionTarget(undefined);setSidebarOpen(false);}
        if(!account){setResidentAccount(null);setLoggedInAs(null);setUserName('');return;}
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
          if(!sameAccount)setActivePage(canManage(account,'requests')||canManage(account,'certificates')?'admin':'staff-inbox');
          setShowLanding(false);
          return;
        }
        if (account) {
          setResidentAccount(account);
          setLoggedInAs(account.role === "staff" ? "admin" : "user");
          setUserName(account.name);
          if(!sameAccount)setActivePage(account.role === "staff" ? (canManage(account,'requests')||canManage(account,'certificates')?'admin':'staff-inbox') : "home");
          setShowLanding(false);
        }
      } catch (error) {
        if(active&&requested===generation){setResidentAccount(null);setLoggedInAs(null);setUserName('');setFocusReference(undefined);setShowLanding(false);setAuthError(error instanceof Error?error.message:'Unable to restore your session. Sign in again.');}
      } finally {
        if (active&&requested===generation) setAuthReady(true);
      }
    };

    const { data: authListener } = client.auth.onAuthStateChange((event,session) => {
      if(active&&session?.user?.id&&session.user.id!==accountRef.current?.id){setResidentAccount(null);setLoggedInAs(null);setUserName("");setAuthReady(false);setFocusReference(undefined);}
      if (event === "PASSWORD_RECOVERY" && active) passwordRecoveryState.begin();
      if (event === "SIGNED_OUT" && active) {
        generation++;
        setResidentAccount(null);
        setLoggedInAs(null);
        setUserName("");
      }
      if(['SIGNED_IN','TOKEN_REFRESHED','USER_UPDATED'].includes(event)&&active)setTimeout(()=>{if(active)void loadSession();},0);
    });
    void loadSession();
    const unsubscribeAccess=subscribeAdminTables(['staff_access','resident_profiles'],()=>void loadSession());
    return () => {
      active = false;
      authListener.subscription.unsubscribe();
      unsubscribeAccess();
    };
  }, [staffRoute, recoveringPassword]);

  const navigate=(page:Page,service?:string)=>{if(page!==activePage&&!confirmDiscardChanges())return;if(page==='book')setBookingService(service);setFocusReference(undefined);setTransactionTarget(undefined);setActivePage(page);};
  const openWorkflow:WorkflowNavigate=(page,reference,mode='record')=>{if(!confirmDiscardChanges())return;setFocusReference(reference);setTransactionTarget(reference?{reference,mode,token:crypto.randomUUID()}:undefined);setActivePage(page);};
  const handleLogin = (userType: UserType, name: string, account?: ResidentAccount) => {
    if (account) setResidentAccount(account);
    setLoggedInAs(userType);
    setUserName(name);
    setShowLanding(false);
    setActivePage(userType === "admin" ? (canManage(account,'requests')||canManage(account,'certificates')?'admin':'staff-inbox') : "home");
  };

  const handleResidentEntry = () => {
    setShowLanding(false);
  };

  const handleLogout = async () => {
    if (logoutLock.current||!confirmDiscardChanges()) return;
    logoutLock.current = true; setLoggingOut(true); setAuthError("");
    try {
      if (isSupabaseConfigured) await signOutResident();
      setResidentAccount(null);
      setLoggedInAs(null);
      setUserName("");
      setActivePage("home");
      setSidebarOpen(false);
      setShowLanding(true);
      if (window.location.pathname === "/staff") window.history.replaceState(null, "", "/");
    } catch (error) {
      console.error("Unable to sign out of the resident portal.", error);
      setAuthError(`Sign-out could not be confirmed. Please try again. ${error instanceof Error ? error.message : ""}`);
    } finally { logoutLock.current = false; setLoggingOut(false); }
  };

  if (recoveringPassword) {
    const returnToLogin = () => {
      const staff = staffRoute || new URLSearchParams(window.location.search).get("staff") === "1";
      window.history.replaceState(null, "", staff ? "/staff" : "/");
      setLoggedInAs(null); setResidentAccount(null); setUserName(""); setShowLanding(false);
      passwordRecoveryState.clear();
    };
    const cancelRecovery = async () => {
      await signOutResident();
      returnToLogin();
    };
    return <div className="flex min-h-dvh items-center justify-center bg-[#edf1ee] p-4"><PasswordRecovery mode="update" onComplete={returnToLogin} onBack={cancelRecovery} /></div>;
  }

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
    <div className="portal-shell flex h-dvh bg-background overflow-hidden">
      <Toaster />

      <Sidebar
        account={residentAccount}
        activePage={activePage}
        setActivePage={page=>navigate(page)}
        userName={userName}
        userType={loggedInAs}
        userId={userId}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      {/* Main content area — shifted right on desktop, full width on mobile */}
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden md:ml-[192px]">

        {/* Mobile top bar */}
        <header
          className="flex shrink-0 items-center gap-2 px-3 py-3 bg-white sm:gap-3 sm:px-4 md:px-6"
          style={{ borderBottom: "1px solid #c4c0b9" }}
        >
          <button
            onClick={() => setSidebarOpen(true)}
            className="w-8 h-8 flex items-center justify-center text-foreground hover:bg-secondary transition-colors md:hidden"
            aria-label="Open menu"
            aria-expanded={sidebarOpen}
            aria-controls="portal-navigation"
          >
            <Menu className="w-4 h-4" />
          </button>
          <div className="flex items-center gap-2.5 min-w-0">
            <img
              src={publicAsset("officials/brgylagasit.webp")}
              alt="Barangay Lagasit logo"
              className="w-8 h-8 object-contain rounded-full flex-shrink-0"
            />
            <div className="min-w-0">
              <div className="text-xs font-bold tracking-[0.12em] leading-none truncate">BARANGAY LAGASIT</div>
              <div className="truncate text-xs text-[#53645b] leading-tight">Times: Asia/Manila</div>
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
              <div className="hidden max-w-[130px] sm:block">
                <div className="truncate text-sm font-bold text-[#122d1f]">{userName}</div>
                <div className="text-xs text-[#53645b]">{residentAccount?.superadmin?'Superadmin':loggedInAs === "admin" ? "Staff" : "Resident"}</div>
              </div>
            </div>
            <button
              type="button"
              onClick={handleLogout}
              disabled={loggingOut}
              aria-label="Log out"
              className="flex min-h-10 items-center gap-2 rounded border border-[#c9d1ca] px-3 text-sm font-semibold text-[#53645b] transition-colors hover:border-[#123323] hover:bg-[#f0f5f1] hover:text-[#123323]"
            >
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline">{loggingOut ? "Signing out…" : "Log out"}</span>
            </button>
          </div>
        </header>
        {authError && <p role="alert" className="border-b border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">{authError}</p>}

        {/* Page content */}
        <main ref={mainRef} key={`${residentAccount?.id}:${residentAccount?.role}:${residentAccount?.superadmin}:${residentAccount?.permissions?.join(',')}`} className={`portal-main min-h-0 min-w-0 flex-1 ${activePage==='chat'?'overflow-hidden':sidebarOpen?'overflow-hidden md:overflow-y-auto':'overflow-y-auto'}`}>
          <PageBoundary key={activePage}><Suspense fallback={<p role="status" className="p-6 text-base text-[#123323]">Loading page…</p>}>
          {activePage === "home" && <HomePage setActivePage={page=>navigate(page)} onBookService={service=>navigate("book",service)} />}
          {activePage === "chat" && <ChatPage ownerId={residentAccount?.id??""} />}
          {activePage === "book" && residentAccount?.role === "resident" && (
            <BookPage setActivePage={page=>navigate(page)} resident={residentAccount} initialService={bookingService} />
          )}
          {activePage === "dashboard" && residentAccount?.role === "resident" && (
            <DashboardPage userName={userName} userId={userId} resident={residentAccount} setActivePage={page=>navigate(page)} />
          )}
          {activePage === "fees" && residentAccount?.role === "resident" && <ResidentFeeRecordsPage key={residentAccount.id} ownerId={residentAccount.id}/>}
          {activePage === "schedule" && loggedInAs !== "admin" && <WalkInSchedulePage />}
          {activePage === "staff-concerns" && canManage(residentAccount,'concerns') && <AdminServicesPage key="concerns" initialTab="concerns" focusReference={focusReference} />}
          {activePage === "staff-residents" && canManage(residentAccount,'residents') && <AdminServicesPage key="residents" initialTab="residents" focusReference={focusReference}/>}
          {activePage === "staff-schedule" && canManage(residentAccount,'schedules') && <AdminServicesPage key="staff-schedule" initialTab="schedule" />}
          {activePage === "staff-news" && canManage(residentAccount,'content') && <LandingNewsManager />}
          {activePage === "staff-settings" && canManage(residentAccount,'settings') && <ServiceSettingsPage onOpenRequest={canManage(residentAccount,'requests')?reference=>{if(!confirmDiscardChanges())return;setFocusReference(reference);setActivePage('admin');}:undefined}/>}
          {activePage === "staff-banoy" && canManage(residentAccount,'knowledge') && <ChatbotKnowledgePage focusReference={focusReference}/>}
          {activePage==='staff-inbox'&&residentAccount?.role==='staff'&&<StaffInboxPage onNavigate={openWorkflow}/>}
          {activePage==='staff-queue'&&residentAccount&&canManage(residentAccount,'requests')&&<OfficeQueuePage account={residentAccount} focusDate={focusReference} onNavigate={openWorkflow} onOpenRequest={reference=>openWorkflow('admin',reference)}/>}
          {activePage==='staff-register'&&canManage(residentAccount,'certificates')&&<CertificateRegisterPage target={transactionTarget}/>}
          {activePage==='staff-payments'&&canManage(residentAccount,'payments')&&<FeeRecordsPage target={transactionTarget} canConfigureFees={canManage(residentAccount,'settings')}/>}
          {activePage==='staff-reports'&&residentAccount&&canManage(residentAccount,'reports')&&<OperationalReportsPage account={residentAccount} onNavigate={openWorkflow}/>}
          {activePage==='staff-audit'&&residentAccount&&canManage(residentAccount,'audit')&&<AuditLogPage account={residentAccount} onNavigate={openWorkflow}/>}
          {activePage==='staff-accounts'&&residentAccount?.superadmin&&<StaffManagementPage/>}
          {activePage==='staff-content'&&canManage(residentAccount,'content')&&<PublicContentManager/>}
          {activePage === "concerns" && residentAccount?.role === "resident" && (
            <ConcernsPage
              residentName={residentAccount.name}
              residentId={residentAccount.id}
              contact={residentAccount.contactNumber}
            />
          )}
          {activePage === "profile" && residentAccount && (
            <ResidentProfilePage
              resident={residentAccount}
              onProfileUpdated={(account) => {
                setResidentAccount(previous=>previous?{...previous,...account}:account);
                setUserName(account.name);
              }}
            />
          )}
          {activePage === "admin" && residentAccount && (canManage(residentAccount,'requests')||canManage(residentAccount,'certificates')) && <AdminPage resident={residentAccount} focusReference={focusReference} onWorkflow={openWorkflow}/>}
          {activePage === "admin" && loggedInAs !== "admin" && (
            <div className="p-6">
              <div className="border border-border bg-white p-8 max-w-md">
                <div className="text-xs font-bold tracking-widest text-muted-foreground mb-2">ACCESS_DENIED</div>
                <div className="text-sm font-bold">Admin access is restricted to staff only.</div>
              </div>
            </div>
          )}
          </Suspense></PageBoundary>
        </main>
      </div>
    </div>
  );
}
