import { BrowserWindow, type IpcMainInvokeEvent } from 'electron'
import log from 'electron-log'
import { getDb } from '../db'
import { registerAuthorized, listRegisteredChannels } from '../auth/guard'
import { getRule } from '../auth/matrix'
import { buildEscPosTicket, type PrintLine } from '../print/escpos'
import { sendRaw } from '../print/raw-transport'

interface PrintTicketPayload {
  lines: PrintLine[]
  cut?: boolean
}

// 'escpos' drives the print head directly with native text commands; 'raster'
// is the legacy path that rasterizes HTML through the OS driver, kept as a
// one-click fallback (Configuración → Modo de impresión) for printers or
// drivers that refuse raw spool jobs.
type PrintMode = 'escpos' | 'raster'

interface PrinterChoice {
  name: string
  displayName: string
}

function getSetting(key: string): string {
  const row = getDb().prepare('SELECT value FROM app_settings WHERE key = ?').get(key) as
    | { value: string }
    | undefined
  return row?.value ?? ''
}

type PrintResult = { ok: true } | { ok: false; error: string }

// Paper geometry per width setting. `cols` is the only field the ESC/POS path
// reads — it matches Epson's Font A cell (12 dots wide, so 576/12 = 48 columns
// on an 80 mm roll) and is what renderTicket already padded every line to.
//
// The rest is raster-only. `printMm` is the printable head width; it sizes the
// monospace font so that exactly `cols` characters fill the line (the initial
// estimate assumes a 0.6em advance, and printRaster re-fits it to the measured
// advance of whichever family resolves). `paperMm` is the physical roll width,
// used as the print page width.
const PAPER = {
  '58': { paperMm: 58, printMm: 48, cols: 32 },
  '80': { paperMm: 80, printMm: 72, cols: 48 }
} as const

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

// Courier (thick, even strokes) survives a 1-bit thermal head better than a
// ClearType screen face like Consolas, whose thin strokes binarize to broken
// glyphs. -webkit-font-smoothing is deliberately absent: it is a macOS-only
// no-op on the client's Windows machine and gave a false sense of stroke
// control.
//
// The body used to carry font-weight:700. At this size every glyph bled into
// its 12-dot cell — which reads as blurry rather than bold — and it flattened
// the per-line `bold` flag into a no-op, so TOTAL and the dividers stood out
// from nothing. Weight is per line again.
function buildTicketHtml(lines: PrintLine[], widthKey: '58' | '80'): string {
  const geo = PAPER[widthKey]
  const fontMm = geo.printMm / (geo.cols * 0.6)
  // The head only prints the centered `printMm` band of the roll, but page
  // x=0 maps to the physical paper edge — offset the body by the hardware
  // margin or the first ~2-3 characters land in the unprintable zone.
  // Centering (instead of shrinking the page to printMm) is symmetric, so it
  // also survives drivers that rotate the page 180°.
  const sideMm = (geo.paperMm - geo.printMm) / 2
  const body = lines
    .map((l) => {
      const weight = l.bold || l.emphasized ? 'font-weight:700;' : ''
      // `emphasized` used to collapse into plain bold, so the TOTAL printed at
      // body size while the preview promised a larger line. Scaling l.text is
      // not an option — renderTicket already space-padded it to the full `cols`,
      // so a bigger font would overflow the printable band and clip the amount.
      // Re-lay it out from `parts` with flex instead, exactly like the on-screen
      // preview does (see Ticket.tsx). Without parts, stay at body size.
      if (l.emphasized && l.parts) {
        return (
          `<div style="${weight}font-size:1.6em;display:flex;justify-content:space-between;">` +
          `<span>${escapeHtml(l.parts.left)}</span><span>${escapeHtml(l.parts.right)}</span>` +
          `</div>`
        )
      }
      return `<div style="${weight}">${escapeHtml(l.text) || '&nbsp;'}</div>`
    })
    .join('')
  return `<!doctype html><html><head><meta charset="utf-8"><style>
    @page { margin: 0 }
    * { box-sizing: border-box }
    html, body { margin: 0; padding: 0 }
    body {
      width: ${geo.printMm}mm;
      margin-left: ${sideMm}mm;
      font-family: 'Courier New', Courier, monospace;
      font-size: ${fontMm.toFixed(3)}mm;
      line-height: 1.15;
      color: #000;
      white-space: pre;
    }
    div { width: 100%; }
  </style></head><body>${body}</body></html>`
}

// Send the ticket as native ESC/POS text through the OS spooler as a RAW job.
// This is the default: the head renders its own crisp Font A glyphs, emits a
// real paper cut, and never hands a page to a driver that might rotate it —
// the three symptoms the raster path below could not fix.
async function printEscPos(
  printerName: string,
  widthKey: '58' | '80',
  payload: PrintTicketPayload
): Promise<PrintResult> {
  const { cols } = PAPER[widthKey]
  const data = buildEscPosTicket(payload.lines, { cols, cut: payload.cut !== false })
  // electron-log, not console: a packaged Windows build has no console attached,
  // so console.* output is unrecoverable. This goes to the app's log file, which
  // is the only way to diagnose a printer fault at a client site remotely.
  // The elapsed time is logged deliberately — on Windows every ticket spawns a
  // fresh powershell.exe that JIT-compiles the P/Invoke helper, and this is the
  // number that says whether that per-ticket cost is acceptable at the counter.
  log.info(`[print] escpos ${data.length} bytes, ${cols} cols -> "${printerName}"`)
  const startedAt = Date.now()
  try {
    await sendRaw(printerName, data)
    log.info(`[print] escpos ok in ${Date.now() - startedAt}ms`)
    return { ok: true }
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err)
    log.error(`[print] escpos failed after ${Date.now() - startedAt}ms: ${detail}`)
    return {
      ok: false,
      error: `No se pudo imprimir en "${printerName}": ${detail} — si persiste, probá el modo Gráfico en Configuración.`
    }
  }
}

