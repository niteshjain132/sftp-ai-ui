import { useState, useRef, useEffect } from 'react'
import {
  Send,
  X,
  Sparkles,
  RotateCcw,
  Loader2,
  FileSearch,
} from 'lucide-react'
import { BlinkingBot } from './BlinkingBot'
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts'
import { api } from '../../api/client'
import type { ChatChart } from '../../types'

type Props = {
  open: boolean
  onToggle: () => void
}

type MessageItem = {
  id: string
  role: 'user' | 'assistant'
  content: string
  charts?: ChatChart[]
  timestamp: string
}

const QUICK_PROMPTS = [
  'Which files arrived late today?',
  'Check size anomalies (>2σ)',
  'Show arrival trends this week',
  'Is CST610C on schedule?',
]

let messageCounter = 0
function nextId(prefix: string) {
  messageCounter += 1
  return `${prefix}-${messageCounter}`
}

function getNowTime() {
  return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

const INITIAL_MESSAGES: MessageItem[] = [
  {
    id: 'welcome',
    role: 'assistant',
    content:
      'Hello! I am your SFTP Ops Copilot. I monitor incoming file arrivals, detect size anomalies, and forecast SLA violations. Ask me anything or pick a quick prompt below.',
    timestamp: 'Just now',
  },
]

export function AiDock({ open, onToggle }: Props) {
  const [messages, setMessages] = useState<MessageItem[]>(INITIAL_MESSAGES)
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [reportContext, setReportContext] = useState<string>('')
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    if (open) {
      scrollToBottom()
    }
  }, [messages, open])

  const handleSend = async (queryText?: string) => {
    const text = (queryText ?? input).trim()
    if (!text || loading) return

    const userMsg: MessageItem = {
      id: nextId('user'),
      role: 'user',
      content: text,
      timestamp: getNowTime(),
    }

    const nextMessages = [...messages, userMsg]
    setMessages(nextMessages)
    setInput('')
    setLoading(true)

    try {
      const payloadMessages = nextMessages.map((m) => ({
        role: m.role,
        content: m.content,
      }))
      const res = await api.chat(payloadMessages, reportContext || undefined)

      const botMsg: MessageItem = {
        id: nextId('bot'),
        role: 'assistant',
        content: res.reply || 'No response returned.',
        charts: res.charts,
        timestamp: getNowTime(),
      }
      setMessages((prev) => [...prev, botMsg])
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: nextId('err'),
          role: 'assistant',
          content: 'Unable to reach ops copilot server. Please ensure the backend is active.',
          timestamp: getNowTime(),
        },
      ])
    } finally {
      setLoading(false)
    }
  }

  const handleSendRef = useRef(handleSend)
  useEffect(() => {
    handleSendRef.current = handleSend
  })

  useEffect(() => {
    const handleAskCopilot = (e: Event) => {
      const customEvent = e as CustomEvent<{ prompt: string; reportContext?: string }>
      if (!open) {
        onToggle()
      }
      if (customEvent.detail?.reportContext) {
        setReportContext(customEvent.detail.reportContext)
      }
      if (customEvent.detail?.prompt) {
        void handleSendRef.current(customEvent.detail.prompt)
      }
    }

    window.addEventListener('sftp:ask-copilot', handleAskCopilot)
    return () => {
      window.removeEventListener('sftp:ask-copilot', handleAskCopilot)
    }
  }, [open, onToggle])

  const handleReset = () => {
    setMessages([
      {
        id: 'welcome',
        role: 'assistant',
        content: 'Copilot session refreshed. How can I assist with SFTP arrivals today?',
        timestamp: getNowTime(),
      },
    ])
    setReportContext('')
  }

  if (!open) {
    return (
      <div className="flex h-full items-center justify-center border-l border-border bg-card/40 px-2 py-4 shadow-xs transition-all">
        <button
          onClick={onToggle}
          type="button"
          title="Open SFTP AI Copilot"
          className="group relative flex h-20 w-11 flex-col items-center justify-center gap-1.5 rounded-2xl border border-border bg-card shadow-md transition-all duration-200 hover:scale-105 hover:border-accent hover:shadow-accent/20"
        >
          <div className="flex h-7 w-7 items-center justify-center rounded-xl bg-accent/10 text-accent transition-colors group-hover:bg-accent group-hover:text-white">
            <BlinkingBot size={17} glow={false} />
          </div>
          <span className="text-[10px] font-bold tracking-wider text-muted group-hover:text-accent">
            AI
          </span>
          <div className="absolute -left-1 top-1/2 -translate-y-1/2 h-4 w-1 rounded-r-full bg-accent opacity-0 group-hover:opacity-100 transition-opacity" />
        </button>
      </div>
    )
  }

  return (
    <aside className="flex h-full w-[380px] shrink-0 flex-col border-l border-border bg-card transition-all overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-4 py-3.5">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl border border-accent/30 bg-accent/15 text-accent shadow-xs">
            <BlinkingBot size={20} glow={true} />
          </div>
          <div>
            <div className="flex items-center gap-1.5 text-sm font-semibold text-ink">
              SFTP Copilot
              <span className="inline-flex h-2 w-2 rounded-full bg-emerald-500 animate-ping" />
            </div>
            <p className="text-[11px] text-muted">Intelligent file ops & anomaly assistant</p>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={handleReset}
            title="Reset conversation"
            className="rounded-lg p-1.5 text-muted hover:bg-canvas hover:text-ink transition"
          >
            <RotateCcw size={15} />
          </button>
          <button
            type="button"
            onClick={onToggle}
            title="Close dock"
            className="rounded-lg p-1.5 text-muted hover:bg-canvas hover:text-ink transition"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {/* Active context badge if any */}
      {reportContext && (
        <div className="flex items-center justify-between border-b border-border bg-accent-soft/40 px-4 py-1.5 text-xs text-ink">
          <span className="flex items-center gap-1">
            <FileSearch size={13} className="text-accent" />
            Filtering on report: <strong className="font-mono">{reportContext}</strong>
          </span>
          <button
            type="button"
            onClick={() => setReportContext('')}
            className="text-[11px] text-muted hover:text-ink underline"
          >
            clear
          </button>
        </div>
      )}

      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
          >
            <div className="flex items-center gap-1.5 text-[11px] text-muted mb-1 px-1">
              {msg.role === 'assistant' ? (
                <div className="flex items-center gap-1 text-accent font-medium">
                  <BlinkingBot size={13} glow={false} />
                  <span>Ops Copilot</span>
                </div>
              ) : (
                <span>You</span>
              )}
              <span>•</span>
              <span>{msg.timestamp}</span>
            </div>

            <div className={`flex items-start gap-2 max-w-[95%] ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              {msg.role === 'assistant' && (
                <div className="flex h-7 w-7 items-center justify-center rounded-xl border border-accent/30 bg-accent/10 text-accent shadow-xs shrink-0 mt-0.5">
                  <BlinkingBot size={18} glow={true} />
                </div>
              )}

              <div
                className={`flex-1 rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
                  msg.role === 'user'
                    ? 'bg-accent text-white rounded-tr-sm'
                    : 'border border-border bg-canvas text-ink rounded-tl-sm shadow-sm'
                }`}
              >
                <p className="whitespace-pre-wrap">{msg.content}</p>

                {/* Render charts attached to assistant reply */}
                {msg.charts && msg.charts.length > 0 && (
                  <div className="mt-3 space-y-3 pt-2 border-t border-border/50">
                    {msg.charts.map((chart, idx) => (
                      <div
                        key={idx}
                        className="rounded-xl border border-border bg-card p-2.5 shadow-sm"
                      >
                        <div className="mb-2 text-xs font-semibold text-ink">{chart.title}</div>
                        <div className="h-36 w-full">
                          <ResponsiveContainer width="100%" height="100%">
                            {chart.type === 'bar' ? (
                              <BarChart data={chart.series[0]?.points ?? []}>
                                <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                                <XAxis dataKey="x" tick={{ fontSize: 10 }} />
                                <YAxis tick={{ fontSize: 10 }} />
                                <Tooltip
                                  contentStyle={{
                                    backgroundColor: 'var(--card)',
                                    borderColor: 'var(--border)',
                                    borderRadius: 8,
                                    fontSize: 11,
                                  }}
                                />
                                <Bar dataKey="y" fill="var(--accent)" radius={[4, 4, 0, 0]} />
                              </BarChart>
                            ) : (
                              <LineChart data={chart.series[0]?.points ?? []}>
                                <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                                <XAxis dataKey="x" tick={{ fontSize: 10 }} />
                                <YAxis tick={{ fontSize: 10 }} />
                                <Tooltip
                                  contentStyle={{
                                    backgroundColor: 'var(--card)',
                                    borderColor: 'var(--border)',
                                    borderRadius: 8,
                                    fontSize: 11,
                                  }}
                                />
                                <Line
                                  type="monotone"
                                  dataKey="y"
                                  stroke="var(--accent)"
                                  strokeWidth={2}
                                  dot={{ r: 3 }}
                                />
                              </LineChart>
                            )}
                          </ResponsiveContainer>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex items-start gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-xl border border-accent/30 bg-accent/10 text-accent shadow-xs shrink-0 mt-0.5">
              <BlinkingBot size={18} glow={true} />
            </div>
            <div className="flex items-center gap-2 rounded-2xl border border-border bg-canvas px-3.5 py-2.5 text-xs text-muted shadow-sm">
              <Loader2 size={14} className="animate-spin text-accent" />
              <span>Analyzing telemetry and generating response...</span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Quick Prompts */}
      <div className="border-t border-border bg-canvas/50 px-3 py-2">
        <div className="mb-1.5 flex items-center gap-1 text-[11px] font-medium text-muted">
          <Sparkles size={12} className="text-accent" /> Suggested queries
        </div>
        <div className="flex flex-wrap gap-1.5">
          {QUICK_PROMPTS.map((prompt) => (
            <button
              key={prompt}
              type="button"
              disabled={loading}
              onClick={() => handleSend(prompt)}
              className="rounded-full border border-border bg-card px-2.5 py-1 text-[11px] text-muted hover:border-accent hover:text-ink transition disabled:opacity-50"
            >
              {prompt}
            </button>
          ))}
        </div>
      </div>

      {/* Input box */}
      <form
        onSubmit={(e) => {
          e.preventDefault()
          handleSend()
        }}
        className="border-t border-border p-3"
      >
        <div className="flex items-center gap-2 rounded-full border border-border bg-canvas px-3 py-1.5 focus-within:border-accent focus-within:ring-1 focus-within:ring-accent">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about late files, size anomalies..."
            className="flex-1 bg-transparent text-xs text-ink placeholder:text-muted outline-none"
            disabled={loading}
          />
          <button
            type="submit"
            disabled={!input.trim() || loading}
            aria-label="Send message"
            className="flex h-7 w-7 items-center justify-center rounded-full bg-accent text-white disabled:opacity-40 transition hover:opacity-90"
          >
            {loading ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
          </button>
        </div>
      </form>
    </aside>
  )
}
