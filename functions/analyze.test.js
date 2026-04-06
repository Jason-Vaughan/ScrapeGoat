/**
 * @vitest-environment node
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
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
  addHeaders,
  corsHeaders,
  ALLOWED_ORIGINS,
  RATE_LIMITS,
  SYSTEM_PROMPT,
} from './analyze.js';
import worker from './analyze.js';

// ── Test Helpers ─────────────────────────────────────────────────────────────

/** Creates a mock KV namespace. */
function createMockKV(store = {}) {
  return {
    get: vi.fn(async (key) => store[key] ?? null),
    put: vi.fn(async (key, value) => {
      store[key] = value;
    }),
  };
}

/** Creates a minimal Request-like object. */
function makeRequest({
  method = 'POST',
  origin = 'https://scrapegoat.pages.dev',
  ip = '1.2.3.4',
  body = null,
  contentLength = null,
} = {}) {
  const headers = new Headers();
  if (origin) headers.set('Origin', origin);
  headers.set('cf-connecting-ip', ip);
  headers.set('Content-Type', 'application/json');
  if (contentLength !== null) {
    headers.set('Content-Length', String(contentLength));
  } else if (body) {
    headers.set('Content-Length', String(JSON.stringify(body).length));
  }

  return new Request('https://scrapegoat-api.workers.dev/api/analyze', {
    method,
    headers,
    body: body ? JSON.stringify(body) : null,
  });
}

/** A valid request body for convenience. */
function validBody(overrides = {}) {
  return {
    action: 'initial_analysis',
    calendarText: 'A'.repeat(100),
    turnstileToken: 'valid-token',
    ...overrides,
  };
}

/** Creates a mock env with KV, keys, and optional overrides. */
function createMockEnv(kvStore = {}) {
  return {
    GEMINI_API_KEY: 'test-gemini-key',
    TURNSTILE_SECRET_KEY: 'test-turnstile-secret',
    KV: createMockKV(kvStore),
  };
}

// ── SHA-256 ──────────────────────────────────────────────────────────────────

describe('sha256', () => {
  it('produces a 64-char hex string', async () => {
    const hash = await sha256('hello world');
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('is deterministic', async () => {
    const a = await sha256('test input');
    const b = await sha256('test input');
    expect(a).toBe(b);
  });

  it('produces different hashes for different inputs', async () => {
    const a = await sha256('input A');
    const b = await sha256('input B');
    expect(a).not.toBe(b);
  });
});

// ── Layer 1: Origin Validation ───────────────────────────────────────────────

describe('validateOrigin', () => {
  it('returns null for allowed origins', () => {
    for (const origin of ALLOWED_ORIGINS) {
      const req = makeRequest({ origin });
      expect(validateOrigin(req)).toBeNull();
    }
  });

  it('rejects missing Origin header', () => {
    const req = makeRequest({ origin: null });
    const res = validateOrigin(req);
    expect(res).not.toBeNull();
    expect(res.status).toBe(403);
  });

  it('rejects unknown origin', () => {
    const req = makeRequest({ origin: 'https://evil.com' });
    const res = validateOrigin(req);
    expect(res.status).toBe(403);
  });
});

// ── Layer 2: Turnstile Verification ──────────────────────────────────────────

describe('validateTurnstile', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('rejects missing token', async () => {
    const res = await validateTurnstile(null, '1.2.3.4', 'secret');
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toBe('Missing verification');
  });

  it('rejects empty string token', async () => {
    const res = await validateTurnstile('', '1.2.3.4', 'secret');
    expect(res.status).toBe(403);
  });

  it('returns null on successful verification', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ success: true }))
    );

    const res = await validateTurnstile('good-token', '1.2.3.4', 'secret');
    expect(res).toBeNull();
  });

  it('rejects when Turnstile API says failure', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ success: false }))
    );

    const res = await validateTurnstile('bad-token', '1.2.3.4', 'secret');
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toBe('Bot detected');
  });

  it('rejects with 403 when Turnstile API is unreachable', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new Error('Network error'));

    const res = await validateTurnstile('token', '1.2.3.4', 'secret');
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toBe('Verification unavailable');
  });

  it('sends correct parameters to Turnstile API', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ success: true }))
    );

    await validateTurnstile('my-token', '5.6.7.8', 'my-secret');

    expect(fetchSpy).toHaveBeenCalledWith(
      'https://challenges.cloudflare.com/turnstile/v0/siteverify',
      expect.objectContaining({ method: 'POST' })
    );

    const callBody = fetchSpy.mock.calls[0][1].body;
    expect(callBody).toContain('secret=my-secret');
    expect(callBody).toContain('response=my-token');
    expect(callBody).toContain('remoteip=5.6.7.8');
  });
});

