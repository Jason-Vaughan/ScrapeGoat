# ScrapeGoat: PDF Calendar Extractor
## System Specification v1.0

**Tagline:** PDF in, events parsed out as ICS, CSV, JSON, or MD

**Summary:** ScrapeGoat is an open-source, browser-based tool that extracts calendar events from any PDF schedule. An AI-powered wizard helps users create reusable parsing templates via a guided multiple-choice interview — no technical knowledge required. All file processing happens client-side; user data never touches the server.

---

## 1. Product Overview

### 1.1 What It Does
- Accepts any PDF containing scheduled/recurring date-based data
- Parses events using a user-created or community-shared template (profile)
- Exports structured event data in four formats

### 1.2 What It Is NOT
- Not limited to venue calendars — works with any PDF containing structured date-based data
- Not a chatbot or general-purpose AI tool
- Not a SaaS product — no accounts, no subscriptions, no stored data

### 1.3 Example Use Cases
- Venue event calendars (convention centers, arenas, theaters)
- Conference and trade show schedules
- Academic semester calendars
- Sports league schedules
- Court dockets
- Construction timelines
- Shift rosters and work schedules
- Festival/event lineups

---

## 2. Architecture

### 2.1 Application Type
**Progressive Web App (PWA)**
- Runs in any modern browser (Chrome, Safari, Firefox, Edge)
- Installable to home screen on mobile and desktop
- No app store submission required
- Offline-capable after initial load (except AI wizard)

### 2.2 Hosting
**Static hosting, zero cost:**
- **Frontend:** GitHub Pages or Cloudflare Pages (free tier)
- **Domain:** `scrapegoat.io`, `scrapegoat.app`, or similar
- **AI proxy:** Cloudflare Worker or Google Cloud Function (free tier) — sole purpose is proxying the Gemini API call so the API key is not exposed client-side
- **No backend server, no database, no file storage**

### 2.3 Client-Side Processing
All core functionality runs in the browser:
- **PDF text extraction:** PDF.js (client-side)
- **Event parsing:** JavaScript parsing engine using template/profile rules
- **Export generation:** ICS, CSV, JSON, MD files generated in-browser
- **File download:** Browser-native download — files are never uploaded or stored

### 2.4 Multi-Page PDF Handling

PDF.js extracts text on a per-page basis. The parser must:

1. Extract text from **every page** of the PDF
2. **Concatenate all pages** into a single text block with page break markers (`\n--- PAGE BREAK ---\n`)
3. Parse across page boundaries — an event block that starts on page 3 and continues on page 4 must be treated as one block, not two
4. The page break marker should NOT be treated as a block delimiter
5. Large PDFs (50+ pages) should show a progress indicator during extraction ("Extracting page 12 of 47...")

**Known limitation:** Some PDFs use multi-column layouts (e.g., two calendars side by side). PDF.js extracts these as interleaved text — line from left column, line from right column — which corrupts the data. This is a known PDF.js limitation. The app should detect interleaved text patterns (e.g., alternating unrelated event data) and warn the user:
> "This PDF may have a multi-column layout that we can't reliably parse. Results may be incomplete or mixed up. Consider requesting a single-column version from the source."

This is noted as a future improvement target (see Section 12).

### 2.5 Server-Side (Minimal)
The only server interaction is:
- **Gemini API proxy** — a lightweight serverless function that:
  - Receives extracted text (NOT the PDF file) from the client
  - Forwards it to Google Gemini free API with the locked system prompt
  - Returns structured JSON quiz data to the client
  - Stateless — no logging, no storage, no session tracking

---

## 3. Privacy & Security

### 3.1 Data Privacy
- **PDF files never leave the user's device** — text extraction happens client-side via PDF.js
- **Only extracted text is sent to the AI** — and only during the one-time wizard flow
- **No user accounts, no cookies, no tracking, no analytics**
- **No server-side file storage** — nothing to breach, nothing to leak
- **Export files generated locally** — downloaded directly to the user's device

### 3.2 AI Security
- **No freeform text input to AI** — user interacts only through the app's UI (buttons, checkboxes, radio selects)
- **No chat interface** — the user never communicates with the AI directly
- **Locked system prompt** — AI is constrained to calendar structure analysis only
- **Structured JSON output only** — AI responses must conform to a strict schema; malformed responses are discarded
- **Schema validation** — all AI output is validated against the profile JSON schema before use
- **No prompt injection surface** — user selections are array indices, not text strings

### 3.3 API Abuse Protection

The AI wizard proxy (`/api/analyze`) is the **only attack surface** in the entire application. Everything else runs client-side. If the proxy goes down or is rate-limited, the app still works for anyone with a saved or community template — only new template creation goes offline.

#### Threat Model

| Threat | Impact | Mitigation |
|--------|--------|------------|
| Bot spamming `/api/analyze` | Burns Gemini free tier quota | Rate limiting, Turnstile, payload validation |
| Direct `curl` to Worker endpoint | Bypasses app UI, burns quota | Origin validation, Turnstile token required |
| Playwright/Selenium scripting the UI | Automates wizard to burn quota | Turnstile (detects headless browsers) |
| Replay attacks (same payload repeated) | Wastes API calls | Request deduplication (hash + TTL cache) |
| Oversized payloads | Slow responses, potential abuse | Max payload 100KB, text length cap 30,000 chars |

#### Defense Layer 1: Cloudflare Turnstile (Required)

**Cloudflare Turnstile** is a free, invisible CAPTCHA alternative. No puzzles, no "click all the traffic lights." It runs a background challenge that detects bots, headless browsers, and automation tools.

**Implementation:**
- Turnstile widget loads on the "Create Template" screen (invisible to the user)
- When the user drops a PDF and the app is ready to call the proxy, Turnstile generates a **one-time token**
- App includes the token in the `/api/analyze` request header: `cf-turnstile-response: <token>`
- The Cloudflare Worker **validates the token** with Turnstile's server-side API before forwarding to Gemini
- If token is missing, invalid, or already used → **reject with 403**
- Each token is single-use — cannot be replayed

```
User drops PDF
  → Turnstile runs invisible challenge (background, ~1 second)
  → Turnstile issues one-time token
  → App sends: POST /api/analyze { calendarText, turnstileToken }
  → Worker validates token with Turnstile API
  → If valid: forward to Gemini
  → If invalid: return 403 "Bot detected"
```

**Turnstile setup:**
1. Add site in Cloudflare dashboard → Turnstile → Add Widget
2. Get site key (public, goes in frontend) and secret key (private, goes in Worker env)
3. Frontend: `<script src="https://challenges.cloudflare.com/turnstile/v0/api.js"></script>`
4. Worker env var: `TURNSTILE_SECRET_KEY`

#### Defense Layer 2: Rate Limiting (Required)

**Per-IP rate limiting** enforced in the Cloudflare Worker:

| Limit | Value | Scope |
|-------|-------|-------|
| Per IP per hour | 10 requests | Individual user |
| Per IP per day | 20 requests | Individual user |
| Global per day | 500 requests | All users combined |

**Implementation:** Use Cloudflare Workers KV (free tier: 100,000 reads/day, 1,000 writes/day) to track request counts per IP.

```javascript
// In Worker:
const ip = request.headers.get('cf-connecting-ip');
const hourKey = `rate:${ip}:${currentHour}`;
const dayKey = `rate:${ip}:${currentDay}`;
const globalKey = `rate:global:${currentDay}`;

const hourCount = await KV.get(hourKey) || 0;
const dayCount = await KV.get(dayKey) || 0;
const globalCount = await KV.get(globalKey) || 0;

if (hourCount >= 10) return new Response('Rate limited', { status: 429 });
if (dayCount >= 20) return new Response('Rate limited', { status: 429 });
if (globalCount >= 500) return new Response('Service busy', { status: 503 });
```

**User-facing rate limit message:**
> "The template builder is temporarily busy. Your PDF and any saved templates still work — only new template creation is paused. Try again in an hour, or load an existing template."

#### Defense Layer 3: Origin Validation (Required)

The Worker **only accepts requests from the app's domain:**

```javascript
const allowedOrigins = [
  'https://scrapegoat.pages.dev',
  'https://scrapegoat.io',       // if custom domain
  'http://localhost:3000'          // dev only
];

const origin = request.headers.get('Origin');
if (!allowedOrigins.includes(origin)) {
  return new Response('Forbidden', { status: 403 });
}
```

This blocks direct `curl` or Postman attacks (no `Origin` header = rejected). Combined with Turnstile, even spoofed `Origin` headers won't work because the Turnstile token validation will fail.

#### Defense Layer 4: Payload Validation (Required)

The Worker validates every request before forwarding to Gemini:

```javascript
// Reject if:
if (!body.calendarText) → 400 "Missing calendar text"
if (body.calendarText.length < 50) → 400 "Text too short to be a calendar"
if (body.calendarText.length > 30000) → 400 "Text too long"
if (!body.action || !['initial_analysis', 'correction'].includes(body.action)) → 400 "Invalid action"
if (!body.turnstileToken) → 403 "Missing verification"
```

#### Defense Layer 5: Request Deduplication (Recommended)

Prevent replay attacks — if someone sends the exact same payload repeatedly:

```javascript
const payloadHash = await sha256(body.calendarText);
const cacheKey = `dedup:${ip}:${payloadHash}`;
const cached = await KV.get(cacheKey);

if (cached) {
  // Return the cached Gemini response instead of making a new API call
  return new Response(cached, { headers: { 'Content-Type': 'application/json' } });
}

// After successful Gemini response:
await KV.put(cacheKey, geminiResponse, { expirationTtl: 3600 }); // cache 1 hour
```

This has a bonus: if a user drops the same PDF twice (accidentally or intentionally), they get an instant response from cache instead of waiting for Gemini. Saves quota AND improves UX.

#### Defense Layer 6: Alerting (Recommended)

Set up notifications when abuse is detected:

- **Cloudflare Workers analytics** (free) — monitor request volume, error rates, geographic distribution
- **Email alert** when global daily cap hits 80% (400/500 requests)
- **Webhook to Discord/Slack** if a single IP exceeds rate limits repeatedly (potential targeted attack)

This lets you respond to abuse before it burns your quota — adjust rate limits, block specific IPs, or temporarily disable the wizard if needed.

#### Graceful Degradation

When **any** protection triggers, the app still works:

