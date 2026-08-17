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
            color: activeTab === item.key ? C.lavender : C.inkSoft,
          }}>
          {item.label}
        </button>
      ))}
      <button
        onClick={onLogout}
        className="px-4 py-2.5 rounded-2xl text-[13px] font-semibold"
        style={{ background: "#D9607A14", color: C.roseDeep }}>
        Keluar
      </button>
    </div>
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
              style={{ color: active ? C.lavender : C.inkFaint }}>
              <span className="text-[19px] leading-none">{item.icon}</span>
              <span className="text-[10.5px] font-semibold">{item.label}</span>
            </button>
          );
        })}
        <button
          onClick={onLogout}
          className="flex flex-col items-center justify-center gap-0.5 flex-1 py-1.5 rounded-2xl"
          style={{ color: C.roseDeep }}>
          <span className="text-[19px] leading-none">🚪</span>
          <span className="text-[10.5px] font-semibold">Keluar</span>
        </button>
      </div>
    </nav>
  );
}
