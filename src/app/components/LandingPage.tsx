type LandingPageProps = {
  onContinue: () => void;
};

const officials = [
  {
    name: "Punong Barangay Perlita Lugares",
    role: "Punong Barangay",
    image: "officials/Punong%20Barangay%20Perlita%20Lugares.jpg",
  },
  {
    name: "Brgy. Kgwd. Errol Julian",
    role: "Barangay Kagawad",
    image: "officials/Brgy.%20Kgwd.%20Errol%20Julian.jpg",
  },
  {
    name: "Brgy. Kgwd. Ramil Villar",
    role: "Barangay Kagawad",
    image: "officials/Brgy.%20Kgwd.%20Ramil%20Villar.jpg",
  },
  {
    name: "Brgy. Kgwd. Rodrigo Aquino III",
    role: "Barangay Kagawad",
    image: "officials/Brgy.%20Kgwd.%20Rodrigo%20Aquino%20III.jpg",
  },
  {
    name: "Brgy. Kgwd. Amado Hidalgo",
    role: "Barangay Kagawad",
    image: "officials/Brgy.%20Kgwd.%20Amado%20Hidalgo.jpg",
  },
  {
    name: "Brgy. Kgwd. Felipe Ogaco",
    role: "Barangay Kagawad",
    image: "officials/Brgy.%20Kgwd.%20Felipe%20Ogaco.jpg",
  },
  {
    name: "Brgy. Kgwd. Ricky Carmesis",
    role: "Barangay Kagawad",
    image: "officials/Brgy.%20Kgwd.%20Ricky%20Carmesis.jpg",
  },
  {
    name: "Bry. Kgwd. Rodillo Aloot",
    role: "Barangay Kagawad",
    image: "officials/Bry.%20Kgwd.%20Rodillo%20Aloot.jpg",
  },
  {
    name: "Brgy Secretary Meka Ella Arandia",
    role: "Barangay Secretary",
    image: "officials/Brgy%20Secretary%20Meka%20Ella%20Arandia.jpg",
  },
  {
    name: "Barangay Treasurer Janelyn Pajarit",
    role: "Barangay Treasurer",
    image: "officials/Brgy.%20Treasurer%20Janelyn%20Pajarit.jpg",
  },
  {
    name: "SK Chairman Vannrexsir Peralta",
    role: "SK Chairman",
    image: "officials/SK%20Chairman%20Vannrexsir%20Peralta.jpg",
  },
];

