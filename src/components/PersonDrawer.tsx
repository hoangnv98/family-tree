import { useRef, type ReactNode } from 'react';
import { nanoid } from 'nanoid';
import {
  X,
  Trash2,
  Upload,
  Plus,
  Heart,
  Baby,
  UserRound,
  Camera,
  Lock,
} from 'lucide-react';
import { useTreeStore } from '../store/treeStore';
import { readImageAsDataUrl } from '../lib/io';
import {
  fullName,
  GENDERS,
  type Gender,
  type Person,
  type ParentRelationship,
  type SpouseRelationship,
} from '../types';

/* ----------------------------- field helpers ----------------------------- */

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-ink/55 dark:text-white/55">
        {label}
      </span>
      {children}
    </label>
  );
}

const inputCls =
  'w-full rounded-lg border border-ink/10 bg-surface-100 px-3 py-2 text-sm text-ink outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20 dark:border-white/10 dark:bg-surface-400 dark:text-white';

function SectionTitle({ icon, children }: { icon?: ReactNode; children: ReactNode }) {
  return (
    <h4 className="mb-3 mt-6 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-ink/45 dark:text-white/45">
      {icon}
      {children}
    </h4>
  );
}

const genderLabel: Record<Gender, string> = {
  male: 'Nam',
  female: 'Nữ',
  other: 'Khác',
};

/* --------------------------- relationship editor -------------------------- */

function AddRelation({
  candidates,
  onAdd,
  placeholder,
}: {
  candidates: Person[];
  onAdd: (id: string) => void;
  placeholder: string;
}) {
  const ref = useRef<HTMLSelectElement>(null);
  if (candidates.length === 0) return null;
  return (
    <div className="flex gap-2">
      <select ref={ref} defaultValue="" className={inputCls}>
        <option value="" disabled>
          {placeholder}
        </option>
        {candidates.map((p) => (
          <option key={p.id} value={p.id}>
            {fullName(p)}
          </option>
        ))}
      </select>
      <button
        onClick={() => {
          if (ref.current?.value) {
            onAdd(ref.current.value);
            ref.current.value = '';
          }
        }}
        className="flex shrink-0 items-center gap-1 rounded-lg bg-accent px-3 text-sm font-medium text-white hover:bg-accent/90"
      >
        <Plus className="h-4 w-4" />
      </button>
    </div>
  );
}