| State | What Works | What Doesn't |
|-------|-----------|--------------|
| Rate limited (user) | Parsing, export, saved templates, community templates | AI wizard for that user |
| Rate limited (global) | Parsing, export, saved templates, community templates | AI wizard for everyone |
| Gemini API down | Parsing, export, saved templates, community templates | AI wizard |
| Turnstile fails | Parsing, export, saved templates, community templates | AI wizard |

The app should **always show a clear message** explaining what happened and what still works:
> "The template builder is temporarily unavailable. You can still use saved templates, browse community templates, or export your events."

### 3.4 Privacy Statement (User-Facing)
> "Your files never leave your device. ScrapeGoat runs entirely in your browser. The only external call is to Google's AI during initial template setup — and even that only sends extracted text, not your file."

---

## 4. AI Wizard — Template Builder

### 4.1 AI Provider
**Google Gemini — Free API Tier**
- Sufficient for infrequent, bursty usage (one call per venue/template creation)
- API key managed server-side via proxy function (user never sees or needs a key)
- No cost to users or project maintainer at expected usage levels

### 4.2 AI Role
The AI is a **hidden implementation detail**, not a user-facing feature. Users see a "Template Builder" wizard. The AI:
- Analyzes extracted PDF text
- Generates multiple-choice quiz options based on what it finds in the text
- Builds a profile JSON config from the user's quiz answers
- Is never exposed as a chatbot or conversational agent

### 4.3 System Prompt (Exact)

The Gemini API call uses this system prompt (or equivalent). It is hardcoded in the serverless proxy — never sent from the client, never user-modifiable:

```
You are a PDF calendar structure analyzer for the ScrapeGoat application.

YOUR SOLE PURPOSE: Analyze extracted PDF text containing calendar or schedule data and return structured JSON that identifies the document's patterns.

STRICT RULES:
1. You ONLY analyze calendar/schedule text and output structured JSON.
2. You NEVER answer questions, have conversations, or respond to any request unrelated to calendar structure analysis.
3. You ONLY generate options derived from the actual text provided — never hallucinate or invent data not present in the input.
4. Your output MUST conform exactly to the response schema specified in each request.
5. If the input text does not appear to contain calendar or schedule data, return: {"error": "unrecognized_format", "message": "The provided text does not appear to contain calendar or schedule data."}
6. Every option you generate must include the exact substring from the source text that supports it, in a "source" field.
7. Do not include explanations, commentary, or conversational text in your output. JSON only.
```

### 4.4 Gemini API Request/Response Contracts

**Initial Analysis Request** (Step 1 — sent when user drops PDF):

```json
{
  "systemPrompt": "[system prompt above]",
  "userPrompt": "Analyze this calendar text and return quiz options.",
  "calendarText": "[extracted PDF text — max 30,000 chars, truncated if longer]",
  "responseSchema": {
    "documentStructure": {
      "options": [
        {"label": "string", "value": "block|table|list|other", "source": "string"}
      ]
    },
    "dateFormats": {
      "detected": [
        {"label": "string", "pattern": "string", "examples": ["string"], "source": "string"}
      ]
    },
    "locations": {
      "candidates": [
        {"name": "string", "confidence": "high|medium|low", "source": "string"}
      ]
    },
    "statusCodes": {
      "candidates": [
        {"name": "string", "confidence": "high|medium|low", "source": "string"}
      ]
    },
    "eventNames": {
      "candidates": [
        {"name": "string", "source": "string"}
      ]
    },
    "estimatedEventCount": "number",
    "detectedTimezone": "string|null",
    "notes": "string|null"
  }
}
```

**Correction Request** (Step 3 — sent when user flags errors):

```json
{
  "systemPrompt": "[system prompt above]",
  "userPrompt": "The user flagged these fields as incorrect. Re-analyze the raw text for these events and provide alternative options.",
  "calendarText": "[original extracted text]",
  "currentProfile": "[the profile JSON built so far]",
  "corrections": [
    {
      "eventIndex": 2,
      "rawTextBlock": "[the raw text for this specific event]",
      "flaggedFields": ["dates", "location"],
      "currentValues": {"dates": "Mar 12-15", "location": "Hall A"}
    }
  ],
  "responseSchema": {
    "alternatives": [
      {
        "eventIndex": 2,
        "field": "dates",
        "options": [
          {"label": "string", "value": "string", "source": "string"}
        ]
      }
    ]
  }
}
```

**Error Response** (when text is not parseable):

```json
{
  "error": "unrecognized_format",
  "message": "The provided text does not appear to contain calendar or schedule data."
}
```

### 4.5 System Prompt Constraints Summary
- ONLY analyze calendar/schedule text and output structured JSON
- NEVER answer questions, have conversations, or respond to unrelated requests
- ONLY generate options derived from the actual PDF text — no hallucinated choices
- Output MUST conform to the profile JSON schema
- If input is not parseable calendar text, return a structured error object

### 4.4 Wizard Flow

**The AI interviews the user — not the other way around.**

The user never types anything. Every interaction is a constrained choice: buttons, checkboxes, or radio selects. The AI generates the options, the user picks.

#### Step 1: PDF Drop
- User clicks "Create Template" and drops a PDF
- App extracts text client-side via PDF.js
- Extracted text is sent to Gemini via the proxy

#### Step 2: Structure Quiz (Fixed Sequence)

The quiz follows a **fixed question sequence** — the AI cannot add, skip, or reorder steps. Every screen has a "None of these" / "Skip" option.

**Round 1 — Document Structure**
> "How is this calendar organized?"
> - ○ One event per block with dates
> - ○ Table/grid layout
> - ○ List with one event per line
> - ○ Other / Not sure

**Round 2 — Date Format**
> "Which of these matches the dates in your calendar?"
> - ○ MM/DD/YYYY (US: month first)
> - ○ DD/MM/YYYY (International: day first)
> - ○ Month DD, YYYY (e.g., "March 5, 2026")
> - ○ YYYY-MM-DD (ISO format)
> - ○ (AI-detected examples from the text)
> - ○ None of these

This round is critical for resolving **date ambiguity**. A date like `1/2/2026` is January 2nd in MM/DD (US) but February 1st in DD/MM (international). The user's format selection determines how ALL dates in the PDF are interpreted. The AI should highlight any ambiguous dates it found (where day ≤ 12, making both interpretations valid) and show them as examples to help the user pick correctly.

