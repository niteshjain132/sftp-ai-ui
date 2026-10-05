import { formatFilename } from '../lib/filename'
import type { AlertItem, Anomaly, NotifyPrefs, Report, ReportStatus, Stats, TrendPoint, Watch } from '../types'

function mulberry32(seed: number) {
  return () => {
    let t = (seed += 0x6d2b79f5)
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const rand = mulberry32(610591)

const TEMPLATES: { code: string; cadence: string; ext: string; baseSize: number }[] = [
  { code: 'CST610C', cadence: 'EOD', ext: 'csv', baseSize: 420_000 },
  { code: 'POS591', cadence: 'ITD', ext: 'txt', baseSize: 88_000 },
  { code: 'MMR', cadence: 'HTML', ext: 'html', baseSize: 210_000 },
  { code: 'ABC123', cadence: 'EOD', ext: 'log', baseSize: 36_000 },
  { code: 'XYZ789', cadence: 'ITD', ext: 'dat', baseSize: 512_000 },
  { code: 'GLD440', cadence: 'EOD', ext: 'csv', baseSize: 190_000 },
  { code: 'INV220', cadence: 'ITD', ext: 'txt', baseSize: 64_000 },
  { code: 'RISK88', cadence: 'EOD', ext: 'csv', baseSize: 275_000 },
  { code: 'PNL301', cadence: 'ITD', ext: 'csv', baseSize: 148_000 },
  { code: 'FX119', cadence: 'EOD', ext: 'txt', baseSize: 41_000 },
]

function atHour(day: Date, hour: number, minute = 0): Date {
  const d = new Date(day)
  d.setHours(hour, minute, 0, 0)
  return d
}

function expectedFor(cadence: string, businessDay: Date): Date {
  if (cadence === 'ITD') return atHour(businessDay, 16, 30)
  if (cadence === 'HTML') return atHour(businessDay, 12, 0)
  return atHour(businessDay, 18, 0)
}

function statusFor(expected: Date, arrived: Date | null, force?: ReportStatus): ReportStatus {
  if (force) return force
  if (!arrived) {
    return expected.getTime() < Date.now() ? 'missing' : 'pending'
  }
  return arrived.getTime() > expected.getTime() ? 'late' : 'received'
}

function buildReports(): Report[] {
  const now = new Date()
  const reports: Report[] = []
  let id = 0

  for (let dayOffset = -30; dayOffset <= 1; dayOffset++) {
    const day = new Date(now)
    day.setDate(now.getDate() + dayOffset)
    day.setHours(12, 0, 0, 0)

    for (const tpl of TEMPLATES) {
      if (rand() < 0.25 && dayOffset < -2) continue
      const expected = expectedFor(tpl.cadence, day)
      let arrived: Date | null = null
      let force: ReportStatus | undefined

      if (dayOffset > 0 || (dayOffset === 0 && expected.getTime() > now.getTime())) {
        force = 'pending'
      } else if (rand() < 0.08) {
        force = 'missing'
      } else {
        const jitter = Math.floor((rand() - 0.35) * 80)
        arrived = new Date(expected.getTime() + jitter * 60_000)
        if (arrived.getTime() > now.getTime()) {
          arrived = new Date(now.getTime() - Math.floor(rand() * 15 * 60_000))
        }
      }

      const size = Math.max(8_000, Math.round(tpl.baseSize * (0.75 + rand() * 0.55)))
      const status = statusFor(expected, arrived, force)
      const delayMinutes = arrived
        ? Math.round((arrived.getTime() - expected.getTime()) / 60_000)
        : status === 'missing'
          ? Math.max(0, Math.round((now.getTime() - expected.getTime()) / 60_000))
          : null

      reports.push({
        id: `rep-${id++}`,
        filename: formatFilename(tpl.code, tpl.cadence, day, tpl.ext),
        code: tpl.code,
        cadence: tpl.cadence,
        businessDate: day.toISOString().slice(0, 10),
        ext: tpl.ext,
        status,
        sizeBytes: size,
        expectedAt: expected.toISOString(),
        arrivedAt: arrived ? arrived.toISOString() : null,
        delayMinutes,
      })
    }
  }

  // 24-hour transfer reports (size drops, delayed deliveries, and normal on-time arrivals)
  const recent24hDeliveries = [
    {
      code: 'POS591',
      cadence: 'ITD',
      ext: 'txt',
      hoursAgo: 4,
      delay: 2,
      size: 22_400, // 74.5% drop from 88 KB baseline
      status: 'received' as ReportStatus,
    },
    {
      code: 'GLD440',
      cadence: 'EOD',
      ext: 'csv',
      hoursAgo: 6,
      delay: -1,
      size: 48_000, // 74.7% drop from 190 KB baseline
      status: 'received' as ReportStatus,
    },
    {
      code: 'CST610C',
      cadence: 'EOD',
      ext: 'csv',
      hoursAgo: 5,
      delay: 44, // 44 min late past 18:00 cutoff
      size: 418_000,
      status: 'late' as ReportStatus,
    },
    {
      code: 'XYZ789',
      cadence: 'ITD',
      ext: 'dat',
      hoursAgo: 8,
      delay: 36, // 36 min late past 16:30 cutoff
      size: 512_000,
      status: 'late' as ReportStatus,
    },
    {
      code: 'ABC123',
      cadence: 'EOD',
      ext: 'log',
      hoursAgo: 4,
      delay: -4,
      size: 36_200,
      status: 'received' as ReportStatus,
    },
    {
      code: 'RISK88',
      cadence: 'EOD',
      ext: 'csv',
      hoursAgo: 7,
      delay: -2,
      size: 275_500,
      status: 'received' as ReportStatus,
    },
    {
      code: 'MMR',
      cadence: 'HTML',
      ext: 'html',
      hoursAgo: 10,
      delay: 1,
      size: 211_000,
      status: 'received' as ReportStatus,
    },
    {
      code: 'INV220',
      cadence: 'ITD',
      ext: 'txt',
      hoursAgo: 12,
      delay: -3,
      size: 64_800,
      status: 'received' as ReportStatus,
    },
  ]

  for (const item of recent24hDeliveries) {
    const arrived = new Date(Date.now() - item.hoursAgo * 3600_000)
    const expected = new Date(arrived.getTime() - item.delay * 60_000)
    const day = new Date(arrived)
    const filename = formatFilename(item.code, item.cadence, day, item.ext)
    reports.unshift({
      id: `rep-24h-transferred-${id++}`,
      filename,
      code: item.code,
      cadence: item.cadence,
      businessDate: day.toISOString().slice(0, 10),
      ext: item.ext,
      status: item.status,
      sizeBytes: item.size,
      expectedAt: expected.toISOString(),
      arrivedAt: arrived.toISOString(),
      delayMinutes: item.delay,
    })
  }

  return reports
}

export const reports: Report[] = buildReports()

export const watches: Watch[] = [
  {
    id: 'watch-1',
    name: 'EOD core book',
    pattern: 'CST610C|GLD440|RISK88',
    channel: 'slack',
    triggers: ['late', 'missing'],
    quietHours: { start: '22:00', end: '07:00' },
  },
  {
    id: 'watch-2',
    name: 'Intraday POS',
    pattern: '^POS591\\.',
    channel: 'email',
    triggers: ['late', 'size'],
    quietHours: null,
  },
  {
    id: 'watch-3',
    name: 'MMR pack',
    pattern: 'MMR',
    channel: 'teams',
    triggers: ['missing'],
    quietHours: { start: '20:00', end: '08:00' },
  },
]

export const alerts: AlertItem[] = [
  {
    id: 'al-1',
    watchId: 'watch-1',
    title: 'CST610C arrived 18 min late',
    detail: 'File size within band. SLA cutoff 18:00.',
    severity: 'warn',
    at: new Date(Date.now() - 42 * 60_000).toISOString(),
    acked: false,
  },
  {
    id: 'al-2',
    watchId: 'watch-2',
    title: 'POS591 size z-score 2.4',
    detail: 'Today 148 KB vs 7-day mean 88 KB.',
    severity: 'crit',
    at: new Date(Date.now() - 3 * 3600_000).toISOString(),
    acked: false,
  },
  {
    id: 'al-3',
    watchId: 'watch-3',
    title: 'MMR missing for business date',
    detail: 'Expected noon HTML pack did not land.',
    severity: 'crit',
    at: new Date(Date.now() - 6 * 3600_000).toISOString(),
    acked: true,
  },
  {
    id: 'al-4',
    title: 'FX119 received on time',
    detail: 'Watch digest — healthy arrival.',
    severity: 'info',
    at: new Date(Date.now() - 9 * 3600_000).toISOString(),
    acked: true,
  },
]

export let notifyPrefs: NotifyPrefs = {
  channels: { email: true, slack: true, teams: false },
  digest: 'realtime',
  quietHours: { start: '22:00', end: '07:00' },
}

export function setNotifyPrefs(next: NotifyPrefs) {
  notifyPrefs = next
}

export function computeStats(list: Report[]): Stats {
  const received = list.filter((r) => r.status === 'received').length
  const late = list.filter((r) => r.status === 'late').length
  const pending = list.filter((r) => r.status === 'pending').length
  const missing = list.filter((r) => r.status === 'missing').length
  const sized = list.filter((r) => r.status !== 'pending' && r.status !== 'missing' && r.sizeBytes > 400_000)
  const arrived = received + late
  const slaHealth = arrived === 0 ? 100 : Math.round((received / arrived) * 100)
  return {
    received,
    receivedDelta: 12,
    late,
    lateDelta: 4,
    pending,
    pendingDelta: -2,
    missing,
    missingDelta: 1,
    slaHealth,
    slaDelta: 2.3,
    sizeAnomalies: sized.length,
    sizeAnomaliesDelta: -1,
  }
}

export function parsePeriodHours(period = '24h'): number {
  if (period === '1h') return 1
  if (period === '3h') return 3
  if (period === '6h') return 6
  if (period === '12h') return 12
  if (period === '24h') return 24
  return 24
}

export function computeTrend(list: Report[], period = '24h'): TrendPoint[] {
  const hours = parsePeriodHours(period)
  const now = new Date()

  // Generate hourly buckets in CST for the selected window
  const points: TrendPoint[] = []
  for (let i = hours - 1; i >= 0; i--) {
    const bucketDate = new Date(now.getTime() - i * 3600_000)
    const hourLabel =
      new Intl.DateTimeFormat('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
        timeZone: 'America/Chicago',
      }).format(bucketDate).slice(0, 2) + ':00 CST'

    points.push({
      date: hourLabel,
      received: 0,
      late: 0,
      pending: 0,
    })
  }

  // Populate counts into appropriate hourly bucket
  for (const r of list) {
    const timeMs = r.arrivedAt ? new Date(r.arrivedAt).getTime() : new Date(r.expectedAt).getTime()
    const itemDate = new Date(timeMs)
    const itemHourLabel =
      new Intl.DateTimeFormat('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
        timeZone: 'America/Chicago',
      }).format(itemDate).slice(0, 2) + ':00 CST'

    const target = points.find((p) => p.date === itemHourLabel)
    if (target) {
      if (r.status === 'received') target.received += 1
      else if (r.status === 'late') target.late += 1
      else target.pending += 1
    }
  }

  return points
}

