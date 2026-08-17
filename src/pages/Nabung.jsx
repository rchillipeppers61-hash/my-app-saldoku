import { useState } from "react";
import { C } from "../components/theme";
import Card from "../components/Card";
import { rupiah } from "../lib/shared";

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
    <div className="max-w-xl mx-auto">
      <Card>
        <div
          className="rounded-2xl p-4 mb-4"
          style={{ background: "#8B72C41A" }}>
          <p
            className="text-[11px] uppercase tracking-[0.1em] font-semibold"
            style={{ color: C.lavender }}>
            Bisa Disisihkan
          </p>
          <p
            className="text-[20px] font-semibold mt-0.5"
            style={{ fontFamily: "'Fraunces', serif", color: C.ink }}>
            {rupiah(availableToAllocate)}
          </p>
        </div>

        <div className="flex items-center justify-between mb-3">
          <p
            className="text-[11px] uppercase tracking-[0.1em] font-semibold"
            style={{ color: C.inkFaint }}>
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
            <input
              type="number"
              value={goalAmount}
              onChange={(e) => setGoalAmount(e.target.value)}
              placeholder="Target (Rp) contoh: 5000000"
              className="w-full px-3 py-2.5 rounded-xl text-[13px] outline-none border-[1.5px]"
              style={{
                background: "#463F5C08",
                color: C.ink,
                borderColor: "#463F5C1F",
              }}
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
          <p className="text-[12.5px]" style={{ color: C.inkFaint }}>
            Belum ada target nabung. Yuk bikin satu!
          </p>
        ) : (
          <div className="space-y-4">
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
// dan gak di-export.
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
      <div className="rounded-2xl p-3" style={{ background: "#463F5C08" }}>
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
        <input
          type="number"
          value={targetAmount}
          onChange={(e) => setTargetAmount(e.target.value)}
          placeholder="Target (Rp)"
          className="w-full mb-2 px-3 py-2 rounded-xl text-[13px] outline-none border-[1.5px]"
          style={{
            background: "#FFFFFF",
            color: C.ink,
            borderColor: "#463F5C1F",
          }}
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
    <div>
      <div className="flex items-center justify-between gap-2 text-[13px] mb-1">
        <span
          className="font-medium truncate flex items-center gap-1.5"
          style={{ color: C.ink }}>
          {achieved ? "🏆" : "🎯"} {goal.title}
        </span>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <span style={{ color: C.inkFaint }}>
            {rupiah(saved)} / {rupiah(goal.target_amount)}
          </span>
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
      {achieved && (
        <p
          className="text-[11px] mt-1 font-semibold"
          style={{ color: C.mintDeep }}>
          🎉 Target tercapai!
        </p>
      )}

      {editable && !achieved && (
        <div className="mt-1.5">
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
              style={{ background: "#463F5C08" }}>
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
              <p className="text-[10.5px] mb-1.5" style={{ color: C.inkFaint }}>
                {depositMode === "in"
                  ? `Saldo bisa disisihkan: ${rupiah(availableToAllocate)}`
                  : `Sudah disisihkan: ${rupiah(saved)}`}
              </p>
              <input
                type="number"
                value={depositAmount}
                onChange={(e) => setDepositAmount(e.target.value)}
                placeholder="Jumlah (Rp)"
                className="w-full mb-2 px-3 py-2 rounded-xl text-[13px] outline-none border-[1.5px]"
                style={{
                  background: "#FFFFFF",
                  color: C.ink,
                  borderColor: "#463F5C1F",
                }}
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
