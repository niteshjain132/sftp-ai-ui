export type ParsedFilename = {
  code: string
  cadence: string
  businessDate: string
  ext: string
}

const PATTERN = /^([^.]+)\.([^.]+)\.(\d{8})\.(.+)$/

export function parseFilename(filename: string): ParsedFilename | null {
  const match = PATTERN.exec(filename)
  if (!match) return null
  const [, code, cadenceRaw, ymd, ext] = match
  const cadence = cadenceRaw.toUpperCase() === 'HTML' ? 'HTML' : cadenceRaw.toUpperCase()
  return {
    code,
    cadence,
    businessDate: `${ymd.slice(0, 4)}-${ymd.slice(4, 6)}-${ymd.slice(6, 8)}`,
    ext,
  }
}

export function toYmd(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}${m}${d}`
}

export function formatFilename(code: string, cadence: string, date: Date, ext: string): string {
  const mid = cadence === 'HTML' ? 'html' : cadence
  return `${code}.${mid}.${toYmd(date)}.${ext}`
}
