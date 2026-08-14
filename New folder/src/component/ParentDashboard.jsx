import ExcelJS from "exceljs";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "../supabaseClient";
import { C, FONT_IMPORT } from "./theme";
import Card from "./Card";
import ChangePasswordModal from "./ChangePasswordModal";
import ResetChildPasswordModal from "./ResetChildPasswordModal";
import SavingsGoalItem from "./SavingsGoalItem";
import {
  CATEGORIES,
  categoryLabel,
  rupiah,
  formatDay,
  LOW_BALANCE_LIMIT,
  capitalize,
  monthLabel,
  todayISO,
} from "../lib/shared";

const CATEGORY_META = {
  makan: { icon: "🍜", bg: "#8FD8BE2A", solid: C.mintDeep },
  jajan: { icon: "🍿", bg: "#F4A6B72A", solid: C.roseDeep },
  transport: { icon: "🚌", bg: "#9FCBF02A", solid: C.skyDeep },
  kuliah: { icon: "📚", bg: "#8B72C42A", solid: C.lavender },
  pribadi: { icon: "🧴", bg: "#F6C4532A", solid: C.amberDeep },
  lainnya: { icon: "✨", bg: "#463F5C14", solid: C.inkFaint },
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

export default function ParentDashboard({ user, onLogout }) {
  const [childName, setChildName] = useState("");
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showLowBalance, setShowLowBalance] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(null);
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportEmptyMonth, setExportEmptyMonth] = useState(null);
  const [downloadToast, setDownloadToast] = useState("");
  const [showAccountMenu, setShowAccountMenu] = useState(false);
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [showResetChildPassword, setShowResetChildPassword] = useState(false);
  const [logs, setLogs] = useState([]);
  const [goals, setGoals] = useState([]);
  const [expandedLogTx, setExpandedLogTx] = useState(null);
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

  useEffect(() => {
    loadData();
    if (!user.linked_child_id) {
      loadActiveInviteCode();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  async function loadData() {
    setLoading(true);

    if (!user.linked_child_id) {
      setLoading(false);
      return;
    }

    const { data: childData } = await supabase
      .from("users")
      .select("nama_lengkap")
      .eq("id", user.linked_child_id)
      .single();

    if (childData) setChildName(childData.nama_lengkap);

    const { data: txData } = await supabase
      .from("transactions")
      .select("*")
      .eq("owner_id", user.linked_child_id)
      .order("date", { ascending: false })
      .order("created_at", { ascending: false });

    setTransactions(txData || []);

    const { data: logData } = await supabase
      .from("transaction_logs")
      .select("*")
      .eq("owner_id", user.linked_child_id)
      .order("changed_at", { ascending: false });

    setLogs(logData || []);

    const { data: goalData } = await supabase
      .from("savings_goals")
      .select("*")
      .eq("owner_id", user.linked_child_id)
      .order("created_at", { ascending: true });

    setGoals(goalData || []);

    setLoading(false);
  }

  const activeTransactions = useMemo(
    () => transactions.filter((t) => !t.deleted_at),
    [transactions],
  );

  const summary = useMemo(() => {
    const totalIn = activeTransactions
      .filter((t) => t.type === "in")
      .reduce((s, t) => s + Number(t.amount), 0);
    const totalOut = activeTransactions
      .filter((t) => t.type === "out")
      .reduce((s, t) => s + Number(t.amount), 0);
    const balance = totalIn - totalOut;

    const byCategory = {};
    activeTransactions
      .filter((t) => t.type === "out")
      .forEach((t) => {
        byCategory[t.category] =
          (byCategory[t.category] || 0) + Number(t.amount);
      });

    const categoryRows = Object.entries(byCategory)
      .map(([cat, amt]) => ({
        cat,
        amt,
        pct: totalOut > 0 ? (amt / totalOut) * 100 : 0,
      }))
      .sort((a, b) => b.amt - a.amt);

    return { totalIn, totalOut, balance, categoryRows };
  }, [activeTransactions]);

  const months = useMemo(() => {
    const set = new Set(transactions.map((t) => t.date.slice(0, 7)));
    set.add(todayISO().slice(0, 7));
    return Array.from(set).sort((a, b) => (a < b ? 1 : -1));
  }, [transactions]);

  useEffect(() => {
    if (!selectedMonth && months.length > 0) {
      setSelectedMonth(months[0]);
    }
  }, [months, selectedMonth]);

  const monthTransactions = useMemo(
    () => transactions.filter((t) => t.date.slice(0, 7) === selectedMonth),
    [transactions, selectedMonth],
  );

  const grouped = useMemo(() => {
    const map = {};
    monthTransactions.forEach((t) => {
      if (!map[t.date]) map[t.date] = [];
      map[t.date].push(t);
    });
    return Object.entries(map).sort((a, b) => (a[0] < b[0] ? 1 : -1));
  }, [monthTransactions]);

  const logsByTransaction = useMemo(() => {
    const map = {};
    logs.forEach((l) => {
      (map[l.transaction_id] = map[l.transaction_id] || []).push(l);
    });
    return map;
  }, [logs]);

  function fieldChangeSummary(oldData, newData) {
    if (!newData) return null;
    const fieldLabel = {
      amount: "Jumlah",
      note: "Catatan",
      category: "Kategori",
      type: "Tipe",
    };
    const changed = [];
    Object.keys(fieldLabel).forEach((key) => {
      if (String(oldData?.[key]) !== String(newData?.[key])) {
        changed.push({
          field: fieldLabel[key],
          from: oldData?.[key],
          to: newData?.[key],
        });
      }
    });
    return changed;
  }

  async function exportToExcel(targetMonth) {
    const month = targetMonth || selectedMonth;
    const rows = activeTransactions
      .filter((t) => t.date.slice(0, 7) === month)
      .slice()
      .sort((a, b) => (a.date < b.date ? -1 : 1));

    if (rows.length === 0) {
      setExportEmptyMonth(month);
      return false;
    }

    const wb = new ExcelJS.Workbook();
    wb.creator = "My Wallet";
    wb.created = new Date();

    const ws = wb.addWorksheet(monthLabel(month));
    ws.columns = [
      { key: "tanggal", width: 14 },
      { key: "tipe", width: 10 },
      { key: "kategori", width: 22 },
      { key: "catatan", width: 30 },
      { key: "jumlah", width: 16 },
    ];

    const titleRow = ws.addRow(["DATA PENGELUARAN UANG"]);
    ws.mergeCells(`A${titleRow.number}:E${titleRow.number}`);
    titleRow.font = { bold: true, size: 14, color: { argb: "FF463F5C" } };
    titleRow.height = 22;

    const subRow = ws.addRow([`Bulan : ${monthLabel(month)}`]);
    ws.mergeCells(`A${subRow.number}:E${subRow.number}`);
    subRow.font = { italic: true, color: { argb: "FF8B72C4" } };

    ws.addRow([]);
    ws.addRow([]);

    const headerRow = ws.addRow([
      "Tanggal",
      "Tipe",
      "Kategori",
      "Catatan",
      "Jumlah",
    ]);
    headerRow.height = 22;
    headerRow.eachCell((cell) => {
      cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FF8B72C4" },
      };
      cell.alignment = { vertical: "middle", horizontal: "center" };
    });

    rows.forEach((t) => {
      const row = ws.addRow([
        t.date,
        t.type === "in" ? "Masuk" : "Keluar",
        t.type === "out" ? categoryLabel(t.category) : "-",
        t.note || "",
        Number(t.amount),
      ]);
      row.getCell(5).numFmt = '"Rp"#,##0';
      row.getCell(2).font = {
        bold: true,
        color: { argb: t.type === "in" ? "FF3F9E7C" : "FFD9607A" },
      };
    });

    const totalIn = rows
      .filter((t) => t.type === "in")
      .reduce((s, t) => s + Number(t.amount), 0);
    const totalOut = rows
      .filter((t) => t.type === "out")
      .reduce((s, t) => s + Number(t.amount), 0);

    const firstTotalRowNumber = ws.lastRow.number + 1;
    [
      ["Total Masuk", totalIn],
      ["Total Keluar", totalOut],
      ["Selisih", totalIn - totalOut],
    ].forEach(([label, value]) => {
      const row = ws.addRow(["", "", label, "", value]);
      row.font = { bold: true };
      row.getCell(5).numFmt = '"Rp"#,##0';
    });

    const thin = { style: "thin", color: { argb: "FFCBC3E8" } };
    for (let r = headerRow.number; r < firstTotalRowNumber; r++) {
      const row = ws.getRow(r);
      for (let c = 1; c <= 5; c++) {
        row.getCell(c).border = {
          top: thin,
          bottom: thin,
          left: thin,
          right: thin,
        };
      }
    }
    for (let r = firstTotalRowNumber; r <= ws.lastRow.number; r++) {
      ws.getRow(r).getCell(5).border = { top: thin, bottom: thin };
    }

    const buffer = await wb.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `riwayat-${(childName || "anak").toLowerCase()}-${month}.xlsx`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    return true;
  }

  useEffect(() => {
    if (!loading && summary.balance < LOW_BALANCE_LIMIT) {
      setShowLowBalance(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, summary.balance]);

  if (loading) {
    return (
      <div
        className="min-h-screen w-full flex items-center justify-center"
        style={{ background: C.bgParent }}>
        <p style={{ color: C.inkFaint }}>Memuat...</p>
      </div>
    );
  }

  if (!user.linked_child_id) {
    return (
      <div
        className="min-h-screen w-full flex items-center justify-center px-4"
        style={{ background: C.bgParent }}>
        <style>{FONT_IMPORT}</style>
        <Card>
          <p
            className="text-[11px] tracking-[0.2em] uppercase font-semibold mb-1"
            style={{ color: C.lavender }}>
            Belum Terhubung
          </p>
          <h2
            style={{ fontFamily: "'Fraunces', serif", color: C.ink }}
            className="text-[19px] font-semibold mb-2">
            Sambungkan ke akun anak
          </h2>
          <p className="text-[13px] mb-5" style={{ color: C.inkFaint }}>
            Akun ini belum terhubung ke akun anak. Buat kode undangan di bawah,
            terus kasih kodenya ke anak kamu supaya dia bisa masukin pas
            login/daftar.
          </p>

          {inviteCode ? (
            <>
              <div
                className="text-center text-[28px] font-semibold tracking-[0.3em] py-4 rounded-2xl mb-3"
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
            onClick={onLogout}
            className="w-full mt-2.5 px-4 py-2 rounded-2xl text-sm font-semibold"
            style={{ background: "#463F5C0f", color: C.ink }}>
            Keluar
          </button>
        </Card>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen w-full px-4 py-6 sm:py-10 relative overflow-hidden"
      style={{ background: C.bgParent, fontFamily: "'Inter', sans-serif" }}>
      <style>{FONT_IMPORT}</style>
      <div className="fixed inset-0 pointer-events-none overflow-hidden hidden sm:block">
        <div
          className="absolute -top-24 -right-16 w-72 h-72 rounded-full opacity-40 blur-3xl"
          style={{ background: C.sky }}
        />
        <div
          className="absolute top-1/3 left-1/2 w-64 h-64 rounded-full opacity-25 blur-3xl"
          style={{ background: C.rose }}
        />
        <div
          className="absolute bottom-0 -left-24 w-72 h-72 rounded-full opacity-30 blur-3xl"
          style={{ background: C.mint }}
        />
      </div>
      {downloadToast && (
        <div
          className="fixed top-5 left-1/2 -translate-x-1/2 z-[60] flex items-center gap-2 px-4 py-3 rounded-2xl text-[13px] font-semibold"
          style={{
            background: "#FFFFFF",
            color: C.mintDeep,
            boxShadow: "0 14px 32px -12px rgba(70,63,92,0.35)",
            border: "1.5px solid #3F9E7C33",
          }}>
          {downloadToast}
        </div>
      )}

      <div className="max-w-2xl mx-auto relative">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3 min-w-0">
            <div
              className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl flex items-center justify-center font-semibold text-[14px] sm:text-[15px] flex-shrink-0"
              style={{
                background: `linear-gradient(135deg, ${C.lavender}, ${C.skyDeep})`,
                color: "#FFFFFF",
                fontFamily: "'Fraunces', serif",
              }}>
              {getInitials(childName)}
            </div>
            <div className="min-w-0">
              <p
                className="text-[12px] tracking-[0.2em] uppercase font-semibold"
                style={{ color: C.lavender }}>
                Pantauan Orang Tua
              </p>
              <h1
                style={{ fontFamily: "'Fraunces', serif", color: C.ink }}
                className="text-[19px] font-semibold truncate">
                Keuangan {childName ? capitalize(childName) : "Anak"}
              </h1>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={() => setShowAccountMenu(true)}
              aria-label="Akun"
              title="Ganti Password"
              className="w-9 h-9 flex items-center justify-center rounded-2xl text-[15px]"
              style={{ background: "#463F5C0f", color: C.ink }}>
              🔒
            </button>
            <button
              onClick={onLogout}
              className="text-[13px] font-semibold px-3.5 py-2 rounded-2xl"
              style={{ background: C.roseDeep, color: "#FFFFFF" }}>
              Keluar
            </button>
          </div>
        </div>

        {showLowBalance && (
          <div
            className="fixed inset-0 flex items-center justify-center z-50 px-4"
            style={{ background: "rgba(70,63,92,0.4)" }}
            onClick={() => setShowLowBalance(false)}>
            <div
              onClick={(e) => e.stopPropagation()}
              className="w-full sm:max-w-sm rounded-[28px] p-6 sm:p-7 text-center"
              style={{
                background: "#FFFFFF",
                border: `1.5px solid ${C.amber}`,
                boxShadow: "0 24px 56px -20px rgba(70,63,92,0.35)",
              }}>
              <div
                className="w-14 h-14 mx-auto rounded-full flex items-center justify-center text-[26px] font-bold mb-4"
                style={{ background: "#F6C4532e", color: C.amberDeep }}>
                !
              </div>
              <h3
                style={{ fontFamily: "'Fraunces', serif", color: C.ink }}
                className="text-[20px] font-semibold leading-snug">
                Saldo {capitalize(childName) || "anak"} tinggal{" "}
                {rupiah(summary.balance)}
              </h3>
              <p
                className="text-[13.5px] mt-2 leading-relaxed"
                style={{ color: C.inkSoft }}>
                Sudah di bawah batas {rupiah(LOW_BALANCE_LIMIT)}.
              </p>
              <p
                className="text-[17px] font-bold mt-1.5 leading-snug"
                style={{ color: C.ink }}>
                Saatnya kirim uang buat dia.
              </p>
              <button
                onClick={() => setShowLowBalance(false)}
                className="w-full mt-6 py-3.5 rounded-2xl font-semibold text-[14px]"
                style={{
                  background: `linear-gradient(135deg, ${C.amberDeep}, ${C.amber})`,
                  color: "#FFFFFF",
                }}>
                Siap, dicatat!
              </button>
            </div>
          </div>
        )}

        {showExportModal && (
          <div
            className="fixed inset-0 flex items-end sm:items-center justify-center z-50 px-4 pb-4 sm:pb-4"
            style={{ background: "rgba(70,63,92,0.4)" }}
            onClick={() => setShowExportModal(false)}>
            <div
              onClick={(e) => e.stopPropagation()}
              className="w-full sm:max-w-sm rounded-[28px] p-6 sm:p-7"
              style={{
                background: "#FFFFFF",
                boxShadow: "0 24px 56px -20px rgba(70,63,92,0.35)",
              }}>
              <h3
                style={{ fontFamily: "'Fraunces', serif", color: C.ink }}
                className="text-[18px] font-semibold mb-1">
                Export bulan mana?
              </h3>
              <p className="text-[12.5px] mb-4" style={{ color: C.inkFaint }}>
                Data akan diunduh sebagai file Excel (.xlsx)
              </p>
              <div className="space-y-1.5 max-h-72 overflow-y-auto -mx-1 px-1">
                {months.map((m) => (
                  <div key={m}>
                    <button
                      onClick={async () => {
                        const ok = await exportToExcel(m);
                        if (ok !== false) {
                          setShowExportModal(false);
                          setDownloadToast(
                            `File ${monthLabel(m)} berhasil diunduh ✓`,
                          );
                          setTimeout(() => setDownloadToast(""), 3000);
                        }
                      }}
                      className="w-full flex items-center justify-between px-4 py-3 rounded-2xl text-[13.5px] font-medium"
                      style={{ background: "#463F5C0a", color: C.ink }}>
                      {monthLabel(m)}
                      <span
                        className="text-[11.5px] font-bold px-3 py-1.5 rounded-full flex-shrink-0"
                        style={{ background: "#3F9E7C1F", color: C.mintDeep }}>
                        Download
                      </span>
                    </button>
                    {exportEmptyMonth === m && (
                      <p
                        className="text-[12px] mt-1 mb-1 px-1"
                        style={{ color: C.roseDeep }}>
                        Belum ada transaksi di bulan ini.
                      </p>
                    )}
                  </div>
                ))}
              </div>
              <button
                onClick={() => setShowExportModal(false)}
                className="w-full mt-4 py-3 rounded-2xl text-[13px] font-semibold"
                style={{ background: "#463F5C0f", color: C.ink }}>
                Batal
              </button>
            </div>
          </div>
        )}

        <div
          className="rounded-[32px] p-6 sm:p-8 relative overflow-hidden mb-4"
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
              Saldo {capitalize(childName) || "Anak"} Sekarang
            </p>
            <p
              style={{ fontFamily: "'Fraunces', serif", color: "#FFFFFF" }}
              className="mt-1 text-[34px] sm:text-[42px] font-semibold leading-none">
              {rupiah(summary.balance)}
            </p>
            <span
              className="inline-flex items-center gap-1.5 mt-3 sm:mt-4 px-3 py-1.5 rounded-full text-[11px] sm:text-[12px] font-semibold"
              style={{
                background: "rgba(255,255,255,0.18)",
                color: "#FFFFFF",
                border: "1px solid rgba(255,255,255,0.3)",
              }}>
              {summary.balance < LOW_BALANCE_LIMIT
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
                  {rupiah(summary.totalIn)}
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
                  {rupiah(summary.totalOut)}
                </p>
              </div>
            </div>
          </div>
        </div>

        {goals.length > 0 && (
          <Card title="Target Nabung" accent={C.lavender} className="mb-4">
            <div className="space-y-4">
              {goals.map((g) => (
                <SavingsGoalItem key={g.id} goal={g} />
              ))}
            </div>
          </Card>
        )}

        <Card
          title="Pengeluaran per Kategori"
          accent={C.lavender}
          className="mb-4">
          {summary.categoryRows.length === 0 ? (
            <p className="text-[13px]" style={{ color: C.inkFaint }}>
              Belum ada pengeluaran tercatat.
            </p>
          ) : (
            <div className="space-y-3">
              {summary.categoryRows.map((row) => {
                const meta = getCategoryMeta(row.cat);
                return (
                  <div key={row.cat}>
                    <div className="flex items-center justify-between text-[13px] mb-1">
                      <span
                        className="flex items-center gap-2"
                        style={{ color: C.ink }}>
                        <span
                          className="w-6 h-6 rounded-full flex items-center justify-center text-[12px] flex-shrink-0"
                          style={{ background: meta.bg }}>
                          {meta.icon}
                        </span>
                        {categoryLabel(row.cat)}
                      </span>
                      <span style={{ color: C.inkFaint }}>
                        {rupiah(row.amt)} ({row.pct.toFixed(0)}%)
                      </span>
                    </div>
                    <div
                      className="h-2 rounded-full overflow-hidden"
                      style={{ background: "#463F5C14" }}>
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${row.pct}%`,
                          background: meta.solid,
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        <Card
          title="Riwayat Transaksi"
          sub="Detail lengkap, tidak dapat diedit dari sini">
          {months.length > 0 && (
            <div className="flex items-center gap-2 mb-4">
              <div className="flex gap-1.5 overflow-x-auto flex-1 pb-1">
                {months.map((m) => (
                  <button
                    key={m}
                    onClick={() => setSelectedMonth(m)}
                    className="flex-shrink-0 px-3.5 py-1.5 rounded-full text-[12px] font-semibold whitespace-nowrap transition-colors"
                    style={{
                      background:
                        m === selectedMonth ? C.lavender : "#463F5C0d",
                      color: m === selectedMonth ? "#FFFFFF" : C.inkSoft,
                    }}>
                    {monthLabel(m)}
                  </button>
                ))}
              </div>
              <button
                onClick={() => {
                  setExportEmptyMonth(null);
                  setShowExportModal(true);
                }}
                disabled={months.length === 0}
                className="flex-shrink-0 px-3.5 py-1.5 rounded-full text-[12px] font-semibold disabled:opacity-40"
                style={{
                  background: `linear-gradient(135deg, ${C.mintDeep}, ${C.mint})`,
                  color: "#FFFFFF",
                }}>
                Export Excel
              </button>
            </div>
          )}
          {grouped.length === 0 ? (
            <p className="text-[13px]" style={{ color: C.inkFaint }}>
              Belum ada transaksi{selectedMonth ? " di bulan ini" : ""}.
            </p>
          ) : (
            <div className="space-y-5">
              {grouped.map(([date, items]) => (
                <div key={date}>
                  <p
                    className="text-[12px] font-semibold mb-2"
                    style={{ color: C.inkFaint }}>
                    {formatDay(date)}
                  </p>
                  <div className="space-y-2">
                    {items.map((t) => {
                      const meta =
                        t.type === "in"
                          ? { icon: "💰", bg: "#3F9E7C22" }
                          : getCategoryMeta(t.category);
                      const isDeleted = Boolean(t.deleted_at);
                      const txLogs = logsByTransaction[t.id] || [];
                      const hasLogs = txLogs.length > 0;
                      const isExpanded = expandedLogTx === t.id;
                      return (
                        <div key={t.id}>
                          <div
                            className="flex items-center justify-between py-2 px-3 rounded-2xl gap-2"
                            style={{
                              background: isDeleted ? "#F4A6B714" : "#463F5C08",
                              opacity: isDeleted ? 0.75 : 1,
                            }}>
                            <div className="flex items-center gap-2.5 min-w-0 flex-1">
                              <div
                                className="w-9 h-9 rounded-2xl flex items-center justify-center text-[16px] flex-shrink-0"
                                style={{ background: meta.bg }}>
                                {isDeleted ? "🗑️" : meta.icon}
                              </div>
                              <div className="min-w-0">
                                <p
                                  className="text-[14px] font-medium truncate"
                                  style={{
                                    color: isDeleted ? C.inkFaint : C.ink,
                                    textDecoration: isDeleted
                                      ? "line-through"
                                      : "none",
                                  }}>
                                  {t.note || categoryLabel(t.category)}
                                </p>
                                <p
                                  className="text-[11px] flex items-center gap-1.5 flex-wrap"
                                  style={{ color: C.inkFaint }}>
                                  {t.type === "out"
                                    ? categoryLabel(t.category)
                                    : "Pemasukan"}
                                  {isDeleted && (
                                    <span
                                      className="font-semibold"
                                      style={{ color: C.roseDeep }}>
                                      · Dihapus anak
                                    </span>
                                  )}
                                  {!isDeleted && hasLogs && (
                                    <span
                                      className="font-semibold"
                                      style={{ color: C.amberDeep }}>
                                      · Pernah diedit
                                    </span>
                                  )}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2 flex-shrink-0">
                              <p
                                className="text-[14px] font-semibold"
                                style={{
                                  color: isDeleted
                                    ? C.inkFaint
                                    : t.type === "in"
                                      ? C.mintDeep
                                      : C.roseDeep,
                                  textDecoration: isDeleted
                                    ? "line-through"
                                    : "none",
                                }}>
                                {t.type === "in" ? "+" : "-"}
                                {rupiah(t.amount)}
                              </p>
                              {hasLogs && (
                                <button
                                  onClick={() =>
                                    setExpandedLogTx(isExpanded ? null : t.id)
                                  }
                                  className="text-[11px] font-semibold px-2 py-1 rounded-full flex-shrink-0"
                                  style={{
                                    background: "#8B72C41A",
                                    color: C.lavender,
                                  }}>
                                  {isExpanded ? "Tutup" : "Riwayat"}
                                </button>
                              )}
                            </div>
                          </div>

                          {isExpanded && hasLogs && (
                            <div
                              className="mt-1.5 ml-2 pl-3 py-2.5 space-y-2.5"
                              style={{ borderLeft: `2px solid #8B72C433` }}>
                              {txLogs.map((log) => {
                                const changes = fieldChangeSummary(
                                  log.old_data,
                                  log.new_data,
                                );
                                return (
                                  <div key={log.id} className="text-[11.5px]">
                                    <p
                                      className="font-semibold mb-1"
                                      style={{ color: C.inkSoft }}>
                                      {log.action === "delete"
                                        ? "🗑️ Dihapus"
                                        : "✏️ Diedit"}{" "}
                                      ·{" "}
                                      {new Date(log.changed_at).toLocaleString(
                                        "id-ID",
                                        {
                                          day: "numeric",
                                          month: "short",
                                          hour: "2-digit",
                                          minute: "2-digit",
                                        },
                                      )}
                                    </p>
                                    {log.action === "delete" ? (
                                      <p style={{ color: C.inkFaint }}>
                                        Nilai terakhir sebelum dihapus:{" "}
                                        {rupiah(log.old_data.amount)} —{" "}
                                        {log.old_data.note || "-"}
                                      </p>
                                    ) : changes && changes.length > 0 ? (
                                      <ul className="space-y-0.5">
                                        {changes.map((c, i) => (
                                          <li
                                            key={i}
                                            style={{ color: C.inkFaint }}>
                                            {c.field}:{" "}
                                            <span
                                              style={{
                                                textDecoration: "line-through",
                                              }}>
                                              {c.field === "Jumlah"
                                                ? rupiah(c.from)
                                                : c.from || "-"}
                                            </span>{" "}
                                            →{" "}
                                            <span style={{ color: C.ink }}>
                                              {c.field === "Jumlah"
                                                ? rupiah(c.to)
                                                : c.to || "-"}
                                            </span>
                                          </li>
                                        ))}
                                      </ul>
                                    ) : (
                                      <p style={{ color: C.inkFaint }}>
                                        Tidak ada perubahan nilai.
                                      </p>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {showAccountMenu && (
        <div
          className="fixed inset-0 flex items-end sm:items-center justify-center z-50 px-4 pb-4 sm:pb-4"
          style={{ background: "rgba(70,63,92,0.4)" }}
          onClick={() => setShowAccountMenu(false)}>
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full sm:max-w-sm rounded-[28px] p-6 sm:p-7"
            style={{
              background: "#FFFFFF",
              boxShadow: "0 24px 56px -20px rgba(70,63,92,0.35)",
            }}>
            <h3
              style={{ fontFamily: "'Fraunces', serif", color: C.ink }}
              className="text-[18px] font-semibold mb-4">
              Akun
            </h3>
            <div className="space-y-2">
              <button
                onClick={() => {
                  setShowAccountMenu(false);
                  setShowChangePassword(true);
                }}
                className="w-full text-left px-4 py-3 rounded-2xl text-[13.5px] font-medium"
                style={{ background: "#463F5C0a", color: C.ink }}>
                Ganti Password Saya
              </button>
              <button
                onClick={() => {
                  setShowAccountMenu(false);
                  setShowResetChildPassword(true);
                }}
                className="w-full text-left px-4 py-3 rounded-2xl text-[13.5px] font-medium"
                style={{ background: "#463F5C0a", color: C.ink }}>
                Ganti Password {childName ? capitalize(childName) : "Anak"}
              </button>
            </div>
            <button
              onClick={() => setShowAccountMenu(false)}
              className="w-full mt-4 py-3 rounded-2xl text-[13px] font-semibold"
              style={{ background: "#463F5C0f", color: C.ink }}>
              Tutup
            </button>
          </div>
        </div>
      )}

      {showChangePassword && (
        <ChangePasswordModal
          user={user}
          onClose={() => setShowChangePassword(false)}
        />
      )}

      {showResetChildPassword && (
        <ResetChildPasswordModal
          user={user}
          childName={childName}
          onClose={() => setShowResetChildPassword(false)}
        />
      )}
    </div>
  );
}
