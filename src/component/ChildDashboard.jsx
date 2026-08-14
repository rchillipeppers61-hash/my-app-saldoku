import { useEffect, useMemo, useState } from "react";
import { supabase } from "../supabaseClient";
import { C, FONT_IMPORT } from "./theme";
import Card from "./Card";
import TransactionForm from "./TransactionForm";
import ChangePasswordModal from "./ChangePasswordModal";
import SavingsGoalItem from "./SavingsGoalItem";
import {
  rupiah,
  todayISO,
  formatDay,
  daysBetween,
  categoryLabel,
  capitalize,
  monthLabel,
  LOW_BALANCE_LIMIT,
} from "../lib/shared";

const CATEGORY_META = {
  makan: { icon: "🍜", bg: "#8FD8BE2A" },
  jajan: { icon: "🍿", bg: "#F4A6B72A" },
  transport: { icon: "🚌", bg: "#9FCBF02A" },
  kuliah: { icon: "📚", bg: "#8B72C42A" },
  pribadi: { icon: "🧴", bg: "#F6C4532A" },
  lainnya: { icon: "✨", bg: "#463F5C14" },
};

function getCategoryMeta(cat) {
  return CATEGORY_META[cat] || CATEGORY_META.lainnya;
}

function getInitials(name) {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  return parts
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
}

