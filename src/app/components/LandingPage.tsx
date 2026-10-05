import { useEffect, useState } from "react";
import { format } from "date-fns";
import { getPublicPosts, PublicPost, subscribePublicPosts } from "../portalData";
import { publicAsset } from "../publicAsset";
import { isSupabaseConfigured } from "../supabase";

type LandingPageProps = {
  onContinue: () => void;
};

const officials = [
  {
    name: "Punong Barangay Perlita Lugares",
    role: "Punong Barangay",
    image: "officials/Punong Barangay Perlita Lugares.jpg",
  },
  {
    name: "Brgy. Kgwd. Errol Julian",
    role: "Barangay Kagawad",
    image: "officials/Brgy. Kgwd. Errol Julian.jpg",
  },
  {
    name: "Brgy. Kgwd. Ramil Villar",
    role: "Barangay Kagawad",
    image: "officials/Brgy. Kgwd. Ramil Villar.jpg",
  },
  {
    name: "Brgy. Kgwd. Rodrigo Aquino III",
    role: "Barangay Kagawad",
    image: "officials/Brgy. Kgwd. Rodrigo Aquino III.jpg",
  },
  {
    name: "Brgy. Kgwd. Amado Hidalgo",
    role: "Barangay Kagawad",
    image: "officials/Brgy. Kgwd. Amado Hidalgo.jpg",
  },
  {
    name: "Brgy. Kgwd. Felipe Ogaco",
    role: "Barangay Kagawad",
    image: "officials/Brgy. Kgwd. Felipe Ogaco.jpg",
  },
  {
    name: "Brgy. Kgwd. Ricky Carmesis",
    role: "Barangay Kagawad",
    image: "officials/Brgy. Kgwd. Ricky Carmesis.jpg",
  },
  {
    name: "Bry. Kgwd. Rodillo Aloot",
    role: "Barangay Kagawad",
    image: "officials/Bry. Kgwd. Rodillo Aloot.jpg",
  },
  {
    name: "Brgy Secretary Meka Ella Arandia",
    role: "Barangay Secretary",
    image: "officials/Brgy Secretary Meka Ella Arandia.jpg",
  },
  {
    name: "Barangay Treasurer Janelyn Pajarit",
    role: "Barangay Treasurer",
    image: "officials/Brgy. Treasurer Janelyn Pajarit.jpg",
  },
  {
    name: "SK Chairman Vannrexsir Peralta",
    role: "SK Chairman",
    image: "officials/SK Chairman Vannrexsir Peralta.jpg",
  },
];