// ── Layer 3: Rate Limiting ───────────────────────────────────────────────────

describe('checkRateLimits', () => {
  it('returns null when under all limits', async () => {
    const kv = createMockKV();
    const res = await checkRateLimits('1.2.3.4', kv);
    expect(res).toBeNull();
  });

  it('rejects when per-IP hourly limit exceeded', async () => {
    const kv = createMockKV();
    kv.get.mockImplementation(async (key) => {
      if (key.startsWith('rate:1.2.3.4:') && key.includes('T')) return '10';
      return null;
    });

    const res = await checkRateLimits('1.2.3.4', kv);
    expect(res.status).toBe(429);
    expect(res.headers.get('Retry-After')).toBe('3600');
  });

  it('rejects when per-IP daily limit exceeded', async () => {
    const kv = createMockKV();
    kv.get.mockImplementation(async (key) => {
      if (key.startsWith('rate:1.2.3.4:') && !key.includes('T')) return '20';
      return null;
    });

    const res = await checkRateLimits('1.2.3.4', kv);
    expect(res.status).toBe(429);
    expect(res.headers.get('Retry-After')).toBe('86400');
  });

  it('rejects with 503 when global daily limit exceeded', async () => {
    const kv = createMockKV();
    kv.get.mockImplementation(async (key) => {
      if (key.startsWith('rate:global:')) return '500';
      return null;
    });

    const res = await checkRateLimits('1.2.3.4', kv);
    expect(res.status).toBe(503);
  });

  it('returns null (skips rate limiting) when KV throws', async () => {
    const kv = createMockKV();
    kv.get.mockRejectedValue(new Error('KV unavailable'));

    const res = await checkRateLimits('1.2.3.4', kv);
    expect(res).toBeNull();
  });

  it('rate limit messages mention saved templates still work', async () => {
    const kv = createMockKV();
    kv.get.mockImplementation(async (key) => {
      if (key.startsWith('rate:1.2.3.4:') && key.includes('T')) return '10';
      return null;
    });

    const res = await checkRateLimits('1.2.3.4', kv);
    const body = await res.json();
    expect(body.error).toContain('saved templates');
  });
});

describe('incrementRateLimits', () => {
  it('increments all three counters', async () => {
    const kv = createMockKV();
    await incrementRateLimits('1.2.3.4', kv);

    expect(kv.put).toHaveBeenCalledTimes(3);

    // Check the values written are "1" (0 + 1)
    const putCalls = kv.put.mock.calls;
    for (const call of putCalls) {
      expect(call[1]).toBe('1');
    }
  });

  it('increments existing counts', async () => {
    const kv = createMockKV();
    kv.get.mockResolvedValue('5');

    await incrementRateLimits('1.2.3.4', kv);

    const putCalls = kv.put.mock.calls;
    for (const call of putCalls) {
      expect(call[1]).toBe('6');
    }
  });

  it('sets TTL on counters', async () => {
    const kv = createMockKV();
    await incrementRateLimits('1.2.3.4', kv);

    const putCalls = kv.put.mock.calls;
    // Hour counter gets 3600s TTL
    const hourCall = putCalls.find((c) => c[0].includes('T'));
    expect(hourCall[2]).toEqual({ expirationTtl: 3600 });

    // Day counters get 86400s TTL
    const dayCalls = putCalls.filter((c) => !c[0].includes('T'));
    for (const call of dayCalls) {
      expect(call[2]).toEqual({ expirationTtl: 86400 });
    }
  });
});

