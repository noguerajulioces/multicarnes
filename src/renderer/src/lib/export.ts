import * as XLSX from 'xlsx'
import { jsPDF } from 'jspdf'

interface ExportColumn {
  header: string
  key: string
  align?: 'left' | 'right' | 'center'
  width?: number
}

function getExportRows(data: Record<string, unknown>[], columns: ExportColumn[]): string[][] {
  return data.map((row) =>
    columns.map((col) => {
      const val = row[col.key]
      return val !== null && val !== undefined ? String(val) : '-'
    })
  )
}

export function exportToExcel(
  data: Record<string, unknown>[],
  columns: ExportColumn[],
  filename: string,
  title?: string
): void {
  const headers = columns.map((c) => c.header)
  const rows = getExportRows(data, columns)

  const wsData: string[][] = []
  if (title) {
    wsData.push([title])
    wsData.push([])
  }
  wsData.push(headers)
  wsData.push(...rows)

  const ws = XLSX.utils.aoa_to_sheet(wsData)

  // Column widths
  ws['!cols'] = columns.map((c) => ({ wch: c.width || 18 }))

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Reporte')
  XLSX.writeFile(wb, `${filename}.xlsx`)
}

export function exportToPDF(
  data: Record<string, unknown>[],
  columns: ExportColumn[],
  filename: string,
  title: string
): void {
  const doc = new jsPDF({ orientation: 'portrait' })
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

  // Table
  const rows = getExportRows(data, columns)

  const colCount = columns.length
  const colWidth = usableWidth / colCount
  const startY = 35
  const rowHeight = 7
  const headerHeight = 8

  // Header row
  doc.setFillColor(204, 28, 28) // brand color
  doc.rect(margin, startY, usableWidth, headerHeight, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(8)
  doc.setFont('helvetica', 'bold')

  columns.forEach((col, i) => {
    const x = margin + i * colWidth + 2
    doc.text(col.header, x, startY + 5.5, {
      maxWidth: colWidth - 4
    })
  })

  // Data rows
  doc.setTextColor(26, 26, 26)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7.5)

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
      const x = margin + colIdx * colWidth + 2
      const align = columns[colIdx].align
      let textX = x
      if (align === 'right') {
        textX = margin + (colIdx + 1) * colWidth - 2
      }
      doc.text(cell, textX, y + 5, {
        maxWidth: colWidth - 4,
        align: align === 'right' ? 'right' : 'left'
      })
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
