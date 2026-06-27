import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Search,
  Wifi,
  WifiOff,
  IndianRupee,
  Mic,
  MapPin,
  Users,
  Globe,
  Zap,
  Shield,
  Heart,
} from "lucide-react";

const team = [
  { name: "Hrishikesh Yagnik", avatar: "HY" },
  { name: "Kaartik Nayak", avatar: "KN" },
  { name: "Soham Mhatre", avatar: "SM" },
  { name: "Pushkar Singh", avatar: "PS" },
];

const pillars = [
  {
    icon: <WifiOff className="w-8 h-8" />,
    title: "Works Offline & Online",
    desc: "Reports sync instantly when there's signal, and store-and-forward over a local network when there isn't. The search never stops — even when the internet does.",
    color: "from-blue-500 to-cyan-500",
  },
  {
    icon: <IndianRupee className="w-8 h-8" />,
    title: "Costs Almost Nothing",
    desc: "Reuses volunteers' own phones and one laptop per zone. No servers, no new hardware. Infrastructure that's already on site — ready for full-scale deployment.",
    color: "from-green-500 to-emerald-500",
  },
  {
    icon: <Mic className="w-8 h-8" />,
    title: "Fast & Anyone Can Use It",
    desc: "Just speak — in any language. Our AI transcribes, translates, and fills in the case. A geo-tagged photo auto-captures coordinates and zone. Report to match in seconds.",
    color: "from-orange-500 to-amber-500",
  },
];

