import { useState } from "react";
import { C } from "./theme";
import { rupiah } from "../lib/shared";

export default function SavingsGoalItem({
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
