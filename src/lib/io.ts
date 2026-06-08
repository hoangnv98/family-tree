import {
  familyTreeFileSchema,
  type FamilyTreeFile,
  type Person,
  type Relationship,
} from '../types';

/** Build the export file object from current state. */
export function buildFile(
  people: Person[],
  relationships: Relationship[],
  name = 'Cây gia phả',
): FamilyTreeFile {
  return {
    version: 1,
    meta: { name, exportedAt: new Date().toISOString() },
    people,
    relationships,
  };
}

/** Trigger a browser download of the tree as a .json file. */
export function downloadJson(file: FamilyTreeFile): void {
  const blob = new Blob([JSON.stringify(file, null, 2)], {
    type: 'application/json',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const stamp = file.meta.exportedAt.slice(0, 10);
  a.href = url;
  a.download = `cay-gia-pha-${stamp}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export type ParseResult =
  | { ok: true; file: FamilyTreeFile }
  | { ok: false; error: string };

/** Parse + validate a JSON string into a FamilyTreeFile. */
export function parseFile(text: string): ParseResult {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, error: 'File không phải JSON hợp lệ.' };
  }
  const result = familyTreeFileSchema.safeParse(raw);
  if (!result.success) {
    const first = result.error.issues[0];
    const path = first?.path.join('.') || '(gốc)';
    return {
      ok: false,
      error: `Cấu trúc file không đúng định dạng cây gia phả (lỗi tại "${path}": ${first?.message}).`,
    };
  }
  return { ok: true, file: result.data };
}

/** Read a File object (from <input type=file>) and validate it. */
export function readFile(file: File): Promise<ParseResult> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(parseFile(String(reader.result ?? '')));
    reader.onerror = () => resolve({ ok: false, error: 'Không đọc được file.' });
    reader.readAsText(file);
  });
}

/** Read an image File into a data URL for inline storage. */
export function readImageAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.onerror = () => reject(new Error('Không đọc được ảnh.'));
    reader.readAsDataURL(file);
  });
}
