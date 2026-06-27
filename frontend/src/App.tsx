import { Routes, Route, Navigate } from "react-router-dom";

// Pages
import LoginPage from "./pages/LoginPage";
import SherlockDashboard from "./pages/sherlock/SherlockDashboard";
import PoliceDashboard from "./pages/police/PoliceDashboard";
import CentralDashboard from "./pages/central/CentralDashboard";
import SimulationDashboard from "./pages/central/SimulationDashboard";
import AboutPage from "./pages/AboutPage";

// Components
import OfflineIndicator from "./components/shared/OfflineIndicator";
import { PWAUpdatePrompt } from "./components/shared/PWAUpdatePrompt";

// Context
import { AuthProvider, useAuth } from "./context/AuthContext";

function ProtectedRoute({
  children,
  role,
}: {
  children: React.ReactNode;
  role?: string;
}) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-2xl">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" />;
  }

  if (role && user.role !== role) {
    return <Navigate to="/" />;
  }

  return <>{children}</>;
}

function AppRoutes() {
  const { user } = useAuth();

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/about" element={<AboutPage />} />

      <Route
        path="/sherlock"
        element={
          <ProtectedRoute role="sherlock">
            <SherlockDashboard />
          </ProtectedRoute>
        }
      />

      <Route
        path="/police"
        element={
          <ProtectedRoute role="police">
            <PoliceDashboard />
          </ProtectedRoute>
        }
      />

      <Route
        path="/central"
        element={
          <ProtectedRoute role="admin">
            <CentralDashboard />
          </ProtectedRoute>
        }
      />

      <Route
        path="/simulation"
        element={
          <ProtectedRoute role="admin">
            <SimulationDashboard />
          </ProtectedRoute>
        }
      />

      <Route
        path="/"
        element={
          user ? (
            user.role === "sherlock" ? (
              <Navigate to="/sherlock" />
            ) : user.role === "police" ? (
              <Navigate to="/police" />
            ) : (
              <Navigate to="/central" />
            )
          ) : (
            <Navigate to="/login" />
          )
        }
      />
    </Routes>
  );
}

function App() {
  return (
    <AuthProvider>
      <div className="min-h-screen bg-gray-50">
        <AppRoutes />
        <OfflineIndicator />
        <PWAUpdatePrompt />
      </div>
    </AuthProvider>
  );
}

export default App;
