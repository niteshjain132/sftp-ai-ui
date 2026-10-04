import { Navigate, Route, Routes } from 'react-router-dom'
import { Shell } from './components/layout/Shell'
import { Alerts } from './pages/Alerts'
import { Dashboard } from './pages/Dashboard'
import { Help } from './pages/Help'
import { NotifyPrefs } from './pages/NotifyPrefs'
import { Watches } from './pages/Watches'

export default function App() {
  return (
    <Routes>
      <Route element={<Shell />}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/watches" element={<Watches />} />
        <Route path="/alerts" element={<Alerts />} />
        <Route path="/notify" element={<NotifyPrefs />} />
        <Route path="/help" element={<Help />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}
