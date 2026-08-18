import { useState } from "react";
import { C } from "../components/theme";
import { CATEGORIES } from "../lib/shared";

const inputClass =
  "w-full mt-1.5 mb-3.5 px-3.5 py-3.5 sm:py-3 rounded-2xl text-[15px] sm:text-[14.5px] outline-none border-[1.5px] transition-shadow focus:ring-4 focus:ring-[#8B72C42A]";

function formatRibuan(value) {
  const digits = value.replace(/\D/g, "");
  if (!digits) return "";
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

export default function TransactionForm({
  transaction,
  onSave,
  onDelete,
  onClose,
}) {
  const isEditing = Boolean(transaction);
  const [form, setForm] = useState({
    type: transaction?.type || "out",
    amount:
      transaction?.amount != null
        ? formatRibuan(String(transaction.amount))
        : "",
    note: transaction?.note || "",
    category: transaction?.category || "makanan",
  });
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState("");

  const isOut = form.type === "out";

  async function handleSave() {
    const amt = parseFloat(form.amount.replace(/\./g, ""));
    if (!amt || amt <= 0 || !form.note.trim()) {
      setError("Isi jumlah dan catatan dulu ya.");
      return;
    }
    setError("");
    setSaving(true);
    const ok = await onSave({
      id: transaction?.id,
      type: form.type,
      amount: amt,
      note: form.note.trim(),
      category: form.type === "out" ? form.category : "lainnya",
    });
    setSaving(false);
    if (ok) {
      onClose();
    } else {
      setError("Gagal menyimpan transaksi, coba lagi.");
    }
  }

  async function handleDelete() {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    setError("");
    setDeleting(true);
    const ok = await onDelete(transaction.id);
    setDeleting(false);
    if (ok) {
      onClose();
    } else {
      setError("Gagal menghapus transaksi, coba lagi.");
      setConfirmDelete(false);
    }
  }

  return (
    <div
      className="fixed inset-0 flex items-center justify-center z-50 px-4"
      style={{ background: "rgba(70,63,92,0.45)", backdropFilter: "blur(2px)" }}
      onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full sm:max-w-sm lg:max-w-md max-h-[85vh] overflow-y-auto rounded-[32px] p-5 sm:p-7 relative"
        style={{
          background: "#FFFFFF",
          boxShadow: "0 30px 60px -20px rgba(70,63,92,0.35)",
        }}>
        <button
          onClick={onClose}
          className="flex absolute top-5 right-5 w-8 h-8 rounded-full items-center justify-center text-[14px] font-bold"
          style={{ background: "#463F5C0f", color: C.inkSoft }}>
          ✕
        </button>

        <div className="flex items-center gap-3 mb-5 pr-9">
          <div
            className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl flex items-center justify-center text-[20px] sm:text-[22px] flex-shrink-0 transition-colors"
            style={{ background: isOut ? "#F4A6B72A" : "#8FD8BE2A" }}>
            {isOut ? "🧾" : "💰"}
          </div>
          <div>
            <h3
              style={{ fontFamily: "'Fraunces', serif", color: C.ink }}
              className="text-[19px] sm:text-[21px] font-semibold leading-tight">
              {isEditing ? "Edit Transaksi" : "Catat Transaksi"}
            </h3>
            <p
              className="text-[12px] sm:text-[12.5px]"
              style={{ color: C.inkFaint }}>
              {isEditing
                ? "Ubah atau hapus catatan ini"
                : isOut
                  ? "Tulis pengeluaranmu"
                  : "Tulis pemasukanmu"}
            </p>
          </div>
        </div>

        <div
          className="flex rounded-2xl p-1.5 mb-5 gap-1.5"
          style={{ background: "#463F5C0d" }}>
          <button
            onClick={() => setForm((f) => ({ ...f, type: "out" }))}
            className="flex-1 py-2.5 sm:py-3 rounded-xl text-[13px] sm:text-[13.5px] font-bold transition-all">
            <span
              style={{
                background: isOut
                  ? `linear-gradient(135deg, ${C.roseDeep}, ${C.rose})`
                  : "transparent",
                color: isOut ? "#FFFFFF" : C.inkSoft,
              }}
              className="block -m-2.5 sm:-m-3 py-2.5 sm:py-3 rounded-xl">
              ⬇️ Pengeluaran
            </span>
          </button>
          <button
            onClick={() => setForm((f) => ({ ...f, type: "in" }))}
            className="flex-1 py-2.5 sm:py-3 rounded-xl text-[13px] sm:text-[13.5px] font-bold transition-all">
            <span
              style={{
                background: !isOut
                  ? `linear-gradient(135deg, ${C.mintDeep}, ${C.mint})`
                  : "transparent",
                color: !isOut ? "#FFFFFF" : C.inkSoft,
              }}
              className="block -m-2.5 sm:-m-3 py-2.5 sm:py-3 rounded-xl">
              ⬆️ Pemasukan
            </span>
          </button>
        </div>

        <label
          className="text-[11px] uppercase tracking-wide font-bold"
          style={{ color: C.inkFaint }}>
          Jumlah (Rp)
        </label>
        <div className="relative">
          <input
            type="text"
            inputMode="numeric"
            value={form.amount}
            onChange={(e) =>
              setForm((f) => ({ ...f, amount: formatRibuan(e.target.value) }))
            }
            placeholder="25.000"
            className={inputClass}
            style={{
              background: "#463F5C08",
              color: C.ink,
              borderColor: "#463F5C1F",
              paddingLeft: "2.1rem",
            }}
          />
        </div>

        {isOut && (
          <>
            <label
              className="text-[11px] uppercase tracking-wide font-bold"
              style={{ color: C.inkFaint }}>
              Kategori
            </label>
            <div className="relative">
              <select
                value={form.category}
                onChange={(e) =>
                  setForm((f) => ({ ...f, category: e.target.value }))
                }
                className={`${inputClass} appearance-none pr-9`}
                style={{
                  background: "#463F5C08",
                  color: C.ink,
                  borderColor: "#463F5C1F",
                }}>
                {CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.icon} {c.label}
                  </option>
                ))}
              </select>
              <span
                className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 -mt-1.5 text-[12px]"
                style={{ color: C.inkFaint }}>
                ▾
              </span>
            </div>
          </>
        )}

        <label
          className="text-[11px] uppercase tracking-wide font-bold"
          style={{ color: C.inkFaint }}>
          Catatan
        </label>
        <input
          type="text"
          value={form.note}
          onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
          placeholder={isOut ? "Belanja bulanan" : "Transfer dari gaji"}
          className={`${inputClass} mb-2`}
          style={{
            background: "#463F5C08",
            color: C.ink,
            borderColor: "#463F5C1F",
          }}
        />

        {error && (
          <div
            className="flex items-center gap-2 rounded-xl px-3.5 py-2.5 mb-3.5 text-[12px] font-medium"
            style={{ background: "#F4A6B71F", color: C.roseDeep }}>
            ⚠️ {error}
          </div>
        )}

        <button
          onClick={handleSave}
          disabled={saving || deleting}
          className="w-full py-3.5 sm:py-4 rounded-2xl font-bold text-[14px] sm:text-[15px] disabled:opacity-50 transition-shadow"
          style={{
            background: isOut
              ? `linear-gradient(135deg, ${C.roseDeep}, ${C.rose})`
              : `linear-gradient(135deg, ${C.mintDeep}, ${C.mint})`,
            color: "#FFFFFF",
            boxShadow: isOut
              ? "0 14px 28px -14px rgba(217,96,122,0.6)"
              : "0 14px 28px -14px rgba(63,158,124,0.6)",
          }}>
          {saving ? "Menyimpan..." : isEditing ? "Simpan Perubahan" : "Simpan"}
        </button>

        {isEditing && (
          <button
            onClick={handleDelete}
            disabled={saving || deleting}
            className="w-full mt-2.5 py-3 sm:py-3.5 rounded-2xl font-bold text-[13px] sm:text-[13.5px] disabled:opacity-50 transition-colors"
            style={{
              background: confirmDelete ? C.roseDeep : "#463F5C0f",
              color: confirmDelete ? "#FFFFFF" : C.roseDeep,
            }}>
            {deleting
              ? "Menghapus..."
              : confirmDelete
                ? "Yakin? Tap sekali lagi untuk hapus"
                : "🗑️ Hapus Transaksi"}
          </button>
        )}
      </div>
    </div>
  );
}
