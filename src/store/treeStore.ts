import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { nanoid } from 'nanoid';
import type {
  Person,
  Relationship,
  RelationshipInput,
  FamilyTreeFile,
  PositionMap,
} from '../types';
import { sampleData } from '../lib/sample';
import { getSharedTreeName } from '../lib/shareLink';

// When viewing a shared tree (`?tree=...`), persistence is disabled so the
// shared data never clobbers the user's locally-saved draft.
const isSharedView = getSharedTreeName() !== null;
// A shared tree starts locked; CloudSync unlocks it once it confirms the cloud
// store is on (so anyone with the link can edit). If the cloud is off we keep
// it read-only and fall back to the bundled static file.
const readOnly = isSharedView;
const noopStorage = {
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {},
};

interface TreeState {
  people: Person[];
  relationships: Relationship[];
  selectedId: string | null;
  search: string;
  dark: boolean;
  layoutTick: number;
  pngTick: number;
  fitTick: number;
  /** Locked view: editing UI is hidden (shared tree while cloud is off). */
  readOnly: boolean;
  /** Cloud autosave status for the shared (`?tree=`) editing session. */
  cloudSave: 'off' | 'idle' | 'saving' | 'saved' | 'error';
  /** Show a "Dâu" / "Rể" tag on married-in spouses. */
  showInLaw: boolean;
  /** 'tree' = horizontal node-link; 'vertical' = indented from generation 3. */
  layoutMode: 'tree' | 'vertical';
  /** Saved node positions (manual drags + last auto-layout), keyed by person id. */
  positions: PositionMap;

  // selection / ui
  setReadOnly: (v: boolean) => void;
  setPosition: (id: string, x: number, y: number) => void;
  setPositions: (map: PositionMap) => void;
  setCloudSave: (s: TreeState['cloudSave']) => void;
  setSelected: (id: string | null) => void;
  setSearch: (q: string) => void;
  toggleDark: () => void;
  toggleInLaw: () => void;
  toggleLayoutMode: () => void;
  requestLayout: () => void;
  requestPng: () => void;
  /** Re-center the view without recomputing positions (used after a cloud load). */
  requestFit: () => void;

  // person CRUD
  addPerson: (partial?: Partial<Person>) => string;
  updatePerson: (id: string, patch: Partial<Person>) => void;
  removePerson: (id: string) => void;

  // relationship CRUD
  addRelationship: (rel: RelationshipInput) => void;
  removeRelationship: (id: string) => void;

  // bulk
  loadFile: (file: FamilyTreeFile) => void;
  resetToSample: () => void;
  clearAll: () => void;
}

function newPerson(partial?: Partial<Person>): Person {
  return {
    id: nanoid(8),
    firstName: '',
    lastName: '',
    gender: 'other',
    ...partial,
  };
}

/** True if a parent/spouse link between the same pair already exists. */
function relExists(rels: Relationship[], rel: RelationshipInput): boolean {
  return rels.some((r) => {
    if (r.type !== rel.type) return false;
    if (r.type === 'parent' && rel.type === 'parent')
      return r.parentId === rel.parentId && r.childId === rel.childId;
    if (r.type === 'spouse' && rel.type === 'spouse')
      return (
        (r.aId === rel.aId && r.bId === rel.bId) ||
        (r.aId === rel.bId && r.bId === rel.aId)
      );
    return false;
  });
}

export const useTreeStore = create<TreeState>()(
  persist(
    (set) => ({
      ...sampleData(),
      selectedId: null,
      search: '',
      dark: false,
      layoutTick: 0,
      pngTick: 0,
      fitTick: 0,
      readOnly,
      cloudSave: 'off',
      showInLaw: true,
      layoutMode: 'vertical',
      positions: {},

      setReadOnly: (v) => set({ readOnly: v }),
      setCloudSave: (s) => set({ cloudSave: s }),
      setPosition: (id, x, y) =>
        set((s) => ({ positions: { ...s.positions, [id]: { x, y } } })),
      setPositions: (map) => set({ positions: map }),
      setSelected: (id) => set({ selectedId: id }),
      setSearch: (q) => set({ search: q }),
      toggleDark: () => set((s) => ({ dark: !s.dark })),
      toggleInLaw: () => set((s) => ({ showInLaw: !s.showInLaw })),
      // switch layout + request a re-layout so positions recompute immediately.
      toggleLayoutMode: () =>
        set((s) => ({
          layoutMode: s.layoutMode === 'tree' ? 'vertical' : 'tree',
          layoutTick: s.layoutTick + 1,
        })),
      requestLayout: () => set((s) => ({ layoutTick: s.layoutTick + 1 })),
      requestPng: () => set((s) => ({ pngTick: s.pngTick + 1 })),
      requestFit: () => set((s) => ({ fitTick: s.fitTick + 1 })),

      addPerson: (partial) => {
        const person = newPerson(partial);
        set((s) => ({ people: [...s.people, person], selectedId: person.id }));
        return person.id;
      },

      updatePerson: (id, patch) =>
        set((s) => ({
          people: s.people.map((p) => (p.id === id ? { ...p, ...patch } : p)),
        })),

      removePerson: (id) =>
        set((s) => {
          const positions = { ...s.positions };
          delete positions[id];
          return {
            people: s.people.filter((p) => p.id !== id),
            relationships: s.relationships.filter((r) =>
              r.type === 'parent'
                ? r.parentId !== id && r.childId !== id
                : r.aId !== id && r.bId !== id,
            ),
            positions,
            selectedId: s.selectedId === id ? null : s.selectedId,
          };
        }),

      addRelationship: (rel) =>
        set((s) => {
          if (relExists(s.relationships, rel)) return s;
          return {
            relationships: [...s.relationships, { ...rel, id: nanoid(8) } as Relationship],
          };
        }),

      removeRelationship: (id) =>
        set((s) => ({ relationships: s.relationships.filter((r) => r.id !== id) })),

      loadFile: (file) =>
        set({
          people: file.people,
          relationships: file.relationships,
          positions: file.positions ?? {},
          selectedId: null,
          search: '',
        }),

      resetToSample: () =>
        set({ ...sampleData(), positions: {}, selectedId: null, search: '' }),
      clearAll: () =>
        set({ people: [], relationships: [], positions: {}, selectedId: null, search: '' }),
    }),
    {
      name: 'family-tree-v1',
      storage: createJSONStorage(() => (isSharedView ? noopStorage : localStorage)),
      partialize: (s) => ({
        people: s.people,
        relationships: s.relationships,
        positions: s.positions,
        dark: s.dark,
        showInLaw: s.showInLaw,
        layoutMode: s.layoutMode,
      }),
    },
  ),
);

/** Convenience selectors */
export const selectPerson = (id: string | null) => (s: TreeState) =>
  id ? s.people.find((p) => p.id === id) ?? null : null;
