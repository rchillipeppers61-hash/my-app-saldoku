import ExcelJS from "exceljs";
import { useMemo, useState } from "react";
import { C } from "../components/theme";
import Card from "../components/Card";
import {
  rupiah,
  todayISO,
  formatDay,
  categoryLabel,
  categoryMeta,
  monthLabel,
} from "../lib/shared";

// Tab "Saldoku" — buku kerja: catatan transaksi lengkap + export.
// Modal tambah/edit transaksi (TransactionForm) dipegang bareng sama
// tab Homepage, jadi state buka/tutupnya dinaikin ke HomePage.jsx dan
// dikirim ke sini lewat onOpenForm/onEditTransaction. Filter periode,
// breakdown kategori, log aktivitas, & export Excel tetep di sini
// karena emang cuma dipakai di tab ini — sama pola kayak Nabung.jsx.
export default function Saldoku({
  loading,
  transactions,
  saldo,
  totalIn,
  totalOut,
  isLow,
  avgOutPerDay,
  logs,
  onOpenForm,
  onEditTransaction,
}) {
  const [period, setPeriod] = useState("week");

  const [showLogPanel, setShowLogPanel] = useState(false);

  const [showExportModal, setShowExportModal] = useState(false);
  const [exportEmptyMonth, setExportEmptyMonth] = useState(null);
  const [downloadToast, setDownloadToast] = useState("");

  const currentMonthKey = todayISO().slice(0, 7);

  const availableMonths = useMemo(() => {
    const set = new Set(transactions.map((t) => t.date.slice(0, 7)));
    set.add(currentMonthKey);
    return Array.from(set).sort((a, b) => (a < b ? 1 : -1));
  }, [transactions, currentMonthKey]);

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

  const categoryRows = useMemo(() => {
    const monthTx = transactions.filter(
      (t) => t.type === "out" && t.date.slice(0, 7) === currentMonthKey,
    );
    const byCategory = {};
    monthTx.forEach((t) => {
      byCategory[t.category] = (byCategory[t.category] || 0) + Number(t.amount);
    });
    const total = Object.values(byCategory).reduce((s, v) => s + v, 0);
    return Object.entries(byCategory)
      .map(([cat, amt]) => ({
        cat,
        amt,
        pct: total > 0 ? (amt / total) * 100 : 0,
      }))
      .sort((a, b) => b.amt - a.amt);
  }, [transactions, currentMonthKey]);

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
    const month = targetMonth || currentMonthKey;
    const rows = transactions
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

    const totalInMonth = rows
      .filter((t) => t.type === "in")
      .reduce((s, t) => s + Number(t.amount), 0);
    const totalOutMonth = rows
      .filter((t) => t.type === "out")
      .reduce((s, t) => s + Number(t.amount), 0);

    const firstTotalRowNumber = ws.lastRow.number + 1;
    [
      ["Total Masuk", totalInMonth],
      ["Total Keluar", totalOutMonth],
      ["Selisih", totalInMonth - totalOutMonth],
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
    a.download = `riwayat-wallet-${month}.xlsx`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    return true;
  }

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
    <>
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

          <Card
            title="Pengeluaran per Kategori"
            sub="Bulan ini"
            accent={C.lavender}>
            {categoryRows.length === 0 ? (
              <p className="text-[12.5px]" style={{ color: C.inkFaint }}>
                Belum ada pengeluaran tercatat.
              </p>
            ) : (
              <div className="space-y-3">
                {categoryRows.map((row) => {
                  const meta = categoryMeta(row.cat);
                  return (
                    <div key={row.cat}>
                      <div className="flex items-center justify-between text-[12.5px] mb-1">
                        <span
                          className="flex items-center gap-2"
                          style={{ color: C.ink }}>
                          <span
                            className="w-6 h-6 rounded-full flex items-center justify-center text-[12px] flex-shrink-0"
                            style={{ background: meta.tint }}>
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

          <button
            onClick={onOpenForm}
            className="w-full py-3.5 sm:py-4 rounded-2xl font-bold text-[14px] sm:text-[15px] items-center justify-center gap-2 hidden lg:flex"
            style={{
              background: `linear-gradient(135deg, ${C.mintDeep}, ${C.mint})`,
              color: "#FFFFFF",
              boxShadow: "0 14px 28px -14px rgba(63,158,124,0.6)",
            }}>
            <span className="text-[18px] leading-none">+</span> Catat Transaksi
          </button>
        </div>

        <div className="mt-4 lg:mt-0 lg:flex lg:flex-col lg:h-full">
          <Card className="lg:flex lg:flex-col lg:h-full">
            <div className="flex items-start justify-between gap-2 mb-2 flex-wrap">
              <div className="min-w-0">
                <h3
                  className="font-semibold text-[12px] sm:text-[13px] tracking-[0.08em] uppercase"
                  style={{ color: C.lavender }}>
                  Catatan Transaksi
                </h3>
                <p className="text-[12px] mt-0.5" style={{ color: C.inkFaint }}>
                  {period === "week" ? "7 hari terakhir" : monthLabel(period)}
                </p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <div className="relative">
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
                <button
                  onClick={() => {
                    setExportEmptyMonth(null);
                    setShowExportModal(true);
                  }}
                  className="px-3 py-2 rounded-full text-[11px] sm:text-[12px] font-semibold whitespace-nowrap"
                  style={{
                    background: `linear-gradient(135deg, ${C.mintDeep}, ${C.mint})`,
                    color: "#FFFFFF",
                  }}>
                  Export
                </button>
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
                            : categoryMeta(t.category);
                        return (
                          <button
                            key={t.id}
                            onClick={() => onEditTransaction(t)}
                            className="w-full flex items-center justify-between gap-2 py-1.5 px-1.5 -mx-1.5 rounded-xl text-left transition-colors hover:bg-[#463F5C08] active:bg-[#463F5C10]">
                            <div className="flex items-center gap-2.5 sm:gap-3 min-w-0 flex-1">
                              <div
                                className="w-9 h-9 sm:w-10 sm:h-10 rounded-2xl flex items-center justify-center text-[16px] sm:text-[18px] flex-shrink-0"
                                style={{
                                  background: meta.bg || meta.tint,
                                }}>
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
                                  color: t.type === "in" ? C.mintDeep : C.ink,
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

          {logs.length > 0 && (
            <Card className="mt-4">
              <button
                onClick={() => setShowLogPanel((v) => !v)}
                className="w-full flex items-center justify-between">
                <h3
                  className="font-semibold text-[12px] sm:text-[13px] tracking-[0.08em] uppercase"
                  style={{ color: C.lavender }}>
                  Log Aktivitas
                </h3>
                <span
                  className="text-[11px] font-bold px-2.5 py-1 rounded-full"
                  style={{ background: "#8B72C41A", color: C.lavender }}>
                  {showLogPanel ? "Tutup" : "Lihat"}
                </span>
              </button>
              {showLogPanel && (
                <div className="mt-3 space-y-2.5 max-h-72 overflow-y-auto pr-1">
                  {logs.map((log) => {
                    const changes = fieldChangeSummary(
                      log.old_data,
                      log.new_data,
                    );
                    return (
                      <div
                        key={log.id}
                        className="text-[11.5px] pb-2.5 border-b last:border-0"
                        style={{ borderColor: "#463F5C10" }}>
                        <p
                          className="font-semibold mb-1"
                          style={{ color: C.inkSoft }}>
                          {log.action === "delete" ? "🗑️ Dihapus" : "✏️ Diedit"}{" "}
                          ·{" "}
                          {new Date(log.changed_at).toLocaleString("id-ID", {
                            day: "numeric",
                            month: "short",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </p>
                        {log.action === "delete" ? (
                          <p style={{ color: C.inkFaint }}>
                            Nilai terakhir: {rupiah(log.old_data.amount)} —{" "}
                            {log.old_data.note || "-"}
                          </p>
                        ) : changes && changes.length > 0 ? (
                          <ul className="space-y-0.5">
                            {changes.map((c, i) => (
                              <li key={i} style={{ color: C.inkFaint }}>
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
            </Card>
          )}
        </div>
      </div>

      {/* FAB mobile — cuma kerender pas tab Saldoku aktif, karena
          komponen ini sendiri cuma dipasang HomePage waktu itu. */}
      <button
        onClick={onOpenForm}
        className="fixed bottom-24 right-5 sm:right-8 lg:hidden w-14 h-14 sm:w-16 sm:h-16 rounded-full flex items-center justify-center text-[26px] sm:text-[30px] font-light z-30"
        style={{
          background: `linear-gradient(135deg, ${C.mintDeep}, ${C.mint})`,
          color: "#FFFFFF",
          boxShadow: "0 14px 30px -10px rgba(63,158,124,0.6)",
        }}>
        +
      </button>

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
              {availableMonths.map((m) => (
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
    </>
  );
}
