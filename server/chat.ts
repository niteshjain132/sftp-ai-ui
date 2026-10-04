import type { IncomingMessage } from 'node:http'

export type ChatBody = {
  messages?: { role?: string; content?: string }[]
  reportId?: string
}

export function mockChatReply(body: ChatBody) {
  const last = [...(body.messages ?? [])].reverse().find((m) => m.role === 'user')
  const q = (last?.content ?? '').toLowerCase()
  const about = body.reportId ? ` for report ${body.reportId}` : ''

  if (q.includes('late') || q.includes('sla') || q.includes('delay')) {
    return {
      reply: `Delay is clustering on EOD files after 18:00${about}. CST610C and RISK88 are the usual offenders. Chart shows delay minutes vs SLA for the last week.`,
      charts: [
        {
          type: 'line' as const,
          title: 'Delay vs SLA (minutes)',
          series: [
            {
              name: 'delay',
              points: [
                { x: 'Mon', y: 4 },
                { x: 'Tue', y: 12 },
                { x: 'Wed', y: -3 },
                { x: 'Thu', y: 18 },
                { x: 'Fri', y: 7 },
              ],
            },
          ],
        },
      ],
    }
  }

  if (q.includes('size') || q.includes('anom')) {
    return {
      reply: `Size anomaly detector uses a 7-day z-score. POS591 is 2.4σ above its mean today${about}. MMR is stable.`,
      charts: [
        {
          type: 'bar' as const,
          title: 'File size (KB)',
          series: [
            {
              name: 'size',
              points: [
                { x: 'd-6', y: 82 },
                { x: 'd-5', y: 90 },
                { x: 'd-4', y: 88 },
                { x: 'd-3', y: 85 },
                { x: 'd-2', y: 91 },
                { x: 'd-1', y: 87 },
                { x: 'today', y: 148 },
              ],
            },
          ],
        },
      ],
    }
  }

  return {
    reply: last?.content
      ? `Ops copilot${about}: ${last.content}. Upcoming ITD files should land by 16:30. Ask about size, delay, or a filename regex and I will chart it.`
      : 'Ask about late files, size anomalies, or a report code like CST610C.',
    charts: [
      {
        type: 'line' as const,
        title: 'Arrivals this week',
        series: [
          {
            name: 'received',
            points: [
              { x: 'Mon', y: 14 },
              { x: 'Tue', y: 16 },
              { x: 'Wed', y: 12 },
              { x: 'Thu', y: 18 },
              { x: 'Fri', y: 15 },
            ],
          },
        ],
      },
    ],
  }
}

export async function readJsonBody(req: IncomingMessage): Promise<ChatBody> {
  const raw = await new Promise<string>((resolve, reject) => {
    const chunks: Buffer[] = []
    req.on('data', (c: Buffer) => chunks.push(c))
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
    req.on('error', reject)
  })
  if (!raw) return {}
  try {
    return JSON.parse(raw) as ChatBody
  } catch {
    return {}
  }
}
