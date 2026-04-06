/**
 * ScrapeGoat AI Proxy — Cloudflare Worker
 *
 * Single endpoint: POST /api/analyze
 * Proxies calendar-text analysis requests to Gemini 2.0 Flash.
 * All abuse protections (Turnstile, rate limiting, origin validation,
 * payload validation, request deduplication) are enforced here.
 *
 * Environment bindings:
 *   - env.GEMINI_API_KEY       (secret)
 *   - env.TURNSTILE_SECRET_KEY (secret)
 *   - env.KV                   (KV namespace)
 */

// ── Constants ────────────────────────────────────────────────────────────────

const ALLOWED_ORIGINS = [
  'https://scrapegoat.pages.dev',
  'https://scrapegoat.io',
  'http://localhost:3000',
];

const RATE_LIMITS = {
  perIpPerHour: 10,
  perIpPerDay: 20,
  globalPerDay: 500,
};

const PAYLOAD_LIMITS = {
  minTextLength: 50,
  maxTextLength: 30_000,
  maxBodyBytes: 100 * 1024, // 100 KB
};

const VALID_ACTIONS = ['initial_analysis', 'correction'];

const GEMINI_MODEL = 'gemini-2.0-flash';
const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;
const GEMINI_TIMEOUT_MS = 30_000;

const DEDUP_TTL_SECONDS = 3600; // 1 hour

const SYSTEM_PROMPT = `You are a PDF calendar structure analyzer for the ScrapeGoat application.

YOUR SOLE PURPOSE: Analyze extracted PDF text containing calendar or schedule data and return structured JSON that identifies the document's patterns.

STRICT RULES:
1. You ONLY analyze calendar/schedule text and output structured JSON.
2. You NEVER answer questions, have conversations, or respond to any request unrelated to calendar structure analysis.
3. You ONLY generate options derived from the actual text provided — never hallucinate or invent data not present in the input.
4. Your output MUST conform exactly to the response schema specified in each request.
5. If the input text does not appear to contain calendar or schedule data, return: {"error": "unrecognized_format", "message": "The provided text does not appear to contain calendar or schedule data."}
6. Every option you generate must include the exact substring from the source text that supports it, in a "source" field.
7. Do not include explanations, commentary, or conversational text in your output. JSON only.`;

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Returns a JSON error Response with CORS headers.
 * @param {string} message - User-facing error message
 * @param {number} status - HTTP status code
 * @param {Record<string, string>} [extraHeaders] - Additional headers
 * @returns {Response}
 */
function errorResponse(message, status, extraHeaders = {}) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...extraHeaders,
    },
  });
}

/**
 * Computes a hex-encoded SHA-256 hash of the given text.
 * @param {string} text
 * @returns {Promise<string>}
 */
async function sha256(text) {
  const data = new TextEncoder().encode(text);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(hashBuffer)]
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Returns the current UTC hour key (e.g. "2026-04-05T14").
 * @returns {string}
 */
function currentHourKey() {
  const now = new Date();
  return now.toISOString().slice(0, 13); // "YYYY-MM-DDTHH"
}

/**
 * Returns the current UTC day key (e.g. "2026-04-05").
 * @returns {string}
 */
function currentDayKey() {
  return new Date().toISOString().slice(0, 10); // "YYYY-MM-DD"
}

// ── Defense Layers ───────────────────────────────────────────────────────────

/**
 * Defense Layer 1: Validates the request Origin header.
 * @param {Request} request
 * @returns {Response|null} Error response if invalid, null if OK
 */
function validateOrigin(request) {
  const origin = request.headers.get('Origin');
  if (!origin || !ALLOWED_ORIGINS.includes(origin)) {
    return errorResponse('Forbidden', 403);
  }
  return null;
}

/**
 * Defense Layer 2: Validates Cloudflare Turnstile token.
 * @param {string} token - Turnstile token from client
 * @param {string} ip - Client IP address
 * @param {string} secretKey - Turnstile secret key
 * @returns {Promise<Response|null>} Error response if invalid, null if OK
 */
