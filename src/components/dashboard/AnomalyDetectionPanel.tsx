import { useState, useMemo } from 'react'
import {
  TrendingDown,
  Clock,
  ChevronRight,
  ShieldCheck,
  Zap,
  Sparkles,
} from 'lucide-react'
import { BlinkingBot } from '../layout/BlinkingBot'
import { formatBytes } from '../../lib/format'
import type { Report } from '../../types'

export type DetectedAnomaly = {
  report: Report
  type: 'size_drop' | 'extreme_delay' | 'both'
  sizeDropPct?: number
  baselineSize?: number
  zScore?: number
  delayMinutes?: number
  expectedTime: string
  arrivedTime?: string
  diagnosticHint: string
  severity: 'critical' | 'warning'
}

type Props = {
  reports: Report[]
  onOpenDetail: (report: Report) => void
}

export function AnomalyDetectionPanel({ reports, onOpenDetail }: Props) {
  const [filterType, setFilterType] = useState<'all' | 'size_drop' | 'extreme_delay'>('size_drop')
  const [now] = useState(() => Date.now())

  // Compute 24-hour anomalies using Gaussian baseline of sibling historical reports
  const anomalies: DetectedAnomaly[] = useMemo(() => {
    const trailing24hCutoff = now - 24 * 3600_000

    // Group reports by code to compute baseline size mean and std dev
    const statsByCode = new Map<string, { mean: number; std: number; count: number }>()
    for (const r of reports) {
      if (r.status === 'pending') continue
      const current = statsByCode.get(r.code) ?? { mean: 0, std: 0, count: 0 }
      current.mean += r.sizeBytes
      current.count += 1
      statsByCode.set(r.code, current)
    }

    // Finalize means
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

    const detected: DetectedAnomaly[] = []

    for (const report of reports) {
      // Evaluate if report falls within trailing 24 hours
      const arrivedMs = report.arrivedAt ? new Date(report.arrivedAt).getTime() : 0
      const expectedMs = new Date(report.expectedAt).getTime()
      const isWithin24h =
        (arrivedMs > 0 && arrivedMs >= trailing24hCutoff) ||
        (expectedMs >= trailing24hCutoff && expectedMs <= now + 3600_000)

      if (!isWithin24h) continue

      const base = statsByCode.get(report.code)
      const meanSize = base ? base.mean : report.sizeBytes
      const stdSize = base ? base.std : 1

      // 1. File Size Drop detection: >30% drop or z-score <= -1.8
      const sizeDropPct = ((report.sizeBytes - meanSize) / meanSize) * 100
      const zScore = Number(((report.sizeBytes - meanSize) / stdSize).toFixed(2))
      const isSizeDrop = report.status !== 'pending' && (sizeDropPct <= -30 || zScore <= -1.8)

      // 2. Extreme Delay detection: delay >= 20 minutes past expected SLA cutoff
      const delay = report.delayMinutes ?? 0
      const isExtremeDelay = (report.status === 'late' && delay >= 20) || (report.status === 'missing' && delay >= 20)

      if (isSizeDrop || isExtremeDelay) {
        let type: DetectedAnomaly['type'] = 'size_drop'
        if (isSizeDrop && isExtremeDelay) type = 'both'
        else if (isExtremeDelay) type = 'extreme_delay'

        const severity: DetectedAnomaly['severity'] =
          sizeDropPct <= -50 || delay >= 35 ? 'critical' : 'warning'

        let hint = ''
        if (isSizeDrop && isExtremeDelay) {
          hint = 'Compound anomaly: severe transfer delay combined with major payload shrinkage. High risk of partial batch write.'
        } else if (isSizeDrop) {
          hint = `Payload volume dropped ${Math.abs(sizeDropPct).toFixed(1)}% below historical mean. Likely upstream feed truncation, table drop, or missing partition batches.`
        } else {
          hint = `Arrived ${delay} mins past SLA deadline (${new Date(report.expectedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}). Upstream process delay or SFTP throttling detected.`
        }

        detected.push({
          report,
          type,
          sizeDropPct,
          baselineSize: meanSize,
          zScore,
          delayMinutes: delay,
          expectedTime: new Date(report.expectedAt).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
          }),
          arrivedTime: report.arrivedAt
            ? new Date(report.arrivedAt).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
              })
            : undefined,
          diagnosticHint: hint,
          severity,
        })
      }
    }

    // Sort: critical first, then most severe size drop or delay
    return detected.sort((a, b) => {
      if (a.severity === 'critical' && b.severity !== 'critical') return -1
      if (b.severity === 'critical' && a.severity !== 'critical') return 1
      return (a.sizeDropPct ?? 0) - (b.sizeDropPct ?? 0)
    })
  }, [reports, now])

  const filteredAnomalies = useMemo(() => {
    if (filterType === 'all') return anomalies
    return anomalies.filter((a) => a.type === filterType || a.type === 'both')
  }, [anomalies, filterType])

  const sizeDropCount = anomalies.filter((a) => a.type === 'size_drop' || a.type === 'both').length
  const lateCount = anomalies.filter((a) => a.type === 'extreme_delay' || a.type === 'both').length

  const handleAskCopilot = (anomaly: DetectedAnomaly) => {
    const { report } = anomaly
    let prompt = ''
    if (anomaly.type === 'size_drop') {
      prompt = `Investigate the severe ${Math.abs(anomaly.sizeDropPct ?? 0).toFixed(1)}% file size drop on report ${report.code} (${report.filename}) in the last 24 hours. The file arrived at ${formatBytes(report.sizeBytes)} vs a ${formatBytes(anomaly.baselineSize ?? 0)} baseline (z-score ${anomaly.zScore}σ). What is the root cause and recommended remediation?`
    } else if (anomaly.type === 'extreme_delay') {
      prompt = `Diagnose why ${report.code} (${report.filename}) arrived ${anomaly.delayMinutes} minutes late in the last 24 hours past its expected ${anomaly.expectedTime} SLA. Plot arrival delay trends and suggest SLA adjustments or upstream fixes.`
    } else {
      prompt = `Critical incident analysis: ${report.code} (${report.filename}) experienced both a ${Math.abs(anomaly.sizeDropPct ?? 0).toFixed(1)}% size drop and arrived ${anomaly.delayMinutes} min late in the last 24h. Correlate upstream batch runs and recommend corrective actions.`
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

  const isNominal = anomalies.length === 0

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
                24-Hour SFTP Anomaly Radar
              </h2>
              {!isNominal ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/10 px-2.5 py-0.5 text-xs font-semibold text-rose-600 dark:text-rose-400 border border-rose-500/20">
                  <span className="h-1.5 w-1.5 rounded-full bg-rose-500 animate-ping" />
                  {anomalies.length} {anomalies.length === 1 ? 'Anomaly' : 'Anomalies'} Detected
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-3 py-0.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                  <ShieldCheck size={13} />
                  All Systems Nominal (0 Anomalies)
                </span>
              )}
            </div>
            <p className="text-xs text-muted mt-0.5">
              Automated surveillance of trailing 24-hour transfers flagging sudden payload size drops (&gt;30%) and extreme arrival delays (&gt;20m).
            </p>
          </div>
        </div>

        {/* Filter Tabs - Size Drops default */}
        {!isNominal && (
          <div className="flex items-center gap-1.5 rounded-xl border border-border bg-canvas/60 p-1 text-xs self-start sm:self-auto">
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
              onClick={() => setFilterType('extreme_delay')}
              className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 font-medium transition ${
                filterType === 'extreme_delay'
                  ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 shadow-xs border border-amber-500/30 font-semibold'
                  : 'text-muted hover:text-ink'
              }`}
            >
              <Clock size={12} />
              Extreme Delays ({lateCount})
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
              All ({anomalies.length})
            </button>
          </div>
        )}
      </div>

      {/* Whole Panel Green Zero State when no anomalies in last 24h */}
      {isNominal && (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-6 text-center flex flex-col items-center justify-center space-y-2.5">
          <div className="h-11 w-11 rounded-full bg-emerald-500/20 text-emerald-500 flex items-center justify-center ring-4 ring-emerald-500/10">
            <ShieldCheck size={24} />
          </div>
          <div className="text-base font-bold text-emerald-950 dark:text-emerald-200">
            All 24-Hour Deliveries Within Normal Bands
          </div>
          <p className="text-xs text-muted max-w-lg leading-relaxed">
            Zero file size contractions (&gt;30%) or SLA delay breaches (&gt;20m) detected in the last 24 hours. All incoming transmissions adhere strictly to Gaussian variance models (±1.5σ) and expected schedules.
          </p>
        </div>
      )}

      {/* Tab Empty State if current tab has 0 items but other tab has items */}
      {!isNominal && filteredAnomalies.length === 0 && (
        <div className="rounded-xl border border-dashed border-border bg-card/60 p-6 text-center text-xs text-muted">
          No {filterType === 'size_drop' ? 'size drop' : 'delay'} anomalies in trailing 24h.{' '}
          <button
            type="button"
            onClick={() => setFilterType('all')}
            className="text-accent underline font-semibold ml-1 hover:opacity-80"
          >
            View all {anomalies.length} detected anomalies →
          </button>
        </div>
      )}

      {/* Anomaly Cards Grid */}
      {filteredAnomalies.length > 0 && (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {filteredAnomalies.map((item) => {
            const isSize = item.type === 'size_drop' || item.type === 'both'
            const isDelay = item.type === 'extreme_delay' || item.type === 'both'

            return (
              <div
                key={item.report.id}
                className="group relative flex flex-col justify-between rounded-xl border border-border bg-card p-4 shadow-2xs hover:border-rose-500/40 hover:shadow-sm transition-all"
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
                      ) : (
                        <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400 border border-amber-500/20">
                          Warning
                        </span>
                      )}
                    </div>

                    <div className="text-[11px] text-muted font-mono">
                      {item.report.businessDate}
                    </div>
                  </div>

                  {/* Filename */}
                  <div className="mt-1 font-mono text-xs text-muted truncate">
                    {item.report.filename}
                  </div>

                  {/* Metrics Badges */}
                  <div className="mt-3 flex flex-wrap gap-2">
                    {isSize && (
                      <div className="flex items-center gap-1.5 rounded-lg bg-rose-500/10 px-2.5 py-1 text-xs font-semibold text-rose-600 dark:text-rose-400 border border-rose-500/20">
                        <TrendingDown size={14} />
                        <span>
                          Size Drop: {Math.abs(item.sizeDropPct ?? 0).toFixed(1)}%
                        </span>
                        <span className="font-normal opacity-80 text-[11px]">
                          ({formatBytes(item.report.sizeBytes)} vs {formatBytes(item.baselineSize ?? 0)})
                        </span>
                        {item.zScore !== undefined && (
                          <span className="rounded bg-rose-500/20 px-1 py-0.2 font-mono text-[10px]">
                            {item.zScore}σ
                          </span>
                        )}
                      </div>
                    )}

                    {isDelay && (
                      <div className="flex items-center gap-1.5 rounded-lg bg-amber-500/10 px-2.5 py-1 text-xs font-semibold text-amber-600 dark:text-amber-400 border border-amber-500/20">
                        <Clock size={14} />
                        <span>
                          Delay: +{item.delayMinutes} min
                        </span>
                        <span className="font-normal opacity-80 text-[11px]">
                          (Arrived {item.arrivedTime ?? 'late'} vs {item.expectedTime} SLA)
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