**Round 2b — Timezone**
> "What timezone are these events in?"
> - ○ (AI-detected timezone if found in PDF text, e.g., "Eastern Time" → America/New_York)
> - ○ (User's browser timezone, auto-detected)
> - ○ (Common timezone list: Pacific, Mountain, Central, Eastern, UTC, GMT, etc.)
> - ○ Search: [ type to search IANA timezones ]

The timezone selection determines how dates are written in exports (ICS VTIMEZONE, JSON metadata). If the PDF contains timezone hints (e.g., "All times EST", "Pacific Time"), the AI detects and pre-selects it.

**Round 3 — Timezone**
> "What timezone are these events in?"
> - ○ Eastern Time (America/New_York) ← *detected from "EST" in your PDF*
> - ○ Pacific Time (America/Los_Angeles)
> - ○ Central Time (America/Chicago)
> - ○ Mountain Time (America/Denver)
> - ○ UTC / GMT
> - ○ [ Search timezones... ]

**Round 4 — Locations/Facilities**
> "We found these possible venue or room names. Check the real ones:"
> - ☐ (AI-detected candidates from text)
> - ☐ (More candidates)
> - ☐ None of these are locations

**Round 5 — Status Codes**
> "Which of these are event statuses?"
> - ☐ (AI-detected candidates: Confirmed, Tentative, Hold, etc.)
> - ☐ None of these are statuses

**Round 6 — Event Names/Titles**
> "Which of these look like event names?"
> - ☐ (AI-detected candidates)

**Round 7 — Review & Test**
- App runs a test parse using the generated profile
- Results displayed in a table
- Each event row has a ✅ (correct) or ❌ (wrong) button

#### Step 3: Correction Loop

For events marked ❌:

**Sub-step A — What's wrong? (Checkbox)**
> "Event 2 has problems. Which fields are wrong?"
> - ☐ Event name
> - ☐ Dates
> - ☐ Location/Facility
> - ☐ Status

**Sub-step B — AI offers alternatives (Radio select)**
> "The dates for 'Widget Expo' parsed as Mar 12-15. Looking at the raw text, did you mean:"
> - ○ Mar 12 – Mar 15
> - ○ Mar 1 – Mar 25
> - ○ Mar 12 – May 15
> - ○ None of these (skip — I'll fix in review)

The AI generates plausible alternatives by re-analyzing the raw text block for that event.

**Correction rounds:** Maximum 2-3 loops. If still not resolved, escalate to failure path.

#### Step 4: Save Template
- Profile saved as a JSON file (downloadable) and/or to browser localStorage
- Template is reusable — next time the user imports from the same source, they select the saved template and skip the wizard entirely

### 4.5 Failure Path — Graceful Escalation

**Tier 1: Loop**
Quiz correction rounds continue (up to 2-3 attempts).

**Tier 2: Give up gracefully**
> "We weren't able to parse this calendar format. Would you like to report this so we can improve support?"
>
> [ Report Issue ] [ Cancel ]

**Tier 3: One-button bug report**
User clicks "Report Issue" and the app:
- Pre-fills a GitHub Issue via the GitHub API
- Includes: quiz answers given, which step failed, what the AI tried
- **Permission step before file attachment:**
  > "This will upload your calendar file and parsing results to GitHub. The file will be publicly visible."
  > - ○ Submit with file attached
  > - ○ Submit without file (description only)
  > - ○ Cancel
- User adds optional note (freeform — this goes to GitHub, not the AI) and submits

This gives maintainers the exact file, the failure point, and what was attempted — not a vague "it doesn't work."

---

## 5. Template / Profile System

### 5.1 Profile JSON Schema

Profiles are stored as **JSON files** conforming to this strict schema. The AI wizard generates this; users can also hand-edit for advanced use.

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "required": ["name", "version", "structure", "dateFormats", "fields"],
  "properties": {
    "name": {
      "type": "string",
      "description": "Human-readable template name, e.g. 'Javits Center Calendar'"
    },
    "version": {
      "type": "string",
      "description": "Template schema version, e.g. '1.0'"
    },
    "author": {
      "type": "string",
      "description": "Who created this template"
    },
    "source": {
      "type": "string",
      "description": "Where the PDF comes from, e.g. 'Javits Center website'"
    },
    "created": {
      "type": "string",
      "format": "date",
      "description": "ISO date when template was created"
    },
    "lastTested": {
      "type": "string",
      "format": "date",
      "description": "ISO date when template was last verified against a PDF"
    },
    "eventsTestedCount": {
      "type": "integer",
      "description": "Number of events successfully parsed in last test"
    },
    "structure": {
      "type": "object",
      "required": ["type"],
      "properties": {
        "type": {
          "type": "string",
          "enum": ["block", "table", "list"],
          "description": "How events are organized in the PDF text"
        },
        "blockDelimiter": {
          "type": "string",
          "description": "Regex pattern that marks the start of a new event block (for 'block' type)"
        },
        "tableHeaders": {
          "type": "array",
          "items": {"type": "string"},
          "description": "Expected column headers (for 'table' type)"
        },
        "linePattern": {
          "type": "string",
          "description": "Regex pattern matching a single event line (for 'list' type)"
        }
      }
    },
    "dateFormats": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["pattern", "fields"],
        "properties": {
          "pattern": {
            "type": "string",
            "description": "Regex with named capture groups for date extraction, e.g. '(?<month>\\d{1,2})/(?<day>\\d{1,2})/(?<year>\\d{4})'"
          },
          "format": {
            "type": "string",
            "description": "Human-readable format label, e.g. 'MM/DD/YYYY'"
          },
          "fields": {
            "type": "array",
            "items": {
              "type": "string",
              "enum": ["startDate", "endDate", "moveInDate", "moveOutDate", "singleDate"]
            },
            "description": "Which event date field(s) this pattern extracts"
          }
        }
      },
      "description": "One or more date patterns found in this PDF format. Multiple patterns are supported for PDFs that mix formats (e.g., 'March 5, 2026' and '3/5/26' in the same document). The parser tries each pattern in order and uses the first match. The AI wizard should detect mixed formats and generate multiple patterns automatically."
    },
    "fields": {
      "type": "object",
      "description": "How to extract each event field from the text",
      "properties": {
        "eventName": {
          "type": "object",
          "properties": {
            "pattern": {"type": "string", "description": "Regex to extract event name"},
            "position": {"type": "string", "enum": ["first_line", "after_date", "before_date", "regex"], "description": "Where the name appears relative to other fields"}
          }
        },
        "location": {
          "type": "object",
          "properties": {
            "knownValues": {
              "type": "array",
              "items": {"type": "string"},
              "description": "List of known location/facility names to match against"
            },
            "pattern": {"type": "string", "description": "Regex to extract location if not in known values list"}
          }
        },
        "status": {
          "type": "object",
          "properties": {
            "knownValues": {
              "type": "array",
              "items": {"type": "string"},
              "description": "List of known status codes, e.g. ['Confirmed', 'Tentative', 'Hold']"
            },
            "pattern": {"type": "string", "description": "Regex to extract status if not in known values list"}
          }
        }
      }
    },
    "timezone": {
      "type": "string",
      "description": "IANA timezone for dates in this calendar, e.g. 'America/New_York'. Null if unknown — user will be prompted."
    },
    "customFields": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "name": {"type": "string"},
          "pattern": {"type": "string"},
          "description": {"type": "string"}
        }
      },
      "description": "Additional fields specific to this calendar format (e.g., 'attendance', 'organizer', 'booth count')"
    }
  }
}
```

**Example profile** (for a hypothetical convention center):

```json
{
  "name": "Example Convention Center Calendar",
  "version": "1.0",
  "author": "community",
  "source": "Example Convention Center website",
  "created": "2026-04-01",
  "lastTested": "2026-04-01",
  "eventsTestedCount": 35,
  "structure": {
    "type": "block",
    "blockDelimiter": "^\\d{1,2}/\\d{1,2}/\\d{4}"
  },
  "dateFormats": [
    {
      "pattern": "(?<month>\\d{1,2})/(?<day>\\d{1,2})/(?<year>\\d{4})",
      "format": "MM/DD/YYYY",
      "fields": ["startDate", "endDate"]
    }
  ],
  "fields": {
    "eventName": {
      "position": "first_line"
    },
    "location": {
      "knownValues": ["Hall A", "Hall B", "Hall C", "Ballroom", "Meeting Room 1", "Meeting Room 2"]
    },
    "status": {
      "knownValues": ["Confirmed", "Tentative", "Hold", "Canceled"]
    }
  },
  "timezone": "America/New_York",
  "customFields": []
}
```

### 5.2 Event Data Model

The internal event object produced by the parser. All exports serialize from this model.

```typescript
interface ParsedEvent {
  id: string;                  // SHA256 hash of (name + startDate + location) for stable identity
  name: string;                // Event name/title
  startDate: string | null;    // ISO 8601 date (YYYY-MM-DD) — first day of the event
  endDate: string | null;      // ISO 8601 date — last day of the event
  moveInDate: string | null;   // ISO 8601 date — setup/move-in begins
  moveOutDate: string | null;  // ISO 8601 date — teardown/move-out ends
  location: string | null;     // Facility/room name
  status: string | null;       // Confirmed, Tentative, Hold, etc.
  customFields: Record<string, string>;  // Any additional fields from the template
  rawText: string;             // Original text block from the PDF (for debugging/correction)
  warnings: ParseWarning[];    // Any issues detected during parsing
  isSelected: boolean;         // User selection state for export (default: true)
}

interface ParseWarning {
  field: string;               // Which field has the issue
  message: string;             // Human-readable description
  rawValue: string;            // The problematic value from the PDF
  suggestion: string | null;   // AI or rule-based suggested fix
}
```

### 5.3 Parser Engine Algorithm

The parser engine takes extracted PDF text + a template profile and produces an array of `ParsedEvent` objects. The algorithm varies by structure type:

#### Block-Based Parsing (`structure.type: "block"`)

```
1. Split text into blocks using `structure.blockDelimiter` regex
   - Each match starts a new block
   - Block ends at the next match or end of text

2. For each block:
   a. Extract EVENT NAME using `fields.eventName`:
      - If `position: "first_line"` → first non-empty line of the block
      - If `position: "after_date"` → first line after a date match
      - If `position: "regex"` → apply `fields.eventName.pattern`

   b. Extract DATES by applying each `dateFormats[].pattern` regex:
      - Named capture groups (`month`, `day`, `year`) build date values
      - Multiple date patterns may match (e.g., one for start, one for end)
      - Map matches to fields per `dateFormats[].fields` array
      - If only one date found and fields expects start+end, use same date for both

   c. Extract LOCATION:
      - If `fields.location.knownValues` exists → scan block for any known value (case-insensitive)
      - If `fields.location.pattern` exists → apply regex
      - First match wins

   d. Extract STATUS:
      - Same logic as location — knownValues first, then pattern fallback

   e. Extract CUSTOM FIELDS:
      - For each `customFields[]` entry, apply its regex pattern

   f. Generate WARNINGS:
      - Missing required fields (name, at least one date)
      - Date parsing ambiguity (e.g., "1/2/2026" — is it Jan 2 or Feb 1?)
      - Unrecognized text in block that didn't match any field

   g. Generate ID: SHA256 hash of (name + startDate + location)

3. Return array of ParsedEvent objects
```

#### Table-Based Parsing (`structure.type: "table"`)

```
1. Detect header row by matching `structure.tableHeaders` against text lines
2. Determine column positions from header alignment (character offsets or delimiter positions)
3. For each subsequent line:
   a. Split into columns using detected positions/delimiters
   b. Map columns to fields based on header-to-field mapping
   c. Parse dates using `dateFormats` patterns
   d. Match location/status against known values
   e. Generate ParsedEvent
```

#### List-Based Parsing (`structure.type: "list"`)

```
1. Apply `structure.linePattern` regex to each line of text
2. Named capture groups in the pattern map directly to event fields
3. Lines that don't match the pattern are skipped (or flagged as warnings)
4. Generate ParsedEvent per matching line
```

#### Post-Processing (all types)

```
1. Deduplicate events by ID (same hash = same event)
2. Sort events by startDate ascending
3. Validate date logic:
   - moveInDate ≤ startDate ≤ endDate ≤ moveOutDate
   - Flag violations as warnings
