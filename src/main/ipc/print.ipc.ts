import { BrowserWindow, type IpcMainInvokeEvent } from 'electron'
import { getDb } from '../db'
import { registerAuthorized, listRegisteredChannels } from '../auth/guard'
import { getRule } from '../auth/matrix'

interface PrintLine {
  text: string
  bold?: boolean
  emphasized?: boolean
}

interface PrintTicketPayload {
  lines: PrintLine[]
  cut?: boolean
}

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

// Paper geometry per width setting. `printMm` is the printable head width; it
// sizes the monospace font so that exactly `cols` Courier characters fill the
// line (Courier advance width is 0.6em), keeping the HTML output aligned the
// same way the ESC/POS path used to pad it. `paperMm` is the physical roll
// width, used as the print page width.
const PAPER = {
  '58': { paperMm: 58, printMm: 48, cols: 32 },
  '80': { paperMm: 80, printMm: 72, cols: 48 }
} as const

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function buildTicketHtml(lines: PrintLine[], widthKey: '58' | '80'): string {
  const geo = PAPER[widthKey]
  const fontMm = geo.printMm / (geo.cols * 0.6)
  const body = lines
    .map((l) => {
      const txt = escapeHtml(l.text) || '&nbsp;'
      const weight = l.bold || l.emphasized ? 'font-weight:700;' : ''
      return `<div style="${weight}">${txt}</div>`
    })
    .join('')
  return `<!doctype html><html><head><meta charset="utf-8"><style>
    @page { margin: 0 }
    * { box-sizing: border-box }
    html, body { margin: 0; padding: 0 }
    body {
      width: ${geo.printMm}mm;
      font-family: 'Courier New', Courier, monospace;
      font-size: ${fontMm.toFixed(3)}mm;
      line-height: 1.15;
      color: #000;
      white-space: pre;
      -webkit-font-smoothing: none;
    }
    div { width: 100%; }
  </style></head><body>${body}</body></html>`
}

// 009-printing-electron: print receipts through Electron's own print path
// (`webContents.print` to a system printer) instead of raw ESC/POS. The named
// printer is selected by the user in Configuración from the list returned by
// `print:listPrinters`. This removes the native `node-thermal-printer` driver,
// which never loaded on Electron 39, and reuses the OS driver that already
// prints the Windows test page.
async function printTicket(payload: PrintTicketPayload): Promise<PrintResult> {
  const printerName = getSetting('thermal_printer_name')
  if (!printerName) {
    return {
      ok: false,
      error: 'No hay impresora configurada. Andá a Configuración → Impresora térmica.'
    }
  }
  const widthKey: '58' | '80' = getSetting('thermal_printer_width') === '58' ? '58' : '80'
  const geo = PAPER[widthKey]
  const html = buildTicketHtml(payload.lines, widthKey)

  const win = new BrowserWindow({
    show: false,
    webPreferences: { offscreen: false, sandbox: true, contextIsolation: true }
  })

  try {
    await win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html))

    // Size the page to the rendered content so there's no trailing blank paper
    // before the cut. px -> microns: px / 96dpi * 25400 microns/inch.
    const heightPx = (await win.webContents.executeJavaScript(
      'document.body.scrollHeight'
    )) as number
    const TAIL_MM = 4 // small feed so the last line clears the cutter
    const heightMicrons = Math.max(Math.round((heightPx / 96) * 25400 + TAIL_MM * 1000), 10000)
    const widthMicrons = geo.paperMm * 1000

    return await new Promise<PrintResult>((resolve) => {
      win.webContents.print(
        {
          silent: true,
          deviceName: printerName,
          color: false,
          margins: { marginType: 'none' },
          pageSize: { width: widthMicrons, height: heightMicrons }
        },
        (success, failureReason) => {
          if (success) {
            resolve({ ok: true })
          } else {
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
