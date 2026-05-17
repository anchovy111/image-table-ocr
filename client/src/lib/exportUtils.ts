import * as XLSX from "xlsx";

export interface TableData {
  headers: string[];
  rows: string[][];
}

export function exportToCSV(tableData: TableData, filename: string): void {
  const { headers, rows } = tableData;
  const csvRows = [headers, ...rows];
  const csvContent = csvRows
    .map((row) =>
      row
        .map((cell) => {
          // Escape double quotes and wrap in quotes if needed
          const escaped = String(cell ?? "").replace(/"/g, '""');
          return /[,"\n\r]/.test(escaped) ? `"${escaped}"` : escaped;
        })
        .join(",")
    )
    .join("\n");

  // Add BOM for Excel compatibility with Chinese characters
  const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
  downloadBlob(blob, `${filename}.csv`);
}

export function exportToXLSX(tableData: TableData, filename: string): void {
  const { headers, rows } = tableData;
  const worksheetData = [headers, ...rows];
  const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);

  // Style header row
  const range = XLSX.utils.decode_range(worksheet["!ref"] || "A1");
  for (let col = range.s.c; col <= range.e.c; col++) {
    const cellAddress = XLSX.utils.encode_cell({ r: 0, c: col });
    if (!worksheet[cellAddress]) continue;
    worksheet[cellAddress].s = {
      font: { bold: true },
      fill: { fgColor: { rgb: "F3F4F6" } },
    };
  }

  // Auto column widths
  const colWidths = headers.map((h, i) => {
    const maxLen = Math.max(
      String(h ?? "").length,
      ...rows.map((row) => String(row[i] ?? "").length)
    );
    return { wch: Math.min(Math.max(maxLen + 2, 8), 50) };
  });
  worksheet["!cols"] = colWidths;

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "表格数据");
  XLSX.writeFile(workbook, `${filename}.xlsx`);
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
