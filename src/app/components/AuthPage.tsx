import { useState } from "react";
import { toast } from "sonner";
import { publicAsset } from "../publicAsset";
import { formatResidentAddress, RESIDENT_BARANGAY_ADDRESS } from "../residentAddress";
import {
  registerResidentAccount,
  ResidentAccount,
  signInResident,
  signInStaff,
} from "../residentAuth";
import { isSupabaseConfigured } from "../supabase";

interface AuthPageProps {
  onLogin: (userType: "user" | "admin", name: string, account?: ResidentAccount) => void;
  adminOnly?: boolean;
  onBackToPublicSite?: () => void;
}

const labelCls = "block text-[9px] font-bold tracking-[0.18em] mb-2";

function FocusInput({ value, onChange, placeholder, type = "text" }: {
  value: string; onChange: (v: string) => void; placeholder?: string; type?: string;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <input
      type={type}
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full px-4 py-3 text-[11px] outline-none transition-all bg-white"
      style={{
        fontFamily: "'Segoe UI', 'Arial', sans-serif",
        border: `1.5px solid ${focused ? "#123323" : "#c9d1ca"}`,
      }}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
    />
  );
}

type View = "login" | "register";

export default function AuthPage({
  onLogin,
  adminOnly = false,
  onBackToPublicSite,
}: AuthPageProps) {
  const [view, setView] = useState<View>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [adminPass, setAdminPass] = useState("");
  const [reg, setReg] = useState({ firstName: "", lastName: "", email: "", contact: "", address: "", password: "", confirm: "" });
  const handleResidentLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) { toast.error("Please fill in all fields"); return; }
    try {
      const account = await signInResident(email, password);
      toast.success("Login successful!");
      onLogin("user", account.name, account);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to sign in.");
    }
  };

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminEmail || !adminPass) { toast.error("Enter your staff email and password."); return; }
    try {
      const account = await signInStaff(adminEmail, adminPass);
      toast.success("Staff login successful!");
      onLogin("admin", account.name, account);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to sign in.");
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    const { firstName, lastName, email: rEmail, contact, address, password: rPass, confirm } = reg;
    if (!firstName || !lastName || !rEmail || !contact || !address || !rPass) { toast.error("Please fill in all required fields"); return; }
    if (rPass !== confirm) { toast.error("Passwords do not match"); return; }
    if (rPass.length < 8) { toast.error("Use a password with at least 8 characters."); return; }
    try {
      const account = await registerResidentAccount({
        firstName, lastName, email: rEmail, contactNumber: contact, address: formatResidentAddress(address), password: rPass,
      });
      toast.success("Resident account created. You are now signed in.");
      onLogin("user", account.name, account);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to create the account.");
    }
  };

  return (
    <div className="min-h-screen flex" style={{ fontFamily: "'Segoe UI', 'Arial', sans-serif", background: "#edf1ee" }}>

      {/* Left panel */}
      <div
        className="hidden lg:flex flex-col justify-between p-12 flex-shrink-0"
        style={{ width: 380, background: "#123323" }}
      >
        <div>
          <div className="flex items-center gap-3 mb-16">
            <img
              src={publicAsset("officials/brgylagasit.png")}
              alt="Barangay Lagasit logo"
              className="w-12 h-12 object-contain rounded-full flex-shrink-0"
            />
            <div>
              <div className="text-[11px] font-bold tracking-[0.14em] text-white">BARANGAY LAGASIT</div>
              <div className="text-[9px] tracking-[0.1em]" style={{ color: "rgba(255,255,255,0.4)" }}>PORTAL SYSTEM</div>
            </div>
          </div>
          <p className="text-[9px] font-bold tracking-[0.2em] mb-4" style={{ color: "rgba(255,255,255,0.35)" }}>— BARANGAY PORTAL SYSTEM v1.0</p>
          <h1 className="font-bold text-white leading-tight mb-5" style={{ fontSize: "clamp(28px,3vw,42px)", letterSpacing: "-0.02em" }}>
            Barangay<br />Lagasit
          </h1>
          <p className="text-[11px] leading-relaxed" style={{ color: "rgba(255,255,255,0.45)" }}>
            Official certification appointment and inquiry system for residents and barangay staff.
          </p>
        </div>
        <div style={{ borderTop: "1px solid rgba(255,255,255,0.1)", paddingTop: 24 }}>
          {[["Online Booking","ACTIVE"],["LagaBot FAQ","AVAILABLE"],["Walk-in Schedule","VIEW"]].map(([label, status]) => (
            <div key={label} className="flex justify-between items-center mb-3">
              <span className="text-[10px]" style={{ color: "rgba(255,255,255,0.45)" }}>{label}</span>
              <span className="text-[9px] font-bold tracking-[0.1em]" style={{ color: "rgba(255,255,255,0.75)" }}>{status}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Right: form area */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div style={{ width: "100%", maxWidth: 420 }}>
          {onBackToPublicSite && (
            <button
              type="button"
              onClick={onBackToPublicSite}
              className="mb-5 text-sm font-semibold text-[#123323] underline underline-offset-4"
            >
              Back to public site
            </button>
          )}

          {/* LOGIN */}
          {view === "login" && (
            <div>
              <div className="mb-8">
                <div className="text-xs font-bold tracking-wide mb-2" style={{ color: "#6e6b65" }}>
                  {adminOnly ? "STAFF ACCESS" : "PORTAL ACCESS"}
                </div>
                <h2 className="text-2xl font-bold tracking-tight mb-1">
                  {adminOnly ? "Staff sign in" : "Sign in"}
                </h2>
                <p className="text-sm leading-relaxed" style={{ color: "#53645b" }}>
                  {adminOnly
                    ? "Sign in with a staff account approved by the Barangay administrator."
                    : "Sign in to view only your own requests and resident information."}
                </p>
              </div>
              {!isSupabaseConfigured && (
                <div role="alert" className="mb-4 rounded border border-red-300 bg-red-50 px-4 py-3 text-sm leading-relaxed text-red-950">
                  Database is not configured. The portal sign-in and shared records are unavailable until the Supabase project settings are added to the app environment.
                </div>
              )}
              {!adminOnly && (
                <div className="flex mb-6" style={{ border: "1px solid #c4c0b9" }}>
                  <button
                    className="flex-1 py-3 text-sm font-bold uppercase"
                    style={{ background: "#123323", color: "#fff" }}
                  >
                    Resident
                  </button>
                </div>
              )}
              {!adminOnly ? (
                <form onSubmit={handleResidentLogin} className="space-y-4">
                  <div><label className={labelCls}>EMAIL ADDRESS</label><FocusInput value={email} onChange={setEmail} placeholder="your@email.com" type="email" /></div>
                  <div><label className={labelCls}>PASSWORD</label><FocusInput value={password} onChange={setPassword} placeholder="••••••••" type="password" /></div>
                  <button disabled={!isSupabaseConfigured} type="submit" className="w-full py-3 text-[11px] font-bold tracking-[0.12em] text-white hover:opacity-80 transition-opacity mt-1 disabled:cursor-not-allowed disabled:opacity-50" style={{ background: "#123323" }}>LOGIN</button>
                  <p className="text-center text-xs leading-relaxed text-[#6e6b65]">
                    If you cannot sign in, contact the Barangay office to request account recovery.
                  </p>
                </form>
              ) : (
                <form onSubmit={handleAdminLogin} className="space-y-4">
                  <div><label className={labelCls}>STAFF EMAIL</label><FocusInput value={adminEmail} onChange={setAdminEmail} placeholder="staff@barangay.gov.ph" type="email" /></div>
                  <div><label className={labelCls}>PASSWORD</label><FocusInput value={adminPass} onChange={setAdminPass} placeholder="••••••••" type="password" /></div>
                  <div className="px-4 py-3 text-sm leading-relaxed" style={{ background: "#f5f3f0", border: "1px solid #c4c0b9", color: "#53645b" }}>
                    Staff access is verified by Supabase Auth and the database staff role.
                  </div>
                  <button disabled={!isSupabaseConfigured} type="submit" className="w-full py-3 text-[11px] font-bold tracking-[0.12em] text-white hover:opacity-80 transition-opacity disabled:cursor-not-allowed disabled:opacity-50" style={{ background: "#123323" }}>STAFF LOGIN</button>
                </form>
              )}
              {!adminOnly && <p className="text-center text-sm mt-6" style={{ color: "#6e6b65" }}>
                No account?{" "}
                <button onClick={() => setView("register")} className="font-bold hover:opacity-70 transition-opacity" style={{ color: "#123323" }}>Register here</button>
              </p>}
            </div>
          )}

          {/* REGISTER */}
          {view === "register" && (
            <div>
              <div className="mb-8">
                <div className="text-[9px] font-bold tracking-[0.22em] mb-2" style={{ color: "#9e9b96" }}>NEW ACCOUNT</div>
                <h2 className="text-2xl font-bold tracking-tight mb-1">Create resident account</h2>
                <p className="text-[11px]" style={{ color: "#6e6b65" }}>Register to access barangay services online</p>
              </div>
              <div className="mb-4 rounded border border-[#c9d1ca] bg-[#f7faf7] px-3 py-2 text-xs leading-relaxed text-[#34483a]">
                Create your account and start using the resident portal immediately. No email confirmation or staff approval is required.
              </div>
              <form onSubmit={handleRegister} className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div><label className={labelCls}>FIRST NAME <span style={{ color: "#b91c1c" }}>*</span></label><FocusInput value={reg.firstName} onChange={v => setReg(p => ({ ...p, firstName: v }))} placeholder="Juan" /></div>
                  <div><label className={labelCls}>LAST NAME <span style={{ color: "#b91c1c" }}>*</span></label><FocusInput value={reg.lastName} onChange={v => setReg(p => ({ ...p, lastName: v }))} placeholder="dela Cruz" /></div>
                </div>
                <div>
                  <label className={labelCls}>EMAIL ADDRESS <span style={{ color: "#b91c1c" }}>*</span></label>
                  <FocusInput value={reg.email} onChange={v => setReg(p => ({ ...p, email: v }))} placeholder="your@email.com" type="email" />
                </div>
                <div>
                  <label className={labelCls}>CONTACT NUMBER <span style={{ color: "#b91c1c" }}>*</span></label>
                  <FocusInput value={reg.contact} onChange={v => setReg(p => ({ ...p, contact: v }))} placeholder="+639171234567 or 09XX-XXX-XXXX" type="tel" />
                </div>
                <fieldset className="grid gap-3">
                  <legend className={labelCls}>HOME ADDRESS <span style={{ color: "#b91c1c" }}>*</span></legend>
                  <label className="grid gap-1.5 text-[10px] font-bold tracking-wide text-[#53645b]">
                    BARANGAY
                    <select
                      value={RESIDENT_BARANGAY_ADDRESS}
                      disabled
                      className="min-h-11 w-full border border-[#c9d1ca] bg-[#f5f7f5] px-3 text-sm text-[#34483a]"
                    >
                      <option value={RESIDENT_BARANGAY_ADDRESS}>{RESIDENT_BARANGAY_ADDRESS}</option>
                    </select>
                  </label>
                  <label className="grid gap-1.5 text-[10px] font-bold tracking-wide text-[#53645b]">
                    HOUSE / STREET / SITIO
                    <FocusInput value={reg.address} onChange={v => setReg(p => ({ ...p, address: v }))} placeholder="House number, street, or sitio" />
                  </label>
                </fieldset>
                <div className="grid grid-cols-2 gap-3">
                  <div><label className={labelCls}>PASSWORD (8+ CHARACTERS) <span style={{ color: "#b91c1c" }}>*</span></label><FocusInput value={reg.password} onChange={v => setReg(p => ({ ...p, password: v }))} placeholder="••••••••" type="password" /></div>
                  <div><label className={labelCls}>CONFIRM</label><FocusInput value={reg.confirm} onChange={v => setReg(p => ({ ...p, confirm: v }))} placeholder="••••••••" type="password" /></div>
                </div>
                <button disabled={!isSupabaseConfigured} type="submit" className="w-full py-3 text-[11px] font-bold tracking-[0.12em] text-white hover:opacity-80 transition-opacity mt-1 disabled:cursor-not-allowed disabled:opacity-50" style={{ background: "#0f0e0c" }}>CREATE ACCOUNT</button>
              </form>
              <p className="text-center text-[10px] mt-5" style={{ color: "#9e9b96" }}>
                Already registered?{" "}
                <button onClick={() => setView("login")} className="font-bold hover:opacity-70 transition-opacity" style={{ color: "#123323" }}>Sign in here</button>
              </p>
            </div>
          )}

          <p className="text-center text-[9px] mt-8" style={{ color: "#c4c0b9" }}>
            By using this system, you agree to provide accurate information for appointment requests.
          </p>
        </div>
      </div>
    </div>
  );
}