export function anomalyFor(report: Report): Anomaly {
  const siblings = reports.filter((r) => r.code === report.code && r.id !== report.id)
  const sizes = siblings.map((r) => r.sizeBytes)
  const mean = sizes.length ? sizes.reduce((a, b) => a + b, 0) / sizes.length : report.sizeBytes
  const variance =
    sizes.length > 1 ? sizes.reduce((a, s) => a + (s - mean) ** 2, 0) / (sizes.length - 1) : 0
  const std = Math.sqrt(variance) || 1
  const sizeZ = Number(((report.sizeBytes - mean) / std).toFixed(2))
  const missingStreak = reports
    .filter((r) => r.code === report.code)
    .sort((a, b) => b.businessDate.localeCompare(a.businessDate))
    .findIndex((r) => r.status !== 'missing')
  const history = [...siblings, report]
    .sort((a, b) => a.businessDate.localeCompare(b.businessDate))
    .slice(-8)
    .map((r) => ({
      date: r.businessDate.slice(5),
      size: Math.round(r.sizeBytes / 1024),
      delayMinutes: r.delayMinutes ?? 0,
    }))
  return {
    reportId: report.id,
    sizeMean: Math.round(mean),
    sizeZ,
    delayMinutes: report.delayMinutes,
    missingStreak: missingStreak === -1 ? siblings.length : missingStreak,
    history,
  }
}

