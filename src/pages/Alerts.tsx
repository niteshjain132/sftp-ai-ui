import { useState, useEffect, useMemo } from 'react'
import {
  Bell,
  AlertTriangle,
  AlertCircle,
  Info,
  CheckCircle2,
  Filter,
  CheckCheck,
  RefreshCw,
} from 'lucide-react'
import { api } from '../api/client'
import { ThemeToggle } from '../components/layout/ThemeToggle'
import { formatWhen } from '../lib/format'
import type { AlertItem, Severity } from '../types'

export function Alerts() {
  const [alerts, setAlerts] = useState<AlertItem[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<'all' | 'unacked' | 'acked'>('all')
  const [severityFilter, setSeverityFilter] = useState<'all' | Severity>('all')

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      try {
        const data = await api.alerts()
        if (!cancelled) setAlerts(data)
      } catch (err) {
        console.error('Failed to load alerts', err)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [])

  const handleRefresh = async () => {
    setLoading(true)
    try {
      const data = await api.alerts()
      setAlerts(data)
    } finally {
      setLoading(false)
    }
  }

  const handleToggleAck = async (alert: AlertItem) => {
    const nextAck = !alert.acked
    try {
      const updated = await api.ackAlert(alert.id, nextAck)
      setAlerts((prev) => prev.map((a) => (a.id === updated.id ? updated : a)))
    } catch (err) {
      console.error('Failed to toggle ack', err)
    }
  }

  const handleAckAll = async () => {
    const unacked = alerts.filter((a) => !a.acked)
    try {
      await Promise.all(unacked.map((a) => api.ackAlert(a.id, true)))
      setAlerts((prev) => prev.map((a) => ({ ...a, acked: true })))
    } catch (err) {
      console.error('Failed to ack all', err)
    }
  }

  const filteredAlerts = useMemo(() => {
    return alerts.filter((a) => {
      if (statusFilter === 'unacked' && a.acked) return false
      if (statusFilter === 'acked' && !a.acked) return false
      if (severityFilter !== 'all' && a.severity !== severityFilter) return false
      return true
    })
  }, [alerts, statusFilter, severityFilter])

  const unackedCount = alerts.filter((a) => !a.acked).length
  const critCount = alerts.filter((a) => a.severity === 'crit' && !a.acked).length

  const severityBadge = (sev: Severity) => {
    switch (sev) {
      case 'crit':
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/10 px-2.5 py-0.5 text-xs font-semibold text-rose-500 border border-rose-500/20">
            <AlertCircle size={12} className="animate-pulse" />
            Critical
          </span>
        )
      case 'warn':
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2.5 py-0.5 text-xs font-semibold text-amber-500 border border-amber-500/20">
            <AlertTriangle size={12} />
            Warning
          </span>
        )
      case 'info':
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-sky-500/10 px-2.5 py-0.5 text-xs font-semibold text-sky-500 border border-sky-500/20">
            <Info size={12} />
            Info
          </span>
        )
    }
  }

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-ink">Operations Alerts</h1>
          <p className="text-xs text-muted">
            Incident queue for SLA delays, missing arrival deadlines, and file size anomaly detections.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {unackedCount > 0 && (
            <button
              type="button"
              onClick={handleAckAll}
              className="flex items-center gap-1.5 rounded-full border border-border bg-card px-3.5 py-2 text-xs font-medium text-ink shadow-sm hover:border-accent hover:text-accent transition"
            >
              <CheckCheck size={14} className="text-accent" />
              Acknowledge All Unread
            </button>
          )}

          <button
            type="button"
            onClick={handleRefresh}
            title="Refresh alerts"
            className="flex h-9 w-9 items-center justify-center rounded-full border border-border bg-card text-muted hover:text-ink transition"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
          <ThemeToggle />
        </div>
      </div>

      {/* KPI summary strip */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-border bg-card p-4 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs text-muted">Total Alarms</span>
            <div className="text-2xl font-bold text-ink mt-1">{alerts.length}</div>
          </div>
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent-soft text-accent">
            <Bell size={18} />
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card p-4 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs text-muted">Unacknowledged</span>
            <div className="text-2xl font-bold text-amber-500 mt-1">{unackedCount}</div>
          </div>
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/10 text-amber-500">
            <AlertTriangle size={18} />
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card p-4 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs text-muted">Critical Incidents</span>
            <div className="text-2xl font-bold text-rose-500 mt-1">{critCount}</div>
          </div>
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-500/10 text-rose-500">
            <AlertCircle size={18} />
          </div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card p-3 shadow-sm text-xs">
        {/* Status filter */}
        <div className="flex items-center rounded-full border border-border bg-canvas p-1">
          {(['all', 'unacked', 'acked'] as const).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setStatusFilter(s)}
              className={`rounded-full px-3 py-1 font-medium capitalize transition ${
                statusFilter === s
                  ? 'bg-card text-ink shadow-sm'
                  : 'text-muted hover:text-ink'
              }`}
            >
              {s === 'unacked' ? 'Unacknowledged' : s}
            </button>
          ))}
        </div>

        {/* Severity filter */}
        <div className="flex items-center gap-1.5">
          <Filter size={14} className="text-muted" />
          <span className="text-muted">Severity:</span>
          <div className="flex items-center rounded-full border border-border bg-canvas p-1">
            {(['all', 'crit', 'warn', 'info'] as const).map((sev) => (
              <button
                key={sev}
                type="button"
                onClick={() => setSeverityFilter(sev)}
                className={`rounded-full px-2.5 py-0.5 uppercase text-[11px] font-medium transition ${
                  severityFilter === sev
                    ? 'bg-card text-ink shadow-sm'
                    : 'text-muted hover:text-ink'
                }`}
              >
                {sev}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Alert List */}
      <div className="space-y-3">
        {loading ? (
          <div className="py-12 text-center text-xs text-muted">Loading incident alerts...</div>
        ) : filteredAlerts.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border p-12 text-center text-xs text-muted">
            No incidents match your current filter settings. All systems operational.
          </div>
        ) : (
          filteredAlerts.map((alert) => (
            <div
              key={alert.id}
              className={`flex flex-col gap-3 rounded-2xl border p-4 shadow-sm transition sm:flex-row sm:items-center sm:justify-between ${
                alert.acked
                  ? 'border-border bg-card/60 opacity-75'
                  : 'border-border bg-card hover:border-accent/40'
              }`}
            >
              <div className="flex items-start gap-3">
                <div className="pt-0.5">{severityBadge(alert.severity)}</div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold text-ink">{alert.title}</h3>
                    {alert.acked && (
                      <span className="flex items-center gap-1 text-[10px] text-muted">
                        <CheckCircle2 size={11} className="text-emerald-500" /> Acked
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 text-xs text-muted">{alert.detail}</p>
                  <div className="mt-1.5 text-[11px] text-muted">
                    Triggered {formatWhen(alert.at)}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 self-end sm:self-center">
                <button
                  type="button"
                  onClick={() => handleToggleAck(alert)}
                  className={`flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${
                    alert.acked
                      ? 'border border-border bg-canvas text-muted hover:text-ink'
                      : 'bg-accent text-white hover:opacity-90 shadow-sm'
                  }`}
                >
                  {alert.acked ? (
                    'Mark Unread'
                  ) : (
                    <>
                      <CheckCircle2 size={13} />
                      Acknowledge
                    </>
                  )}
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