export default function AboutPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950 text-white">
      {/* Header */}
      <header className="sticky top-0 z-50 backdrop-blur-xl bg-gray-950/70 border-b border-white/10">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center gap-3">
          <button
            onClick={() => navigate("/login")}
            className="p-2 rounded-lg hover:bg-white/10 transition"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2">
            <Search className="w-6 h-6 text-orange-400" />
            <span className="text-xl font-bold tracking-tight">Sherlock</span>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-10 space-y-16">
        {/* Hero */}
        <section className="text-center space-y-4">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-orange-500/10 border border-orange-500/20 text-orange-400 text-sm font-medium">
            <Zap className="w-4 h-4" />
            Hackathon Project
          </div>
          <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight leading-tight">
            Missing Person Response System
            <br />
            <span className="bg-gradient-to-r from-orange-400 to-amber-400 bg-clip-text text-transparent">
              for the Kumbh Mela
            </span>
          </h1>
          <p className="text-gray-400 text-lg max-w-2xl mx-auto leading-relaxed">
            At the largest human gathering on the planet, the thing that fails
            first is connectivity — and that's the one thing every other
            solution depends on. We built for that reality.
          </p>
        </section>

        {/* The Problem */}
        <section className="space-y-6">
          <div className="flex items-center gap-3">
            <div className="h-px flex-1 bg-gradient-to-r from-transparent via-red-500/40 to-transparent" />
            <h2 className="text-2xl font-bold text-red-400 flex items-center gap-2">
              <Shield className="w-6 h-6" /> The Problem
            </h2>
            <div className="h-px flex-1 bg-gradient-to-r from-transparent via-red-500/40 to-transparent" />
          </div>

          <div className="grid sm:grid-cols-2 gap-6">
            <div className="rounded-2xl bg-white/5 border border-white/10 p-6 space-y-3">
              <div className="text-3xl font-black text-red-400">100M+</div>
              <p className="text-gray-300">
                People gather at Kumbh Mela — the largest congregation of human
                beings on the planet. In crowds this dense, families get
                separated by the thousands.
              </p>
            </div>
            <div className="rounded-2xl bg-white/5 border border-white/10 p-6 space-y-3">
              <div className="text-3xl font-black text-red-400">Fragmented</div>
              <p className="text-gray-300">
                Today's response is paper logs, loudspeaker announcements, and
                help booths that don't talk to each other. A child found at one
                end, a parent searching at the other — they may never connect.
              </p>
            </div>
            <div className="rounded-2xl bg-white/5 border border-white/10 p-6 space-y-3">
              <div className="text-3xl font-black text-red-400">No Signal</div>
              <p className="text-gray-300">
                The obvious fix — one big cloud system — fails at exactly the
                worst moment: when the phone networks collapse under the weight
                of millions of connections.
              </p>
            </div>
            <div className="rounded-2xl bg-white/5 border border-white/10 p-6 space-y-3">
              <div className="text-3xl font-black text-red-400">
                Minutes Matter
              </div>
              <p className="text-gray-300">
                Every minute a child or elderly person stays lost in a crowd of
                millions increases risk. The current system — with no shared
                data — turns minutes into hours, or worse.
              </p>
            </div>
          </div>
        </section>

        {/* Three Pillars */}
        <section className="space-y-6">
          <div className="flex items-center gap-3">
            <div className="h-px flex-1 bg-gradient-to-r from-transparent via-orange-500/40 to-transparent" />
            <h2 className="text-2xl font-bold text-orange-400 flex items-center gap-2">
              <Zap className="w-6 h-6" /> Three Pillars
            </h2>
            <div className="h-px flex-1 bg-gradient-to-r from-transparent via-orange-500/40 to-transparent" />
          </div>

          <div className="grid sm:grid-cols-3 gap-6">
            {pillars.map((p) => (
              <div
                key={p.title}
                className="rounded-2xl bg-white/5 border border-white/10 p-6 space-y-4 hover:bg-white/[0.08] transition"
              >
                <div
                  className={`w-14 h-14 rounded-xl bg-gradient-to-br ${p.color} flex items-center justify-center text-white`}
                >
                  {p.icon}
                </div>
                <h3 className="text-lg font-bold">{p.title}</h3>
                <p className="text-gray-400 text-sm leading-relaxed">
                  {p.desc}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* How It Works */}
        <section className="space-y-6">
          <div className="flex items-center gap-3">
            <div className="h-px flex-1 bg-gradient-to-r from-transparent via-purple-500/40 to-transparent" />
            <h2 className="text-2xl font-bold text-purple-400 flex items-center gap-2">
              <Globe className="w-6 h-6" /> How It Works
            </h2>
            <div className="h-px flex-1 bg-gradient-to-r from-transparent via-purple-500/40 to-transparent" />
          </div>

          <div className="rounded-2xl bg-white/5 border border-white/10 p-8">
            <div className="grid sm:grid-cols-4 gap-6 text-center">
              {[
                {
                  step: "1",
                  label: "Report",
                  desc: "Public or volunteer files a report via voice + photo",
                  icon: <Mic className="w-6 h-6" />,
                },
                {
                  step: "2",
                  label: "Sync",
                  desc: "Data syncs to cloud or local zone hub automatically",
                  icon: <Wifi className="w-6 h-6" />,
                },
                {
                  step: "3",
                  label: "Match",
                  desc: "AI matches reports across zones using photo + details",
                  icon: <Search className="w-6 h-6" />,
                },
                {
                  step: "4",
                  label: "Reunite",
                  desc: "Matched cases alert all connected devices in real-time",
                  icon: <MapPin className="w-6 h-6" />,
                },
              ].map((s) => (
                <div key={s.step} className="space-y-3">
                  <div className="w-12 h-12 rounded-full bg-purple-500/20 border border-purple-500/30 flex items-center justify-center mx-auto text-purple-400">
                    {s.icon}
                  </div>
                  <div className="text-sm font-bold text-purple-300">
                    Step {s.step}
                  </div>
                  <div className="font-semibold">{s.label}</div>
                  <p className="text-gray-400 text-xs">{s.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Impact */}
        <section className="space-y-6">
          <div className="flex items-center gap-3">
            <div className="h-px flex-1 bg-gradient-to-r from-transparent via-green-500/40 to-transparent" />
            <h2 className="text-2xl font-bold text-green-400 flex items-center gap-2">
              <Globe className="w-6 h-6" /> Beyond Kumbh Mela
            </h2>
            <div className="h-px flex-1 bg-gradient-to-r from-transparent via-green-500/40 to-transparent" />
          </div>
          <div className="rounded-2xl bg-white/5 border border-white/10 p-6">
            <p className="text-gray-300 leading-relaxed">
              Nothing here is specific to one festival. Any mass event, any
              disaster zone, anywhere networks buckle and people get separated —
              this works. Kumbh Mela is the hardest version of the problem,
              which is exactly why we started there.
            </p>
            <p className="text-gray-400 mt-4 text-sm italic">
              "The largest crowd on Earth shouldn't mean the hardest place to
              find someone. With Sherlock, it doesn't."
            </p>
          </div>
        </section>

        {/* Made By */}
        <section className="space-y-6">
          <div className="flex items-center gap-3">
            <div className="h-px flex-1 bg-gradient-to-r from-transparent via-amber-500/40 to-transparent" />
            <h2 className="text-2xl font-bold text-amber-400 flex items-center gap-2">
              <Heart className="w-6 h-6" /> Made By
            </h2>
            <div className="h-px flex-1 bg-gradient-to-r from-transparent via-amber-500/40 to-transparent" />
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-6">
            {team.map((m) => (
              <div
                key={m.name}
                className="rounded-2xl bg-white/5 border border-white/10 p-6 text-center hover:bg-white/[0.08] transition space-y-3"
              >
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-orange-500 to-amber-500 flex items-center justify-center mx-auto text-white text-xl font-bold">
                  {m.avatar}
                </div>
                <div className="font-semibold text-sm">{m.name}</div>
              </div>
            ))}
          </div>
        </section>

        {/* Footer */}
        <footer className="text-center text-gray-500 text-sm pb-8 pt-4 border-t border-white/5">
          Built with{" "}
          <Heart className="w-3.5 h-3.5 inline text-red-400 fill-red-400" /> for
          Hackathon 2027 &middot; Sherlock — Missing Person Response System
        </footer>
      </main>
    </div>
  );
}
