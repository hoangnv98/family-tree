import { get, put } from '@vercel/blob';

/**
 * Shared-tree storage API (Vercel serverless function).
 *   GET  /api/tree?id=<slug>  → load the stored tree JSON (404 if not created)
 *   POST /api/tree?id=<slug>  → overwrite it (last-write-wins)
 *
 * Backed by Vercel Blob. If no store is connected the token env var is absent
 * and every call returns 503 so the front-end can fall back to the bundled
 * static trees instead of breaking.
 */

const SLUG = /^[a-z0-9_-]{1,64}$/;

const pathFor = (id: string) => `trees/${id}.json`;

// A connected store authenticates one of two ways, and the SDK prefers the
// first: OIDC (BLOB_STORE_ID here + VERCEL_OIDC_TOKEN injected at runtime, so
// it never shows up in the dashboard's env list), or a read-write token, which
// is what `vercel env pull` gives you locally. Checking only for the token
// would 503 on a perfectly working OIDC deployment.
const hasStore = () =>
  Boolean(process.env.BLOB_READ_WRITE_TOKEN || process.env.BLOB_STORE_ID);

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
  if (!hasStore()) {
    return res.status(503).json({ ok: false, error: 'cloud chưa bật' });
  }

  if (req.method === 'GET') {
    // useCache:false reads from origin, not the CDN. Blobs are cached for a
    // minimum of a minute, so a cached read would hand back a tree that an
    // edit from seconds ago has already replaced.
    const found = await get(pathFor(id), { access: 'private', useCache: false });
    if (!found?.stream) {
      return res.status(404).json({ ok: false, error: 'chưa có cây này' });
    }
    const text = await new Response(found.stream).text();

    let data: unknown;
    try {
      data = JSON.parse(text);
    } catch {
      console.error(`[api/tree] ${pathFor(id)} holds unparseable data (${text.length} chars)`);
      return res.status(500).json({ ok: false, error: 'Dữ liệu lưu bị hỏng.' });
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
    const json = JSON.stringify(record);
    // The binding limit is now Vercel's ~4.5MB request body, not the store.
    if (json.length > 4_000_000) {
      return res
        .status(413)
        .json({ ok: false, error: 'Cây quá lớn (ảnh nhúng?). Hãy dùng ảnh nhẹ hơn.' });
    }
    await put(pathFor(id), json, {
      access: 'private',
      contentType: 'application/json',
      allowOverwrite: true,
      cacheControlMaxAge: 60, // the store's minimum; reads bypass it anyway
    });
    return res.status(200).json({ ok: true, updatedAt: record.updatedAt });
  }

  res.setHeader('Allow', 'GET, POST');
  return res.status(405).json({ ok: false, error: 'method not allowed' });
}
