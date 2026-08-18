import { useMemo, useState } from "react";
import { C } from "../components/theme";
import Card from "../components/Card";
import { rupiah } from "../lib/shared";

// Format ribuan buat tampilan input nominal (100000 -> "100.000").
// State yang disimpan (goalAmount/targetAmount/depositAmount) tetep
// angka murni tanpa titik — cuma tampilannya yang diformat, jadi
// parseFloat() di logic submit gak perlu diubah sama sekali.
function formatRibuan(raw) {
  const digits = String(raw ?? "").replace(/\D/g, "");
  if (!digits) return "";
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

// Input nominal Rupiah — dipisah jadi komponen kecil karena dipakai di
// 3 tempat (tambah goal, edit target, setor/tarik). Ngetik apa aja
// otomatis kesaring jadi digit doang, terus ditampilin dengan titik
// pemisah ribuan.
function MoneyInput({
  value,
  onChange,
  placeholder,
  className = "",
  bg = "#463F5C08",
}) {
  return (
    <div className={`relative ${className}`}>
      <span
        className="absolute left-3 top-1/2 -translate-y-1/2 text-[13px] font-medium pointer-events-none"
        style={{ color: C.inkFaint }}>
        Rp
      </span>
      <input
        type="text"
        inputMode="numeric"
        value={formatRibuan(value)}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, ""))}
        placeholder={placeholder}
        className="w-full pl-9 pr-3 py-2.5 rounded-xl text-[13px] outline-none border-[1.5px]"
        style={{
          background: bg,
          color: C.ink,
          borderColor: "#463F5C1F",
        }}
      />
    </div>
  );
}

// Badge milestone 25/50/75% — cuma indikator ringan biar progress
// kerasa "hidup", gak perlu data tambahan (dihitung langsung dari pct).
// 100% udah punya badge sendiri ("🎉 Target tercapai!") di bawah, jadi
// di sini sengaja berhenti di 75.
function milestoneFor(pct) {
  if (pct >= 75) return { label: "75% lagi dikit!", tone: "amber" };
  if (pct >= 50) return { label: "Setengah jalan 🚀", tone: "lavender" };
  if (pct >= 25) return { label: "Awal yang bagus", tone: "lavender" };
  return null;
}

