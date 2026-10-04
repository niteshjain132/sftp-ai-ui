import {
  alerts,
  anomalyFor,
  filterReports,
  getMockStatsPayload,
  notifyPrefs,
  reports,
  setNotifyPrefs,
  watches,
} from '../mock/data'
import type { AlertItem, Anomaly, ChatReply, NotifyPrefs, Report, Stats, TrendPoint, Watch } from '../types'

type StatsPayload = Stats & {
  trend: TrendPoint[]
  cadence: { cadence: string; count: number }[]
}

async function json<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
  })
  if (!res.ok) throw new Error(`${res.status} ${path}`)
  if (res.status === 204) return undefined as T
  return res.json() as Promise<T>
}

export const api = {
  stats: async (q: string, cadence: string, period: string): Promise<StatsPayload> => {
    try {
      return await json<StatsPayload>(
        `/api/stats?q=${encodeURIComponent(q)}&cadence=${cadence}&period=${period}`,
      )
    } catch {
      return getMockStatsPayload(q, cadence, period)
    }
  },

  reports: async (q: string, cadence: string, period: string): Promise<Report[]> => {
    try {
      return await json<Report[]>(
        `/api/reports?q=${encodeURIComponent(q)}&cadence=${cadence}&period=${period}`,
      )
    } catch {
      return filterReports(q, cadence, period)
    }
  },

  report: async (id: string): Promise<Report> => {
    try {
      return await json<Report>(`/api/reports/${id}`)
    } catch {
      const found = reports.find((r) => r.id === id)
      if (found) return found
      throw new Error(`Report not found: ${id}`)
    }
  },

  anomalies: async (id: string): Promise<Anomaly> => {
    try {
      return await json<Anomaly>(`/api/reports/${id}/anomalies`)
    } catch {
      const found = reports.find((r) => r.id === id) ?? reports[0]
      return anomalyFor(found)
    }
  },

  upcoming: async (): Promise<Report[]> => {
    try {
      return await json<Report[]>('/api/arrivals/upcoming')
    } catch {
      return reports
        .filter((r) => r.status === 'pending' || (r.status === 'missing' && !r.arrivedAt))
        .sort((a, b) => new Date(a.expectedAt).getTime() - new Date(b.expectedAt).getTime())
        .slice(0, 8)
    }
  },

  watches: async (): Promise<Watch[]> => {
    try {
      return await json<Watch[]>('/api/watches')
    } catch {
      return watches
    }
  },

  createWatch: async (watch: Omit<Watch, 'id'>): Promise<Watch> => {
    try {
      return await json<Watch>('/api/watches', { method: 'POST', body: JSON.stringify(watch) })
    } catch {
      const newWatch: Watch = { ...watch, id: `watch-${Date.now()}` }
      watches.unshift(newWatch)
      return newWatch
    }
  },

  deleteWatch: async (id: string): Promise<void> => {
    try {
      await json<void>(`/api/watches/${id}`, { method: 'DELETE' })
    } catch {
      const idx = watches.findIndex((w) => w.id === id)
      if (idx >= 0) watches.splice(idx, 1)
    }
  },

  alerts: async (): Promise<AlertItem[]> => {
    try {
      return await json<AlertItem[]>('/api/alerts')
    } catch {
      return alerts
    }
  },

  ackAlert: async (id: string, acked: boolean): Promise<AlertItem> => {
    try {
      return await json<AlertItem>(`/api/alerts/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ acked }),
      })
    } catch {
      const found = alerts.find((a) => a.id === id)
      if (found) found.acked = acked
      return found ?? alerts[0]
    }
  },

  prefs: async (): Promise<NotifyPrefs> => {
    try {
      return await json<NotifyPrefs>('/api/notify-prefs')
    } catch {
      return notifyPrefs
    }
  },

  savePrefs: async (prefs: NotifyPrefs): Promise<NotifyPrefs> => {
    try {
      return await json<NotifyPrefs>('/api/notify-prefs', {
        method: 'PUT',
        body: JSON.stringify(prefs),
      })
    } catch {
      setNotifyPrefs(prefs)
      return notifyPrefs
    }
  },

  chat: async (
    messages: { role: string; content: string }[],
    reportId?: string,
  ): Promise<ChatReply> => {
    try {
      return await json<ChatReply>('/api/ai/chat', {
        method: 'POST',
        body: JSON.stringify({ messages, reportId }),
      })
    } catch {
      const lastUserMsg = [...messages].reverse().find((m) => m.role === 'user')?.content.toLowerCase() ?? ''
      if (lastUserMsg.includes('pos591') || (lastUserMsg.includes('size') && lastUserMsg.includes('drop'))) {
        return {
          reply:
            '**Anomaly Diagnostic [POS591]**: In the trailing 24 hours, POS591 arrived at 22.4 KB, representing a **74.5% drop** from its 30-day baseline mean of 88.0 KB (z-score: -2.81σ). Upstream transaction extraction for store partitions 14-22 appears empty or truncated before SFTP transmission.\n\n**Recommendation**: Contact upstream feed team to verify table export completeness or rerun intraday batch.',
          charts: [
            {
              type: 'line',
              title: 'POS591 File Size vs Baseline (KB)',
              series: [
                {
                  name: 'File Size (KB)',
                  points: [
                    { x: '10/01', y: 89 },
                    { x: '10/02', y: 86 },
                    { x: '10/03', y: 91 },
                    { x: '10/04', y: 22 },
                  ],
                },
                {
                  name: 'Baseline Mean (KB)',
                  points: [
                    { x: '10/01', y: 88 },
                    { x: '10/02', y: 88 },
                    { x: '10/03', y: 88 },
                    { x: '10/04', y: 88 },
                  ],
                },
              ],
            },
          ],
        }
      }

      if (lastUserMsg.includes('cst610c') || lastUserMsg.includes('late') || lastUserMsg.includes('delay')) {
        return {
          reply:
            '**Delay Diagnostic [CST610C]**: CST610C landed at 18:44 UTC, which is **44 minutes past its 18:00 UTC SLA cutoff**. Historical variance analysis shows normal delivery is 17:52 ± 6 mins.\n\nUpstream vendor SFTP batch export suffered an authentication retry stall before commencing chunk transfers. Downstream ingestion has caught up.',
          charts: [
            {
              type: 'bar',
              title: 'CST610C Arrival Delay past SLA (Minutes)',
              series: [
                {
                  name: 'Delay (min)',
                  points: [
                    { x: '10/01', y: -8 },
                    { x: '10/02', y: 4 },
                    { x: '10/03', y: -2 },
                    { x: '10/04', y: 44 },
                  ],
                },
              ],
            },
          ],
        }
      }

      return {
        reply:
          'I analyzed current SFTP operations across all active feeds. 2 anomalies require operator attention: POS591 suffered a 74.5% size contraction, and CST610C arrived 44 min late past SLA. All other feeds are operating within ±1.2σ Gaussian confidence intervals.',
      }
    }
  },
}
