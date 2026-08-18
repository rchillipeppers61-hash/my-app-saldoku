import ExcelJS from "exceljs";
import { useEffect, useMemo, useRef, useState } from "react";
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

// Format tanggal ringkas khusus buat kolom tabel (formatDay yang lama
// terlalu panjang buat cell tabel karena isinya nama hari lengkap).
function shortDate(d) {
  return new Date(d).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

// Preview tabel transaksi — dipisah jadi komponen sendiri karena
// dipakai khusus buat mode "Tabel" di daftar transaksi. Ini BUKAN
// hasil export, cuma preview cepat di layar (kolomnya emang senada
// sama isi file Excel biar orang gampang connect keduanya).
function TransactionsTable({ transactions, onEditTransaction }) {
  // Preview tabel cuma buat pengeluaran — pemasukan sengaja gak
  // ditampilin di sini sesuai permintaan, jadi difilter duluan sebelum
  // di-sort. Kolom "Tipe" juga dibuang karena semua baris pasti
  // "Keluar", jadi percuma ditampilin berulang.
  const sorted = useMemo(
    () =>
      transactions
        .filter((t) => t.type === "out")
        .sort((a, b) => (a.date < b.date ? 1 : -1)),
    [transactions],
  );

  if (sorted.length === 0) {
    return (
      <div className="py-10 sm:py-12 text-center">
        <div
          className="w-14 h-14 sm:w-16 sm:h-16 mx-auto rounded-full flex items-center justify-center text-[26px] sm:text-[28px] mb-3"
          style={{ background: "#8B72C41A" }}>
          🔍
        </div>
        <p
          className="text-[13.5px] sm:text-[14px] font-medium"
          style={{ color: C.ink }}>
          Tidak ada pengeluaran di periode ini
        </p>
        <p
          className="text-[12px] sm:text-[12.5px] mt-1"
          style={{ color: C.inkFaint }}>
          Coba pilih periode lain di dropdown atas.
        </p>
      </div>
    );
  }

  return (
    // overflow-x-auto sengaja dipakai di sini (bukan dihindari) karena
    // ini tabel data — di layar sempit lebih enak discroll horizontal
    // ketimbang kolom dipepetin sampai gak kebaca.
    <div
      className="overflow-x-auto -mx-1 px-1 rounded-2xl"
      style={{ border: "1px solid #463F5C14" }}>
      <table className="w-full border-collapse min-w-[480px]">
        <thead>
          <tr>
            {["Tanggal", "Kategori", "Catatan", "Jumlah"].map((h, i) => (
              <th
                key={h}
                className={`sticky top-0 z-10 text-[10.5px] sm:text-[11px] uppercase tracking-wide font-bold py-2.5 px-3 whitespace-nowrap ${
                  i === 3 ? "text-right" : "text-left"
                }`}
                style={{ background: "#8B72C41F", color: C.lavender }}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((t) => {
            const meta = categoryMeta(t.category);
            return (
              <tr
                key={t.id}
                onClick={() => onEditTransaction(t)}
                className="cursor-pointer transition-colors hover:bg-[#463F5C08] active:bg-[#463F5C10]"
                style={{ borderTop: "1px solid #463F5C12" }}>
                <td
                  className="py-2.5 sm:py-3 px-3 text-[12px] sm:text-[12.5px] whitespace-nowrap"
                  style={{ color: C.inkSoft }}>
                  {shortDate(t.date)}
                </td>
                <td
                  className="py-2.5 sm:py-3 px-3 text-[12px] sm:text-[12.5px] whitespace-nowrap"
                  style={{ color: C.ink }}>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="text-[13px] leading-none">
                      {meta.icon}
                    </span>
                    {categoryLabel(t.category)}
                  </span>
                </td>
                <td
                  className="py-2.5 sm:py-3 px-3 text-[12px] sm:text-[12.5px] max-w-[220px] truncate"
                  style={{ color: C.ink }}>
                  {t.note || "-"}
                </td>
                <td
                  className="py-2.5 sm:py-3 px-3 text-[12.5px] sm:text-[13px] font-bold text-right whitespace-nowrap"
                  style={{ color: C.ink }}>
                  -{rupiah(t.amount)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

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
  saldoStatus,
  avgOutPerDay,
  logs,
  onOpenForm,
  onEditTransaction,
}) {
  // Modal "Tabel Pengeluaran" — terpisah dari list Harian di bawah.
  // Punya tab Minggu/Bulan sendiri + dropdown periode sendiri, gak
  // nyampur sama filter list Harian (yang sekarang gak difilter sama
  // sekali, langsung tampil dikelompokkan per hari).
  const [showTableModal, setShowTableModal] = useState(false);
  const [tableMode, setTableMode] = useState("week"); // "week" | "month"
  const [tableWeekIndex, setTableWeekIndex] = useState(0);
  const [tableMonth, setTableMonth] = useState(null);

  const [showLogPanel, setShowLogPanel] = useState(false);

  const [showExportModal, setShowExportModal] = useState(false);
  const [exportEmptyMonth, setExportEmptyMonth] = useState(null);
  const [downloadToast, setDownloadToast] = useState("");

  const currentMonthKey = todayISO().slice(0, 7);

  // Masuk/Keluar di hero card sengaja di-scope ke bulan berjalan (bukan
  // all-time) biar konsisten sama Rata-rata/Hari di kolom sebelahnya —
  // ketiganya jadi satu paket "ringkasan bulan ini". "Saldo Sekarang"
  // di atasnya tetap all-time karena itu emang beda konteks (kumulatif,
  // bukan aktivitas bulan berjalan).
  const totalInThisMonth = useMemo(
    () =>
      transactions
        .filter(
          (t) => t.type === "in" && t.date.slice(0, 7) === currentMonthKey,
        )
        .reduce((s, t) => s + Number(t.amount), 0),
    [transactions, currentMonthKey],
  );
  const totalOutThisMonth = useMemo(
    () =>
      transactions
        .filter(
          (t) => t.type === "out" && t.date.slice(0, 7) === currentMonthKey,
        )
        .reduce((s, t) => s + Number(t.amount), 0),
    [transactions, currentMonthKey],
  );

  // Target scroll pas tombol "Harian" ditap — biar kerasa ngapa-ngapain
  // (auto-scroll ke list transaksi), bukan cuma badge diem doang.
  const dailyListRef = useRef(null);

  const availableMonths = useMemo(() => {
    const set = new Set(transactions.map((t) => t.date.slice(0, 7)));
    set.add(currentMonthKey);
    return Array.from(set).sort((a, b) => (a < b ? 1 : -1));
  }, [transactions, currentMonthKey]);

  // Daftar minggu (Senin–Minggu) buat dropdown mode "Minggu" di modal
  // Tabel Pengeluaran — di-scope ke bulan yang lagi dipilih (tableMonth)
  // biar dropdown-nya gak kepanjangan kalau data udah setahun lebih.
  const weeksForMonth = useMemo(() => {
    const month = tableMonth || currentMonthKey;
    const [y, m] = month.split("-").map(Number);
    const firstDay = new Date(y, m - 1, 1);
    const lastDay = new Date(y, m, 0);
    const fmt = (d) =>
      d.toLocaleDateString("id-ID", { day: "numeric", month: "short" });
    const todayStr = todayISO();

    const weeks = [];
    const cursor = new Date(firstDay);
    const dow = cursor.getDay(); // 0=Minggu..6=Sabtu
    const diffToMonday = dow === 0 ? -6 : 1 - dow;
    cursor.setDate(cursor.getDate() + diffToMonday);

    let i = 0;
    while (cursor <= lastDay) {
      const start = new Date(cursor);
      const end = new Date(cursor);
      end.setDate(end.getDate() + 6);
      const startISO = start.toISOString().slice(0, 10);
      const endISO = end.toISOString().slice(0, 10);
      const isCurrent = todayStr >= startISO && todayStr <= endISO;
      weeks.push({
        index: i,
        label: `Minggu ke-${i + 1} (${fmt(start)}–${fmt(end)})${
          isCurrent ? " · Ini" : ""
        }`,
        startISO,
        endISO,
        isCurrent,
      });
      cursor.setDate(cursor.getDate() + 7);
      i++;
    }
    return weeks;
  }, [tableMonth, currentMonthKey]);

  // Setiap ganti bulan, pindahin pilihan minggu ke minggu berjalan
  // (kalau bulan itu bulan ini) atau minggu terakhir di bulan
  // tersebut, biar gak nyangkut di index yang udah gak ada.
  useEffect(() => {
    if (weeksForMonth.length === 0) return;
    const idx = weeksForMonth.findIndex((w) => w.isCurrent);
    setTableWeekIndex(idx >= 0 ? idx : weeksForMonth.length - 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tableMonth]);

  const tableTransactions = useMemo(() => {
    const month = tableMonth || currentMonthKey;
    if (tableMode === "week") {
      const w =
        weeksForMonth[tableWeekIndex] ||
        weeksForMonth[weeksForMonth.length - 1];
      if (!w) return [];
      return transactions.filter(
        (t) => t.date >= w.startISO && t.date <= w.endISO,
      );
    }
    return transactions.filter((t) => t.date.slice(0, 7) === month);
  }, [
    transactions,
    tableMode,
    tableMonth,
    tableWeekIndex,
    weeksForMonth,
    currentMonthKey,
  ]);

  // List "Harian" inline — gak difilter periode lagi, langsung
  // dikelompokkan per tanggal dari transaksi terbaru. Dibatasi 30
  // hari terakhir yang ada transaksinya biar list tetap ringan.
  const byDay = useMemo(() => {
    const map = {};
    transactions.forEach((t) => {
      (map[t.date] = map[t.date] || []).push(t);
    });
    return Object.entries(map)
      .sort((a, b) => (a[0] < b[0] ? 1 : -1))
      .slice(0, 30);
  }, [transactions]);

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
                Saldo Sekarang
              </p>
              <p
                style={{
                  fontFamily: "'Inter', serif",
                  color: "#FFFFFF",
                }}
                className="mt-1 text-[26px] sm:text-[32px] lg:text-[30px] font-semibold leading-none">
                {rupiah(saldo)}
              </p>
              <span
                className="inline-flex items-center gap-1.5 mt-2.5 sm:mt-3 px-3 py-1.5 rounded-full text-[10.5px] sm:text-[11.5px] font-bold"
                style={{
                  background:
                    saldoStatus.key === "empty"
                      ? "rgba(217,96,122,0.4)"
                      : saldoStatus.key === "low"
                        ? "rgba(246,196,83,0.35)"
                        : "rgba(255,255,255,0.24)",
                  color: "#FFFFFF",
                  border:
                    saldoStatus.key === "empty"
                      ? "1px solid rgba(217,96,122,0.65)"
                      : saldoStatus.key === "low"
                        ? "1px solid rgba(246,196,83,0.6)"
                        : "1px solid rgba(255,255,255,0.45)",
                }}>
                {saldoStatus.icon} {saldoStatus.label}
              </span>
              <p
                className="text-[9.5px] sm:text-[10.5px] uppercase tracking-[0.15em] font-bold text-center mt-4 sm:mt-4.5"
                style={{ color: "rgba(255,255,255,0.75)" }}>
                Ringkasan {monthLabel(currentMonthKey)}
              </p>
              <div className="grid grid-cols-3 gap-2 sm:gap-3 mt-1.5 w-full">
                <div
                  className="rounded-2xl px-1.5 py-2.5 sm:p-3 text-center min-w-0"
                  style={{
                    background: "rgba(255,255,255,0.18)",
                    border: "1px solid rgba(255,255,255,0.32)",
                  }}>
                  <p
                    className="text-[8px] sm:text-[9.5px] uppercase tracking-wide font-bold truncate"
                    style={{ color: "#FFFFFF" }}>
                    Masuk
                  </p>
                  <p
                    className="text-[11.5px] sm:text-[14px] font-bold mt-0.5 truncate"
                    style={{ color: "#FFFFFF" }}>
                    {rupiah(totalInThisMonth)}
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
                    Keluar
                  </p>
                  <p
                    className="text-[11.5px] sm:text-[14px] font-bold mt-0.5 truncate"
                    style={{ color: "#FFFFFF" }}>
                    {rupiah(totalOutThisMonth)}
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
                    Rata-rata/Hari
                  </p>
                  <p
                    className="text-[11.5px] sm:text-[14px] font-bold mt-0.5 truncate"
                    style={{ color: "#FFFFFF" }}>
                    {rupiah(avgOutPerDay)}
                  </p>
                </div>
              </div>
            </div>
          </div>

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
            <div className="mb-3">
              <h3
                className="font-semibold text-[12px] sm:text-[13px] tracking-[0.08em] uppercase"
                style={{ color: C.lavender }}>
                Catatan Transaksi
              </h3>
            </div>

            {/* 3 tombol aksi: "Harian" cuma penanda kalau list di bawah
                ini emang tampilan harian (gak difilter periode lagi),
                "Tabel Pengeluaran" buka modal terpisah isinya tabel
                dengan pilihan Minggu/Bulan, "Export" buka modal pilih
                bulan buat download Excel. Disembunyikan kalau memang
                belum ada transaksi sama sekali biar gak ganggu empty
                state. */}
            {transactions.length > 0 && (
              <div
                className="flex rounded-2xl p-1 mb-3 gap-1"
                style={{ background: "#463F5C0d" }}>
                <button
                  onClick={() =>
                    dailyListRef.current?.scrollIntoView({
                      behavior: "smooth",
                      block: "start",
                    })
                  }
                  className="flex-1 py-2 rounded-xl text-[11.5px] sm:text-[12px] font-bold transition-transform active:scale-[0.97]"
                  style={{ background: C.lavender, color: "#FFFFFF" }}>
                  📅 Harian
                </button>
                <button
                  onClick={() => {
                    setTableMode("week");
                    setTableMonth(currentMonthKey);
                    setShowTableModal(true);
                  }}
                  className="flex-1 py-2 rounded-xl text-[11.5px] sm:text-[12px] font-bold transition-colors"
                  style={{ background: "transparent", color: C.inkSoft }}>
                  📋 Tabel
                </button>
                <button
                  onClick={() => {
                    setExportEmptyMonth(null);
                    setShowExportModal(true);
                  }}
                  className="flex-1 py-2 rounded-xl text-[11.5px] sm:text-[12px] font-bold transition-colors"
                  style={{ background: "transparent", color: C.mintDeep }}>
                  ⬇️ Export
                </button>
              </div>
            )}

            <div
              ref={dailyListRef}
              className="mt-1 max-h-[26rem] lg:max-h-none lg:flex-1 overflow-y-auto pr-1 scroll-mt-4">
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

      {showTableModal && (
        <div
          className="fixed inset-0 flex items-center justify-center z-50 px-4"
          style={{ background: "rgba(70,63,92,0.4)" }}
          onClick={() => setShowTableModal(false)}>
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full sm:max-w-lg max-h-[85vh] overflow-y-auto rounded-[28px] p-6 sm:p-7"
            style={{
              background: "#FFFFFF",
              boxShadow: "0 24px 56px -20px rgba(70,63,92,0.35)",
            }}>
            <div className="flex items-center justify-between mb-1">
              <h3
                style={{ fontFamily: "'Fraunces', serif", color: C.ink }}
                className="text-[18px] font-semibold">
                Tabel Pengeluaran
              </h3>
              <button
                onClick={() => setShowTableModal(false)}
                className="w-8 h-8 rounded-full flex items-center justify-center text-[14px] font-bold flex-shrink-0"
                style={{ background: "#463F5C0f", color: C.inkSoft }}>
                ✕
              </button>
            </div>
            <p className="text-[12.5px] mb-4" style={{ color: C.inkFaint }}>
              Lihat rincian pengeluaran per minggu atau per bulan.
            </p>

            <div
              className="flex rounded-2xl p-1 mb-3 gap-1"
              style={{ background: "#463F5C0d" }}>
              <button
                onClick={() => setTableMode("week")}
                className="flex-1 py-2 rounded-xl text-[11.5px] sm:text-[12px] font-bold transition-colors"
                style={{
                  background: tableMode === "week" ? C.lavender : "transparent",
                  color: tableMode === "week" ? "#FFFFFF" : C.inkSoft,
                }}>
                Minggu
              </button>
              <button
                onClick={() => setTableMode("month")}
                className="flex-1 py-2 rounded-xl text-[11.5px] sm:text-[12px] font-bold transition-colors"
                style={{
                  background:
                    tableMode === "month" ? C.lavender : "transparent",
                  color: tableMode === "month" ? "#FFFFFF" : C.inkSoft,
                }}>
                Bulan
              </button>
            </div>

            {/* Dropdown Bulan selalu tampil — di mode "Bulan" ini
                langsung jadi periode tabelnya, di mode "Minggu" ini
                nentuin bulan aktif buat nge-scope pilihan minggu di
                bawahnya (biar list minggu gak kepanjangan). Labelnya
                dibedain teksnya biar gak ketuker sama tab "Bulan" di
                atas. */}
            <p
              className="text-[11px] font-semibold mb-1.5"
              style={{ color: C.inkFaint }}>
              {tableMode === "week" ? "Cari di bulan" : "Pilih bulan"}
            </p>
            <div className="relative mb-3">
              <select
                value={tableMonth || currentMonthKey}
                onChange={(e) => setTableMonth(e.target.value)}
                className="w-full appearance-none pl-3.5 pr-9 py-2.5 rounded-2xl text-[13px] font-semibold outline-none"
                style={{
                  background: "#8B72C41A",
                  color: C.lavender,
                  border: "1px solid #8B72C433",
                }}>
                {availableMonths.map((m) => (
                  <option key={m} value={m}>
                    {monthLabel(m)}
                  </option>
                ))}
              </select>
              <span
                className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-[10px]"
                style={{ color: C.lavender }}>
                ▾
              </span>
            </div>

            {tableMode === "week" && (
              <>
                <p
                  className="text-[11px] font-semibold mb-1.5"
                  style={{ color: C.inkFaint }}>
                  Pilih minggu
                </p>
                <div className="relative mb-4">
                  <select
                    value={tableWeekIndex}
                    onChange={(e) => setTableWeekIndex(Number(e.target.value))}
                    className="w-full appearance-none pl-3.5 pr-9 py-2.5 rounded-2xl text-[13px] font-semibold outline-none"
                    style={{
                      background: "#8B72C41A",
                      color: C.lavender,
                      border: "1px solid #8B72C433",
                    }}>
                    {weeksForMonth.map((w) => (
                      <option key={w.index} value={w.index}>
                        {w.label}
                      </option>
                    ))}
                  </select>
                  <span
                    className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-[10px]"
                    style={{ color: C.lavender }}>
                    ▾
                  </span>
                </div>
              </>
            )}

            <TransactionsTable
              transactions={tableTransactions}
              onEditTransaction={(t) => {
                setShowTableModal(false);
                onEditTransaction(t);
              }}
            />
          </div>
        </div>
      )}

      {showExportModal && (
        <div
          className="fixed inset-0 flex items-center justify-center z-50 px-4"
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
