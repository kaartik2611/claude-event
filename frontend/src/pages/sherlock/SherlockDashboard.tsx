import { useState } from "react";
import { useAuth } from "../../context/AuthContext";
import CaseForm from "../../components/sherlock/CaseForm";
import { Search, UserCheck, Users, ArrowLeft, LogOut } from "lucide-react";

const caseTypes = [
  {
    id: "lost" as const,
    title: "Person Lost",
    subtitle: "Report a missing person",
    desc: "Family member, child, or companion separated at the mela",
    icon: <Search className="w-7 h-7" />,
    color: "from-red-500 to-rose-600",
    border: "hover:border-red-500/50",
    badge: "bg-red-500/10 text-red-400",
    items: [
      "Reporter + Lost Person Photos",
      "GPS Location Auto-capture",
      "Physical Description & Clothing",
    ],
  },
  {
    id: "searching" as const,
    title: "Searching",
    subtitle: "Someone searching for family",
    desc: "A person approaches you looking for their lost family member",
    icon: <Users className="w-7 h-7" />,
    color: "from-amber-500 to-yellow-600",
    border: "hover:border-amber-500/50",
    badge: "bg-amber-500/10 text-amber-400",
    items: [
      "Reporter Photo",
      "Capture or Describe Person",
      "Cross-center Match Search",
    ],
  },
  {
    id: "found" as const,
    title: "Found Person",
    subtitle: "Found someone lost or disoriented",
    desc: "An unknown person who appears lost, confused, or needs help",
    icon: <UserCheck className="w-7 h-7" />,
    color: "from-blue-500 to-indigo-600",
    border: "hover:border-blue-500/50",
    badge: "bg-blue-500/10 text-blue-400",
    items: [
      "Reporter + Found Person Photos",
      "GPS Location",
      "Auto P1 Alert to Police",
    ],
  },
];

export default function SherlockDashboard() {
  const { user, logout } = useAuth();
  const [selectedCase, setSelectedCase] = useState<
    "lost" | "searching" | "found" | null
  >(null);

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Header */}
      <header className="bg-gray-900 border-b border-gray-800">
        <div className="max-w-4xl mx-auto px-4 py-3 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-kumbh-orange to-kumbh-gold flex items-center justify-center text-sm font-black shadow">
              K
            </div>
            <div>
              <h1 className="text-sm font-bold">Sherlock Station</h1>
              <p className="text-[10px] text-gray-500">
                {user?.name} · Field Volunteer
              </p>
            </div>
          </div>
          <button
            onClick={logout}
            className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-300 px-3 py-1.5 rounded-lg hover:bg-gray-800 transition"
          >
            <LogOut className="w-3.5 h-3.5" /> Logout
          </button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8">
        {!selectedCase ? (
          <div>
            <div className="text-center mb-10">
              <h2 className="text-2xl font-bold mb-2">
                What do you need to report?
              </h2>
              <p className="text-sm text-gray-500">
                Select the type of case to file a report
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-4">
              {caseTypes.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setSelectedCase(c.id)}
                  className={`group text-left bg-gray-900 rounded-2xl p-6 border-2 border-gray-800 ${c.border} transition-all hover:shadow-xl hover:shadow-black/30 hover:-translate-y-1`}
                >
                  <div
                    className={`w-12 h-12 rounded-xl bg-gradient-to-br ${c.color} flex items-center justify-center text-white mb-4 shadow-lg group-hover:scale-110 transition-transform`}
                  >
                    {c.icon}
                  </div>
                  <h3 className="text-lg font-bold mb-1">{c.title}</h3>
                  <p className="text-xs text-gray-400 mb-3">{c.desc}</p>
                  <div className="space-y-1.5">
                    {c.items.map((item, i) => (
                      <div
                        key={i}
                        className="flex items-center gap-2 text-[11px] text-gray-500"
                      >
                        <span className="w-1 h-1 rounded-full bg-gray-600" />
                        {item}
                      </div>
                    ))}
                  </div>
                  <div
                    className={`mt-4 inline-block text-[10px] font-semibold uppercase tracking-wider px-2 py-1 rounded-md ${c.badge}`}
                  >
                    {c.id === "found"
                      ? "Auto P1 Escalation"
                      : c.id === "lost"
                        ? "Broadcast Alert"
                        : "Cross-Center Match"}
                  </div>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div>
            <button
              onClick={() => setSelectedCase(null)}
              className="mb-6 flex items-center gap-2 text-sm text-gray-400 hover:text-white px-3 py-2 rounded-lg hover:bg-gray-800 transition"
            >
              <ArrowLeft className="w-4 h-4" /> Back to Case Selection
            </button>
            <CaseForm
              caseType={selectedCase}
              onSuccess={() => setSelectedCase(null)}
            />
          </div>
        )}
      </main>
    </div>
  );
}
