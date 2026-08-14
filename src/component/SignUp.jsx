import { useState } from "react";
import { supabase } from "../supabaseClient";
import { C, FONT_IMPORT } from "./theme";

// Kode 6 karakter, huruf besar + angka, tanpa karakter yang gampang
// ketuker (0/O, 1/I) biar gampang dibacain manual (WA, lisan, dll).
const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function generateCode() {
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  }
  return code;
}

export default function SignUp({ onSignUpSuccess, onBackToLogin }) {
  // NOTE: nilai role disamain sama App.jsx ("orang_tua" utk parent).
  // Untuk anak gua asumsikan "anak" -- kalau ternyata beda di
  // ChildDashboard.jsx, tinggal ganti string ini + di roleOptions bawah.
  const [role, setRole] = useState("anak"); // "anak" | "orang_tua"
  const [username, setUsername] = useState("");
  const [namaLengkap, setNamaLengkap] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [inviteCodeInput, setInviteCodeInput] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Ditampilkan setelah sign up sukses TANPA kode (belum ke-link),
  // biar user bisa share kode ini ke pasangan akunnya (ortu/anak).
  const [generatedCode, setGeneratedCode] = useState(null);
  // Disimpen biar pas klik "Lanjut ke aplikasi" di layar kode,
  // data user yang baru dibuat tetep ke-pass ke onSignUpSuccess.
  const [pendingUser, setPendingUser] = useState(null);
  const [copied, setCopied] = useState(false);

  async function handleCopyCode() {
    try {
      await navigator.clipboard.writeText(generatedCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API gagal (misal browser lama/permission) -- diemin aja,
      // user masih bisa select-copy manual dari teks yang tampil.
    }
  }

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

    // 1. Pastikan username belum dipakai
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

    // 2. Buat akun baru
    const { data: newUser, error: insertError } = await supabase
      .from("users")
      .insert({
        username: u,
        password, // NOTE: sama seperti pola project sekarang (plaintext).
        role,
        nama_lengkap: nama,
        linked_child_id: null,
      })
      .select("id, username, role, linked_child_id, nama_lengkap")
      .single();

    if (insertError || !newUser) {
      setLoading(false);
      setError("Gagal membuat akun. Coba lagi ya.");
      return;
    }

    const code = inviteCodeInput.trim().toUpperCase();

    // 3a. Kalau user MASUKIN kode undangan -> coba langsung link
    if (code) {
      const result = await redeemInviteCode(code, newUser.id, role);
      setLoading(false);

      if (!result.success) {
        // Akun tetap kebuat, cuma link-nya gagal. Kasih tau,
        // biar user bisa coba masukin kode lagi lain waktu
        // (fitur "masukin kode nanti" bisa ditambah di dashboard).
        setError(result.message);
        onSignUpSuccess?.(newUser);
        return;
      }

      onSignUpSuccess?.(newUser);
      return;
    }

    // 3b. Kalau TIDAK ada kode -> generate kode buat di-share
    const newCode = generateCode();
    const { error: codeError } = await supabase.from("invite_codes").insert({
      code: newCode,
      user_id: newUser.id,
    });

    setLoading(false);

    if (codeError) {
      // Akun tetap jadi, tapi kode gagal dibuat. User masih bisa
      // dilink manual nanti, jadi tetep lanjutkan.
      onSignUpSuccess?.(newUser);
      return;
    }

    setPendingUser(newUser);
    setGeneratedCode(newCode);
  }

  // Cari kode di invite_codes, validasi, terus set linked_child_id
  // di sisi akun PARENT (siapapun yang jadi parent-nya).
  async function redeemInviteCode(code, newUserId, newUserRole) {
    const { data: invite, error: inviteError } = await supabase
      .from("invite_codes")
      .select("id, user_id, expires_at, used_at")
      .eq("code", code)
      .is("used_at", null)
      .maybeSingle();

    if (inviteError || !invite) {
      return {
        success: false,
        message: "Kode undangan tidak ditemukan atau sudah dipakai.",
      };
    }

    if (new Date(invite.expires_at) < new Date()) {
      return { success: false, message: "Kode undangan sudah kedaluwarsa." };
    }

    const { data: owner, error: ownerError } = await supabase
      .from("users")
      .select("id, role")
      .eq("id", invite.user_id)
      .single();

    if (ownerError || !owner) {
      return { success: false, message: "Akun pemilik kode tidak ditemukan." };
    }

    if (owner.role === newUserRole) {
      return {
        success: false,
        message: `Kode ini punya akun ${owner.role === "orang_tua" ? "orang tua" : "anak"} lain, bukan pasangan yang cocok.`,
      };
    }

    const parentId = newUserRole === "orang_tua" ? newUserId : owner.id;
    const childId = newUserRole === "anak" ? newUserId : owner.id;

    const { error: linkError } = await supabase
      .from("users")
      .update({ linked_child_id: childId })
      .eq("id", parentId);

    if (linkError) {
      return {
        success: false,
        message: "Gagal menyambungkan akun. Coba lagi.",
      };
    }

    await supabase
      .from("invite_codes")
      .update({ used_at: new Date().toISOString() })
      .eq("id", invite.id);

    return { success: true };
  }

  // ---------- Layar "kode berhasil dibuat, silakan share" ----------
  if (generatedCode) {
    return (
      <div
        className="min-h-screen w-full flex items-center justify-center px-4"
        style={{ background: C.bg, fontFamily: "'Inter', sans-serif" }}>
        <style>{FONT_IMPORT}</style>
        <div
          className="w-full max-w-[400px] rounded-[28px] px-7 py-9 text-center"
          style={{
            background: "#FFFFFF",
            boxShadow: "0 24px 60px -20px rgba(70,63,92,0.22)",
          }}>
          <p
            className="text-[11px] tracking-[0.2em] uppercase font-semibold mb-1"
            style={{ color: C.lavender }}>
            Akun berhasil dibuat
          </p>
          <h1
            style={{ fontFamily: "'Fraunces', serif", color: C.ink }}
            className="text-[22px] font-semibold mb-3">
            Bagikan kode ini
          </h1>
          <p className="text-[13px] mb-6" style={{ color: C.inkFaint }}>
            Kasih kode ini ke {role === "anak" ? "orang tua" : "anak"} kamu. Pas
            mereka daftar dan masukin kode ini, akun kalian otomatis kesambung.
            Berlaku 24 jam.
          </p>

          <div
            className="text-[32px] font-semibold tracking-[0.3em] py-4 rounded-2xl mb-3"
            style={{
              background: "#463F5C08",
              color: C.ink,
              fontFamily: "'Fraunces', serif",
            }}>
            {generatedCode}
          </div>

          <button
            type="button"
            onClick={handleCopyCode}
            className="w-full py-2.5 rounded-2xl font-semibold text-[13px] mb-6 transition-colors"
            style={{
              background: copied ? "#3F9E7C1F" : "#463F5C0d",
              color: copied ? C.mintDeep : C.ink,
            }}>
            {copied ? "✓ Kode disalin" : "Salin Kode"}
          </button>

          <button
            type="button"
            onClick={() => onSignUpSuccess?.(pendingUser)}
            className="w-full py-3.5 rounded-2xl font-semibold text-[14px] transition-transform active:scale-[0.98]"
            style={{
              background: `linear-gradient(135deg, ${C.lavender}, ${C.skyDeep})`,
              color: "#FFFFFF",
              boxShadow: "0 16px 32px -16px rgba(139,114,196,0.6)",
            }}>
            Lanjut ke aplikasi
          </button>
        </div>
      </div>
    );
  }

  // ---------- Form sign up ----------
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

        {/* Pilih role */}
        <label
          className="text-[11px] uppercase tracking-wide font-medium"
          style={{ color: C.inkFaint }}>
          Daftar sebagai
        </label>
        <div className="grid grid-cols-2 gap-2 mt-1.5 mb-4">
          {[
            { key: "anak", label: "Anak" },
            { key: "orang_tua", label: "Orang Tua" },
          ].map((opt) => (
            <button
              key={opt.key}
              type="button"
              onClick={() => setRole(opt.key)}
              className="py-2.5 rounded-2xl text-[13.5px] font-semibold border-[1.5px] transition-colors"
              style={{
                background: role === opt.key ? C.lavender : "#463F5C08",
                color: role === opt.key ? "#FFFFFF" : C.ink,
                borderColor: role === opt.key ? C.lavender : "#463F5C1F",
              }}>
              {opt.label}
            </button>
          ))}
        </div>

        {/* Nama Lengkap */}
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

        {/* Username */}
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

        {/* Password */}
        <label
          className="text-[11px] uppercase tracking-wide font-medium"
          style={{ color: C.inkFaint }}>
          Password
        </label>
        <div className="relative mt-1.5 mb-4">
          <input
            type={showPassword ? "text" : "password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            placeholder="••••••••"
            className="w-full pl-3.5 pr-11 py-3 rounded-2xl text-[15px] outline-none border-[1.5px] transition-shadow focus:ring-4 focus:ring-[#8B72C42A]"
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

        {/* Konfirmasi password */}
        <label
          className="text-[11px] uppercase tracking-wide font-medium"
          style={{ color: C.inkFaint }}>
          Konfirmasi Password
        </label>
        <div className="relative mt-1.5 mb-4">
          <input
            type={showConfirmPassword ? "text" : "password"}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            placeholder="••••••••"
            className="w-full pl-3.5 pr-11 py-3 rounded-2xl text-[15px] outline-none border-[1.5px] transition-shadow focus:ring-4 focus:ring-[#8B72C42A]"
            style={{
              background: "#463F5C08",
              color: C.ink,
              borderColor: "#463F5C1F",
            }}
          />
          <button
            type="button"
            onClick={() => setShowConfirmPassword((v) => !v)}
            tabIndex={-1}
            className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-offset-1"
            style={{ color: C.inkFaint, "--tw-ring-color": C.lavender }}
            aria-label={
              showConfirmPassword
                ? "Sembunyikan password"
                : "Tampilkan password"
            }>
            {showConfirmPassword ? <EyeOffIcon /> : <EyeIcon />}
          </button>
        </div>

        {/* Kode undangan (opsional) */}
        <label
          className="text-[11px] uppercase tracking-wide font-medium"
          style={{ color: C.inkFaint }}>
          Kode Undangan (opsional)
        </label>
        <input
          type="text"
          value={inviteCodeInput}
          onChange={(e) => setInviteCodeInput(e.target.value.toUpperCase())}
          placeholder="Sudah punya kode dari orang tua/anak?"
          maxLength={6}
          className="w-full mt-1.5 mb-1 px-3.5 py-3 rounded-2xl text-[15px] tracking-[0.15em] outline-none border-[1.5px] transition-shadow focus:ring-4 focus:ring-[#8B72C42A]"
          style={{
            background: "#463F5C08",
            color: C.ink,
            borderColor: "#463F5C1F",
          }}
        />
        <p className="text-[11.5px] mb-5" style={{ color: C.inkFaint }}>
          Kosongkan kalau belum punya. Nanti kamu dapet kode buat dibagikan.
        </p>

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
