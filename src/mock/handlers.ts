import { http, HttpResponse } from 'msw'
import type { NotifyPrefs, Watch } from '../types'
import {
  alerts,
  anomalyFor,
  filterReports,
  getMockStatsPayload,
  notifyPrefs,
  reports,
  setNotifyPrefs,
  watches,
} from './data'

export const handlers = [
  http.get('/api/stats', ({ request }) => {
    const url = new URL(request.url)
    const q = url.searchParams.get('q') ?? ''
    const cadence = url.searchParams.get('cadence') ?? 'all'
    const period = url.searchParams.get('period') ?? '24h'
    return HttpResponse.json(getMockStatsPayload(q, cadence, period))
  }),

  http.get('/api/reports', ({ request }) => {
    const url = new URL(request.url)
    const q = url.searchParams.get('q') ?? ''
    const cadence = url.searchParams.get('cadence') ?? 'all'
    const period = url.searchParams.get('period') ?? '24h'
    return HttpResponse.json(filterReports(q, cadence, period))
  }),

  http.get('/api/reports/:id', ({ params }) => {
    const report = reports.find((r) => r.id === params.id)
    if (!report) return HttpResponse.json({ error: 'not found' }, { status: 404 })
    return HttpResponse.json(report)
  }),

  http.get('/api/reports/:id/anomalies', ({ params }) => {
    const report = reports.find((r) => r.id === params.id)
    if (!report) return HttpResponse.json({ error: 'not found' }, { status: 404 })
    return HttpResponse.json(anomalyFor(report))
  }),

  http.get('/api/arrivals/upcoming', () => {
    const upcoming = reports
      .filter((r) => r.status === 'pending' || (r.status === 'missing' && !r.arrivedAt))
      .sort((a, b) => new Date(a.expectedAt).getTime() - new Date(b.expectedAt).getTime())
      .slice(0, 8)
    return HttpResponse.json(upcoming)
  }),

  http.get('/api/watches', () => HttpResponse.json(watches)),

  http.post('/api/watches', async ({ request }) => {
    const body = (await request.json()) as Omit<Watch, 'id'>
    const watch: Watch = { ...body, id: `watch-${Date.now()}` }
    watches.unshift(watch)
    return HttpResponse.json(watch, { status: 201 })
  }),

  http.delete('/api/watches/:id', ({ params }) => {
    const idx = watches.findIndex((w) => w.id === params.id)
    if (idx >= 0) watches.splice(idx, 1)
    return new HttpResponse(null, { status: 204 })
  }),

  http.get('/api/alerts', () => HttpResponse.json(alerts)),

  http.patch('/api/alerts/:id', async ({ params, request }) => {
    const body = (await request.json()) as { acked?: boolean }
    const alert = alerts.find((a) => a.id === params.id)
    if (!alert) return HttpResponse.json({ error: 'not found' }, { status: 404 })
    if (typeof body.acked === 'boolean') alert.acked = body.acked
    return HttpResponse.json(alert)
  }),

  http.get('/api/notify-prefs', () => HttpResponse.json(notifyPrefs)),

  http.put('/api/notify-prefs', async ({ request }) => {
    const body = (await request.json()) as NotifyPrefs
    setNotifyPrefs(body)
    return HttpResponse.json(notifyPrefs)
  }),

  http.post('/api/ai/chat', async ({ request }) => {
    const body = (await request.json()) as {
      messages: { role: string; content: string }[]
      reportId?: string
    }
    const lastUserMsg = [...(body.messages ?? [])]
      .reverse()
      .find((m) => m.role === 'user')?.content.toLowerCase() ?? ''

    if (lastUserMsg.includes('pos591') || (lastUserMsg.includes('size') && lastUserMsg.includes('drop'))) {
      return HttpResponse.json({
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
      })
    }

    if (lastUserMsg.includes('cst610c') || lastUserMsg.includes('late') || lastUserMsg.includes('delay')) {
      return HttpResponse.json({
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
      })
    }

    return HttpResponse.json({
      reply:
        'I analyzed current SFTP operations across all active feeds. 2 anomalies require operator attention: POS591 suffered a 74.5% size contraction, and CST610C arrived 44 min late past SLA. All other 8 feeds are operating within ±1.2σ Gaussian confidence intervals.',
      charts: [
        {
          type: 'line',
          title: 'Daily SLA Compliance (%)',
          series: [
            {
              name: 'SLA Health',
              points: [
                { x: 'Mon', y: 94 },
                { x: 'Tue', y: 98 },
                { x: 'Wed', y: 96 },
                { x: 'Thu', y: 89 },
                { x: 'Fri', y: 92 },
              ],
            },
          ],
        },
      ],
    })
  }),
]
