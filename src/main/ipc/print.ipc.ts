import { ipcMain } from 'electron'
import { printer as ThermalPrinter, types as PrinterTypes } from 'node-thermal-printer'
import { getDb } from '../db'

interface PrintLine {
  text: string
  bold?: boolean
  emphasized?: boolean
}

interface PrintTicketPayload {
  lines: PrintLine[]
  cut?: boolean
}

function getSetting(key: string): string {
  const row = getDb().prepare('SELECT value FROM app_settings WHERE key = ?').get(key) as
    | { value: string }
    | undefined
  return row?.value ?? ''
}

type PrintResult = { ok: true } | { ok: false; error: string }

async function printTicket(payload: PrintTicketPayload): Promise<PrintResult> {
  const printerName = getSetting('thermal_printer_name')
  if (!printerName) {
    return {
      ok: false,
      error: 'No hay impresora configurada. Andá a Configuración → Impresora térmica.'
    }
  }
  const widthSetting = getSetting('thermal_printer_width') || '80'
  const widthChars = widthSetting === '58' ? 32 : 48

  const printer = new ThermalPrinter({
    type: PrinterTypes.EPSON,
    interface: `printer:${printerName}`,
    width: widthChars,
    removeSpecialCharacters: false,
    lineCharacter: '-'
  })

  let isConnected = false
  try {
    isConnected = await printer.isPrinterConnected()
  } catch {
    isConnected = false
  }
  if (!isConnected) {
    return {
      ok: false,
      error: `No se pudo conectar a la impresora "${printerName}". Verificá que esté encendida.`
    }
  }

  try {
    for (const line of payload.lines) {
      if (line.bold) printer.bold(true)
      printer.println(line.text)
      if (line.bold) printer.bold(false)
    }
    if (payload.cut !== false) printer.cut()
    await printer.execute()
    return { ok: true }
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Falló la impresión del ticket.'
    }
  }
}

export function registerPrintIpc(): void {
  ipcMain.handle('print:ticket', (_, payload: PrintTicketPayload) => printTicket(payload))
  ipcMain.handle('print:hasConfig', () => Boolean(getSetting('thermal_printer_name')))
}
