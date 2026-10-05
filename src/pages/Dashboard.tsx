import { useState, useEffect, useMemo } from 'react'
import {
  Activity,
  AlertTriangle,
  Clock,
  CheckCircle2,
  TrendingUp,
  RefreshCw,
  ChevronRight,
  ChevronLeft,
  ChevronsLeft,
  ChevronsRight,
  ArrowUpDown,
  Filter,
  RotateCcw,
  Calendar,
  X,
  Gauge,
  Zap,
} from 'lucide-react'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  BarChart,
  Bar,
  ReferenceLine,
  Cell,
} from 'recharts'
import { api } from '../api/client'
import { computeStats } from '../mock/data'
import { SearchBar } from '../components/layout/SearchBar'
import { ThemeToggle } from '../components/layout/ThemeToggle'
import { AnomalyDetectionPanel } from '../components/dashboard/AnomalyDetectionPanel'
import { formatBytes, formatCountdown, formatDelta, formatWhen, formatTimeCST } from '../lib/format'
import type { Anomaly, Report, Stats, TrendPoint } from '../types'

type StatModalType = 'received' | 'late' | 'pending' | 'missing' | 'sla' | 'anomalies' | null

export function Dashboard() {
  const [q, setQ] = useState('')
  const [cadence, setCadence] = useState('all')
  const [period, setPeriod] = useState('24h')

  // Floating detail modal for KPI cards
  const [activeStatModal, setActiveStatModal] = useState<StatModalType>(null)

  const [stats, setStats] = useState<
    | (Stats & {
        trend: TrendPoint[]
        cadence: { cadence: string; count: number }[]
      })
    | null
  >(null)
  const [reports, setReports] = useState<Report[]>([])
  const [upcoming, setUpcoming] = useState<Report[]>([])
  const [loading, setLoading] = useState(true)

  // Report detail modal state
  const [selectedReport, setSelectedReport] = useState<Report | null>(null)
  const [anomalyData, setAnomalyData] = useState<Anomaly | null>(null)
  const [loadingAnomaly, setLoadingAnomaly] = useState(false)

  // Table Filtering, Sorting & Pagination State
  const [tableStatusFilter, setTableStatusFilter] = useState<'all' | Report['status']>('all')
  const [tableReportFilter, setTableReportFilter] = useState('all')
  const [tableDateFilter, setTableDateFilter] = useState('')
  const [sortField, setSortField] = useState<'businessDate' | 'expectedAt' | 'arrivedAt' | 'delayMinutes' | 'sizeBytes' | 'code'>('businessDate')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)

  const [now, setNow] = useState(() => Date.now())

  // Resilient stats: fallback to computed stats so KPI cards never disappear
  const activeStats: Stats = useMemo(() => {
    if (stats) return stats
    return computeStats(reports)
  }, [stats, reports])

  const availableReportCodes = useMemo(() => {
    return Array.from(new Set(reports.map((r) => r.code))).sort()
  }, [reports])

  const availableDates = useMemo(() => {
    return Array.from(new Set(reports.map((r) => r.businessDate))).sort().reverse()
  }, [reports])

  const filteredAndSortedReports = useMemo(() => {
    return reports
      .filter((r) => {
        if (tableStatusFilter !== 'all' && r.status !== tableStatusFilter) return false
        if (tableReportFilter !== 'all' && r.code !== tableReportFilter) return false
        if (tableDateFilter && r.businessDate !== tableDateFilter) return false
        return true
      })
      .sort((a, b) => {
        let cmp = 0
        if (sortField === 'code') cmp = a.code.localeCompare(b.code)
        else if (sortField === 'businessDate') cmp = a.businessDate.localeCompare(b.businessDate)
        else if (sortField === 'expectedAt') cmp = a.expectedAt.localeCompare(b.expectedAt)
        else if (sortField === 'arrivedAt') {
          cmp = (a.arrivedAt ?? '').localeCompare(b.arrivedAt ?? '')
        } else if (sortField === 'sizeBytes') {
          cmp = a.sizeBytes - b.sizeBytes
        } else if (sortField === 'delayMinutes') {
          cmp = (a.delayMinutes ?? 0) - (b.delayMinutes ?? 0)
        }
        return sortOrder === 'asc' ? cmp : -cmp
      })
  }, [reports, tableStatusFilter, tableReportFilter, tableDateFilter, sortField, sortOrder])

  const totalPages = Math.ceil(filteredAndSortedReports.length / pageSize) || 1
  const safePage = Math.min(Math.max(1, currentPage), totalPages)
  const paginatedReports = useMemo(() => {
    return filteredAndSortedReports.slice(
      (safePage - 1) * pageSize,
      safePage * pageSize
    )
  }, [filteredAndSortedReports, safePage, pageSize])

  const handleSort = (field: typeof sortField) => {
    if (sortField === field) {
      setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortField(field)
      setSortOrder('asc')
    }
  }

  const handleClearTableFilters = () => {
    setTableStatusFilter('all')
    setTableReportFilter('all')
    setTableDateFilter('')
    setCurrentPage(1)
  }

  const statModalData = useMemo(() => {
    if (!activeStatModal) return null

    if (activeStatModal === 'received') {
      const list = reports.filter((r) => r.status === 'received')
      const byDate = new Map<string, { date: string; EOD: number; ITD: number; HTML: number }>()
      for (const r of list) {
        const d = r.businessDate.slice(5)
        const cur = byDate.get(d) ?? { date: d, EOD: 0, ITD: 0, HTML: 0 }
        if (r.cadence === 'EOD') cur.EOD += 1
        else if (r.cadence === 'ITD') cur.ITD += 1
        else cur.HTML += 1
        byDate.set(d, cur)
      }
      const chartData = [...byDate.values()].slice(-8)

      return {
        title: 'Received Deliveries',
        icon: CheckCircle2,
        color: 'text-emerald-500',
        badgeBg: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
        subtitle: 'Deliveries successfully completed on time within the designated SLA window.',
        statusFilter: 'received' as const,
        metrics: [
          { label: 'Total Received', value: stats?.received ?? list.length },
          { label: 'SLA Health Rate', value: `${stats?.slaHealth ?? 100}%` },
          { label: 'Delta vs Prev Period', value: formatDelta(stats?.receivedDelta ?? 0) },
        ],
        chart: {
          type: 'bar-cadence' as const,
          title: 'Daily On-Time Volume by Cadence (Last 8 Days)',
          data: chartData,
          legend: [
            { label: 'EOD', color: '#6366f1' },
            { label: 'ITD', color: '#0ea5e9' },
            { label: 'HTML', color: '#10b981' },
          ],
        },
        items: list,
      }
    }

    if (activeStatModal === 'late') {
      const list = reports.filter((r) => r.status === 'late')
      const totalDelay = list.reduce((sum, r) => sum + (r.delayMinutes ?? 0), 0)
      const avgDelay = list.length ? Math.round(totalDelay / list.length) : 0
      const maxDelay = list.reduce((max, r) => Math.max(max, r.delayMinutes ?? 0), 0)
      const chartData = list.slice(0, 8).map((r) => ({
        name: r.code,
        delay: r.delayMinutes ?? 0,
        filename: r.filename,
      }))

      return {
        title: 'Late Deliveries & SLA Breaches',
        icon: Clock,
        color: 'text-amber-500',
        badgeBg: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
        subtitle: 'Deliveries that arrived after their expected SLA cutoff time.',
        statusFilter: 'late' as const,
        metrics: [
          { label: 'Late Incidents', value: stats?.late ?? list.length },
          { label: 'Avg Delay', value: `+${avgDelay} min` },
          { label: 'Peak Delay', value: `+${maxDelay} min` },
        ],
        chart: {
          type: 'bar-delay' as const,
          title: 'Late Incident Delay Minutes vs SLA Cutoff',
          data: chartData,
          legend: [
            { label: 'Moderate Delay (≤30m)', color: '#f59e0b' },
            { label: 'Critical Delay (>30m)', color: '#f43f5e' },
          ],
        },
        items: list,
      }
    }

    if (activeStatModal === 'pending') {
      const list = reports.filter((r) => r.status === 'pending')
      const chartData = list.slice(0, 8).map((r) => {
        const diffHours = Math.max(
          0.1,
          Number(((new Date(r.expectedAt).getTime() - now) / 3600_000).toFixed(1)),
        )
        return {
          name: r.code,
          hoursLeft: diffHours,
          cadence: r.cadence,
        }
      })

      return {
        title: 'Pending Expected Deliveries',
        icon: Activity,
        color: 'text-sky-500',
        badgeBg: 'bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20',
        subtitle: 'Files expected for delivery today that are currently awaiting arrival.',
        statusFilter: 'pending' as const,
        metrics: [
          { label: 'Awaiting Delivery', value: stats?.pending ?? list.length },
          { label: 'SLA Status', value: 'Within window' },
          { label: 'Pending Delta', value: formatDelta(stats?.pendingDelta ?? 0) },
        ],
        chart: {
          type: 'bar-pending' as const,
          title: 'Expected Deliveries — Hours Remaining to Cutoff',
          data: chartData,
          legend: [{ label: 'Hours to SLA Cutoff', color: '#0284c7' }],
        },
        items: list,
      }
    }

    if (activeStatModal === 'missing') {
      const list = reports.filter((r) => r.status === 'missing')
      const chartData = list.slice(0, 8).map((r) => {
        const hoursPast = Math.max(
          0.2,
          Number(((now - new Date(r.expectedAt).getTime()) / 3600_000).toFixed(1)),
        )
        return {
          name: r.code,
          hoursPast,
          cadence: r.cadence,
        }
      })

      return {
        title: 'Missing Files & SLA Cutoff Breaches',
        icon: AlertTriangle,
        color: 'text-rose-500',
        badgeBg: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20',
        subtitle: 'Deliveries that have exceeded their daily deadline without arrival.',
        statusFilter: 'missing' as const,
        metrics: [
          { label: 'Missing Files', value: stats?.missing ?? list.length },
          { label: 'Severity', value: 'Critical' },
          { label: 'Escalation Status', value: 'Alert Active' },
        ],
        chart: {
          type: 'bar-missing' as const,
          title: 'SLA Cutoff Breach Aging (Hours Exceeded)',
          data: chartData,
          legend: [{ label: 'Hours Past SLA Deadline', color: '#ef4444' }],
        },
        items: list,
      }
    }

    if (activeStatModal === 'sla') {
      const totalArrived = (stats?.received ?? 0) + (stats?.late ?? 0)
      const byDateSla = new Map<string, { received: number; total: number }>()
      for (const r of reports) {
        if (r.status === 'received' || r.status === 'late') {
          const d = r.businessDate.slice(5)
          const cur = byDateSla.get(d) ?? { received: 0, total: 0 }
          cur.total += 1
          if (r.status === 'received') cur.received += 1
          byDateSla.set(d, cur)
        }
      }
      const chartData = [...byDateSla.entries()]
        .map(([date, counts]) => ({
          date,
          rate: counts.total > 0 ? Math.round((counts.received / counts.total) * 100) : 100,
        }))
        .slice(-8)

      return {
        title: 'SLA Health & Delivery Performance',
        icon: Gauge,
        color: 'text-accent',
        badgeBg: 'bg-accent-soft text-accent border-accent/20',
        subtitle: 'Comprehensive on-time delivery metrics and compliance analysis.',
        statusFilter: null,
        metrics: [
          { label: 'Overall On-Time Rate', value: `${stats?.slaHealth ?? 0}%` },
          { label: 'Total Deliveries', value: totalArrived },
          { label: 'SLA Trajectory', value: formatDelta(stats?.slaDelta ?? 0, '%') },
        ],
        chart: {
          type: 'area-sla' as const,
          title: 'Daily On-Time SLA Compliance Trend (%)',
          data: chartData,
          legend: [
            { label: 'On-Time Compliance', color: '#10b981' },
            { label: '95% SLA Benchmark', color: '#6366f1' },
          ],
        },
        items: reports.filter((r) => r.status === 'received' || r.status === 'late'),
      }
    }

    if (activeStatModal === 'anomalies') {
      const list = reports.filter(
        (r) => Math.abs(r.delayMinutes ?? 0) > 25 || (r.sizeBytes > 400_000 && r.status !== 'pending')
      )
      const chartData = list.slice(0, 8).map((r) => ({
        name: r.code,
        actualKb: Math.round(r.sizeBytes / 1024),
        baselineKb: Math.round(r.cadence === 'ITD' ? 120 : r.cadence === 'HTML' ? 210 : 350),
      }))

      return {
        title: 'File Size & Volume Anomalies',
        icon: Zap,
        color: 'text-purple-500',
        badgeBg: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20',
        subtitle: 'Transfers with abnormal file sizes or significant jitter (>2.0σ Gaussian threshold).',
        statusFilter: null,
        metrics: [
          { label: 'Size Anomalies', value: stats?.sizeAnomalies ?? list.length },
          { label: 'Threshold', value: '|z| ≥ 2.0σ' },
          { label: 'Rolling Window', value: '7 days' },
        ],
        chart: {
          type: 'bar-anomalies' as const,
          title: 'Payload Size vs Rolling Baseline (KB)',
          data: chartData,
          legend: [
            { label: 'Actual Payload (KB)', color: '#a855f7' },
            { label: 'Expected Baseline (KB)', color: '#64748b' },
          ],
        },
        items: list,
      }
    }

    return null
  }, [activeStatModal, reports, stats, now])

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      try {
        const [statsRes, reportsRes, upcomingRes] = await Promise.all([
          api.stats(q, cadence, period),
          api.reports(q, cadence, period),
          api.upcoming(),
        ])
        if (!cancelled) {
          setStats(statsRes)
          setReports(reportsRes)
          setUpcoming(upcomingRes)
        }
      } catch (err) {
        console.error('Failed to load dashboard data', err)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [q, cadence, period])

  const handleRefresh = async () => {
    setLoading(true)
    try {
      const [statsRes, reportsRes, upcomingRes] = await Promise.all([
        api.stats(q, cadence, period),
        api.reports(q, cadence, period),
        api.upcoming(),
      ])
      setStats(statsRes)
      setReports(reportsRes)
      setUpcoming(upcomingRes)
    } finally {
      setLoading(false)
    }
  }

  const handleOpenDetail = async (report: Report) => {
    setSelectedReport(report)
    setLoadingAnomaly(true)
    try {
      const data = await api.anomalies(report.id)
      setAnomalyData(data)
    } catch (err) {
      console.error('Failed to load anomaly', err)
    } finally {
      setLoadingAnomaly(false)
    }
  }

  const statusBadge = (status: Report['status']) => {
    switch (status) {
      case 'received':
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
            <CheckCircle2 size={12} />
            Received
          </span>
        )
      case 'late':
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2.5 py-0.5 text-xs font-semibold text-amber-600 dark:text-amber-400 border border-amber-500/20">
            <Clock size={12} />
            Late
          </span>
        )
      case 'pending':
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-sky-500/10 px-2.5 py-0.5 text-xs font-semibold text-sky-600 dark:text-sky-400 border border-sky-500/20">
            <Activity size={12} />
            Pending
          </span>
        )
      case 'missing':
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/10 px-2.5 py-0.5 text-xs font-semibold text-rose-600 dark:text-rose-400 border border-rose-500/20">
            <AlertTriangle size={12} />
            Missing
          </span>
        )
    }
  }

  return (
    <div className="space-y-6">
      {/* Top Banner / Actions */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-ink">File Arrival Operations</h1>
          <p className="text-xs text-muted">
            Live telemetry monitoring of SFTP file transfers, SLAs, and data volume distributions.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleRefresh}
            title="Refresh metrics"
            className="flex items-center gap-1.5 rounded-full border border-border bg-card px-3.5 py-2 text-xs font-medium text-ink shadow-sm hover:border-accent hover:text-accent transition"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
          <ThemeToggle />
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card p-3 shadow-sm">
        <SearchBar
          value={q}
          onChange={setQ}
          placeholder="Search by file regex or report code (e.g. CST610C)..."
        />

        <div className="flex flex-wrap items-center gap-2">
          {/* Cadence Pills */}
          <div className="flex items-center rounded-full border border-border bg-canvas p-1 text-xs">
            {['all', 'EOD', 'ITD', 'HTML'].map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setCadence(c)}
                className={`rounded-full px-3 py-1 font-medium transition ${
                  cadence === c
                    ? 'bg-card text-ink shadow-sm'
                    : 'text-muted hover:text-ink'
                }`}
              >
                {c.toUpperCase()}
              </button>
            ))}
          </div>

          {/* Period selector (Intraday CST) */}
          <div className="flex items-center rounded-full border border-border bg-canvas p-1 text-xs">
            {['1h', '3h', '6h', '12h', '24h'].map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPeriod(p)}
                className={`rounded-full px-3 py-1 font-medium transition ${
                  period === p
                    ? 'bg-card text-ink shadow-sm'
                    : 'text-muted hover:text-ink'
                }`}
              >
                {p}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Stats Cards Grid */}
      {activeStats && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
          {/* Received Card */}
          <div
            onClick={() => setActiveStatModal('received')}
            className="group cursor-pointer rounded-2xl border border-border bg-card p-4 shadow-sm hover:border-emerald-500/60 hover:shadow-md hover:scale-[1.02] transition-all"
          >
            <div className="flex items-center justify-between text-muted text-xs font-medium">
              <span className="group-hover:text-emerald-500 transition-colors">Received</span>
              <CheckCircle2 size={16} className="text-emerald-500 group-hover:scale-110 transition-transform" />
            </div>
            <div className="mt-2 text-2xl font-bold text-ink">{activeStats.received}</div>
            <div className="mt-1 flex items-center justify-between text-[11px]">
              <span className="text-emerald-500 font-medium">
                {formatDelta(activeStats.receivedDelta)} vs prev
              </span>
              <span className="text-[10px] text-muted opacity-0 group-hover:opacity-100 transition-opacity">
                Details ↗
              </span>
            </div>
          </div>

          {/* Late Files Card */}
          <div
            onClick={() => setActiveStatModal('late')}
            className="group cursor-pointer rounded-2xl border border-border bg-card p-4 shadow-sm hover:border-amber-500/60 hover:shadow-md hover:scale-[1.02] transition-all"
          >
            <div className="flex items-center justify-between text-muted text-xs font-medium">
              <span className="group-hover:text-amber-500 transition-colors">Late Files</span>
              <Clock size={16} className="text-amber-500 group-hover:scale-110 transition-transform" />
            </div>
            <div className="mt-2 text-2xl font-bold text-ink">{activeStats.late}</div>
            <div className="mt-1 flex items-center justify-between text-[11px]">
              <span className="text-amber-500 font-medium">
                {formatDelta(activeStats.lateDelta)} breach
              </span>
              <span className="text-[10px] text-muted opacity-0 group-hover:opacity-100 transition-opacity">
                Details ↗
              </span>
            </div>
          </div>

          {/* Pending Card */}
          <div
            onClick={() => setActiveStatModal('pending')}
            className="group cursor-pointer rounded-2xl border border-border bg-card p-4 shadow-sm hover:border-sky-500/60 hover:shadow-md hover:scale-[1.02] transition-all"
          >
            <div className="flex items-center justify-between text-muted text-xs font-medium">
              <span className="group-hover:text-sky-500 transition-colors">Pending</span>
              <Activity size={16} className="text-sky-500 group-hover:scale-110 transition-transform" />
            </div>
            <div className="mt-2 text-2xl font-bold text-ink">{activeStats.pending}</div>
            <div className="mt-1 flex items-center justify-between text-[11px]">
              <span className="text-muted font-medium">Awaiting delivery</span>
              <span className="text-[10px] text-muted opacity-0 group-hover:opacity-100 transition-opacity">
                Details ↗
              </span>
            </div>
          </div>

          {/* Missing Card */}
          <div
            onClick={() => setActiveStatModal('missing')}
            className="group cursor-pointer rounded-2xl border border-border bg-card p-4 shadow-sm hover:border-rose-500/60 hover:shadow-md hover:scale-[1.02] transition-all"
          >
            <div className="flex items-center justify-between text-muted text-xs font-medium">
              <span className="group-hover:text-rose-500 transition-colors">Missing</span>
              <AlertTriangle size={16} className="text-rose-500 group-hover:scale-110 transition-transform" />
            </div>
            <div className="mt-2 text-2xl font-bold text-rose-500">{activeStats.missing}</div>
            <div className="mt-1 flex items-center justify-between text-[11px]">
              <span className="text-rose-500 font-medium">
                {formatDelta(activeStats.missingDelta)} past SLA
              </span>
              <span className="text-[10px] text-muted opacity-0 group-hover:opacity-100 transition-opacity">
                Details ↗
              </span>
            </div>
          </div>

          {/* SLA Health Card */}
          <div
            onClick={() => setActiveStatModal('sla')}
            className="group cursor-pointer rounded-2xl border border-border bg-card p-4 shadow-sm hover:border-accent/60 hover:shadow-md hover:scale-[1.02] transition-all"
          >
            <div className="flex items-center justify-between text-muted text-xs font-medium">
              <span className="group-hover:text-accent transition-colors">SLA Health</span>
              <Gauge size={16} className="text-accent group-hover:scale-110 transition-transform" />
            </div>
            <div className="mt-2 text-2xl font-bold text-ink">{activeStats.slaHealth}%</div>
            <div className="mt-1 flex items-center justify-between text-[11px]">
              <span className="text-emerald-500 font-medium">
                {formatDelta(activeStats.slaDelta, '%')} on-time
              </span>
              <span className="text-[10px] text-muted opacity-0 group-hover:opacity-100 transition-opacity">
                Details ↗
              </span>
            </div>
          </div>

          {/* Size Anomalies Card */}
          <div
            onClick={() => setActiveStatModal('anomalies')}
            className="group cursor-pointer rounded-2xl border border-border bg-card p-4 shadow-sm hover:border-purple-500/60 hover:shadow-md hover:scale-[1.02] transition-all"
          >
            <div className="flex items-center justify-between text-muted text-xs font-medium">
              <span className="group-hover:text-purple-500 transition-colors">Size Anomalies</span>
              <Zap size={16} className="text-purple-500 group-hover:scale-110 transition-transform" />
            </div>
            <div className="mt-2 text-2xl font-bold text-ink">{activeStats.sizeAnomalies}</div>
            <div className="mt-1 flex items-center justify-between text-[11px]">
              <span className="text-muted font-medium">
                {formatDelta(activeStats.sizeAnomaliesDelta)} vs base
              </span>
              <span className="text-[10px] text-muted opacity-0 group-hover:opacity-100 transition-opacity">
                Details ↗
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Zero Data Recovery State */}
      {reports.length === 0 && !loading && (
        <div className="rounded-2xl border border-dashed border-border bg-card p-8 text-center space-y-3">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-accent-soft text-accent">
            <RefreshCw size={22} />
          </div>
          <h3 className="text-base font-semibold text-ink">No deliveries found for current filter criteria</h3>
          <p className="text-xs text-muted max-w-md mx-auto">
            Try resetting your search query, switching cadence to all, or extending the observation window.
          </p>
          <button
            type="button"
            onClick={() => {
              setQ('')
              setCadence('all')
              setPeriod('24h')
              setTableStatusFilter('all')
              setTableReportFilter('all')
              setTableDateFilter('')
              void handleRefresh()
            }}
            className="inline-flex items-center gap-2 rounded-full bg-accent px-4 py-2 text-xs font-semibold text-white shadow-sm hover:opacity-95"
          >
            <RotateCcw size={14} />
            Reset All Filters & Reload Data
          </button>
        </div>
      )}

      {/* Middle Section: Trends & Next Expected Arrivals */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Arrival Volume & SLA Trend Chart */}
        <div className="rounded-2xl border border-border bg-card p-5 shadow-sm lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-ink flex items-center gap-2">
                <TrendingUp size={16} className="text-accent" />
                Hourly Arrival & SLA Trend ({period} CST)
              </h2>
              <p className="text-xs text-muted">Hourly distribution of on-time, late, and pending deliveries in CST</p>
            </div>
            <div className="flex items-center gap-3 text-[11px]">
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-emerald-500" /> On-time
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-amber-500" /> Late
              </span>
            </div>
          </div>

          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                key={`trend-${period}-${stats?.trend?.length ?? 0}`}
                data={stats?.trend ?? []}
              >
                <defs>
                  <linearGradient id="colorRecv" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorLate" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'var(--card)',
                    borderColor: 'var(--border)',
                    borderRadius: 12,
                    fontSize: 12,
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="received"
                  stroke="#10b981"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#colorRecv)"
                  isAnimationActive={true}
                  animationDuration={1000}
                  animationEasing="ease-out"
                />
                <Area
                  type="monotone"
                  dataKey="late"
                  stroke="#f59e0b"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#colorLate)"
                  isAnimationActive={true}
                  animationDuration={1000}
                  animationEasing="ease-out"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Next Expected Arrivals Card */}
        <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-ink flex items-center gap-2">
              <Clock size={16} className="text-accent" />
              Upcoming Arrivals
            </h2>
            <span className="rounded-full bg-accent-soft px-2 py-0.5 text-[10px] font-semibold text-accent">
              Live SLA
            </span>
          </div>

          <div className="divide-y divide-border/60 overflow-y-auto max-h-56 pr-1 space-y-2">
            {upcoming.length === 0 ? (
              <div className="py-6 text-center text-xs text-muted">
                No immediate pending arrivals scheduled.
              </div>
            ) : (
              upcoming.map((u) => {
                const diffMs = new Date(u.expectedAt).getTime() - now
                return (
                  <div
                    key={u.id}
                    onClick={() => handleOpenDetail(u)}
                    className="flex cursor-pointer items-center justify-between pt-2 text-xs hover:text-accent transition"
                  >
                    <div>
                      <div className="font-mono font-medium text-ink">{u.code}</div>
                      <div className="text-[11px] text-muted truncate max-w-[130px]">
                        {u.filename}
                      </div>
                    </div>
                    <div className="text-right">
                      <span
                        className={`rounded px-1.5 py-0.5 font-mono text-[11px] font-medium ${
                          diffMs < 0
                            ? 'bg-rose-500/10 text-rose-500 font-semibold'
                            : 'bg-canvas text-muted'
                        }`}
                      >
                        {formatCountdown(diffMs)}
                      </span>
                      <div className="text-[10px] text-muted">
                        Due {formatTimeCST(u.expectedAt)}
                      </div>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>
      </div>

      {/* SFTP Operations & Anomaly Radar */}
      <AnomalyDetectionPanel reports={reports} onOpenDetail={handleOpenDetail} period={period} />

      {/* Main Reports Table */}
      <div className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden flex flex-col">
        {/* Table Title & Summary */}
        <div className="flex flex-col gap-3 border-b border-border px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-semibold text-ink">Recent Transferred Reports</h2>
              <span className="rounded-full bg-accent-soft px-2.5 py-0.5 text-[11px] font-semibold text-accent">
                {filteredAndSortedReports.length} {filteredAndSortedReports.length === 1 ? 'file' : 'files'}
              </span>
            </div>
            <p className="text-xs text-muted">
              Inspection table for SFTP transfers. Click any row to examine size variance and anomaly telemetry.
            </p>
          </div>

          {(tableStatusFilter !== 'all' || tableReportFilter !== 'all' || tableDateFilter) && (
            <button
              type="button"
              onClick={handleClearTableFilters}
              className="flex items-center gap-1.5 self-start rounded-full border border-border bg-canvas px-3 py-1.5 text-xs font-medium text-muted hover:text-ink hover:border-accent transition sm:self-auto"
            >
              <RotateCcw size={12} />
              Reset Table Filters
            </button>
          )}
        </div>

        {/* In-Table Filter Toolbar */}
        <div className="flex flex-wrap items-center gap-2.5 border-b border-border bg-canvas/40 px-5 py-3 text-xs">
          <div className="flex items-center gap-1.5 text-muted font-medium">
            <Filter size={13} className="text-accent" />
            <span>Filter by:</span>
          </div>

          {/* Status Filter */}
          <select
            value={tableStatusFilter}
            onChange={(e) => {
              setTableStatusFilter(e.target.value as typeof tableStatusFilter)
              setCurrentPage(1)
            }}
            className="rounded-xl border border-border bg-card px-2.5 py-1.5 text-xs text-ink outline-none focus:border-accent"
          >
            <option value="all">All Statuses</option>
            <option value="received">Received</option>
            <option value="late">Late</option>
            <option value="pending">Pending</option>
            <option value="missing">Missing</option>
          </select>

          {/* Report Code Filter */}
          <select
            value={tableReportFilter}
            onChange={(e) => {
              setTableReportFilter(e.target.value)
              setCurrentPage(1)
            }}
            className="rounded-xl border border-border bg-card px-2.5 py-1.5 text-xs font-mono text-ink outline-none focus:border-accent"
          >
            <option value="all">All Report Codes</option>
            {availableReportCodes.map((code) => (
              <option key={code} value={code}>
                {code}
              </option>
            ))}
          </select>

          {/* File Date Filter */}
          <div className="flex items-center gap-1">
            <div className="relative flex items-center">
              <Calendar size={13} className="pointer-events-none absolute left-2.5 text-muted" />
              <select
                value={tableDateFilter}
                onChange={(e) => {
                  setTableDateFilter(e.target.value)
                  setCurrentPage(1)
                }}
                className="rounded-xl border border-border bg-card pl-8 pr-3 py-1.5 text-xs text-ink outline-none focus:border-accent"
              >
                <option value="">All Business Dates</option>
                {availableDates.map((date) => (
                  <option key={date} value={date}>
                    {date}
                  </option>
                ))}
              </select>
            </div>
            {tableDateFilter && (
              <button
                type="button"
                onClick={() => {
                  setTableDateFilter('')
                  setCurrentPage(1)
                }}
                title="Clear date filter"
                className="rounded-lg p-1 text-muted hover:text-ink"
              >
                <X size={13} />
              </button>
            )}
          </div>
        </div>

        {/* Scrollable Table Viewport with Sticky Header */}
        <div className="max-h-[480px] overflow-y-auto overflow-x-auto">
          <table className="w-full text-left text-xs text-ink">
            <thead className="sticky top-0 z-10 border-b border-border bg-card/95 backdrop-blur-xs text-[11px] font-semibold text-muted uppercase tracking-wider shadow-xs">
              <tr>
                <th className="px-5 py-3 whitespace-nowrap">Status</th>
                <th
                  onClick={() => handleSort('code')}
                  className="px-4 py-3 whitespace-nowrap cursor-pointer hover:text-ink transition"
                >
                  <span className="flex items-center gap-1">
                    Report Code
                    <ArrowUpDown size={11} className={sortField === 'code' ? 'text-accent' : 'opacity-40'} />
                  </span>
                </th>
                <th className="px-4 py-3 whitespace-nowrap">Filename</th>
                <th className="px-4 py-3 whitespace-nowrap">Cadence</th>
                <th
                  onClick={() => handleSort('businessDate')}
                  className="px-4 py-3 whitespace-nowrap cursor-pointer hover:text-ink transition"
                >
                  <span className="flex items-center gap-1">
                    Business Date
                    <ArrowUpDown size={11} className={sortField === 'businessDate' ? 'text-accent' : 'opacity-40'} />
                  </span>
                </th>
                <th
                  onClick={() => handleSort('sizeBytes')}
                  className="px-4 py-3 whitespace-nowrap cursor-pointer hover:text-ink transition"
                >
                  <span className="flex items-center gap-1">
                    Size
                    <ArrowUpDown size={11} className={sortField === 'sizeBytes' ? 'text-accent' : 'opacity-40'} />
                  </span>
                </th>
                <th
                  onClick={() => handleSort('expectedAt')}
                  className="px-4 py-3 whitespace-nowrap cursor-pointer hover:text-ink transition"
                >
                  <span className="flex items-center gap-1">
                    Expected
                    <ArrowUpDown size={11} className={sortField === 'expectedAt' ? 'text-accent' : 'opacity-40'} />
                  </span>
                </th>
                <th
                  onClick={() => handleSort('arrivedAt')}
                  className="px-4 py-3 whitespace-nowrap cursor-pointer hover:text-ink transition"
                >
                  <span className="flex items-center gap-1">
                    Arrived
                    <ArrowUpDown size={11} className={sortField === 'arrivedAt' ? 'text-accent' : 'opacity-40'} />
                  </span>
                </th>
                <th
                  onClick={() => handleSort('delayMinutes')}
                  className="px-4 py-3 whitespace-nowrap cursor-pointer hover:text-ink transition"
                >
                  <span className="flex items-center gap-1">
                    Delay
                    <ArrowUpDown size={11} className={sortField === 'delayMinutes' ? 'text-accent' : 'opacity-40'} />
                  </span>
                </th>
                <th className="px-5 py-3 text-right whitespace-nowrap">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {paginatedReports.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-5 py-12 text-center text-xs text-muted">
                    No files found matching the selected filters.
                  </td>
                </tr>
              ) : (
                paginatedReports.map((report) => (
                  <tr
                    key={report.id}
                    onClick={() => handleOpenDetail(report)}
                    className="cursor-pointer hover:bg-canvas/50 transition"
                  >
                    <td className="px-5 py-3.5 whitespace-nowrap">{statusBadge(report.status)}</td>
                    <td className="px-4 py-3.5 font-mono font-semibold text-ink whitespace-nowrap">
                      {report.code}
                    </td>
                    <td className="px-4 py-3.5 font-mono text-muted whitespace-nowrap">
                      {report.filename}
                    </td>
                    <td className="px-4 py-3.5 whitespace-nowrap">
                      <span className="rounded bg-canvas border border-border px-2 py-0.5 text-[11px] font-medium">
                        {report.cadence}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 whitespace-nowrap text-muted">
                      {report.businessDate}
                    </td>
                    <td className="px-4 py-3.5 whitespace-nowrap font-medium text-ink">
                      {formatBytes(report.sizeBytes)}
                    </td>
                    <td className="px-4 py-3.5 whitespace-nowrap text-muted">
                      {formatWhen(report.expectedAt)}
                    </td>
                    <td className="px-4 py-3.5 whitespace-nowrap text-muted">
                      {formatWhen(report.arrivedAt)}
                    </td>
                    <td className="px-4 py-3.5 whitespace-nowrap font-mono">
                      {report.delayMinutes !== null ? (
                        <span
                          className={
                            report.delayMinutes > 0
                              ? 'text-amber-500 font-semibold'
                              : 'text-emerald-500'
                          }
                        >
                          {report.delayMinutes > 0 ? `+${report.delayMinutes}m` : `${report.delayMinutes}m`}
                        </span>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-right whitespace-nowrap">
                      <button
                        type="button"
                        className="rounded-full p-1 text-muted hover:text-accent hover:bg-canvas transition"
                      >
                        <ChevronRight size={16} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        <div className="flex flex-col gap-3 border-t border-border bg-canvas/30 px-5 py-3 text-xs sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3 text-muted">
            <span>
              Showing{' '}
              <strong className="text-ink">
                {filteredAndSortedReports.length === 0 ? 0 : (safePage - 1) * pageSize + 1}
              </strong>{' '}
              to{' '}
              <strong className="text-ink">
                {Math.min(safePage * pageSize, filteredAndSortedReports.length)}
              </strong>{' '}
              of <strong className="text-ink">{filteredAndSortedReports.length}</strong> files
            </span>

            <div className="flex items-center gap-1.5 border-l border-border pl-3">
              <span>Rows per page:</span>
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value))
                  setCurrentPage(1)
                }}
                className="rounded-lg border border-border bg-card px-2 py-0.5 text-xs text-ink outline-none focus:border-accent"
              >
                {[10, 25, 50, 100].map((size) => (
                  <option key={size} value={size}>
                    {size}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex items-center gap-1 self-center sm:self-auto">
            <button
              type="button"
              disabled={safePage <= 1}
              onClick={() => setCurrentPage(1)}
              title="First page"
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-card text-muted hover:text-ink disabled:opacity-40 transition"
            >
              <ChevronsLeft size={14} />
            </button>
            <button
              type="button"
              disabled={safePage <= 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              title="Previous page"
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-card text-muted hover:text-ink disabled:opacity-40 transition"
            >
              <ChevronLeft size={14} />
            </button>

            <span className="px-2 text-xs font-medium text-ink">
              Page {safePage} of {totalPages}
            </span>

            <button
              type="button"
              disabled={safePage >= totalPages}
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              title="Next page"
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-card text-muted hover:text-ink disabled:opacity-40 transition"
            >
              <ChevronRight size={14} />
            </button>
            <button
              type="button"
              disabled={safePage >= totalPages}
              onClick={() => setCurrentPage(totalPages)}
              title="Last page"
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-card text-muted hover:text-ink disabled:opacity-40 transition"
            >
              <ChevronsRight size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* Report Detail Modal */}
      {selectedReport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
          <div className="w-full max-w-2xl rounded-3xl border border-border bg-card p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-bold text-ink">{selectedReport.code}</h3>
                  {statusBadge(selectedReport.status)}
                </div>
                <p className="mt-1 font-mono text-xs text-muted">{selectedReport.filename}</p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedReport(null)}
                className="rounded-full p-1.5 text-muted hover:bg-canvas hover:text-ink transition"
              >
                <X size={18} />
              </button>
            </div>

            {/* Metadata Summary */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 rounded-2xl border border-border bg-canvas/60 p-4 text-xs">
              <div>
                <span className="text-muted">Cadence:</span>
                <div className="font-semibold text-ink mt-0.5">{selectedReport.cadence}</div>
              </div>
              <div>
                <span className="text-muted">Size:</span>
                <div className="font-semibold text-ink mt-0.5">{formatBytes(selectedReport.sizeBytes)}</div>
              </div>
              <div>
                <span className="text-muted">Business Date:</span>
                <div className="font-semibold text-ink mt-0.5">{selectedReport.businessDate}</div>
              </div>
              <div>
                <span className="text-muted">Delay vs SLA:</span>
                <div className="font-semibold text-ink mt-0.5">
                  {selectedReport.delayMinutes !== null ? `${selectedReport.delayMinutes} min` : 'N/A'}
                </div>
              </div>
            </div>

            {/* Anomaly Analytics */}
            {loadingAnomaly ? (
              <div className="py-8 text-center text-xs text-muted">
                Computing z-scores and variance against 7-day rolling window...
              </div>
            ) : anomalyData ? (
              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-3">
                  <div className="rounded-xl border border-border bg-card p-3">
                    <span className="text-[11px] text-muted">Size Z-Score</span>
                    <div
                      className={`text-lg font-bold mt-1 ${
                        Math.abs(anomalyData.sizeZ) >= 2.0 ? 'text-rose-500' : 'text-emerald-500'
                      }`}
                    >
                      {anomalyData.sizeZ}σ
                    </div>
                    <span className="text-[10px] text-muted">
                      {Math.abs(anomalyData.sizeZ) >= 2.0 ? 'Exceeds 2σ threshold' : 'Within normal variance'}
                    </span>
                  </div>

                  <div className="rounded-xl border border-border bg-card p-3">
                    <span className="text-[11px] text-muted">7-Day Mean Size</span>
                    <div className="text-lg font-bold text-ink mt-1">
                      {formatBytes(anomalyData.sizeMean)}
                    </div>
                    <span className="text-[10px] text-muted">Rolling baseline</span>
                  </div>

                  <div className="rounded-xl border border-border bg-card p-3">
                    <span className="text-[11px] text-muted">Missing Streak</span>
                    <div className="text-lg font-bold text-ink mt-1">
                      {anomalyData.missingStreak}
                    </div>
                    <span className="text-[10px] text-muted">consecutive days</span>
                  </div>
                </div>

                {/* History Bar Chart */}
                {anomalyData.history && anomalyData.history.length > 0 && (
                  <div className="rounded-xl border border-border bg-card p-4">
                    <div className="text-xs font-semibold text-ink mb-2">
                      Recent Delivery Size History (KB)
                    </div>
                    <div className="h-36 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                          key={`history-${selectedReport?.id}-${anomalyData.history.length}`}
                          data={anomalyData.history}
                        >
                          <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                          <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                          <YAxis tick={{ fontSize: 10 }} />
                          <Tooltip
                            contentStyle={{
                              backgroundColor: 'var(--card)',
                              borderColor: 'var(--border)',
                              borderRadius: 8,
                              fontSize: 11,
                            }}
                          />
                          <Bar
                            dataKey="size"
                            fill="var(--accent)"
                            radius={[4, 4, 0, 0]}
                            isAnimationActive={true}
                            animationDuration={800}
                            animationEasing="ease-out"
                          />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                )}
              </div>
            ) : null}

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setSelectedReport(null)}
                className="rounded-full bg-accent px-5 py-2 text-xs font-semibold text-white shadow-sm hover:opacity-95"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating Detail Window for KPI Cards */}
      {statModalData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
          <div className="w-full max-w-3xl max-h-[90vh] rounded-3xl border border-border bg-card p-6 shadow-2xl flex flex-col space-y-4 animate-in fade-in zoom-in-95 duration-150 overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-start justify-between border-b border-border pb-4">
              <div className="flex items-start gap-3">
                <div className={`mt-0.5 flex h-10 w-10 items-center justify-center rounded-2xl border ${statModalData.badgeBg}`}>
                  <statModalData.icon size={20} className={statModalData.color} />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-ink">{statModalData.title}</h3>
                  <p className="text-xs text-muted mt-0.5">{statModalData.subtitle}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setActiveStatModal(null)}
                className="rounded-full p-1.5 text-muted hover:bg-canvas hover:text-ink transition"
              >
                <X size={18} />
              </button>
            </div>

            {/* Top KPI Metrics Row */}
            <div className="grid grid-cols-3 gap-3">
              {statModalData.metrics.map((m, idx) => (
                <div key={idx} className="rounded-xl border border-border bg-canvas/60 p-3">
                  <span className="text-[11px] text-muted">{m.label}</span>
                  <div className="text-base font-bold text-ink mt-0.5">{m.value}</div>
                </div>
              ))}
            </div>

            {/* Modal Visual Analytics Chart */}
            {statModalData.chart && (
              <div className="rounded-2xl border border-border bg-canvas/40 p-4">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-xs font-semibold text-ink flex items-center gap-1.5">
                    <TrendingUp size={14} className="text-accent" />
                    {statModalData.chart.title}
                  </span>
                  {statModalData.chart.legend && (
                    <div className="flex items-center gap-3 text-[10px] text-muted">
                      {statModalData.chart.legend.map((l, i) => (
                        <span key={i} className="flex items-center gap-1">
                          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: l.color }} />
                          {l.label}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <div className="h-44 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    {statModalData.chart.type === 'bar-cadence' ? (
                      <BarChart
                        key={`cadence-${statModalData.chart.data.length}`}
                        data={statModalData.chart.data}
                        margin={{ top: 8, right: 10, left: -20, bottom: 0 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                        <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                        <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: 'var(--card)',
                            borderColor: 'var(--border)',
                            borderRadius: 12,
                            fontSize: 11,
                          }}
                        />
                        <Bar
                          dataKey="EOD"
                          fill="#6366f1"
                          radius={[3, 3, 0, 0]}
                          stackId="a"
                          isAnimationActive={true}
                          animationDuration={800}
                          animationEasing="ease-out"
                        />
                        <Bar
                          dataKey="ITD"
                          fill="#0ea5e9"
                          radius={[3, 3, 0, 0]}
                          stackId="a"
                          isAnimationActive={true}
                          animationDuration={800}
                          animationEasing="ease-out"
                        />
                        <Bar
                          dataKey="HTML"
                          fill="#10b981"
                          radius={[3, 3, 0, 0]}
                          stackId="a"
                          isAnimationActive={true}
                          animationDuration={800}
                          animationEasing="ease-out"
                        />
                      </BarChart>
                    ) : statModalData.chart.type === 'bar-delay' ? (
                      <BarChart
                        key={`delay-${statModalData.chart.data.length}`}
                        data={statModalData.chart.data}
                        margin={{ top: 8, right: 10, left: -20, bottom: 0 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                        <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                        <YAxis tick={{ fontSize: 10 }} unit="m" />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: 'var(--card)',
                            borderColor: 'var(--border)',
                            borderRadius: 12,
                            fontSize: 11,
                          }}
                          formatter={(val: unknown) => [`+${val} min`, 'Delay']}
                        />
                        <ReferenceLine
                          y={15}
                          stroke="#f59e0b"
                          strokeDasharray="3 3"
                          label={{ value: '15m SLA', fontSize: 10, fill: '#f59e0b' }}
                        />
                        <Bar
                          dataKey="delay"
                          radius={[4, 4, 0, 0]}
                          isAnimationActive={true}
                          animationDuration={800}
                          animationEasing="ease-out"
                        >
                          {statModalData.chart.data.map((entry: { delay: number }, idx: number) => (
                            <Cell key={idx} fill={entry.delay > 30 ? '#f43f5e' : '#f59e0b'} />
                          ))}
                        </Bar>
                      </BarChart>
                    ) : statModalData.chart.type === 'bar-pending' ? (
                      <BarChart
                        key={`pending-${statModalData.chart.data.length}`}
                        data={statModalData.chart.data}
                        margin={{ top: 8, right: 10, left: -20, bottom: 0 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                        <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                        <YAxis tick={{ fontSize: 10 }} unit="h" />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: 'var(--card)',
                            borderColor: 'var(--border)',
                            borderRadius: 12,
                            fontSize: 11,
                          }}
                          formatter={(val: unknown) => [`${val} hrs`, 'Until Cutoff']}
                        />
                        <Bar
                          dataKey="hoursLeft"
                          fill="#0284c7"
                          radius={[4, 4, 0, 0]}
                          isAnimationActive={true}
                          animationDuration={800}
                          animationEasing="ease-out"
                        />
                      </BarChart>
                    ) : statModalData.chart.type === 'bar-missing' ? (
                      <BarChart
                        key={`missing-${statModalData.chart.data.length}`}
                        data={statModalData.chart.data}
                        margin={{ top: 8, right: 10, left: -20, bottom: 0 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                        <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                        <YAxis tick={{ fontSize: 10 }} unit="h" />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: 'var(--card)',
                            borderColor: 'var(--border)',
                            borderRadius: 12,
                            fontSize: 11,
                          }}
                          formatter={(val: unknown) => [`+${val} hrs`, 'Past Cutoff']}
                        />
                        <Bar
                          dataKey="hoursPast"
                          fill="#ef4444"
                          radius={[4, 4, 0, 0]}
                          isAnimationActive={true}
                          animationDuration={800}
                          animationEasing="ease-out"
                        />
                      </BarChart>
                    ) : statModalData.chart.type === 'area-sla' ? (
                      <AreaChart
                        key={`sla-${statModalData.chart.data.length}`}
                        data={statModalData.chart.data}
                        margin={{ top: 8, right: 10, left: -20, bottom: 0 }}
                      >
                        <defs>
                          <linearGradient id="colorSlaModal" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#10b981" stopOpacity={0.35} />
                            <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                        <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                        <YAxis domain={[50, 100]} tick={{ fontSize: 10 }} unit="%" />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: 'var(--card)',
                            borderColor: 'var(--border)',
                            borderRadius: 12,
                            fontSize: 11,
                          }}
                          formatter={(val: unknown) => [`${val}%`, 'On-time SLA']}
                        />
                        <ReferenceLine
                          y={95}
                          stroke="#6366f1"
                          strokeDasharray="3 3"
                          label={{ value: '95% Benchmark', fontSize: 10, fill: '#6366f1' }}
                        />
                        <Area
                          type="monotone"
                          dataKey="rate"
                          stroke="#10b981"
                          strokeWidth={2}
                          fill="url(#colorSlaModal)"
                          isAnimationActive={true}
                          animationDuration={900}
                          animationEasing="ease-out"
                        />
                      </AreaChart>
                    ) : (
                      <BarChart
                        key={`anomalies-${statModalData.chart.data.length}`}
                        data={statModalData.chart.data}
                        margin={{ top: 8, right: 10, left: -20, bottom: 0 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                        <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                        <YAxis tick={{ fontSize: 10 }} unit=" KB" />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: 'var(--card)',
                            borderColor: 'var(--border)',
                            borderRadius: 12,
                            fontSize: 11,
                          }}
                        />
                        <Bar
                          dataKey="actualKb"
                          name="Actual (KB)"
                          fill="#a855f7"
                          radius={[3, 3, 0, 0]}
                          isAnimationActive={true}
                          animationDuration={800}
                          animationEasing="ease-out"
                        />
                        <Bar
                          dataKey="baselineKb"
                          name="Baseline (KB)"
                          fill="#64748b"
                          radius={[3, 3, 0, 0]}
                          isAnimationActive={true}
                          animationDuration={800}
                          animationEasing="ease-out"
                        />
                      </BarChart>
                    )}
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {/* Scrollable File List */}
            <div className="flex-1 flex flex-col min-h-0">
              <div className="flex items-center justify-between text-xs font-semibold text-ink mb-2">
                <span>Related File Transfers ({statModalData.items.length})</span>
                <span className="text-[11px] text-muted font-normal">Click row for full telemetry diagnosis</span>
              </div>

              <div className="divide-y divide-border/60 max-h-52 overflow-y-auto rounded-xl border border-border bg-card p-2 space-y-1">
                {statModalData.items.length === 0 ? (
                  <div className="py-8 text-center text-xs text-muted">
                    No files found in this category.
                  </div>
                ) : (
                  statModalData.items.map((r) => (
                    <div
                      key={r.id}
                      onClick={() => {
                        setActiveStatModal(null)
                        void handleOpenDetail(r)
                      }}
                      className="flex items-center justify-between p-2.5 rounded-lg hover:bg-canvas transition cursor-pointer text-xs"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        {statusBadge(r.status)}
                        <span className="font-mono font-semibold text-ink">{r.code}</span>
                        <span className="font-mono text-muted text-[11px] truncate max-w-[200px]">
                          {r.filename}
                        </span>
                      </div>

                      <div className="flex items-center gap-4 text-[11px] shrink-0">
                        <span className="text-muted">{r.businessDate}</span>
                        <span className="font-medium text-ink">{formatBytes(r.sizeBytes)}</span>
                        {r.delayMinutes !== null && (
                          <span
                            className={`font-mono font-medium ${
                              r.delayMinutes > 0 ? 'text-amber-500' : 'text-emerald-500'
                            }`}
                          >
                            {r.delayMinutes > 0 ? `+${r.delayMinutes}m` : `${r.delayMinutes}m`}
                          </span>
                        )}
                        <ChevronRight size={14} className="text-muted" />
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Modal Footer Actions */}
            <div className="flex items-center justify-between border-t border-border pt-3">
              {statModalData.statusFilter ? (
                <button
                  type="button"
                  onClick={() => {
                    setTableStatusFilter(statModalData.statusFilter)
                    setCurrentPage(1)
                    setActiveStatModal(null)
                  }}
                  className="rounded-full border border-border bg-canvas px-4 py-2 text-xs font-semibold text-ink hover:border-accent hover:text-accent transition"
                >
                  Filter Main Table to {statModalData.title}
                </button>
              ) : (
                <div />
              )}

              <button
                type="button"
                onClick={() => setActiveStatModal(null)}
                className="rounded-full bg-accent px-5 py-2 text-xs font-semibold text-white shadow-sm hover:opacity-95"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
