import { useState } from "react";
import { supabase } from "../supabaseClient";
import { C, FONT_IMPORT } from "./theme";

export default function Login({ onLoginSuccess, onSignUpClick }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(true);
  const [showForgotHint, setShowForgotHint] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleLogin(e) {
    e.preventDefault();
    setError("");
    setShowForgotHint(false);
    setLoading(true);

    const u = username.trim().toLowerCase();

    const { data, error: dbError } = await supabase
      .from("users")
      .select("id, username, password, role, linked_child_id")
      .eq("username", u)
      .single();

    setLoading(false);

    if (dbError || !data) {
      setError("Username atau password salah.");
      return;
    }

    if (data.password !== password) {
      setError("Username atau password salah.");
      return;
    }

    const loggedInUser = {
      id: data.id,
      username: data.username,
      role: data.role,
      linked_child_id: data.linked_child_id,
    };

    // "Ingat saya" checked -> persist across browser restarts (localStorage).
    // Unchecked -> only remember for this tab session (sessionStorage).
    if (remember) {
      sessionStorage.removeItem("mywallet_user");
      localStorage.setItem("mywallet_user", JSON.stringify(loggedInUser));
    } else {
      localStorage.removeItem("mywallet_user");
      sessionStorage.setItem("mywallet_user", JSON.stringify(loggedInUser));
    }
    onLoginSuccess?.(loggedInUser);
  }

  return (
    <div
      className="min-h-screen w-full flex flex-col lg:flex-row"
      style={{ background: C.bg, fontFamily: "'Inter', sans-serif" }}>
      <style>{FONT_IMPORT}</style>

      {/* Hero banner — full-bleed on mobile, left half on desktop */}
      <div
        className="relative w-full h-[228px] sm:h-[260px] lg:h-screen lg:w-1/2 flex-shrink-0 overflow-hidden flex flex-col justify-end"
        style={{
          background: `linear-gradient(135deg, ${C.lavender} 0%, ${C.lavenderSoft} 45%, ${C.skyDeep} 100%)`,
        }}>
        <div
          className="absolute -top-16 -right-10 w-56 h-56 rounded-full opacity-30 blur-3xl"
          style={{ background: C.sky }}
        />
        <div
          className="absolute bottom-0 left-1/3 w-64 h-64 rounded-full opacity-20 blur-3xl"
          style={{ background: C.rose }}
        />

        {/* Signature — oversized bleeding wordmark, like a scrawled savings goal */}
        <p
          className="relative text-[11px] sm:text-[12px] px-6 sm:px-8 lg:px-12 tracking-[0.3em] uppercase font-semibold mb-1"
          style={{ color: "#FFFFFF", opacity: 0.75 }}>
          My Wallet
        </p>
        <p
          aria-hidden="true"
          style={{
            fontFamily: "'Fraunces', serif",
            color: "#FFFFFF",
            opacity: 0.92,
            fontSize: "clamp(88px, 26vw, 168px)",
            lineHeight: 0.82,
            letterSpacing: "-0.03em",
            marginLeft: "-0.04em",
            textShadow: "0 10px 30px rgba(70,63,92,0.18)",
          }}
          className="font-semibold select-none whitespace-nowrap px-1">
          SAKU
        </p>
        <p
          className="relative text-[13px] sm:text-[14px] px-6 sm:px-8 lg:px-12 mb-6 sm:mb-8 lg:mb-10 lg:max-w-xs"
          style={{ color: "#FFFFFF", opacity: 0.9 }}>
          Uang saku bulan ini, ke mana perginya? Catat sekarang, biar tau nanti.
        </p>

        <FloatingDoodles />
      </div>

      {/* Card — overlaps the hero on mobile, sits centered on desktop */}
      <div className="relative flex-1 flex items-center justify-center px-4 sm:px-6 lg:px-10 -mt-7 lg:mt-0 pb-6 lg:pb-0 overflow-hidden">
        {/* Ambient wash so the right panel doesn't read as flat white next
            to the styled hero — echoes the hero's blurred color blobs. */}
        <div
          className="hidden lg:block absolute -top-24 right-[-6rem] w-[420px] h-[420px] rounded-full opacity-[0.14] blur-3xl pointer-events-none"
          style={{ background: C.mint }}
        />
        <div
          className="hidden lg:block absolute bottom-[-8rem] left-[-6rem] w-[380px] h-[380px] rounded-full opacity-[0.12] blur-3xl pointer-events-none"
          style={{ background: C.rose }}
        />

        <form
          onSubmit={handleLogin}
          className="relative w-full max-w-[400px] rounded-[28px] pt-11 px-6 sm:px-7 pb-7"
          style={{
            background: "#FFFFFF",
            boxShadow:
              "0 24px 60px -20px rgba(70,63,92,0.22), 0 2px 8px -2px rgba(70,63,92,0.10)",
          }}>
          <div className="absolute left-1/2 -top-9 -translate-x-1/2">
            <CoinBadge />
          </div>

          <p
            className="text-center text-[11px] tracking-[0.2em] uppercase mb-1 font-semibold"
            style={{ color: C.lavender }}>
            Selamat Datang
          </p>
          <h1
            style={{ fontFamily: "'Fraunces', serif", color: C.ink }}
            className="text-center text-[24px] font-semibold mb-1">
            Masuk ke My Wallet
          </h1>
          <p
            className="text-center text-[13px] mb-6"
            style={{ color: C.inkFaint }}>
            Catat dulu, baru tenang mikirinnya.
          </p>

          <label
            className="text-[11px] uppercase tracking-wide font-medium"
            style={{ color: C.inkFaint }}>
            Username
          </label>
          <div className="relative mt-1.5 mb-4">
            <span
              className="absolute left-3.5 top-1/2 -translate-y-1/2"
              style={{ color: C.inkFaint }}>
              <UserIcon />
            </span>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              autoCapitalize="off"
              autoComplete="username"
              placeholder="username kamu"
              className="w-full pl-10 pr-3.5 py-3 rounded-2xl text-[15px] outline-none border-[1.5px] transition-shadow focus:ring-4 focus:ring-[#8B72C42A]"
              style={{
                background: "#463F5C08",
                color: C.ink,
                borderColor: "#463F5C1F",
              }}
            />
          </div>

          <label
            className="text-[11px] uppercase tracking-wide font-medium"
            style={{ color: C.inkFaint }}>
            Password
          </label>
          <div className="relative mt-1.5 mb-3">
            <span
              className="absolute left-3.5 top-1/2 -translate-y-1/2"
              style={{ color: C.inkFaint }}>
              <LockIcon />
            </span>
            <input
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              placeholder="••••••••"
              className="w-full pl-10 pr-11 py-3 rounded-2xl text-[15px] outline-none border-[1.5px] transition-shadow focus:ring-4 focus:ring-[#8B72C42A]"
              style={{
                background: "#463F5C08",
                color: C.ink,
                borderColor: "#463F5C1F",
              }}
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              tabIndex={-1}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-offset-1"
              style={{ color: C.inkFaint, "--tw-ring-color": C.lavender }}
              aria-label={
                showPassword ? "Sembunyikan password" : "Tampilkan password"
              }>
              {showPassword ? <EyeOffIcon /> : <EyeIcon />}
            </button>
          </div>

          <div className="flex items-center justify-between mb-5 mt-1">
            <button
              type="button"
              onClick={() => setRemember((v) => !v)}
              className="flex items-center gap-2 group rounded-md outline-none focus-visible:ring-2 focus-visible:ring-offset-1"
              style={{ "--tw-ring-color": C.lavender }}>
              <span
                className="w-5 h-5 rounded-md flex items-center justify-center transition-colors"
                style={{
                  background: remember ? C.lavender : "#463F5C0d",
                  border: remember
                    ? `1px solid ${C.lavender}`
                    : "1px solid #463F5C33",
                }}>
                {remember && <CheckIcon />}
              </span>
              <span className="text-[12.5px]" style={{ color: C.inkSoft }}>
                Ingat saya
              </span>
            </button>
            <button
              type="button"
              onClick={() => setShowForgotHint((v) => !v)}
              className="text-[12.5px] font-medium rounded-md outline-none focus-visible:ring-2 focus-visible:ring-offset-1"
              style={{ color: C.lavender, "--tw-ring-color": C.lavender }}>
              Lupa password?
            </button>
          </div>

          {showForgotHint && (
            <div
              className="flex items-start gap-2 text-[12px] mb-4 px-3.5 py-2.5 rounded-xl"
              style={{ background: "#8B72C414", color: C.lavender }}>
              <span className="flex-shrink-0">🔒</span>
              <span>
                Password diatur oleh orang tua / admin. Hubungi mereka untuk
                reset ya.
              </span>
            </div>
          )}

          {error && (
            <div
              className="flex items-center gap-2 text-[12px] mb-4 px-3.5 py-2.5 rounded-xl font-medium"
              style={{ background: "#D9607A14", color: C.roseDeep }}>
              <span className="flex-shrink-0">⚠️</span>
              <span>{error}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 rounded-2xl font-semibold text-[14px] disabled:opacity-50 transition-transform active:scale-[0.98] outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
            style={{
              background: `linear-gradient(135deg, ${C.lavender}, ${C.skyDeep})`,
              color: "#FFFFFF",
              boxShadow: "0 16px 32px -16px rgba(139,114,196,0.6)",
              "--tw-ring-color": C.lavender,
            }}>
            {loading ? "Memproses..." : "Masuk"}
          </button>

          <button
            type="button"
            onClick={onSignUpClick}
            className="w-full text-center mt-6 text-[12.5px] font-medium"
            style={{ color: C.lavender }}>
            Belum punya akun? Daftar
          </button>

          <p
            className="text-center mt-4 text-[12px]"
            style={{ color: C.inkFaint }}>
            © 2026 My Wallet · Buku kas harian
          </p>
        </form>
      </div>
    </div>
  );
}

function UserIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round">
      <rect x="3" y="11" width="18" height="11" rx="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}

function EyeIcon() {
  return (
    <svg
      width="19"
      height="19"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round">
      <path d="M1 12s3-8 11-8 11 8 11 8-3 8-11 8-11-8-11-8Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg
      width="19"
      height="19"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round">
      <path d="M17.94 17.94A10.94 10.94 0 0 1 12 20c-7 0-10-8-10-8a18.7 18.7 0 0 1 4.22-5.94M9.9 4.24A10.4 10.4 0 0 1 12 4c7 0 10 8 10 8a18.6 18.6 0 0 1-2.16 3.19" />
      <path d="M14.12 14.12a3 3 0 1 1-4.24-4.24" />
      <path d="M1 1l22 22" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="#FFFFFF"
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round">
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

function CoinBadge() {
  return (
    <svg width="64" height="64" viewBox="0 0 64 64" fill="none">
      <defs>
        <linearGradient
          id="coinBadgeGradient"
          x1="6"
          y1="6"
          x2="58"
          y2="58"
          gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor={C.lavender} />
          <stop offset="100%" stopColor={C.skyDeep} />
        </linearGradient>
      </defs>
      <circle cx="32" cy="32" r="31" fill="#FFFFFF" />
      <circle cx="32" cy="32" r="29" fill={C.lavenderSoft} opacity="0.25" />
      <circle cx="32" cy="32" r="21" fill="url(#coinBadgeGradient)" />
      <text
        x="32"
        y="40"
        textAnchor="middle"
        fontSize="21"
        fontFamily="'Fraunces', serif"
        fontWeight="600"
        fill="#FFFFFF">
        Rp
      </text>
    </svg>
  );
}

/* Small scattered doodles across the hero banner — coin, arrow, sparkle —
   echoing the app's hand-drawn accent style without competing with SAKU. */
function FloatingDoodles() {
  return (
    <svg
      className="absolute inset-0 w-full h-full pointer-events-none"
      viewBox="0 0 400 260"
      preserveAspectRatio="xMidYMid slice"
      fill="none">
      <ellipse cx="352" cy="46" rx="17" ry="17" fill="#FFFFFF" opacity="0.16" />
      <text
        x="352"
        y="52"
        textAnchor="middle"
        fontSize="13"
        fontFamily="'Fraunces', serif"
        fontWeight="600"
        fill="#FFFFFF"
        opacity="0.75">
        Rp
      </text>
      <path
        d="M28 34 L30 40 L36 42 L30 44 L28 50 L26 44 L20 42 L26 40 Z"
        fill="#FFFFFF"
        opacity="0.55"
      />
      <path
        d="M300 90 Q320 105 310 118"
        stroke="#FFFFFF"
        strokeWidth="2"
        strokeLinecap="round"
        fill="none"
        strokeDasharray="1 6"
        opacity="0.5"
      />
    </svg>
  );
}
