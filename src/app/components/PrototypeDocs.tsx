import { useState } from "react";
import { ChevronDown, ChevronRight, ArrowRight } from "lucide-react";

/* ─────────────────────────── DATA ─────────────────────────── */

const MODULES = [
  {
    id: "M1",
    name: "USER AUTHENTICATION MODULE",
    color: "#0f0e0c",
    purpose:
      "Controls access to the Barangay Portal System by verifying resident and admin identities. Ensures only registered users can interact with protected features such as appointment booking and the resident dashboard.",
    features: [
      "Resident self-registration with personal details",
      "Email and password-based login for residents",
      "Username and password login for admin/staff",
      "Forgot password with email + contact number verification",
      "Password reset and account recovery flow",
      "Role-based access routing (resident vs. admin)",
    ],
    inputs: [
      "First name, last name",
      "Email address",
      "Contact number",
      "Home address",
      "Password (hashed)",
      "Admin username & password",
    ],
    outputs: [
      "Authenticated user session",
      "Role assignment (resident/admin)",
      "User profile record",
      "Access token for portal navigation",
    ],
    interactions: ["M2", "M3", "M4", "M5", "M6", "M7"],
    screens: [
      {
        id: "M1-S1",
        label: "LOGIN SCREEN",
        desc: "Split-panel layout with black branding panel on the left and tabbed login form (Resident / Admin) on the right. Residents authenticate via email + password. Admins use username + password. Includes a 'Forgot Password' link.",
        flow: "User selects role tab → fills credentials → clicks LOGIN → system validates → routes to Home (resident) or Admin Panel (admin).",
      },
      {
        id: "M1-S2",
        label: "REGISTRATION FORM",
        desc: "Full registration form collecting first name, last name, email, contact number, home address, and password with confirmation. Validates for duplicate emails before saving the account.",
        flow: "Fills all required fields → clicks CREATE ACCOUNT → system saves record → auto-redirects to Login Screen.",
      },
      {
        id: "M1-S3",
        label: "FORGOT PASSWORD",
        desc: "Two-step recovery: Step 1 verifies identity by matching email + contact number. Step 2 prompts for a new password and confirmation. On success, account password is updated.",
        flow: "Enters email + contact number → VERIFY IDENTITY → if matched, enters new password → RESET PASSWORD → redirected to Login.",
      },
    ],
  },
  {
    id: "M2",
    name: "HOME & ANNOUNCEMENTS MODULE",
    color: "#1a4a1a",
    purpose:
      "Serves as the main landing page after login. Displays the barangay identity, provides direct CTAs to the booking and AI chatbot systems, surfaces the latest announcements, quick-access certificate links, and real-time system availability status.",
    features: [
      "Hero banner with barangay name and CTA buttons",
      "Address, phone, and office hours info strip",
      "Paginated announcement feed with date, type badge, title, and excerpt",
      "Quick Links panel for certificate types",
      "System status indicators (Online Booking, AI, Walk-in)",
      "Floating 'ASK AI' shortcut button",
    ],
    inputs: [
      "Published announcements from Admin Module",
      "System status flags (active/offline)",
      "Logged-in user session",
    ],
    outputs: [
      "Navigation trigger to Booking Module (M4)",
      "Navigation trigger to AI Chatbot Module (M3)",
      "Resident awareness of office policies",
    ],
    interactions: ["M3", "M4"],
    screens: [
      {
        id: "M2-S1",
        label: "HOME DASHBOARD SCREEN",
        desc: "Full-width hero banner module (HERO_BANNER.MODULE) with black header bar, large barangay name, subtitle, description, two CTA buttons, and an address/hours strip. Below: a 2-col grid with the announcement list (left) and the Quick Links + System Status panels (right).",
        flow: "User arrives after login → reads announcements → clicks BOOK APPOINTMENT (→ M4) or ASK AI ASSISTANT (→ M3) or a Quick Link certificate.",
      },
    ],
  },
  {
    id: "M3",
    name: "AI CHATBOT INQUIRY MODULE",
    color: "#7c3a00",
    purpose:
      "Provides residents with instant automated answers to common questions about barangay certificates, requirements, fees, processing times, office hours, and appointment rescheduling — reducing walk-in traffic and repetitive staff inquiries.",
    features: [
      "Split-panel layout: Quick Questions sidebar + live chat area",
      "8 pre-defined topic shortcuts (Clearance, Business Permit, Residency, etc.)",
      "Keyword-matching knowledge base with fuzzy fallback",
      "Typing indicator with animated dots",
      "Timestamped messages with sender labels",
      "Non-destructive disclaimer for official transactions",
    ],
    inputs: [
      "User free-text question",
      "Quick question topic tap",
      "Knowledge base (static dictionary)",
    ],
    outputs: [
      "AI-generated answer text",
      "Guidance on certificate requirements, fees, and schedules",
    ],
    interactions: ["M4"],
    screens: [
      {
        id: "M3-S1",
        label: "CHATBOT INTERFACE SCREEN",
        desc: "Left panel (QUICK_QUESTIONS) lists 8 tappable topic buttons. Right panel shows the chat thread: bot avatar + message bubbles on the left, user bubbles on the right, animated typing indicator, and a bottom input bar with SEND button. Footer disclaimer in amber text.",
        flow: "User taps topic or types question → bot shows typing animation → bot reply appears with formatted text → user may follow up or navigate to Book (M4).",
      },
    ],
  },
  {
    id: "M4",
    name: "APPOINTMENT BOOKING MODULE",
    color: "#1a1a4a",
    purpose:
      "Enables residents to formally request a barangay certification appointment through a structured 4-step wizard. Collects personal details, document type, preferred date, and generates a reference number upon submission.",
    features: [
      "4-step multi-stage form wizard with vertical step indicator",
      "Step 1 — Personal Information (name, address, voter ID)",
      "Step 2 — Request Type (dropdown) & Purpose (free text)",
      "Step 3 — Interactive calendar picker (Mon–Fri only, past dates blocked)",
      "Step 4 — Read-only review summary before final submission",
      "Back/Next navigation with per-step validation",
      "Submission confirmation screen with generated reference number",
    ],
    inputs: [
      "Full name, complete address, voter ID number",
      "Certificate type selection",
      "Purpose / reason text",
      "Preferred appointment date",
    ],
    outputs: [
      "Appointment request record (sent to Admin Module)",
      "Booking reference number (BRG-YYYY-XXXX)",
      "Confirmation feedback to resident",
    ],
    interactions: ["M5", "M6"],
    screens: [
      {
        id: "M4-S1",
        label: "STEP 1 — PERSONAL INFORMATION",
        desc: "Left column: step indicator showing 4 steps (active = black). Right column: form with Full Name, Complete Address, and Voter ID Number fields. Next is disabled until all fields are filled.",
        flow: "Fill 3 fields → NEXT unlocks → proceed to Step 2.",
      },
      {
        id: "M4-S2",
        label: "STEP 2 — REQUEST TYPE & PURPOSE",
        desc: "Dropdown for certificate type (6 options) and a multi-line textarea for purpose. Step 1 shows checkmark in indicator.",
        flow: "Select document type → enter purpose → NEXT to Step 3.",
      },
      {
        id: "M4-S3",
        label: "STEP 3 — SCHEDULE APPOINTMENT",
        desc: "Full calendar grid (CALENDAR_GRID) for the current month. Weekend and past dates grayed out. Selected date highlighted in black. Selected date confirmation strip below the calendar.",
        flow: "Click available date → confirmation strip updates → NEXT to Step 4.",
      },
      {
        id: "M4-S4",
        label: "STEP 4 — REVIEW & SUBMIT",
        desc: "Read-only REQUEST_SUMMARY table showing all entered data in amber text. Legal disclaimer box. SUBMIT REQUEST button in black.",
        flow: "Verify all fields → SUBMIT REQUEST → appointment created → confirmation screen with reference number.",
      },
    ],
  },
  {
    id: "M5",
    name: "RESIDENT DASHBOARD MODULE",
    color: "#4a1a1a",
    purpose:
      "Personal self-service hub where logged-in residents can view appointment statistics, manage their profile, and track the real-time status of all their submitted certification requests.",
    features: [
      "4 stat summary cards (Total, Active, Completed, Rejected)",
      "Resident profile card with avatar, name, ID, address",
      "Edit Profile button",
      "MY_ACTIVE_APPOINTMENTS data table with reference numbers",
      "Per-row status badges (APPROVED / PENDING / COMPLETED / REJECTED)",
      "VIEW and CANCEL actions per appointment row",
      "NEW BOOKING shortcut button",
    ],
    inputs: [
      "Logged-in user identity",
      "Appointment records from Booking Module (M4)",
      "Status updates from Admin Module (M6)",
    ],
    outputs: [
      "Appointment status visibility to resident",
      "Cancel request trigger back to Admin (M6)",
      "Navigation to Booking Module (M4)",
    ],
    interactions: ["M4", "M6"],
    screens: [
      {
        id: "M5-S1",
        label: "RESIDENT DASHBOARD SCREEN",
        desc: "Header with RESIDENT_DASHBOARD.MODULE label and + NEW BOOKING button. 4-col stat strip below. Large profile card with initials avatar, name in uppercase, ID + address in muted text, and EDIT PROFILE button. Full-width MY_ACTIVE_APPOINTMENTS table with columns: REF NO., REQUEST TYPE, DATE & TIME, PURPOSE, STATUS, ACTION.",
        flow: "Resident lands on dashboard → reads stats → scans appointment table → clicks VIEW to see detail or CANCEL to cancel → status badges update in real-time.",
      },
    ],
  },
  {
    id: "M6",
    name: "ADMIN REQUEST MANAGEMENT MODULE",
    color: "#1a3a1a",
    purpose:
      "Provides barangay staff with a centralized queue for reviewing, approving, and rejecting incoming certification appointment requests. Includes inline action buttons, a filter bar for status-based sorting, and a detail modal for viewing full request information.",
    features: [
      "ADMIN ACCESS badge and role-restricted entry",
      "4 summary stat cards (Total, Pending, Residents, Needs Review)",
      "REQUEST_VERIFICATION tab — filterable appointment table",
      "Filter bar: ALL / PENDING / APPROVED / COMPLETED / REJECTED",
      "Per-row inline APPROVE and REJECT buttons for pending items",
      "VIEW button opens REQUEST_DETAIL modal",
      "Real-time status update on approval/rejection",
    ],
    inputs: [
      "All appointment requests from Booking Module (M4)",
      "Admin authentication from Auth Module (M1)",
      "Filter selection",
    ],
    outputs: [
      "Approved / Rejected / Completed status updates",
      "Status reflected in Resident Dashboard (M5)",
      "Data consumed by Analytics Module (M7)",
    ],
    interactions: ["M1", "M4", "M5", "M7"],
    screens: [
      {
        id: "M6-S1",
        label: "ADMIN PANEL — REQUEST VERIFICATION",
        desc: "Black module label bar + ADMIN ACCESS badge. 4 stat cards with icons (FileText, Clock, Users, AlertTriangle). Tabs: REQUEST_VERIFICATION (active) and ANALYTICS. Filter pill group. Table with 7 columns: REF NO., RESIDENT, REQUEST TYPE, APPT. DATE, SUBMITTED, STATUS, ACTIONS. Pending rows show APPROVE + REJECT buttons; others show VIEW only.",
        flow: "Admin logs in → lands on admin panel → filters by PENDING → reviews each row → APPROVE or REJECT inline → status updates immediately.",
      },
      {
        id: "M6-S2",
        label: "REQUEST DETAIL MODAL",
        desc: "Overlay modal (REQUEST_DETAIL) with gray-overlaid background. Shows: REF NO., RESIDENT, REQUEST TYPE, APPT. DATE, PURPOSE, STATUS — all in amber label/value rows. Close button (×) top-right.",
        flow: "Admin clicks VIEW on any row → modal slides over table → admin reads details → closes modal → returns to table.",
      },
    ],
  },
  {
    id: "M7",
    name: "ANALYTICS & REPORTING MODULE",
    color: "#3a1a4a",
    purpose:
      "Delivers visual and tabular insights into the barangay certification system's activity — monthly request volumes, distribution by certificate type, and a status breakdown for the current period. Supports data-informed staffing and policy decisions.",
    features: [
      "Monthly bar chart — request volume Jan through Jun (recharts BarChart)",
      "Horizontal bar chart — requests segmented by certificate type",
      "STATUS_BREAKDOWN table — Pending, Approved, Completed, Rejected counts + percentages",
      "Real-time data computed from live appointment records",
      "Space Mono labeled axes and amber chart tooltips",
    ],
    inputs: [
      "All appointment records from Admin Module (M6)",
      "Status classifications (pending/approved/completed/rejected)",
    ],
    outputs: [
      "Monthly trend visualization",
      "Certificate type demand distribution",
      "Status breakdown percentages",
      "Operational insights for barangay staff",
    ],
    interactions: ["M6"],
    screens: [
      {
        id: "M7-S1",
        label: "ANALYTICS TAB SCREEN",
        desc: "Inside the Admin Panel (M6), switching to the ANALYTICS tab shows two side-by-side chart panels: MONTHLY_REQUESTS_2024 (vertical bar chart, 6 months) and REQUESTS_BY_TYPE (horizontal bar chart, 5 types in grayscale gradient). Below: a 4-column STATUS_BREAKDOWN_JUNE_2024 table with count + percentage labels.",
        flow: "Admin clicks ANALYTICS tab → charts render → reads monthly volume trend → identifies highest-demand certificate type → refers to status breakdown for operational decisions.",
      },
    ],
  },
];

