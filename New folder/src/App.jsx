import { useEffect, useState } from "react";
import { C } from "./component/theme";
import Login from "./component/Login";
import SignUp from "./component/SignUp";
import ChildDashboard from "./component/ChildDashboard";
import ParentDashboard from "./component/ParentDashboard";

export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showSignUp, setShowSignUp] = useState(false);

  useEffect(() => {
    const saved =
      localStorage.getItem("mywallet_user") ||
      sessionStorage.getItem("mywallet_user");
    if (saved) {
      try {
        setUser(JSON.parse(saved));
      } catch {
        localStorage.removeItem("mywallet_user");
        sessionStorage.removeItem("mywallet_user");
      }
    }
    setLoading(false);
  }, []);

  function handleLogout() {
    localStorage.removeItem("mywallet_user");
    sessionStorage.removeItem("mywallet_user");
    setUser(null);
  }

  // Dipanggil dari SignUp setelah akun berhasil dibuat (baik langsung
  // ke-link via kode, maupun belum). Persist ke localStorage sama
  // kayak "Ingat saya" dicentang di Login, biar ga perlu login ulang.
  function handleSignUpSuccess(newUser) {
    if (!newUser) {
      setShowSignUp(false);
      return;
    }
    sessionStorage.removeItem("mywallet_user");
    localStorage.setItem("mywallet_user", JSON.stringify(newUser));
    setUser(newUser);
    setShowSignUp(false);
  }

  if (loading) {
    return (
      <div
        className="min-h-screen w-full flex items-center justify-center"
        style={{ background: C.bg, color: C.inkFaint }}>
        Memuat...
      </div>
    );
  }

  if (!user) {
    if (showSignUp) {
      return (
        <SignUp
          onSignUpSuccess={handleSignUpSuccess}
          onBackToLogin={() => setShowSignUp(false)}
        />
      );
    }
    return (
      <Login
        onLoginSuccess={setUser}
        onSignUpClick={() => setShowSignUp(true)}
      />
    );
  }

  if (user.role === "orang_tua") {
    return <ParentDashboard user={user} onLogout={handleLogout} />;
  }

  return <ChildDashboard user={user} onLogout={handleLogout} />;
}