function RelationRow({ name, onRemove }: { name: string; onRemove: () => void }) {
  return (
    <div className="flex items-center justify-between rounded-lg bg-surface-200 px-3 py-1.5 text-sm text-ink dark:bg-surface-400 dark:text-white">
      <span className="truncate">{name}</span>
      <button
        onClick={onRemove}
        className="ml-2 text-ink/40 hover:text-crimson dark:text-white/40"
        title="Gỡ quan hệ"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

/* -------------------------------- drawer ---------------------------------- */

export function PersonDrawer({
  personId,
  onClose,
  onRequestDelete,
}: {
  personId: string | null;
  onClose: () => void;
  onRequestDelete: (id: string) => void;
}) {
  const people = useTreeStore((s) => s.people);
  const relationships = useTreeStore((s) => s.relationships);
  const updatePerson = useTreeStore((s) => s.updatePerson);
  const addRelationship = useTreeStore((s) => s.addRelationship);
  const removeRelationship = useTreeStore((s) => s.removeRelationship);
  const readOnly = useTreeStore((s) => s.readOnly);

  const person = personId ? people.find((p) => p.id === personId) ?? null : null;
  const open = !!person;

  const set = (patch: Partial<Person>) => person && updatePerson(person.id, patch);

  // derive related lists
  const parents = person
    ? relationships
        .filter((r): r is ParentRelationship => r.type === 'parent' && r.childId === person.id)
        .map((r) => ({ rid: r.id, p: people.find((x) => x.id === r.parentId) }))
        .filter((x) => x.p)
    : [];
  const children = person
    ? relationships
        .filter((r): r is ParentRelationship => r.type === 'parent' && r.parentId === person.id)
        .map((r) => ({ rid: r.id, p: people.find((x) => x.id === r.childId) }))
        .filter((x) => x.p)
    : [];
  const spouses = person
    ? relationships
        .filter(
          (r): r is SpouseRelationship =>
            r.type === 'spouse' && (r.aId === person.id || r.bId === person.id),
        )
        .map((r) => ({
          rid: r.id,
          p: people.find((x) => x.id === (r.aId === person.id ? r.bId : r.aId)),
        }))
        .filter((x) => x.p)
    : [];

  const relatedIds = new Set<string>([
    ...(person ? [person.id] : []),
    ...parents.map((x) => x.p!.id),
    ...children.map((x) => x.p!.id),
    ...spouses.map((x) => x.p!.id),
  ]);
  const candidates = people.filter((p) => !relatedIds.has(p.id));

  const onUploadPhoto = async (file?: File) => {
    if (!file) return;
    const url = await readImageAsDataUrl(file);
    set({ photo: url });
  };

  return (
    <aside
      className={`fixed right-0 top-0 z-40 flex h-full w-full max-w-md flex-col border-l border-ink/10 bg-canvas shadow-float transition-transform duration-300 dark:border-white/10 dark:bg-surface-500 ${
        open ? 'translate-x-0' : 'translate-x-full'
      }`}
    >
      {person && (
        <>
          {/* header */}
          <div className="flex items-center justify-between border-b border-ink/10 px-5 py-4 dark:border-white/10">
            <h3 className="text-sm font-semibold text-ink dark:text-white">
              Thông tin thành viên
            </h3>
            <div className="flex items-center gap-1">
              {!readOnly && (
                <button
                  onClick={() => onRequestDelete(person.id)}
                  className="rounded-lg p-2 text-ink/50 hover:bg-crimson/10 hover:text-crimson dark:text-white/50"
                  title="Xoá thành viên"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
              <button
                onClick={onClose}
                className="rounded-lg p-2 text-ink/50 hover:bg-surface-300 dark:text-white/50 dark:hover:bg-white/10"
                title="Đóng"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* body — a disabled fieldset turns the whole form read-only in
              locked view (inputs + relationship add/remove all greyed out). */}
          <fieldset
            disabled={readOnly}
            className="scroll-thin flex-1 overflow-y-auto border-0 p-0 disabled:opacity-100"
          >
          <div className="px-5 pb-10">
            {/* avatar */}
            <div className="mt-5 flex items-center gap-4">
              <div className="relative">
                <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-full bg-surface-300 ring-2 ring-ink/10 dark:bg-surface-400 dark:ring-white/10">
                  {person.photo ? (
                    <img src={person.photo} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <UserRound className="h-9 w-9 text-ink/30 dark:text-white/30" />
                  )}
                </div>
                <label className="absolute -bottom-1 -right-1 flex h-7 w-7 cursor-pointer items-center justify-center rounded-full bg-accent text-white shadow-float hover:bg-accent/90">
                  <Camera className="h-3.5 w-3.5" />
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => onUploadPhoto(e.target.files?.[0])}
                  />
                </label>
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-lg font-semibold text-ink dark:text-white">
                  {fullName(person)}
                </div>
                {person.photo && (
                  <button
                    onClick={() => set({ photo: undefined })}
                    className="mt-1 text-xs text-ink/40 hover:text-crimson dark:text-white/40"
                  >
                    Xoá ảnh
                  </button>
                )}
              </div>
            </div>

            {/* Cơ bản */}
            <SectionTitle>Cơ bản</SectionTitle>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Họ">
                <input
                  className={inputCls}
                  value={person.lastName}
                  onChange={(e) => set({ lastName: e.target.value })}
                />
              </Field>
              <Field label="Tên">
                <input
                  className={inputCls}
                  value={person.firstName}
                  onChange={(e) => set({ firstName: e.target.value })}
                />
              </Field>
              <Field label="Giới tính">
                <select
                  className={inputCls}
                  value={person.gender}
                  onChange={(e) => set({ gender: e.target.value as Gender })}
                >
                  {GENDERS.map((g) => (
                    <option key={g} value={g}>
                      {genderLabel[g]}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Nghề nghiệp">
                <input
                  className={inputCls}
                  value={person.occupation ?? ''}
                  onChange={(e) => set({ occupation: e.target.value })}
                />
              </Field>
              <Field label="Năm sinh">
                <input
                  type="number"
                  className={inputCls}
                  value={person.birthYear ?? ''}
                  onChange={(e) =>
                    set({ birthYear: e.target.value ? Number(e.target.value) : undefined })
                  }
                />
              </Field>
              <Field label="Năm mất">
                <input
                  type="number"
                  className={inputCls}
                  value={person.deathYear ?? ''}
                  onChange={(e) =>
                    set({ deathYear: e.target.value ? Number(e.target.value) : undefined })
                  }
                />
              </Field>
            </div>

            {/* Quan hệ */}
            <SectionTitle icon={<Heart className="h-3.5 w-3.5" />}>Quan hệ</SectionTitle>
            <div className="space-y-3">
              <div>
                <p className="mb-1 text-xs text-ink/45 dark:text-white/45">Cha / mẹ</p>
                <div className="space-y-1.5">
                  {parents.map((x) => (
                    <RelationRow
                      key={x.rid}
                      name={fullName(x.p!)}
                      onRemove={() => removeRelationship(x.rid)}
                    />
                  ))}
                  <AddRelation
                    candidates={candidates}
                    placeholder="Thêm cha / mẹ…"
                    onAdd={(pid) =>
                      addRelationship({ type: 'parent', parentId: pid, childId: person.id })
                    }
                  />
                </div>
              </div>
              <div>
                <p className="mb-1 flex items-center gap-1 text-xs text-ink/45 dark:text-white/45">
                  Vợ / chồng
                </p>
                <div className="space-y-1.5">
                  {spouses.map((x) => (
                    <RelationRow
                      key={x.rid}
                      name={fullName(x.p!)}
                      onRemove={() => removeRelationship(x.rid)}
                    />
                  ))}
                  <AddRelation
                    candidates={candidates}
                    placeholder="Thêm vợ / chồng…"
                    onAdd={(pid) =>
                      addRelationship({ type: 'spouse', aId: person.id, bId: pid })
                    }
                  />
                </div>
              </div>
              <div>
                <p className="mb-1 flex items-center gap-1 text-xs text-ink/45 dark:text-white/45">
                  <Baby className="h-3.5 w-3.5" /> Con
                </p>
                <div className="space-y-1.5">
                  {children.map((x) => (
                    <RelationRow
                      key={x.rid}
                      name={fullName(x.p!)}
                      onRemove={() => removeRelationship(x.rid)}
                    />
                  ))}
                  <AddRelation
                    candidates={candidates}
                    placeholder="Thêm con…"
                    onAdd={(pid) =>
                      addRelationship({ type: 'parent', parentId: person.id, childId: pid })
                    }
                  />
                </div>
              </div>
            </div>

            {/* Liên hệ */}
            <SectionTitle>Liên hệ</SectionTitle>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Điện thoại">
                <input
                  className={inputCls}
                  value={person.phone ?? ''}
                  onChange={(e) => set({ phone: e.target.value })}
                />
              </Field>
              <Field label="Email">
                <input
                  className={inputCls}
                  value={person.email ?? ''}
                  onChange={(e) => set({ email: e.target.value })}
                />
              </Field>
              <div className="col-span-2">
                <Field label="Địa chỉ">
                  <input
                    className={inputCls}
                    value={person.address ?? ''}
                    onChange={(e) => set({ address: e.target.value })}
                  />
                </Field>
              </div>
            </div>

            {/* Sự kiện */}
            <SectionTitle>Sự kiện</SectionTitle>
            <Field label="Nơi sinh">
              <input
                className={inputCls}
                value={person.birthPlace ?? ''}
                onChange={(e) => set({ birthPlace: e.target.value })}
              />
            </Field>
            <div className="mt-3 space-y-3">
              {(person.events ?? []).map((ev) => (
                <div
                  key={ev.id}
                  className="rounded-lg border border-ink/10 bg-surface-100 p-3 dark:border-white/10 dark:bg-surface-400"
                >
                  <div className="mb-2 flex gap-2">
                    <input
                      className={inputCls}
                      placeholder="Loại sự kiện (cưới, tốt nghiệp…)"
                      value={ev.type}
                      onChange={(e) =>
                        set({
                          events: (person.events ?? []).map((x) =>
                            x.id === ev.id ? { ...x, type: e.target.value } : x,
                          ),
                        })
                      }
                    />
                    <button
                      onClick={() =>
                        set({ events: (person.events ?? []).filter((x) => x.id !== ev.id) })
                      }
                      className="shrink-0 rounded-lg px-2 text-ink/40 hover:text-crimson dark:text-white/40"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      className={inputCls}
                      placeholder="Ngày"
                      value={ev.date ?? ''}
                      onChange={(e) =>
                        set({
                          events: (person.events ?? []).map((x) =>
                            x.id === ev.id ? { ...x, date: e.target.value } : x,
                          ),
                        })
                      }
                    />
                    <input
                      className={inputCls}
                      placeholder="Nơi chốn"
                      value={ev.place ?? ''}
                      onChange={(e) =>
                        set({
                          events: (person.events ?? []).map((x) =>
                            x.id === ev.id ? { ...x, place: e.target.value } : x,
                          ),
                        })
                      }
                    />
                  </div>
                </div>
              ))}
              <button
                onClick={() =>
                  set({
                    events: [...(person.events ?? []), { id: nanoid(6), type: '' }],
                  })
                }
                className="flex w-full items-center justify-center gap-1 rounded-lg border border-dashed border-ink/20 py-2 text-sm text-ink/55 hover:border-accent hover:text-accent dark:border-white/20 dark:text-white/55"
              >
                <Plus className="h-4 w-4" /> Thêm sự kiện
              </button>
            </div>

            {/* Tiểu sử & ghi chú */}
            <SectionTitle>Tiểu sử &amp; ghi chú</SectionTitle>
            <Field label="Tiểu sử">
              <textarea
                rows={3}
                className={inputCls}
                value={person.bio ?? ''}
                onChange={(e) => set({ bio: e.target.value })}
              />
            </Field>
            <div className="mt-3">
              <Field label="Ghi chú">
                <textarea
                  rows={2}
                  className={inputCls}
                  value={person.notes ?? ''}
                  onChange={(e) => set({ notes: e.target.value })}
                />
              </Field>
            </div>
          </div>
          </fieldset>

          {/* footer hint */}
          <div className="border-t border-ink/10 px-5 py-3 text-xs text-ink/40 dark:border-white/10 dark:text-white/40">
            {readOnly ? (
              <>
                <Lock className="mr-1 inline h-3 w-3" />
                Đang xem ở chế độ chỉ đọc.
              </>
            ) : (
              <>
                <Upload className="mr-1 inline h-3 w-3" />
                Mọi thay đổi được lưu tự động vào trình duyệt.
              </>
            )}
          </div>
        </>
      )}
    </aside>
  );
}