// ── Layer 4: Payload Validation ──────────────────────────────────────────────

describe('validatePayload', () => {
  it('returns null for valid payload', () => {
    expect(validatePayload(validBody())).toBeNull();
  });

  it('rejects null body', () => {
    const res = validatePayload(null);
    expect(res.status).toBe(400);
  });

  it('rejects missing calendarText', () => {
    const res = validatePayload({ action: 'initial_analysis' });
    expect(res.status).toBe(400);
  });

  it('rejects non-string calendarText', () => {
    const res = validatePayload({ action: 'initial_analysis', calendarText: 123 });
    expect(res.status).toBe(400);
  });

  it('rejects text shorter than 50 chars', () => {
    const res = validatePayload({ action: 'initial_analysis', calendarText: 'short' });
    expect(res.status).toBe(400);
    expect(res).not.toBeNull();
  });

  it('rejects text longer than 30,000 chars', () => {
    const res = validatePayload({
      action: 'initial_analysis',
      calendarText: 'A'.repeat(30_001),
    });
    expect(res.status).toBe(400);
  });

  it('accepts exactly 50 chars', () => {
    expect(
      validatePayload({ action: 'initial_analysis', calendarText: 'A'.repeat(50) })
    ).toBeNull();
  });

  it('accepts exactly 30,000 chars', () => {
    expect(
      validatePayload({ action: 'initial_analysis', calendarText: 'A'.repeat(30_000) })
    ).toBeNull();
  });

  it('rejects missing action', () => {
    const res = validatePayload({ calendarText: 'A'.repeat(100) });
    expect(res.status).toBe(400);
  });

  it('rejects invalid action', () => {
    const res = validatePayload({
      action: 'hack_the_planet',
      calendarText: 'A'.repeat(100),
    });
    expect(res.status).toBe(400);
  });

  it('accepts "correction" action', () => {
    expect(
      validatePayload({ action: 'correction', calendarText: 'A'.repeat(100) })
    ).toBeNull();
  });
});

// ── Layer 5: Request Deduplication ───────────────────────────────────────────

describe('checkDedup', () => {
  it('returns null on cache miss', async () => {
    const kv = createMockKV();
    const res = await checkDedup('1.2.3.4', 'some text', 'initial_analysis', kv);
    expect(res).toBeNull();
  });

  it('returns cached response on cache hit', async () => {
    const cachedData = JSON.stringify({ foo: 'bar' });
    const text = 'some calendar text';
    const action = 'initial_analysis';
    const hash = await sha256(text + ':' + action);
    const kv = createMockKV({ [`dedup:1.2.3.4:${hash}`]: cachedData });

    const res = await checkDedup('1.2.3.4', text, action, kv);
    expect(res).not.toBeNull();
    expect(res.status).toBe(200);
    expect(res.headers.get('X-ScrapeGoat-Cache')).toBe('hit');

    const body = await res.json();
    expect(body.foo).toBe('bar');
  });

  it('does not return cache hit for same text but different action', async () => {
    const cachedData = JSON.stringify({ foo: 'bar' });
    const text = 'some calendar text';
    const hash = await sha256(text + ':initial_analysis');
    const kv = createMockKV({ [`dedup:1.2.3.4:${hash}`]: cachedData });

    const res = await checkDedup('1.2.3.4', text, 'correction', kv);
    expect(res).toBeNull();
  });

  it('returns null (skips dedup) when KV throws', async () => {
    const kv = createMockKV();
    kv.get.mockRejectedValue(new Error('KV unavailable'));

    const res = await checkDedup('1.2.3.4', 'text', 'initial_analysis', kv);
    expect(res).toBeNull();
  });
});

describe('cacheResponse', () => {
  it('stores response in KV with correct key and TTL', async () => {
    const kv = createMockKV();
    const text = 'calendar text';
    const action = 'initial_analysis';
    const hash = await sha256(text + ':' + action);

    await cacheResponse('1.2.3.4', text, action, '{"result":"ok"}', kv);

    expect(kv.put).toHaveBeenCalledWith(
      `dedup:1.2.3.4:${hash}`,
      '{"result":"ok"}',
      { expirationTtl: 3600 }
    );
  });
});

