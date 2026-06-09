import { customAlphabet } from 'nanoid';
import { familyTreeFileSchema, type FamilyTreeFile } from '../types';

/**
 * Client side of the shared-tree API (see `api/tree.ts`). A tree opened with
 * `?tree=<id>` is loaded from / saved to the cloud so anyone with the link can
 * edit it; last write wins. When the cloud isn't provisioned the API returns
 * 503 and callers fall back to the bundled static tree (read-only).
 */

export type CloudLoad =
  | { status: 'ok'; file: FamilyTreeFile }
  | { status: 'empty' } // cloud is on but this tree hasn't been created yet
  | { status: 'disabled' } // no store provisioned
  | { status: 'error'; error: string };

export async function loadCloudTree(id: string): Promise<CloudLoad> {
  let res: Response;
  try {
    res = await fetch(`/api/tree?id=${encodeURIComponent(id)}`, { cache: 'no-store' });
  } catch {
    return { status: 'error', error: 'Không gọi được máy chủ.' };
  }
  if (res.status === 503) return { status: 'disabled' };
  if (res.status === 404) return { status: 'empty' };
  if (!res.ok) return { status: 'error', error: `Lỗi tải (HTTP ${res.status}).` };

  const json = await res.json().catch(() => null);
  const parsed = familyTreeFileSchema.safeParse(json?.data);
  if (!parsed.success) return { status: 'error', error: 'Dữ liệu cloud không hợp lệ.' };
  return { status: 'ok', file: parsed.data };
}

export type CloudSaveResult =
  | { ok: true }
  | { ok: false; disabled?: boolean; error: string };

export async function saveCloudTree(
  id: string,
  file: FamilyTreeFile,
): Promise<CloudSaveResult> {
  let res: Response;
  try {
    res = await fetch(`/api/tree?id=${encodeURIComponent(id)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(file),
    });
  } catch {
    return { ok: false, error: 'Mất kết nối máy chủ.' };
  }
  if (res.status === 503) return { ok: false, disabled: true, error: 'Cloud chưa bật.' };
  if (!res.ok) {
    const j = await res.json().catch(() => null);
    return { ok: false, error: j?.error || `Lưu lỗi (HTTP ${res.status}).` };
  }
  return { ok: true };
}

// url-safe lowercase slug for new shared trees (matches the API's SLUG rule).
const slugId = customAlphabet('0123456789abcdefghijklmnopqrstuvwxyz', 10);
export const newTreeId = () => slugId();
