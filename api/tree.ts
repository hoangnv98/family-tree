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
    const data = await redis.get(key);
    if (!data) return res.status(404).json({ ok: false, error: 'chưa có cây này' });
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
