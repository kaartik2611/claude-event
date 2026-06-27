import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { Eye, EyeOff, LogIn, Shield, Radio, Search, Info } from "lucide-react";
import { validatePhone, formatPhone } from "../utils/validation";

const roles = [
  {
    id: "sherlock" as const,
    label: "Sherlock",
    desc: "Field Volunteer",
    icon: <Search className="w-5 h-5" />,
    color: "from-orange-500 to-amber-500",
    ring: "ring-orange-500",
  },
  {
    id: "police" as const,
    label: "Police",
    desc: "Control Room",
    icon: <Shield className="w-5 h-5" />,
    color: "from-blue-500 to-indigo-600",
    ring: "ring-blue-500",
  },
  {
    id: "admin" as const,
    label: "Central",
    desc: "Command Center",
    icon: <Radio className="w-5 h-5" />,
    color: "from-purple-500 to-fuchsia-600",
    ring: "ring-purple-500",
  },
];

export default function LoginPage() {
  const [role, setRole] = useState<"sherlock" | "police" | "admin">("sherlock");
  const [loginId, setLoginId] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [validationError, setValidationError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const { login } = useAuth();
  const navigate = useNavigate();

  const handleLoginIdChange = (value: string) => {
    setValidationError("");
    if (role === "sherlock") {
      setLoginId(formatPhone(value));
    } else {
      setLoginId(value);
    }
  };

  const validateForm = (): boolean => {
    if (role === "sherlock") {
      if (!validatePhone(loginId)) {
        setValidationError("Please enter a valid 10-digit phone number");
        return false;
      }
    } else if (role === "police") {
      if (loginId.length < 3) {
        setValidationError("Station ID must be at least 3 characters");
        return false;
      }
    } else if (role === "admin") {
      if (loginId.length < 3) {
        setValidationError("Username must be at least 3 characters");
        return false;
      }
    }

    if (role !== "sherlock" && password.length < 6) {
      setValidationError("Password must be at least 6 characters");
      return false;
    }

    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setValidationError("");

    if (!validateForm()) {
      return;
    }

    setLoading(true);

    try {
      await login(loginId, password, role);
      if (role === "sherlock") navigate("/sherlock");
      else if (role === "police") navigate("/police");
      else navigate("/central");
    } catch (err: any) {
      setError(
        err.response?.data?.error ||
          "Login failed. Please check your credentials.",
      );
    } finally {
      setLoading(false);
    }
  };

  const selectedRole = roles.find((r) => r.id === role)!;

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Animated background */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-1/2 -left-1/2 w-full h-full bg-gradient-to-br from-kumbh-orange/10 to-transparent rounded-full blur-3xl animate-pulse" />
        <div
          className="absolute -bottom-1/2 -right-1/2 w-full h-full bg-gradient-to-tl from-blue-600/10 to-transparent rounded-full blur-3xl animate-pulse"
          style={{ animationDelay: "1s" }}
        />
      </div>

      <div className="relative w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-kumbh-orange to-kumbh-gold flex items-center justify-center text-3xl font-black text-white shadow-lg shadow-orange-500/20 mb-4">
            K
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">
            Kumbh Mela 2027
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Missing Person Response System
          </p>
          <p className="text-xs text-gray-600 mt-0.5">
            Nashik-Trimbakeshwar Simhastha
          </p>
        </div>

        {/* Card */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl shadow-2xl shadow-black/50 p-6">
          {/* Role Selector */}
          <div className="grid grid-cols-3 gap-2 mb-6">
            {roles.map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => setRole(r.id)}
                className={`relative flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 transition-all ${
                  role === r.id
                    ? `border-transparent bg-gradient-to-br ${r.color} text-white shadow-lg`
                    : "border-gray-700 bg-gray-800/50 text-gray-400 hover:border-gray-600 hover:text-gray-300"
                }`}
              >
                {r.icon}
                <span className="text-xs font-bold">{r.label}</span>
                <span className="text-[9px] opacity-70">{r.desc}</span>
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Login ID */}
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1.5 uppercase tracking-wider">
                {role === "sherlock"
                  ? "Phone Number"
                  : role === "police"
                    ? "Station ID"
                    : "Username"}
              </label>
              <input
                type="text"
                value={loginId}
                onChange={(e) => handleLoginIdChange(e.target.value)}
                className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:ring-2 focus:ring-kumbh-orange/50 focus:border-kumbh-orange outline-none transition"
                placeholder={
                  role === "sherlock"
                    ? "+91 9876543210"
                    : role === "police"
                      ? "test_station"
                      : "admin"
                }
                required
              />
              {role === "sherlock" && loginId && !validatePhone(loginId) && (
                <p className="text-xs text-amber-400 mt-1.5 flex items-center gap-1">
                  <span>⚠️</span> Format: +91 followed by 10 digits
                </p>
              )}
              {role === "sherlock" && loginId && validatePhone(loginId) && (
                <p className="text-xs text-emerald-400 mt-1.5 flex items-center gap-1">
                  <span>✓</span> Valid phone number
                </p>
              )}
            </div>

            {/* Password */}
            {role !== "sherlock" && (
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1.5 uppercase tracking-wider">
                  Password
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:ring-2 focus:ring-kumbh-orange/50 focus:border-kumbh-orange outline-none transition pr-12"
                    placeholder="Enter password"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
                  >
                    {showPassword ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>
            )}

            {(error || validationError) && (
              <div className="bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded-xl text-sm">
                {error || validationError}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className={`w-full py-3 rounded-xl font-semibold text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 bg-gradient-to-r ${selectedRole.color} hover:shadow-lg hover:shadow-kumbh-orange/20 active:scale-[0.98]`}
            >
              {loading ? (
                <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <LogIn className="w-4 h-4" />
                  Login as {selectedRole.label}
                </>
              )}
            </button>
          </form>

          {/* Test credentials */}
          <div className="mt-5 pt-4 border-t border-gray-800">
            <p className="text-[10px] uppercase tracking-wider text-gray-600 mb-2 text-center">
              Test Credentials
            </p>
            <div className="grid grid-cols-1 gap-1.5 text-xs">
              <CredRow label="Sherlock" value="+919876543210" />
              <CredRow label="Police" value="test_station / kumbh2027" />
              <CredRow label="Admin" value="admin / admin123" />
            </div>
          </div>
        </div>

        <button
          onClick={() => navigate('/about')}
          className="mx-auto mt-6 flex items-center gap-1.5 text-[11px] text-gray-500 hover:text-orange-400 transition"
        >
          <Info className="w-3.5 h-3.5" /> About this project
        </button>
        <p className="text-center text-[10px] text-gray-700 mt-2">
          Claude Impact Lab · Kumbhathon Foundation · Govt. of Maharashtra
        </p>
      </div>
    </div>
  );
}

function CredRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between px-3 py-1.5 bg-gray-800/50 rounded-lg">
      <span className="text-gray-500">{label}</span>
      <code className="text-gray-400 font-mono text-[10px]">{value}</code>
    </div>
  );
}
