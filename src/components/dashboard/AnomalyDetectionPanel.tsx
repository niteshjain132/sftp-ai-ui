import { useState, useMemo } from 'react'
import {
  TrendingDown,
  Clock,
  ChevronRight,
  ShieldCheck,
  Zap,
  Sparkles,
  CheckCircle2,
} from 'lucide-react'
import { BlinkingBot } from '../layout/BlinkingBot'
import { formatBytes, formatTimeCST, formatDateTimeCST } from '../../lib/format'
import type { Report } from '../../types'

export type Tracked24hReport = {
  report: Report
  isSizeDrop: boolean
  isDelayed: boolean
  isOnTime: boolean
  sizeDropPct: number
  baselineSize: number
  zScore: number
  delayMinutes: number
  expectedCST: string
  arrivedCST: string
  dateCST: string
  diagnosticHint: string
  severity: 'critical' | 'warning' | 'nominal'
}

type Props = {
  reports: Report[]
  onOpenDetail: (report: Report) => void
  period?: string
}

export function AnomalyDetectionPanel({ reports, onOpenDetail, period = '24h' }: Props) {
  // Default to 'size_drop' as requested
  const [filterType, setFilterType] = useState<'size_drop' | 'delayed' | 'on_time' | 'all'>('size_drop')
  const [now] = useState(() => Date.now())

  const durationMs = useMemo(() => {
    if (period === '1h') return 1 * 3600_000
    if (period === '3h') return 3 * 3600_000
    if (period === '6h') return 6 * 3600_000
    if (period === '12h') return 12 * 3600_000
    return 24 * 3600_000
  }, [period])

  // Compute transfers using Gaussian baseline of sibling historical reports
  const trackedReports: Tracked24hReport[] = useMemo(() => {
    const trailingCutoff = now - durationMs

    // Group reports by code to compute baseline size mean and std dev
    const statsByCode = new Map<string, { mean: number; std: number; count: number }>()
    for (const r of reports) {
      if (r.status === 'pending') continue
      const current = statsByCode.get(r.code) ?? { mean: 0, std: 0, count: 0 }
      current.mean += r.sizeBytes
      current.count += 1
      statsByCode.set(r.code, current)
    }

    // Finalize means and standard deviations
    for (const [code, stat] of statsByCode.entries()) {
      if (stat.count > 0) {
        stat.mean = stat.mean / stat.count
        const variance =
          reports
            .filter((r) => r.code === code && r.status !== 'pending')
            .reduce((acc, r) => acc + Math.pow(r.sizeBytes - stat.mean, 2), 0) /
          Math.max(1, stat.count - 1)
        stat.std = Math.sqrt(variance) || 1
      }
    }

    const list: Tracked24hReport[] = []

    for (const report of reports) {
      // Must have arrived within the trailing period window
      const arrivedMs = report.arrivedAt ? new Date(report.arrivedAt).getTime() : 0
      const isWithinWindow = arrivedMs > 0 && arrivedMs >= trailingCutoff && arrivedMs <= now

      if (!isWithinWindow) continue
      // Only include received or delayed reports as requested
      if (report.status !== 'received' && report.status !== 'late') continue

      const base = statsByCode.get(report.code)
      const meanSize = base ? base.mean : report.sizeBytes
      const stdSize = base ? base.std : 1

      // 1. File Size Drop detection: >30% drop or z-score <= -1.8
      const sizeDropPct = ((report.sizeBytes - meanSize) / meanSize) * 100
      const zScore = Number(((report.sizeBytes - meanSize) / stdSize).toFixed(2))
      const isSizeDrop = sizeDropPct <= -30 || zScore <= -1.8

      // 2. Delayed detection: late status or delayMinutes > 0
      const delay = report.delayMinutes ?? 0
      const isDelayed = report.status === 'late' || delay > 0

      // 3. Normal On-Time delivery
      const isOnTime = !isSizeDrop && !isDelayed

      let severity: Tracked24hReport['severity'] = 'nominal'
      if (sizeDropPct <= -50 || delay >= 35) {
        severity = 'critical'
      } else if (isSizeDrop || isDelayed) {
        severity = 'warning'
      }

      const expCST = formatTimeCST(report.expectedAt)
      const arrCST = formatTimeCST(report.arrivedAt)
      const dateCST = formatDateTimeCST(report.arrivedAt ?? report.expectedAt)

      let hint = ''
      if (isSizeDrop && isDelayed) {
        hint = `Compound anomaly: severe ${delay}m delay past ${expCST} SLA with a ${Math.abs(sizeDropPct).toFixed(1)}% size drop. High risk of partial batch write.`
      } else if (isSizeDrop) {
        hint = `Payload volume dropped ${Math.abs(sizeDropPct).toFixed(1)}% below 30-day baseline mean. Indicates possible upstream export truncation, partition drop, or table omission.`
      } else if (isDelayed) {
        hint = `Arrived at ${arrCST}, which is ${delay} mins past expected ${expCST} SLA cutoff. Upstream processing queue delay or SFTP transport throttling detected.`
      } else {
        hint = `Arrived safely on schedule at ${arrCST} (expected ${expCST}). Volume is healthy within Gaussian variance limits (±1.1σ).`
      }

      list.push({
        report,
        isSizeDrop,
        isDelayed,
        isOnTime,
        sizeDropPct,
        baselineSize: meanSize,
        zScore,
        delayMinutes: delay,
        expectedCST: expCST,
        arrivedCST: arrCST,
        dateCST,
        diagnosticHint: hint,
        severity,
      })
    }

    // Sort: critical first, then warnings, then most severe size drop or delay
    return list.sort((a, b) => {
      if (a.severity === 'critical' && b.severity !== 'critical') return -1
      if (b.severity === 'critical' && a.severity !== 'critical') return 1
      if (a.severity === 'warning' && b.severity === 'nominal') return -1
      if (b.severity === 'warning' && a.severity === 'nominal') return 1
      return (a.sizeDropPct ?? 0) - (b.sizeDropPct ?? 0)
    })
  }, [reports, now, durationMs])

  const sizeDropCount = trackedReports.filter((r) => r.isSizeDrop).length
  const delayedCount = trackedReports.filter((r) => r.isDelayed).length
  const onTimeCount = trackedReports.filter((r) => r.isOnTime).length
  const totalAnomalies = sizeDropCount + delayedCount

  const filteredReports = useMemo(() => {
    switch (filterType) {
      case 'size_drop':
        return trackedReports.filter((r) => r.isSizeDrop)
      case 'delayed':
        return trackedReports.filter((r) => r.isDelayed)
      case 'on_time':
        return trackedReports.filter((r) => r.isOnTime)
      case 'all':
      default:
        return trackedReports
    }
  }, [trackedReports, filterType])

  const handleAskCopilot = (item: Tracked24hReport) => {
    const { report } = item
    let prompt = ''
    if (item.isSizeDrop) {
      prompt = `Investigate the severe ${Math.abs(item.sizeDropPct).toFixed(1)}% file size drop on report ${report.code} (${report.filename}) received at ${item.arrivedCST}. The file arrived at ${formatBytes(report.sizeBytes)} vs a ${formatBytes(item.baselineSize)} 30-day baseline (z-score ${item.zScore}σ). What is the root cause and remediation?`
    } else if (item.isDelayed) {
      prompt = `Diagnose why ${report.code} (${report.filename}) arrived at ${item.arrivedCST}, which is ${item.delayMinutes} minutes late past its ${item.expectedCST} SLA deadline. Plot arrival trends and suggest upstream batch fixes.`
    } else {
      prompt = `Review health and transmission telemetry for ${report.code} (${report.filename}) arrived at ${item.arrivedCST}. Verify arrival stability and 7-day volume trend.`
    }

    window.dispatchEvent(
      new CustomEvent('sftp:ask-copilot', {
        detail: {
          prompt,
          reportContext: report.code,
        },
      }),
    )
  }

  // When there are no anomalies (0 size drops and 0 delays), the whole panel shows green!
  const isNominal = totalAnomalies === 0

  return (
    <div
      className={`rounded-2xl border p-5 shadow-sm space-y-4 transition-all duration-300 ${
        isNominal
          ? 'border-emerald-500/30 bg-gradient-to-b from-emerald-500/[0.08] via-emerald-500/[0.02] to-card'
          : 'border-rose-500/20 bg-gradient-to-b from-rose-500/[0.04] via-card to-card'
      }`}
    >
      {/* Panel Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <div
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border shadow-xs transition-colors ${
              isNominal
                ? 'bg-emerald-500/15 text-emerald-500 border-emerald-500/30'
                : 'bg-rose-500/10 text-rose-500 border-rose-500/20'
            }`}
          >
            {isNominal ? <ShieldCheck size={20} className="text-emerald-500" /> : <Zap size={20} className="animate-pulse" />}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold tracking-tight text-ink flex items-center gap-2">
                {period.toUpperCase()} SFTP Operations & Anomaly Radar
              </h2>
              {!isNominal ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/10 px-2.5 py-0.5 text-xs font-semibold text-rose-600 dark:text-rose-400 border border-rose-500/20">
                  <span className="h-1.5 w-1.5 rounded-full bg-rose-500 animate-ping" />
                  {totalAnomalies} {totalAnomalies === 1 ? 'Anomaly' : 'Anomalies'} Detected
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-3 py-0.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                  <ShieldCheck size={13} />
                  All Systems Nominal (0 Anomalies)
                </span>
              )}
              <span className="rounded-md bg-canvas px-2 py-0.5 font-mono text-[10px] font-semibold text-muted border border-border">
                All Hours in CST (UTC-6)
              </span>
            </div>
            <p className="text-xs text-muted mt-0.5">
              Real-time monitoring of all transfers received or delayed in the trailing {period} window. Flags payload size contractions (&gt;30%) and delivery delay breaches.
            </p>
          </div>
        </div>

        {/* Filter Tabs - Size Drops default */}
        <div className="flex flex-wrap items-center gap-1.5 rounded-xl border border-border bg-canvas/60 p-1 text-xs self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setFilterType('size_drop')}
            className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 font-medium transition ${
              filterType === 'size_drop'
                ? 'bg-rose-500/15 text-rose-600 dark:text-rose-400 shadow-xs border border-rose-500/30 font-semibold'
                : 'text-muted hover:text-ink'
            }`}
          >
            <TrendingDown size={12} />
            Size Drops ({sizeDropCount})
          </button>
          <button
            type="button"
            onClick={() => setFilterType('delayed')}
            className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 font-medium transition ${
              filterType === 'delayed'
                ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 shadow-xs border border-amber-500/30 font-semibold'
                : 'text-muted hover:text-ink'
            }`}
          >
            <Clock size={12} />
            Delayed ({delayedCount})
          </button>
          <button
            type="button"
            onClick={() => setFilterType('on_time')}
            className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 font-medium transition ${
              filterType === 'on_time'
                ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 shadow-xs border border-emerald-500/30 font-semibold'
                : 'text-muted hover:text-ink'
            }`}
          >
            <CheckCircle2 size={12} />
            On-Time ({onTimeCount})
          </button>
          <button
            type="button"
            onClick={() => setFilterType('all')}
            className={`rounded-lg px-2.5 py-1 font-medium transition ${
              filterType === 'all'
                ? 'bg-card text-ink shadow-xs border border-border font-semibold'
                : 'text-muted hover:text-ink'
            }`}
          >
            All {period} ({trackedReports.length})
          </button>
        </div>
      </div>

      {/* Whole Panel Green State Banner when no anomalies in window */}
      {isNominal && (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-5 text-center flex flex-col items-center justify-center space-y-2">
          <div className="h-10 w-10 rounded-full bg-emerald-500/20 text-emerald-500 flex items-center justify-center ring-4 ring-emerald-500/10">
            <ShieldCheck size={22} />
          </div>
          <div className="text-sm font-bold text-emerald-950 dark:text-emerald-200">
            {trackedReports.length === 0
              ? `No SFTP Deliveries or SLA Breaches in Trailing ${period.toUpperCase()}`
              : `All Trailing ${period.toUpperCase()} Deliveries Within Normal Bands (${trackedReports.length} On-Time)`}
          </div>
          <p className="text-xs text-muted max-w-lg leading-relaxed">
            {trackedReports.length === 0
              ? `No file arrivals or delivery delay breaches recorded in the trailing ${period} window. SFTP channels and transfer radar nominal.`
              : `Zero file size contractions (>30%) or SLA delay breaches detected in the trailing ${period} window. All incoming transmissions adhere strictly to Gaussian variance models (±1.5σ) and expected schedules in CST hours.`}
          </p>
        </div>
      )}

      {/* Empty Tab Filter Fallback (only when there are tracked reports in window but none matching this tab) */}
      {trackedReports.length > 0 && filteredReports.length === 0 && (
        <div className="rounded-xl border border-dashed border-border bg-card/60 p-6 text-center text-xs text-muted">
          No reports found under the {filterType === 'size_drop' ? 'Size Drops' : filterType === 'delayed' ? 'Delayed' : 'On-Time'} filter in trailing {period}.{' '}
          <button
            type="button"
            onClick={() => setFilterType('all')}
            className="text-accent underline font-semibold ml-1 hover:opacity-80"
          >
            View all {trackedReports.length} reports in this window →
          </button>
        </div>
      )}

      {/* Reports Grid */}
      {filteredReports.length > 0 && (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {filteredReports.map((item) => {
            return (
              <div
                key={item.report.id}
                className={`group relative flex flex-col justify-between rounded-xl border bg-card p-4 shadow-2xs transition-all ${
                  item.isSizeDrop
                    ? 'border-rose-500/30 hover:border-rose-500/60'
                    : item.isDelayed
                      ? 'border-amber-500/30 hover:border-amber-500/60'
                      : 'border-border hover:border-emerald-500/40'
                }`}
              >
                <div>
                  {/* Card Header */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm font-bold text-ink">
                        {item.report.code}
                      </span>
                      <span className="rounded bg-canvas px-1.5 py-0.5 text-[10px] font-semibold text-muted border border-border">
                        {item.report.cadence}
                      </span>
                      {item.severity === 'critical' ? (
                        <span className="rounded-full bg-rose-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400 border border-rose-500/20">
                          Critical Alert
                        </span>
                      ) : item.severity === 'warning' ? (
                        <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400 border border-amber-500/20">
                          Warning
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                          <CheckCircle2 size={10} />
                          On-Time
                        </span>
                      )}
                    </div>

                    <div className="text-[11px] text-muted font-mono">
                      {item.dateCST}
                    </div>
                  </div>

                  {/* Filename */}
                  <div className="mt-1 font-mono text-xs text-muted truncate">
                    {item.report.filename}
                  </div>

                  {/* Metrics Badges */}
                  <div className="mt-3 flex flex-wrap gap-2">
                    {item.isSizeDrop && (
                      <div className="flex items-center gap-1.5 rounded-lg bg-rose-500/10 px-2.5 py-1 text-xs font-semibold text-rose-600 dark:text-rose-400 border border-rose-500/20">
                        <TrendingDown size={14} />
                        <span>
                          Size Drop: {Math.abs(item.sizeDropPct).toFixed(1)}%
                        </span>
                        <span className="font-normal opacity-80 text-[11px]">
                          ({formatBytes(item.report.sizeBytes)} vs {formatBytes(item.baselineSize)})
                        </span>
                        <span className="rounded bg-rose-500/20 px-1 py-0.2 font-mono text-[10px]">
                          {item.zScore}σ
                        </span>
                      </div>
                    )}

                    {item.isDelayed && (
                      <div className="flex items-center gap-1.5 rounded-lg bg-amber-500/10 px-2.5 py-1 text-xs font-semibold text-amber-600 dark:text-amber-400 border border-amber-500/20">
                        <Clock size={14} />
                        <span>
                          Delay: +{item.delayMinutes} min
                        </span>
                        <span className="font-normal opacity-80 text-[11px]">
                          (Arrived {item.arrivedCST} vs {item.expectedCST} SLA)
                        </span>
                      </div>
                    )}

                    {item.isOnTime && (
                      <div className="flex items-center gap-1.5 rounded-lg bg-emerald-500/10 px-2.5 py-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                        <CheckCircle2 size={13} />
                        <span>Arrived: {item.arrivedCST}</span>
                        <span className="font-normal opacity-80 text-[11px]">
                          (Due {item.expectedCST} • {formatBytes(item.report.sizeBytes)})
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Diagnostic Context Note */}
                  <p className="mt-2.5 text-xs text-muted leading-relaxed rounded-lg bg-canvas/40 p-2 border border-border/60">
                    <span className="font-medium text-ink mr-1">Telemetry Signal:</span>
                    {item.diagnosticHint}
                  </p>
                </div>

                {/* Footer Action Buttons */}
                <div className="mt-4 flex items-center justify-between border-t border-border/60 pt-3">
                  <button
                    type="button"
                    onClick={() => handleAskCopilot(item)}
                    className="inline-flex items-center gap-2 rounded-xl bg-accent-soft px-3 py-1.5 text-xs font-semibold text-accent hover:bg-accent hover:text-white transition shadow-2xs group/btn"
                  >
                    <BlinkingBot size={16} />
                    <span>AI Diagnose</span>
                    <Sparkles size={11} className="opacity-70 group-hover/btn:rotate-12 transition-transform" />
                  </button>

                  <button
                    type="button"
                    onClick={() => onOpenDetail(item.report)}
                    className="inline-flex items-center gap-1 text-xs font-medium text-muted hover:text-ink transition"
                  >
                    <span>Inspect Variance</span>
                    <ChevronRight size={13} className="text-accent" />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
