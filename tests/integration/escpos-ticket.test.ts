import { describe, expect, test } from 'vitest'
import { buildEscPosTicket, sanitizeForPrinter, type PrintLine } from '../../src/main/print/escpos'

const INIT = Buffer.from([0x1b, 0x40])
const CODEPAGE = Buffer.from([0x1b, 0x74, 0x10])
const EMPHASIS_ON = Buffer.from([0x1b, 0x45, 0x01])
const EMPHASIS_OFF = Buffer.from([0x1b, 0x45, 0x00])
const DOUBLE_BOTH = Buffer.from([0x1d, 0x21, 0x11])
const DOUBLE_HEIGHT = Buffer.from([0x1d, 0x21, 0x01])
const SIZE_NORMAL = Buffer.from([0x1d, 0x21, 0x00])
const CUT = Buffer.from([0x1d, 0x56, 0x42, 0x00])

function build(lines: PrintLine[], cols = 48, cut = false): Buffer {
  return buildEscPosTicket(lines, { cols, cut })
}

describe('buildEscPosTicket', () => {
  test('opens with reset + WPC1252 code page + emphasis', () => {
    const out = build([{ text: 'hola' }])
    expect(out.subarray(0, 8)).toEqual(Buffer.concat([INIT, CODEPAGE, EMPHASIS_ON]))
  })

  test('terminates every line with LF', () => {
    const out = build([{ text: 'a' }, { text: 'b' }])
    expect(out.toString('latin1')).toBe('\x1b@\x1bt\x10\x1bE\x01a\nb\n')
  })

  // Emphasis darkens washed-out grey output and is set once for the whole
  // ticket, so it must never be toggled back off mid-receipt.
  test('never turns emphasis off', () => {
    const out = build([{ text: 'a', bold: true }, { text: 'b' }, { text: 'c', bold: true }])
    expect(out.includes(EMPHASIS_OFF)).toBe(false)
  })

  test('emits emphasis exactly once regardless of per-line bold flags', () => {
    const out = build([{ text: 'a', bold: true }, { text: 'b' }, { text: 'c', bold: true }])
    const occurrences = out.toString('latin1').split('\x1bE\x01').length - 1
    expect(occurrences).toBe(1)
  })

  describe('emphasized lines', () => {
    // renderTicket space-pads `text` for the base column count, so a
    // double-width line has to be rebuilt from `parts` or it would wrap.
    const total: PrintLine = {
      text: 'TOTAL Gs.'.padEnd(41) + '123.456',
      bold: true,
      emphasized: true,
      parts: { left: 'TOTAL Gs.', right: '123.456' }
    }

    test('re-pads to half the columns at double width', () => {
      const out = build([total]).toString('latin1')
      expect(out).toContain('\x1d\x21\x11')
      // 9 + 8 spaces + 7 = 24 columns, half of 48.
      expect(out).toContain('TOTAL Gs.        123.456')
      expect(out).not.toContain('TOTAL Gs.'.padEnd(41))
    })

    test('restores normal size afterwards', () => {
      const out = build([total])
      expect(out.includes(SIZE_NORMAL)).toBe(true)
      expect(out.indexOf(SIZE_NORMAL)).toBeGreaterThan(out.indexOf(DOUBLE_BOTH))
    })

    test('honours the 58 mm column count', () => {
      const short: PrintLine = {
        text: 'TOTAL'.padEnd(25) + '7.000',
        emphasized: true,
        parts: { left: 'TOTAL', right: '7.000' }
      }
      // 5 + 6 spaces + 5 = 16 columns, half of 32.
      expect(build([short], 32).toString('latin1')).toContain('TOTAL      7.000')
    })

    test('needs a separating space, not just a fit, before doubling width', () => {
      // 9 + 7 exactly fills 16 columns, leaving no gap — padRow would have to
      // truncate, so the line drops to double height instead.
      const out = build([total], 32)
      expect(out.includes(DOUBLE_HEIGHT)).toBe(true)
      expect(out.includes(DOUBLE_BOTH)).toBe(false)
      expect(out.toString('latin1')).toContain(total.text)
    })

    test('falls back to double height when parts are absent', () => {
      const out = build([{ text: 'x'.repeat(48), emphasized: true }])
      expect(out.includes(DOUBLE_HEIGHT)).toBe(true)
      expect(out.includes(DOUBLE_BOTH)).toBe(false)
    })

    test('falls back to double height when the parts do not fit', () => {
      const out = build([
        {
          text: 'x',
          emphasized: true,
          parts: { left: 'A'.repeat(20), right: 'B'.repeat(20) }
        }
      ])
      expect(out.includes(DOUBLE_HEIGHT)).toBe(true)
      expect(out.includes(DOUBLE_BOTH)).toBe(false)
    })
  })

  describe('cut', () => {
    test('appends GS V 66 0 when requested', () => {
      expect(build([{ text: 'x' }], 48, true).subarray(-4)).toEqual(CUT)
    })

    test('omits it otherwise', () => {
      expect(build([{ text: 'x' }], 48, false).includes(CUT)).toBe(false)
    })
  })

  describe('character encoding', () => {
    test('maps Spanish accents to their WPC1252 bytes', () => {
      const out = build([{ text: 'Niño área ¿Qué? ¡Sí!' }])
      expect(out.includes(0xf1)).toBe(true) // ñ
      expect(out.includes(0xe1)).toBe(true) // á
      expect(out.includes(0xbf)).toBe(true) // ¿
      expect(out.includes(0xa1)).toBe(true) // ¡
    })

    test('never emits a byte that latin1 truncated from a wider code point', () => {
      // Buffer.from('—', 'latin1') silently yields 0x14, a control code the
      // printer would try to interpret. Transliteration has to run first.
      const out = build([{ text: 'a — b … c ₲' }])
      expect(out.includes(0x14)).toBe(false)
      expect(out.toString('latin1')).toContain('a - b ... c Gs.')
    })

    test('replaces control characters rather than passing them to the head', () => {
      const out = build([{ text: 'a\x1bb\x00c' }])
      expect(out.toString('latin1')).toContain('a?b?c')
    })

    test('produces only single bytes', () => {
      const out = build([{ text: 'emoji 😀 ok' }])
      expect(out.every((b) => b >= 0 && b <= 0xff)).toBe(true)
    })
  })
})

describe('sanitizeForPrinter', () => {
  test('leaves plain ASCII and latin1 accents alone', () => {
    const text = 'TICKET #12  Gs. 45.000  áéíóúñÑ°'
    expect(sanitizeForPrinter(text)).toBe(text)
  })

  test('preserves the space padding renderTicket relies on', () => {
    expect(sanitizeForPrinter('a' + ' '.repeat(30) + 'b')).toHaveLength(32)
  })
})
