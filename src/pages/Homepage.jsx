import { useEffect, useMemo, useState } from "react";
import { supabase } from "../supabaseClient";
import { C, FONT_IMPORT } from "../components/theme";
import Card from "../components/Card";
import ChangePasswordModal from "../components/ChangePasswordModal";
import TransactionForm from "./TransactionForm";
import { DesktopNav, MobileNav } from "../components/Navbar";
import Saldoku from "./Saldoku";
import Nabung from "./Nabung";
import {
  rupiah,
  todayISO,
  daysBetween,
  capitalize,
  formatDay,
  categoryLabel,
  categoryMeta,
  LOW_BALANCE_LIMIT,
} from "../lib/shared";

function getInitials(name) {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  return parts
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
}

// HomePage cuma jadi router/shell: pegang semua data & CRUD (transaksi,
// goals, logs), layout global (header, nav, reminder, ganti password),
// dan nentuin halaman/tab mana yang tampil. Konten tiap tab dipisah ke
// komponennya sendiri (Saldoku.jsx, Nabung.jsx) yang cuma nerima data +
// handler lewat props — gak fetching sendiri.
export default function HomePage({ user, onLogout }) {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingTx, setEditingTx] = useState(null);

  const [goals, setGoals] = useState([]);
  const [showAddGoal, setShowAddGoal] = useState(false);
  const [goalTitle, setGoalTitle] = useState("");
  const [goalAmount, setGoalAmount] = useState("");
  const [goalSaving, setGoalSaving] = useState(false);
  const [goalError, setGoalError] = useState("");
  const [goalToast, setGoalToast] = useState("");

  const [logs, setLogs] = useState([]);

  const [activeTab, setActiveTab] = useState("home");
  const [showChangePassword, setShowChangePassword] = useState(false);

  // State & turunan khusus konten tab "home" (dulu di Beranda.jsx,
  // sekarang digabung langsung ke sini).
  const [reminderDismissed, setReminderDismissed] = useState(false);

  const displayName = user.nama_lengkap || capitalize(user.username) || "Kamu";
  const pairIds = [user.id];

  async function fetchTransactions(ids) {
    const { data, error } = await supabase
      .from("transactions")
      .select("*")
      .in("owner_id", ids)
      .is("deleted_at", null)
      .order("date", { ascending: true });
    if (!error) setTransactions(data || []);
  }

  async function fetchGoals(ids) {
    const { data, error } = await supabase
      .from("savings_goals")
      .select("*")
      .in("owner_id", ids)
      .order("created_at", { ascending: true });
    if (!error) setGoals(data || []);
  }

  async function fetchLogs(ids) {
    const { data, error } = await supabase
      .from("transaction_logs")
      .select("*")
      .in("owner_id", ids)
      .order("changed_at", { ascending: false })
      .limit(30);
    if (!error) setLogs(data || []);
  }

  async function bootstrap() {
    setLoading(true);
    const ids = [user.id];
    await Promise.all([
      fetchTransactions(ids),
      fetchGoals(ids),
      fetchLogs(ids),
    ]);
    setLoading(false);
  }

  useEffect(() => {
    bootstrap();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
      await fetchTransactions(pairIds);
      return true;
    }
    return false;
  }

  async function updateTransaction(id, { type, amount, note, category }) {
    const oldTx = transactions.find((t) => t.id === id);
    const { error } = await supabase
      .from("transactions")
      .update({ type, amount, note, category: category || "lainnya" })
      .eq("id", id)
      .in("owner_id", pairIds);
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
        new_data: { type, amount, note, category: category || "lainnya" },
      });
    }

    await Promise.all([fetchTransactions(pairIds), fetchLogs(pairIds)]);
    return true;
  }

  async function saveTransaction({ id, type, amount, note, category }) {
    if (id) return updateTransaction(id, { type, amount, note, category });
    return addTransaction({ type, amount, note, category });
  }

  async function deleteTransaction(id) {
    const oldTx = transactions.find((t) => t.id === id);
    const { error } = await supabase
      .from("transactions")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", id)
      .in("owner_id", pairIds);
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

    await Promise.all([fetchTransactions(pairIds), fetchLogs(pairIds)]);
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
      await fetchGoals(pairIds);
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
      .in("owner_id", pairIds);
    if (!error) {
      await fetchGoals(pairIds);
      return true;
    }
    return false;
  }

  async function deleteGoal(id) {
    const { error } = await supabase
      .from("savings_goals")
      .delete()
      .eq("id", id)
      .in("owner_id", pairIds);
    if (!error) {
      await fetchGoals(pairIds);
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
      .in("owner_id", pairIds);
    if (error) return { ok: false, error: "Gagal menyimpan, coba lagi." };
    await fetchGoals(pairIds);
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
      .in("owner_id", pairIds);
    if (error) return { ok: false, error: "Gagal menyimpan, coba lagi." };
    await fetchGoals(pairIds);
    return { ok: true };
  }

  const totalIn = transactions
    .filter((t) => t.type === "in")
    .reduce((s, t) => s + Number(t.amount), 0);
  const totalOut = transactions
    .filter((t) => t.type === "out")
    .reduce((s, t) => s + Number(t.amount), 0);
  const saldo = totalIn - totalOut;
  const isLow = saldo < LOW_BALANCE_LIMIT;
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

  const hasTransactionToday = transactions.some((t) => t.date === todayISO());
  const showReminder = !hasTransactionToday && !reminderDismissed;
  const recentTransactions = useMemo(() => {
    return transactions.slice(-5).reverse();
  }, [transactions]);

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

      <div className="relative max-w-md sm:max-w-xl lg:max-w-5xl mx-auto px-4 sm:px-6 pt-6 sm:pt-10 pb-32 lg:pb-16">
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
          {/* Navbar dipisah di Navbar.jsx — versi desktop di sini,
              versi mobile ada di bawah dekat footer. */}
          <DesktopNav
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            onLogout={onLogout}
          />
        </div>

        {/* Tab "Home" — landing ringkas doang, sengaja minimalis biar gak
            nabrak/dobel sama tab Saldoku (yang punya kartu saldo gede +
            detail lengkap). Di sini cuma: reminder, saldo singkat (baris
            teks, bukan kartu besar), tombol cepat catat, & preview
            transaksi terakhir. Dulu terpisah di Beranda.jsx, sekarang
            digabung langsung di sini biar gak kecerecer di banyak file. */}
        {activeTab === "home" &&
          (loading ? (
            <p
              className="text-[13px] text-center py-10"
              style={{ color: C.inkFaint }}>
              Memuat...
            </p>
          ) : (
            <div className="max-w-xl lg:max-w-2xl mx-auto pb-20 lg:pb-0">
              {showReminder && (
                <div
                  className="flex items-center gap-3 rounded-2xl px-4 py-3.5 mb-4"
                  style={{
                    background: "#F6C4531F",
                    border: "1px solid #F6C45340",
                  }}>
                  <span className="text-[22px] flex-shrink-0">👀</span>
                  <div className="flex-1 min-w-0">
                    <p
                      className="text-[13px] font-semibold"
                      style={{ color: C.ink }}>
                      Belum ada catatan hari ini
                    </p>
                    <p className="text-[11.5px]" style={{ color: C.inkFaint }}>
                      Yuk catat dulu transaksinya biar rapi.
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      setEditingTx(null);
                      setShowForm(true);
                    }}
                    className="flex-shrink-0 px-3.5 py-2 rounded-xl text-[12px] font-bold whitespace-nowrap"
                    style={{
                      background: "linear-gradient(135deg, #D89B2E, #F6C453)",
                      color: "#FFFFFF",
                    }}>
                    Catat
                  </button>
                  <button
                    onClick={() => setReminderDismissed(true)}
                    aria-label="Tutup"
                    className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold"
                    style={{ background: "#463F5C14", color: C.inkFaint }}>
                    ✕
                  </button>
                </div>
              )}

              <Card className="mb-4 flex items-center justify-between gap-3 flex-wrap">
                <div>
                  <p
                    className="text-[10.5px] uppercase tracking-[0.1em] font-semibold"
                    style={{ color: C.inkFaint }}>
                    Saldo Sekarang
                  </p>
                  <p
                    className="text-[24px] sm:text-[28px] font-semibold mt-0.5"
                    style={{ fontFamily: "'Fraunces', serif", color: C.ink }}>
                    {rupiah(saldo)}
                  </p>
                </div>
                <span
                  className="px-3 py-1.5 rounded-full text-[11px] font-semibold flex-shrink-0"
                  style={{
                    background: isLow ? "#F4A6B71F" : "#8FD8BE33",
                    color: isLow ? C.roseDeep : C.mintDeep,
                  }}>
                  {isLow ? "⚠️ Mulai menipis" : "🌱 Aman"}
                </span>
              </Card>

              <button
                onClick={() => {
                  setEditingTx(null);
                  setShowForm(true);
                }}
                className="w-full py-3.5 sm:py-4 rounded-2xl font-bold text-[14px] sm:text-[15px] flex items-center justify-center gap-2 mb-4"
                style={{
                  background: `linear-gradient(135deg, ${C.mintDeep}, ${C.mint})`,
                  color: "#FFFFFF",
                  boxShadow: "0 14px 28px -14px rgba(63,158,124,0.6)",
                }}>
                <span className="text-[18px] leading-none">+</span> Catat
                Transaksi
              </button>

              <Card>
                <div className="flex items-center justify-between mb-2">
                  <h3
                    className="font-semibold text-[12px] sm:text-[13px] tracking-[0.08em] uppercase"
                    style={{ color: C.lavender }}>
                    Transaksi Terakhir
                  </h3>
                  <button
                    onClick={() => setActiveTab("saldoku")}
                    className="text-[11.5px] font-semibold"
                    style={{ color: C.lavender }}>
                    Lihat semua →
                  </button>
                </div>

                {recentTransactions.length === 0 ? (
                  <div className="py-8 text-center">
                    <div
                      className="w-14 h-14 mx-auto rounded-full flex items-center justify-center text-[26px] mb-3"
                      style={{ background: "#8B72C41A" }}>
                      📝
                    </div>
                    <p
                      className="text-[13px] font-medium"
                      style={{ color: C.ink }}>
                      Belum ada transaksi tercatat
                    </p>
                    <p
                      className="text-[12px] mt-1"
                      style={{ color: C.inkFaint }}>
                      Yuk mulai catat pemasukan atau pengeluaran hari ini.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-1 mt-1">
                    {recentTransactions.map((t) => {
                      const meta =
                        t.type === "in"
                          ? { icon: "💰", bg: "#3F9E7C22" }
                          : categoryMeta(t.category);
                      return (
                        <button
                          key={t.id}
                          onClick={() => setEditingTx(t)}
                          className="w-full flex items-center justify-between gap-2 py-1.5 px-1.5 -mx-1.5 rounded-xl text-left transition-colors hover:bg-[#463F5C08] active:bg-[#463F5C10]">
                          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0 flex-1">
                            <div
                              className="w-9 h-9 sm:w-10 sm:h-10 rounded-2xl flex items-center justify-center text-[16px] sm:text-[18px] flex-shrink-0"
                              style={{ background: meta.bg || meta.tint }}>
                              {meta.icon}
                            </div>
                            <div className="min-w-0">
                              <p
                                className="text-[13.5px] font-medium truncate"
                                style={{ color: C.ink }}>
                                {t.note ||
                                  (t.type === "in"
                                    ? "Pemasukan"
                                    : categoryLabel(t.category))}
                              </p>
                              <p
                                className="text-[11px]"
                                style={{ color: C.inkFaint }}>
                                {formatDay(t.date)}
                              </p>
                            </div>
                          </div>
                          <p
                            className="text-[14px] font-bold flex-shrink-0"
                            style={{
                              color: t.type === "in" ? C.mintDeep : C.ink,
                            }}>
                            {t.type === "in" ? "+" : "-"}
                            {rupiah(t.amount)}
                          </p>
                        </button>
                      );
                    })}
                  </div>
                )}
              </Card>
            </div>
          ))}

        {/* Tab Saldoku dipisah di Saldoku.jsx — HomePage cuma nyuplai
            ringkasan saldo, daftar transaksi, log, dan trigger buka
            form (state form-nya sendiri dipegang di sini biar bisa
            dipicu dari tab Homepage juga). */}
        {activeTab === "saldoku" && (
          <Saldoku
            loading={loading}
            transactions={transactions}
            saldo={saldo}
            totalIn={totalIn}
            totalOut={totalOut}
            isLow={isLow}
            avgOutPerDay={avgOutPerDay}
            logs={logs}
            onOpenForm={() => {
              setEditingTx(null);
              setShowForm(true);
            }}
            onEditTransaction={(t) => setEditingTx(t)}
          />
        )}

        {/* Tab Nabung dipisah di Nabung.jsx — Dashboard cuma nyuplai
            data & handler-nya lewat props. */}
        {activeTab === "nabung" && (
          <Nabung
            loading={loading}
            availableToAllocate={availableToAllocate}
            goals={goals}
            showAddGoal={showAddGoal}
            setShowAddGoal={setShowAddGoal}
            goalTitle={goalTitle}
            setGoalTitle={setGoalTitle}
            goalAmount={goalAmount}
            setGoalAmount={setGoalAmount}
            goalSaving={goalSaving}
            goalError={goalError}
            setGoalError={setGoalError}
            goalToast={goalToast}
            onAddGoal={addGoal}
            onEditGoal={updateGoal}
            onDeleteGoal={deleteGoal}
            onDepositGoal={depositToGoal}
            onWithdrawGoal={withdrawFromGoal}
          />
        )}

        {activeTab === "akun" && (
          <div className="max-w-md mx-auto">
            <Card>
              <div className="flex items-center gap-3 mb-6">
                <div
                  className="w-12 h-12 rounded-2xl flex items-center justify-center font-semibold text-[15px] flex-shrink-0"
                  style={{
                    background: `linear-gradient(135deg, ${C.lavender}, ${C.skyDeep})`,
                    color: "#FFFFFF",
                    fontFamily: "'Fraunces', serif",
                  }}>
                  {getInitials(displayName)}
                </div>
                <div className="min-w-0">
                  <p
                    style={{ fontFamily: "'Fraunces', serif", color: C.ink }}
                    className="text-[16px] font-semibold truncate">
                    {displayName}
                  </p>
                  <p className="text-[12.5px]" style={{ color: C.inkFaint }}>
                    @{user.username}
                  </p>
                </div>
              </div>

              <button
                onClick={() => setShowChangePassword(true)}
                className="w-full text-left px-4 py-3.5 rounded-2xl text-[13.5px] font-medium mb-2"
                style={{ background: "#463F5C0a", color: C.ink }}>
                Ganti Password
              </button>

              <button
                onClick={onLogout}
                className="w-full text-left px-4 py-3.5 rounded-2xl text-[13.5px] font-medium lg:hidden"
                style={{ background: "#D9607A14", color: C.roseDeep }}>
                Keluar
              </button>
            </Card>
          </div>
        )}
      </div>

      <MobileNav
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onLogout={onLogout}
      />

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
    </div>
  );
}
