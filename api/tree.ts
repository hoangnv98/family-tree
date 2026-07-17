import { Redis } from '@upstash/redis';

/**
 * Shared-tree storage API (Vercel serverless function).
 *   GET  /api/tree?id=<slug>  → load the stored tree JSON (404 if not created)
 *   POST /api/tree?id=<slug>  → overwrite it (last-write-wins)
 *
 * Backed by Upstash Redis / Vercel KV. If no store is provisioned the env vars
 * are absent and every call returns 503 so the front-end can fall back to the
 * bundled static trees instead of breaking.
 */

function getRedis(): Redis | null {
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  return new Redis({ url, token });
}

const SLUG = /^[a-z0-9_-]{1,64}$/;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default async function handler(req: any, res: any) {
  try {
    return await route(req, res);
  } catch (err) {
    // Without this the store's error escapes the handler and Vercel turns it
    // into a bare 500, so the browser only ever sees "HTTP 500".
    const detail = err instanceof Error ? err.message : String(err);
    console.error(`[api/tree] ${req.method} id=${req.query?.id}: ${detail}`, err);
    return res.status(500).json({ ok: false, error: `Lỗi máy chủ: ${detail}` });
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function route(req: any, res: any) {
  const id = String(req.query?.id ?? '').toLowerCase();
  if (!SLUG.test(id)) {
    return res.status(400).json({ ok: false, error: 'id không hợp lệ' });
  }

  const redis = getRedis();
  if (!redis) {
    return res.status(503).json({ ok: false, error: 'cloud chưa bật' });
  }
  const key = `tree:${id}`;

  if (req.method === 'GET') {
    const raw = await redis.get(key);
    if (!raw) return res.status(404).json({ ok: false, error: 'chưa có cây này' });
    // The client auto-parses JSON, but hands back the raw string when parsing
    // fails — retry it here so a double-encoded record still loads.
    let data = raw;
    if (typeof raw === 'string') {
      try {
        data = JSON.parse(raw);
      } catch {
        console.error(`[api/tree] ${key} holds unparseable data (${raw.length} chars)`);
        return res.status(500).json({ ok: false, error: 'Dữ liệu lưu bị hỏng.' });
      }
    }
    return res.status(200).json({ ok: true, data });
  }

  if (req.method === 'POST') {
    let body = req.body;
    if (typeof body === 'string') {
      try {
        body = JSON.parse(body);
      } catch {
        body = null;
      }
    }
    if (!body || !Array.isArray(body.people) || !Array.isArray(body.relationships)) {
      return res.status(400).json({ ok: false, error: 'dữ liệu cây không hợp lệ' });
    }
    // Guard against oversized payloads (Upstash request limits); ~900KB of JSON.
    if (JSON.stringify(body).length > 900_000) {
      return res
        .status(413)
        .json({ ok: false, error: 'Cây quá lớn (ảnh nhúng?). Hãy dùng ảnh nhẹ hơn.' });
    }
    const record = {
      version: 1,
      meta: body.meta ?? { name: 'Cây gia phả', exportedAt: new Date().toISOString() },
      people: body.people,
      relationships: body.relationships,
      ...(body.positions && typeof body.positions === 'object'
        ? { positions: body.positions }
        : {}),
      updatedAt: Date.now(),
    };
    await redis.set(key, record);
    return res.status(200).json({ ok: true, updatedAt: record.updatedAt });
  }

  res.setHeader('Allow', 'GET, POST');
  return res.status(405).json({ ok: false, error: 'method not allowed' });
}