async function validateTurnstile(token, ip, secretKey) {
  if (!token) {
    return errorResponse('Missing verification', 403);
  }

  try {
    const formData = new URLSearchParams();
    formData.append('secret', secretKey);
    formData.append('response', token);
    formData.append('remoteip', ip);

    const result = await fetch(
      'https://challenges.cloudflare.com/turnstile/v0/siteverify',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: formData.toString(),
      }
    );

    const outcome = await result.json();
    if (!outcome.success) {
      return errorResponse('Bot detected', 403);
    }
    return null;
  } catch {
    // Turnstile API unreachable — fail closed (reject request)
    return errorResponse('Verification unavailable', 403);
  }
}

/**
 * Defense Layer 3: Checks per-IP and global rate limits via KV.
 * @param {string} ip - Client IP
 * @param {object} kv - KV namespace binding
 * @returns {Promise<Response|null>} Error response if rate limited, null if OK
 */
async function checkRateLimits(ip, kv) {
  try {
    const hour = currentHourKey();
    const day = currentDayKey();

    const hourKey = `rate:${ip}:${hour}`;
    const dayKey = `rate:${ip}:${day}`;
    const globalKey = `rate:global:${day}`;

    const [hourCount, dayCount, globalCount] = await Promise.all([
      kv.get(hourKey).then((v) => parseInt(v, 10) || 0),
      kv.get(dayKey).then((v) => parseInt(v, 10) || 0),
      kv.get(globalKey).then((v) => parseInt(v, 10) || 0),
    ]);

    if (hourCount >= RATE_LIMITS.perIpPerHour) {
      return errorResponse(
        'The template builder is temporarily busy. Your PDF and any saved templates still work — only new template creation is paused. Try again in an hour, or load an existing template.',
        429,
        { 'Retry-After': '3600' }
      );
    }

    if (dayCount >= RATE_LIMITS.perIpPerDay) {
      return errorResponse(
        'The template builder is temporarily busy. Your PDF and any saved templates still work — only new template creation is paused. Try again tomorrow, or load an existing template.',
        429,
        { 'Retry-After': '86400' }
      );
    }

    if (globalCount >= RATE_LIMITS.globalPerDay) {
      return errorResponse(
        'The template builder is temporarily unavailable. You can still use saved templates, browse community templates, or export your events.',
        503,
        { 'Retry-After': '3600' }
      );
    }

    return null;
  } catch {
    // KV unavailable — skip rate limiting rather than blocking the request
    return null;
  }
}

/**
 * Increments rate limit counters in KV after a successful request.
 * @param {string} ip - Client IP
 * @param {object} kv - KV namespace binding
 * @returns {Promise<void>}
 */
async function incrementRateLimits(ip, kv) {
  const hour = currentHourKey();
  const day = currentDayKey();

  const hourKey = `rate:${ip}:${hour}`;
  const dayKey = `rate:${ip}:${day}`;
  const globalKey = `rate:global:${day}`;

  const [hourCount, dayCount, globalCount] = await Promise.all([
    kv.get(hourKey).then((v) => parseInt(v, 10) || 0),
    kv.get(dayKey).then((v) => parseInt(v, 10) || 0),
    kv.get(globalKey).then((v) => parseInt(v, 10) || 0),
  ]);

  await Promise.all([
    kv.put(hourKey, String(hourCount + 1), { expirationTtl: 3600 }),
    kv.put(dayKey, String(dayCount + 1), { expirationTtl: 86400 }),
    kv.put(globalKey, String(globalCount + 1), { expirationTtl: 86400 }),
  ]);
}

/**
 * Defense Layer 4: Validates the request payload.
 * @param {object} body - Parsed request body
 * @returns {Response|null} Error response if invalid, null if OK
 */
