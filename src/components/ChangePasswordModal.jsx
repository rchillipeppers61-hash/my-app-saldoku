import { useState } from "react";
import { supabase } from "../supabaseClient";
import { C } from "./theme";
import PasswordField from "./PasswordField";

export default function ChangePasswordModal({ user, onClose }) {
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    if (newPassword.length < 4) {
      setError("Password baru minimal 4 karakter.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Konfirmasi password baru tidak cocok.");
      return;
    }
    if (newPassword === oldPassword) {
      setError("Password baru harus beda dari password lama.");
      return;
    }

    setLoading(true);

    // Verify the old password belongs to this user before allowing the change.
    const { data, error: checkError } = await supabase
      .from("users")
      .select("id")
      .eq("id", user.id)
      .eq("password", oldPassword)
      .single();

    if (checkError || !data) {
      setLoading(false);
      setError("Password lama salah.");
      return;
    }

    const { error: updateError } = await supabase
      .from("users")
      .update({ password: newPassword })
      .eq("id", user.id);

    setLoading(false);

    if (updateError) {
      setError("Gagal menyimpan password baru. Coba lagi.");
      return;
    }

    setSuccess(true);
  }

  return (
    <div
      className="fixed inset-0 flex items-end sm:items-center justify-center z-50 px-4 pb-4 sm:pb-4"
      style={{ background: "rgba(70,63,92,0.4)" }}
      onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full sm:max-w-sm rounded-[28px] p-6 sm:p-7"
        style={{
          background: "#FFFFFF",
          boxShadow: "0 24px 56px -20px rgba(70,63,92,0.35)",
        }}>
        {success ? (
          <>
            <div
              className="w-14 h-14 mx-auto rounded-full flex items-center justify-center text-[26px] mb-4"
              style={{ background: "#8FD8BE33", color: C.mintDeep }}>
              ✓
            </div>
            <h3
              style={{ fontFamily: "'Fraunces', serif", color: C.ink }}
              className="text-[18px] font-semibold mb-1 text-center">
              Password berhasil diganti
            </h3>
            <p
              className="text-[12.5px] mb-5 text-center"
              style={{ color: C.inkFaint }}>
              Pakai password baru kamu di login berikutnya.
            </p>
            <button
              onClick={onClose}
              className="w-full py-3 rounded-2xl text-[13px] font-semibold"
              style={{
                background: `linear-gradient(135deg, ${C.lavender}, ${C.skyDeep})`,
                color: "#FFFFFF",
              }}>
              Selesai
            </button>
          </>
        ) : (
          <form onSubmit={handleSubmit}>
            <h3
              style={{ fontFamily: "'Fraunces', serif", color: C.ink }}
              className="text-[18px] font-semibold mb-1">
              Ganti Password
            </h3>
            <p className="text-[12.5px] mb-4" style={{ color: C.inkFaint }}>
              Masukkan password lama, lalu password baru kamu.
            </p>

            <PasswordField
              label="Password Lama"
              value={oldPassword}
              onChange={(e) => setOldPassword(e.target.value)}
              autoComplete="current-password"
            />

            <PasswordField
              label="Password Baru"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              autoComplete="new-password"
            />

            <PasswordField
              label="Konfirmasi Password Baru"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              autoComplete="new-password"
              className="mb-4"
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
              className="w-full py-3.5 rounded-2xl font-semibold text-[14px] disabled:opacity-50"
              style={{
                background: `linear-gradient(135deg, ${C.lavender}, ${C.skyDeep})`,
                color: "#FFFFFF",
              }}>
              {loading ? "Menyimpan..." : "Simpan Password Baru"}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="w-full mt-2 py-3 rounded-2xl text-[13px] font-semibold"
              style={{ background: "#463F5C0f", color: C.ink }}>
              Batal
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
