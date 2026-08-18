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
  balanceStatus,
} from "../lib/shared";

function getInitials(name) {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  return parts
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
}

// Tile aksi cepat buat grid Quick Action di tab Home. Komponen kecil
// & reusable, ukuran & style-nya senada sama pola icon-badge yang
// udah dipakai di tempat lain (Card, list transaksi, dll).
function QuickAction({ icon, label, bg, color, onClick }) {
  return (
    <button
      onClick={onClick}
      className="flex flex-col items-center justify-center gap-1.5 py-3.5 sm:py-4 rounded-2xl transition-transform active:scale-[0.96]"
      style={{ background: bg }}>
      <span
        className="text-[19px] sm:text-[20px] leading-none"
        style={{ color }}>
        {icon}
      </span>
      <span
        className="text-[10.5px] sm:text-[11px] font-bold"
        style={{ color }}>
        {label}
      </span>
    </button>
  );
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
  const saldoStatus = balanceStatus(saldo);
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
  const showReminder = !loading && !hasTransactionToday && !reminderDismissed;
  const recentTransactions = useMemo(() => {
    return transactions.slice(-5).reverse();
  }, [transactions]);

  // --- Turunan khusus tab "Home" biar tampilannya gak kembar sama tab
  // Saldoku: sapaan sesuai jam, insight kategori terbesar minggu ini,
  // dan goal nabung yang paling deket kecapai. Saldoku fokus ke buku
  // besar/riwayat lengkap, Home fokus ke ringkasan + akses cepat. ---
  const greeting = useMemo(() => {
    const h = new Date().getHours();
    if (h < 11) return "Selamat pagi";
    if (h < 15) return "Selamat siang";
    if (h < 19) return "Selamat sore";
    return "Selamat malam";
  }, []);

  const monthlyTopCategory = useMemo(() => {
    const byCategory = {};
    transactions
      .filter((t) => t.type === "out" && t.date.slice(0, 7) === currentMonthKey)
      .forEach((t) => {
        byCategory[t.category] =
          (byCategory[t.category] || 0) + Number(t.amount);
      });
    const entries = Object.entries(byCategory).sort((a, b) => b[1] - a[1]);
    if (entries.length === 0) return null;
    return { category: entries[0][0], amount: entries[0][1] };
  }, [transactions, currentMonthKey]);

  const nearestGoal = useMemo(() => {
    const inProgress = goals.filter(
      (g) => Number(g.saved_amount || 0) < g.target_amount,
    );
    if (inProgress.length === 0) return null;
    return inProgress.reduce((best, g) => {
      const pct = Number(g.saved_amount || 0) / g.target_amount;
      const bestPct = best
        ? Number(best.saved_amount || 0) / best.target_amount
        : -1;
      return pct > bestPct ? g : best;
    }, null);
  }, [goals]);

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

      <div className="relative max-w-md sm:max-w-xl lg:max-w-5xl mx-auto px-4 sm:px-6 pt-3 sm:pt-5 pb-32 lg:pb-16">
        <div className="flex items-center justify-end mb-2.5 sm:mb-4">
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
              {/* Greeting Hero — sengaja beda gaya dari hero saldo di
                  Saldoku.jsx: sapaan personal jadi headline, saldo
                  ditaruh sebagai info sekunder di bawahnya (bukan
                  angka gede jadi centerpiece kayak di Saldoku), warna
                  gradient beda (mint→lavender vs lavender→sky). */}
              <div
                className="rounded-[28px] p-5 sm:p-6 relative overflow-hidden mb-4"
                style={{
                  background: `linear-gradient(135deg, ${C.mintDeep}, ${C.lavender})`,
                  boxShadow: "0 24px 48px -20px rgba(70,63,92,0.45)",
                }}>
                <div
                  className="absolute -top-12 -right-8 w-36 h-36 rounded-full"
                  style={{ background: "rgba(255,255,255,0.12)" }}
                />
                <div
                  className="absolute -bottom-16 -left-10 w-40 h-40 rounded-full"
                  style={{ background: "rgba(255,255,255,0.08)" }}
                />
                <div className="relative z-10">
                  <p
                    className="text-[10.5px] uppercase tracking-[0.2em] font-bold"
                    style={{ color: "rgba(255,255,255,0.85)" }}>
                    {greeting}
                  </p>
                  <h2
                    style={{
                      fontFamily: "'Fraunces', serif",
                      color: "#FFFFFF",
                    }}
                    className="text-[20px] sm:text-[23px] font-semibold mt-0.5 leading-tight">
                    Halo, {displayName} 👋
                  </h2>

                  <div className="flex items-end justify-between gap-3 mt-4 flex-wrap">
                    <div>
                      <p
                        className="text-[10px] uppercase tracking-wide font-semibold"
                        style={{ color: "rgba(255,255,255,0.85)" }}>
                        Saldo Sekarang
                      </p>
                      <p
                        style={{
                          fontFamily: "'Inter', serif",
                          color: "#FFFFFF",
                        }}
                        className="text-[24px] sm:text-[27px] font-semibold leading-none mt-1">
                        {rupiah(saldo)}
                      </p>
                    </div>
                    <span
                      className="px-3 py-1.5 rounded-full text-[10.5px] font-bold flex-shrink-0"
                      style={{
                        background:
                          saldoStatus.key === "empty"
                            ? "rgba(217,96,122,0.4)"
                            : saldoStatus.key === "low"
                              ? "rgba(246,196,83,0.35)"
                              : "rgba(255,255,255,0.22)",
                        color: "#FFFFFF",
                        border:
                          saldoStatus.key === "empty"
                            ? "1px solid rgba(217,96,122,0.65)"
                            : saldoStatus.key === "low"
                              ? "1px solid rgba(246,196,83,0.6)"
                              : "1px solid rgba(255,255,255,0.4)",
                      }}>
                      {saldoStatus.icon} {saldoStatus.shortLabel}
                    </span>
                  </div>
                </div>
              </div>

              {/* Quick Action Tiles — Home jadi "launcher" ke fitur
                  utama, beda konsep dari Saldoku yang isinya daftar
                  transaksi & tools export. */}
              <div className="grid grid-cols-4 gap-2.5 mb-4">
                <QuickAction
                  icon="✏️"
                  label="Catat"
                  bg="#3F9E7C1A"
                  color={C.mintDeep}
                  onClick={() => {
                    setEditingTx(null);
                    setShowForm(true);
                  }}
                />
                <QuickAction
                  icon="🎯"
                  label="Target"
                  bg="#8B72C41A"
                  color={C.lavender}
                  onClick={() => setActiveTab("nabung")}
                />
                <QuickAction
                  icon="📒"
                  label="Riwayat"
                  bg="#3E7CB81A"
                  color={C.skyDeep}
                  onClick={() => setActiveTab("saldoku")}
                />
                <QuickAction
                  icon="🔒"
                  label="Akun"
                  bg="#D9607A1A"
                  color={C.roseDeep}
                  onClick={() => setActiveTab("akun")}
                />
              </div>

              {/* Insight card — 1 ringkasan kecil (kategori boros
                  bulan ini / progress goal terdekat), gantiin posisi
                  list transaksi panjang yang kembar sama Saldoku. */}
              {(monthlyTopCategory || nearestGoal) && (
                <Card className="mb-4" accent={C.amber}>
                  <div className="flex items-center justify-between mb-3">
                    <h3
                      className="font-semibold text-[12px] sm:text-[13px] tracking-[0.08em] uppercase"
                      style={{ color: C.amberDeep }}>
                      Insight Buat Kamu
                    </h3>
                    <span className="text-[18px]">💡</span>
                  </div>

                  {monthlyTopCategory && (
                    <div className="flex items-center gap-3 mb-3">
                      <div
                        className="w-10 h-10 rounded-2xl flex items-center justify-center text-[18px] flex-shrink-0"
                        style={{
                          background: categoryMeta(monthlyTopCategory.category)
                            .tint,
                        }}>
                        {categoryMeta(monthlyTopCategory.category).icon}
                      </div>
                      <div className="min-w-0">
                        <p
                          className="text-[12.5px] font-medium"
                          style={{ color: C.ink }}>
                          Pengeluaran terbesar bulan ini
                        </p>
                        <p
                          className="text-[12px]"
                          style={{ color: C.inkFaint }}>
                          {categoryLabel(monthlyTopCategory.category)} ·{" "}
                          <span
                            className="font-semibold"
                            style={{ color: C.roseDeep }}>
                            {rupiah(monthlyTopCategory.amount)}
                          </span>
                        </p>
                      </div>
                    </div>
                  )}

                  {nearestGoal && (
                    <div
                      className={monthlyTopCategory ? "pt-3 border-t" : ""}
                      style={{ borderColor: "#463F5C10" }}>
                      <div className="flex items-center justify-between text-[12.5px] mb-1.5">
                        <span
                          className="font-medium truncate"
                          style={{ color: C.ink }}>
                          🎯 {nearestGoal.title}
                        </span>
                        <span style={{ color: C.inkFaint }}>
                          {Math.round(
                            (Number(nearestGoal.saved_amount || 0) /
                              nearestGoal.target_amount) *
                              100,
                          )}
                          %
                        </span>
                      </div>
                      <div
                        className="h-2 rounded-full overflow-hidden"
                        style={{ background: "#463F5C14" }}>
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${Math.min(
                              100,
                              Math.round(
                                (Number(nearestGoal.saved_amount || 0) /
                                  nearestGoal.target_amount) *
                                  100,
                              ),
                            )}%`,
                            background: `linear-gradient(135deg, ${C.lavender}, ${C.skyDeep})`,
                          }}
                        />
                      </div>
                    </div>
                  )}
                </Card>
              )}

              {/* Teaser transaksi — cuma 3 item ringkas biar gak
                  dobel sama daftar lengkap di Saldoku, dengan link
                  pintas ke sana. */}
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
                    {recentTransactions.slice(0, 3).map((t) => {
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
            saldoStatus={saldoStatus}
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

      {/* Reminder "belum catat hari ini" — sekarang tampil sebagai
          pop-up modal (bukan banner nempel di hero), biar lebih
          nonjol & gak kelewat kayak banner biasa. */}
      {showReminder && (
        <div
          className="fixed inset-0 flex items-center justify-center z-50 px-4"
          style={{
            background: "rgba(70,63,92,0.45)",
            backdropFilter: "blur(2px)",
          }}
          onClick={() => setReminderDismissed(true)}>
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-[340px] rounded-[32px] p-7 text-center"
            style={{
              background: "#FFFFFF",
              boxShadow: "0 30px 60px -20px rgba(70,63,92,0.35)",
            }}>
            <div
              className="w-16 h-16 mx-auto rounded-full flex items-center justify-center text-[30px] mb-4"
              style={{ background: "#F6C4531F" }}>
              👀
            </div>
            <h3
              style={{ fontFamily: "'Fraunces', serif", color: C.ink }}
              className="text-[19px] sm:text-[20px] font-semibold mb-2 leading-snug">
              Belum Ada Catatan Hari Ini
            </h3>
            <p className="text-[13px] mb-6" style={{ color: C.inkFaint }}>
              Yuk catat pemasukan atau pengeluaranmu biar gak lupa.
            </p>
            <button
              onClick={() => {
                setReminderDismissed(true);
                setEditingTx(null);
                setShowForm(true);
              }}
              className="w-full py-3.5 rounded-2xl font-bold text-[14px] mb-2"
              style={{
                background: `linear-gradient(135deg, #D89B2E, ${C.amber})`,
                color: "#FFFFFF",
                boxShadow: "0 14px 28px -14px rgba(181,121,10,0.55)",
              }}>
              Siap, Dicatat Sekarang!
            </button>
            <button
              onClick={() => setReminderDismissed(true)}
              className="w-full py-2.5 text-[12.5px] font-semibold"
              style={{ color: C.inkFaint }}>
              Nanti Aja
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