// SavingsGoalItem digabung di bawah (bukan file terpisah lagi) karena
// cuma dipakai di sini. Tetep jadi function sendiri (bukan didefinisi
// ulang di dalam .map()) biar state per-item (mode edit/setor) gak
// ke-reset tiap Nabung re-render.
export default function Nabung({
  loading,
  availableToAllocate,
  goals,
  showAddGoal,
  setShowAddGoal,
  goalTitle,
  setGoalTitle,
  goalAmount,
  setGoalAmount,
  goalSaving,
  goalError,
  setGoalError,
  goalToast,
  onAddGoal,
  onEditGoal,
  onDeleteGoal,
  onDepositGoal,
  onWithdrawGoal,
}) {
  // Ringkasan buat hero card — total udah disisihkan di SEMUA goal, dan
  // rata-rata progres. Ini murni turunan dari `goals` yang udah ada,
  // gak nambah query/kolom baru.
  const totalSaved = useMemo(
    () => goals.reduce((s, g) => s + Number(g.saved_amount || 0), 0),
    [goals],
  );
  const avgProgress = useMemo(() => {
    if (goals.length === 0) return 0;
    const sumPct = goals.reduce((s, g) => {
      const pct = g.target_amount
        ? Math.min(100, (Number(g.saved_amount || 0) / g.target_amount) * 100)
        : 0;
      return s + pct;
    }, 0);
    return Math.round(sumPct / goals.length);
  }, [goals]);
  const achievedCount = useMemo(
    () =>
      goals.filter((g) => Number(g.saved_amount || 0) >= g.target_amount)
        .length,
    [goals],
  );

  if (loading) {
    return (
      <p
        className="text-[13px] text-center py-10"
        style={{ color: C.inkFaint }}>
        Memuat...
      </p>
    );
  }

  return (
    <div className="max-w-xl mx-auto space-y-4">
      {/* Hero card — senada sama hero "Saldo Sekarang" di Saldoku.jsx,
          biar dua tab kerasa satu keluarga desain. Angka utama = total
          udah disisihkan di semua goal, 3 kolom di bawah = ringkasan
          cepat (bisa disisihkan, jumlah goal aktif, rata-rata progres). */}
      <div
        className="rounded-[28px] p-4 sm:p-5 relative overflow-hidden"
        style={{
          background: `linear-gradient(135deg, ${C.lavender}, ${C.skyDeep})`,
          boxShadow: "0 24px 48px -20px rgba(70,63,92,0.5)",
        }}>
        <div
          className="absolute -top-10 -right-10 w-40 h-40 rounded-full"
          style={{ background: "rgba(255,255,255,0.12)" }}
        />
        <div
          className="absolute -bottom-14 -left-8 w-36 h-36 rounded-full"
          style={{ background: "rgba(255,255,255,0.08)" }}
        />
        <div className="relative z-10 flex flex-col items-center text-center">
          <p
            className="text-[10.5px] sm:text-[11.5px] uppercase tracking-[0.2em] font-bold"
            style={{ color: "#FFFFFF" }}>
            Total Tabungan
          </p>
          <p
            style={{ fontFamily: "'Fraunces', serif", color: "#FFFFFF" }}
            className="mt-1 text-[26px] sm:text-[32px] font-semibold leading-none">
            {rupiah(totalSaved)}
          </p>
          {achievedCount > 0 && (
            <span
              className="inline-flex items-center gap-1.5 mt-2.5 px-3 py-1.5 rounded-full text-[10.5px] sm:text-[11.5px] font-bold"
              style={{
                background: "rgba(255,255,255,0.24)",
                color: "#FFFFFF",
                border: "1px solid rgba(255,255,255,0.45)",
              }}>
              🏆 {achievedCount} target tercapai
            </span>
          )}

          <div className="grid grid-cols-3 gap-2 sm:gap-3 mt-4 w-full">
            <div
              className="rounded-2xl px-1.5 py-2.5 sm:p-3 text-center min-w-0"
              style={{
                background: "rgba(255,255,255,0.18)",
                border: "1px solid rgba(255,255,255,0.32)",
              }}>
              <p
                className="text-[8px] sm:text-[9.5px] uppercase tracking-wide font-bold truncate"
                style={{ color: "#FFFFFF" }}>
                Bisa Disisihkan
              </p>
              <p
                className="text-[11.5px] sm:text-[14px] font-bold mt-0.5 truncate"
                style={{ color: "#FFFFFF" }}>
                {rupiah(availableToAllocate)}
              </p>
            </div>
            <div
              className="rounded-2xl px-1.5 py-2.5 sm:p-3 text-center min-w-0"
              style={{
                background: "rgba(255,255,255,0.18)",
                border: "1px solid rgba(255,255,255,0.32)",
              }}>
              <p
                className="text-[8px] sm:text-[9.5px] uppercase tracking-wide font-bold truncate"
                style={{ color: "#FFFFFF" }}>
                Target Aktif
              </p>
              <p
                className="text-[11.5px] sm:text-[14px] font-bold mt-0.5 truncate"
                style={{ color: "#FFFFFF" }}>
                {goals.length}
              </p>
            </div>
            <div
              className="rounded-2xl px-1.5 py-2.5 sm:p-3 text-center min-w-0"
              style={{
                background: "rgba(255,255,255,0.18)",
                border: "1px solid rgba(255,255,255,0.32)",
              }}>
              <p
                className="text-[8px] sm:text-[9.5px] uppercase tracking-wide font-bold truncate"
                style={{ color: "#FFFFFF" }}>
                Rata-rata Progres
              </p>
              <p
                className="text-[11.5px] sm:text-[14px] font-bold mt-0.5 truncate"
                style={{ color: "#FFFFFF" }}>
                {avgProgress}%
              </p>
            </div>
          </div>
        </div>
      </div>

      <Card>
        <div className="flex items-center justify-between mb-3">
          <p
            className="text-[11px] uppercase tracking-[0.1em] font-semibold"
            style={{ color: C.lavender }}>
            Target Nabung
          </p>
          {goalToast ? (
            <span
              className="text-[11px] font-bold px-2.5 py-1 rounded-full"
              style={{ background: "#8FD8BE33", color: C.mintDeep }}>
              {goalToast}
            </span>
          ) : (
            <button
              onClick={() => {
                setShowAddGoal((v) => !v);
                setGoalError("");
              }}
              className="text-[11px] font-bold px-2.5 py-1 rounded-full"
              style={{ background: "#8B72C41A", color: C.lavender }}>
              {showAddGoal ? "Batal" : "+ Tambah"}
            </button>
          )}
        </div>

        {showAddGoal && (
          <div className="mb-3.5 space-y-2">
            <input
              type="text"
              value={goalTitle}
              onChange={(e) => setGoalTitle(e.target.value)}
              placeholder="Contoh: Liburan akhir tahun"
              className="w-full px-3 py-2.5 rounded-xl text-[13px] outline-none border-[1.5px]"
              style={{
                background: "#463F5C08",
                color: C.ink,
                borderColor: "#463F5C1F",
              }}
            />
            <MoneyInput
              value={goalAmount}
              onChange={setGoalAmount}
              placeholder="Target, contoh: 5.000.000"
            />
            {goalError && (
              <div
                className="flex items-center gap-2 rounded-xl px-3 py-2 text-[11.5px] font-medium"
                style={{ background: "#F4A6B71F", color: C.roseDeep }}>
                ⚠️ {goalError}
              </div>
            )}
            <button
              onClick={onAddGoal}
              disabled={goalSaving}
              className="w-full py-2.5 rounded-xl font-bold text-[13px] disabled:opacity-50"
              style={{
                background: `linear-gradient(135deg, ${C.lavender}, ${C.skyDeep})`,
                color: "#FFFFFF",
              }}>
              {goalSaving ? "Menyimpan..." : "Simpan Target"}
            </button>
          </div>
        )}

        {goalError && !showAddGoal && (
          <div
            className="flex items-center gap-2 rounded-xl px-3 py-2 mb-3 text-[11.5px] font-medium"
            style={{ background: "#F4A6B71F", color: C.roseDeep }}>
            ⚠️ {goalError}
          </div>
        )}

        {goals.length === 0 && !showAddGoal ? (
          <div className="py-8 text-center">
            <div
              className="w-14 h-14 mx-auto rounded-full flex items-center justify-center text-[26px] mb-3"
              style={{ background: "#8B72C41A" }}>
              🎯
            </div>
            <p className="text-[13.5px] font-medium" style={{ color: C.ink }}>
              Belum ada target nabung
            </p>
            <p className="text-[12px] mt-1" style={{ color: C.inkSoft }}>
              Yuk bikin satu, mulai dari hal kecil dulu juga gapapa.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {goals.map((g) => (
              <SavingsGoalItem
                key={g.id}
                goal={g}
                editable
                onDelete={onDeleteGoal}
                onEdit={onEditGoal}
                onDeposit={onDepositGoal}
                onWithdraw={onWithdrawGoal}
                availableToAllocate={availableToAllocate}
              />
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

// Komponen 1 item target nabung (progress bar, mode edit, mode
// setor/tarik). Cuma dipakai Nabung di atas, makanya digabung 1 file
// dan gak di-export. Dibungkus card sendiri (bukan cuma div polos)
// biar konsisten sama pattern card-per-baris di Saldoku.jsx.
function SavingsGoalItem({
  goal,
  onDelete,
  onEdit,
  onDeposit,
  onWithdraw,
  availableToAllocate = 0,
  editable = false,
}) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(goal.title);
  const [targetAmount, setTargetAmount] = useState(String(goal.target_amount));
  const [savingEdit, setSavingEdit] = useState(false);
  const [editError, setEditError] = useState("");

  const [showDeposit, setShowDeposit] = useState(false);
  const [depositMode, setDepositMode] = useState("in"); // "in" = setor, "out" = tarik
  const [depositAmount, setDepositAmount] = useState("");
  const [depositSaving, setDepositSaving] = useState(false);
  const [depositError, setDepositError] = useState("");

  const saved = Number(goal.saved_amount || 0);
  const pct = Math.max(
    0,
    Math.min(100, Math.round((saved / goal.target_amount) * 100)),
  );
  const achieved = saved >= goal.target_amount;
  const milestone = !achieved ? milestoneFor(pct) : null;

  async function handleSaveEdit() {
    const amt = parseFloat(targetAmount);
    if (!title.trim() || !amt || amt <= 0) {
      setEditError("Isi nama dan target dengan benar ya.");
      return;
    }
    setEditError("");
    setSavingEdit(true);
    const ok = await onEdit(goal.id, {
      title: title.trim(),
      target_amount: amt,
    });
    setSavingEdit(false);
    if (ok) {
      setEditing(false);
    } else {
      setEditError("Gagal menyimpan perubahan, coba lagi.");
    }
  }

  async function handleDepositSubmit() {
    const amt = parseFloat(depositAmount);
    if (!amt || amt <= 0) {
      setDepositError("Isi jumlahnya dulu ya.");
      return;
    }
    setDepositError("");
    setDepositSaving(true);
    const result =
      depositMode === "in"
        ? await onDeposit(goal.id, amt)
        : await onWithdraw(goal.id, amt);
    setDepositSaving(false);
    if (result?.ok) {
      setDepositAmount("");
      setShowDeposit(false);
    } else {
      setDepositError(result?.error || "Gagal, coba lagi.");
    }
  }

  if (editing) {
    return (
      <div
        className="rounded-2xl p-3.5"
        style={{ background: "#463F5C08", border: "1px solid #463F5C14" }}>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Nama target"
          className="w-full mb-2 px-3 py-2 rounded-xl text-[13px] outline-none border-[1.5px]"
          style={{
            background: "#FFFFFF",
            color: C.ink,
            borderColor: "#463F5C1F",
          }}
        />
        <MoneyInput
          value={targetAmount}
          onChange={setTargetAmount}
          placeholder="Target"
          className="mb-2"
          bg="#FFFFFF"
        />
        {editError && (
          <p
            className="text-[11px] mb-2 font-medium"
            style={{ color: C.roseDeep }}>
            ⚠️ {editError}
          </p>
        )}
        <div className="flex gap-2">
          <button
            onClick={handleSaveEdit}
            disabled={savingEdit}
            className="flex-1 py-2 rounded-xl font-bold text-[12px] disabled:opacity-50"
            style={{
              background: `linear-gradient(135deg, ${C.lavender}, ${C.skyDeep})`,
              color: "#FFFFFF",
            }}>
            {savingEdit ? "Menyimpan..." : "Simpan"}
          </button>
          <button
            onClick={() => {
              setEditing(false);
              setTitle(goal.title);
              setTargetAmount(String(goal.target_amount));
              setEditError("");
            }}
            className="flex-1 py-2 rounded-xl font-bold text-[12px]"
            style={{ background: "#463F5C0f", color: C.inkSoft }}>
            Batal
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className="rounded-2xl p-3.5"
      style={{
        background: achieved ? "#8FD8BE14" : "#463F5C08",
        border: achieved ? "1px solid #3F9E7C33" : "1px solid #463F5C14",
      }}>
      <div className="flex items-center justify-between gap-2 text-[13px] mb-1.5">
        <span
          className="font-medium truncate flex items-center gap-1.5"
          style={{ color: C.ink }}>
          {achieved ? "🏆" : "🎯"} {goal.title}
        </span>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {editable && (
            <>
              <button
                onClick={() => setEditing(true)}
                aria-label="Edit target"
                className="text-[11px] w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0"
                style={{ background: "#463F5C0f", color: C.inkFaint }}>
                ✏️
              </button>
              {onDelete && (
                <button
                  onClick={() => onDelete(goal.id)}
                  aria-label="Hapus target"
                  className="text-[11px] w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0"
                  style={{ background: "#463F5C0f", color: C.inkFaint }}>
                  ✕
                </button>
              )}
            </>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between text-[12px] mb-1.5">
        <span style={{ color: C.inkSoft }}>
          {rupiah(saved)} / {rupiah(goal.target_amount)}
        </span>
        <span className="font-bold" style={{ color: C.lavender }}>
          {pct}%
        </span>
      </div>

      <div
        className="h-2.5 rounded-full overflow-hidden"
        style={{ background: "#463F5C14" }}>
        <div
          className="h-full rounded-full transition-all"
          style={{
            width: `${pct}%`,
            background: achieved
              ? `linear-gradient(135deg, ${C.mintDeep}, ${C.mint})`
              : `linear-gradient(135deg, ${C.lavender}, ${C.skyDeep})`,
          }}
        />
      </div>

      {achieved ? (
        <p
          className="text-[11px] mt-1.5 font-semibold"
          style={{ color: C.mintDeep }}>
          🎉 Target tercapai!
        </p>
      ) : (
        milestone && (
          <p
            className="text-[11px] mt-1.5 font-semibold"
            style={{
              color: milestone.tone === "amber" ? "#B8892F" : C.lavender,
            }}>
            {milestone.label}
          </p>
        )
      )}

      {editable && !achieved && (
        <div className="mt-2">
          {!showDeposit ? (
            <button
              onClick={() => {
                setShowDeposit(true);
                setDepositMode("in");
                setDepositError("");
              }}
              className="text-[11px] font-bold px-2.5 py-1 rounded-full"
              style={{ background: "#8FD8BE33", color: C.mintDeep }}>
              + Setor
            </button>
          ) : (
            <div
              className="mt-1.5 rounded-2xl p-2.5"
              style={{ background: "#FFFFFF", border: "1px solid #463F5C14" }}>
              <div
                className="flex rounded-xl p-1 mb-2 gap-1"
                style={{ background: "#463F5C0d" }}>
                <button
                  onClick={() => setDepositMode("in")}
                  className="flex-1 py-1.5 rounded-lg text-[11px] font-bold"
                  style={{
                    background:
                      depositMode === "in" ? C.mintDeep : "transparent",
                    color: depositMode === "in" ? "#FFFFFF" : C.inkSoft,
                  }}>
                  Setor
                </button>
                <button
                  onClick={() => setDepositMode("out")}
                  className="flex-1 py-1.5 rounded-lg text-[11px] font-bold"
                  style={{
                    background:
                      depositMode === "out" ? C.roseDeep : "transparent",
                    color: depositMode === "out" ? "#FFFFFF" : C.inkSoft,
                  }}>
                  Tarik
                </button>
              </div>
              <p className="text-[10.5px] mb-1.5" style={{ color: C.inkSoft }}>
                {depositMode === "in"
                  ? `Saldo bisa disisihkan: ${rupiah(availableToAllocate)}`
                  : `Sudah disisihkan: ${rupiah(saved)}`}
              </p>
              <MoneyInput
                value={depositAmount}
                onChange={setDepositAmount}
                placeholder="Jumlah"
                className="mb-2"
              />
              {depositError && (
                <p
                  className="text-[11px] mb-2 font-medium"
                  style={{ color: C.roseDeep }}>
                  ⚠️ {depositError}
                </p>
              )}
              <div className="flex gap-2">
                <button
                  onClick={handleDepositSubmit}
                  disabled={depositSaving}
                  className="flex-1 py-2 rounded-xl font-bold text-[12px] disabled:opacity-50"
                  style={{
                    background:
                      depositMode === "in"
                        ? `linear-gradient(135deg, ${C.mintDeep}, ${C.mint})`
                        : `linear-gradient(135deg, ${C.roseDeep}, ${C.rose})`,
                    color: "#FFFFFF",
                  }}>
                  {depositSaving
                    ? "Menyimpan..."
                    : depositMode === "in"
                      ? "Setor"
                      : "Tarik"}
                </button>
                <button
                  onClick={() => {
                    setShowDeposit(false);
                    setDepositAmount("");
                    setDepositError("");
                  }}
                  className="flex-1 py-2 rounded-xl font-bold text-[12px]"
                  style={{ background: "#463F5C0f", color: C.inkSoft }}>
                  Batal
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
