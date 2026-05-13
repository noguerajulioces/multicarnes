// 006-card-payments: single source of truth for card-payment processors
// (acquirers / POS terminals + future QR processors). Add a new processor
// here AND extend the CHECK constraint in src/main/db/schema.ts + a new
// migration to allow the value at the DB level.
//
// Logos: drop SVG/PNG files into src/renderer/src/assets/processors/ and
// uncomment the import + `logo` property below. The UI renders the logo
// when present and falls back to the text label when not.

import type { PaymentProcessor } from '@shared/types'

// Uncomment these imports once the logo files are in place. Vite will fail
// the build if the file path doesn't exist, which is the intended guard.
// import bancardLogo from '../assets/processors/bancard.svg'
// import dinelcoLogo from '../assets/processors/dinelco.svg'
// import upayLogo from '../assets/processors/upay.svg'

export interface ProcessorOption {
  value: PaymentProcessor
  label: string
  logo?: string
}

export const PROCESSORS: ProcessorOption[] = [
  { value: 'bancard', label: 'Bancard' /*, logo: bancardLogo */ },
  { value: 'dinelco', label: 'Dinelco' /*, logo: dinelcoLogo */ },
  { value: 'upay', label: 'Upay' /*, logo: upayLogo */ }
]

export const PROCESSOR_LABEL: Record<string, string> = Object.fromEntries(
  PROCESSORS.map((p) => [p.value, p.label])
)

export function processorLabel(value: string | null | undefined): string {
  if (!value) return ''
  return PROCESSOR_LABEL[value] ?? value
}