export default function LandingPage({ onContinue }: LandingPageProps) {
  const navItems = [
    { label: "HOME", href: "#home" },
    { label: "OFFICIALS", href: "#officials" },
    { label: "SERVICES", href: "#services" },
    { label: "CONTACT", href: "#contact" },
  ];

  return (
    <div className="min-h-screen bg-[#edf1ee] text-[#1a2e22]" style={{ fontFamily: "'Segoe UI', 'Arial', sans-serif" }}>
      <header className="border-b border-[#d3d9d4] bg-[#123323] text-white shadow-[0_2px_10px_rgba(10,25,18,0.15)]">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <img
              src="officials/brgylagasit.png"
              alt="Barangay Lagasit logo"
              className="h-12 w-12 rounded-full border border-white/20 bg-white object-contain p-1"
            />
            <div>
              <div className="text-[11px] font-bold tracking-[0.16em]">BARANGAY LAGASIT</div>
              <div className="text-[9px] tracking-[0.12em] text-white/65">OFFICIAL GOVERNMENT PORTAL</div>
            </div>
          </div>

          <nav className="hidden items-center gap-8 md:flex">
            {navItems.map((item) => (
              <a
                key={item.label}
                href={item.href}
                className="text-[9px] font-bold tracking-[0.16em] text-white/75 transition-colors hover:text-white"
              >
                {item.label}
              </a>
            ))}
          </nav>

          <button
            onClick={onContinue}
            className="border border-white/20 bg-[#f5f5f2] px-5 py-2 text-[10px] font-bold tracking-[0.12em] text-[#123323] transition-opacity hover:opacity-90"
          >
            LOGIN
          </button>
        </div>
      </header>

      <main className="mx-auto w-full px-0 pt-10 pb-0 lg:pt-14">
        <section id="home" className="mx-auto grid w-full max-w-[1600px] items-center gap-8 px-6 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="border border-[#c9d1ca] bg-white p-8 shadow-[0_18px_40px_rgba(17,33,25,0.06)] md:p-10">
            <p className="mb-5 text-[10px] font-bold tracking-[0.2em] text-[#6a766e] uppercase">
              Public Service Portal
            </p>
            <h1 className="mb-4 text-4xl font-black leading-[0.96] tracking-[-0.04em] text-[#122d1f] md:text-5xl xl:text-6xl">
              Official services for every citizen.
            </h1>
            <p className="max-w-xl text-sm leading-relaxed text-[#53645b] md:text-base">
              Barangay Lagasit provides accessible government services, efficient appointment processing, and timely public updates to strengthen the welfare of the community.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <button
                onClick={onContinue}
                className="bg-[#123323] px-6 py-3 text-[11px] font-bold tracking-[0.12em] text-white transition-opacity hover:opacity-90"
              >
                ENTER PORTAL
              </button>
              <a
                href="#services"
                className="flex items-center border border-[#c9d1ca] bg-[#f4f8f4] px-4 py-3 text-[10px] font-bold tracking-[0.12em] text-[#123323] transition-colors hover:bg-[#edf5ee]"
              >
                VIEW SERVICES
              </a>
            </div>

            <div id="services" className="mt-8 grid gap-3 sm:grid-cols-3">
              {[
                ["Appointments", "Scheduling assistance"],
                ["Certificates", "Fast document processing"],
                ["Updates", "Community announcements"],
              ].map(([title, desc]) => (
                <div key={title} className="border border-[#d7ddd7] bg-[#f7faf7] p-3">
                  <div className="text-[9px] font-bold tracking-[0.14em] text-[#758179]">{title}</div>
                  <div className="mt-1 text-[11px] font-bold text-[#123323]">{desc}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="border border-[#c9d1ca] bg-[#f5f7f5] p-3 shadow-[0_20px_45px_rgba(18,51,35,0.08)]">
            <div className="mb-3 border-b border-[#c9d1ca] pb-2">
              <div className="text-[9px] font-bold tracking-[0.18em] text-[#67766b] uppercase">Barangay Leadership</div>
            </div>
            <img
              src="officials/group%20photo.jpg"
              alt="Barangay Lagasit officials"
              className="h-[420px] w-full object-contain bg-white"
            />
            <div className="mt-3 border-t border-[#c9d1ca] pt-2 text-[10px] font-bold tracking-[0.12em] text-[#51635d] uppercase">
              Community Governance
            </div>
          </div>
        </section>

        <section id="officials" className="mx-auto mt-16 w-full max-w-[1600px] px-6">
          <div className="mb-6 flex items-center justify-between gap-3">
            <div>
              <p className="text-[10px] font-bold tracking-[0.18em] text-[#6a766e] uppercase">Officials</p>
              <h2 className="mt-2 text-2xl font-black tracking-[-0.03em] text-[#122d1f] md:text-3xl">Barangay Leadership</h2>
            </div>
          </div>

          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {officials.map((official) => (
              <div key={official.name} className="border border-[#c9d1ca] bg-white p-3 shadow-[0_8px_20px_rgba(17,33,25,0.03)] transition-transform hover:-translate-y-0.5">
                <img
                  src={official.image}
                  alt={official.name}
                  className="h-64 w-full object-contain border border-[#e7ece7] bg-[#fafbf9]"
                />
                <div className="mt-3">
                  <div className="text-[9px] font-bold tracking-[0.14em] text-[#6c766f] uppercase">{official.role}</div>
                  <div className="mt-1 text-sm font-bold leading-snug text-[#122d1f]">{official.name}</div>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section id="contact" className="mx-auto mt-16 w-full max-w-[1600px] border border-[#c9d1ca] bg-white p-8 px-6 md:p-10">
          <div className="mb-6">
            <p className="text-[10px] font-bold tracking-[0.18em] text-[#6a766e] uppercase">Contact</p>
            <h2 className="mt-2 text-2xl font-black tracking-[-0.03em] text-[#122d1f] md:text-3xl">Barangay Contact Information</h2>
          </div>
          <div className="grid gap-6 md:grid-cols-4">
            {[
              ["Office Address", "Barangay Hall, Barangay Lagasit, San Quintin, Pangasinan"],
              ["Phone", "+63 (000) 000-0000"],
              ["Email", "barangaylagasit@example.com"],
              ["Office Hours", "Monday to Friday • 8:00 AM - 5:00 PM"],
            ].map(([label, value]) => (
              <div key={label} className="border border-[#d7ddd7] bg-[#f7faf7] p-4">
                <div className="text-[9px] font-bold tracking-[0.14em] text-[#67766b] uppercase">{label}</div>
                <div className="mt-2 text-sm font-bold leading-relaxed text-[#122d1f]">{value}</div>
              </div>
            ))}
          </div>
        </section>

        <footer className="mt-0 border-t border-[#c9d1ca] bg-[#123323] px-6 py-6 text-white">
          <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-3">
              <img
                src="officials/brgylagasit.png"
                alt="Barangay Lagasit logo"
                className="h-10 w-10 rounded-full border border-white/20 bg-white object-contain p-1"
              />
              <div>
                <div className="text-[10px] font-bold tracking-[0.18em] text-white/65">BARANGAY LAGASIT</div>
                <div className="mt-1 text-sm font-bold text-white">Official Portal</div>
              </div>
            </div>

            <div className="text-[10px] font-bold tracking-[0.12em] text-white/70">
              BARANGAY HALL • SAN QUINTIN • PANGASINAN
            </div>
          </div>
        </footer>
      </main>
    </div>
  );
}