const ARCH_LINKS = [
  { from: "M1", to: "M2", label: "Login → Home" },
  { from: "M2", to: "M3", label: "Home → Chat" },
  { from: "M2", to: "M4", label: "Home → Book" },
  { from: "M3", to: "M4", label: "Chat → Book" },
  { from: "M4", to: "M5", label: "Book → Dashboard" },
  { from: "M4", to: "M6", label: "Book → Admin" },
  { from: "M6", to: "M5", label: "Admin → Dashboard" },
  { from: "M6", to: "M7", label: "Admin → Analytics" },
];

/* ─────────────────────────── COMPONENTS ─────────────────────────── */

function Tag({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <span
      className="inline-block text-[9px] font-bold tracking-[0.12em] px-2 py-0.5"
      style={{ background: "#f5f3f0", border: "1px solid #c4c0b9", color: "#6e6b65", ...style }}
    >
      {children}
    </span>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[9px] font-bold tracking-[0.2em] mb-3" style={{ color: "#9e9b96" }}>
      {children}
    </div>
  );
}

function ModuleCard({ mod, expanded, onToggle }: {
  mod: typeof MODULES[0]; expanded: boolean; onToggle: () => void;
}) {
  return (
    <div
      className="bg-white"
      style={{ border: "1px solid #c4c0b9", marginBottom: 1 }}
    >
      {/* Module header */}
      <button
        className="w-full flex items-center gap-4 px-6 py-5 text-left"
        style={{ borderBottom: expanded ? "1px solid #c4c0b9" : "none" }}
        onClick={onToggle}
      >
        {/* ID badge */}
        <div
          className="w-12 h-12 flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
          style={{ background: mod.color }}
        >
          {mod.id}
        </div>
        <div className="flex-1">
          <div className="text-[11px] font-bold tracking-[0.14em]">{mod.name}</div>
          <div className="text-[10px] mt-1 leading-relaxed line-clamp-1" style={{ color: "#6e6b65" }}>
            {mod.purpose}
          </div>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          <Tag>{mod.screens.length} SCREEN{mod.screens.length > 1 ? "S" : ""}</Tag>
          {expanded
            ? <ChevronDown className="w-4 h-4" style={{ color: "#9e9b96" }} />
            : <ChevronRight className="w-4 h-4" style={{ color: "#9e9b96" }} />
          }
        </div>
      </button>

      {/* Expanded content */}
      {expanded && (
        <div className="px-6 py-6">
          {/* Purpose */}
          <div className="mb-6">
            <SectionLabel>PURPOSE</SectionLabel>
            <p className="text-[11px] leading-relaxed" style={{ color: "#3d3b38" }}>{mod.purpose}</p>
          </div>

          {/* Key features + Inputs + Outputs */}
          <div className="grid grid-cols-3 gap-6 mb-6">
            <div>
              <SectionLabel>KEY FEATURES</SectionLabel>
              <ul className="space-y-1.5">
                {mod.features.map((f, i) => (
                  <li key={i} className="flex items-start gap-2 text-[10px] leading-snug" style={{ color: "#3d3b38" }}>
                    <span className="mt-0.5 font-bold" style={{ color: mod.color, flexShrink: 0 }}>—</span>
                    {f}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <SectionLabel>INPUTS</SectionLabel>
              <ul className="space-y-1.5">
                {mod.inputs.map((inp, i) => (
                  <li key={i} className="flex items-start gap-2 text-[10px] leading-snug" style={{ color: "#3d3b38" }}>
                    <span className="font-bold mt-0.5" style={{ color: "#bf6318", flexShrink: 0 }}>›</span>
                    {inp}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <SectionLabel>OUTPUTS</SectionLabel>
              <ul className="space-y-1.5">
                {mod.outputs.map((out, i) => (
                  <li key={i} className="flex items-start gap-2 text-[10px] leading-snug" style={{ color: "#3d3b38" }}>
                    <span className="font-bold mt-0.5" style={{ color: "#1a4a1a", flexShrink: 0 }}>◆</span>
                    {out}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Interactions */}
          <div className="mb-6">
            <SectionLabel>INTERACTS WITH</SectionLabel>
            <div className="flex flex-wrap gap-2">
              {mod.interactions.map(mid => {
                const target = MODULES.find(m => m.id === mid);
                return (
                  <div
                    key={mid}
                    className="flex items-center gap-2 px-3 py-1.5 text-[9px] font-bold tracking-[0.1em]"
                    style={{ background: "#f5f3f0", border: "1px solid #c4c0b9" }}
                  >
                    <span
                      className="w-2 h-2 flex-shrink-0"
                      style={{ background: target?.color || "#9e9b96" }}
                    />
                    {mid}: {target?.name.split(" ")[0]} {target?.name.split(" ")[1]}
                    <ArrowRight className="w-3 h-3" style={{ color: "#c4c0b9" }} />
                  </div>
                );
              })}
            </div>
          </div>

          {/* Screens */}
          <div>
            <SectionLabel>SCREENS ({mod.screens.length})</SectionLabel>
            <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${Math.min(mod.screens.length, 2)}, 1fr)` }}>
              {mod.screens.map(sc => (
                <div
                  key={sc.id}
                  className="p-5"
                  style={{ border: `1px solid ${mod.color}30`, background: "#faf9f7" }}
                >
                  {/* Screen header */}
                  <div className="flex items-center gap-2 mb-3">
                    <span
                      className="text-[9px] font-bold tracking-[0.12em] px-2 py-0.5 text-white"
                      style={{ background: mod.color }}
                    >
                      {sc.id}
                    </span>
                    <span className="text-[10px] font-bold tracking-[0.1em]">{sc.label}</span>
                  </div>

                  {/* Wireframe mockup */}
                  <div
                    className="mb-4"
                    style={{ border: "1px solid #c4c0b9", background: "#fff", minHeight: 120 }}
                  >
                    <ScreenMockup screenId={sc.id} color={mod.color} />
                  </div>

                  <p className="text-[10px] leading-relaxed mb-3" style={{ color: "#3d3b38" }}>
                    <strong>Layout:</strong> {sc.desc}
                  </p>
                  <div
                    className="px-3 py-2.5 text-[10px] leading-relaxed"
                    style={{ background: "#f0ede8", borderLeft: `3px solid ${mod.color}` }}
                  >
                    <strong className="text-[9px] tracking-[0.1em]" style={{ color: mod.color }}>USER FLOW:</strong>{" "}
                    <span style={{ color: "#3d3b38" }}>{sc.flow}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* Inline SVG wireframe thumbnails per screen */
function ScreenMockup({ screenId, color }: { screenId: string; color: string }) {
  const c = color;
  const gray = "#c4c0b9";
  const light = "#f5f3f0";
  const amber = "#bf6318";

  const mockups: Record<string, JSX.Element> = {
    "M1-S1": (
      <svg viewBox="0 0 320 150" className="w-full" style={{ display: "block" }}>
        <rect x="0" y="0" width="110" height="150" fill={c} />
        <rect x="10" y="12" width="18" height="18" fill="none" stroke="white" strokeWidth="1" />
        <rect x="34" y="15" width="40" height="5" fill="white" opacity="0.6" rx="1" />
        <rect x="34" y="24" width="28" height="3" fill="white" opacity="0.3" rx="1" />
        <rect x="10" y="48" width="80" height="12" fill="white" opacity="0.15" rx="1" />
        <rect x="10" y="64" width="55" height="6" fill="white" opacity="0.4" rx="1" />
        <rect x="10" y="74" width="75" height="4" fill="white" opacity="0.2" rx="1" />
        <rect x="10" y="82" width="65" height="4" fill="white" opacity="0.2" rx="1" />
        <rect x="110" y="0" width="210" height="150" fill="white" />
        <rect x="120" y="18" width="90" height="5" fill={gray} rx="1" />
        <rect x="120" y="28" width="60" height="10" fill={c} rx="1" />
        <rect x="120" y="44" width="180" height="1" fill={gray} />
        <rect x="120" y="52" width="90" height="1" fill={c} />
        <rect x="210" y="52" width="90" height="1" fill={light} />
        <rect x="120" y="56" width="3" height="3" fill={gray} rx="50" />
        <rect x="126" y="57" width="40" height="2" fill={gray} rx="1" />
        <rect x="120" y="64" width="3" height="3" fill={gray} rx="50" />
        <rect x="126" y="65" width="30" height="2" fill={gray} rx="1" />
        <rect x="120" y="72" width="90" height="1" fill={gray} />
        <rect x="120" y="76" width="3" height="3" fill={gray} rx="50" />
        <rect x="126" y="77" width="50" height="2" fill={gray} rx="1" />
        <rect x="120" y="84" width="3" height="3" fill={gray} rx="50" />
        <rect x="126" y="85" width="35" height="2" fill={gray} rx="1" />
        <rect x="200" y="130" width="90" height="12" fill={c} rx="1" />
        <rect x="204" y="135" width="60" height="3" fill="white" rx="1" />
      </svg>
    ),
    "M1-S2": (
      <svg viewBox="0 0 320 150" className="w-full" style={{ display: "block" }}>
        <rect x="0" y="0" width="110" height="150" fill={c} />
        <rect x="10" y="12" width="18" height="18" fill="none" stroke="white" strokeWidth="1" />
        <rect x="34" y="15" width="40" height="5" fill="white" opacity="0.6" rx="1" />
        <rect x="110" y="0" width="210" height="150" fill="white" />
        <rect x="120" y="12" width="50" height="4" fill={gray} rx="1" />
        <rect x="120" y="20" width="80" height="8" fill={c} rx="1" />
        <rect x="120" y="34" width="90" height="10" fill={light} />
        <rect x="215" y="34" width="90" height="10" fill={light} />
        {[0,1,2,3,4].map(i => (
          <g key={i}>
            <rect x="120" y={50 + i * 18} width="80" height="3" fill={gray} rx="1" />
            <rect x="120" y={56 + i * 18} width="180" height="8" fill={light} />
          </g>
        ))}
        <rect x="200" y="138" width="100" height="10" fill={c} rx="1" />
        <rect x="204" y="141" width="60" height="3" fill="white" rx="1" />
      </svg>
    ),
    "M1-S3": (
      <svg viewBox="0 0 320 150" className="w-full" style={{ display: "block" }}>
        <rect x="0" y="0" width="110" height="150" fill={c} />
        <rect x="10" y="12" width="18" height="18" fill="none" stroke="white" strokeWidth="1" />
        <rect x="110" y="0" width="210" height="150" fill="white" />
        <rect x="120" y="12" width="50" height="4" fill={gray} rx="1" />
        <rect x="120" y="20" width="80" height="8" fill={c} rx="1" />
        <rect x="120" y="36" width="180" height="6" fill={light} />
        <rect x="120" y="50" width="60" height="3" fill={gray} rx="1" />
        <rect x="120" y="56" width="180" height="10" fill={light} />
        <rect x="120" y="72" width="60" height="3" fill={gray} rx="1" />
        <rect x="120" y="78" width="180" height="10" fill={light} />
        <rect x="120" y="96" width="180" height="8" fill="#fdf7f0" style={{ stroke: "#e8c99a", strokeWidth: 0.5 }} />
        <rect x="200" y="130" width="100" height="12" fill={c} rx="1" />
        <rect x="204" y="134" width="65" height="3" fill="white" rx="1" />
      </svg>
    ),
    "M2-S1": (
      <svg viewBox="0 0 320 150" className="w-full" style={{ display: "block" }}>
        <rect x="0" y="0" width="320" height="150" fill={light} />
        {/* Sidebar stub */}
        <rect x="0" y="0" width="36" height="150" fill="white" style={{ stroke: gray, strokeWidth: 0.5 }} />
        <rect x="4" y="6" width="12" height="12" fill={c} />
        <rect x="4" y="25" width="28" height="5" fill={light} />
        <rect x="4" y="33" width="28" height="5" fill={light} />
        <rect x="4" y="41" width="28" height="5" fill={light} />
        {/* Hero */}
        <rect x="40" y="4" width="276" height="60" fill="white" style={{ stroke: gray, strokeWidth: 0.5 }} />
        <rect x="40" y="4" width="276" height="8" fill={c} />
        <rect x="44" y="16" width="60" height="3" fill={gray} rx="1" />
        <rect x="44" y="22" width="120" height="14" fill={c} opacity="0.12" rx="1" />
        <rect x="44" y="40" width="50" height="10" fill={c} rx="1" />
        <rect x="98" y="40" width="50" height="10" fill="none" style={{ stroke: c, strokeWidth: 1 }} rx="1" />
        <rect x="40" y="64" width="276" height="6" fill={light} />
        {/* Announcements */}
        <rect x="40" y="74" width="180" height="72" fill="white" style={{ stroke: gray, strokeWidth: 0.5 }} />
        <rect x="40" y="74" width="180" height="7" fill={light} />
        {[0,1,2].map(i => (
          <g key={i}>
            <rect x="44" y={85 + i * 20} width="8" height="10" fill={light} />
            <rect x="56" y={85 + i * 20} width="20" height="3" fill={c} rx="1" />
            <rect x="56" y={91 + i * 20} width="100" height="3" fill={gray} rx="1" />
            <rect x="56" y={96 + i * 20} width="120" height="2" fill={amber} opacity="0.4" rx="1" />
          </g>
        ))}
        {/* Quick Links */}
        <rect x="224" y="74" width="92" height="40" fill="white" style={{ stroke: gray, strokeWidth: 0.5 }} />
        <rect x="224" y="74" width="92" height="7" fill={light} />
        {[0,1,2].map(i => (
          <rect key={i} x="224" y={85 + i * 9} width="92" height="7" fill="none" style={{ borderBottom: `1px solid ${gray}` }} />
        ))}
        {/* Status */}
        <rect x="224" y="118" width="92" height="28" fill="white" style={{ stroke: gray, strokeWidth: 0.5 }} />
        <rect x="224" y="118" width="92" height="7" fill={light} />
        {[0,1].map(i => (
          <g key={i}>
            <rect x="228" y={129 + i * 9} width="40" height="3" fill={gray} rx="1" />
            <rect x="295" y={128 + i * 9} width="18" height="5" fill={c} rx="1" />
          </g>
        ))}
      </svg>
    ),
    "M3-S1": (
      <svg viewBox="0 0 320 150" className="w-full" style={{ display: "block" }}>
        <rect x="0" y="0" width="320" height="150" fill={light} />
        <rect x="0" y="0" width="36" height="150" fill="white" style={{ stroke: gray, strokeWidth: 0.5 }} />
        <rect x="4" y="6" width="12" height="12" fill={c} />
        {/* Quick questions */}
        <rect x="36" y="0" width="70" height="150" fill="white" style={{ stroke: gray, strokeWidth: 0.5 }} />
        <rect x="36" y="0" width="70" height="18" fill={light} />
        <rect x="40" y="5" width="40" height="4" fill={gray} rx="1" />
        {[0,1,2,3,4,5,6,7].map(i => (
          <rect key={i} x="36" y={22 + i * 14} width="70" height="12" fill={i%2===0 ? "white" : light} />
        ))}
        {/* Chat area */}
        <rect x="106" y="0" width="214" height="150" fill="white" />
        <rect x="106" y="0" width="214" height="16" fill={light} style={{ stroke: gray, strokeWidth: 0.5 }} />
        <rect x="110" y="5" width="8" height="8" fill={light} style={{ stroke: gray, strokeWidth: 0.5 }} />
        <rect x="122" y="6" width="60" height="3" fill={c} rx="1" />
        <rect x="122" y="11" width="45" height="2" fill={gray} rx="1" />
        {/* Bot message */}
        <rect x="114" y="24" width="8" height="8" fill={light} style={{ stroke: gray, strokeWidth: 0.5 }} />
        <rect x="126" y="22" width="140" height="24" fill={light} style={{ stroke: gray, strokeWidth: 0.5 }} />
        <rect x="130" y="26" width="120" height="2" fill={gray} rx="1" />
        <rect x="130" y="31" width="100" height="2" fill={gray} rx="1" />
        <rect x="130" y="36" width="80" height="2" fill={gray} rx="1" />
        {/* User message */}
        <rect x="194" y="56" width="100" height="14" fill={light} style={{ stroke: gray, strokeWidth: 0.5 }} />
        <rect x="198" y="60" width="80" height="2" fill={c} opacity="0.4" rx="1" />
        <rect x="198" y="65" width="50" height="2" fill={c} opacity="0.3" rx="1" />
        <rect x="300" y="56" width="8" height="8" fill={c} />
        {/* Bot reply */}
        <rect x="114" y="80" width="8" height="8" fill={light} style={{ stroke: gray, strokeWidth: 0.5 }} />
        <rect x="126" y="78" width="150" height="30" fill={light} style={{ stroke: gray, strokeWidth: 0.5 }} />
        <rect x="130" y="82" width="130" height="2" fill={gray} rx="1" />
        <rect x="130" y="87" width="110" height="2" fill={gray} rx="1" />
        <rect x="130" y="92" width="90" height="2" fill={gray} rx="1" />
        <rect x="130" y="97" width="70" height="2" fill={amber} opacity="0.5" rx="1" />
        {/* Input */}
        <rect x="106" y="130" width="214" height="20" fill="white" style={{ stroke: gray, strokeWidth: 0.5 }} />
        <rect x="110" y="135" width="150" height="10" fill={light} style={{ stroke: gray, strokeWidth: 0.5 }} />
        <rect x="264" y="135" width="50" height="10" fill={c} />
        <rect x="268" y="138" width="30" height="3" fill="white" rx="1" />
      </svg>
    ),
    "M4-S1": (
      <svg viewBox="0 0 320 150" className="w-full" style={{ display: "block" }}>
        <rect x="0" y="0" width="320" height="150" fill={light} />
        <rect x="0" y="0" width="36" height="150" fill="white" style={{ stroke: gray, strokeWidth: 0.5 }} />
        <rect x="4" y="6" width="12" height="12" fill={c} />
        <rect x="36" y="0" width="284" height="150" fill={light} />
        {/* Header */}
        <rect x="40" y="4" width="280" height="14" fill="white" style={{ stroke: gray, strokeWidth: 0.5 }} />
        <rect x="44" y="8" width="80" height="4" fill={c} rx="1" />
        {/* Step indicator */}
        <rect x="40" y="22" width="55" height="124" fill="white" style={{ stroke: gray, strokeWidth: 0.5 }} />
        <rect x="40" y="22" width="55" height="8" fill={light} />
        {[0,1,2,3].map(i => (
          <g key={i}>
            <rect x="44" y={35 + i * 28} width="8" height="8" fill={i===0 ? c : light} style={{ stroke: gray, strokeWidth: 0.5 }} />
            <rect x="56" y={36 + i * 28} width="30" height="3" fill={i===0 ? c : gray} opacity={i===0?1:0.5} rx="1" />
            <rect x="56" y={42 + i * 28} width="25" height="2" fill={gray} opacity="0.4" rx="1" />
            {i < 3 && <rect x="47" y={44 + i * 28} width="2" height="16" fill={gray} opacity="0.4" />}
          </g>
        ))}
        {/* Form */}
        <rect x="99" y="22" width="225" height="124" fill="white" style={{ stroke: gray, strokeWidth: 0.5 }} />
        <rect x="99" y="22" width="225" height="10" fill={light} />
        <rect x="103" y="26" width="80" height="3" fill={c} rx="1" />
        {[0,1,2].map(i => (
          <g key={i}>
            <rect x="103" y={40 + i * 22} width="60" height="3" fill={gray} opacity="0.6" rx="1" />
            <rect x="103" y={46 + i * 22} width="205" height="10" fill={light} style={{ stroke: gray, strokeWidth: 0.5 }} />
          </g>
        ))}
        <rect x="103" y="130" width="50" height="10" fill={light} style={{ stroke: gray, strokeWidth: 0.5 }} />
        <rect x="265" y="130" width="55" height="10" fill={c} />
        <rect x="268" y="133" width="35" height="3" fill="white" rx="1" />
      </svg>
    ),
    "M4-S2": (
      <svg viewBox="0 0 320 150" className="w-full" style={{ display: "block" }}>
        <rect x="0" y="0" width="320" height="150" fill={light} />
        <rect x="0" y="0" width="36" height="150" fill="white" style={{ stroke: gray, strokeWidth: 0.5 }} />
        <rect x="36" y="22" width="55" height="124" fill="white" style={{ stroke: gray, strokeWidth: 0.5 }} />
        {[0,1,2,3].map(i => (
          <g key={i}>
            <rect x="44" y={35 + i * 28} width="8" height="8" fill={i < 1 ? "#1a4a1a" : i === 1 ? c : light} style={{ stroke: gray, strokeWidth: 0.5 }} />
            {i < 3 && <rect x="47" y={44 + i * 28} width="2" height="16" fill={gray} opacity="0.4" />}
          </g>
        ))}
        <rect x="99" y="22" width="225" height="124" fill="white" style={{ stroke: gray, strokeWidth: 0.5 }} />
        <rect x="99" y="22" width="225" height="10" fill={light} />
        <rect x="103" y="26" width="90" height="3" fill={c} rx="1" />
        <rect x="103" y="40" width="50" height="3" fill={gray} opacity="0.6" rx="1" />
        <rect x="103" y="46" width="205" height="10" fill={light} style={{ stroke: gray, strokeWidth: 0.5 }} />
        <rect x="103" y="62" width="50" height="3" fill={gray} opacity="0.6" rx="1" />
        <rect x="103" y="68" width="205" height="40" fill={light} style={{ stroke: gray, strokeWidth: 0.5 }} />
        <rect x="103" y="130" width="50" height="10" fill={light} style={{ stroke: gray, strokeWidth: 0.5 }} />
        <rect x="265" y="130" width="55" height="10" fill={c} />
      </svg>
    ),
    "M4-S3": (
      <svg viewBox="0 0 320 150" className="w-full" style={{ display: "block" }}>
        <rect x="0" y="0" width="320" height="150" fill={light} />
        <rect x="0" y="0" width="36" height="150" fill="white" style={{ stroke: gray, strokeWidth: 0.5 }} />
        <rect x="36" y="22" width="55" height="124" fill="white" style={{ stroke: gray, strokeWidth: 0.5 }} />
        {[0,1,2,3].map(i => (
          <rect key={i} x="44" y={35 + i * 28} width="8" height="8" fill={i < 2 ? "#1a4a1a" : i===2 ? c : light} style={{ stroke: gray, strokeWidth: 0.5 }} />
        ))}
        <rect x="99" y="22" width="225" height="124" fill="white" style={{ stroke: gray, strokeWidth: 0.5 }} />
        <rect x="99" y="22" width="225" height="10" fill={light} />
        {/* Calendar grid */}
        <rect x="103" y="36" width="215" height="80" fill="white" style={{ stroke: gray, strokeWidth: 0.5 }} />
        <rect x="103" y="36" width="215" height="10" fill={light} />
        {/* Days header */}
        {[0,1,2,3,4,5,6].map(i => (
          <rect key={i} x={103 + i * 30} y="50" width="30" height="8" fill={i===0||i===6 ? light : "white"} style={{ stroke: gray, strokeWidth: 0.3 }} />
        ))}
        {/* Dates */}
        {[0,1,2,3,4,5,6,7,8,9,10,11,12].map(i => {
          const col = i % 7; const row = Math.floor(i / 7);
          const isSel = i === 5;
          return <rect key={i} x={103 + col * 30} y={60 + row * 14} width="30" height="14" fill={isSel ? c : (col===0||col===6) ? light : "white"} style={{ stroke: gray, strokeWidth: 0.3 }} />;
        })}
        <rect x="103" y="118" width="215" height="12" fill={light} style={{ stroke: gray, strokeWidth: 0.5 }} />
        <rect x="107" y="121" width="80" height="3" fill={c} opacity="0.4" rx="1" />
        <rect x="103" y="134" width="50" height="10" fill={light} style={{ stroke: gray, strokeWidth: 0.5 }} />
        <rect x="265" y="134" width="55" height="10" fill={c} />
      </svg>
    ),
    "M4-S4": (
      <svg viewBox="0 0 320 150" className="w-full" style={{ display: "block" }}>
        <rect x="0" y="0" width="320" height="150" fill={light} />
        <rect x="0" y="0" width="36" height="150" fill="white" style={{ stroke: gray, strokeWidth: 0.5 }} />
        <rect x="36" y="22" width="55" height="124" fill="white" style={{ stroke: gray, strokeWidth: 0.5 }} />
        {[0,1,2,3].map(i => (
          <rect key={i} x="44" y={35 + i * 28} width="8" height="8" fill={i < 3 ? "#1a4a1a" : c} style={{ stroke: gray, strokeWidth: 0.5 }} />
        ))}
        <rect x="99" y="22" width="225" height="124" fill="white" style={{ stroke: gray, strokeWidth: 0.5 }} />
        <rect x="99" y="22" width="225" height="10" fill={light} />
        {/* Summary table */}
        <rect x="103" y="36" width="215" height="72" fill="white" style={{ stroke: gray, strokeWidth: 0.5 }} />
        <rect x="103" y="36" width="215" height="8" fill={light} />
        {[0,1,2,3,4,5].map(i => (
          <g key={i}>
            <rect x="103" y={46 + i * 10} width="70" height="3" fill={gray} opacity="0.5" rx="1" />
            <rect x="180" y={46 + i * 10} width="110" height="3" fill={amber} opacity="0.5" rx="1" />
          </g>
        ))}
        <rect x="103" y="112" width="215" height="10" fill="#fdf7f0" style={{ stroke: "#e8c99a", strokeWidth: 0.5 }} />
        <rect x="103" y="132" width="50" height="10" fill={light} style={{ stroke: gray, strokeWidth: 0.5 }} />
        <rect x="215" y="132" width="105" height="10" fill={c} />
        <rect x="219" y="135" width="65" height="3" fill="white" rx="1" />
      </svg>
    ),
    "M5-S1": (
      <svg viewBox="0 0 320 150" className="w-full" style={{ display: "block" }}>
        <rect x="0" y="0" width="320" height="150" fill={light} />
        <rect x="0" y="0" width="36" height="150" fill="white" style={{ stroke: gray, strokeWidth: 0.5 }} />
        <rect x="36" y="0" width="284" height="150" fill={light} />
        {/* Header */}
        <rect x="40" y="4" width="280" height="12" fill="white" style={{ stroke: gray, strokeWidth: 0.5 }} />
        <rect x="44" y="8" width="90" height="3" fill={c} rx="1" />
        <rect x="290" y="6" width="26" height="8" fill={c} />
        {/* Stats */}
        {[0,1,2,3].map(i => (
          <rect key={i} x={40 + i * 71} y="20" width="68" height="20" fill="white" style={{ stroke: gray, strokeWidth: 0.5 }} />
        ))}
        {/* Profile */}
        <rect x="40" y="44" width="280" height="22" fill="white" style={{ stroke: gray, strokeWidth: 0.5 }} />
        <rect x="44" y="49" width="14" height="14" fill={c} />
        <rect x="62" y="50" width="60" height="3" fill={gray} opacity="0.5" rx="1" />
        <rect x="62" y="57" width="100" height="5" fill={c} opacity="0.2" rx="1" />
        {/* Table */}
        <rect x="40" y="70" width="280" height="78" fill="white" style={{ stroke: gray, strokeWidth: 0.5 }} />
        <rect x="40" y="70" width="280" height="8" fill={light} />
        <rect x="40" y="80" width="280" height="6" fill={light} />
        {[0,1,2,3].map(i => (
          <g key={i}>
            <rect x="40" y={88 + i * 14} width="280" height="13" fill={i%2===0?"white":"#faf9f7"} />
            <rect x="44" y={92 + i * 14} width="50" height="3" fill={amber} opacity="0.5" rx="1" />
            <rect x="100" y={92 + i * 14} width="60" height="3" fill={gray} rx="1" />
            <rect x="200" y={92 + i * 14} width="35" height="6" fill={i===0?c:i===1?light:i===2?"#3d3b38":"#6e6b65"} />
          </g>
        ))}
      </svg>
    ),
    "M6-S1": (
      <svg viewBox="0 0 320 150" className="w-full" style={{ display: "block" }}>
        <rect x="0" y="0" width="320" height="150" fill={light} />
        <rect x="0" y="0" width="36" height="150" fill="white" style={{ stroke: gray, strokeWidth: 0.5 }} />
        <rect x="36" y="0" width="284" height="150" fill={light} />
        <rect x="40" y="4" width="280" height="12" fill="white" style={{ stroke: gray, strokeWidth: 0.5 }} />
        <rect x="44" y="8" width="80" height="3" fill={c} rx="1" />
        <rect x="286" y="6" width="30" height="8" fill={c} />
        {[0,1,2,3].map(i => (
          <rect key={i} x={40 + i * 71} y="20" width="68" height="20" fill="white" style={{ stroke: gray, strokeWidth: 0.5 }} />
        ))}
        {/* Tabs */}
        <rect x="40" y="44" width="110" height="10" fill={c} />
        <rect x="150" y="44" width="80" height="10" fill={light} style={{ stroke: gray, strokeWidth: 0.5 }} />
        {/* Filter bar */}
        <rect x="40" y="54" width="280" height="10" fill={light} style={{ stroke: gray, strokeWidth: 0.5 }} />
        {[0,1,2,3,4].map(i => (
          <rect key={i} x={50 + i * 40} y="57" width="36" height="5" fill={i===0?c:"white"} style={{ stroke: gray, strokeWidth: 0.5 }} />
        ))}
        {/* Table */}
        <rect x="40" y="64" width="280" height="84" fill="white" style={{ stroke: gray, strokeWidth: 0.5 }} />
        <rect x="40" y="64" width="280" height="7" fill={light} />
        {[0,1,2,3,4,5].map(i => (
          <g key={i}>
            <rect x="40" y={73 + i * 12} width="280" height="11" fill={i%2===0?"white":"#faf9f7"} />
            <rect x="44" y={76 + i * 12} width="40" height="3" fill={amber} opacity="0.5" rx="1" />
            <rect x="90" y={76 + i * 12} width="40" height="3" fill={amber} opacity="0.4" rx="1" />
            <rect x="140" y={76 + i * 12} width="50" height="3" fill={gray} rx="1" />
            <rect x="220" y={75 + i * 12} width="25" height="5" fill={i<2?light:i<4?c:"#6e6b65"} style={{ stroke: i<2?c:"none", strokeWidth: i<2?0.5:0 }} />
            {i < 2 && <rect x="255" y={75 + i * 12} width="30" height="5" fill={c} />}
          </g>
        ))}
      </svg>
    ),
    "M6-S2": (
      <svg viewBox="0 0 320 150" className="w-full" style={{ display: "block" }}>
        <rect x="0" y="0" width="320" height="150" fill={light} />
        <rect x="0" y="0" width="36" height="150" fill="white" style={{ stroke: gray, strokeWidth: 0.5 }} />
        {/* Background table (dimmed) */}
        <rect x="36" y="0" width="284" height="150" fill={light} opacity="0.6" />
        {/* Modal overlay */}
        <rect x="0" y="0" width="320" height="150" fill="rgba(15,14,12,0.45)" />
        {/* Modal */}
        <rect x="80" y="20" width="170" height="115" fill="white" style={{ stroke: gray, strokeWidth: 1 }} />
        <rect x="80" y="20" width="170" height="14" fill={light} style={{ stroke: gray, strokeWidth: 0.5 }} />
        <rect x="86" y="24" width="70" height="4" fill={c} rx="1" />
        <rect x="238" y="22" width="8" height="8" fill={light} style={{ stroke: gray, strokeWidth: 0.5 }} />
        {[0,1,2,3,4,5].map(i => (
          <g key={i}>
            <rect x="86" y={40 + i * 14} width="40" height="2" fill={gray} opacity="0.5" rx="1" />
            <rect x="140" y={40 + i * 14} width="90" height="3" fill={amber} opacity="0.5" rx="1" />
          </g>
        ))}
      </svg>
    ),
    "M7-S1": (
      <svg viewBox="0 0 320 150" className="w-full" style={{ display: "block" }}>
        <rect x="0" y="0" width="320" height="150" fill={light} />
        <rect x="0" y="0" width="36" height="150" fill="white" style={{ stroke: gray, strokeWidth: 0.5 }} />
        <rect x="36" y="0" width="284" height="150" fill={light} />
        <rect x="40" y="4" width="280" height="12" fill="white" style={{ stroke: gray, strokeWidth: 0.5 }} />
        {[0,1,2,3].map(i => (
          <rect key={i} x={40 + i * 71} y="20" width="68" height="20" fill="white" style={{ stroke: gray, strokeWidth: 0.5 }} />
        ))}
        {/* Tabs */}
        <rect x="40" y="44" width="90" height="10" fill={light} style={{ stroke: gray, strokeWidth: 0.5 }} />
        <rect x="130" y="44" width="70" height="10" fill={c} />
        {/* Charts */}
        <rect x="40" y="54" width="136" height="70" fill="white" style={{ stroke: gray, strokeWidth: 0.5 }} />
        <rect x="40" y="54" width="136" height="8" fill={light} />
        {/* Bar chart */}
        {[18,22,30,27,42,35].map((v, i) => (
          <rect key={i} x={50 + i * 18} y={114 - v} width="10" height={v} fill={c} />
        ))}
        {/* Horizontal chart */}
        <rect x="180" y="54" width="140" height="70" fill="white" style={{ stroke: gray, strokeWidth: 0.5 }} />
        <rect x="180" y="54" width="140" height="8" fill={light} />
        {[52,33,24,18,12].map((v, i) => (
          <rect key={i} x="205" y={68 + i * 10} width={v * 1.5} height="6" fill={`hsl(0,0%,${20 + i * 14}%)`} rx="1" />
        ))}
        {/* Breakdown */}
        <rect x="40" y="128" width="280" height="18" fill="white" style={{ stroke: gray, strokeWidth: 0.5 }} />
        {[0,1,2,3].map(i => (
          <g key={i}>
            <rect x={44 + i * 70} y="132" width="50" height="2" fill={gray} opacity="0.5" rx="1" />
            <rect x={44 + i * 70} y="137" width="20" height="5" fill={c} opacity="0.3" rx="1" />
          </g>
        ))}
      </svg>
    ),
  };

  return mockups[screenId] ?? (
    <div className="flex items-center justify-center h-20 text-[10px]" style={{ color: "#c4c0b9" }}>
      No preview
    </div>
  );
}

/* ─────────────────────────── ARCHITECTURE OVERVIEW ─────────────────────────── */
function ArchitectureOverview() {
  return (
    <div className="bg-white p-6 mb-1" style={{ border: "1px solid #c4c0b9" }}>
      <div className="text-[9px] font-bold tracking-[0.2em] mb-4" style={{ color: "#9e9b96" }}>
        SYSTEM ARCHITECTURE — MODULE INTERACTION MAP
      </div>
      <div className="flex flex-wrap items-center gap-2 mb-5">
        {MODULES.map(m => (
          <div key={m.id} className="flex items-center gap-2 px-3 py-2" style={{ background: "#f5f3f0", border: "1px solid #c4c0b9" }}>
            <div className="w-3 h-3 flex-shrink-0" style={{ background: m.color }} />
            <span className="text-[9px] font-bold tracking-[0.1em]">{m.id}</span>
            <span className="text-[9px]" style={{ color: "#6e6b65" }}>
              {m.name.split(" ").slice(0, 2).join(" ")}
            </span>
          </div>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        {ARCH_LINKS.map(l => (
          <div key={`${l.from}-${l.to}`} className="flex items-center gap-1.5 px-2.5 py-1.5 text-[9px]" style={{ background: "#faf9f7", border: "1px solid #e8e5e0" }}>
            <span className="font-bold" style={{ color: MODULES.find(m => m.id === l.from)?.color }}>{l.from}</span>
            <ArrowRight className="w-3 h-3" style={{ color: "#c4c0b9" }} />
            <span className="font-bold" style={{ color: MODULES.find(m => m.id === l.to)?.color }}>{l.to}</span>
            <span style={{ color: "#9e9b96" }}>{l.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─────────────────────────── MAIN COMPONENT ─────────────────────────── */
export default function PrototypeDocs() {
  const [expandedModule, setExpandedModule] = useState<string | null>("M1");

  const toggle = (id: string) =>
    setExpandedModule(prev => (prev === id ? null : id));

  return (
    <div className="min-h-screen" style={{ fontFamily: "'Space Mono', monospace", background: "#eae7e2" }}>

      {/* Sticky header */}
      <div
        className="sticky top-0 z-10 flex items-center justify-between px-8 py-4"
        style={{ background: "#0f0e0c", borderBottom: "1px solid #1a1916" }}
      >
        <div>
          <div className="text-[9px] font-bold tracking-[0.22em] mb-0.5" style={{ color: "rgba(255,255,255,0.4)" }}>
            BARANGAY PORTAL SYSTEM
          </div>
          <h1 className="text-sm font-bold tracking-[0.1em] text-white">
            SYSTEM MODULE DOCUMENTATION & PROTOTYPE
          </h1>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-white text-right">
            <div className="text-3xl font-bold leading-none">{MODULES.length}</div>
            <div className="text-[9px] tracking-[0.12em]" style={{ color: "rgba(255,255,255,0.45)" }}>TOTAL MODULES</div>
          </div>
          <div className="w-px h-10" style={{ background: "rgba(255,255,255,0.15)" }} />
          <div className="text-white text-right">
            <div className="text-3xl font-bold leading-none">
              {MODULES.reduce((acc, m) => acc + m.screens.length, 0)}
            </div>
            <div className="text-[9px] tracking-[0.12em]" style={{ color: "rgba(255,255,255,0.45)" }}>TOTAL SCREENS</div>
          </div>
        </div>
      </div>

      <div className="px-8 py-7 max-w-7xl mx-auto">

        {/* Module count summary strip */}
        <div
          className="flex items-center gap-0 mb-6 overflow-hidden"
          style={{ border: "1px solid #c4c0b9" }}
        >
          {MODULES.map((m, i) => (
            <button
              key={m.id}
              onClick={() => toggle(m.id)}
              className="flex-1 flex flex-col items-center py-4 transition-all"
              style={{
                background: expandedModule === m.id ? m.color : "#fff",
                borderRight: i < MODULES.length - 1 ? "1px solid #c4c0b9" : "none",
              }}
            >
              <div
                className="text-xs font-bold tracking-[0.1em]"
                style={{ color: expandedModule === m.id ? "#fff" : m.color }}
              >
                {m.id}
              </div>
              <div
                className="text-[8px] tracking-[0.08em] mt-0.5 text-center leading-tight"
                style={{ color: expandedModule === m.id ? "rgba(255,255,255,0.7)" : "#9e9b96" }}
              >
                {m.name.split(" ")[0]}
                <br />
                {m.name.split(" ")[1]}
              </div>
              <div
                className="text-[8px] font-bold mt-1.5 tracking-[0.06em]"
                style={{ color: expandedModule === m.id ? "rgba(255,255,255,0.6)" : "#c4c0b9" }}
              >
                {m.screens.length} SCR
              </div>
            </button>
          ))}
        </div>

        {/* Architecture overview */}
        <ArchitectureOverview />

        {/* Divider */}
        <div className="my-6 flex items-center gap-4">
          <div className="flex-1 h-px" style={{ background: "#c4c0b9" }} />
          <span className="text-[9px] font-bold tracking-[0.2em]" style={{ color: "#9e9b96" }}>
            MODULE SPECIFICATIONS & SCREEN DOCUMENTATION
          </span>
          <div className="flex-1 h-px" style={{ background: "#c4c0b9" }} />
        </div>

        {/* Module accordion */}
        <div>
          {MODULES.map(mod => (
            <ModuleCard
              key={mod.id}
              mod={mod}
              expanded={expandedModule === mod.id}
              onToggle={() => toggle(mod.id)}
            />
          ))}
        </div>

        {/* Footer */}
        <div
          className="mt-6 px-6 py-4 flex items-center justify-between"
          style={{ background: "#f5f3f0", border: "1px solid #c4c0b9" }}
        >
          <span className="text-[9px] font-bold tracking-[0.12em]" style={{ color: "#9e9b96" }}>
            BARANGAY CERTIFICATION APPOINTMENT & INQUIRY SYSTEM — PROTOTYPE DOCUMENTATION
          </span>
          <span className="text-[9px] font-bold tracking-[0.12em]" style={{ color: "#9e9b96" }}>
            {MODULES.length} MODULES · {MODULES.reduce((a, m) => a + m.screens.length, 0)} SCREENS · v1.0
          </span>
        </div>
      </div>
    </div>
  );
}
