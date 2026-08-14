export const CATEGORIES = [
  { value: "makan", label: "Makan" },
  { value: "jajan", label: "Jajan / Hiburan" },
  { value: "transport", label: "Transport" },
  { value: "kuliah", label: "Kebutuhan Kuliah" },
  { value: "pribadi", label: "Kebutuhan Pribadi" },
  { value: "lainnya", label: "Lainnya" },
];

export const categoryLabel = (v) =>
  CATEGORIES.find((c) => c.value === v)?.label || "Lainnya";

// Batas saldo minimum. Kalau saldo anak di bawah ini, orang tua
// akan lihat notifikasi peringatan di ParentDashboard. Ubah angka
// ini sesuai kebutuhan keluarga.
export const LOW_BALANCE_LIMIT = 100000;

export const rupiah = (n) => "Rp" + Math.round(n).toLocaleString("id-ID");

export const capitalize = (s) =>
  s ? s.charAt(0).toUpperCase() + s.slice(1) : s;

export const monthLabel = (ym) => {
  const [y, m] = ym.split("-");
  return new Date(Number(y), Number(m) - 1, 1).toLocaleDateString("id-ID", {
    month: "long",
    year: "numeric",
  });
};

export const todayISO = () => new Date().toISOString().slice(0, 10);

export const formatDay = (d) =>
  new Date(d).toLocaleDateString("id-ID", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

export const daysBetween = (a, b) =>
  Math.max(1, Math.round((new Date(b) - new Date(a)) / 86400000) + 1);