4. Set isSelected = true for all events (user deselects manually)
```

### 5.4 Template Lifecycle
1. **Create** — via AI wizard (or manual JSON editing for advanced users)
2. **Test** — parse a sample PDF, review results, correct as needed
3. **Save locally** — download as `.json` file or store in browser localStorage
4. **Reuse** — select a saved template on subsequent imports from the same source
5. **Share** — optionally submit to the community template library

### 5.3 Community Template Library
- Maintained in the open-source repo as a folder of profile JSON files
- Users can browse and select existing templates: "Someone already did the Javits Center, I'll use theirs"
- New templates added via GitHub pull requests (community contributions)
- App fetches an index of available public templates on load
- Templates include metadata: venue/source name, author, date created, last tested

#### `templates/index.json` Schema

```json
{
  "version": "1.0",
  "lastUpdated": "2026-04-01",
  "templates": [
    {
      "id": "javits-center-calendar",
      "name": "Javits Center Event Calendar",
      "file": "javits-center-calendar.json",
      "source": "Jacob K. Javits Convention Center, New York",
      "author": "contributor-username",
      "created": "2026-04-01",
      "lastTested": "2026-04-01",
      "eventsTestedCount": 42,
      "tags": ["convention-center", "venue", "new-york"],
      "description": "Monthly event calendar from the Javits Center website"
    }
  ]
}
```

**Index rules:**
- `id` matches the filename (without `.json` extension)
- `file` is the relative path within `templates/` directory
- `tags` are freeform strings for search/filter in the app
- Contributors must update `index.json` when adding a new template (enforced in PR template checklist)
- App fetches this index from the repo's raw GitHub URL (cached client-side)

#### "Share to Community" Flow

No OAuth required. The app does NOT create PRs automatically. Instead:

1. User clicks "Share to Community" in the app
2. App generates the template JSON and copies it to clipboard
3. App displays instructions:
   > "Your template has been copied to clipboard. To share it with the community:"
   > 1. Go to [github.com/Jason-Vaughan/ScrapeGoat/issues/new](link)
   > 2. Select "Template Submission"
   > 3. Paste your template JSON
   > 4. A maintainer will review and add it to the library
4. Link opens a pre-filled GitHub Issue using URL parameters (`?template=template_request&title=[Template]+...`)

This avoids GitHub OAuth complexity entirely. Maintainers review submissions and merge via normal PR workflow.

### 5.4 Template Storage Options (User's Choice)
| Method | Persistence | Portability |
|--------|-------------|-------------|
| Browser localStorage | Survives sessions, device-specific | Low |
| Downloaded JSON file | Permanent, user-managed | High |
| Community library | Permanent, shared | Universal |

---

## 6. Export Formats

### 6.1 ICS (iCalendar)
- **Purpose:** Import events directly into calendar apps (Google Calendar, Apple Calendar, Outlook)
- **Spec:** RFC 5545 compliant
- **Features:**
  - VTIMEZONE support (user-selected or auto-detected timezone)
  - VALUE=DATE for all-day events
  - Proper DTEND handling (exclusive end date per spec)
  - Line folding at 75 octets, CRLF line endings
  - Multi-phase support where applicable (e.g., setup/event/teardown as separate entries)

### 6.2 CSV (Comma-Separated Values)
- **Purpose:** Import into spreadsheets (Google Sheets, Excel, Numbers)
- **Features:**
  - Header row with field names
  - Proper escaping of commas and quotes
  - User-selectable columns (which date fields to include, etc.)
  - Universal compatibility — every spreadsheet app imports CSV

### 6.3 JSON
- **Purpose:** Developer/API use, data interchange, programmatic consumption
- **Features:**
  - Clean structured format matching the internal event schema
  - Nested data where appropriate (no flattening)
  - Machine-readable, well-defined schema
  - Usable by other tools, scripts, or automation pipelines

### 6.4 MD (Markdown)
- **Purpose:** Human-readable sharing (email, Slack, Notion, GitHub, documentation)
- **Features:**
  - Formatted table or structured list of events
  - Renders natively on GitHub, Notion, Slack, and most platforms
  - Readable as plain text even without rendering
  - Copy-paste friendly

### 6.5 Export Format Details

#### ICS Output Example
```
BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//ScrapeGoat//PDF Calendar Extractor//EN
CALSCALE:GREGORIAN
METHOD:PUBLISH
X-WR-CALNAME:Javits Center Events
X-WR-TIMEZONE:America/New_York
BEGIN:VTIMEZONE
TZID:America/New_York
BEGIN:STANDARD
DTSTART:19701101T020000
RRULE:FREQ=YEARLY;BYMONTH=11;BYDAY=1SU
TZOFFSETFROM:-0400
TZOFFSETTO:-0500
TZNAME:EST
END:STANDARD
BEGIN:DAYLIGHT
DTSTART:19700308T020000
RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=2SU
TZOFFSETFROM:-0500
TZOFFSETTO:-0400
TZNAME:EDT
END:DAYLIGHT
END:VTIMEZONE
BEGIN:VEVENT
DTSTART;VALUE=DATE:20260315
DTEND;VALUE=DATE:20260319
SUMMARY:ACME Trade Show (Event)
DESCRIPTION:Location: Hall A\nStatus: Confirmed\n\nGenerated by ScrapeGoat
LOCATION:Hall A
UID:sha256-abc123@scrapegoat
STATUS:CONFIRMED
END:VEVENT
END:VCALENDAR
```

**ICS rules:**
- DTEND is exclusive (per RFC 5545) — add 1 day to the last date
- VALUE=DATE for all-day events (no time component)
- UID is the event's SHA256 hash + `@scrapegoat`
- Multi-phase: generates separate VEVENTs with " (Move-In)", " (Event)", " (Move-Out)" suffixes
- Line folding at 75 octets per RFC 5545
- CRLF line endings (`\r\n`)
- STATUS maps: Confirmed→CONFIRMED, Tentative→TENTATIVE, Canceled→CANCELLED

#### CSV Output Example
```csv
"Event Name","Start Date","End Date","Location","Status"
"ACME Trade Show","2026-03-15","2026-03-18","Hall A","Confirmed"
"Widget Expo","2026-03-22","2026-03-25","Hall B","Confirmed"
```

**CSV rules:**
- Header row always present
- All fields quoted (handles commas/quotes in event names)
- Dates in ISO 8601 (YYYY-MM-DD)
- Columns determined by user's column toggle selection
- UTF-8 encoding with BOM (for Excel compatibility)

#### JSON Output Example
```json
{
  "generator": "ScrapeGoat v1.0",
  "exported": "2026-04-01T12:00:00Z",
  "template": "Javits Center Calendar",
  "timezone": "America/New_York",
  "eventCount": 43,
  "events": [
    {
      "id": "sha256-abc123",
      "name": "ACME Trade Show",
      "startDate": "2026-03-15",
      "endDate": "2026-03-18",
      "moveInDate": "2026-03-13",
      "moveOutDate": "2026-03-20",
      "location": "Hall A",
      "status": "Confirmed",
      "customFields": {},
      "warnings": []
    }
  ]
}
```

**JSON rules:**
- Dates in ISO 8601 (YYYY-MM-DD)
- Null fields included as `null` (not omitted)
- Pretty-printed by default (2-space indent)
- Optional: include `rawText` per event for debugging

#### MD Output Example
```markdown
# Javits Center Events
*Exported via ScrapeGoat on 2026-04-01*

| # | Event | Start | End | Location | Status |
|---|-------|-------|-----|----------|--------|
| 1 | ACME Trade Show | Mar 15 | Mar 18 | Hall A | Confirmed |
| 2 | Widget Expo | Mar 22 | Mar 25 | Hall B | Confirmed |

