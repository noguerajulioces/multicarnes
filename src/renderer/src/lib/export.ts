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

// A row in the "Resumen del período" block.
// - normal row: label + value.
// - `group` row: full-width shaded sub-header that splits the table into sections.
// - `note` row: full-width small gray line (a footnote/aclaración).
// `bold` emphasizes a row; `tone` colors it green/red (e.g. the arqueo verdict).
export type SummaryRow = {
  label?: string
  value?: string
  group?: string
  note?: string
  bold?: boolean
  tone?: 'good' | 'bad'
  // Indents the label (e.g. the +/− cascade lines under "Apertura").
  indent?: boolean
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
  title?: string,
  // Optional pre-formatted key/value lines rendered as a "Resumen del período"
  // block above the table (mirrors exportToPDF). Values arrive already
  // formatted as strings so export.ts stays domain-agnostic.
  summary?: SummaryRow[]
): void {
  const headers = columns.map((c) => c.header)
  const rows = getExportRows(data, columns, 'excel')

  const wsData: (string | number)[][] = []
  if (title) {
    wsData.push([title])
    wsData.push([])
  }
  if (summary && summary.length > 0) {
    wsData.push(['Resumen del período'])
    summary.forEach((item) => {
      if (item.group) wsData.push([item.group.toUpperCase()])
      else if (item.note) wsData.push([item.note])
      else wsData.push([item.label ?? '', item.value ?? ''])
    })
    wsData.push([])
  }
  wsData.push(headers)
  // Capture the data-rows offset right after the header (robust against the
  // variable-height title/summary preamble) so numeric formatting stays aligned.
  const dataStart = wsData.length
  wsData.push(...rows)

  const ws = XLSX.utils.aoa_to_sheet(wsData)

  // Column widths
  ws['!cols'] = columns.map((c) => ({ wch: c.width || 18 }))

  // 010: numeric columns keep their number type so they sum in Excel; a plain
  // thousands-separated number format (no currency symbol) is applied.
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
  summary?: SummaryRow[],
  // Optional extra tables rendered (in order) below the main one, each with its
  // own brand-red heading. The main `data` table may be empty, in which case
  // only the summary + these sections render.
  extraSections?: { title: string; columns: ExportColumn[]; rows: Record<string, unknown>[] }[],
  // Opt-in "professional" styling: a brand-colored header band with the business
  // name + accented section headings + page-numbered footers. When omitted the
  // plain layout is used (Ventas/Reportes exports stay unchanged).
  branding?: { businessName: string },
  // Opt-in: treat column `width`s as absolute mm (table only as wide as its
  // content, left-aligned) instead of stretching to fill the page width.
  compact?: boolean
): void {
  // 010: wide tables (many columns) overflow a portrait page and clip text, so
  // switch to landscape automatically once there are enough columns to need it.
  const orientation = columns.length > 8 ? 'landscape' : 'portrait'
  const doc = new jsPDF({ orientation })
  const pageWidth = doc.internal.pageSize.getWidth()
  const margin = 14
  const usableWidth = pageWidth - margin * 2

  // Header: a brand-colored band with the business name (professional look) when
  // `branding` is set; otherwise the plain title used by the other exports.
  let contentTop: number
  if (branding) {
    // Clean header: black text (business name left, doc title right) + a divider
    // line. No color band.
    doc.setTextColor(33, 37, 41)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(15)
    doc.text(branding.businessName, margin, 16)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(11)
    doc.text(title, pageWidth - margin, 16, { align: 'right' })
    doc.setDrawColor(170, 170, 170)
    doc.setLineWidth(0.5)
    doc.line(margin, 20, pageWidth - margin, 20)
    doc.setTextColor(120, 120, 120)
    doc.setFontSize(8.5)
    doc.text(`Generado: ${new Date().toLocaleString('es-PY')}`, margin, 26)
    contentTop = 33
  } else {
    // Título centrado.
    doc.setFontSize(16)
    doc.setFont('helvetica', 'bold')
    doc.text(title, pageWidth / 2, 20, { align: 'center' })
    doc.setFontSize(9)
    doc.setFont('helvetica', 'normal')
    doc.text(`Generado: ${new Date().toLocaleString('es-PY')}`, pageWidth / 2, 28, {
      align: 'center'
    })
    contentTop = 35
  }

  const maxY = doc.internal.pageSize.getHeight() - 20

  // Draws one table (header + rows) starting at `top`, handling page breaks, and
  // returns the y just below the last row. Column geometry is computed per table
  // so each section can use its own column set.
  const drawTable = (
    cols: ExportColumn[],
    dataRows: Record<string, unknown>[],
    top: number
  ): number => {
    const pdfRows = getExportRows(dataRows, cols, 'pdf')

    // 010: proportional column widths from each column's `width` hint so text
    // columns (Cliente) get more room than narrow ones (N°) and text isn't clipped.
    const totalUnits = cols.reduce((sum, c) => sum + (c.width || 18), 0)
    // `compact`: widths are absolute mm (scaled down only if they overflow the
    // page), so the table is only as wide as its content. Otherwise widths are
    // normalized to fill usableWidth (stretches edge to edge).
    const colWidths = compact
      ? cols.map((c) => (c.width || 18) * (totalUnits > usableWidth ? usableWidth / totalUnits : 1))
      : cols.map((c) => ((c.width || 18) / totalUnits) * usableWidth)
    const tableWidth = colWidths.reduce((a, b) => a + b, 0)
    const colX: number[] = []
    let xAcc = margin
    for (const w of colWidths) {
      colX.push(xAcc)
      xAcc += w
    }
    const cellX = (i: number): number =>
      cols[i].align === 'right' ? colX[i] + colWidths[i] - 2 : colX[i] + 2
    // No maxWidth → el texto nunca se parte en 2 líneas; si una celda es más
    // larga que su columna, desborda sobre las celdas vecinas (que en este
    // reporte están vacías en esa fila).
    const cellOpts = (i: number): { align: 'left' | 'right' } => ({
      align: cols[i].align === 'right' ? 'right' : 'left'
    })

    // Dense tables (many columns, e.g. the Reportes exports) keep the small font
    // so each cell fits one line; the common ≤10-column reports use a larger,
    // more readable size.
    const dense = cols.length > 10
    const headerFont = dense ? 10 : 9.5
    const dataFont = dense ? 9.5 : 9
    const rowHeight = dense ? 9.5 : 9
    const headerHeight = dense ? 10.5 : 10
    const headerBaseline = top + (dense ? 7 : 6.8)
    const dataBaseline = dense ? 6.5 : 6.2

    // `bordered` (only with branding) mimics Bootstrap's .table-bordered: a thin
    // gray grid with a light header. Otherwise the original red-header style
    // (keeps Ventas/Reportes exports unchanged).
    const bordered = !!branding
    const BORDER: [number, number, number] = [222, 226, 230] // #dee2e6
    const INK: [number, number, number] = [33, 37, 41] // #212529

    // Header row
    if (bordered) {
      doc.setDrawColor(...BORDER)
      doc.setLineWidth(0.2)
      doc.setFillColor(233, 236, 239) // #e9ecef
      cols.forEach((_c, i) => doc.rect(colX[i], top, colWidths[i], headerHeight, 'FD'))
      doc.setTextColor(...INK)
    } else {
      doc.setFillColor(204, 28, 28) // brand color
      doc.rect(margin, top, tableWidth, headerHeight, 'F')
      doc.setTextColor(255, 255, 255)
    }
    doc.setFontSize(headerFont)
    doc.setFont('helvetica', 'bold')
    cols.forEach((col, i) => {
      doc.text(col.header, cellX(i), headerBaseline, cellOpts(i))
    })

    // Data rows
    doc.setTextColor(...(bordered ? INK : ([26, 26, 26] as [number, number, number])))
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(dataFont)
    let y = top + headerHeight
    pdfRows.forEach((row, rowIdx) => {
      if (y + rowHeight > maxY) {
        doc.addPage()
        y = 20
      }
      if (bordered) {
        // Per-cell stroke = full grid (handles page breaks naturally). White rows.
        doc.setDrawColor(...BORDER)
        doc.setLineWidth(0.2)
        cols.forEach((_c, i) => doc.rect(colX[i], y, colWidths[i], rowHeight, 'S'))
      } else if (rowIdx % 2 === 0) {
        // Alternate row background
        doc.setFillColor(245, 240, 240) // bg-secondary
        doc.rect(margin, y, tableWidth, rowHeight, 'F')
      }
      row.forEach((cell, colIdx) => {
        doc.text(String(cell), cellX(colIdx), y + dataBaseline, cellOpts(colIdx))
      })
      y += rowHeight
    })
    return y
  }

  // Renders a bold section heading (page-breaking if needed) and returns the y
  // at which the table below it should start.
  const heading = (text: string, top: number): number => {
    let t = top
    if (t + 16 > maxY) {
      doc.addPage()
      t = 20
    }
    doc.setTextColor(26, 26, 26)
    doc.setFontSize(12)
    doc.setFont('helvetica', 'bold')
    doc.text(text, margin, t)
    // Thin brand accent under the heading for a more polished look.
    doc.setDrawColor(204, 28, 28)
    doc.setLineWidth(0.6)
    doc.line(margin, t + 2, margin + usableWidth, t + 2)
    return t + 6
  }

  // Renders the summary as clean label-left / value-right lists (no column
  // header, no row shading). When there are exactly two `group` sections they
  // are laid out side by side (two columns); otherwise stacked. `note` rows are
  // small gray footnotes rendered full-width below.
  const lineH = 7

  // One section (group title + its rows) inside a column of width `w` at x; the
  // value column is right-aligned at x+w. Returns the y below the last row.
  const drawSection = (
    title: string,
    sectionRows: SummaryRow[],
    x: number,
    w: number,
    top: number
  ): number => {
    let y = top
    // Titleless section (no `group`): render the rows directly, no sub-header.
    if (title) {
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(9.5)
      doc.setTextColor(120, 120, 120)
      doc.text(title.toUpperCase(), x, y + 4)
      doc.setDrawColor(220, 220, 220)
      doc.setLineWidth(0.3)
      doc.line(x, y + 5.5, x + w, y + 5.5)
      y += lineH + 1
    }
    for (const r of sectionRows) {
      if (y + lineH > maxY) {
        doc.addPage()
        y = 20
      }
      doc.setFont('helvetica', r.bold ? 'bold' : 'normal')
      doc.setFontSize(10)
      if (r.tone === 'good') doc.setTextColor(22, 128, 61)
      else if (r.tone === 'bad') doc.setTextColor(185, 28, 28)
      else doc.setTextColor(40, 40, 40)
      doc.text(r.label ?? '', r.indent ? x + 5 : x, y + 4)
      doc.text(r.value ?? '', x + w, y + 4, { align: 'right' })
      y += lineH
    }
    return y
  }

  const drawSummary = (items: SummaryRow[], top: number): number => {
    // Split into group-sections + trailing footnotes.
    const sections: { title: string; rows: SummaryRow[] }[] = []
    const footnotes: string[] = []
    for (const item of items) {
      if (item.group) sections.push({ title: item.group, rows: [] })
      else if (item.note) footnotes.push(item.note)
      else {
        // Rows before any `group` go into an implicit titleless section.
        if (sections.length === 0) sections.push({ title: '', rows: [] })
        sections[sections.length - 1].rows.push(item)
      }
    }

    let endY = top
    if (sections.length === 2) {
      const gap = 10
      const colW = (usableWidth - gap) / 2
      const y1 = drawSection(sections[0].title, sections[0].rows, margin, colW, top)
      const y2 = drawSection(sections[1].title, sections[1].rows, margin + colW + gap, colW, top)
      endY = Math.max(y1, y2)
      // Vertical divider between the two columns.
      doc.setDrawColor(222, 226, 230)
      doc.setLineWidth(0.3)
      doc.line(margin + colW + gap / 2, top, margin + colW + gap / 2, endY)
    } else {
      let y = top
      for (const s of sections)
        y = drawSection(s.title, s.rows, margin, Math.min(usableWidth, 115), y) + 3
      endY = y
    }

    // Footnotes full-width below both columns.
    let fy = endY + 4
    doc.setFont('helvetica', 'italic')
    doc.setFontSize(8)
    doc.setTextColor(120, 120, 120)
    // 010-cash-float-close: footnotes can be multi-line now (the cierre prints
    // the operator's observations verbatim), so advance by the wrapped height
    // instead of one fixed line — otherwise consecutive notes overlap.
    const noteLineH = 4
    const pageCapacity = Math.max(1, Math.floor((maxY - 24) / noteLineH))
    for (const note of footnotes) {
      let lines = doc.splitTextToSize(note, usableWidth) as string[]
      if (lines.length === 0) lines = ['']
      let room = Math.floor((maxY - (fy + 4)) / noteLineH)
      // A note that fits on a fresh page moves there whole; only a note taller
      // than a page gets split across pages (the cierre's observations are
      // unbounded — never truncate them).
      if (room < 1 || (lines.length > room && lines.length <= pageCapacity)) {
        doc.addPage()
        fy = 20
        room = pageCapacity
      }
      while (lines.length > 0) {
        const chunk = lines.slice(0, Math.max(1, Math.min(lines.length, room)))
        doc.text(chunk, margin, fy + 4)
        fy += chunk.length * noteLineH
        lines = lines.slice(chunk.length)
        if (lines.length > 0) {
          doc.addPage()
          fy = 20
          room = pageCapacity
        }
      }
      fy += 3
    }
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(26, 26, 26)
    return fy
  }

  let cursorY = contentTop

  // Summary as a simple key/value list under the "Resumen del período" heading.
  if (summary && summary.length > 0) {
    const top = heading('Resumen del período', cursorY)
    cursorY = drawSummary(summary, top) + 8
  }

  // Main table (skipped when there's no data — e.g. a summary-only report whose
  // detail lives entirely in the extra sections).
  let endY = data.length > 0 ? drawTable(columns, data, cursorY) : cursorY

  // Optional extra tables (e.g. movimientos de caja, detalle de ventas) below
  // the main one, each with its own brand-red heading.
  for (const section of extraSections ?? []) {
    if (section.rows.length === 0) continue
    const top = heading(section.title, endY + 8)
    endY = drawTable(section.columns, section.rows, top)
  }

  // Footer. With branding, a clean page-bottom footer (separator + business name
  // + "Página X de Y") on every page; otherwise the original inline footer.
  if (branding) {
    const pageHeight = doc.internal.pageSize.getHeight()
    const pageCount = doc.getNumberOfPages()
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i)
      doc.setDrawColor(220, 220, 220)
      doc.setLineWidth(0.3)
      doc.line(margin, pageHeight - 12, pageWidth - margin, pageHeight - 12)
      doc.setFontSize(8)
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(120, 120, 120)
      doc.text(branding.businessName, margin, pageHeight - 7)
      doc.text(`Página ${i} de ${pageCount}`, pageWidth - margin, pageHeight - 7, {
        align: 'right'
      })
    }
  } else {
    if (endY + 12 > maxY) {
      doc.addPage()
      endY = 12
    }
    doc.setFontSize(8)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(107, 107, 107)
    if (data.length > 0) doc.text(`Total registros: ${data.length}`, margin, endY + 10)
    doc.text('Multicarnes S.R.L.', pageWidth - margin, endY + 10, { align: 'right' })
  }

  doc.save(`${filename}.pdf`)
}
