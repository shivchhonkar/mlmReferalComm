"use client";

import { Download, Printer } from "lucide-react";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { showErrorToast } from "@/lib/toast";
import { csvEscape, escapeHtml } from "../_lib";

export type ReportMetaRow = { label: string; value: string };

type Props = {
  reportTitle: string;
  fileNameBase: string;
  meta?: ReportMetaRow[];
  headers: string[];
  rows: string[][];
  disabled?: boolean;
  className?: string;
};

export default function ReportExportButtons({
  reportTitle,
  fileNameBase,
  meta = [],
  headers,
  rows,
  disabled = false,
  className = "",
}: Props) {
  const canExport = !disabled && rows.length > 0;

  const downloadCsv = () => {
    if (!canExport) return;
    const metaLines = meta.map(({ label, value }) => `${csvEscape(label)},${csvEscape(value)}`);
    const lines = [...metaLines, "", headers.map((h) => csvEscape(h)).join(",")];
    rows.forEach((row) => {
      lines.push(row.map((c) => csvEscape(c)).join(","));
    });
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${fileNameBase}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const downloadPdf = () => {
    if (!canExport) return;
    const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
    doc.setFontSize(14);
    doc.text(reportTitle, 40, 40);
    doc.setFontSize(10);
    let y = 58;
    meta.forEach(({ label, value }) => {
      doc.text(`${label}: ${value}`, 40, y);
      y += 14;
    });
    doc.text(`Generated: ${new Date().toLocaleString("en-IN")}`, 40, y);
    autoTable(doc, {
      startY: y + 12,
      head: [headers],
      body: rows,
      styles: { fontSize: 9 },
      headStyles: { fillColor: [16, 185, 129] },
    });
    doc.save(`${fileNameBase}.pdf`);
  };

  const printReport = () => {
    if (!canExport) return;
    const win = window.open("", "_blank", "noopener,noreferrer");
    if (!win) {
      showErrorToast("Allow pop-ups to print the report");
      return;
    }
    const metaHtml = meta
      .map(
        ({ label, value }) =>
          `<tr><th>${escapeHtml(label)}</th><td>${escapeHtml(value)}</td></tr>`,
      )
      .join("");
    const bodyHtml = rows
      .map((row) => `<tr>${row.map((c) => `<td>${escapeHtml(c)}</td>`).join("")}</tr>`)
      .join("");
    win.document.write(`<!DOCTYPE html>
<html><head><meta charset="utf-8"/><title>${escapeHtml(reportTitle)}</title>
<style>
body{font-family:system-ui,sans-serif;padding:24px;color:#18181b}
h1{font-size:1.25rem;margin:0 0 8px}
.meta{width:100%;border-collapse:collapse;margin:12px 0;font-size:12px}
.meta th{text-align:left;padding:4px 12px 4px 0;color:#52525b;font-weight:600}
table.data{width:100%;border-collapse:collapse;font-size:11px;margin-top:12px}
table.data th,table.data td{border:1px solid #d4d4d8;padding:6px 8px;text-align:left}
table.data th{background:#ecfdf5;font-weight:600}
</style></head><body>
<h1>${escapeHtml(reportTitle)}</h1>
<p>${escapeHtml(new Date().toLocaleString("en-IN"))}</p>
${meta.length ? `<table class="meta">${metaHtml}</table>` : ""}
<table class="data"><thead><tr>${headers.map((h) => `<th>${escapeHtml(h)}</th>`).join("")}</tr></thead>
<tbody>${bodyHtml}</tbody></table>
<script>window.onload=function(){window.print()}</script>
</body></html>`);
    win.document.close();
  };

  return (
    <div className={`flex flex-wrap items-center gap-2 ${className}`}>
      <button
        type="button"
        onClick={downloadCsv}
        disabled={!canExport}
        title={canExport ? "Download CSV" : "No rows to export"}
        className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <Download className="h-4 w-4" />
        CSV
      </button>
      <button
        type="button"
        onClick={downloadPdf}
        disabled={!canExport}
        title={canExport ? "Download PDF" : "No rows to export"}
        className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <Download className="h-4 w-4" />
        PDF
      </button>
      <button
        type="button"
        onClick={printReport}
        disabled={!canExport}
        title={canExport ? "Print report" : "No rows to print"}
        className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <Printer className="h-4 w-4" />
        Print
      </button>
    </div>
  );
}
