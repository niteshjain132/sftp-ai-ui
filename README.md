# SFTP AI Dashboard (UI)

An intelligent, real-time operations dashboard for monitoring enterprise SFTP file arrival pipelines, identifying delivery anomalies, and interacting with an integrated AI copilot.

---

## Features

- **Real-Time Operational Monitoring**: Centralized visibility into transfers, status breakdowns (Received, In-Progress, Pending, Delayed, Missing), and volume trends.
- **Intraday CST Filtering**: Filter dashboard metrics and charts across operational intraday windows: `1h`, `3h`, `6h`, `12h`, and `24h` (all timestamps formatted in **Central Standard Time / CST**).
- **Anomaly Detection Radar**: Automated detection of critical file anomalies:
  - Significant **File Size Drops** (>40% drop vs. 30-day baseline).
  - **Late Arrivals** (delivered >30 minutes past scheduled SLA).
  - Dynamic nominal green status state when 0 anomalies are detected.
- **Interactive Modal Drilldowns**: Click on any status card (Received, Delayed, Pending, Missing) or transfer row to open a rich floating detail window with historical file arrival trends and Recharts visualization.
- **Collapsible Sidebar**: Compact `w-[68px]` collapsed drawer with hamburger menu (`Menu`), hover tooltips, and `localStorage` persistence.
- **AI Operations Copilot**: Floating right-hand dock with blinking AI bot status indicator, quick-query chips, and structured answer rendering.
- **Dark & Light Mode**: Seamless theme switching with persistent settings.
- **Built-in Mock Backend**: MSW (Mock Service Worker) mock API for zero-config offline prototyping.

---

## Prerequisites

- **Node.js**: `v18.0.0` or higher (Node 20+ recommended)
- **Package Manager**: `npm` (v9+), `pnpm`, or `yarn`

---

## Getting Started

### 1. Clone the Repository

```bash
git clone https://github.com/niteshjain132/sftp-ai-ui.git
cd sftp-ai-ui
```

### 2. Install Dependencies

```bash
npm install
```

---

## Development & Build Scripts

| Command | Description |
|---|---|
| `npm run dev` | Starts the local Vite development server with Hot Module Replacement (HMR) at [http://localhost:5173](http://localhost:5173) |
| `npm run build` | Runs TypeScript type checking (`tsc -b`) and builds the production bundle into `dist/` |
| `npm run preview` | Locally serves the production bundle from `dist/` to test production behavior |
| `npm run lint` | Runs ultra-fast linting using [Oxlint](https://oxc.rs) |

### Running in Development

```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser. The mock API service worker automatically activates to provide sample operational metrics.

### Building for Production

```bash
npm run build
```

The compiled assets will be output to the `dist/` directory.

### Previewing the Production Build

```bash
npm run preview
```

---

## Project Structure

```text
sftp-ai-ui/
├── public/                 # Static assets & MSW mockServiceWorker.js
├── src/
│   ├── api/                # API client and backend interaction layer
│   ├── components/
│   │   ├── dashboard/      # Dashboard cards, AnomalyDetectionPanel, modals, charts
│   │   ├── layout/         # Shell, collapsible Sidebar, Header, AiDock
│   │   └── ui/             # Reusable UI primitives (Buttons, Modals, Badges)
│   ├── lib/                # Date/time formatting (CST), theme helpers
│   ├── mock/               # Mock data generator and MSW request handlers
│   ├── pages/              # Route views (Dashboard, Watches, Alerts, Notify, Help)
│   ├── App.tsx             # Root routing and application providers
│   ├── main.tsx            # Application entrypoint & MSW initialization
│   └── index.css           # Tailwind CSS styles and theme variables
├── BACKEND_API_JAVA_SPEC.md# Complete Java / Spring Boot REST API specification
├── vertex.md               # Google Cloud Vertex AI integration guide
├── vite.config.ts          # Vite configuration with Tailwind CSS v4 plugin
└── package.json            # Project dependencies and npm scripts
```

---

## Backend & AI Integration Guides

- **Java / Spring Boot REST API Spec**: See [BACKEND_API_JAVA_SPEC.md](./BACKEND_API_JAVA_SPEC.md) for endpoint mappings, DTO schemas, and database entity models.
- **Google Cloud Vertex AI Integration**: See [vertex.md](./vertex.md) for instructions on connecting the AI dock to a real Vertex AI Search / Gemini endpoint.
