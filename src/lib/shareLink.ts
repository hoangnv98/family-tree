import { parseFile, type ParseResult } from './io';

/**
 * "Share by URL" support: a tree opened with `?tree=<name>` is the shared tree
 * with id `<name>`. CloudSync loads it from the cloud store (see lib/cloud.ts),
 * falling back to a bundled `public/trees/<name>.json` when the cloud is off.
 */

/** Read + sanitise the `?tree=` param. Returns null when absent/invalid. */
export function getSharedTreeName(): string | null {
  const raw = new URLSearchParams(window.location.search).get('tree');
  if (!raw) return null;
  // Only a safe slug — blocks path traversal / nested fetches.
  const name = raw.trim().toLowerCase();
  return /^[a-z0-9_-]+$/.test(name) ? name : null;
}

/** Fetch + validate a bundled static tree by name (cloud-off fallback / seed). */
export async function fetchSharedTree(name: string): Promise<ParseResult> {
  let res: Response;
  try {
    res = await fetch(`./trees/${name}.json`, { cache: 'no-cache' });
  } catch {
    return { ok: false, error: 'Không tải được dữ liệu cây gia phả.' };
  }
  if (!res.ok) {
    return {
      ok: false,
      error: `Không tìm thấy cây gia phả "${name}" (HTTP ${res.status}).`,
    };
  }
  return parseFile(await res.text());
}