export default function ChildDashboard({ user, onLogout }) {
  const [transactions, setTransactions] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editingTx, setEditingTx] = useState(null);
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState("week");
  const [goals, setGoals] = useState([]);
  const [showAddGoal, setShowAddGoal] = useState(false);
  const [goalTitle, setGoalTitle] = useState("");
  const [goalAmount, setGoalAmount] = useState("");
  const [goalSaving, setGoalSaving] = useState(false);
  const [goalError, setGoalError] = useState("");
  const [goalToast, setGoalToast] = useState("");
  const [reminderDismissed, setReminderDismissed] = useState(false);
  const [isLinked, setIsLinked] = useState(null); // null = belum dicek
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [inviteCode, setInviteCode] = useState(null);
  const [inviteExpiresAt, setInviteExpiresAt] = useState(null);
  const [generatingCode, setGeneratingCode] = useState(false);
  const [codeError, setCodeError] = useState("");
  const [codeCopied, setCodeCopied] = useState(false);

  async function handleCopyInviteCode() {
    try {
      await navigator.clipboard.writeText(inviteCode);
      setCodeCopied(true);
      setTimeout(() => setCodeCopied(false), 2000);
    } catch {
      // Clipboard API gagal -- diemin aja, user masih bisa select manual.
    }
  }

  const displayName = user.nama_lengkap || capitalize(user.username) || "Kamu";

  async function fetchTransactions() {
    setLoading(true);
    const { data, error } = await supabase
      .from("transactions")
      .select("*")
      .eq("owner_id", user.id)
      .is("deleted_at", null)
      .order("date", { ascending: true });
    if (!error) setTransactions(data || []);
    setLoading(false);
  }

  async function fetchGoals() {
    const { data, error } = await supabase
      .from("savings_goals")
      .select("*")
      .eq("owner_id", user.id)
      .order("created_at", { ascending: true });
    if (!error) setGoals(data || []);
  }

  useEffect(() => {
    fetchTransactions();
    fetchGoals();
    checkLinkStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function checkLinkStatus() {
    const { data } = await supabase
      .from("users")
      .select("id")
      .eq("role", "orang_tua")
      .eq("linked_child_id", user.id)
      .maybeSingle();

    setIsLinked(!!data);

    if (!data) {
      loadActiveInviteCode();
    }
  }

  async function loadActiveInviteCode() {
    const { data } = await supabase
      .from("invite_codes")
      .select("code, expires_at")
      .eq("user_id", user.id)
      .is("used_at", null)
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (data) {
      setInviteCode(data.code);
      setInviteExpiresAt(data.expires_at);
    }
  }

  async function generateInviteCode() {
    setGeneratingCode(true);
    setCodeError("");

    // Opsi 3: invalidate semua kode lama yang belum kepake punya user
    // ini dulu, biar cuma ada 1 kode aktif setiap saat.
    await supabase
      .from("invite_codes")
      .update({ used_at: new Date().toISOString() })
      .eq("user_id", user.id)
      .is("used_at", null);

    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let code = "";
    for (let i = 0; i < 6; i++) {
      code += chars[Math.floor(Math.random() * chars.length)];
    }

    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    const { error } = await supabase.from("invite_codes").insert({
      code,
      user_id: user.id,
      expires_at: expiresAt,
    });

    setGeneratingCode(false);

    if (error) {
      setCodeError("Gagal membuat kode. Coba lagi.");
      return;
    }

    setInviteCode(code);
    setInviteExpiresAt(expiresAt);
  }

  async function addTransaction({ type, amount, note, category }) {
    const { error } = await supabase.from("transactions").insert({
      owner_id: user.id,
      type,
      amount,
      note,
      category: category || "lainnya",
      date: todayISO(),
    });
    if (!error) {
      await fetchTransactions();
      return true;
    }
    return false;
  }

  async function updateTransaction(id, { type, amount, note, category }) {
    const oldTx = transactions.find((t) => t.id === id);
    const { error } = await supabase
      .from("transactions")
      .update({
        type,
        amount,
        note,
        category: category || "lainnya",
      })
      .eq("id", id)
      .eq("owner_id", user.id);
    if (error) return false;

    if (oldTx) {
      await supabase.from("transaction_logs").insert({
        transaction_id: id,
        owner_id: user.id,
        action: "update",
        old_data: {
          type: oldTx.type,
          amount: oldTx.amount,
          note: oldTx.note,
          category: oldTx.category,
        },
        new_data: {
          type,
          amount,
          note,
          category: category || "lainnya",
        },
      });
    }

    await fetchTransactions();
    return true;
  }

  async function saveTransaction({ id, type, amount, note, category }) {
    if (id) {
      return updateTransaction(id, { type, amount, note, category });
    }
    return addTransaction({ type, amount, note, category });
  }

  async function deleteTransaction(id) {
    const oldTx = transactions.find((t) => t.id === id);
    const { error } = await supabase
      .from("transactions")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", id)
      .eq("owner_id", user.id);
    if (error) return false;

    if (oldTx) {
      await supabase.from("transaction_logs").insert({
        transaction_id: id,
        owner_id: user.id,
        action: "delete",
        old_data: {
          type: oldTx.type,
          amount: oldTx.amount,
          note: oldTx.note,
          category: oldTx.category,
        },
        new_data: null,
      });
    }

    await fetchTransactions();
    return true;
  }

  async function addGoal() {
    const amt = parseFloat(goalAmount);
    if (!goalTitle.trim() || !amt || amt <= 0) {
      setGoalError("Isi nama target dan jumlahnya dulu ya.");
      return false;
    }
    setGoalError("");
    setGoalSaving(true);
    const { error } = await supabase.from("savings_goals").insert({
      owner_id: user.id,
      title: goalTitle.trim(),
      target_amount: amt,
      saved_amount: 0,
    });
    setGoalSaving(false);
    if (!error) {
      setGoalTitle("");
      setGoalAmount("");
      setShowAddGoal(false);
      await fetchGoals();
      setGoalToast("Target tersimpan ✓");
      setTimeout(() => setGoalToast(""), 2500);
      return true;
    }
    setGoalError("Gagal menyimpan target, coba lagi.");
    return false;
  }

  async function updateGoal(id, { title, target_amount }) {
    const { error } = await supabase
      .from("savings_goals")
      .update({ title, target_amount })
      .eq("id", id)
      .eq("owner_id", user.id);
    if (!error) {
      await fetchGoals();
      return true;
    }
    return false;
  }

  async function deleteGoal(id) {
    const { error } = await supabase
      .from("savings_goals")
      .delete()
      .eq("id", id)
      .eq("owner_id", user.id);
    if (!error) {
      await fetchGoals();
    } else {
      setGoalError("Gagal menghapus target, coba lagi.");
      setTimeout(() => setGoalError(""), 3000);
    }
  }

  async function depositToGoal(id, amount) {
    if (!amount || amount <= 0) {
      return { ok: false, error: "Jumlah harus lebih dari 0." };
    }
    const totalSaved = goals.reduce(
      (s, g) => s + Number(g.saved_amount || 0),
      0,
    );
    const available = saldo - totalSaved;
    if (amount > available) {
      return {
        ok: false,
        error: `Saldo yang bisa disisihkan cuma ${rupiah(available)}.`,
      };
    }
    const goal = goals.find((g) => g.id === id);
    if (!goal) return { ok: false, error: "Target tidak ditemukan." };
    const newSaved = Number(goal.saved_amount || 0) + amount;
    const { error } = await supabase
      .from("savings_goals")
      .update({ saved_amount: newSaved })
      .eq("id", id)
      .eq("owner_id", user.id);
    if (error) return { ok: false, error: "Gagal menyimpan, coba lagi." };
    await fetchGoals();
    return { ok: true };
  }

  async function withdrawFromGoal(id, amount) {
    if (!amount || amount <= 0) {
      return { ok: false, error: "Jumlah harus lebih dari 0." };
    }
    const goal = goals.find((g) => g.id === id);
    if (!goal) return { ok: false, error: "Target tidak ditemukan." };
    const currentSaved = Number(goal.saved_amount || 0);
    if (amount > currentSaved) {
      return {
        ok: false,
        error: `Yang sudah disisihkan cuma ${rupiah(currentSaved)}.`,
      };
    }
    const newSaved = currentSaved - amount;
    const { error } = await supabase
      .from("savings_goals")
      .update({ saved_amount: newSaved })
      .eq("id", id)
      .eq("owner_id", user.id);
    if (error) return { ok: false, error: "Gagal menyimpan, coba lagi." };
    await fetchGoals();
    return { ok: true };
  }

  const totalIn = transactions
    .filter((t) => t.type === "in")
    .reduce((s, t) => s + t.amount, 0);
  const totalOut = transactions
    .filter((t) => t.type === "out")
    .reduce((s, t) => s + t.amount, 0);
  const saldo = totalIn - totalOut;
  const isLow = saldo < LOW_BALANCE_LIMIT;
  const hasTransactionToday = transactions.some((t) => t.date === todayISO());
  const showReminder = !loading && !hasTransactionToday && !reminderDismissed;
  const currentMonthKey = todayISO().slice(0, 7);
  const totalOutThisMonth = transactions
    .filter((t) => t.type === "out" && t.date.slice(0, 7) === currentMonthKey)
    .reduce((s, t) => s + t.amount, 0);
  const avgOutPerDay = Math.round(
    totalOutThisMonth / daysBetween(`${currentMonthKey}-01`, todayISO()),
  );
  const totalSavedInGoals = goals.reduce(
    (s, g) => s + Number(g.saved_amount || 0),
    0,
  );
  const availableToAllocate = saldo - totalSavedInGoals;

  const availableMonths = useMemo(() => {
    const set = new Set(transactions.map((t) => t.date.slice(0, 7)));
    return Array.from(set).sort((a, b) => (a < b ? 1 : -1));
  }, [transactions]);

  const displayTransactions = useMemo(() => {
    if (period === "week") {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - 6);
      const cutoffISO = cutoff.toISOString().slice(0, 10);
      return transactions.filter((t) => t.date >= cutoffISO);
    }
    return transactions.filter((t) => t.date.slice(0, 7) === period);
  }, [transactions, period]);

  const byDay = useMemo(() => {
    const map = {};
    displayTransactions.forEach((t) => {
      (map[t.date] = map[t.date] || []).push(t);
    });
    return Object.entries(map).sort((a, b) => (a[0] < b[0] ? 1 : -1));
  }, [displayTransactions]);

  return (
    <div
      className="min-h-screen w-full"
      style={{
        background: C.bg,
        fontFamily: "'Inter', sans-serif",
        color: C.ink,
      }}>
      <style>{FONT_IMPORT}</style>
      <div className="fixed inset-0 pointer-events-none overflow-hidden hidden sm:block">
        <div
          className="absolute -top-24 -right-24 w-72 h-72 rounded-full opacity-40 blur-3xl"
          style={{ background: C.mint }}
        />
        <div
          className="absolute top-1/3 -left-32 w-80 h-80 rounded-full opacity-30 blur-3xl"
          style={{ background: C.rose }}
        />
        <div
          className="absolute bottom-0 right-1/4 w-64 h-64 rounded-full opacity-30 blur-3xl"
          style={{ background: C.sky }}
        />
      </div>

      <div className="relative max-w-md sm:max-w-xl lg:max-w-5xl mx-auto px-4 sm:px-6 pt-6 sm:pt-10 pb-28 lg:pb-16">
        <div className="flex items-center justify-between mb-5 sm:mb-8">
          <div className="flex items-center gap-3 min-w-0">
            <div
              className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl flex items-center justify-center font-semibold text-[14px] sm:text-[15px] flex-shrink-0"
              style={{
                background: `linear-gradient(135deg, ${C.lavender}, ${C.skyDeep})`,
                color: "#FFFFFF",
                fontFamily: "'Fraunces', serif",
              }}>
              {getInitials(displayName)}
            </div>
            <div className="min-w-0">
              <p
                className="text-[11px] tracking-[0.2em] uppercase font-semibold"
                style={{ color: C.lavender }}>
                My Wallet
              </p>
              <h1
                style={{ fontFamily: "'Fraunces', serif" }}
                className="text-[19px] sm:text-[25px] font-semibold leading-tight truncate">
                Halo, {displayName} 👋
              </h1>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={() => setShowChangePassword(true)}
              className="w-9 h-9 sm:w-10 sm:h-10 rounded-2xl flex items-center justify-center text-[15px] sm:text-[16px]"
              style={{ background: "#463F5C0f", color: C.inkSoft }}
              aria-label="Ganti Password"
              title="Ganti Password">
              🔒
            </button>
            <button
              onClick={onLogout}
              className="text-[12px] font-semibold px-3.5 py-2 rounded-2xl"
              style={{ background: C.roseDeep, color: "#FFFFFF" }}>
              Keluar
            </button>
          </div>
        </div>

        {isLinked === false && (
          <div
            className="flex items-center justify-between gap-3 mb-5 sm:mb-6 px-4 py-3 rounded-2xl"
            style={{ background: "#F6C4531F" }}>
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="flex-shrink-0">👀</span>
              <p
                className="text-[12.5px] font-semibold min-w-0"
                style={{ color: C.ink }}>
                Belum Terhubung Ke Akun Orang Tua.
              </p>
            </div>
            <button
              onClick={() => setShowLinkModal(true)}
              className="text-[12px] font-semibold px-3 py-1.5 rounded-xl flex-shrink-0"
              style={{ background: C.amberDeep, color: "#FFFFFF" }}>
              Hubungkan
            </button>
          </div>
        )}

        {showReminder && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center px-4"
            style={{ background: "rgba(70,63,92,0.45)" }}>
            <div
              className="w-full sm:max-w-sm bg-white rounded-[28px] px-6 pt-8 pb-7 text-center"
              style={{ boxShadow: "0 24px 56px -20px rgba(70,63,92,0.35)" }}>
              <div
                className="w-14 h-14 mx-auto rounded-full flex items-center justify-center text-[22px] mb-4"
                style={{ background: "#F6C4531F" }}>
                👀
              </div>
              <h3
                style={{ fontFamily: "'Fraunces', serif", color: C.ink }}
                className="text-[19px] sm:text-[20px] font-semibold leading-snug">
                Belum Ada Catatan Hari Ini
              </h3>
              <p
                className="text-[13px] sm:text-[13.5px] mt-2"
                style={{ color: C.inkFaint }}>
                Yuk catat dulu transaksinya biar rapi.
              </p>
              <button
                onClick={() => setReminderDismissed(true)}
                className="w-full mt-6 py-3.5 rounded-2xl font-bold text-[14px] sm:text-[15px]"
                style={{
                  background: "linear-gradient(135deg, #D89B2E, #F6C453)",
                  color: "#FFFFFF",
                  boxShadow: "0 14px 28px -14px rgba(216,155,46,0.6)",
                }}>
                Siap, dicatat!
              </button>
            </div>
          </div>
        )}

        {loading ? (
          <p
            className="text-[13px] text-center py-10"
            style={{ color: C.inkFaint }}>
            Memuat...
          </p>
        ) : (
          <div className="lg:grid lg:grid-cols-[minmax(0,340px)_1fr] lg:gap-6 lg:items-stretch">
            <div className="lg:sticky lg:top-8 flex flex-col gap-4 lg:self-start">
              <div
                className="rounded-[32px] p-6 sm:p-8 relative overflow-hidden"
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
                <div className="relative z-10">
                  <p
                    className="text-[11px] sm:text-[12px] uppercase tracking-[0.2em] font-semibold"
                    style={{ color: "rgba(255,255,255,0.75)" }}>
                    Saldo Sekarang
                  </p>
                  <p
                    style={{
                      fontFamily: "'Fraunces', serif",
                      color: "#FFFFFF",
                    }}
                    className="mt-1 text-[34px] sm:text-[42px] lg:text-[40px] font-semibold leading-none">
                    {rupiah(saldo)}
                  </p>
                  <span
                    className="inline-flex items-center gap-1.5 mt-3 sm:mt-4 px-3 py-1.5 rounded-full text-[11px] sm:text-[12px] font-semibold"
                    style={{
                      background: "rgba(255,255,255,0.18)",
                      color: "#FFFFFF",
                      border: "1px solid rgba(255,255,255,0.3)",
                    }}>
                    {isLow
                      ? "⚠️ Saldo mulai menipis"
                      : "🌱 Saldo dalam kondisi aman"}
                  </span>
                  <div className="grid grid-cols-2 gap-2.5 sm:gap-3 mt-5 sm:mt-6">
                    <div
                      className="rounded-2xl p-3 sm:p-3.5"
                      style={{
                        background: "rgba(255,255,255,0.14)",
                        border: "1px solid rgba(255,255,255,0.22)",
                      }}>
                      <p
                        className="text-[9px] sm:text-[10px] uppercase tracking-wide font-semibold"
                        style={{ color: "rgba(255,255,255,0.75)" }}>
                        Masuk
                      </p>
                      <p
                        className="text-[15px] sm:text-[17px] font-bold mt-0.5"
                        style={{ color: "#FFFFFF" }}>
                        {rupiah(totalIn)}
                      </p>
                    </div>
                    <div
                      className="rounded-2xl p-3 sm:p-3.5"
                      style={{
                        background: "rgba(255,255,255,0.14)",
                        border: "1px solid rgba(255,255,255,0.22)",
                      }}>
                      <p
                        className="text-[9px] sm:text-[10px] uppercase tracking-wide font-semibold"
                        style={{ color: "rgba(255,255,255,0.75)" }}>
                        Keluar
                      </p>
                      <p
                        className="text-[15px] sm:text-[17px] font-bold mt-0.5"
                        style={{ color: "#FFFFFF" }}>
                        {rupiah(totalOut)}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div
                className="rounded-2xl p-3.5 sm:p-4 text-center"
                style={{
                  background: "#F6C4531F",
                  border: `1.5px solid #F6C45355`,
                }}>
                <p
                  className="text-[12px] sm:text-[12.5px] font-semibold leading-snug"
                  style={{ color: C.amberDeep }}>
                  💡 Catat Pengeluaran Untuk Belajar Mengelola Uang Dengan Baik
                </p>
              </div>

              <Card>
                <div className="flex items-center justify-between">
                  <div>
                    <p
                      className="text-[11px] uppercase tracking-[0.1em] font-semibold"
                      style={{ color: C.inkFaint }}>
                      Rata-rata / Hari
                    </p>
                    <p
                      className="text-[19px] sm:text-[21px] font-semibold mt-0.5"
                      style={{
                        fontFamily: "'Fraunces', serif",
                        color: C.lavender,
                      }}>
                      {rupiah(avgOutPerDay)}
                    </p>
                    <p
                      className="text-[10.5px] mt-0.5"
                      style={{ color: C.inkFaint }}>
                      Bulan ini
                    </p>
                  </div>
                  <div
                    className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl flex items-center justify-center text-[20px] flex-shrink-0"
                    style={{ background: "#8B72C41A" }}>
                    📊
                  </div>
                </div>
              </Card>

              <Card>
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
                      placeholder="Contoh: Sepatu baru"
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
                      placeholder="Target (Rp) contoh: 500000"
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
                      onClick={addGoal}
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
                        onDelete={deleteGoal}
                        onEdit={updateGoal}
                        onDeposit={depositToGoal}
                        onWithdraw={withdrawFromGoal}
                        availableToAllocate={availableToAllocate}
                      />
                    ))}
                  </div>
                )}
              </Card>

              <button
                onClick={() => setShowForm(true)}
                className="w-full py-3.5 sm:py-4 rounded-2xl font-bold text-[14px] sm:text-[15px] items-center justify-center gap-2 hidden lg:flex"
                style={{
                  background: `linear-gradient(135deg, ${C.mintDeep}, ${C.mint})`,
                  color: "#FFFFFF",
                  boxShadow: "0 14px 28px -14px rgba(63,158,124,0.6)",
                }}>
                <span className="text-[18px] leading-none">+</span> Catat
                Transaksi
              </button>
            </div>

            <div className="mt-4 lg:mt-0 lg:flex lg:flex-col lg:h-full">
              <Card className="lg:flex lg:flex-col lg:h-full">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="min-w-0">
                    <h3
                      className="font-semibold text-[12px] sm:text-[13px] tracking-[0.08em] uppercase"
                      style={{ color: C.lavender }}>
                      Catatan Harian
                    </h3>
                    <p
                      className="text-[12px] mt-0.5"
                      style={{ color: C.inkFaint }}>
                      {period === "week"
                        ? "7 hari terakhir"
                        : monthLabel(period)}
                    </p>
                  </div>
                  <div className="relative flex-shrink-0">
                    <select
                      value={period}
                      onChange={(e) => setPeriod(e.target.value)}
                      className="appearance-none pl-3 pr-7 py-2 rounded-full text-[11px] sm:text-[12px] font-semibold outline-none"
                      style={{
                        background: "#8B72C41A",
                        color: C.lavender,
                        border: "1px solid #8B72C433",
                      }}>
                      <option value="week">7 Hari Terakhir</option>
                      {availableMonths.map((m) => (
                        <option key={m} value={m}>
                          {monthLabel(m)}
                        </option>
                      ))}
                    </select>
                    <span
                      className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[9px]"
                      style={{ color: C.lavender }}>
                      ▾
                    </span>
                  </div>
                </div>
                <div className="mt-1 max-h-[26rem] lg:max-h-none lg:flex-1 overflow-y-auto pr-1">
                  {transactions.length === 0 && (
                    <div className="py-10 sm:py-12 text-center">
                      <div
                        className="w-14 h-14 sm:w-16 sm:h-16 mx-auto rounded-full flex items-center justify-center text-[26px] sm:text-[28px] mb-3"
                        style={{ background: "#8B72C41A" }}>
                        📝
                      </div>
                      <p
                        className="text-[13.5px] sm:text-[14px] font-medium"
                        style={{ color: C.ink }}>
                        Belum ada transaksi tercatat
                      </p>
                      <p
                        className="text-[12px] sm:text-[12.5px] mt-1"
                        style={{ color: C.inkFaint }}>
                        Yuk mulai catat pemasukan atau pengeluaran hari ini.
                      </p>
                    </div>
                  )}
                  {transactions.length > 0 && byDay.length === 0 && (
                    <div className="py-10 sm:py-12 text-center">
                      <div
                        className="w-14 h-14 sm:w-16 sm:h-16 mx-auto rounded-full flex items-center justify-center text-[26px] sm:text-[28px] mb-3"
                        style={{ background: "#8B72C41A" }}>
                        🔍
                      </div>
                      <p
                        className="text-[13.5px] sm:text-[14px] font-medium"
                        style={{ color: C.ink }}>
                        Tidak ada transaksi di periode ini
                      </p>
                      <p
                        className="text-[12px] sm:text-[12.5px] mt-1"
                        style={{ color: C.inkFaint }}>
                        Coba pilih periode lain di dropdown atas.
                      </p>
                    </div>
                  )}
                  {byDay.map(([date, txs]) => {
                    const dayOut = txs
                      .filter((t) => t.type === "out")
                      .reduce((s, t) => s + t.amount, 0);
                    return (
                      <div
                        key={date}
                        className="py-3 border-b last:border-0"
                        style={{ borderColor: "#463F5C12" }}>
                        <div className="flex items-center justify-between mb-2">
                          <span
                            className="inline-flex items-center px-3 py-1 rounded-full text-[11px] sm:text-[12px] font-semibold"
                            style={{
                              background: "#8B72C41A",
                              color: C.lavender,
                            }}>
                            {formatDay(date)}
                          </span>
                          {dayOut > 0 && (
                            <span
                              className="text-[11px] sm:text-[12px] font-semibold px-2.5 py-1 rounded-full"
                              style={{
                                background: "#F4A6B71F",
                                color: C.roseDeep,
                              }}>
                              -{rupiah(dayOut)}
                            </span>
                          )}
                        </div>
                        <div className="space-y-1">
                          {txs.map((t) => {
                            const meta =
                              t.type === "in"
                                ? { icon: "💰", bg: "#3F9E7C22" }
                                : getCategoryMeta(t.category);
                            return (
                              <button
                                key={t.id}
                                onClick={() => setEditingTx(t)}
                                className="w-full flex items-center justify-between gap-2 py-1.5 px-1.5 -mx-1.5 rounded-xl text-left transition-colors hover:bg-[#463F5C08] active:bg-[#463F5C10]">
                                <div className="flex items-center gap-2.5 sm:gap-3 min-w-0 flex-1">
                                  <div
                                    className="w-9 h-9 sm:w-10 sm:h-10 rounded-2xl flex items-center justify-center text-[16px] sm:text-[18px] flex-shrink-0"
                                    style={{ background: meta.bg }}>
                                    {meta.icon}
                                  </div>
                                  <div className="min-w-0">
                                    <p
                                      className="text-[13.5px] sm:text-[14.5px] font-medium truncate"
                                      style={{ color: C.ink }}>
                                      {t.note ||
                                        (t.type === "in"
                                          ? "Pemasukan"
                                          : categoryLabel(t.category))}
                                    </p>
                                    <p
                                      className="text-[11px] sm:text-[11.5px]"
                                      style={{ color: C.inkFaint }}>
                                      {t.type === "in"
                                        ? "Pemasukan"
                                        : categoryLabel(t.category)}
                                    </p>
                                  </div>
                                </div>
                                <div className="flex items-center gap-1.5 flex-shrink-0">
                                  <p
                                    className="text-[14px] sm:text-[15px] font-bold"
                                    style={{
                                      color:
                                        t.type === "in" ? C.mintDeep : C.ink,
                                    }}>
                                    {t.type === "in" ? "+" : "-"}
                                    {rupiah(t.amount)}
                                  </p>
                                  <span
                                    className="text-[11px]"
                                    style={{ color: C.inkFaint }}>
                                    ✏️
                                  </span>
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </Card>
            </div>
          </div>
        )}
      </div>

      <button
        onClick={() => setShowForm(true)}
        className="fixed bottom-6 right-5 sm:right-8 lg:hidden w-14 h-14 sm:w-16 sm:h-16 rounded-full flex items-center justify-center text-[26px] sm:text-[30px] font-light"
        style={{
          background: `linear-gradient(135deg, ${C.mintDeep}, ${C.mint})`,
          color: "#FFFFFF",
          boxShadow: "0 14px 30px -10px rgba(63,158,124,0.6)",
        }}>
        +
      </button>

      {(showForm || editingTx) && (
        <TransactionForm
          transaction={editingTx}
          onSave={saveTransaction}
          onDelete={deleteTransaction}
          onClose={() => {
            setShowForm(false);
            setEditingTx(null);
          }}
        />
      )}

      {showChangePassword && (
        <ChangePasswordModal
          user={user}
          onClose={() => setShowChangePassword(false)}
        />
      )}

      {showLinkModal && (
        <div
          className="fixed inset-0 flex items-end sm:items-center justify-center z-50 px-4 pb-4 sm:pb-4"
          style={{ background: "rgba(70,63,92,0.4)" }}
          onClick={() => setShowLinkModal(false)}>
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full sm:max-w-sm rounded-[28px] p-6 sm:p-7"
            style={{
              background: "#FFFFFF",
              boxShadow: "0 24px 56px -20px rgba(70,63,92,0.35)",
            }}>
            <p
              className="text-[11px] tracking-[0.2em] uppercase font-semibold mb-1"
              style={{ color: C.lavender }}>
              Belum Terhubung
            </p>
            <h3
              style={{ fontFamily: "'Fraunces', serif", color: C.ink }}
              className="text-[18px] font-semibold mb-2">
              Sambungkan ke Orang Tua
            </h3>
            <p className="text-[13px] mb-5" style={{ color: C.inkFaint }}>
              Buat kode undangan di bawah, terus kasih kodenya ke orang tua kamu
              supaya dia bisa masukin pas login/daftar.
            </p>

            {inviteCode ? (
              <>
                <div
                  className="text-center text-[26px] font-semibold tracking-[0.3em] py-4 rounded-2xl mb-3"
                  style={{
                    background: "#463F5C08",
                    color: C.ink,
                    fontFamily: "'Fraunces', serif",
                  }}>
                  {inviteCode}
                </div>
                <button
                  type="button"
                  onClick={handleCopyInviteCode}
                  className="w-full py-2.5 rounded-2xl font-semibold text-[13px] mb-3 transition-colors"
                  style={{
                    background: codeCopied ? "#3F9E7C1F" : "#463F5C0d",
                    color: codeCopied ? C.mintDeep : C.ink,
                  }}>
                  {codeCopied ? "✓ Kode disalin" : "Salin Kode"}
                </button>
                {inviteExpiresAt && (
                  <p
                    className="text-center text-[11.5px] mb-5"
                    style={{ color: C.inkFaint }}>
                    Berlaku sampai{" "}
                    {new Date(inviteExpiresAt).toLocaleString("id-ID", {
                      day: "numeric",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                )}
              </>
            ) : (
              <p className="text-[12.5px] mb-5" style={{ color: C.inkFaint }}>
                Belum ada kode aktif.
              </p>
            )}

            {codeError && (
              <div
                className="flex items-center gap-2 text-[12px] mb-4 px-3.5 py-2.5 rounded-xl font-medium"
                style={{ background: "#D9607A14", color: C.roseDeep }}>
                <span className="flex-shrink-0">⚠️</span>
                <span>{codeError}</span>
              </div>
            )}

            <button
              onClick={generateInviteCode}
              disabled={generatingCode}
              className="w-full py-3 rounded-2xl text-sm font-semibold disabled:opacity-50"
              style={{
                background: `linear-gradient(135deg, ${C.lavender}, ${C.skyDeep})`,
                color: "#fff",
              }}>
              {generatingCode
                ? "Memproses..."
                : inviteCode
                  ? "Buat Kode Baru"
                  : "Buat Kode Undangan"}
            </button>

            <button
              onClick={() => setShowLinkModal(false)}
              className="w-full mt-2.5 py-3 rounded-2xl text-[13px] font-semibold"
              style={{ background: "#463F5C0f", color: C.ink }}>
              Tutup
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
