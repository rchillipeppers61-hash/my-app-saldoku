import { useState } from "react";
import { C } from "./theme";

// Satu sumber item nav dipakai bareng oleh DesktopNav & MobileNav biar
// nggak ada dua daftar tab yang bisa kesenjangan (out of sync).
export const NAV_ITEMS = [
  { key: "home", label: "Home", icon: "🏠" },
  { key: "saldoku", label: "Saldoku", icon: "💰" },
  { key: "nabung", label: "Nabung", icon: "🎯" },
  { key: "akun", label: "Akun", icon: "🔒" },
];

// Ikon logout gaya "power button" (lingkaran + garis vertikal) — pola
// ikon yang paling umum dikenali orang buat aksi keluar/matiin sesi,
// gak ambigu kayak emoji pintu 🚪.
function LogoutIcon({ size = 19 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round">
      <path d="M12 3v7" />
      <path d="M18.36 6.64a9 9 0 1 1-12.73 0" />
    </svg>
  );
}

// Modal konfirmasi sebelum logout beneran dijalankan — jaga-jaga kalau
// kepencet gak sengaja. Dipakai bareng oleh DesktopNav & MobileNav,
// masing-masing megang state buka/tutupnya sendiri.
function LogoutConfirmModal({ onConfirm, onCancel }) {
  return (
    <div
      className="fixed inset-0 flex items-center justify-center z-[70] px-4"
      style={{ background: "rgba(70,63,92,0.45)", backdropFilter: "blur(2px)" }}
      onClick={onCancel}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full sm:max-w-[360px] rounded-[28px] p-6 sm:p-7"
        style={{
          background: "#FFFFFF",
          boxShadow: "0 24px 56px -20px rgba(70,63,92,0.35)",
        }}>
        <div
          className="w-12 h-12 rounded-2xl flex items-center justify-center mb-4"
          style={{ background: "#D9607A1A", color: C.roseDeep }}>
          <LogoutIcon size={22} />
        </div>
        <h3
          style={{ fontFamily: "'Fraunces', serif", color: C.ink }}
          className="text-[18px] font-semibold mb-1">
          Keluar dari akun?
        </h3>
        <p className="text-[12.5px] mb-5" style={{ color: C.inkFaint }}>
          Kamu perlu login lagi buat masuk ke My Wallet.
        </p>
        <div className="flex gap-2.5">
          <button
            onClick={onCancel}
            className="flex-1 py-3 rounded-2xl text-[13.5px] font-semibold"
            style={{ background: "#463F5C0f", color: C.ink }}>
            Batal
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 py-3 rounded-2xl text-[13.5px] font-bold"
            style={{
              background: `linear-gradient(135deg, ${C.roseDeep}, ${C.rose})`,
              color: "#FFFFFF",
            }}>
            Ya, Keluar
          </button>
        </div>
      </div>
    </div>
  );
}

// Nav inline yang muncul di header, sisi kanan, khusus layar lg ke atas.
export function DesktopNav({ activeTab, setActiveTab, onLogout }) {
  const [confirmOpen, setConfirmOpen] = useState(false);

  return (
    <div className="hidden lg:flex items-center gap-1 flex-shrink-0">
      {NAV_ITEMS.map((item) => (
        <button
          key={item.key}
          onClick={() => setActiveTab(item.key)}
          className="px-4 py-2.5 rounded-2xl text-[13px] font-semibold transition-colors"
          style={{
            background: activeTab === item.key ? "#8B72C41A" : "transparent",
            color: activeTab === item.key ? C.lavender : C.ink,
          }}>
          {item.label}
        </button>
      ))}
      <button
        onClick={() => setConfirmOpen(true)}
        className="flex items-center gap-1.5 px-4 py-2.5 rounded-2xl text-[13px] font-semibold"
        style={{ background: "#D9607A14", color: C.roseDeep }}>
        <LogoutIcon size={15} />
        Keluar
      </button>

      {confirmOpen && (
        <LogoutConfirmModal
          onCancel={() => setConfirmOpen(false)}
          onConfirm={() => {
            setConfirmOpen(false);
            onLogout();
          }}
        />
      )}
    </div>
  );
}

// Bottom nav fixed, khusus mobile & tablet (hilang di lg ke atas).
export function MobileNav({ activeTab, setActiveTab, onLogout }) {
  const [confirmOpen, setConfirmOpen] = useState(false);

  return (
    <nav
      className="fixed bottom-0 inset-x-0 z-40 lg:hidden"
      style={{
        background: "#FFFFFF",
        borderTop: "1px solid #463F5C14",
        boxShadow: "0 -8px 24px -12px rgba(70,63,92,0.18)",
      }}>
      <div className="flex items-stretch justify-around px-1 pt-2 pb-[calc(0.4rem+env(safe-area-inset-bottom))]">
        {NAV_ITEMS.map((item) => {
          const active = activeTab === item.key;
          return (
            <button
              key={item.key}
              onClick={() => setActiveTab(item.key)}
              className="flex flex-col items-center justify-center gap-0.5 flex-1 py-1.5 rounded-2xl transition-colors"
              style={{ color: active ? C.lavender : C.ink }}>
              <span className="text-[19px] leading-none">{item.icon}</span>
              <span className="text-[10.5px] font-semibold">{item.label}</span>
            </button>
          );
        })}
        <button
          onClick={() => setConfirmOpen(true)}
          className="flex flex-col items-center justify-center gap-0.5 flex-1 py-1.5 rounded-2xl"
          style={{ color: C.roseDeep }}>
          <LogoutIcon />
          <span className="text-[10.5px] font-semibold">Keluar</span>
        </button>
      </div>

      {confirmOpen && (
        <LogoutConfirmModal
          onCancel={() => setConfirmOpen(false)}
          onConfirm={() => {
            setConfirmOpen(false);
            onLogout();
          }}
        />
      )}
    </nav>
  );
}
