import { useEffect, useState } from "react";
import { C } from "./components/theme";
import Login from "./components/Login";
import SignUp from "./components/SignUp";
import HomePage from "./pages/Homepage";

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

  // Akun Utama & Akun Pendamping sekarang setara -- satu HomePage yang
  // sama, dua-duanya bisa catat/edit/hapus transaksi & kelola target.
  return <HomePage user={user} onLogout={handleLogout} />;
}