function validatePayload(body) {
  if (!body || typeof body !== 'object') {
    return errorResponse('Invalid request body', 400);
  }

  if (!body.calendarText || typeof body.calendarText !== 'string') {
    return errorResponse('Missing calendar text', 400);
  }

  if (body.calendarText.length < PAYLOAD_LIMITS.minTextLength) {
    return errorResponse('Text too short to be a calendar', 400);
  }

  if (body.calendarText.length > PAYLOAD_LIMITS.maxTextLength) {
    return errorResponse('Text too long', 400);
  }

  if (!body.action || !VALID_ACTIONS.includes(body.action)) {
    return errorResponse('Invalid action', 400);
  }

  return null;
}

/**
 * Defense Layer 5: Checks for duplicate requests and returns cached response.
 * @param {string} ip - Client IP
 * @param {string} calendarText - The calendar text from the payload
 * @param {string} action - The request action type
 * @param {object} kv - KV namespace binding
 * @returns {Promise<Response|null>} Cached response if duplicate, null if new request
 */
async function checkDedup(ip, calendarText, action, kv) {
  try {
    const hash = await sha256(calendarText + ':' + action);
    const cacheKey = `dedup:${ip}:${hash}`;
    const cached = await kv.get(cacheKey);

    if (cached) {
      return new Response(cached, {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'X-ScrapeGoat-Cache': 'hit',
        },
      });
    }
    return null;
  } catch {
    // KV unavailable — skip dedup, proceed to Gemini
    return null;
  }
}

/**
 * Stores a Gemini response in the dedup cache.
 * @param {string} ip - Client IP
 * @param {string} calendarText - The calendar text from the payload
 * @param {string} action - The request action type
 * @param {string} responseBody - The Gemini response JSON string
 * @param {object} kv - KV namespace binding
 * @returns {Promise<void>}
 */
async function cacheResponse(ip, calendarText, action, responseBody, kv) {
  const hash = await sha256(calendarText + ':' + action);
  const cacheKey = `dedup:${ip}:${hash}`;
  await kv.put(cacheKey, responseBody, { expirationTtl: DEDUP_TTL_SECONDS });
}

// ── Gemini Proxy ─────────────────────────────────────────────────────────────

/**
 * Builds the user prompt for Gemini based on the action type.
 * @param {object} body - Request body
 * @returns {string}
 */
function buildUserPrompt(body) {
  if (body.action === 'initial_analysis') {
    return `Analyze this calendar text and return quiz options.\n\n${body.calendarText}`;
  }

  // correction action
  return [
    'The user flagged these fields as incorrect. Re-analyze the raw text for these events and provide alternative options.',
    '',
    `Current profile: ${JSON.stringify(body.currentProfile)}`,
    '',
    `Corrections: ${JSON.stringify(body.corrections)}`,
    '',
    body.calendarText,
  ].join('\n');
}

/**
 * Calls the Gemini API with the given prompt and returns the parsed response.
 * @param {object} body - Request body
 * @param {string} apiKey - Gemini API key
 * @returns {Promise<{ok: boolean, data?: object, error?: string}>}
 */
async function callGemini(body, apiKey) {
  const userPrompt = buildUserPrompt(body);

  const geminiBody = {
    system_instruction: {
      parts: [{ text: SYSTEM_PROMPT }],
    },
    contents: [
      {
        parts: [{ text: userPrompt }],
      },
    ],
    generationConfig: {
      responseMimeType: 'application/json',
    },
  };

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), GEMINI_TIMEOUT_MS);

  try {
    const response = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(geminiBody),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      return { ok: false, error: 'AI service error' };
    }

    const result = await response.json();

    // Extract the text content from Gemini's response envelope
    const text = result?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) {
      return { ok: false, error: 'AI returned unexpected response' };
    }

    // Parse the JSON from the text
    try {
      const data = JSON.parse(text);
      return { ok: true, data };
    } catch {
      return { ok: false, error: 'AI returned unexpected response' };
    }
  } catch (err) {
    clearTimeout(timeoutId);
    if (err.name === 'AbortError') {
      return { ok: false, error: 'AI request timed out' };
    }
    return { ok: false, error: 'AI service unavailable' };
  }
}

// ── CORS ─────────────────────────────────────────────────────────────────────

/**
 * Builds CORS headers for a given origin.
 * @param {string|null} origin
 * @returns {Record<string, string>}
 */