// ── Gemini Proxy ─────────────────────────────────────────────────────────────

describe('buildUserPrompt', () => {
  it('builds initial analysis prompt', () => {
    const prompt = buildUserPrompt({
      action: 'initial_analysis',
      calendarText: 'March 12 - Big Event',
    });
    expect(prompt).toContain('Analyze this calendar text');
    expect(prompt).toContain('March 12 - Big Event');
  });

  it('builds correction prompt with profile and corrections', () => {
    const prompt = buildUserPrompt({
      action: 'correction',
      calendarText: 'March 12 - Big Event',
      currentProfile: { structure: 'block' },
      corrections: [{ eventIndex: 0, flaggedFields: ['dates'] }],
    });
    expect(prompt).toContain('flagged these fields as incorrect');
    expect(prompt).toContain('March 12 - Big Event');
    expect(prompt).toContain('"structure"');
    expect(prompt).toContain('"flaggedFields"');
  });
});

describe('callGemini', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('returns parsed data on successful response', async () => {
    const geminiResponse = {
      candidates: [
        {
          content: {
            parts: [{ text: '{"documentStructure":{"options":[]}}' }],
          },
        },
      ],
    };

    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify(geminiResponse), { status: 200 })
    );

    const result = await callGemini(validBody(), 'test-key');
    expect(result.ok).toBe(true);
    expect(result.data).toEqual({ documentStructure: { options: [] } });
  });

  it('returns error when Gemini returns non-200', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response('error', { status: 500 })
    );

    const result = await callGemini(validBody(), 'test-key');
    expect(result.ok).toBe(false);
    expect(result.error).toBe('AI service error');
  });

  it('returns error when response has no candidates', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ candidates: [] }), { status: 200 })
    );

    const result = await callGemini(validBody(), 'test-key');
    expect(result.ok).toBe(false);
    expect(result.error).toBe('AI returned unexpected response');
  });

  it('returns error when candidate text is not valid JSON', async () => {
    const geminiResponse = {
      candidates: [{ content: { parts: [{ text: 'not json' }] } }],
    };

    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify(geminiResponse), { status: 200 })
    );

    const result = await callGemini(validBody(), 'test-key');
    expect(result.ok).toBe(false);
    expect(result.error).toBe('AI returned unexpected response');
  });

  it('returns error on network failure', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new Error('Network error'));

    const result = await callGemini(validBody(), 'test-key');
    expect(result.ok).toBe(false);
    expect(result.error).toBe('AI service unavailable');
  });

  it('returns error on timeout (AbortError)', async () => {
    const abortError = new DOMException('signal is aborted', 'AbortError');
    vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(abortError);

    const result = await callGemini(validBody(), 'test-key');
    expect(result.ok).toBe(false);
    expect(result.error).toBe('AI request timed out');
  });

  it('sends system prompt in request body', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          candidates: [{ content: { parts: [{ text: '{}' }] } }],
        }),
        { status: 200 }
      )
    );

    await callGemini(validBody(), 'test-key');

    const sentBody = JSON.parse(fetchSpy.mock.calls[0][1].body);
    expect(sentBody.system_instruction.parts[0].text).toBe(SYSTEM_PROMPT);
  });

  it('requests JSON response format', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          candidates: [{ content: { parts: [{ text: '{}' }] } }],
        }),
        { status: 200 }
      )
    );

    await callGemini(validBody(), 'test-key');

    const sentBody = JSON.parse(fetchSpy.mock.calls[0][1].body);
    expect(sentBody.generationConfig.responseMimeType).toBe('application/json');
  });
});

// ── CORS Helpers ─────────────────────────────────────────────────────────────

