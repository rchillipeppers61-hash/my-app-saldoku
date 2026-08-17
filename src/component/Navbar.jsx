import { C } from "./theme";

// Satu sumber item nav dipakai bareng oleh DesktopNav & MobileNav biar
// nggak ada dua daftar tab yang bisa kesenjangan (out of sync).
export const NAV_ITEMS = [
  { key: "home", label: "Home", icon: "🏠" },
  { key: "saldoku", label: "Saldoku", icon: "💰" },
  { key: "nabung", label: "Nabung", icon: "🎯" },
  { key: "akun", label: "Akun", icon: "🔒" },
];

// Nav inline yang muncul di header, sisi kanan, khusus layar lg ke atas.
export function DesktopNav({ activeTab, setActiveTab, onLogout }) {
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
        onClick={onLogout}
        className="flex items-center gap-1.5 px-4 py-2.5 rounded-2xl text-[13px] font-bold border transition-colors"
        style={{
          background: "#D9607A1F",
          borderColor: "#D9607A40",
          color: C.roseDeep,
        }}>
        <LogoutIcon />
        Keluar
      </button>
    </div>
  );
}

// Ikon SVG garis (bukan emoji) biar tampilannya konsisten di semua device
// dan nggak keliatan flat/aneh kayak emoji bawaan OS.
function LogoutIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  );
}

// Bottom nav fixed, khusus mobile & tablet (hilang di lg ke atas).
export function MobileNav({ activeTab, setActiveTab, onLogout }) {
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
              <span
                className="text-[10.5px]"
                style={{ fontWeight: active ? 700 : 600 }}>
                {item.label}
              </span>
            </button>
          );
        })}
        <button
          onClick={onLogout}
          className="flex flex-col items-center justify-center gap-0.5 flex-1 py-1.5 rounded-2xl"
          style={{ color: C.roseDeep }}>
          <LogoutIcon />
          <span className="text-[10.5px] font-bold">Keluar</span>
        </button>
      </div>
    </nav>
  );
}
