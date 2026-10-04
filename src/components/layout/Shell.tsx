import { Outlet } from 'react-router-dom'
import { useState } from 'react'
import { AiDock } from './AiDock'
import { Sidebar } from './Sidebar'

export function Shell() {
  const [aiOpen, setAiOpen] = useState(true)

  return (
    <div className="flex h-screen overflow-hidden bg-canvas text-ink">
      <Sidebar />
      <div className="flex min-w-0 flex-1 overflow-hidden">
        <main className="min-w-0 flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
        <AiDock open={aiOpen} onToggle={() => setAiOpen((v) => !v)} />
      </div>
    </div>
  )
}
