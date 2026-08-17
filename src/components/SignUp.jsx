import { useState } from "react";
import { supabase } from "../supabaseClient";
import { C, FONT_IMPORT } from "./theme";
import PasswordField from "./PasswordField";

export default function SignUp({ onSignUpSuccess, onBackToLogin }) {
  const [username, setUsername] = useState("");
  const [namaLengkap, setNamaLengkap] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSignUp(e) {
    e.preventDefault();
    setError("");

    const u = username.trim().toLowerCase();
    const nama = namaLengkap.trim();

    if (!u || !password || !nama) {
      setError("Nama lengkap, username, dan password wajib diisi.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Konfirmasi password tidak cocok.");
      return;
    }
    if (password.length < 4) {
      setError("Password minimal 4 karakter.");
      return;
    }

    setLoading(true);

    const { data: existing } = await supabase
      .from("users")
      .select("id")
      .eq("username", u)
      .maybeSingle();

    if (existing) {
      setLoading(false);
      setError("Username sudah dipakai, coba yang lain.");
      return;
    }

    const { data: newUser, error: insertError } = await supabase
      .from("users")
      .insert({
        username: u,
        password,
        nama_lengkap: nama,
      })
      .select("id, username, nama_lengkap")
      .single();

    setLoading(false);

    if (insertError || !newUser) {
      setError("Gagal membuat akun. Coba lagi ya.");
      return;
    }

    onSignUpSuccess?.(newUser);
  }

  return (
    <div
      className="min-h-screen w-full flex items-center justify-center px-4 py-10"
      style={{ background: C.bg, fontFamily: "'Inter', sans-serif" }}>
      <style>{FONT_IMPORT}</style>

      <form
        onSubmit={handleSignUp}
        className="w-full max-w-[400px] rounded-[28px] px-6 sm:px-7 py-9"
        style={{
          background: "#FFFFFF",
          boxShadow: "0 24px 60px -20px rgba(70,63,92,0.22)",
        }}>
        <p
          className="text-center text-[11px] tracking-[0.2em] uppercase mb-1 font-semibold"
          style={{ color: C.lavender }}>
          Gabung My Wallet
        </p>
        <h1
          style={{ fontFamily: "'Fraunces', serif", color: C.ink }}
          className="text-center text-[24px] font-semibold mb-6">
          Buat Akun Baru
        </h1>

        <label
          className="text-[11px] uppercase tracking-wide font-medium"
          style={{ color: C.inkFaint }}>
          Nama Lengkap
        </label>
        <input
          type="text"
          value={namaLengkap}
          onChange={(e) => setNamaLengkap(e.target.value)}
          required
          placeholder="nama lengkap kamu"
          className="w-full mt-1.5 mb-4 px-3.5 py-3 rounded-2xl text-[15px] outline-none border-[1.5px] transition-shadow focus:ring-4 focus:ring-[#8B72C42A]"
          style={{
            background: "#463F5C08",
            color: C.ink,
            borderColor: "#463F5C1F",
          }}
        />

        <label
          className="text-[11px] uppercase tracking-wide font-medium"
          style={{ color: C.inkFaint }}>
          Username
        </label>
        <input
          type="text"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          required
          autoCapitalize="off"
          placeholder="username kamu"
          className="w-full mt-1.5 mb-4 px-3.5 py-3 rounded-2xl text-[15px] outline-none border-[1.5px] transition-shadow focus:ring-4 focus:ring-[#8B72C42A]"
          style={{
            background: "#463F5C08",
            color: C.ink,
            borderColor: "#463F5C1F",
          }}
        />

        <PasswordField
          label="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="new-password"
        />

        <PasswordField
          label="Konfirmasi Password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          autoComplete="new-password"
          className="mb-5"
        />

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
          className="w-full py-3.5 rounded-2xl font-semibold text-[14px] disabled:opacity-50 transition-transform active:scale-[0.98]"
          style={{
            background: `linear-gradient(135deg, ${C.lavender}, ${C.skyDeep})`,
            color: "#FFFFFF",
            boxShadow: "0 16px 32px -16px rgba(139,114,196,0.6)",
          }}>
          {loading ? "Memproses..." : "Daftar"}
        </button>

        <button
          type="button"
          onClick={onBackToLogin}
          className="w-full text-center mt-5 text-[12.5px] font-medium"
          style={{ color: C.lavender }}>
          Sudah punya akun? Masuk
        </button>
      </form>
    </div>
  );
}
