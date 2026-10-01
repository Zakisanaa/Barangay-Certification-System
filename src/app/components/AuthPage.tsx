import { useState } from "react";
import { toast } from "sonner";
import { RegisteredUser } from "../App";

interface AuthPageProps {
  onLogin: (userType: "user" | "admin", name: string) => void;
  onRegister: (user: RegisteredUser) => void;
  onPasswordReset: (email: string, newPassword: string) => void;
  registeredUsers: RegisteredUser[];
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

type View = "login" | "register" | "forgot";

export default function AuthPage({ onLogin, onRegister, onPasswordReset, registeredUsers }: AuthPageProps) {
  const [view, setView] = useState<View>("login");
  const [loginTab, setLoginTab] = useState<"resident" | "admin">("resident");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [adminUser, setAdminUser] = useState("");
  const [adminPass, setAdminPass] = useState("");
  const [reg, setReg] = useState({ firstName: "", lastName: "", email: "", contact: "", address: "", password: "", confirm: "" });
  const [resetEmail, setResetEmail] = useState("");
  const [resetContact, setResetContact] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [resetStep, setResetStep] = useState<"verify" | "reset">("verify");

  const handleResidentLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) { toast.error("Please fill in all fields"); return; }
    const user = registeredUsers.find(u => u.email === email && u.password === password);
    if (user) { toast.success("Login successful!"); onLogin("user", `${user.firstName} ${user.lastName}`); }
    else toast.error("Invalid email or password. Please register first.");
  };

  const handleAdminLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (adminUser === "admin" && adminPass === "admin123") {
      toast.success("Admin login successful!"); onLogin("admin", "Administrator");
    } else toast.error("Invalid admin credentials");
  };

  const handleRegister = (e: React.FormEvent) => {
    e.preventDefault();
    const { firstName, lastName, email: rEmail, contact, address, password: rPass, confirm } = reg;
    if (!firstName || !lastName || !rEmail || !contact || !address || !rPass) { toast.error("Please fill in all required fields"); return; }
    if (rPass !== confirm) { toast.error("Passwords do not match"); return; }
    if (registeredUsers.find(u => u.email === rEmail)) { toast.error("Email already registered"); return; }
    onRegister({ firstName, lastName, email: rEmail, contactNumber: contact, address, password: rPass });
    toast.success("Registration successful! Please login.");
    setView("login");
  };

  const handleVerifyReset = (e: React.FormEvent) => {
    e.preventDefault();
    const user = registeredUsers.find(u => u.email === resetEmail && u.contactNumber === resetContact);
    if (user) { setResetStep("reset"); toast.success("Identity verified."); }
    else toast.error("Email and contact number do not match our records.");
  };

  const handleResetPassword = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPassword || newPassword !== confirmPassword) { toast.error("Passwords do not match"); return; }
    onPasswordReset(resetEmail, newPassword);
    toast.success("Password reset successfully!");
    setView("login"); setResetStep("verify"); setResetEmail(""); setResetContact(""); setNewPassword(""); setConfirmPassword("");
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
              src="officials/brgylagasit.png"
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
          {[["Online Booking","ACTIVE"],["AI Assistant","ONLINE"],["Walk-in Service","OPEN"]].map(([label, status]) => (
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

          {/* LOGIN */}
          {view === "login" && (
            <div>
              <div className="mb-8">
                <div className="text-[9px] font-bold tracking-[0.22em] mb-2" style={{ color: "#9e9b96" }}>PORTAL ACCESS</div>
                <h2 className="text-2xl font-bold tracking-tight mb-1">Sign In</h2>
                <p className="text-[11px]" style={{ color: "#6e6b65" }}>Access the Barangay Portal System</p>
              </div>
              <div className="flex mb-6" style={{ border: "1px solid #c4c0b9" }}>
                {(["resident", "admin"] as const).map(t => (
                  <button key={t} onClick={() => setLoginTab(t)} className="flex-1 py-2.5 text-[10px] font-bold tracking-[0.12em] uppercase transition-all"
                    style={loginTab === t ? { background: "#123323", color: "#fff" } : { background: "#f4f8f4", color: "#6a766e" }}>
                    {t === "resident" ? "Resident" : "Admin / Staff"}
                  </button>
                ))}
              </div>
              {loginTab === "resident" ? (
                <form onSubmit={handleResidentLogin} className="space-y-4">
                  <div><label className={labelCls}>EMAIL ADDRESS</label><FocusInput value={email} onChange={setEmail} placeholder="your@email.com" type="email" /></div>
                  <div><label className={labelCls}>PASSWORD</label><FocusInput value={password} onChange={setPassword} placeholder="••••••••" type="password" /></div>
                  <div className="flex justify-end">
                    <button type="button" onClick={() => setView("forgot")} className="text-[10px] font-bold hover:opacity-70 transition-opacity" style={{ color: "#123323" }}>Forgot password?</button>
                  </div>
                  <button type="submit" className="w-full py-3 text-[11px] font-bold tracking-[0.12em] text-white hover:opacity-80 transition-opacity mt-1" style={{ background: "#123323" }}>LOGIN</button>
                </form>
              ) : (
                <form onSubmit={handleAdminLogin} className="space-y-4">
                  <div><label className={labelCls}>ADMIN USERNAME</label><FocusInput value={adminUser} onChange={setAdminUser} placeholder="admin" /></div>
                  <div><label className={labelCls}>PASSWORD</label><FocusInput value={adminPass} onChange={setAdminPass} placeholder="••••••••" type="password" /></div>
                  <div className="px-4 py-3 text-[10px] leading-relaxed" style={{ background: "#f5f3f0", border: "1px solid #c4c0b9", color: "#6e6b65" }}>
                    Demo credentials: <strong>admin</strong> / <strong>admin123</strong>
                  </div>
                  <button type="submit" className="w-full py-3 text-[11px] font-bold tracking-[0.12em] text-white hover:opacity-80 transition-opacity" style={{ background: "#123323" }}>ADMIN LOGIN</button>
                </form>
              )}
              <p className="text-center text-[10px] mt-6" style={{ color: "#9e9b96" }}>
                No account?{" "}
                <button onClick={() => setView("register")} className="font-bold hover:opacity-70 transition-opacity" style={{ color: "#123323" }}>Register here</button>
              </p>
            </div>
          )}

          {/* REGISTER */}
          {view === "register" && (
            <div>
              <div className="mb-8">
                <div className="text-[9px] font-bold tracking-[0.22em] mb-2" style={{ color: "#9e9b96" }}>NEW ACCOUNT</div>
                <h2 className="text-2xl font-bold tracking-tight mb-1">Create Account</h2>
                <p className="text-[11px]" style={{ color: "#6e6b65" }}>Register to access barangay services online</p>
              </div>
              <form onSubmit={handleRegister} className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div><label className={labelCls}>FIRST NAME <span style={{ color: "#b91c1c" }}>*</span></label><FocusInput value={reg.firstName} onChange={v => setReg(p => ({ ...p, firstName: v }))} placeholder="Juan" /></div>
                  <div><label className={labelCls}>LAST NAME <span style={{ color: "#b91c1c" }}>*</span></label><FocusInput value={reg.lastName} onChange={v => setReg(p => ({ ...p, lastName: v }))} placeholder="dela Cruz" /></div>
                </div>
                <div><label className={labelCls}>EMAIL ADDRESS <span style={{ color: "#b91c1c" }}>*</span></label><FocusInput value={reg.email} onChange={v => setReg(p => ({ ...p, email: v }))} placeholder="your@email.com" type="email" /></div>
                <div><label className={labelCls}>CONTACT NUMBER <span style={{ color: "#b91c1c" }}>*</span></label><FocusInput value={reg.contact} onChange={v => setReg(p => ({ ...p, contact: v }))} placeholder="09XX-XXX-XXXX" /></div>
                <div><label className={labelCls}>HOME ADDRESS <span style={{ color: "#b91c1c" }}>*</span></label><FocusInput value={reg.address} onChange={v => setReg(p => ({ ...p, address: v }))} placeholder="123 Rizal St., [Barangay Name]" /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div><label className={labelCls}>PASSWORD <span style={{ color: "#b91c1c" }}>*</span></label><FocusInput value={reg.password} onChange={v => setReg(p => ({ ...p, password: v }))} placeholder="••••••••" type="password" /></div>
                  <div><label className={labelCls}>CONFIRM</label><FocusInput value={reg.confirm} onChange={v => setReg(p => ({ ...p, confirm: v }))} placeholder="••••••••" type="password" /></div>
                </div>
                <button type="submit" className="w-full py-3 text-[11px] font-bold tracking-[0.12em] text-white hover:opacity-80 transition-opacity mt-1" style={{ background: "#0f0e0c" }}>CREATE ACCOUNT</button>
              </form>
              <p className="text-center text-[10px] mt-5" style={{ color: "#9e9b96" }}>
                Already registered?{" "}
                <button onClick={() => setView("login")} className="font-bold hover:opacity-70 transition-opacity" style={{ color: "#123323" }}>Sign in here</button>
              </p>
            </div>
          )}

          {/* FORGOT */}
          {view === "forgot" && (
            <div>
              <div className="mb-8">
                <div className="text-[9px] font-bold tracking-[0.22em] mb-2" style={{ color: "#9e9b96" }}>
                  {resetStep === "verify" ? "IDENTITY VERIFICATION" : "SET NEW PASSWORD"}
                </div>
                <h2 className="text-2xl font-bold tracking-tight mb-1">{resetStep === "verify" ? "Reset Password" : "New Password"}</h2>
                <p className="text-[11px]" style={{ color: "#6e6b65" }}>
                  {resetStep === "verify" ? "Enter your registered email and contact number to verify your identity." : "Choose a strong new password for your account."}
                </p>
              </div>
              {resetStep === "verify" ? (
                <form onSubmit={handleVerifyReset} className="space-y-4">
                  <div><label className={labelCls}>EMAIL ADDRESS</label><FocusInput value={resetEmail} onChange={setResetEmail} placeholder="your@email.com" type="email" /></div>
                  <div><label className={labelCls}>CONTACT NUMBER</label><FocusInput value={resetContact} onChange={setResetContact} placeholder="09XX-XXX-XXXX" /></div>
                  <button type="submit" className="w-full py-3 text-[11px] font-bold tracking-[0.12em] text-white hover:opacity-80 transition-opacity mt-1" style={{ background: "#0f0e0c" }}>VERIFY IDENTITY</button>
                </form>
              ) : (
                <form onSubmit={handleResetPassword} className="space-y-4">
                  <div><label className={labelCls}>NEW PASSWORD</label><FocusInput value={newPassword} onChange={setNewPassword} placeholder="••••••••" type="password" /></div>
                  <div><label className={labelCls}>CONFIRM PASSWORD</label><FocusInput value={confirmPassword} onChange={setConfirmPassword} placeholder="••••••••" type="password" /></div>
                  <button type="submit" className="w-full py-3 text-[11px] font-bold tracking-[0.12em] text-white hover:opacity-80 transition-opacity mt-1" style={{ background: "#0f0e0c" }}>RESET PASSWORD</button>
                </form>
              )}
              <p className="text-center text-[10px] mt-5">
                <button onClick={() => { setView("login"); setResetStep("verify"); }} className="font-bold hover:opacity-70 transition-opacity" style={{ color: "#bf6318" }}>← Back to login</button>
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