export default function LandingPage({ onContinue }: LandingPageProps) {
  const [posts, setPosts] = useState<PublicPost[]>([]);
  useEffect(() => {
    let active = true;
    const refreshPosts = async () => {
      try {
        const loadedPosts = await getPublicPosts();
        if (active) setPosts(loadedPosts.filter((post) => !post.archived));
      } catch (error) {
        console.error("Unable to load public announcements.", error);
      }
    };
    void refreshPosts();
    const unsubscribe = subscribePublicPosts(() => { void refreshPosts(); });
    return () => { active = false; unsubscribe(); };
  }, []);
  const lastUpdated = posts.reduce(
    (latest, post) => Math.max(latest, new Date(post.publishedAt).getTime()),
    0
  );
  const navItems = [
    { label: "Home", href: "#home" },
    { label: "News", href: "#news" },
    { label: "Services", href: "#services" },
    { label: "Contact", href: "#contact" },
  ];

  return (
    <div className="min-h-screen bg-[#edf1ee] text-[#1a2e22]" style={{ fontFamily: "'Segoe UI', 'Arial', sans-serif" }}>
      {!isSupabaseConfigured && (
        <div role="status" className="bg-amber-50 px-4 py-2 text-center text-sm font-semibold text-amber-950">
          Database setup is required before resident accounts and shared service records can be used.
        </div>
      )}
      <header className="border-b border-[#d3d9d4] bg-[#123323] text-white shadow-[0_2px_10px_rgba(10,25,18,0.15)]">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <img
              src={publicAsset("officials/brgylagasit.png")}
              alt="Barangay Lagasit logo"
              className="h-12 w-12 rounded-full border border-white/20 bg-white object-contain p-1"
            />
            <div>
              <div className="text-sm font-bold tracking-[0.08em]">BARANGAY LAGASIT</div>
              <div className="text-xs tracking-[0.04em] text-white/75">SAN QUINTIN, PANGASINAN</div>
            </div>
          </div>

          <nav className="hidden items-center gap-8 md:flex">
            {navItems.map((item) => (
              <a
                key={item.label}
                href={item.href}
                className="text-sm font-semibold tracking-wide text-white/85 transition-colors hover:text-white"
              >
                {item.label}
              </a>
            ))}
          </nav>

          <button
            onClick={onContinue}
            className="min-h-11 border border-white/20 bg-[#f5f5f2] px-5 py-2 text-sm font-bold text-[#123323] transition-opacity hover:opacity-90"
          >
            RESIDENT SIGN IN
          </button>
        </div>
      </header>

      <main className="mx-auto w-full px-0 pt-10 pb-0 lg:pt-14">
        <section id="home" className="mx-auto grid w-full max-w-[1600px] items-center gap-8 px-6 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="border border-[#c9d1ca] bg-white p-8 shadow-[0_18px_40px_rgba(17,33,25,0.06)] md:p-10">
            <p className="mb-5 text-sm font-bold tracking-wide text-[#6a766e] uppercase">
              Public Service Portal
            </p>
            <h1 className="mb-4 text-4xl font-black leading-tight tracking-[-0.04em] text-[#122d1f] md:text-5xl xl:text-6xl">
              Barangay services, made easier.
            </h1>
            <p className="max-w-xl text-base leading-relaxed text-[#53645b] md:text-lg">
              Barangay Lagasit provides accessible government services, efficient appointment processing, and timely public updates to strengthen the welfare of the community.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <button
                onClick={onContinue}
                className="min-h-12 bg-[#123323] px-6 py-3 text-sm font-bold text-white transition-opacity hover:opacity-90"
              >
                SIGN IN / REGISTER
              </button>
              <a
                href="#services"
                className="flex min-h-12 items-center border border-[#c9d1ca] bg-[#f4f8f4] px-4 py-3 text-sm font-bold text-[#123323] transition-colors hover:bg-[#edf5ee]"
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
                  <div className="text-xs font-bold tracking-wide text-[#758179]">{title}</div>
                  <div className="mt-1 text-sm font-bold text-[#123323]">{desc}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="border border-[#c9d1ca] bg-[#f5f7f5] p-3 shadow-[0_20px_45px_rgba(18,51,35,0.08)]">
            <div className="mb-3 border-b border-[#c9d1ca] pb-2">
              <div className="text-[9px] font-bold tracking-[0.18em] text-[#67766b] uppercase">Barangay Leadership</div>
            </div>
            <img
              src={publicAsset("officials/group photo.jpg")}
              alt="Barangay Lagasit officials"
              className="h-[420px] w-full object-contain bg-white"
            />
            <div className="mt-3 border-t border-[#c9d1ca] pt-2 text-[10px] font-bold tracking-[0.12em] text-[#51635d] uppercase">
              Community Governance
            </div>
          </div>
        </section>

        <section id="news" className="mx-auto mt-12 grid w-full max-w-[1600px] gap-6 px-6 lg:grid-cols-[1.3fr_0.7fr]">
          <div className="border border-[#c9d1ca] bg-white">
            <div className="flex flex-wrap items-end justify-between gap-3 border-b border-[#c9d1ca] bg-[#f7faf7] px-6 py-5">
              <div>
                <p className="text-sm font-bold tracking-wide text-[#6a766e] uppercase">Barangay Updates</p>
                <h2 className="mt-1 text-2xl font-black text-[#122d1f]">News and announcements</h2>
              </div>
              <p className="text-sm text-[#53645b]">
                Last updated: {format(new Date(lastUpdated || Date.now()), "MMMM d, yyyy 'at' h:mm a")}
              </p>
            </div>
            <div aria-live="polite">
              {posts.length ? posts
                .slice()
                .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt))
                .map((post) => (
                  <article key={post.id} className="border-b border-[#e3e8e3] px-6 py-5 last:border-b-0">
                    <div className="mb-2 flex flex-wrap items-center gap-3">
                      <span className="bg-[#123323] px-2.5 py-1 text-xs font-bold text-white">{post.type}</span>
                      <time className="text-sm text-[#53645b]" dateTime={post.publishedAt}>
                        {format(new Date(post.publishedAt), "MMMM d, yyyy")}
                      </time>
                    </div>
                    <h3 className="text-lg font-bold text-[#122d1f]">{post.title}</h3>
                    <p className="mt-2 text-base leading-relaxed text-[#53645b]">{post.content}</p>
                  </article>
                )) : (
                <p className="px-6 py-5 text-base text-[#53645b]">There are no current public announcements.</p>
              )}
            </div>
          </div>

          <div className="grid gap-4">
            <article className="border border-[#c9d1ca] bg-white p-6">
              <p className="text-sm font-bold tracking-wide text-[#6a766e] uppercase">Draft for barangay confirmation</p>
              <h2 className="mt-2 text-2xl font-black text-[#122d1f]">Mission</h2>
              <p className="mt-3 text-base leading-relaxed text-[#53645b]">
                To provide responsive, fair, and accessible public service that supports the safety, welfare, and growth of every Barangay Lagasit resident.
              </p>
            </article>
            <article className="border border-[#c9d1ca] bg-white p-6">
              <p className="text-sm font-bold tracking-wide text-[#6a766e] uppercase">Draft for barangay confirmation</p>
              <h2 className="mt-2 text-2xl font-black text-[#122d1f]">Vision</h2>
              <p className="mt-3 text-base leading-relaxed text-[#53645b]">
                A peaceful, inclusive, and progressive barangay where residents can access trusted services and take part in community development.
              </p>
            </article>
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
                  src={publicAsset(official.image)}
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
              ["Phone", "Official number to be confirmed"],
              ["Email", "Official email to be confirmed"],
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
                src={publicAsset("officials/brgylagasit.png")}
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
