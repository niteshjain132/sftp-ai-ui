# SFTP AI Ops — Backend Java & REST API Migration Specification

> **Target Architecture:** Java 17/21 | Spring Boot 3.x | Spring Data JPA | Jackson JSON  
> **Frontend Client:** React 19 + TypeScript + Vite + Tailwind CSS + Recharts  
> **Base URL:** `/api`  
> **Document Version:** 1.0.0 (Production Blueprint)

---

## Table of Contents
1. [Architecture Overview & Global Conventions](#1-architecture-overview--global-conventions)
2. [UI-to-API Master Mapping Matrix](#2-ui-to-api-master-mapping-matrix)
3. [Core Java Domain Enums & Models](#3-core-java-domain-enums--models)
4. [Endpoint Specifications, Java DTOs & Controller Implementation](#4-endpoint-specifications-java-dtos--controller-implementation)
   - [4.1 Dashboard Operational Stats & Trends (`GET /api/stats`)](#41-dashboard-operational-stats--trends-get-apistats)
   - [4.2 Transferred Reports Ingest Table (`GET /api/reports`)](#42-transferred-reports-ingest-table-get-apireports)
   - [4.3 Upcoming File Arrivals Widget (`GET /api/arrivals/upcoming`)](#43-upcoming-file-arrivals-widget-get-apiarrivalsupcoming)
   - [4.4 Anomaly & Telemetry Diagnosis (`GET /api/reports/{id}/anomalies`)](#44-anomaly--telemetry-diagnosis-get-apireportsidanomalies)
   - [4.5 SFTP Watch Rules Management (`/api/watches`)](#45-sftp-watch-rules-management-apiwatches)
   - [4.6 Operational Incident Alerts (`/api/alerts`)](#46-operational-incident-alerts-apialerts)
   - [4.7 Notification Delivery Preferences (`/api/notify-prefs`)](#47-notification-delivery-preferences-apinotify-prefs)
   - [4.8 SFTP Ops Copilot Chat Engine (`POST /api/ai/chat`)](#48-sftp-ops-copilot-chat-engine-post-apiaichat)
5. [Database DDL & Schema Mapping (PostgreSQL / Oracle)](#5-database-ddl--schema-mapping-postgresql--oracle)
6. [Business Logic & Mathematical Formula Reference](#6-business-logic--mathematical-formula-reference)
7. [Step-by-Step Data Migration Checklist](#7-step-by-step-data-migration-checklist)

---

## 1. Architecture Overview & Global Conventions

### 1.1 JSON Formatting Standards
- **Property Naming:** Strict `camelCase` (e.g., `businessDate`, `sizeBytes`, `delayMinutes`).
- **Dates & Timestamps:** All dates and timestamps are ISO-8601 UTC formatted strings (`YYYY-MM-DDTHH:mm:ss'Z'`). Calendar business dates are formatted as `YYYY-MM-DD`.
- **Payload Compression:** Spring Boot should enable `server.compression.enabled=true` for all `application/json` responses.

### 1.2 File Naming Convention
All ingested SFTP file transfers strictly adhere to a 4-part dot-delimited format:
```text
<REPORT_CODE>.<CADENCE>.<YYYYMMDD>.<EXTENSION>
```
| Segment | Description | Type / Example |
| :--- | :--- | :--- |
| `REPORT_CODE` | Unique system report or feed code | `CST610C`, `POS591`, `MMR`, `INV220` |
| `CADENCE` | Ingest delivery schedule | `EOD`, `ITD`, `HTML` |
| `YYYYMMDD` | ISO 8-digit business date | `20261004` |
| `EXTENSION` | Payload file format | `csv`, `txt`, `html`, `dat`, `log` |

---

## 2. UI-to-API Master Mapping Matrix

| Page / Route | Screen Widget / Panel / Modal | HTTP Method & Path | Primary Purpose |
| :--- | :--- | :--- | :--- |
| **Dashboard** (`/`) | **Header Filters** (Search, Cadence, Period) | `GET /api/stats` + `GET /api/reports` | Live multi-criteria dashboard query |
| **Dashboard** (`/`) | **Top 6 KPI Metric Cards** (Received, Late, Pending, Missing, SLA, Anomalies) | `GET /api/stats` | High-level summary metrics & period deltas |
| **Dashboard** (`/`) | **KPI Floating Detail Modals** (Modal on card click) | Uses `GET /api/stats` + `GET /api/reports` | Detailed breakdown, live charts & file list |
| **Dashboard** (`/`) | **Arrival & SLA Trend Chart** | `GET /api/stats` (`trend` array) | 7d/14d/30d on-time vs late volume curve |
| **Dashboard** (`/`) | **Upcoming Arrivals Live Widget** | `GET /api/arrivals/upcoming` | Live countdowns to impending SLA cutoffs |
| **Dashboard** (`/`) | **Recent Transferred Reports Table** | `GET /api/reports` | Paginated, filterable, sortable transfer records |
| **Dashboard** (`/`) | **Anomaly Diagnosis Drawer / Modal** | `GET /api/reports/{id}/anomalies` | Gaussian $z$-score, size deviation, 8-run history |
| **Watches** (`/watches`) | **Active Watches Table / Cards** | `GET /api/watches` | Configured pattern regex ingest monitors |
| **Watches** (`/watches`) | **Create Watch Form Modal** | `POST /api/watches` | Register a new watch with quiet hours |
| **Watches** (`/watches`) | **Delete Watch Action** | `DELETE /api/watches/{id}` | Remove watch rule |
| **Alerts** (`/alerts`) | **Operational Incidents Feed** | `GET /api/alerts` | Critical/Warning alerts on delays and size anomalies |
| **Alerts** (`/alerts`) | **Acknowledge Alert Toggle** | `PATCH /api/alerts/{id}` | Mark incident as acknowledged/resolved |
| **Notify** (`/notifications`) | **Notification Channels & Quiet Hours** | `GET /api/notify-prefs` | Read user routing rules & quiet hours |
| **Notify** (`/notifications`) | **Save Preferences Form** | `PUT /api/notify-prefs` | Persist email/slack/teams notification settings |
| **Global Shell** | **SFTP Copilot Chat Dock** (Blinking Bot) | `POST /api/ai/chat` | AI-assisted operational queries with Recharts |

---

## 3. Core Java Domain Enums & Models

Create an `enums` package in your Spring Boot application:

```java
package com.sftp.ops.domain.enums;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonValue;

public enum ReportStatus {
    RECEIVED("received"),
    LATE("late"),
    PENDING("pending"),
    MISSING("missing");

    private final String value;

    ReportStatus(String value) {
        this.value = value;
    }

    @JsonValue
    public String getValue() {
        return value;
    }

    @JsonCreator
    public static ReportStatus fromValue(String value) {
        for (ReportStatus status : values()) {
            if (status.value.equalsIgnoreCase(value)) {
                return status;
            }
        }
        throw new IllegalArgumentException("Unknown status: " + value);
    }
}
```

```java
package com.sftp.ops.domain.enums;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonValue;

public enum Cadence {
    EOD("EOD"),
    ITD("ITD"),
    HTML("HTML");

    private final String value;

    Cadence(String value) {
        this.value = value;
    }

    @JsonValue
    public String getValue() {
        return value;
    }

    @JsonCreator
    public static Cadence fromValue(String value) {
        for (Cadence c : values()) {
            if (c.value.equalsIgnoreCase(value)) {
                return c;
            }
        }
        return EOD;
    }
}
```

```java
package com.sftp.ops.domain.enums;

public enum Severity {
    INFO,
    WARN,
    CRIT
}
```

---

## 4. Endpoint Specifications, Java DTOs & Controller Implementation

### 4.1 Dashboard Operational Stats & Trends (`GET /api/stats`)
- **UI Widget:** Top 6 KPI summary cards (`Received`, `Late`, `Pending`, `Missing`, `SLA Health`, `Size Anomalies`), Floating Modals, and the Middle Section Area Trend Chart.
- **HTTP Method:** `GET`
- **Path:** `/api/stats`
- **Query Parameters:**
  - `q` (optional): Alphanumeric search term matching filename or report code.
  - `cadence` (optional): `all`, `EOD`, `ITD`, or `HTML`. Default: `all`.
  - `period` (optional): `7d`, `14d`, `30d`. Default: `14d`.

#### Response JSON Payload Example:
```json
{
  "received": 142,
  "receivedDelta": 12,
  "late": 8,
  "lateDelta": -2,
  "pending": 5,
  "pendingDelta": 1,
  "missing": 2,
  "missingDelta": 0,
  "slaHealth": 95,
  "slaDelta": 1.8,
  "sizeAnomalies": 3,
  "sizeAnomaliesDelta": -1,
  "trend": [
    { "date": "2026-09-28", "received": 18, "late": 1, "pending": 0 },
    { "date": "2026-09-29", "received": 22, "late": 2, "pending": 0 },
    { "date": "2026-09-30", "received": 19, "late": 0, "pending": 0 },
    { "date": "2026-10-01", "received": 21, "late": 1, "pending": 0 },
    { "date": "2026-10-02", "received": 20, "late": 2, "pending": 0 },
    { "date": "2026-10-03", "received": 24, "late": 1, "pending": 0 },
    { "date": "2026-10-04", "received": 18, "late": 1, "pending": 5 }
  ],
  "cadence": [
    { "cadence": "EOD", "count": 88 },
    { "cadence": "ITD", "count": 42 },
    { "cadence": "HTML", "count": 27 }
  ]
}
```

#### Java 17+ Record DTOs:
```java
package com.sftp.ops.dto;

import java.util.List;

public record StatsResponse(
    int received,
    int receivedDelta,
    int late,
    int lateDelta,
    int pending,
    int pendingDelta,
    int missing,
    int missingDelta,
    int slaHealth,
    double slaDelta,
    int sizeAnomalies,
    int sizeAnomaliesDelta,
    List<TrendPointDto> trend,
    List<CadenceCountDto> cadence
) {}

public record TrendPointDto(
    String date,      // Format: "YYYY-MM-DD"
    int received,
    int late,
    int pending
) {}

public record CadenceCountDto(
    String cadence,
    int count
) {}
```

---

### 4.2 Transferred Reports Ingest Table (`GET /api/reports`)
- **UI Widget:** Recent Transferred Reports Table with live status pills, delay badges, size display, file date filter, and pagination.
- **HTTP Method:** `GET`
- **Path:** `/api/reports`
- **Query Parameters:**
  - `q` (optional): Search filter for filename or code.
  - `cadence` (optional): `all`, `EOD`, `ITD`, `HTML`.
  - `period` (optional): `7d`, `14d`, `30d`.

#### Response JSON Payload Example:
```json
[
  {
    "id": "rep-101",
    "filename": "CST610C.EOD.20261004.csv",
    "code": "CST610C",
    "cadence": "EOD",
    "businessDate": "2026-10-04",
    "ext": "csv",
    "status": "received",
    "sizeBytes": 421890,
    "expectedAt": "2026-10-04T18:00:00Z",
    "arrivedAt": "2026-10-04T17:48:12Z",
    "delayMinutes": -12
  },
  {
    "id": "rep-102",
    "filename": "POS591.ITD.20261004.txt",
    "code": "POS591",
    "cadence": "ITD",
    "businessDate": "2026-10-04",
    "ext": "txt",
    "status": "late",
    "sizeBytes": 91400,
    "expectedAt": "2026-10-04T16:30:00Z",
    "arrivedAt": "2026-10-04T17:02:45Z",
    "delayMinutes": 32
  },
  {
    "id": "rep-103",
    "filename": "MMR.HTML.20261004.html",
    "code": "MMR",
    "cadence": "HTML",
    "businessDate": "2026-10-04",
    "ext": "html",
    "status": "missing",
    "sizeBytes": 0,
    "expectedAt": "2026-10-04T12:00:00Z",
    "arrivedAt": null,
    "delayMinutes": 510
  }
]
```

#### Java 17+ Record DTO:
```java
package com.sftp.ops.dto;

import com.sftp.ops.domain.enums.Cadence;
import com.sftp.ops.domain.enums.ReportStatus;
import java.time.Instant;
import java.time.LocalDate;

public record ReportDto(
    String id,
    String filename,
    String code,
    Cadence cadence,
    LocalDate businessDate,
    String ext,
    ReportStatus status,
    long sizeBytes,
    Instant expectedAt,
    Instant arrivedAt,
    Integer delayMinutes
) {}
```

---

### 4.3 Upcoming File Arrivals Widget (`GET /api/arrivals/upcoming`)
- **UI Widget:** "Upcoming Arrivals" sidebar card with live real-time SLA countdown badges.
- **HTTP Method:** `GET`
- **Path:** `/api/arrivals/upcoming`

#### Response JSON Payload Example:
```json
[
  {
    "id": "rep-201",
    "filename": "RISK88.EOD.20261004.csv",
    "code": "RISK88",
    "cadence": "EOD",
    "businessDate": "2026-10-04",
    "ext": "csv",
    "status": "pending",
    "sizeBytes": 0,
    "expectedAt": "2026-10-04T18:00:00Z",
    "arrivedAt": null,
    "delayMinutes": null
  }
]
```

---

### 4.4 Anomaly & Telemetry Diagnosis (`GET /api/reports/{id}/anomalies`)
- **UI Widget:** Telemetry Diagnosis modal drawer opened when clicking any table row or modal file item. Shows rolling mean, Gaussian $z$-score, missing streak, and 8-run history bar chart.
- **HTTP Method:** `GET`
- **Path:** `/api/reports/{id}/anomalies`

#### Response JSON Payload Example:
```json
{
  "reportId": "rep-102",
  "sizeMean": 88000,
  "sizeZ": 2.41,
  "delayMinutes": 32,
  "missingStreak": 0,
  "history": [
    { "date": "09-27", "size": 86, "delayMinutes": 5 },
    { "date": "09-28", "size": 89, "delayMinutes": -2 },
    { "date": "09-29", "size": 87, "delayMinutes": 0 },
    { "date": "09-30", "size": 88, "delayMinutes": 4 },
    { "date": "10-01", "size": 90, "delayMinutes": -1 },
    { "date": "10-02", "size": 85, "delayMinutes": 8 },
    { "date": "10-03", "size": 88, "delayMinutes": 12 },
    { "date": "10-04", "size": 148, "delayMinutes": 32 }
  ]
}
```

#### Java 17+ Record DTO:
```java
package com.sftp.ops.dto;

import java.util.List;

public record AnomalyResponse(
    String reportId,
    long sizeMean,
    double sizeZ,
    Integer delayMinutes,
    int missingStreak,
    List<HistoryPointDto> history
) {}

public record HistoryPointDto(
    String date,          // Short format: "MM-DD"
    long size,            // Size in KB for chart display
    int delayMinutes
) {}
```

---

### 4.5 SFTP Watch Rules Management (`/api/watches`)
- **UI Widget:** Watches page (`/watches`) — monitoring pattern rules, notification channels, quiet hours, and regex testing.

#### Endpoints:
1. `GET /api/watches` $\rightarrow$ List all watches
2. `POST /api/watches` $\rightarrow$ Create new watch
3. `DELETE /api/watches/{id}` $\rightarrow$ Delete watch

#### Request Payload (`POST /api/watches`):
```json
{
  "name": "EOD Risk Books",
  "pattern": "^(RISK88|CST610C)\\.",
  "channel": "slack",
  "triggers": ["late", "missing", "size"],
  "quietHours": {
    "start": "22:00",
    "end": "07:00"
  }
}
```

#### Java 17+ Record DTOs:
```java
package com.sftp.ops.dto;

import java.util.List;

public record WatchDto(
    String id,
    String name,
    String pattern,
    String channel,           // "email", "slack", "teams"
    List<String> triggers,    // "late", "missing", "size"
    QuietHoursDto quietHours
) {}

public record QuietHoursDto(
    String start,             // "22:00"
    String end                // "07:00"
) {}
```

---

### 4.6 Operational Incident Alerts (`/api/alerts`)
- **UI Widget:** Alerts page (`/alerts`) — operational incident feed and acknowledgment actions.

#### Endpoints:
1. `GET /api/alerts` $\rightarrow$ List alerts
2. `PATCH /api/alerts/{id}` $\rightarrow$ Update acknowledgment status

#### Request Payload (`PATCH /api/alerts/{id}`):
```json
{
  "acked": true
}
```

#### Response Payload (`GET /api/alerts`):
```json
[
  {
    "id": "al-1",
    "watchId": "watch-1",
    "title": "CST610C arrived 18 min late",
    "detail": "File size within band. SLA cutoff 18:00.",
    "severity": "warn",
    "at": "2026-10-04T18:18:00Z",
    "acked": false
  }
]
```

#### Java Record DTO:
```java
package com.sftp.ops.dto;

import java.time.Instant;

public record AlertItemDto(
    String id,
    String watchId,
    String title,
    String detail,
    String severity,    // "crit", "warn", "info"
    Instant at,
    boolean acked
) {}

public record AckAlertRequest(
    boolean acked
) {}
```

---

### 4.7 Notification Delivery Preferences (`/api/notify-prefs`)
- **UI Widget:** Preferences page (`/notifications`) — configure delivery channels, digest frequency, and global quiet hours.

#### Endpoints:
1. `GET /api/notify-prefs` $\rightarrow$ Retrieve current preferences
2. `PUT /api/notify-prefs` $\rightarrow$ Update preferences

#### Payload:
```json
{
  "channels": {
    "email": true,
    "slack": true,
    "teams": false
  },
  "digest": "realtime",
  "quietHours": {
    "start": "22:00",
    "end": "07:00"
  }
}
```

#### Java Record DTO:
```java
package com.sftp.ops.dto;

import java.util.Map;

public record NotifyPrefsDto(
    Map<String, Boolean> channels,
    String digest,              // "realtime", "hourly", "daily"
    QuietHoursDto quietHours
) {}
```

---

### 4.8 SFTP Ops Copilot Chat Engine (`POST /api/ai/chat`)
- **UI Widget:** AI Copilot Dock on the right side of the screen featuring the **Blinking Bot**.
- **HTTP Method:** `POST`
- **Path:** `/api/ai/chat`

#### Request Payload:
```json
{
  "messages": [
    { "role": "user", "content": "Which files breached SLA today?" }
  ],
  "reportId": "rep-102"
}
```

#### Response Payload:
```json
{
  "reply": "Today POS591 arrived 32 minutes late (SLA 16:30, arrived 17:02). MMR is currently marked MISSING.",
  "charts": [
    {
      "type": "bar",
      "title": "Today's Delays (Minutes past SLA)",
      "series": [
        {
          "name": "Delays",
          "points": [
            { "x": "POS591", "y": 32 },
            { "x": "MMR", "y": 510 }
          ]
        }
      ]
    }
  ]
}
```

#### Java Record DTO:
```java
package com.sftp.ops.dto;

import java.util.List;

public record ChatRequest(
    List<ChatMessageDto> messages,
    String reportId
) {}

public record ChatMessageDto(
    String role,
    String content
) {}

public record ChatReply(
    String reply,
    List<ChatChartDto> charts
) {}

public record ChatChartDto(
    String type,        // "bar" or "line"
    String title,
    List<ChartSeriesDto> series
) {}

public record ChartSeriesDto(
    String name,
    List<ChartPointDto> points
) {}

public record ChartPointDto(
    String x,
    double y
) {}
```

---

## 5. Database DDL & Schema Mapping (PostgreSQL / Oracle)

### 5.1 PostgreSQL Schema
```sql
-- 1. SFTP Transfer Ingest Telemetry
CREATE TABLE sftp_reports (
    id VARCHAR(64) PRIMARY KEY,
    filename VARCHAR(255) NOT NULL,
    code VARCHAR(64) NOT NULL,
    cadence VARCHAR(16) NOT NULL,
    business_date DATE NOT NULL,
    ext VARCHAR(16) NOT NULL,
    status VARCHAR(20) NOT NULL, -- 'received', 'late', 'pending', 'missing'
    size_bytes BIGINT NOT NULL DEFAULT 0,
    expected_at TIMESTAMPTZ NOT NULL,
    arrived_at TIMESTAMPTZ,
    delay_minutes INT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_reports_lookup ON sftp_reports (business_date, cadence, status);
CREATE INDEX idx_reports_code ON sftp_reports (code);

-- 2. Ingest Watch Monitoring Rules
CREATE TABLE sftp_watches (
    id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(128) NOT NULL,
    pattern VARCHAR(255) NOT NULL,
    channel VARCHAR(32) NOT NULL, -- 'email', 'slack', 'teams'
    triggers TEXT[] NOT NULL,     -- ARRAY['late', 'missing', 'size']
    quiet_start VARCHAR(8),
    quiet_end VARCHAR(8),
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 3. Operational Alerts Feed
CREATE TABLE sftp_alerts (
    id VARCHAR(64) PRIMARY KEY,
    watch_id VARCHAR(64) REFERENCES sftp_watches(id) ON DELETE SET NULL,
    title VARCHAR(255) NOT NULL,
    detail TEXT NOT NULL,
    severity VARCHAR(16) NOT NULL, -- 'crit', 'warn', 'info'
    alert_time TIMESTAMPTZ NOT NULL,
    acked BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE INDEX idx_alerts_acked ON sftp_alerts (acked, alert_time DESC);

-- 4. Notification Preferences
CREATE TABLE sftp_notify_preferences (
    user_id VARCHAR(64) PRIMARY KEY,
    email_enabled BOOLEAN DEFAULT TRUE,
    slack_enabled BOOLEAN DEFAULT TRUE,
    teams_enabled BOOLEAN DEFAULT FALSE,
    digest_frequency VARCHAR(20) DEFAULT 'realtime',
    quiet_start VARCHAR(8) DEFAULT '22:00',
    quiet_end VARCHAR(8) DEFAULT '07:00'
);
```

---

## 6. Business Logic & Mathematical Formula Reference

### 6.1 SLA Cutoff Scheduling Rules
| Cadence | Expected SLA Cutoff Time | Target Tolerance Grace |
| :--- | :--- | :--- |
| **HTML** | 12:00:00 (Noon local) | $\le 10$ minutes |
| **ITD** (Intraday) | 16:30:00 (4:30 PM local) | $\le 15$ minutes |
| **EOD** (End of Day) | 18:00:00 (6:00 PM local) | $\le 20$ minutes |

### 6.2 Status Determination Logic
```java
public ReportStatus determineStatus(Instant expectedAt, Instant arrivedAt, Instant now) {
    if (arrivedAt == null) {
        return now.isAfter(expectedAt) ? ReportStatus.MISSING : ReportStatus.PENDING;
    }
    return arrivedAt.isAfter(expectedAt) ? ReportStatus.LATE : ReportStatus.RECEIVED;
}
```

### 6.3 Overall SLA Health Compliance Rate (%)
$$\text{SLA Health} = \begin{cases} 100\%, & \text{if } (\text{received} + \text{late}) = 0 \\ \left\lfloor \frac{\text{received}}{\text{received} + \text{late}} \times 100 \right\rfloor, & \text{otherwise} \end{cases}$$

### 6.4 File Size Anomaly Detection ($z$-Score)
Given historical file sizes $x_1, x_2, \dots, x_N$ for the same report code over rolling 7 business days:
1. **Sample Mean:** $\mu = \frac{1}{N} \sum_{i=1}^N x_i$
2. **Sample Variance:** $\sigma^2 = \frac{1}{N - 1} \sum_{i=1}^N (x_i - \mu)^2$
3. **Standard Deviation:** $\sigma = \sqrt{\sigma^2}$
4. **Gaussian Standard Score:** $z = \frac{x_{\text{today}} - \mu}{\sigma}$
5. **Anomaly Threshold:** Flagged as an anomaly if $|z| \ge 2.0$.

---

## 7. Step-by-Step Data Migration Checklist

- [ ] **Step 1:** Create database schema using the DDL provided in [Section 5](#5-database-ddl--schema-mapping-postgresql--oracle).
- [ ] **Step 2:** Populate historical file arrival data for at least the last 30 business days to ensure initial SLA trend charts and $z$-score baselines are accurate.
- [ ] **Step 3:** Implement Spring Boot `@RestController` classes returning the Java records specified in [Section 4](#4-endpoint-specifications-java-dtos--controller-implementation).
- [ ] **Step 4:** Verify CORS configuration if the Spring backend and UI run on different ports (`allowedOrigins = "http://localhost:5173"`).
- [ ] **Step 5:** Connect real SFTP poller or Cloud Pub/Sub listener to insert incoming file events into `sftp_reports` with computed status and delay minutes.
- [ ] **Step 6:** Point the UI's API client (in `src/api/client.ts`) to your live Spring Boot host (`http://localhost:8080`).
