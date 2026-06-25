import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { RankingEntry } from "./fm-rankings";

export interface ExportSection {
  title: string;
  entries: RankingEntry[];
  mode: "weighted" | "raw";
}

function rows(entries: RankingEntry[], mode: "weighted" | "raw") {
  return entries.map((e, i) => ({
    "#": i + 1,
    Nome: e.name,
    Títulos: e.titles,
    Pontos: Math.round(((mode === "raw" ? e.raw : e.weighted) ?? 0) * 100) / 100,
  }));
}

export function exportRankingsExcel(sections: ExportSection[], filename = "fm-rankings.xlsx") {
  const wb = XLSX.utils.book_new();
  for (const s of sections) {
    const ws = XLSX.utils.json_to_sheet(rows(s.entries, s.mode));
    XLSX.utils.book_append_sheet(wb, ws, s.title.slice(0, 31));
  }
  XLSX.writeFile(wb, filename);
}

export function exportRankingsPDF(sections: ExportSection[], heading: string, filename = "fm-rankings.pdf") {
  const doc = new jsPDF();
  doc.setFontSize(16);
  doc.text(heading, 14, 16);
  doc.setFontSize(9);
  doc.setTextColor(120);
  doc.text(`Gerado em ${new Date().toLocaleString("pt-PT")}`, 14, 22);

  let startY = 28;
  for (const s of sections) {
    const data = rows(s.entries, s.mode).slice(0, 100);
    doc.setFontSize(11);
    doc.setTextColor(20);
    doc.text(s.title, 14, startY);
    autoTable(doc, {
      startY: startY + 3,
      head: [["#", "Nome", "Títulos", "Pontos"]],
      body: data.map((r) => [r["#"], r.Nome, r.Títulos, r.Pontos.toLocaleString("pt-PT")]),
      headStyles: { fillColor: [34, 139, 90] },
      styles: { fontSize: 8 },
    });
    // @ts-expect-error lastAutoTable injected by plugin
    startY = (doc.lastAutoTable?.finalY ?? startY) + 10;
  }
  doc.save(filename);
}