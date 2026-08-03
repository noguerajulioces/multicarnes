// Ships a raw byte payload to a system printer queue, bypassing every driver
// rendering stage so ESC/POS commands reach the print head untouched.
//
// There is no cross-platform API for this in Electron or Node, so each OS gets
// its own ~10-line branch. The macOS branch is not incidental: it is what makes
// the ESC/POS path testable on the dev machine before it ships to the client's
// Windows box.

import { spawn } from 'node:child_process'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { app } from 'electron'

// Generous: on Windows every call spawns a fresh powershell.exe, so the
// `Add-Type` P/Invoke shim is JIT-compiled on *every* ticket, not just the
// first — budget a second or two for that, plus a printer that is off keeping
// the spooler call waiting. printEscPos logs the elapsed time per job so the
// real cost is measurable in the field before optimising it away (caching the
// compiled assembly, or holding a long-lived runspace, both add moving parts).
const JOB_TIMEOUT_MS = 15_000

function helperScriptPath(): string {
  // `resources/**` is asarUnpack'd (electron-builder.yml), but PowerShell is an
  // external process — it cannot read through the asar the way Electron's
  // patched fs can, so it needs the real unpacked path.
  return app.isPackaged
    ? join(process.resourcesPath, 'app.asar.unpacked', 'resources', 'raw-print.ps1')
    : join(__dirname, '../../resources/raw-print.ps1')
}

function run(command: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { windowsHide: true })
    let stderr = ''
    let settled = false

    const finish = (err?: Error): void => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      if (err) reject(err)
      else resolve()
    }

    const timer = setTimeout(() => {
      child.kill()
      finish(new Error(`"${command}" no respondió en ${JOB_TIMEOUT_MS / 1000}s.`))
    }, JOB_TIMEOUT_MS)

    child.stderr?.on('data', (chunk) => {
      stderr += String(chunk)
    })
    child.on('error', (err) =>
      finish(
        // ENOENT here means the tool itself is missing, which is a very
        // different problem from a printing failure — say so.
        (err as NodeJS.ErrnoException).code === 'ENOENT'
          ? new Error(`No se encontró "${command}" en el sistema.`)
          : err
      )
    )
    child.on('close', (code) =>
      finish(
        code === 0
          ? undefined
          : new Error(stderr.trim() || `"${command}" terminó con código ${code}.`)
      )
    )
  })
}

export async function sendRaw(printerName: string, data: Buffer): Promise<void> {
  const dir = await mkdtemp(join(tmpdir(), 'mc-print-'))
  const file = join(dir, 'ticket.bin')
  try {
    await writeFile(file, data)
    if (process.platform === 'win32') {
      await run('powershell.exe', [
        '-NoProfile',
        '-NonInteractive',
        '-ExecutionPolicy',
        'Bypass',
        '-File',
        helperScriptPath(),
        '-Printer',
        printerName,
        '-Path',
        file
      ])
    } else {
      // CUPS: -o raw skips the filter chain, so the bytes hit the device as-is.
      await run('lp', ['-d', printerName, '-o', 'raw', file])
    }
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => {})
  }
}
