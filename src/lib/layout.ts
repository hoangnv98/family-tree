import type { Person, Relationship } from '../types';
import { computeGenerations } from './generations';

export const NODE_WIDTH = 260;
export const NODE_HEIGHT = 96;
// Compact "portrait" card used from generation 3 (cháu) down: narrow + tall,
// avatar on top and name below, so a deep column takes far less width.
export const NODE_WIDTH_COMPACT = 150;
export const NODE_HEIGHT_COMPACT = 116;

export interface Positioned {
  id: string;
  x: number;
  y: number;
}

const H_GAP = 40; // gap between sibling subtrees
const COUPLE_GAP = 36; // gap between a person and the spouse beside them
const RANK_GAP = 80; // vertical gap between generations
const FAMILY_GAP = 120; // gap between separate root families

/**
 * Tidy-tree auto-layout. A "unit" is a blood person plus the spouse(s) shown
 * beside them; its children hang directly below, centred under the unit and
 * packed tight, so children always sit under their own parents (never drifting
 * under an aunt/uncle) — "binary-tree" style. Generations are rows; gen 3+ uses
 * the narrow portrait card so deep rows stay compact.
 */
export function layoutTree(
  people: Person[],
  relationships: Relationship[],
): Positioned[] {
  const byId = new Map(people.map((p) => [p.id, p]));
  const genOf = computeGenerations(people, relationships);
  const wOf = (id: string) => ((genOf.get(id) ?? 1) >= 3 ? NODE_WIDTH_COMPACT : NODE_WIDTH);
  const hOf = (id: string) => ((genOf.get(id) ?? 1) >= 3 ? NODE_HEIGHT_COMPACT : NODE_HEIGHT);
  const gender = (id: string) => byId.get(id)?.gender;

  const parentsOf = new Map<string, string[]>();
  const childrenOf = new Map<string, string[]>();
  const spouseOf = new Map<string, string[]>();
  const push = (m: Map<string, string[]>, k: string, v: string) =>
    m.set(k, [...(m.get(k) ?? []), v]);
  for (const r of relationships) {
    if (r.type === 'spouse') {
      push(spouseOf, r.aId, r.bId);
      push(spouseOf, r.bId, r.aId);
    } else {
      push(childrenOf, r.parentId, r.childId);
      push(parentsOf, r.childId, r.parentId);
    }
  }
  // Sibling order: birthOrder (manual) first, then birth year, then list order.
  const order = new Map(people.map((p, i) => [p.id, i]));
  const sortSibs = (ids: string[]) =>
    [...ids].sort((a, b) => {
      const oa = byId.get(a)?.birthOrder;
      const ob = byId.get(b)?.birthOrder;
      if (oa != null && ob != null && oa !== ob) return oa - ob;
      if (oa != null && ob == null) return -1;
      if (ob != null && oa == null) return 1;
      const ya = byId.get(a)?.birthYear;
      const yb = byId.get(b)?.birthYear;
      if (ya != null && yb != null && ya !== yb) return ya - yb;
      return (order.get(a) ?? 0) - (order.get(b) ?? 0);
    });

  // ---- build the explicit tree: each blood node → its spouses + children ----
  const visited = new Set<string>();
  const besideOf = new Map<string, string[]>(); // blood node → spouse ids beside
  const kidsOf = new Map<string, string[]>(); // blood node → child blood nodes

  const isMarriedIn = (id: string) =>
    !(parentsOf.get(id)?.length) &&
    (spouseOf.get(id) ?? []).some((sp) => (parentsOf.get(sp)?.length ?? 0) > 0);

  const unitSpouses = (id: string) => {
    const ss = (spouseOf.get(id) ?? []).filter((s) => !visited.has(s));
    // married-in / not-yet-a-root spouses sit beside; order male-first handled later
    return ss;
  };
  const unitChildren = (id: string, spouses: string[]) => {
    const ids = [...(childrenOf.get(id) ?? [])];
    for (const sp of spouses)
      for (const c of childrenOf.get(sp) ?? []) if (!ids.includes(c)) ids.push(c);
    return sortSibs(ids).filter((c) => !visited.has(c));
  };
  const build = (id: string) => {
    if (visited.has(id)) return;
    visited.add(id);
    const spouses = unitSpouses(id);
    for (const sp of spouses) visited.add(sp);
    besideOf.set(id, spouses);
    const kids = unitChildren(id, spouses);
    kidsOf.set(id, kids);
    for (const k of kids) build(k);
  };

  // roots = blood ancestors (no parents, not married-in), most children first
  const roots = sortSibs(
    people.map((p) => p.id).filter((id) => !(parentsOf.get(id)?.length) && !isMarriedIn(id)),
  ).sort((a, b) => (childrenOf.get(b)?.length ?? 0) - (childrenOf.get(a)?.length ?? 0));
  for (const id of roots) build(id);
  // any leftover (disconnected / odd) people become their own roots
  for (const p of people) if (!visited.has(p.id)) build(p.id);

  // unit = blood node + spouses laid in a row; husband (male) kept on the left
  const orderedUnit = (id: string): string[] => {
    const sp = besideOf.get(id) ?? [];
    if (sp.length === 1 && gender(sp[0]) === 'male' && gender(id) !== 'male') return [sp[0], id];
    return [id, ...sp];
  };
  const unitWidth = (id: string) => {
    const members = orderedUnit(id);
    return members.reduce((w, m, i) => w + wOf(m) + (i ? COUPLE_GAP : 0), 0);
  };

  // ---- bottom-up subtree widths ----
  const subW = new Map<string, number>();
  const computeW = (id: string): number => {
    const uw = unitWidth(id);
    const kids = kidsOf.get(id) ?? [];
    if (!kids.length) {
      subW.set(id, uw);
      return uw;
    }
    let childrenW = 0;
    for (const k of kids) childrenW += computeW(k) + H_GAP;
    childrenW -= H_GAP;
    const total = Math.max(uw, childrenW);
    subW.set(id, total);
    return total;
  };

  // ---- y per generation (rows), tall rows for gen 1–2, short for gen 3+ ----
  const yOfGen = new Map<number, number>();
  {
    const maxGen = Math.max(1, ...[...genOf.values()]);
    const rowH = new Map<number, number>();
    for (const [id, gnum] of genOf) rowH.set(gnum, Math.max(rowH.get(gnum) ?? 0, hOf(id)));
    let y = 0;
    for (let gnum = 1; gnum <= maxGen; gnum++) {
      yOfGen.set(gnum, y);
      y += (rowH.get(gnum) ?? NODE_HEIGHT) + RANK_GAP;
    }
  }

  // ---- top-down placement: place each subtree within [left, left+subW] ----
  const pos = new Map<string, Positioned>();
  const place = (id: string, left: number, depth: number) => {
    const total = subW.get(id) ?? unitWidth(id);
    const members = orderedUnit(id);
    const uw = unitWidth(id);
    const kids = kidsOf.get(id) ?? [];
    const y = yOfGen.get(depth) ?? depth * (NODE_HEIGHT + RANK_GAP);

    let unitLeft: number;
    if (!kids.length) {
      unitLeft = left + (total - uw) / 2;
    } else {
      const childrenW = kids.reduce((w, k) => w + (subW.get(k) ?? 0) + H_GAP, 0) - H_GAP;
      let cx = left + (total - childrenW) / 2;
      const centers: number[] = [];
      for (const k of kids) {
        const kw = subW.get(k) ?? 0;
        place(k, cx, depth + 1);
        centers.push(cx + kw / 2);
        cx += kw + H_GAP;
      }
      const unitCenter = (centers[0] + centers[centers.length - 1]) / 2;
      unitLeft = unitCenter - uw / 2;
    }

    let mx = unitLeft;
    for (const m of members) {
      pos.set(m, { id: m, x: mx, y });
      mx += wOf(m) + COUPLE_GAP;
    }
  };

  // Only place "primary" roots — the unit head that build() expanded. A root's
  // spouse (e.g. Bà beside Ông) was absorbed into that unit and must not be
  // re-placed as its own family.
  let curX = 0;
  const placeRoot = (id: string) => {
    if (pos.has(id) || !besideOf.has(id)) return;
    if (!subW.has(id)) computeW(id);
    place(id, curX, genOf.get(id) ?? 1);
    curX += (subW.get(id) ?? 0) + FAMILY_GAP;
  };
  for (const id of roots) placeRoot(id);
  for (const p of people) placeRoot(p.id); // leftover / disconnected roots

  return [...pos.values()];
}