export function matchesQuery(report: Report, q: string): boolean {
  if (!q.trim()) return true
  try {
    const re = new RegExp(q, 'i')
    return re.test(report.filename) || re.test(report.code)
  } catch {
    const n = q.toLowerCase()
    return report.filename.toLowerCase().includes(n) || report.code.toLowerCase().includes(n)
  }
}

export function filterReports(q = '', cadence = 'all', period = '24h'): Report[] {
  const hours = parsePeriodHours(period)
  const cutoff = Date.now() - hours * 3600_000
  const filtered = reports.filter((r) => {
    if (!matchesQuery(r, q)) return false
    if (cadence !== 'all' && r.cadence.toLowerCase() !== cadence.toLowerCase()) return false
    const timeMs = r.arrivedAt ? new Date(r.arrivedAt).getTime() : new Date(r.expectedAt).getTime()
    return timeMs >= cutoff
  })
  if (filtered.length > 0) return filtered
  // Graceful fallback to avoid empty state on tight date boundaries
  return reports.filter((r) => {
    if (!matchesQuery(r, q)) return false
    if (cadence !== 'all' && r.cadence.toLowerCase() !== cadence.toLowerCase()) return false
    return true
  })
}

export function getMockStatsPayload(q = '', cadence = 'all', period = '24h') {
  const list = filterReports(q, cadence, period)
  return {
    ...computeStats(list),
    trend: computeTrend(list, period),
    cadence: Object.values(
      list.reduce<Record<string, { cadence: string; count: number }>>((acc, r) => {
        acc[r.cadence] = acc[r.cadence] ?? { cadence: r.cadence, count: 0 }
        acc[r.cadence].count += 1
        return acc
      }, {}),
    ),
  }
}