describe('corsHeaders', () => {
  it('sets correct origin for allowed origins', () => {
    const headers = corsHeaders('https://scrapegoat.pages.dev');
    expect(headers['Access-Control-Allow-Origin']).toBe('https://scrapegoat.pages.dev');
  });

  it('omits Access-Control-Allow-Origin for disallowed origins', () => {
    const headers = corsHeaders('https://evil.com');
    expect(headers['Access-Control-Allow-Origin']).toBeUndefined();
  });

  it('allows POST and OPTIONS methods', () => {
    const headers = corsHeaders('https://scrapegoat.pages.dev');
    expect(headers['Access-Control-Allow-Methods']).toContain('POST');
    expect(headers['Access-Control-Allow-Methods']).toContain('OPTIONS');
  });
});

describe('addHeaders', () => {
  it('merges headers into existing response', () => {
    const response = new Response('body', {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
    const result = addHeaders(response, { 'X-Custom': 'value' });
    expect(result.headers.get('X-Custom')).toBe('value');
    expect(result.headers.get('Content-Type')).toBe('application/json');
    expect(result.status).toBe(200);
  });
});

// ── Full Integration (worker.fetch) ──────────────────────────────────────────

describe('worker.fetch integration', () => {
  /** Stubs Turnstile + Gemini fetch calls for happy-path tests. */
  function stubExternalFetches(geminiData = { documentStructure: { options: [] } }) {
    let callCount = 0;
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
      callCount++;
      const urlStr = typeof url === 'string' ? url : url.toString();

      // Turnstile verification
      if (urlStr.includes('turnstile')) {
        return new Response(JSON.stringify({ success: true }));
      }

      // Gemini API
      if (urlStr.includes('generativelanguage')) {
        return new Response(
          JSON.stringify({
            candidates: [
              { content: { parts: [{ text: JSON.stringify(geminiData) }] } },
            ],
          }),
          { status: 200 }
        );
      }

      return new Response('Not found', { status: 404 });
    });
  }

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('handles OPTIONS preflight with 204', async () => {
    const req = makeRequest({ method: 'OPTIONS' });
    const env = createMockEnv();
    const res = await worker.fetch(req, env);
    expect(res.status).toBe(204);
  });

  it('rejects GET requests', async () => {
    const req = makeRequest({ method: 'GET' });
    const env = createMockEnv();
    const res = await worker.fetch(req, env);
    expect(res.status).toBe(405);
  });

  it('rejects request from disallowed origin', async () => {
    const req = makeRequest({ origin: 'https://evil.com', body: validBody() });
    const env = createMockEnv();
    const res = await worker.fetch(req, env);
    expect(res.status).toBe(403);
  });

  it('rejects request with invalid Turnstile token', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ success: false }))
    );

    const body = validBody({ turnstileToken: 'bad' });
    const req = makeRequest({ body });
    const env = createMockEnv();
    const res = await worker.fetch(req, env);
    expect(res.status).toBe(403);
  });

  it('rejects request when rate limited', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ success: true }))
    );

    const kvStore = {};
    const env = createMockEnv(kvStore);
    // Simulate hourly rate limit hit
    env.KV.get.mockImplementation(async (key) => {
      if (key.includes('T')) return '10';
      return null;
    });

    const req = makeRequest({ body: validBody() });
    const res = await worker.fetch(req, env);
    expect(res.status).toBe(429);
  });

  it('rejects request with invalid payload', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ success: true }))
    );

    const body = { action: 'initial_analysis', calendarText: 'too short', turnstileToken: 'ok' };
    const req = makeRequest({ body });
    const env = createMockEnv();
    const res = await worker.fetch(req, env);
    expect(res.status).toBe(400);
  });

  it('returns 502 when Gemini fails', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
      const urlStr = typeof url === 'string' ? url : url.toString();
      if (urlStr.includes('turnstile')) {
        return new Response(JSON.stringify({ success: true }));
      }
      return new Response('error', { status: 500 });
    });

    const req = makeRequest({ body: validBody() });
    const env = createMockEnv();
    const res = await worker.fetch(req, env);
    expect(res.status).toBe(502);
  });

  it('returns 200 with Gemini data on happy path', async () => {
    const expectedData = {
      documentStructure: { options: [{ label: 'Block', value: 'block' }] },
    };
    stubExternalFetches(expectedData);

    const req = makeRequest({ body: validBody() });
    const env = createMockEnv();
    const res = await worker.fetch(req, env);

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.documentStructure.options[0].label).toBe('Block');
  });

  it('includes CORS headers on successful response', async () => {
    stubExternalFetches();

    const req = makeRequest({ body: validBody() });
    const env = createMockEnv();
    const res = await worker.fetch(req, env);

    expect(res.headers.get('Access-Control-Allow-Origin')).toBe(
      'https://scrapegoat.pages.dev'
    );
  });

  it('caches response after successful Gemini call', async () => {
    stubExternalFetches();

    const env = createMockEnv();
    const req = makeRequest({ body: validBody() });
    await worker.fetch(req, env);

    // Check that KV.put was called with a dedup key
    const dedupPuts = env.KV.put.mock.calls.filter((c) =>
      c[0].startsWith('dedup:')
    );
    expect(dedupPuts.length).toBe(1);
  });

  it('increments rate limit counters after successful call', async () => {
    stubExternalFetches();

    const env = createMockEnv();
    const req = makeRequest({ body: validBody() });
    await worker.fetch(req, env);

    // Check that KV.put was called with rate keys (3 rate + 1 dedup = 4 puts)
    const ratePuts = env.KV.put.mock.calls.filter((c) =>
      c[0].startsWith('rate:')
    );
    expect(ratePuts.length).toBe(3);
  });

  it('returns cached response on duplicate request', async () => {
    stubExternalFetches();

    const text = 'B'.repeat(100);
    const hash = await sha256(text + ':initial_analysis');
    const cachedData = JSON.stringify({ cached: true });

    const env = createMockEnv();
    env.KV.get.mockImplementation(async (key) => {
      if (key === `dedup:1.2.3.4:${hash}`) return cachedData;
      return null;
    });

    // Need to stub Turnstile for the request to get past layer 2
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ success: true }))
    );

    const body = validBody({ calendarText: text });
    const req = makeRequest({ body });
    const res = await worker.fetch(req, env);

    expect(res.status).toBe(200);
    expect(res.headers.get('X-ScrapeGoat-Cache')).toBe('hit');
    const data = await res.json();
    expect(data.cached).toBe(true);
  });

  it('rejects oversized body', async () => {
    // Create a body that exceeds 100KB
    const oversizedText = 'A'.repeat(30_000);
    const oversizedBody = {
      action: 'initial_analysis',
      calendarText: oversizedText,
      turnstileToken: 'token',
      // Pad to exceed 100KB
      padding: 'X'.repeat(80_000),
    };

    const headers = new Headers();
    headers.set('Origin', 'https://scrapegoat.pages.dev');
    headers.set('cf-connecting-ip', '1.2.3.4');
    headers.set('Content-Type', 'application/json');

    const req = new Request('https://scrapegoat-api.workers.dev/api/analyze', {
      method: 'POST',
      headers,
      body: JSON.stringify(oversizedBody),
    });
    const env = createMockEnv();
    const res = await worker.fetch(req, env);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe('Request too large');
  });

  it('rejects invalid JSON body', async () => {
    const headers = new Headers();
    headers.set('Origin', 'https://scrapegoat.pages.dev');
    headers.set('cf-connecting-ip', '1.2.3.4');
    headers.set('Content-Type', 'application/json');
    headers.set('Content-Length', '10');

    const req = new Request('https://scrapegoat-api.workers.dev/api/analyze', {
      method: 'POST',
      headers,
      body: 'not json!!',
    });
    const env = createMockEnv();
    const res = await worker.fetch(req, env);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('Invalid JSON');
  });
});

// ── System Prompt ────────────────────────────────────────────────────────────

describe('system prompt', () => {
  it('is hardcoded and contains required rules', () => {
    expect(SYSTEM_PROMPT).toContain('PDF calendar structure analyzer');
    expect(SYSTEM_PROMPT).toContain('ONLY analyze calendar/schedule text');
    expect(SYSTEM_PROMPT).toContain('NEVER answer questions');
    expect(SYSTEM_PROMPT).toContain('unrecognized_format');
    expect(SYSTEM_PROMPT).toContain('"source" field');
    expect(SYSTEM_PROMPT).toContain('JSON only');
  });
});