// Legacy fallback: rasterize the ticket to HTML and print it through the OS
// driver. Kept intact behind the 'raster' mode because it is the escape hatch
// when a driver rejects raw spool jobs.
async function printRaster(
  printerName: string,
  widthKey: '58' | '80',
  payload: PrintTicketPayload
): Promise<PrintResult> {
  const geo = PAPER[widthKey]
  const html = buildTicketHtml(payload.lines, widthKey)

  const win = new BrowserWindow({
    show: false,
    webPreferences: { offscreen: false, sandbox: true, contextIsolation: true }
  })

  try {
    await win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html))

    // Fit the font to the measured glyph advance of whichever family resolved
    // (Courier ~0.6em) so exactly `cols` characters span the printable band,
    // then size the page to the real content height.
    // getBoundingClientRect() keeps fractional line-box heights (scrollHeight
    // rounds) and is immune to viewport-height quirks across platforms.
    // px -> microns: px / 96dpi * 25400 microns/inch.
    const fitAndMeasure = `(() => {
      const probe = document.createElement('span');
      probe.textContent = 'M'.repeat(100);
      document.body.appendChild(probe);
      const advancePx = probe.getBoundingClientRect().width / 100;
      probe.remove();
      const targetAdvancePx = (${geo.printMm} / 25.4) * 96 / ${geo.cols};
      const currentPx = parseFloat(getComputedStyle(document.body).fontSize);
      if (advancePx > 0) {
        document.body.style.fontSize = (currentPx * targetAdvancePx / advancePx) + 'px';
      }
      return Math.ceil(document.body.getBoundingClientRect().height);
    })()`
    const heightPx = (await win.webContents.executeJavaScript(fitAndMeasure)) as number
    // Feed so the last line clears the head-to-cutter gap, which is ~13.5 mm on
    // a TM-T20III. At the previous 8 mm a driver-side auto-cut sliced through
    // the closing "¡Gracias por su compra!" line. (The ESC/POS path has no such
    // constant: GS V 66 lets the firmware feed to its own cutting position.)
    const TAIL_MM = 15
    const widthMicrons = geo.paperMm * 1000
    // Floor the height at the paper width: Chromium treats a custom page with
    // height < width as landscape, and some drivers then fall back to their
    // fixed default form (constant-length receipts with a long blank feed).
    // Very short tickets just gain a few mm of tail instead.
    const heightMicrons = Math.max(
      Math.round((heightPx / 96) * 25400 + TAIL_MM * 1000),
      widthMicrons
    )
    log.info(
      `[print] raster content ${heightPx}px -> page ${(heightMicrons / 1000).toFixed(1)}mm x ${geo.paperMm}mm on "${printerName}"`
    )

    return await new Promise<PrintResult>((resolve) => {
      win.webContents.print(
        {
          silent: true,
          deviceName: printerName,
          color: false,
          // Rasterize at the TM-T20IIIL's native 203 dpi (8 dots/mm). Without
          // this, silent print falls back to a low default DPI that the driver
          // then upscales to the head, yielding faint/blurry text. Never pass 0
          // here — Electron rejects the print with "invalid DPI dimensions".
          dpi: { horizontal: 203, vertical: 203 },
          margins: { marginType: 'none' },
          pageSize: { width: widthMicrons, height: heightMicrons }
        },
        (success, failureReason) => {
          if (success) {
            resolve({ ok: true })
          } else {
            log.error(`[print] raster failed on "${printerName}": ${failureReason}`)
            resolve({
              ok: false,
              error:
                failureReason && failureReason !== 'cancelled'
                  ? `No se pudo imprimir en "${printerName}": ${failureReason}`
                  : `No se pudo imprimir en "${printerName}". Verificá que esté encendida y seleccionada.`
            })
          }
        }
      )
    })
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Falló la impresión del ticket.'
    }
  } finally {
    if (!win.isDestroyed()) win.destroy()
  }
}

// `app_settings` is a key-value table and getSetting returns '' for a missing
// key, so existing installs adopt ESC/POS without a migration or a backfill.
function getMode(): PrintMode {
  return getSetting('thermal_printer_mode') === 'raster' ? 'raster' : 'escpos'
}

async function printTicket(payload: PrintTicketPayload): Promise<PrintResult> {
  const printerName = getSetting('thermal_printer_name')
  if (!printerName) {
    return {
      ok: false,
      error: 'No hay impresora configurada. Andá a Configuración → Impresora térmica.'
    }
  }
  const widthKey: '58' | '80' = getSetting('thermal_printer_width') === '58' ? '58' : '80'
  return getMode() === 'escpos'
    ? printEscPos(printerName, widthKey, payload)
    : printRaster(printerName, widthKey, payload)
}

async function listPrinters(event: IpcMainInvokeEvent): Promise<PrinterChoice[]> {
  const printers = await event.sender.getPrintersAsync()
  return printers.map((p) => ({ name: p.name, displayName: p.displayName || p.name }))
}

export function registerPrintIpc(): string[] {
  const before = listRegisteredChannels().length
  registerAuthorized(
    'print:ticket',
    getRule('print:ticket'),
    (_event, _ctx, payload: PrintTicketPayload) => printTicket(payload)
  )
  registerAuthorized('print:hasConfig', getRule('print:hasConfig'), () =>
    Boolean(getSetting('thermal_printer_name'))
  )
  registerAuthorized('print:listPrinters', getRule('print:listPrinters'), (event) =>
    listPrinters(event)
  )
  return listRegisteredChannels().slice(before)
}
