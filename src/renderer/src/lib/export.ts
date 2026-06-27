import * as XLSX from 'xlsx'
import { jsPDF } from 'jspdf'

interface ExportColumn {
  header: string
  key: string
  align?: 'left' | 'right' | 'center'
  width?: number
  // 010: export the column as a real number in Excel (sumable with formulas).
  // Excel cell stays type 'n' with a "Gs." display format; PDF shows it formatted.
  numeric?: boolean
}

// 010: a numeric column keeps its number in Excel (so it adds up) and is shown
// formatted ("Gs. 100.000" / "-") in the PDF. Non-numeric columns are stringified.
function cellValue(
  val: unknown,
  numeric: boolean | undefined,
  mode: 'excel' | 'pdf'
): string | number {
  if (numeric) {
    // 010: null/undefined → blank cell (e.g. the apertura/cierre bookend rows).
    // A real number — including 0 — is shown as a plain number (no "Gs."), so it
    // sums in Excel and reads as a number, not currency.
    if (val === null || val === undefined) return ''
    if (typeof val !== 'number') return mode === 'excel' ? '' : '0'
    if (mode === 'excel') return val
    return val.toLocaleString('es-PY')
  }
  return val !== null && val !== undefined ? String(val) : '-'
}

function getExportRows(
  data: Record<string, unknown>[],
  columns: ExportColumn[],
  mode: 'excel' | 'pdf'
): (string | number)[][] {
  return data.map((row) => columns.map((col) => cellValue(row[col.key], col.numeric, mode)))
}

export function exportToExcel(
  data: Record<string, unknown>[],
  columns: ExportColumn[],
  filename: string,
  title?: string
): void {
  const headers = columns.map((c) => c.header)
  const rows = getExportRows(data, columns, 'excel')

  const wsData: (string | number)[][] = []
  if (title) {
    wsData.push([title])
    wsData.push([])
  }
  wsData.push(headers)
  wsData.push(...rows)

  const ws = XLSX.utils.aoa_to_sheet(wsData)

  // Column widths
  ws['!cols'] = columns.map((c) => ({ wch: c.width || 18 }))

  // 010: numeric columns keep their number type so they sum in Excel; a plain
  // thousands-separated number format (no currency symbol) is applied.
  const dataStart = title ? 3 : 1
  columns.forEach((col, c) => {
    if (!col.numeric) return
    for (let r = dataStart; r < dataStart + rows.length; r++) {
      const cell = ws[XLSX.utils.encode_cell({ r, c })]
      if (cell && typeof cell.v === 'number') cell.z = '#,##0'
    }
  })

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Reporte')
  XLSX.writeFile(wb, `${filename}.xlsx`)
}

export function exportToPDF(
  data: Record<string, unknown>[],
  columns: ExportColumn[],
  filename: string,
  title: string,
  // Optional pre-formatted key/value lines rendered as a "Resumen del período"
  // block between the header and the table. Values arrive already formatted as
  // strings so export.ts stays domain-agnostic (no formatGs here).
  summary?: { label: string; value: string }[]
): void {
  // 010: wide tables (many columns) overflow a portrait page and clip text, so
  // switch to landscape automatically once there are enough columns to need it.
  const orientation = columns.length > 8 ? 'landscape' : 'portrait'
  const doc = new jsPDF({ orientation })
  const pageWidth = doc.internal.pageSize.getWidth()
  const margin = 14
  const usableWidth = pageWidth - margin * 2

  // Title
  doc.setFontSize(16)
  doc.setFont('helvetica', 'bold')
  doc.text(title, margin, 20)

  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  doc.text(`Generado: ${new Date().toLocaleString('es-PY')}`, margin, 28)

  // Optional summary block ("Resumen del período"): label left, value right,
  // rendered between the header and the table. Pushes the table down by its
  // height so nothing overlaps.
  let summaryBottom = 28
  if (summary && summary.length > 0) {
    // Keep the block compact: in landscape the full usableWidth would leave a
    // huge gap between label and value, so cap the value column.
    const summaryWidth = Math.min(usableWidth, 90)
    let sy = 36
    doc.setFontSize(11)
    doc.setFont('helvetica', 'bold')
    doc.text('Resumen del período', margin, sy)
    sy += 6
    doc.setFontSize(9.5)
    summary.forEach((item) => {
      doc.setFont('helvetica', 'normal')
      doc.text(item.label, margin, sy)
      doc.setFont('helvetica', 'bold')
      doc.text(item.value, margin + summaryWidth, sy, { align: 'right' })
      sy += 6
    })
    summaryBottom = sy
  }

  // Table
  const rows = getExportRows(data, columns, 'pdf')

  // 010: proportional column widths from each column's `width` hint (instead of
  // splitting the page evenly), so text columns like Cliente get more room than
  // narrow ones (Hora, N°) and the text stops getting clipped.
  const totalUnits = columns.reduce((sum, c) => sum + (c.width || 18), 0)
  const colWidths = columns.map((c) => ((c.width || 18) / totalUnits) * usableWidth)
  const colX: number[] = []
  let xAcc = margin
  for (const w of colWidths) {
    colX.push(xAcc)
    xAcc += w
  }
  const cellX = (i: number): number =>
    columns[i].align === 'right' ? colX[i] + colWidths[i] - 2 : colX[i] + 2
  const cellOpts = (i: number): { maxWidth: number; align: 'left' | 'right' } => ({
    maxWidth: colWidths[i] - 3,
    align: columns[i].align === 'right' ? 'right' : 'left'
  })

  const startY = summary && summary.length > 0 ? summaryBottom + 4 : 35
  const rowHeight = 7
  const headerHeight = 8
  // Denser tables need a smaller font so each cell fits on a single line.
  const headerFont = columns.length > 10 ? 7 : 8
  const dataFont = columns.length > 10 ? 6.5 : 7.5

  // Header row
  doc.setFillColor(204, 28, 28) // brand color
  doc.rect(margin, startY, usableWidth, headerHeight, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(headerFont)
  doc.setFont('helvetica', 'bold')

  columns.forEach((col, i) => {
    doc.text(col.header, cellX(i), startY + 5.5, cellOpts(i))
  })

  // Data rows
  doc.setTextColor(26, 26, 26)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(dataFont)

  let y = startY + headerHeight
  const maxY = doc.internal.pageSize.getHeight() - 20

  rows.forEach((row, rowIdx) => {
    if (y + rowHeight > maxY) {
      doc.addPage()
      y = 20
    }

    // Alternate row background
    if (rowIdx % 2 === 0) {
      doc.setFillColor(245, 240, 240) // bg-secondary
      doc.rect(margin, y, usableWidth, rowHeight, 'F')
    }

    row.forEach((cell, colIdx) => {
      doc.text(String(cell), cellX(colIdx), y + 5, cellOpts(colIdx))
    })

    y += rowHeight
  })

  // Footer
  doc.setFontSize(8)
  doc.setTextColor(107, 107, 107)
  doc.text(`Total registros: ${rows.length}`, margin, y + 10)
  doc.text('Multicarnes S.R.L.', pageWidth - margin, y + 10, { align: 'right' })

  doc.save(`${filename}.pdf`)
}
