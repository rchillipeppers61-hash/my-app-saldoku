// ---------- Kategori transaksi ----------
// Satu sumber untuk label, ikon, dan warna tiap kategori supaya
// konsisten dipakai di TransactionForm & Dashboard (gak duplikat
// dictionary kayak sebelumnya).
export const CATEGORIES = [
  {
    value: "makanan",
    label: "Makanan",
    icon: "🍽️",
    tint: "#8FD8BE2A",
    solid: "#3F9E7C",
  },
  {
    value: "transportasi",
    label: "Transportasi",
    icon: "🚌",
    tint: "#9FCBF02A",
    solid: "#3E7CB8",
  },
  {
    value: "keluarga",
    label: "Keluarga",
    icon: "👨‍👩‍👧",
    tint: "#F4A6B72A",
    solid: "#D9607A",
  },
  {
    value: "tagihan",
    label: "Tagihan & Rutin",
    icon: "🧾",
    tint: "#F6C4532A",
    solid: "#B5790A",
  },
  {
    value: "kesehatan",
    label: "Kesehatan",
    icon: "🏥",
    tint: "#9FCBF02A",
    solid: "#3E7CB8",
  },
  {
    value: "pendidikan",
    label: "Pendidikan",
    icon: "🎓",
    tint: "#8B72C42A",
    solid: "#8B72C4",
  },
  {
    value: "pribadi",
    label: "Pribadi",
    icon: "🎁",
    tint: "#F6C4532A",
    solid: "#B5790A",
  },
  {
    value: "hiburan",
    label: "Hiburan",
    icon: "🎬",
    tint: "#8B72C42A",
    solid: "#8B72C4",
  },
  {
    value: "lainnya",
    label: "Lainnya",
    icon: "✨",
    tint: "#463F5C14",
    solid: "#463F5C99",
  },
];

export const categoryLabel = (v) =>
  CATEGORIES.find((c) => c.value === v)?.label || "Lainnya";

export const categoryMeta = (v) =>
  CATEGORIES.find((c) => c.value === v) || CATEGORIES[CATEGORIES.length - 1];

// ---------- Role akun ----------
// Dulu "orang_tua" / "anak". Sekarang generic ("utama" / "pendamping")
// biar bisa dipakai pasangan, keluarga, atau siapapun yang urunan satu
// wallet. Value lama tetap di-cover lewat fallback di bawah supaya data
// akun yang sudah ada gak perlu buru-buru dimigrasi.
export const ROLE_LABELS = {
  utama: "Akun Utama",
  pendamping: "Akun Pendamping",
  orang_tua: "Akun Utama", // fallback data lama
  anak: "Akun Pendamping", // fallback data lama
};

export const roleLabel = (r) => ROLE_LABELS[r] || "Akun";

// Batas saldo minimum buat badge "saldo menipis" di dashboard.
// Ubah sesuai kebutuhan rumah tangga masing-masing.
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
