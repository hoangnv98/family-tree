import { parseFile, type ParseResult } from './io';

/**
 * "Share by URL" support: when the app is opened with `?tree=<name>`, it loads
 * `public/trees/<name>.json` (a tree you previously exported and dropped in that
 * folder) instead of the locally-saved draft. Lets one static deploy serve any
 * number of trees by URL — e.g. `yoursite.com/?tree=giapha-ho-tran`.
 */

/** Read + sanitise the `?tree=` param. Returns null when absent/invalid. */
export function getSharedTreeName(): string | null {
  const raw = new URLSearchParams(window.location.search).get('tree');
  if (!raw) return null;
  // Only a safe slug — blocks path traversal / nested fetches.
  const name = raw.trim().toLowerCase();
  return /^[a-z0-9_-]+$/.test(name) ? name : null;
}

/** A shared tree opened with `&edit` is editable; without it, it's locked. */
export function isEditRequested(): boolean {
  return new URLSearchParams(window.location.search).has('edit');
}

/**
 * Read-only when viewing a shared tree without the `edit` flag. The local draft
 * (no `?tree=`) is always editable.
 */
export function isReadOnly(): boolean {
  return getSharedTreeName() !== null && !isEditRequested();
}

/** URL of the current shared tree with editing enabled (`?tree=...&edit`). */
export function editUrl(): string {
  const url = new URL(window.location.href);
  url.searchParams.set('edit', '1');
  return url.pathname + url.search;
}

/** Fetch + validate a shared tree by name. */
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
