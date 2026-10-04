# Connecting Vertex AI (Gemini) with SFTP Ops Copilot

This guide provides a comprehensive manual on connecting the **SFTP AI Ops Copilot** to a live **Google Cloud Vertex AI** or **Google AI Studio (Gemini)** endpoint, explaining how the bot grounds responses with real-time file arrival telemetry, dynamically renders Recharts visual graphs, and answers operational questions about file arrival delays and volume anomalies.

---

## Table of Contents
1. [Architecture & Workflow Overview](#1-architecture--workflow-overview)
2. [Connection Options & Configuration](#2-connection-options--configuration)
   - [Option A: Google AI Studio Gemini API Key (Fastest Setup)](#option-a-google-ai-studio-gemini-api-key-fastest-setup)
   - [Option B: Enterprise Google Cloud Vertex AI Project](#option-b-enterprise-google-cloud-vertex-ai-project)
3. [Environment Configuration (`.env`)](#3-environment-configuration-env)
4. [Prompt Engineering & The Visual Chart JSON Contract](#4-prompt-engineering--the-visual-chart-json-contract)
5. [Context Grounding: How the Bot Understands Your Files](#5-context-grounding-how-the-bot-understands-your-files)
6. [Operational Dialogue & Chart Examples](#6-operational-dialogue--chart-examples)
   - [Scenario 1: Ingest Delays & SLA Breaches](#scenario-1-ingest-delays--sla-breaches)
   - [Scenario 2: 24-Hour File Size Drops & Gaussian Anomalies](#scenario-2-24-hour-file-size-drops--gaussian-anomalies)
   - [Scenario 3: Specific Report History & Jitter (`CST610C`)](#scenario-3-specific-report-history--jitter-cst610c)
7. [Production Java / Spring Boot Vertex AI Implementation](#7-production-java--spring-boot-vertex-ai-implementation)
8. [Troubleshooting & Best Practices](#8-troubleshooting--best-practices)

---

## 1. Architecture & Workflow Overview

```
 ┌───────────────────────┐
 │   React Frontend      │
 │  (AiDock with Bot)    │
 └───────────┬───────────┘
             │  POST /api/ai/chat { messages, reportId? }
             ▼
 ┌───────────────────────────────────────────────────────────┐
 │   Backend (Vite Server Proxy or Java Spring Boot)         │
 │  1. Gathers live telemetry from database/mock (arrivals,  │
 │     expected cutoffs, delays, 7-day size averages)        │
 │  2. Formats Grounded System Context + User Question       │
 │  3. Calls Google Vertex AI (Gemini 2.0 Flash)             │
 └───────────────────────────┬───────────────────────────────┘
                             │  HTTPS POST :generateContent
                             ▼
              ┌─────────────────────────────┐
              │   Google Vertex AI Engine   │
              │     (Gemini 2.0 Flash)      │
              └──────────────┬──────────────┘
                             │
  Returns: Markdown Analysis + ```json { charts: [...] } ```
                             │
                             ▼
 ┌───────────────────────────────────────────────────────────┐
 │   Backend / Client Parser                                 │
 │  - Extracts plain text response                           │
 │  - Parses JSON block into structured ChartSeries          │
 └───────────────────────────┬───────────────────────────────┘
                             │
                             ▼
 ┌───────────────────────────────────────────────────────────┐
 │   React UI Render (AiDock.tsx)                            │
 │  - Animated "Blinking Bot" message bubble                 │
 │  - Interactive Recharts BarChart / LineChart              │
 └───────────────────────────────────────────────────────────┘
```

---

## 2. Connection Options & Configuration

You can connect to Gemini through either **Google AI Studio** (API Key) or **Enterprise Vertex AI on Google Cloud Platform**.

### Option A: Google AI Studio Gemini API Key (Fastest Setup)
1. Go to [Google AI Studio](https://aistudio.google.com/).
2. Click **Get API key** and create a new key.
3. Use the public Gemini REST endpoint:
   ```text
   https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=YOUR_API_KEY
   ```

### Option B: Enterprise Google Cloud Vertex AI Project
1. Enable the **Vertex AI API** in your Google Cloud Console:
   ```bash
   gcloud services enable aiplatform.googleapis.com
   ```
2. Identify your:
   - **GCP Project ID**: e.g. `fintech-prod-sftp`
   - **GCP Region**: e.g. `us-central1` or `europe-west1`
   - **Model ID**: `gemini-2.0-flash` or `gemini-1.5-pro`
3. Obtain credentials:
   - For local development: Set `VERTEX_API_KEY` (using an API key restricted to Vertex AI) or use Application Default Credentials (ADC) with an OAuth bearer token:
     ```bash
     export VERTEX_BEARER_TOKEN=$(gcloud auth print-access-token)
     ```
   - Regional Vertex endpoint:
     ```text
     https://{LOCATION}-aiplatform.googleapis.com/v1/projects/{PROJECT}/locations/{LOCATION}/publishers/google/models/{MODEL}:generateContent
     ```

---

## 3. Environment Configuration (`.env`)

In the project root `/Users/Nitesh/git/ai-agents/cursor-sftpi/sftp-ai-ui`, create or update `.env`:

```env
# ==========================================
# Google Vertex AI / Gemini API Credentials
# ==========================================

# 1. API Key (From Google AI Studio or GCP API Credentials)
VERTEX_API_KEY=AIzaSyD_EXAMPLE_KEY_HERE_YOUR_REAL_KEY

# 2. Optional: For direct GCP Vertex AI Enterprise Projects
# If left blank, the server will default to Google AI Studio gateway
VERTEX_PROJECT=
VERTEX_LOCATION=us-central1
VERTEX_MODEL=gemini-2.0-flash
```

> **Note:** If `VERTEX_API_KEY` is not provided, the local dev server automatically falls back to the deterministic local mock engine in `server/chat.ts`, so your UI will always function.

---

## 4. Prompt Engineering & The Visual Chart JSON Contract

The UI uses **Recharts** to render charts returned by the bot. To ensure the model formats its response correctly, the backend sends a strict **System Instruction**.

### System Prompt
```text
You are an expert SFTP Operations Analyst & Automated Ingestion Copilot.
You monitor daily file arrivals, SLA cutoffs (EOD 18:00, ITD 16:30, HTML 12:00), delivery delays, and file payload size anomalies (|z| >= 2.0 sigma).

Guidelines:
1. Provide a concise, clear operational explanation in markdown.
2. Whenever discussing numerical trends, arrival delays, volume drops, or historical comparisons, YOU MUST APPEND A FENCED JSON BLOCK at the very end of your response using this exact schema:

```json
{
  "charts": [
    {
      "type": "bar" | "line",
      "title": "Concise Descriptive Title",
      "series": [
        {
          "name": "metric_name",
          "points": [
            { "x": "Category or Date (e.g. CST610C or 10-04)", "y": 42.5 }
          ]
        }
      ]
    }
  ]
}
```
3. Never output invalid JSON in the code fence. Keep the markdown conversational and informative.
```

### Supported Chart Types in UI:
- `"bar"`: Best for comparing individual file delays, file sizes (KB), or breach durations.
- `"line"`: Best for time-series trends (daily arrival counts, 7-day SLA compliance trajectory).

---

## 5. Context Grounding: How the Bot Understands Your Files

LLMs have no internal connection to your SFTP server unless relevant telemetry is injected into the prompt. When `POST /api/ai/chat` is invoked, the backend prepends a **telemetry summary** of the current state:

```text
[LIVE SFTP TELEMETRY GROUNDING DATA]
Current Time: 2026-10-04 18:45:00 UTC
Active Period: Today's Deliveries

- Today's Summary:
  * Total Deliveries: 28
  * Received on-time: 22
  * Late arrivals: 3 (POS591 +32m, CST610C +18m, RISK88 +24m)
  * Pending awaiting delivery: 2 (INV220, GLD440)
  * Missing past cutoff: 1 (MMR HTML pack, expected 12:00, now +6h 45m past deadline)
  * Current SLA Health: 88.0%

- 24-Hour Anomalies Detected:
  1. POS591 (ITD): Size anomaly +68% above 7-day mean (148 KB vs 88 KB baseline, z = +2.4σ). Arrived 32m late.
  2. CST610C (EOD): Size drop -45% below mean (230 KB vs 420 KB baseline, z = -2.1σ). Arrived 18m late.
  3. MMR (HTML): Missing. SLA Cutoff 12:00 exceeded. Alert Active.

User Query: "Which files arrived late today and why?"
```

---

## 6. Operational Dialogue & Chart Examples

### Scenario 1: Ingest Delays & SLA Breaches
**User:** *"Which files arrived late today and how severe are the delays?"*

**Bot Response:**
> Today, **3 files** breached their designated SLA cutoffs:
> 1. **`POS591.ITD.20261004.txt`**: Arrived **32 minutes late** (expected 16:30, arrived 17:02).
> 2. **`RISK88.EOD.20261004.csv`**: Arrived **24 minutes late** (expected 18:00, arrived 18:24).
> 3. **`CST610C.EOD.20261004.csv`**: Arrived **18 minutes late** (expected 18:00, arrived 18:18).
>
> In addition, **`MMR.HTML.20261004.html`** is currently marked **MISSING**, having exceeded its 12:00 noon cutoff by over 6 hours.
>
> ```json
> {
>   "charts": [
>     {
>       "type": "bar",
>       "title": "Today's SLA Delay (Minutes Past Deadline)",
>       "series": [
>         {
>           "name": "Delay Minutes",
>           "points": [
>             { "x": "CST610C", "y": 18 },
>             { "x": "RISK88", "y": 24 },
>             { "x": "POS591", "y": 32 }
>           ]
>         }
>       ]
>     }
>   ]
> }
> ```

---

### Scenario 2: 24-Hour File Size Drops & Gaussian Anomalies
**User:** *"Are there any reports where the file size dropped significantly in the last 24 hours?"*

**Bot Response:**
> Yes, our real-time telemetry scan detected a **critical size shrinkage** for **`CST610C`**:
> - **Delivered Size:** `230 KB`
> - **7-Day Rolling Mean:** `420 KB`
> - **Percentage Drop:** **$-45.2\%$**
> - **Gaussian $z$-Score:** **$-2.1\sigma$**
>
> This degree of drop suggests a truncated extract or an upstream job that finished prematurely without dumping all trade ledger records.
>
> ```json
> {
>   "charts": [
>     {
>       "type": "bar",
>       "title": "CST610C Payload Size vs 7-Day Baseline (KB)",
>       "series": [
>         {
>           "name": "Size KB",
>           "points": [
>             { "x": "7-Day Mean", "y": 420 },
>             { "x": "Yesterday", "y": 415 },
>             { "x": "Today (Anomaly)", "y": 230 }
>           ]
>         }
>       ]
>     }
>   ]
> }
> ```

---

### Scenario 3: Specific Report History & Jitter (`CST610C`)
**User:** *"Show arrival trend for CST610C over the last 5 runs."*

**Bot Response:**
> Here is the 5-day arrival delay trend for `CST610C.EOD`:
> Delivery timing has been deteriorating over the past 48 hours due to database lock contention during the 17:30 batch window.
>
> ```json
> {
>   "charts": [
>     {
>       "type": "line",
>       "title": "CST610C SLA Arrival Delay (Minutes)",
>       "series": [
>         {
>           "name": "Delay (min)",
>           "points": [
>             { "x": "09-30", "y": -4 },
>             { "x": "10-01", "y": 2 },
>             { "x": "10-02", "y": 8 },
>             { "x": "10-03", "y": 14 },
>             { "x": "10-04", "y": 18 }
>           ]
>         }
>       ]
>     }
>   ]
> }
> ```

---

## 7. Production Java / Spring Boot Vertex AI Implementation

Below is a complete, production-grade Spring Boot service using Java 17+ and `RestClient` to call Vertex AI directly:

```java
package com.sftp.ops.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.sftp.ops.dto.ChatChartDto;
import com.sftp.ops.dto.ChartPointDto;
import com.sftp.ops.dto.ChartSeriesDto;
import com.sftp.ops.dto.ChatReply;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;

import java.util.*;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Service
public class VertexAiChatService {

    private final RestClient restClient;
    private final ObjectMapper objectMapper;

    @Value("${vertex.api.key:}")
    private String apiKey;

    @Value("${vertex.project:}")
    private String project;

    @Value("${vertex.location:us-central1}")
    private String location;

    @Value("${vertex.model:gemini-2.0-flash}")
    private String model;

    private static final Pattern JSON_FENCE_PATTERN =
            Pattern.compile("```json\\s*([\\s\\S]*?)```", Pattern.CASE_INSENSITIVE);

    public VertexAiChatService(ObjectMapper objectMapper) {
        this.restClient = RestClient.builder().build();
        this.objectMapper = objectMapper;
    }

    public ChatReply processChat(List<Map<String, String>> messages, String reportContext) {
        if (apiKey == null || apiKey.isBlank()) {
            return new ChatReply("Vertex API Key is not configured. Running in mock mode.", List.of());
        }

        String endpointUrl = buildEndpointUrl();
        String systemInstruction = buildSystemPrompt(reportContext);
        String userDialogue = buildDialogue(messages);

        Map<String, Object> requestBody = Map.of(
            "systemInstruction", Map.of(
                "parts", List.of(Map.of("text", systemInstruction))
            ),
            "contents", List.of(
                Map.of("role", "user", "parts", List.of(Map.of("text", userDialogue)))
            ),
            "generationConfig", Map.of(
                "temperature", 0.2,
                "maxOutputTokens", 1024
            )
        );

        try {
            JsonNode response = restClient.post()
                    .uri(endpointUrl)
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(requestBody)
                    .retrieve()
                    .body(JsonNode.class);

            String rawText = extractCandidateText(response);
            return parseReplyAndCharts(rawText);

        } catch (Exception e) {
            return new ChatReply("Error querying Vertex AI: " + e.getMessage(), List.of());
        }
    }

    private String buildEndpointUrl() {
        if (project != null && !project.isBlank()) {
            return String.format(
                "https://%s-aiplatform.googleapis.com/v1/projects/%s/locations/%s/publishers/google/models/%s:generateContent?key=%s",
                location, project, location, model, apiKey
            );
        }
        return String.format(
            "https://generativelanguage.googleapis.com/v1beta/models/%s:generateContent?key=%s",
            model, apiKey
        );
    }

    private String buildSystemPrompt(String reportContext) {
        StringBuilder sb = new StringBuilder();
        sb.append("You are an SFTP Ops analyst assistant. Be concise.\n");
        sb.append("When useful to illustrate delay or size trends, append a fenced json block:\n");
        sb.append("```json\n");
        sb.append("{\"charts\": [{\"type\": \"line\"|\"bar\", \"title\": \"...\", \"series\": [{\"name\": \"...\", \"points\": [{\"x\": \"...\", \"y\": 1.0}]}]}]}\n");
        sb.append("```\n");
        if (reportContext != null && !reportContext.isBlank()) {
            sb.append("\nFiltering context: Currently investigating report: ").append(reportContext).append("\n");
        }
        return sb.toString();
    }

    private String buildDialogue(List<Map<String, String>> messages) {
        StringBuilder sb = new StringBuilder();
        for (Map<String, String> m : messages) {
            sb.append(m.getOrDefault("role", "user")).append(": ").append(m.getOrDefault("content", "")).append("\n");
        }
        return sb.toString();
    }

    private String extractCandidateText(JsonNode response) {
        if (response == null) return "No response from AI engine.";
        JsonNode candidate = response.path("candidates").path(0);
        JsonNode parts = candidate.path("content").path("parts");
        if (parts.isArray() && parts.size() > 0) {
            return parts.get(0).path("text").asText("");
        }
        return "No text output generated.";
    }

    private ChatReply parseReplyAndCharts(String rawText) {
        Matcher matcher = JSON_FENCE_PATTERN.matcher(rawText);
        List<ChatChartDto> charts = new ArrayList<>();
        String cleanReply = rawText;

        if (matcher.find()) {
            String jsonBlock = matcher.group(1).trim();
            cleanReply = rawText.replace(matcher.group(0), "").trim();
            try {
                JsonNode root = objectMapper.readTree(jsonBlock);
                JsonNode chartsNode = root.has("charts") ? root.get("charts") : root;
                if (chartsNode.isArray()) {
                    for (JsonNode cNode : chartsNode) {
                        String type = cNode.path("type").asText("bar");
                        String title = cNode.path("title").asText("Telemetry Chart");
                        List<ChartSeriesDto> seriesList = new ArrayList<>();

                        JsonNode sArr = cNode.path("series");
                        if (sArr.isArray()) {
                            for (JsonNode sNode : sArr) {
                                String name = sNode.path("name").asText("series");
                                List<ChartPointDto> points = new ArrayList<>();
                                for (JsonNode pNode : sNode.path("points")) {
                                    points.add(new ChartPointDto(pNode.path("x").asText(), pNode.path("y").asDouble()));
                                }
                                seriesList.add(new ChartSeriesDto(name, points));
                            }
                        }
                        charts.add(new ChatChartDto(type, title, seriesList));
                    }
                }
            } catch (Exception ignored) {
                // Return text without breaking on bad JSON
            }
        }

        return new ChatReply(cleanReply, charts);
    }
}
```

---

## 8. Troubleshooting & Best Practices

| Issue | Cause | Fix |
| :--- | :--- | :--- |
| **HTTP 403 Forbidden** | API Key not enabled for Vertex AI or Generative Language API | In Google Cloud Console, enable "Vertex AI API" and "Generative Language API" on your project. |
| **HTTP 429 Resource Exhausted** | Quota / Rate limit reached for free tier | Upgrade GCP billing tier or configure backoff retries in `RestClient`. |
| **No Charts Rendering** | Model forgot to output fenced ```json block | Ensure `temperature` is low ($\le 0.2$) and explicitly reinforce the instruction: `"When plotting trends, YOU MUST append a ```json { charts: [...] } ``` block"`. |
| **CORS Error** | Browser making direct API calls | Always route Gemini calls through your backend (`/api/ai/chat`) so your API keys remain confidential and secure. |
