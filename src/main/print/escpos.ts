// ESC/POS byte builder for Epson TM-series thermal printers.
//
// Why this exists: PR #26 abandoned ESC/POS because `node-thermal-printer` needs
// a native addon (`@thiagoelg/node-printer`) with no prebuilds for Electron 39's
// ABI. But ESC/POS is just bytes — we emit them here and hand them to the OS
// spooler as a RAW job (see ./raw-transport). No npm dependency, no native
// module, no ABI problem.
//
// Printing native text instead of rasterizing HTML through the OS driver is what
// fixes three field symptoms at once on the client's TM-T20IIIL: the head renders
// its own Font A 12x24 glyphs (sharp by construction — nothing antialiased for a
// 1-bit head to binarize into broken strokes), GS V emits a real cut, and there
// is no page for a driver to rotate 180 degrees.
//
// Command reference: EPSON ESC/POS Command Reference (TM-T20III / TM-T20IIIL).

export interface PrintLine {
  text: string
  bold?: boolean
  emphasized?: boolean
  // Emphasized lines print at double width, which halves the usable column
  // count, so the space padding renderTicket computed for the base size no
  // longer aligns. `parts` carries the two halves so the line can be re-padded
  // to cols / 2. See renderTicket in src/renderer/src/lib/ticket.ts.
  parts?: { left: string; right: string }
}

export interface EscPosOptions {
  cols: number
  cut: boolean
}

const ESC = 0x1b
const GS = 0x1d
const LF = 0x0a

const INIT = Buffer.from([ESC, 0x40]) // ESC @ — reset to a known state
const CODEPAGE_WPC1252 = Buffer.from([ESC, 0x74, 16]) // ESC t 16
// ESC E 1, emitted once for the whole ticket rather than per line. On a thermal
// head emphasized mode reinforces each dot column, so it darkens genuinely —
// the field complaint was washed-out grey text. This is NOT the mistake the
// raster path made with a blanket font-weight:700: there a rasterized glyph
// bled into its cell and read as blur, here the head prints its own dot matrix.
//
// The trade is that the per-line `bold` flag no longer distinguishes anything
// in this mode. That costs little — the receipt's hierarchy comes from TOTAL
// printing at double size, not from bold. `PrintLine.bold` is still honoured by
// the raster fallback in print.ipc.ts.
const EMPHASIS_ON = Buffer.from([ESC, 0x45, 1])
// GS ! n, where n = (widthMultiplier - 1) << 4 | (heightMultiplier - 1).
const SIZE_DOUBLE_BOTH = Buffer.from([GS, 0x21, 0x11])
const SIZE_DOUBLE_HEIGHT = Buffer.from([GS, 0x21, 0x01])
const SIZE_NORMAL = Buffer.from([GS, 0x21, 0x00])
// GS V 66 0 — feed to the cutting position, then partial cut. The firmware knows
// its own head-to-cutter distance (~13.5 mm on a TM-T20III), which is exactly the
// guesswork the raster path's hand-tuned TAIL_MM was trying to approximate.
const FEED_AND_CUT = Buffer.from([GS, 0x56, 66, 0])
const NEWLINE = Buffer.from([LF])

// Text goes out as latin1, whose 0xA0-0xFF range is byte-identical to WPC1252 —
// that covers every accent Spanish needs (a-acute 0xE1, n-tilde 0xF1, inverted
// bang 0xA1, inverted question 0xBF). Anything above U+00FF is SILENTLY
// TRUNCATED by Buffer.from(s, 'latin1'): an em dash U+2014 would become byte
// 0x14, a control code the printer may interpret. So fold the typographic
// characters this app actually emits down to ASCII first.
//
// Spelled as escapes rather than literals: several of these are invisible or
// indistinguishable from their ASCII counterparts in an editor.
const TRANSLITERATIONS: [RegExp, string][] = [
  [/[‐-―]/g, '-'], // hyphen variants, en dash, em dash
  [/[‘’‚‛]/g, "'"], // curly single quotes
  [/[“”„‟]/g, '"'], // curly double quotes
  [/…/g, '...'], // ellipsis
  [/₲/g, 'Gs.'], // guarani sign
  [/€/g, 'EUR'], // euro sign
  [/[\u00a0\u2007\u2009\u202f]/g, ' '], // non-breaking / thin spaces
  [/[•·]/g, '*'] // bullets
]

// Keep printable ASCII plus the latin1 upper range. Everything else — including
// C0/C1 control codes, which the printer would read as commands — becomes '?'.
const UNPRINTABLE = /[^\x20-\x7e\u00a0-\u00ff]/g

export function sanitizeForPrinter(text: string): string {
  let out = text
  for (const [pattern, replacement] of TRANSLITERATIONS) {
    out = out.replace(pattern, replacement)
  }
  return out.replace(UNPRINTABLE, '?')
}

function encode(text: string): Buffer {
  return Buffer.from(sanitizeForPrinter(text), 'latin1')
}

function padRow(left: string, right: string, cols: number): string {
  const gap = cols - left.length - right.length
  if (gap < 1) return `${left} ${right}`.slice(0, cols)
  return left + ' '.repeat(gap) + right
}

function renderLine(line: PrintLine, cols: number): Buffer {
  const chunks: Buffer[] = []

  // Double *width* halves the column count, so it is only safe when `parts` lets
  // us re-lay the line out. Without parts we still honour `emphasized` with
  // double *height*, which leaves the pre-computed padding valid.
  const doubleCols = Math.floor(cols / 2)
  const canDoubleWidth =
    !!line.emphasized &&
    !!line.parts &&
    line.parts.left.length + line.parts.right.length + 1 <= doubleCols

  if (canDoubleWidth) chunks.push(SIZE_DOUBLE_BOTH)
  else if (line.emphasized) chunks.push(SIZE_DOUBLE_HEIGHT)

  chunks.push(
    encode(canDoubleWidth ? padRow(line.parts!.left, line.parts!.right, doubleCols) : line.text)
  )

  if (line.emphasized) chunks.push(SIZE_NORMAL)
  chunks.push(NEWLINE)

  return Buffer.concat(chunks)
}

// renderTicket already centres and column-pads every line with spaces, so the
// printer's default left alignment reproduces it exactly — no ESC a needed, and
// no page geometry either, since the head applies its own hardware margins.
export function buildEscPosTicket(lines: PrintLine[], opts: EscPosOptions): Buffer {
  const chunks: Buffer[] = [INIT, CODEPAGE_WPC1252, EMPHASIS_ON]
  for (const line of lines) chunks.push(renderLine(line, opts.cols))
  if (opts.cut) chunks.push(FEED_AND_CUT)
  return Buffer.concat(chunks)
}
