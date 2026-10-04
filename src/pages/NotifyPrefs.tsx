import { useState, useEffect } from 'react'
import {
  Mail,
  MessageSquare,
  Clock,
  Save,
  CheckCircle2,
  BellRing,
  VolumeX,
} from 'lucide-react'
import { api } from '../api/client'
import { ThemeToggle } from '../components/layout/ThemeToggle'
import type { Digest, NotifyPrefs } from '../types'

export function NotifyPrefsPage() {
  const [prefs, setPrefs] = useState<NotifyPrefs | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [savedSuccess, setSavedSuccess] = useState(false)

  useEffect(() => {
    async function load() {
      try {
        const data = await api.prefs()
        setPrefs(data)
      } catch (err) {
        console.error('Failed to load notify prefs', err)
      } finally {
        setLoading(false)
      }
    }
    void load()
  }, [])

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!prefs || saving) return
    setSaving(true)
    setSavedSuccess(false)
    try {
      const updated = await api.savePrefs(prefs)
      setPrefs(updated)
      setSavedSuccess(true)
      setTimeout(() => setSavedSuccess(false), 3000)
    } catch (err) {
      console.error('Failed to save notify prefs', err)
    } finally {
      setSaving(false)
    }
  }

  if (loading || !prefs) {
    return (
      <div className="py-12 text-center text-xs text-muted">
        Loading notification settings...
      </div>
    )
  }

  return (
    <div className="max-w-3xl space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-ink">Notification Preferences</h1>
          <p className="text-xs text-muted">
            Manage how and when your operations team receives arrival SLA breach notices and size anomaly reports.
          </p>
        </div>
        <ThemeToggle />
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        {/* Dispatch Channels */}
        <div className="rounded-2xl border border-border bg-card p-5 shadow-sm space-y-4">
          <div className="flex items-center gap-2">
            <BellRing size={18} className="text-accent" />
            <h2 className="text-sm font-semibold text-ink">Alert Channels</h2>
          </div>

          <div className="divide-y divide-border/60">
            {/* Email Channel */}
            <div className="flex items-center justify-between py-3">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-sky-500/10 text-sky-500">
                  <Mail size={16} />
                </div>
                <div>
                  <div className="text-xs font-semibold text-ink">Email Notifications</div>
                  <div className="text-[11px] text-muted">Dispatch alerts to ops@sftp.ai and incident responders</div>
                </div>
              </div>
              <label className="relative inline-flex cursor-pointer items-center">
                <input
                  type="checkbox"
                  checked={prefs.channels.email}
                  onChange={(e) =>
                    setPrefs({
                      ...prefs,
                      channels: { ...prefs.channels, email: e.target.checked },
                    })
                  }
                  className="sr-only peer"
                />
                <div className="h-6 w-11 rounded-full bg-border peer-checked:bg-accent after:absolute after:top-[2px] after:left-[2px] after:h-5 after:w-5 after:rounded-full after:bg-white after:transition-all peer-checked:after:translate-x-full" />
              </label>
            </div>

            {/* Slack Channel */}
            <div className="flex items-center justify-between py-3">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-500">
                  <MessageSquare size={16} />
                </div>
                <div>
                  <div className="text-xs font-semibold text-ink">Slack Integration</div>
                  <div className="text-[11px] text-muted">Post messages into #sftp-arrivals channel webhook</div>
                </div>
              </div>
              <label className="relative inline-flex cursor-pointer items-center">
                <input
                  type="checkbox"
                  checked={prefs.channels.slack}
                  onChange={(e) =>
                    setPrefs({
                      ...prefs,
                      channels: { ...prefs.channels, slack: e.target.checked },
                    })
                  }
                  className="sr-only peer"
                />
                <div className="h-6 w-11 rounded-full bg-border peer-checked:bg-accent after:absolute after:top-[2px] after:left-[2px] after:h-5 after:w-5 after:rounded-full after:bg-white after:transition-all peer-checked:after:translate-x-full" />
              </label>
            </div>

            {/* Teams Channel */}
            <div className="flex items-center justify-between py-3">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-purple-500/10 text-purple-500">
                  <MessageSquare size={16} />
                </div>
                <div>
                  <div className="text-xs font-semibold text-ink">Microsoft Teams</div>
                  <div className="text-[11px] text-muted">Send Adaptive Cards to the Cloud Ops channel</div>
                </div>
              </div>
              <label className="relative inline-flex cursor-pointer items-center">
                <input
                  type="checkbox"
                  checked={prefs.channels.teams}
                  onChange={(e) =>
                    setPrefs({
                      ...prefs,
                      channels: { ...prefs.channels, teams: e.target.checked },
                    })
                  }
                  className="sr-only peer"
                />
                <div className="h-6 w-11 rounded-full bg-border peer-checked:bg-accent after:absolute after:top-[2px] after:left-[2px] after:h-5 after:w-5 after:rounded-full after:bg-white after:transition-all peer-checked:after:translate-x-full" />
              </label>
            </div>
          </div>
        </div>

        {/* Digest Delivery Frequency */}
        <div className="rounded-2xl border border-border bg-card p-5 shadow-sm space-y-4">
          <div className="flex items-center gap-2">
            <Clock size={18} className="text-accent" />
            <h2 className="text-sm font-semibold text-ink">Digest Frequency</h2>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {[
              {
                id: 'realtime' as Digest,
                title: 'Real-Time',
                desc: 'Immediate dispatch for each detected SLA violation or size anomaly',
              },
              {
                id: 'hourly' as Digest,
                title: 'Hourly Digest',
                desc: 'Batched hourly rollup of new alerts and delayed transfers',
              },
              {
                id: 'daily' as Digest,
                title: 'Daily Summary',
                desc: 'Single morning report summarizing 24h health and SLA compliance',
              },
            ].map((option) => (
              <label
                key={option.id}
                onClick={() => setPrefs({ ...prefs, digest: option.id })}
                className={`flex flex-col justify-between rounded-xl border p-4 cursor-pointer transition ${
                  prefs.digest === option.id
                    ? 'border-accent bg-accent-soft/40 shadow-xs'
                    : 'border-border bg-canvas/40 hover:border-accent/40'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-ink">{option.title}</span>
                    <input
                      type="radio"
                      name="digest"
                      checked={prefs.digest === option.id}
                      onChange={() => setPrefs({ ...prefs, digest: option.id })}
                      className="text-accent"
                    />
                  </div>
                  <p className="mt-1 text-[11px] text-muted leading-relaxed">{option.desc}</p>
                </div>
              </label>
            ))}
          </div>
        </div>

        {/* Quiet Hours Window */}
        <div className="rounded-2xl border border-border bg-card p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <VolumeX size={18} className="text-accent" />
              <div>
                <h2 className="text-sm font-semibold text-ink">Quiet Hours</h2>
                <p className="text-[11px] text-muted">
                  Suppress non-critical notifications outside operational business hours
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-medium text-muted mb-1">
                Quiet Window Starts
              </label>
              <input
                type="time"
                value={prefs.quietHours.start}
                onChange={(e) =>
                  setPrefs({
                    ...prefs,
                    quietHours: { ...prefs.quietHours, start: e.target.value },
                  })
                }
                className="w-full rounded-xl border border-border bg-canvas px-3.5 py-2 text-xs font-mono text-ink outline-none focus:border-accent"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-muted mb-1">
                Quiet Window Ends
              </label>
              <input
                type="time"
                value={prefs.quietHours.end}
                onChange={(e) =>
                  setPrefs({
                    ...prefs,
                    quietHours: { ...prefs.quietHours, end: e.target.value },
                  })
                }
                className="w-full rounded-xl border border-border bg-canvas px-3.5 py-2 text-xs font-mono text-ink outline-none focus:border-accent"
              />
            </div>
          </div>
        </div>

        {/* Save Bar */}
        <div className="flex items-center justify-between pt-2">
          {savedSuccess && (
            <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 size={16} />
              Preferences successfully updated!
            </div>
          )}
          {!savedSuccess && <div />}

          <button
            type="submit"
            disabled={saving}
            className="flex items-center gap-2 rounded-full bg-accent px-6 py-2.5 text-xs font-semibold text-white shadow-sm hover:opacity-90 transition disabled:opacity-50"
          >
            <Save size={14} />
            {saving ? 'Saving...' : 'Save Preferences'}
          </button>
        </div>
      </form>
    </div>
  )
}

export { NotifyPrefsPage as NotifyPrefs }
