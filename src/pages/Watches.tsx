import { useState, useEffect } from 'react'
import {
  Plus,
  Trash2,
  Clock,
  Mail,
  MessageSquare,
  CheckCircle2,
  XCircle,
  X,
  Sparkles,
} from 'lucide-react'
import { api } from '../api/client'
import { ThemeToggle } from '../components/layout/ThemeToggle'
import type { Channel, Trigger, Watch } from '../types'

export function Watches() {
  const [watches, setWatches] = useState<Watch[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)

  // New watch form state
  const [name, setName] = useState('')
  const [pattern, setPattern] = useState('')
  const [channel, setChannel] = useState<Channel>('slack')
  const [triggers, setTriggers] = useState<Trigger[]>(['late', 'missing'])
  const [hasQuietHours, setHasQuietHours] = useState(false)
  const [quietStart, setQuietStart] = useState('22:00')
  const [quietEnd, setQuietEnd] = useState('07:00')
  const [submitting, setSubmitting] = useState(false)

  // Sandbox pattern tester
  const [testFilename, setTestFilename] = useState('CST610C.EOD.20260810.csv')

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      try {
        const data = await api.watches()
        if (!cancelled) setWatches(data)
      } catch (err) {
        console.error('Failed to load watches', err)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [])

  const handleCreateWatch = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim() || !pattern.trim() || submitting) return
    setSubmitting(true)
    try {
      const newWatch = await api.createWatch({
        name: name.trim(),
        pattern: pattern.trim(),
        channel,
        triggers,
        quietHours: hasQuietHours ? { start: quietStart, end: quietEnd } : null,
      })
      setWatches((prev) => [newWatch, ...prev])
      setShowModal(false)
      setName('')
      setPattern('')
    } catch (err) {
      console.error('Failed to create watch', err)
    } finally {
      setSubmitting(false)
    }
  }

  const handleDeleteWatch = async (id: string) => {
    try {
      await api.deleteWatch(id)
      setWatches((prev) => prev.filter((w) => w.id !== id))
    } catch (err) {
      console.error('Failed to delete watch', err)
    }
  }

  const toggleTrigger = (t: Trigger) => {
    setTriggers((prev) =>
      prev.includes(t) ? prev.filter((item) => item !== t) : [...prev, t]
    )
  }

  const getChannelIcon = (ch: Channel) => {
    switch (ch) {
      case 'email':
        return <Mail size={13} className="text-sky-500" />
      case 'slack':
        return <MessageSquare size={13} className="text-emerald-500" />
      case 'teams':
        return <MessageSquare size={13} className="text-purple-500" />
    }
  }

  // Evaluate which active watches match test filename
  const matchingWatches = watches.filter((w) => {
    try {
      return new RegExp(w.pattern, 'i').test(testFilename)
    } catch {
      return false
    }
  })

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-ink">File Watch Rules</h1>
          <p className="text-xs text-muted">
            Configure automated monitors that notify your team when expected files are late, missing, or abnormal.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowModal(true)}
            className="flex items-center gap-1.5 rounded-full bg-accent px-4 py-2 text-xs font-semibold text-white shadow-sm hover:opacity-90 transition"
          >
            <Plus size={15} />
            Create Watch Rule
          </button>
          <ThemeToggle />
        </div>
      </div>

      {/* Interactive Pattern Sandbox */}
      <div className="rounded-2xl border border-border bg-card p-5 shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles size={16} className="text-accent" />
            <h2 className="text-sm font-semibold text-ink">Live Regex Evaluator & Sandbox</h2>
          </div>
          <span className="text-[11px] text-muted">Tests your input against active rules</span>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <input
            type="text"
            value={testFilename}
            onChange={(e) => setTestFilename(e.target.value)}
            placeholder="Type sample filename like CST610C.EOD.20260810.csv..."
            className="flex-1 rounded-full border border-border bg-canvas px-4 py-2 text-xs font-mono text-ink outline-none focus:border-accent"
          />
          <div className="flex items-center gap-2 text-xs">
            <span className="text-muted">Matched Rules:</span>
            <span className="font-semibold text-accent">{matchingWatches.length}</span>
          </div>
        </div>

        {matchingWatches.length > 0 ? (
          <div className="flex flex-wrap gap-2 pt-1">
            {matchingWatches.map((w) => (
              <span
                key={w.id}
                className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
              >
                <CheckCircle2 size={12} />
                {w.name}
              </span>
            ))}
          </div>
        ) : (
          <div className="text-[11px] text-muted flex items-center gap-1">
            <XCircle size={12} className="text-rose-400" />
            No active watch rules trigger on this filename pattern.
          </div>
        )}
      </div>

      {/* Watches Grid */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-ink">Active Watches ({watches.length})</h2>
        </div>

        {loading ? (
          <div className="py-12 text-center text-xs text-muted">Loading watch configurations...</div>
        ) : watches.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border p-8 text-center text-xs text-muted">
            No watch rules configured yet. Click "Create Watch Rule" to get started.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {watches.map((w) => (
              <div
                key={w.id}
                className="flex flex-col justify-between rounded-2xl border border-border bg-card p-5 shadow-sm hover:border-accent/40 transition"
              >
                <div>
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="text-sm font-bold text-ink">{w.name}</h3>
                      <div className="mt-1 inline-block rounded bg-canvas border border-border px-2 py-0.5 font-mono text-[11px] text-accent">
                        {w.pattern}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleDeleteWatch(w.id)}
                      title="Delete watch"
                      className="rounded-lg p-1 text-muted hover:text-rose-500 hover:bg-canvas transition"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>

                  {/* Badges / Triggers */}
                  <div className="mt-4 flex flex-wrap gap-1.5">
                    {w.triggers.map((trig) => (
                      <span
                        key={trig}
                        className="rounded-full bg-accent-soft px-2 py-0.5 text-[10px] font-medium text-ink capitalize"
                      >
                        {trig}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="mt-5 border-t border-border pt-3 flex items-center justify-between text-xs text-muted">
                  <span className="flex items-center gap-1 font-medium capitalize">
                    {getChannelIcon(w.channel)}
                    {w.channel}
                  </span>

                  {w.quietHours ? (
                    <span className="flex items-center gap-1 text-[11px]">
                      <Clock size={12} />
                      Quiet {w.quietHours.start}–{w.quietHours.end}
                    </span>
                  ) : (
                    <span className="text-[11px] text-muted">24/7 Alerts</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create Watch Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
          <form
            onSubmit={handleCreateWatch}
            className="w-full max-w-lg rounded-3xl border border-border bg-card p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-ink">New File Watch Rule</h3>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="rounded-full p-1.5 text-muted hover:bg-canvas hover:text-ink transition"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-ink mb-1">Rule Name</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. End of Day Core Book"
                  className="w-full rounded-xl border border-border bg-canvas px-3 py-2 text-ink outline-none focus:border-accent"
                />
              </div>

              <div>
                <label className="block font-semibold text-ink mb-1">
                  Filename Regex Pattern
                </label>
                <input
                  type="text"
                  required
                  value={pattern}
                  onChange={(e) => setPattern(e.target.value)}
                  placeholder="e.g. CST610C|GLD440 or ^POS591"
                  className="w-full rounded-xl border border-border bg-canvas px-3 py-2 font-mono text-ink outline-none focus:border-accent"
                />
              </div>

              <div>
                <label className="block font-semibold text-ink mb-1">Notification Channel</label>
                <div className="grid grid-cols-3 gap-2">
                  {(['slack', 'teams', 'email'] as Channel[]).map((ch) => (
                    <button
                      key={ch}
                      type="button"
                      onClick={() => setChannel(ch)}
                      className={`flex items-center justify-center gap-1.5 rounded-xl border py-2 capitalize font-medium transition ${
                        channel === ch
                          ? 'border-accent bg-accent-soft text-ink'
                          : 'border-border bg-canvas text-muted hover:text-ink'
                      }`}
                    >
                      {getChannelIcon(ch)}
                      {ch}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block font-semibold text-ink mb-1">Trigger Conditions</label>
                <div className="flex gap-2">
                  {(['late', 'missing', 'size'] as Trigger[]).map((trig) => (
                    <button
                      key={trig}
                      type="button"
                      onClick={() => toggleTrigger(trig)}
                      className={`rounded-xl border px-3 py-1.5 capitalize font-medium transition ${
                        triggers.includes(trig)
                          ? 'border-accent bg-accent text-white'
                          : 'border-border bg-canvas text-muted hover:text-ink'
                      }`}
                    >
                      {trig}
                    </button>
                  ))}
                </div>
              </div>

              <div className="pt-2 border-t border-border">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={hasQuietHours}
                    onChange={(e) => setHasQuietHours(e.target.checked)}
                    className="rounded text-accent"
                  />
                  <span className="font-semibold text-ink">Enable Quiet Hours</span>
                </label>

                {hasQuietHours && (
                  <div className="mt-2 grid grid-cols-2 gap-3">
                    <div>
                      <span className="text-muted text-[11px]">Start Time</span>
                      <input
                        type="time"
                        value={quietStart}
                        onChange={(e) => setQuietStart(e.target.value)}
                        className="mt-0.5 w-full rounded-xl border border-border bg-canvas px-3 py-1.5 text-ink outline-none"
                      />
                    </div>
                    <div>
                      <span className="text-muted text-[11px]">End Time</span>
                      <input
                        type="time"
                        value={quietEnd}
                        onChange={(e) => setQuietEnd(e.target.value)}
                        className="mt-0.5 w-full rounded-xl border border-border bg-canvas px-3 py-1.5 text-ink outline-none"
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3">
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="rounded-full border border-border px-4 py-2 text-xs font-semibold text-muted hover:text-ink transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="rounded-full bg-accent px-5 py-2 text-xs font-semibold text-white shadow-sm hover:opacity-95 disabled:opacity-50"
              >
                Save Watch
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
