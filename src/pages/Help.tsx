import {
  FileText,
  Clock,
  Zap,
  Bot,
  Terminal,
} from 'lucide-react'
import { ThemeToggle } from '../components/layout/ThemeToggle'

export function Help() {
  return (
    <div className="max-w-4xl space-y-8 pb-10">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-ink">Operations Guide & Reference</h1>
          <p className="text-xs text-muted">
            Complete guide to SFTP arrival SLAs, filename conventions, automated anomaly detection, and Copilot queries.
          </p>
        </div>
        <ThemeToggle />
      </div>

      {/* 1. File Naming Standard */}
      <div className="rounded-2xl border border-border bg-card p-6 shadow-sm space-y-4">
        <div className="flex items-center gap-2">
          <FileText size={18} className="text-accent" />
          <h2 className="text-base font-semibold text-ink">1. SFTP File Naming Standard</h2>
        </div>

        <p className="text-xs text-muted leading-relaxed">
          All automated file ingest pipelines strictly conform to the 4-part dot-delimited filename format:
        </p>

        <div className="rounded-xl border border-border bg-canvas p-4 font-mono text-xs text-ink">
          <span className="text-accent font-bold">&lt;REPORT_CODE&gt;</span>.
          <span className="text-sky-500 font-bold">&lt;CADENCE&gt;</span>.
          <span className="text-emerald-500 font-bold">&lt;YYYYMMDD&gt;</span>.
          <span className="text-purple-500 font-bold">&lt;EXTENSION&gt;</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-border bg-canvas/40 text-muted uppercase text-[10px]">
              <tr>
                <th className="py-2.5 px-3">Segment</th>
                <th className="py-2.5 px-3">Description</th>
                <th className="py-2.5 px-3">Example</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border text-ink">
              <tr>
                <td className="py-2.5 px-3 font-mono font-semibold text-accent">REPORT_CODE</td>
                <td className="py-2.5 px-3 text-muted">Unique alphanumeric report or job identifier</td>
                <td className="py-2.5 px-3 font-mono">CST610C, POS591, MMR</td>
              </tr>
              <tr>
                <td className="py-2.5 px-3 font-mono font-semibold text-sky-500">CADENCE</td>
                <td className="py-2.5 px-3 text-muted">Delivery schedule category defining expected SLA cutoff</td>
                <td className="py-2.5 px-3 font-mono">EOD, ITD, HTML</td>
              </tr>
              <tr>
                <td className="py-2.5 px-3 font-mono font-semibold text-emerald-500">YYYYMMDD</td>
                <td className="py-2.5 px-3 text-muted">8-digit ISO calendar business date of the data payload</td>
                <td className="py-2.5 px-3 font-mono">20260810</td>
              </tr>
              <tr>
                <td className="py-2.5 px-3 font-mono font-semibold text-purple-500">EXTENSION</td>
                <td className="py-2.5 px-3 text-muted">Standard file format extension</td>
                <td className="py-2.5 px-3 font-mono">csv, txt, html, dat, log</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* 2. SLAs & Cadences */}
      <div className="rounded-2xl border border-border bg-card p-6 shadow-sm space-y-4">
        <div className="flex items-center gap-2">
          <Clock size={18} className="text-accent" />
          <h2 className="text-base font-semibold text-ink">2. SLA Windows & Delivery Schedules</h2>
        </div>

        <p className="text-xs text-muted leading-relaxed">
          The ingestion monitor compares file timestamps against predetermined daily SLAs:
        </p>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="rounded-xl border border-border bg-canvas/60 p-4">
            <span className="rounded bg-accent-soft px-2 py-0.5 text-[10px] font-bold text-accent">
              EOD
            </span>
            <div className="text-lg font-bold text-ink mt-2">18:00 Cutoff</div>
            <p className="text-[11px] text-muted mt-1">
              End-of-day reconciliation, risk, and general ledger reports (e.g. CST610C, RISK88).
            </p>
          </div>

          <div className="rounded-xl border border-border bg-canvas/60 p-4">
            <span className="rounded bg-sky-500/10 px-2 py-0.5 text-[10px] font-bold text-sky-500">
              ITD
            </span>
            <div className="text-lg font-bold text-ink mt-2">16:30 Cutoff</div>
            <p className="text-[11px] text-muted mt-1">
              Intraday position snapshots and trade activity dumps (e.g. POS591, INV220).
            </p>
          </div>

          <div className="rounded-xl border border-border bg-canvas/60 p-4">
            <span className="rounded bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-500">
              HTML
            </span>
            <div className="text-lg font-bold text-ink mt-2">12:00 Cutoff</div>
            <p className="text-[11px] text-muted mt-1">
              Midday executive summary dashboards and web packs (e.g. MMR.html).
            </p>
          </div>
        </div>
      </div>

      {/* 3. Anomaly Detection Engine */}
      <div className="rounded-2xl border border-border bg-card p-6 shadow-sm space-y-4">
        <div className="flex items-center gap-2">
          <Zap size={18} className="text-accent" />
          <h2 className="text-base font-semibold text-ink">3. Statistical Anomaly Detection</h2>
        </div>

        <p className="text-xs text-muted leading-relaxed">
          Beyond delivery times, the system inspects payload sizes against a rolling 7-day Gaussian model:
        </p>

        <div className="rounded-xl border border-border bg-canvas p-4 space-y-2 text-xs text-ink">
          <div className="font-semibold text-ink">Z-Score Calculation:</div>
          <div className="font-mono text-muted">
            z = (sizeBytes - mean7d) / standardDeviation
          </div>
          <p className="text-[11px] text-muted pt-1">
            Any delivery with <span className="font-mono text-rose-500 font-semibold">|z| &gt;= 2.0σ</span> is marked as a volume anomaly. Missing streaks count consecutive business days without an arrival.
          </p>
        </div>
      </div>

      {/* 4. Copilot Queries */}
      <div className="rounded-2xl border border-border bg-card p-6 shadow-sm space-y-4">
        <div className="flex items-center gap-2">
          <Bot size={18} className="text-accent" />
          <h2 className="text-base font-semibold text-ink">4. SFTP Ops Copilot Prompts</h2>
        </div>

        <p className="text-xs text-muted leading-relaxed">
          The built-in AI copilot analyzes telemetry in real time. Try asking:
        </p>

        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
          {[
            'Which files arrived late today?',
            'Check size anomalies (>2σ) across all reports',
            'Show CST610C SLA delay history for this week',
            'Are any EOD files pending past 18:00?',
          ].map((prompt, i) => (
            <div
              key={i}
              className="flex items-center gap-2 rounded-xl border border-border bg-canvas/40 px-3.5 py-2.5 text-xs text-ink"
            >
              <Terminal size={14} className="text-accent shrink-0" />
              <span className="font-medium">"{prompt}"</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
