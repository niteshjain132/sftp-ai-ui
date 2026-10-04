import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import type { Plugin } from 'vite'
import { defineConfig, loadEnv } from 'vite'
import { mockChatReply, readJsonBody } from './server/chat.ts'

function vertexChatPlugin(env: Record<string, string>): Plugin {
  return {
    name: 'vertex-chat',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (req.url?.split('?')[0] !== '/api/ai/chat' || req.method !== 'POST') {
          next()
          return
        }
        const body = await readJsonBody(req)
        const key = env.VERTEX_API_KEY
        const project = env.VERTEX_PROJECT
        const location = env.VERTEX_LOCATION || 'us-central1'
        const model = env.VERTEX_MODEL || 'gemini-2.0-flash'

        if (!key) {
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify(mockChatReply(body)))
          return
        }

        const system =
          'You are an SFTP ops analyst. Be concise. When useful, append a fenced json block with key charts: [{ type: "line"|"bar", title, series: [{ name, points: [{ x, y }] }] }].'
        const userText = (body.messages ?? [])
          .map((m) => `${m.role}: ${m.content}`)
          .join('\n')
        const url = project
          ? `https://${location}-aiplatform.googleapis.com/v1/projects/${project}/locations/${location}/publishers/google/models/${model}:generateContent?key=${encodeURIComponent(key)}`
          : `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(key)}`

        try {
          const vertexRes = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              systemInstruction: { parts: [{ text: system }] },
              contents: [{ role: 'user', parts: [{ text: userText || 'Summarize SFTP arrivals.' }] }],
            }),
          })
          const data = (await vertexRes.json()) as {
            candidates?: { content?: { parts?: { text?: string }[] } }[]
            error?: { message?: string }
          }
          if (!vertexRes.ok) {
            res.statusCode = 502
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ reply: data.error?.message || 'Vertex request failed', charts: [] }))
            return
          }
          const text = data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('\n') ?? ''
          const fence = text.match(/```json\s*([\s\S]*?)```/)
          let charts
          let reply = text
          if (fence) {
            try {
              const parsed = JSON.parse(fence[1]) as { charts?: unknown }
              charts = Array.isArray(parsed.charts) ? parsed.charts : parsed
            } catch {
              charts = undefined
            }
            reply = text.replace(fence[0], '').trim()
          }
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ reply, charts }))
        } catch (err) {
          res.statusCode = 500
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ reply: err instanceof Error ? err.message : 'chat failed' }))
        }
      })
    },
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  return {
    plugins: [react(), tailwindcss(), vertexChatPlugin(env)],
  }
})
