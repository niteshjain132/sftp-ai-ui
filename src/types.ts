export type ReportStatus = 'received' | 'late' | 'pending' | 'missing'
export type Channel = 'email' | 'slack' | 'teams'
export type Trigger = 'late' | 'missing' | 'size'
export type Digest = 'realtime' | 'hourly' | 'daily'
export type Severity = 'info' | 'warn' | 'crit'

export type Report = {
  id: string
  filename: string
  code: string
  cadence: string
  businessDate: string
  ext: string
  status: ReportStatus
  sizeBytes: number
  expectedAt: string
  arrivedAt: string | null
  delayMinutes: number | null
}

export type SizePoint = {
  date: string
  size: number
  delayMinutes: number
}

export type Anomaly = {
  reportId: string
  sizeMean: number
  sizeZ: number
  delayMinutes: number | null
  missingStreak: number
  history: SizePoint[]
}

export type Stats = {
  received: number
  receivedDelta: number
  late: number
  lateDelta: number
  pending: number
  pendingDelta: number
  missing: number
  missingDelta: number
  slaHealth: number
  slaDelta: number
  sizeAnomalies: number
  sizeAnomaliesDelta: number
}

export type TrendPoint = {
  date: string
  received: number
  late: number
  pending: number
}

export type CadenceSlice = {
  cadence: string
  count: number
}

export type Watch = {
  id: string
  name: string
  pattern: string
  channel: Channel
  triggers: Trigger[]
  quietHours: { start: string; end: string } | null
}

export type AlertItem = {
  id: string
  watchId?: string
  reportId?: string
  title: string
  detail: string
  severity: Severity
  at: string
  acked: boolean
}

export type NotifyPrefs = {
  channels: { email: boolean; slack: boolean; teams: boolean }
  digest: Digest
  quietHours: { start: string; end: string }
}

export type ChatMessage = {
  role: 'user' | 'assistant'
  content: string
}

export type ChatChart = {
  type: 'line' | 'bar'
  title: string
  series: { name: string; points: { x: string; y: number }[] }[]
}

export type ChatReply = {
  reply: string
  charts?: ChatChart[]
}