---
*43 events · Generated by [ScrapeGoat](https://scrapegoat.io)*
```

**MD rules:**
- GitHub-flavored Markdown (GFM) table format
- Human-readable dates (Mon DD format)
- Header with template name and export date
- Footer with event count and ScrapeGoat attribution link
- Optional: list format instead of table (user toggle)

### 6.6 Export Behavior
- All exports are **generated client-side** in the browser
- Files are **downloaded directly** to the user's device
- **No server involvement** — export files are never uploaded or stored
- User selects which events and which fields to include before export
- File naming convention: `scrapegoat-export-YYYY-MM-DD.{ics|csv|json|md}`

---

## 7. User Interface

### 7.1 Design Principles
- **One task per screen** — never overwhelm the user
- **No technical jargon** — "template" not "profile," "schedule" not "schema"
- **Progressive disclosure** — advanced options hidden unless needed
- **Mobile-first responsive** — works on phone, tablet, desktop
- **Accessible** — keyboard navigable, screen reader friendly, sufficient contrast
- **Dark/light mode** — respect system preference, toggle available
- **Branding** — ScrapeGoat pirate goat logo in header, consistent color palette

### 7.2 Color Palette & Typography
- **Primary:** Deep red (#B91C1C) — matches logo
- **Secondary:** Navy/dark teal (#1E3A5F) — matches logo jacket
- **Accent:** Gold (#D4A017) — matches logo horns/buckle
- **Background light:** #FAFAFA / **Background dark:** #1A1A2E
- **Text light:** #1F2937 / **Text dark:** #E5E7EB
- **Success:** #10B981 (green checkmarks)
- **Error:** #EF4444 (red X marks)
- **Font:** System font stack (Inter or similar clean sans-serif for headings)

### 7.3 Screen-by-Screen Wireframes

**Screenshots:** Will be added after UI implementation. The wireframes below define the exact layout and content for each screen.

---

#### Screen 1: Landing Page

```
┌──────────────────────────────────────────────────────────┐
│                    [ScrapeGoat Logo]                      │
│                                                          │
│              PDF Calendar Extractor                       │
│                                                          │
│      "Turn any PDF schedule into calendar events"         │
│                                                          │
│    ┌──────────────────────────────────────────────┐      │
│    │                                              │      │
│    │         Drop your PDF here                   │      │
│    │              or                              │      │
│    │         [ Choose File ]                      │      │
│    │                                              │      │
│    │    Accepts: .pdf (max 50MB)                  │      │
│    └──────────────────────────────────────────────┘      │
│                                                          │
│    ── or ──────────────────────────────────────────       │
│                                                          │
│    [ Browse Community Templates ]                        │
│    [ Load Saved Template ]                               │
│                                                          │
│    ─────────────────────────────────────────────────     │
│    How it works:                                         │
│    1. Drop a PDF  2. Build a template  3. Export events  │
│                                                          │
│    "Your files never leave your device."                 │
│    [ Learn more about privacy ]                          │
│                                                          │
│    ─────────────────────────────────────────────────     │
│    Open source · GitHub · Made by Jason Vaughan          │
└──────────────────────────────────────────────────────────┘
```

**Behavior:**
- Drag-and-drop zone accepts `.pdf` files only
- Drop zone highlights on drag-over (dashed border → solid, background color change)
- File size limit: 50MB (configurable)
- On drop: PDF.js extracts text client-side, progress spinner shown
- If text extraction fails or PDF is image-only: show error with OCR note ("This PDF appears to be a scanned image. ScrapeGoat currently supports text-based PDFs only.")
- After text extracted: navigate to Screen 2

---

#### Screen 2: Template Selection

```
┌──────────────────────────────────────────────────────────┐
│  [Logo]  ScrapeGoat           [Back to start]            │
│  ─────────────────────────────────────────────────       │
│                                                          │
│  ✓ PDF loaded: "venue-calendar-2026.pdf"                 │
│    (247 lines of text extracted)                         │
│                                                          │
│  How would you like to parse this?                       │
│                                                          │
│  ┌────────────────────────────────────────────────┐      │
│  │  📄 Use a saved template                       │      │
│  │  You have 2 saved templates                    │      │
│  │  ─────────────────────────────────             │      │
│  │  ○ Javits Center Calendar (last used 3/15)     │      │
│  │  ○ County Court Schedule (last used 2/28)      │      │
│  │                         [ Use Selected ]       │      │
│  └────────────────────────────────────────────────┘      │
│                                                          │
│  ┌────────────────────────────────────────────────┐      │
│  │  🌐 Browse community templates                 │      │
│  │  134 templates shared by the community         │      │
│  │  [ Search templates... ]                       │      │
│  │  ─────────────────────────────────             │      │
│  │  Popular:                                      │      │
│  │  • McCormick Place Calendar (42 events tested) │      │
│  │  • Moscone Center Schedule (62 events tested)  │      │
│  │  • Excel London Events (28 events tested)      │      │
│  │                    [ Browse All ] [ Use ]       │      │
│  └────────────────────────────────────────────────┘      │
│                                                          │
│  ┌────────────────────────────────────────────────┐      │
│  │  ✨ Create a new template                      │      │
│  │  Our AI assistant will help you build one      │      │
│  │  in about 2 minutes.                           │      │
│  │                     [ Start Template Wizard ]   │      │
│  └────────────────────────────────────────────────┘      │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

**Behavior:**
- Saved templates loaded from browser localStorage
- Community templates fetched from `templates/index.json` in the repo (cached)
- Community search filters by name, source, and tags
- Selecting a template → skip to Screen 4 (parsed results)
- "Start Template Wizard" → Screen 3a

---

#### Screen 3a–3e: AI Wizard (one screen per quiz round)

Each wizard screen follows this consistent layout:

```
┌──────────────────────────────────────────────────────────┐
│  [Logo]  ScrapeGoat           Step 1 of 6  [Cancel]      │
│  ─────────────────────────────────────────────────       │
│  ┌──────────────────────────────────────────────┐        │
│  │  ████████░░░░░░░░░░░░░░░░░░  20%             │        │
│  └──────────────────────────────────────────────┘        │
│                                                          │
│  How is this calendar organized?                         │
│                                                          │
│  We analyzed your PDF and found these patterns:          │
│                                                          │
│  ○  Events in separate blocks, each with dates           │
│     Example from your PDF:                               │
│     ┌─────────────────────────────────────┐              │
│     │ "ACME Trade Show                    │              │
│     │  3/15/2026 - 3/18/2026              │              │
│     │  Hall A - Confirmed"                │              │
│     └─────────────────────────────────────┘              │
│                                                          │
│  ○  Table or grid with rows and columns                  │
│     Example from your PDF:                               │
│     ┌─────────────────────────────────────┐              │
│     │ "Event | Start | End | Room | ..."  │              │
│     └─────────────────────────────────────┘              │
│                                                          │
│  ○  Simple list, one event per line                      │
│                                                          │
│  ○  I'm not sure / None of these                         │
│                                                          │
│                        [ Skip ]  [ Next → ]              │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

**Key features across all wizard screens:**
- Progress bar showing current step (1 of 6, 2 of 6, etc.)
- Each option shows real examples extracted from the user's PDF (via AI analysis)
- Examples are shown in a subtle code-block style box so users can see what the AI found
- Radio buttons (○) for single-select questions, checkboxes (☐) for multi-select
- "Skip" always available — skipped fields can use defaults or be set later
- "Cancel" returns to Screen 2 with confirmation ("Your progress will be lost")
- Back button available after Step 1 to revisit previous answers

**Wizard Steps:**

| Step | Question | Input Type | Options Source |
|------|----------|-----------|---------------|
| 1/6 | Document structure | Radio (single) | AI-detected with examples |
| 2/6 | Date format + ambiguity | Radio (single) | AI-detected patterns + ambiguous date examples |
| 3/6 | Timezone | Radio (single) + search | AI-detected from PDF text + browser timezone + common list |
| 4/6 | Locations/rooms | Checkbox (multi) | AI-detected candidates |
| 5/6 | Status codes | Checkbox (multi) | AI-detected candidates |
| 6/6 | Event name position | Radio (single) | AI-detected with examples |

---

#### Screen 3f: Wizard Review & Test

```
┌──────────────────────────────────────────────────────────┐
│  [Logo]  ScrapeGoat           Review  [Cancel]           │
│  ─────────────────────────────────────────────────       │
│  ┌──────────────────────────────────────────────┐        │
│  │  ████████████████████████████████████  100%   │        │
│  └──────────────────────────────────────────────┘        │
│                                                          │
│  We parsed 47 events. Review the results:                │
│                                                          │
│  ┌────┬──────────────────┬────────────┬────────┬───┐     │
│  │    │ Event Name       │ Dates      │Location│ ✓ │     │
│  ├────┼──────────────────┼────────────┼────────┼───┤     │
│  │  1 │ ACME Trade Show  │ 3/15-3/18  │ Hall A │ ✅│     │
│  │  2 │ Widget Expo      │ 3/22-3/25  │ Hall B │ ✅│     │
│  │  3 │ Tech Summit      │ 4/1 -4/3   │ Hall A │ ❌│     │
│  │  4 │ Garden Show      │ 4/10-4/14  │ Ballrm │ ✅│     │
│  │ .. │ ...              │ ...        │ ...    │   │     │
│  │ 47 │ Winter Gala      │ 12/5-12/7  │ Hall C │ ✅│     │
│  └────┴──────────────────┴────────────┴────────┴───┘     │
│                                                          │
│  45 correct · 2 flagged                                  │
│                                                          │
│         [ Fix Flagged Events ]  [ Looks Good → ]         │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

**Behavior:**
- Each row has ✅ (default) and ❌ buttons
- Clicking ❌ flags the event for correction
- "Fix Flagged Events" → Screen 3g (correction flow)
- "Looks Good" → Screen 3h (save template)
- If ALL events are ✅ → skip straight to save

---

#### Screen 3g: Correction Flow (per flagged event)

```
┌──────────────────────────────────────────────────────────┐
│  [Logo]  ScrapeGoat           Fixing 1 of 2  [Skip]     │
│  ─────────────────────────────────────────────────       │
│                                                          │
│  Event: "Tech Summit"                                    │
│                                                          │
│  What's wrong with this event?                           │
│  ☐ Event name                                            │
│  ☐ Dates                                                 │
│  ☐ Location                                              │
│  ☐ Status                                                │
│                           [ Next → ]                     │
│  ─────────────────────────────────────────────────       │
│  Raw text from your PDF:                                 │
│  ┌─────────────────────────────────────────────┐         │
│  │ "Tech Summit 2026                           │         │
│  │  April 1 - April 3, 2026                    │         │
│  │  Hall A / Hall B                             │         │
│  │  Confirmed"                                  │         │
│  └─────────────────────────────────────────────┘         │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

After selecting fields → AI generates alternative options:

```
┌──────────────────────────────────────────────────────────┐
│  Which dates are correct for "Tech Summit"?              │
│                                                          │
│  Currently parsed as: April 1 – April 3                  │
│                                                          │
│  ○  April 1 – April 3, 2026  (keep as is)               │
│  ○  April 1 – April 13, 2026                             │
│  ○  April 10 – April 3, 2026                             │
│  ○  None of these                                        │
│                                                          │
│  Which location is correct?                              │
│                                                          │
│  Currently parsed as: Hall A                             │
│                                                          │
│  ○  Hall A  (keep as is)                                 │
│  ○  Hall B                                               │
│  ○  Hall A / Hall B  (both)                              │
│  ○  None of these                                        │
│                                                          │
│                           [ Apply Fixes → ]              │
└──────────────────────────────────────────────────────────┘
```

**Behavior:**
- Maximum 2-3 correction rounds per event
- "None of these" on all options — if selected, that field stays as-is with a warning
- After fixes applied → return to review table (Screen 3f) with updated values
- If corrections exhaust all rounds → escalate to failure path (Screen 3i)

---

#### Screen 3h: Save Template

```
┌──────────────────────────────────────────────────────────┐
│  [Logo]  ScrapeGoat                                      │
│  ─────────────────────────────────────────────────       │
│                                                          │
│  ✓ Template built successfully!                          │
│    47 events parsed from your PDF.                       │
│                                                          │
│  Give your template a name:                              │
│  ┌──────────────────────────────────────────────┐        │
│  │  Javits Center Event Calendar               │        │
│  └──────────────────────────────────────────────┘        │
│                                                          │
│  Save options:                                           │
│  ☑ Save to this browser (use again without setup)        │
│  ☐ Download as file (keep a backup)                      │
│  ☐ Share to community library (help others!)             │
│                                                          │
│        [ Save & Continue to Export → ]                   │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

**Behavior:**
- Template name is the only text input in the entire wizard flow (this is safe — it's metadata, not sent to AI)
- Default name suggested by AI based on PDF content
- "Save to browser" checked by default
- "Share to community" opens a confirmation: "This will submit your template to the public library via GitHub. No PDF data is shared — only the parsing rules."
- Continue → Screen 4

---

#### Screen 3i: Failure / Bug Report

```
┌──────────────────────────────────────────────────────────┐
│  [Logo]  ScrapeGoat                                      │
│  ─────────────────────────────────────────────────       │
│                                                          │
│  😕 We couldn't fully parse this calendar.               │
│                                                          │
│  Some PDF formats are tricky — especially scanned        │
│  documents or unusual layouts. You can help us           │
│  improve by reporting this.                              │
│                                                          │
│  [ Report This Issue ]                                   │
│                                                          │
│  ── or ──────────────────────────────────────────        │
│                                                          │
│  [ Try Again With Different Settings ]                   │
│  [ Start Over With a New PDF ]                           │
│  [ Go Back to Home ]                                     │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

"Report This Issue" flow:

```
┌──────────────────────────────────────────────────────────┐
│  Report a Parse Failure                                  │
│  ─────────────────────────────────────────────────       │
│                                                          │
│  We'll file a report on GitHub so the team can           │
│  investigate and add support for this format.            │
│                                                          │
│  What we'll include:                                     │
│  • Which wizard steps you completed                      │
│  • Your quiz answers                                     │
│  • Where the parsing failed                              │
│                                                          │
│  Would you like to include your PDF?                     │
│  (Helps us reproduce and fix the issue faster)           │
│                                                          │
│  ○ Submit with PDF attached                              │
│    ⚠️ Your file will be publicly visible on GitHub       │
│                                                          │
│  ○ Submit without PDF (description only)                 │
│                                                          │
│  ○ Cancel                                                │
│                                                          │
│  Optional note:                                          │
│  ┌──────────────────────────────────────────────┐        │
│  │                                              │        │
│  └──────────────────────────────────────────────┘        │
│                                                          │
│                              [ Submit Report ]           │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

---

#### Screen 4: Parsed Results

```
┌──────────────────────────────────────────────────────────┐
│  [Logo]  ScrapeGoat                       [New PDF]      │
│  ─────────────────────────────────────────────────       │
│  Template: Javits Center Calendar                        │
│  47 events found · 2 warnings                            │
│  ─────────────────────────────────────────────────       │
│                                                          │
│  [ Select All ] [ Select None ]  [ Date Range ▼ ]        │
│                                                          │
│  Show columns:                                           │
│  [Start ✓] [End ✓] [Move-In] [Move-Out] [Status ✓]      │
│                                                          │
│  ┌───┬────┬──────────────────┬────────┬────────┬──────┐  │
│  │ ☑ │  # │ Event Name       │ Start  │ End    │Status│  │
│  ├───┼────┼──────────────────┼────────┼────────┼──────┤  │
│  │ ☑ │  1 │ ACME Trade Show  │ 3/15   │ 3/18   │ Conf │  │
│  │ ☑ │  2 │ Widget Expo      │ 3/22   │ 3/25   │ Conf │  │
│  │ ☐ │  3 │ Tech Summit ⚠️   │ 4/1    │ 4/3    │ Tent │  │
│  │ ☑ │  4 │ Garden Show      │ 4/10   │ 4/14   │ Conf │  │
│  │   │ .. │ ...              │ ...    │ ...    │ ...  │  │
│  │ ☑ │ 47 │ Winter Gala      │ 12/5   │ 12/7   │ Hold │  │
│  └───┴────┴──────────────────┴────────┴────────┴──────┘  │
│                                                          │
│  ⚠️ 2 warnings — click event name for details            │
│                                                          │
│  43 of 47 events selected                                │
│                                                          │
│              [ Export Selected Events → ]                 │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

**Behavior:**
- Checkbox column for selecting which events to export
- Column toggle pills (like current MOS app's date column selection)
- Date range dropdown filters visible events
- Warning icon (⚠️) on events with parse warnings — click to expand details
- Warning detail shows: field, issue, raw value, suggested fix, [Accept Suggestion] button
- Clicking event name opens detail view with raw PDF text
- "Export Selected Events" → Screen 5
- "New PDF" → back to Screen 1

---

#### Screen 5: Export

```
┌──────────────────────────────────────────────────────────┐
│  [Logo]  ScrapeGoat                       [← Back]       │
│  ─────────────────────────────────────────────────       │
│                                                          │
│  Export 43 events                                        │
│                                                          │
│  Choose format:                                          │
│                                                          │
│  ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌───────┐  │
│  │            │ │            │ │            │ │       │  │
│  │  📅 ICS    │ │  📊 CSV    │ │  { } JSON  │ │ 📝 MD │  │
│  │            │ │            │ │            │ │       │  │
│  │  Calendar  │ │ Spreadsheet│ │  Data      │ │ Read  │  │
│  │  import    │ │  import    │ │  export    │ │ share │  │
│  │            │ │            │ │            │ │       │  │
│  └────────────┘ └────────────┘ └────────────┘ └───────┘  │
│       ▲ selected                                         │
│                                                          │
│  ── ICS Options ─────────────────────────────────        │
│                                                          │
│  Timezone: [ America/New_York          ▼ ]               │
│                                                          │
│  Date fields to include as calendar entries:              │
│  [Move-In ✓] [Event ✓] [Move-Out ✓]                     │
│                                                          │
│  ☑ Create separate entries for each phase                │
│    (Move-In, Event, Move-Out as individual items)        │
│                                                          │
│  ── Preview ─────────────────────────────────────        │
│  ┌──────────────────────────────────────────────┐        │
│  │ ACME Trade Show (Move-In)  │ Mar 13-14      │        │
│  │ ACME Trade Show (Event)    │ Mar 15-18      │        │
│  │ ACME Trade Show (Move-Out) │ Mar 19-20      │        │
│  │ ...                                          │        │
│  └──────────────────────────────────────────────┘        │
│                                                          │
│              [ Download ICS File ]                       │
│                                                          │
│  ─────────────────────────────────────────────────       │
│  Template: Javits Center Calendar                        │
│  [ Save Template ] [ Share to Community ]                │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

**Behavior:**
- Four format cards — click to select, options panel changes per format
- **ICS options:** timezone selector, phase toggle pills (move-in/event/move-out), multi-phase checkbox
- **CSV options:** column selector (which fields to include), delimiter choice (comma/tab/semicolon)
- **JSON options:** pretty print toggle, include raw text toggle
- **MD options:** table vs. list layout, include warnings toggle
- Preview panel shows first few lines of the selected format
- "Download" generates the file client-side and triggers browser download
- File naming: `scrapegoat-export-YYYY-MM-DD.{ics|csv|json|md}`
- "Save Template" / "Share to Community" at the bottom for convenience

### 7.4 Responsive Breakpoints

| Breakpoint | Width | Layout |
|-----------|-------|--------|
| Mobile | < 640px | Single column, stacked cards, hamburger nav |
| Tablet | 640–1024px | Two-column where appropriate, full-width table |
| Desktop | > 1024px | Max-width container (1200px), side-by-side panels |

### 7.5 PWA Manifest

```json
{
  "name": "ScrapeGoat: PDF Calendar Extractor",
  "short_name": "ScrapeGoat",
  "description": "Turn any PDF schedule into calendar events",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#1A1A2E",
  "theme_color": "#B91C1C",
  "icons": [
    {"src": "/icons/icon-192.png", "sizes": "192x192", "type": "image/png"},
    {"src": "/icons/icon-512.png", "sizes": "512x512", "type": "image/png"}
  ]
}
```

### 7.6 Favicon

Use the ScrapeGoat pirate goat icon (`scrapegoat_icon.png`) as the favicon. Generate multiple sizes:

| File | Size | Purpose |
|------|------|---------|
| `favicon.ico` | 32x32 | Browser tab (legacy) |
| `favicon-16x16.png` | 16x16 | Browser tab |
| `favicon-32x32.png` | 32x32 | Browser tab |
| `apple-touch-icon.png` | 180x180 | iOS home screen |
| `icon-192.png` | 192x192 | PWA manifest |
| `icon-512.png` | 512x512 | PWA manifest / splash |

### 7.7 Open Graph / Social Meta Tags

When the ScrapeGoat URL is shared on Twitter, LinkedIn, Slack, or iMessage, these tags control what preview card appears:

```html
<!-- Primary Meta Tags -->
<title>ScrapeGoat: PDF Calendar Extractor</title>
<meta name="description" content="Turn any PDF schedule into calendar events. Free, open-source, privacy-first. No install, no accounts.">

<!-- Open Graph (Facebook, LinkedIn, Slack, iMessage) -->
<meta property="og:type" content="website">
<meta property="og:url" content="https://scrapegoat.pages.dev">
<meta property="og:title" content="ScrapeGoat: PDF Calendar Extractor">
<meta property="og:description" content="Turn any PDF schedule into calendar events. Free, open-source, privacy-first.">
<meta property="og:image" content="https://github.com/Jason-Vaughan/project-assets/blob/main/scrapegoat-og.png?raw=true">

<!-- Twitter Card -->
<meta property="twitter:card" content="summary">
<meta property="twitter:title" content="ScrapeGoat: PDF Calendar Extractor">
<meta property="twitter:description" content="Turn any PDF schedule into calendar events. Free, open-source, privacy-first.">
<meta property="twitter:image" content="https://github.com/Jason-Vaughan/project-assets/blob/main/scrapegoat-og.png?raw=true">
```

**Note:** Create a dedicated OG image (1200x630px) with the goat logo + tagline on a dark background. Host in `project-assets` repo as `scrapegoat-og.png`.

### 7.8 404 Page

Custom 404 page, on-brand:

```
┌──────────────────────────────────────────────────────────┐
│                                                          │
│                    [ScrapeGoat Logo]                      │
│                                                          │
│                  404 — Page Not Found                     │
│                                                          │
│          This page has been scraped clean.                │
│                                                          │
│              [ Go Back Home ]                            │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

### 7.9 Loading States

Users need clear feedback during operations that take time:

| Operation | Duration | Loading UI |
|-----------|----------|-----------|
| PDF text extraction | 1-5 seconds | Progress bar: "Extracting text... page 3 of 12" |
| Gemini AI analysis | 5-30 seconds | Animated spinner + "Analyzing your calendar..." with rotating tips: "Looking for date patterns...", "Identifying locations...", "Detecting event names..." |
| Test parse | < 1 second | Instant (no loading needed) |
| Export generation | < 1 second | Instant (no loading needed) |
| Bug report submission | 2-5 seconds | Spinner + "Submitting report..." |

**Gemini timeout handling:**
- If Gemini takes longer than 30 seconds: "This is taking longer than usual. The free AI tier can be slow during peak hours."
- At 45 seconds: "Still working..." with option to cancel
- At 60 seconds: timeout, show error: "The AI service didn't respond in time. You can try again or create a template manually."

### 7.10 Analytics

**Cloudflare Web Analytics** (free, built into Cloudflare Pages):
- No JavaScript required — runs at the edge
- No cookies, no tracking pixels, no personal data collected
- GDPR/CCPA compliant out of the box
- Provides: page views, unique visitors, top pages, countries, browsers
- Zero setup — toggle on in Cloudflare Pages dashboard

This gives basic usage data (is anyone using this?) without compromising the privacy-first commitment. No third-party analytics scripts, no Google Analytics, no tracking.

---

## 8. Tech Stack

### 8.1 Frontend
| Component | Technology | Notes |
|-----------|-----------|-------|
| Framework | **Next.js 14+** (React) | Static export (`output: 'export'` in `next.config.js`) — no Node server needed |
| PDF parsing | **PDF.js** (Mozilla) | Client-side text extraction, loaded as web worker |
| Styling | **Tailwind CSS** | Utility-first, responsive, dark mode via `class` strategy |
| PWA | **next-pwa** or manual service worker + `manifest.json` | Offline caching of app shell, not data |
| State | **Browser localStorage** | Templates, user preferences, last-used settings |
| Testing | **Vitest** (unit/integration), **Playwright** (E2E) | Vitest for parser/export logic, Playwright for full wizard flow |

### 8.2 Backend (Serverless)
| Component | Technology | Notes |
|-----------|-----------|-------|
| AI proxy | **Cloudflare Worker** | Single function, `functions/analyze.js` |
| AI model | **Google Gemini 2.0 Flash** (`gemini-2.0-flash`) | Free tier, fast, sufficient for structured text analysis |
| Bug reports | **GitHub Issues API** | Pre-filled issue via URL params (no OAuth needed) |
| Hosting | **Cloudflare Pages** | Auto-deploys from `main` branch push, pairs with Workers |

### 8.3 Deployment

**Pipeline:** Push to `main` → Cloudflare Pages auto-builds → live site updated.

```
Developer pushes to main
  → Cloudflare Pages detects push (GitHub integration)
  → Runs `npm run build` (next build && next export)
  → Deploys static output to Cloudflare CDN
  → Worker function deploys alongside (functions/ directory)
  → Site live at [cloudflare-pages-url] or custom domain
```

**Environment variables** (set in Cloudflare Pages dashboard, never in code):
- `GEMINI_API_KEY` — Google AI Studio API key for the proxy function

**How to get a Gemini API key** (for self-hosters or contributors):
1. Go to [Google AI Studio](https://aistudio.google.com/apikey)
2. Sign in with any Google account
3. Click "Create API Key"
4. Copy the key — it's free, no billing required
5. Set it as `GEMINI_API_KEY` in your Cloudflare Worker environment variables

### 8.4 Serverless Proxy Function

The AI proxy is a single serverless function. Its only job is keeping the Gemini API key off the client.

**Endpoint:** `POST /api/analyze`

**Request body:**
```json
{
  "action": "initial_analysis" | "correction",
  "calendarText": "string (max 30,000 chars)",
  "turnstileToken": "string (required — from Cloudflare Turnstile)",
  "currentProfile": "object | null (for correction requests)",
  "corrections": "array | null (for correction requests)"
}
```

**Response:** Proxied Gemini response (structured JSON per section 4.4 contracts)

**Environment variables** (set in Cloudflare dashboard):
| Variable | Required | Description |
|----------|----------|-------------|
| `GEMINI_API_KEY` | Yes | Google AI Studio API key |
| `TURNSTILE_SECRET_KEY` | Yes | Cloudflare Turnstile server-side secret |
| `KV_NAMESPACE` | Yes | Cloudflare Workers KV namespace binding (for rate limits + dedup cache) |

**Implementation notes:**
- Single file: `functions/analyze.js` (Cloudflare Worker)
- Max request body: 100KB
- No logging of request content (privacy)
- Timeout: 30 seconds (Gemini can be slow on free tier)
- All abuse protections from Section 3.3 are enforced here

**Cloudflare Worker full request lifecycle:**
```javascript
export default {
  async fetch(request, env) {
    // 1. ORIGIN VALIDATION — reject if Origin header not in allowed list
    //    Allowed: scrapegoat.pages.dev, scrapegoat.io, localhost:3000
    //    Reject with 403 if missing or not allowed

    // 2. TURNSTILE VERIFICATION — validate the one-time bot-check token
    //    POST to https://challenges.cloudflare.com/turnstile/v0/siteverify
    //    with { secret: env.TURNSTILE_SECRET_KEY, response: body.turnstileToken }
    //    Reject with 403 if invalid, expired, or already used

    // 3. RATE LIMITING — check per-IP and global counters in Workers KV
    //    Per IP: 10/hour, 20/day
    //    Global: 500/day
    //    Reject with 429 if exceeded, include Retry-After header

    // 4. PAYLOAD VALIDATION — reject malformed requests
    //    calendarText required, 50-30,000 chars
    //    action must be "initial_analysis" or "correction"
    //    Reject with 400 if invalid

    // 5. DEDUPLICATION — check if same IP + same text hash was seen recently
    //    Hash the calendarText with SHA-256
    //    Check KV for cached response: dedup:{ip}:{hash}
    //    If found: return cached response immediately (saves Gemini call)

    // 6. BUILD GEMINI REQUEST — system prompt hardcoded HERE, not from client
    //    Combine: hardcoded system prompt + calendarText + response schema
    //    Model: gemini-2.0-flash

    // 7. CALL GEMINI API — with env.GEMINI_API_KEY
    //    Timeout: 30 seconds
    //    On failure: return 502 with user-friendly error

    // 8. VALIDATE GEMINI RESPONSE — must match expected JSON schema
    //    If malformed: return 502 "AI returned unexpected response"

    // 9. CACHE RESPONSE — store in KV for deduplication
    //    Key: dedup:{ip}:{hash}, TTL: 1 hour

    // 10. INCREMENT COUNTERS — update rate limit counts in KV

    // 11. RETURN — structured JSON to client
  }
}
```

### 8.5 Cost
**$0.** Every component runs on a free tier. No database, no storage, no compute beyond the serverless proxy.

### 8.6 .gitignore (Web Project)

```gitignore
# Dependencies
node_modules/

# Environment / secrets
.env
.env.local
.env.production.local

# Build output
dist/
.next/
.cache/
out/

# OS
.DS_Store
Thumbs.db

# IDE
.vscode/
.idea/

# Private templates (user's own, not shared)
templates/private/

# Test PDFs (may contain confidential calendar data)
test-pdfs/

# Temporary
*.local
*.log
```

---

## 9. Open Source

### 9.1 Repository Structure
```
scrapegoat/
├── .github/
│   ├── ISSUE_TEMPLATE/
│   │   ├── bug_report.md         # Bug report template
│   │   ├── feature_request.md    # Feature request template
│   │   ├── template_request.md   # Community template request
│   │   └── parse_failure.md      # Auto-filed from app failure path
│   └── pull_request_template.md  # PR template
├── src/                           # Frontend source
│   ├── components/                # UI components
│   ├── lib/
│   │   ├── parser/                # Parsing engine
│   │   ├── wizard/                # AI wizard flow logic
│   │   ├── export/                # ICS, CSV, JSON, MD generators
│   │   └── templates/             # Template loading/saving
│   └── pages/                     # App routes
├── templates/                     # Community template library
│   ├── index.json                 # Template index
│   └── *.json                     # Individual templates
├── functions/                     # Serverless proxy function
├── public/                        # Static assets
├── .gitignore
├── CHANGELOG.md
├── CONTRIBUTING.md
├── LICENSE                        # MIT
├── README.md
└── SCRAPEGOAT_SPEC.md             # System specification
```

### 9.2 GitHub Repository

- **Owner:** `Jason-Vaughan`
- **Repo name:** `ScrapeGoat`
- **URL:** `https://github.com/Jason-Vaughan/ScrapeGoat`
- **Visibility:** Public
- **Default branch:** `main`
- **Logo assets:** Upload `scrapegoat_logo.png` (transparent background) to `Jason-Vaughan/project-assets` repo as `scrapegoat-logo.png`
  - Source file location: `ScrapeGoat-MOS/Sources/Resources/scrapegoat_logo.png`
  - README references: `https://github.com/Jason-Vaughan/project-assets/blob/main/scrapegoat-logo.png?raw=true`
- **Live site:** Cloudflare Pages URL initially (e.g., `scrapegoat.pages.dev`), custom domain later if purchased

### 9.3 What Ships Public
- Parsing engine
- AI wizard flow and UI
- All four export generators (ICS, CSV, JSON, MD)
- Community template library (user-contributed)
- Serverless proxy function code
- Documentation and contribution guidelines
- Full system specification

### 9.3 What Stays Private (`.gitignore`)
- MosconeProfile and any Moscone-specific data
- Test PDFs containing real venue/calendar data
- Any proprietary calendar files
- Private templates (`templates/private/`)
- The maintainer's Gemini API key (environment variable in the serverless function)
- `.env` / `.env.local` files

### 9.4 Contribution Model
- Community submits new templates via pull request
- Template PRs include: the JSON profile, a description of the source, sample parsing results
- Code improvements (parser, wizard, exports, UI) via standard PR workflow
- Bug reports via GitHub Issues — optionally auto-filed from the app's failure path
- Feature requests and template requests via GitHub Issue templates
- All contributions tracked via CHANGELOG.md

### 9.5 AI Attribution Policy

**Do NOT credit any AI model as a collaborator, co-author, or contributor in the public repository.** This applies to:

- **Commit messages** — no `Co-Authored-By: Claude`, `Co-Authored-By: GPT`, or similar lines
- **PR descriptions** — do not name AI tools as authors or contributors
- **README / CONTRIBUTORS file** — AI models are not listed as contributors
- **Code comments** — no "generated by Claude/GPT/Gemini" annotations
- **CHANGELOG entries** — credit the human author, not the AI tool used

This is standard practice for open-source projects. AI tools are instruments, not collaborators. The human who reviews, tests, and commits the code is the author.

**Note for maintainer:** The private ScrapeGoat-MOS repo has `Co-Authored-By: Claude` in commit history. The public ScrapeGoat repo must start with a clean history — do NOT copy or rebase commits from ScrapeGoat-MOS. Start fresh.

---

## 10. GitHub Project Infrastructure

### 10.1 GitHub Topics / Keywords

Set these as **GitHub repository topics** (Settings → Topics) for discoverability:

```
pdf-parser · pdf-to-ics · calendar-extractor · schedule-parser · pwa · gemini-ai · ics-generator · pdf-to-csv · privacy-first · nextjs · open-source · client-side
```

### 10.2 Branding & README

**Logo:** `scrapegoat_logo.png` (transparent background) hosted in `Jason-Vaughan/project-assets` repo — same convention as TangleClaw and other projects.

**README.md format** follows the TangleClaw convention:

```html
<p align="center">
  <img src="https://github.com/Jason-Vaughan/project-assets/blob/main/scrapegoat-logo.png?raw=true" alt="ScrapeGoat logo" width="200">
</p>

<p align="center">
  <strong>PDF Calendar Extractor</strong>
</p>

<p align="center">
  <code>pwa</code> &middot; <code>gemini ai</code> &middot; <code>pdf.js</code> &middot;
  <code>ics</code> &middot; <code>csv</code> &middot; <code>json</code> &middot;
  <code>markdown</code> &middot; <code>zero cost</code> &middot; <code>privacy first</code>
</p>
```

**README sections:**
1. Logo + tagline + pill tags (as above)
2. **Narrative intro** — the story of why ScrapeGoat exists (you have a PDF schedule, you need calendar events, existing tools don't work)
3. **How It Works** — the 5-step flow (drop PDF → template selection → AI wizard → review → export)
4. **Features** — with `<details>` dropdowns for sub-features
5. **Screenshots** — placeholder until UI is built
6. **Quick Start** — how to use the hosted version + how to run locally for development
7. **Community Templates** — how to browse, use, and contribute templates
8. **Privacy** — the user-facing privacy statement
9. **Contributing** — link to CONTRIBUTING.md
10. **License** — MIT

### 10.3 Issue Templates

Four issue templates in `.github/ISSUE_TEMPLATE/`:

**bug_report.md**
```yaml
---
name: Bug Report
about: Something isn't working as expected
title: ""
labels: bug
assignees: ""
---
```
Fields:
- What happened?
- What did you expect?
- Steps to reproduce
- PDF details (type of schedule, approximate event count)
- Template used (community template name or custom)
- Browser & OS

**feature_request.md**
```yaml
---
name: Feature Request
about: Suggest an idea or improvement
title: ""
labels: enhancement
assignees: ""
---
```
Fields:
- What problem does this solve?
- What would the solution look like?
- Alternatives considered

**template_request.md**
```yaml
---
name: Template Request
about: Request support for a new calendar/schedule format
title: "[Template] "
labels: template-request
assignees: ""
---
```
Fields:
- What type of schedule/calendar is this?
- Source organization (who publishes the PDF?)
- How often does the calendar update?
- PDF attachment (optional, with privacy note: "This file will be publicly visible on GitHub")
- Any known quirks (OCR'd, multi-column, unusual date formats, etc.)

**parse_failure.md** (auto-filed from the app)
```yaml
---
name: Parse Failure
about: Automatically filed when the AI wizard cannot parse a PDF
title: "[Parse Failure] "
labels: parse-failure
assignees: ""
---
```
Fields (auto-populated by the app):
- Wizard step reached (which round of the quiz)
- Quiz answers given (structured data from user selections)
- Error details (what the AI returned, what failed validation)
- PDF attachment (optional — requires user consent before upload)
- User notes (optional freeform — goes to GitHub, not the AI)

### 10.4 Pull Request Template

`.github/pull_request_template.md`:

```markdown
## Summary
<!-- What does this PR do and why? -->

## Type
<!-- Check one -->
- [ ] Bug fix
- [ ] Feature
- [ ] Template (new or updated community template)
- [ ] Documentation
- [ ] Refactor

## For Template PRs
<!-- Fill in if this PR adds or updates a community template -->
- **Source:** <!-- e.g., "Javits Center event calendar" -->
- **Events tested:** <!-- e.g., "47 events parsed correctly" -->
- **Sample output:** <!-- paste a few lines of parsed output -->

## Test Plan
- [ ] ...

## Checklist
- [ ] Tests pass
- [ ] No API keys or secrets committed
- [ ] Template JSON conforms to schema (if applicable)
- [ ] CHANGELOG.md updated
```

### 10.5 GitHub Labels

**Standard labels** (matching TangleClaw):
| Label | Color | Description |
|-------|-------|-------------|
| `bug` | `#d73a4a` | Something isn't working |
| `enhancement` | `#a2eeef` | New feature or request |
| `documentation` | `#0075ca` | Improvements or additions to documentation |
| `duplicate` | `#cfd3d7` | This issue or pull request already exists |
| `good first issue` | `#7057ff` | Good for newcomers |
| `help wanted` | `#008672` | Extra attention is needed |
| `invalid` | `#e4e669` | This doesn't seem right |
| `question` | `#d876e3` | Further information is requested |
| `wontfix` | `#ffffff` | This will not be worked on |

**ScrapeGoat-specific labels:**
| Label | Color | Description |
|-------|-------|-------------|
| `template-request` | `#f9d0c4` | Request for a new community template |
| `parse-failure` | `#e11d48` | Auto-filed from app when wizard can't parse a PDF |
| `template` | `#bfdadc` | PR adds or updates a community template |
| `ai-wizard` | `#c5def5` | Related to the Gemini AI wizard flow |
| `export` | `#d4c5f9` | Related to ICS/CSV/JSON/MD export |
| `privacy` | `#fbca04` | Privacy-related issues or concerns |

### 10.6 CONTRIBUTING.md

Sections:
1. **Welcome** — what ScrapeGoat is, how contributions help
2. **Code Contributions** — fork, branch, PR workflow, code style, how to run locally
3. **Template Contributions** — how to create and submit a community template:
   - Use the app to create a template via the AI wizard
   - Export the template JSON
   - Fork the repo, add the JSON to `templates/`
   - Update `templates/index.json` with metadata (source name, author, date, event count tested)
   - Open a PR using the template PR template
4. **Bug Reports** — use the issue template, or let the app auto-file via the failure path
5. **Feature Requests** — use the issue template
6. **Development Setup** — prerequisites, local dev server, environment variables, how the AI proxy works
7. **Code Style** — conventions, linting, testing requirements

### 10.7 License

**MIT License** — permissive, standard for open-source tools, allows commercial use and modification.

### 10.8 CHANGELOG.md

Maintained with every change. Format:
```markdown
# Changelog

## [Unreleased]

## [1.0.0] - YYYY-MM-DD
### Added
- Initial release
- AI-powered template wizard using Google Gemini
- Four export formats: ICS, CSV, JSON, MD
- Community template library
- PWA support (installable on mobile and desktop)
- One-button bug reporting from parse failure path
```

---

## 11. Self-Hosting

ScrapeGoat can be self-hosted by anyone — organizations, teams, or individuals who want to run their own instance instead of using the public one.

### 11.1 Why Self-Host?
- **Privacy policy requirements** — some orgs can't send any data to third-party APIs (the public instance proxies through our Cloudflare Worker)
- **Custom branding** — swap the logo, change the name, make it yours
- **Internal template library** — private templates that never leave the organization
- **Rate limit control** — your own Gemini key, your own limits
- **Air-gapped environments** — run entirely without the AI wizard (manual template creation only)

### 11.2 Self-Host Options

#### Option A: Static Files + Your Own Proxy (Easiest)

```bash
git clone https://github.com/Jason-Vaughan/ScrapeGoat.git
cd ScrapeGoat
npm install
```

Set environment:
```bash
cp .env.example .env.local
# Edit .env.local:
# GEMINI_API_KEY=your-key-here
# NEXT_PUBLIC_API_URL=https://your-proxy-url
```

Build and serve:
```bash
npm run build        # Generates static site in out/
npx serve out/       # Serve locally on port 3000
```

Deploy the `out/` folder to any static host — Nginx, Apache, S3, your own Cloudflare Pages, or even `file://` for fully offline use (minus AI wizard).

Deploy `functions/analyze.js` as a Cloudflare Worker, AWS Lambda, Google Cloud Function, or any serverless platform. Set `GEMINI_API_KEY` in that platform's environment variables.

#### Option B: Docker (One Command)

```bash
docker run -p 3000:3000 -e GEMINI_API_KEY=your-key-here ghcr.io/jason-vaughan/scrapegoat:latest
```

The Docker image bundles:
- Static frontend (served by lightweight Node or Nginx)
- AI proxy endpoint at `/api/analyze`
- No external dependencies

**Dockerfile** (included in repo):
```dockerfile
FROM node:22-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:22-alpine
WORKDIR /app
COPY --from=builder /app/out ./out
COPY --from=builder /app/functions ./functions
COPY server.js .
EXPOSE 3000
CMD ["node", "server.js"]
```

`server.js` is a minimal Node HTTP server (~50 lines) that:
- Serves static files from `out/`
- Proxies `/api/analyze` to Gemini with the `GEMINI_API_KEY` env var
- No framework, no dependencies beyond Node stdlib

#### Option C: Offline Mode (No AI)

If you can't or don't want to use the Gemini API:
- Skip the wizard entirely
- Create templates manually by editing JSON files (the schema is documented in Section 5.1)
- Import templates via the "Load Saved Template" flow
- All parsing and export functionality works offline — only the wizard needs the API

The app should detect when no API proxy is configured and hide the "Create New Template" wizard button, showing only "Load Template from File" and "Browse Community Templates" (which can be bundled locally).

### 11.3 Self-Host Configuration

Environment variables:

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `GEMINI_API_KEY` | No* | none | Google AI Studio API key. *Required only if AI wizard is enabled |
| `TURNSTILE_SECRET_KEY` | No* | none | Cloudflare Turnstile secret. *Required only if AI wizard is enabled. Get from Cloudflare dashboard → Turnstile |
| `TURNSTILE_SITE_KEY` | No* | none | Cloudflare Turnstile public site key. *Required only if AI wizard is enabled |
| `NEXT_PUBLIC_API_URL` | No | `/api` | URL of the AI proxy endpoint. Set to external URL if proxy is hosted separately |
| `NEXT_PUBLIC_SITE_NAME` | No | `ScrapeGoat` | Override the app name (for white-labeling) |
| `NEXT_PUBLIC_SITE_LOGO` | No | ScrapeGoat logo | URL to custom logo image |
| `RATE_LIMIT_PER_HOUR` | No | `10` | Max AI wizard requests per IP per hour |
| `RATE_LIMIT_PER_DAY` | No | `20` | Max AI wizard requests per IP per day |
| `GLOBAL_DAILY_CAP` | No | `500` | Max AI wizard requests across all users per day |
| `CORS_ORIGIN` | No | `*` | Allowed CORS origin (set to your domain in production) |

---

## 12. Future Considerations

These are NOT in scope for v1.0 but worth noting:

- **OCR support** — for scanned/image-based PDFs (currently only works with digital/text-based PDFs)
- **Template versioning** — as the schema evolves, migrate older templates
- **Batch processing** — drop multiple PDFs, parse all with the same template
- **Calendar sync** — direct Google Calendar / Outlook integration (adds OAuth complexity)
- **Alternative AI providers** — fallback to other free models if Gemini changes terms
- **Multi-column PDF detection** — detect and de-interleave side-by-side column layouts from PDF.js text extraction (see Section 2.4)
- **Localization** — multi-language UI support

---

## 13. Summary

ScrapeGoat is a **free, open-source, browser-based PDF calendar extractor** that uses an **AI-powered wizard** to help anyone — technical or not — turn PDF schedules into usable calendar data. No install, no accounts, no cost, no data collection. PDF in, events out.
