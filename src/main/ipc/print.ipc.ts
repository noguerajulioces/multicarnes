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

export function registerPrintIpc(): void {
  ipcMain.handle('print:ticket', async (_, payload: PrintTicketPayload) => {
    const printerName = getSetting('thermal_printer_name')
    if (!printerName) {
      throw new Error(
        'No hay impresora configurada. Andá a Configuración → Impresora térmica.'
      )
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

    const isConnected = await printer.isPrinterConnected()
    if (!isConnected) {
      throw new Error(
        `No se pudo conectar a la impresora "${printerName}". Verificá que esté encendida y configurada.`
      )
    }

    for (const line of payload.lines) {
      if (line.bold) printer.bold(true)
      printer.println(line.text)
      if (line.bold) printer.bold(false)
    }

    if (payload.cut !== false) {
      printer.cut()
    }

    await printer.execute()
    return { ok: true }
  })

  ipcMain.handle('print:hasConfig', () => {
    return Boolean(getSetting('thermal_printer_name'))
  })
}