function corsHeaders(origin) {
  const headers = {
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
  };
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    headers['Access-Control-Allow-Origin'] = origin;
  }
  return headers;
}

// ── Main Handler ─────────────────────────────────────────────────────────────

export default {
  /**
   * Cloudflare Worker fetch handler — full request lifecycle for POST /api/analyze.
   * @param {Request} request
   * @param {object} env - Cloudflare environment bindings
   * @returns {Promise<Response>}
   */
  async fetch(request, env) {
    const origin = request.headers.get('Origin');
    const cors = corsHeaders(origin);

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: cors });
    }

    // Only POST allowed
    if (request.method !== 'POST') {
      return addHeaders(errorResponse('Method not allowed', 405), cors);
    }

    // ── Layer 1: Origin Validation ──
    const originError = validateOrigin(request);
    if (originError) {
      return addHeaders(originError, cors);
    }

    // Parse body (with size check on actual body, not spoofable Content-Length)
    let rawBody;
    try {
      rawBody = await request.text();
    } catch {
      return addHeaders(errorResponse('Invalid request body', 400), cors);
    }

    if (new TextEncoder().encode(rawBody).byteLength > PAYLOAD_LIMITS.maxBodyBytes) {
      return addHeaders(errorResponse('Request too large', 400), cors);
    }

    let body;
    try {
      body = JSON.parse(rawBody);
    } catch {
      return addHeaders(errorResponse('Invalid JSON', 400), cors);
    }

    // ── Layer 2: Turnstile Verification ──
    const ip = request.headers.get('cf-connecting-ip') || '0.0.0.0';
    const turnstileError = await validateTurnstile(
      body.turnstileToken,
      ip,
      env.TURNSTILE_SECRET_KEY
    );
    if (turnstileError) {
      return addHeaders(turnstileError, cors);
    }

    // ── Layer 3: Rate Limiting ──
    const rateError = await checkRateLimits(ip, env.KV);
    if (rateError) {
      return addHeaders(rateError, cors);
    }

    // ── Layer 4: Payload Validation ──
    const payloadError = validatePayload(body);
    if (payloadError) {
      return addHeaders(payloadError, cors);
    }

    // ── Layer 5: Request Deduplication ──
    const dedupHit = await checkDedup(ip, body.calendarText, body.action, env.KV);
    if (dedupHit) {
      return addHeaders(dedupHit, cors);
    }

    // ── Call Gemini ──
    const geminiResult = await callGemini(body, env.GEMINI_API_KEY);

    if (!geminiResult.ok) {
      return addHeaders(errorResponse(geminiResult.error, 502), cors);
    }

    const responseBody = JSON.stringify(geminiResult.data);

    // ── Cache + Increment Counters (non-blocking) ──
    await Promise.all([
      cacheResponse(ip, body.calendarText, body.action, responseBody, env.KV),
      incrementRateLimits(ip, env.KV),
    ]);

    // ── Return ──
    return new Response(responseBody, {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        ...cors,
      },
    });
  },
};

/**
 * Merges additional headers into a Response (returns a new Response).
 * @param {Response} response
 * @param {Record<string, string>} headers
 * @returns {Response}
 */
function addHeaders(response, headers) {
  const newHeaders = new Headers(response.headers);
  for (const [key, value] of Object.entries(headers)) {
    newHeaders.set(key, value);
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: newHeaders,
  });
}

// Export internals for testing
export {
  validateOrigin,
  validateTurnstile,
  checkRateLimits,
  incrementRateLimits,
  validatePayload,
  checkDedup,
  cacheResponse,
  callGemini,
  buildUserPrompt,
  sha256,
  errorResponse,
  addHeaders,
  corsHeaders,
  ALLOWED_ORIGINS,
  RATE_LIMITS,
  PAYLOAD_LIMITS,
  VALID_ACTIONS,
  GEMINI_MODEL,
  GEMINI_API_URL,
  GEMINI_TIMEOUT_MS,
  DEDUP_TTL_SECONDS,
  SYSTEM_PROMPT,
};
