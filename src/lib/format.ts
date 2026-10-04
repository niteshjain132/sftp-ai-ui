export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

export function formatDelta(value: number, suffix = ''): string {
  const sign = value > 0 ? '+' : ''
  return `${sign}${value}${suffix}`
}

export function formatCountdown(ms: number): string {
  const abs = Math.abs(ms)
  const overdue = ms < 0
  const totalSec = Math.floor(abs / 1000)
  const h = Math.floor(totalSec / 3600)
  const m = Math.floor((totalSec % 3600) / 60)
  const s = totalSec % 60
  const clock = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  return overdue ? `+${clock}` : clock
}

export function formatTimeCST(iso: string | null | Date): string {
  if (!iso) return '—'
  const d = typeof iso === 'string' ? new Date(iso) : iso
  return (
    new Intl.DateTimeFormat('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      timeZone: 'America/Chicago',
    }).format(d) + ' CST'
  )
}

export function formatDateTimeCST(iso: string | null | Date): string {
  if (!iso) return '—'
  const d = typeof iso === 'string' ? new Date(iso) : iso
  return (
    new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      timeZone: 'America/Chicago',
    }).format(d) + ' CST'
  )
}

export function formatWhen(iso: string | null): string {
  if (!iso) return '—'
  return formatDateTimeCST(iso)
}

export function cssVar(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim()
}
