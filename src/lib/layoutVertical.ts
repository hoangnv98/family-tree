import type { Person, Relationship } from '../types';
import { NODE_WIDTH, NODE_HEIGHT, type Positioned } from './layout';

/**
 * "Vertical" reading layout for deep trees: generations 1–2 stay horizontal
 * (root couple on top, their children spread as columns), but from generation 3
 * down each branch becomes an indented vertical list — like a traditional gia
 * phả outline. Keeps the same cards/edges as the tree layout; only positions
 * differ. A married-in spouse is shown beside their partner; the blood line is
 * the primary node that children indent under.
 */

const V_GAP = 34; // vertical gap between stacked rows
const ROW_STEP = NODE_HEIGHT + V_GAP; // baseline → baseline of next stacked row
const INDENT = 56; // horizontal indent added per generation (gen ≥ 3)
const COUPLE_GAP = 44; // gap between a person and the spouse shown beside them
const COL_GAP = 80; // gap between generation-2 columns
const FAMILY_GAP = 160; // gap between separate root families

export function layoutTreeVertical(
  people: Person[],
  relationships: Relationship[],
): Positioned[] {
  const order = new Map(people.map((p, i) => [p.id, i]));
  const spouseOf = new Map<string, string[]>();
  const parentsOf = new Map<string, string[]>();
  const childrenOf = new Map<string, string[]>();
  const genderOf = new Map(people.map((p) => [p.id, p.gender]));
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
  const sortByOrder = (ids: string[]) =>
    [...ids].sort((a, b) => (order.get(a) ?? 0) - (order.get(b) ?? 0));

  const pos = new Map<string, Positioned>();
  const placed = new Set<string>();

  // The spouse drawn beside `id`: prefer a married-in one (no parents in tree).
  const besideSpouse = (id: string): string | undefined => {
    const ss = (spouseOf.get(id) ?? []).filter((s) => !placed.has(s));
    if (!ss.length) return undefined;
    return ss.find((s) => !(parentsOf.get(s)?.length)) ?? ss[0];
  };

  // Order a couple so the husband (male) sits on the left, wife on the right.
  // `id` is the blood line; children still indent under the left slot.
  const orderCouple = (id: string, sp?: string): [string, string | undefined] => {
    if (!sp) return [id, undefined];
    if (genderOf.get(sp) === 'male' && genderOf.get(id) !== 'male') return [sp, id];
    return [id, sp];
  };

  // Children of the family unit (this person + the spouse shown beside them).
  const unitChildren = (id: string, spouseId?: string): string[] => {
    const ids = [...(childrenOf.get(id) ?? [])];
    if (spouseId)
      for (const c of childrenOf.get(spouseId) ?? []) if (!ids.includes(c)) ids.push(c);
    return sortByOrder(ids).filter((c) => !placed.has(c));
  };

  // Place `id` (blood line) at (x,y) with all descendants indented below it.
  function place(id: string, x: number, y: number): { bottom: number; right: number } {
    if (placed.has(id)) return { bottom: y + NODE_HEIGHT, right: x + NODE_WIDTH };
    placed.add(id);
    const sp = besideSpouse(id);
    const [leftId, rightId] = orderCouple(id, sp);
    pos.set(leftId, { id: leftId, x, y });
    let right = x + NODE_WIDTH;

    if (sp && rightId) {
      placed.add(sp);
      const sx = x + NODE_WIDTH + COUPLE_GAP;
      pos.set(rightId, { id: rightId, x: sx, y });
      right = sx + NODE_WIDTH;
    }

    let cy = y + ROW_STEP;
    const kids = unitChildren(id, sp);
    for (const k of kids) {
      const res = place(k, x + INDENT, cy);
      right = Math.max(right, res.right);
      cy = res.bottom + V_GAP;
    }
    return { bottom: kids.length ? cy - V_GAP : y + NODE_HEIGHT, right };
  }

  // A root family: head (+ spouse) on top, generation-2 children as columns,
  // each column holding that child's indented vertical subtree (gen ≥ 3).
  function placeFamily(headId: string, startX: number): number {
    placed.add(headId);
    const sp = besideSpouse(headId);
    const [leftId, rightId] = orderCouple(headId, sp);
    pos.set(leftId, { id: leftId, x: startX, y: 0 });
    let right = startX + NODE_WIDTH;

    if (sp && rightId) {
      placed.add(sp);
      const sx = startX + NODE_WIDTH + COUPLE_GAP;
      pos.set(rightId, { id: rightId, x: sx, y: 0 });
      right = sx + NODE_WIDTH;
    }

    let colX = startX + INDENT;
    for (const child of unitChildren(headId, sp)) {
      const res = place(child, colX, ROW_STEP);
      colX = res.right + COL_GAP;
      right = Math.max(right, res.right);
    }
    return Math.max(right, colX - COL_GAP);
  }

  // Roots: people with no parents in the tree; place the ones with children
  // first so the blood head wins over a married-in spouse.
  const roots = sortByOrder(
    people.map((p) => p.id).filter((id) => !(parentsOf.get(id)?.length)),
  ).sort((a, b) => (childrenOf.get(b)?.length ?? 0) - (childrenOf.get(a)?.length ?? 0));

  let curX = 0;
  for (const id of roots) {
    if (placed.has(id)) continue;
    const rightExtent = placeFamily(id, curX);
    curX = rightExtent + FAMILY_GAP;
  }

  // Any leftover (disconnected) people: lay them in a row at the bottom.
  let maxY = 0;
  for (const p of pos.values()) maxY = Math.max(maxY, p.y);
  let leftoverX = 0;
  for (const p of people) {
    if (placed.has(p.id)) continue;
    placed.add(p.id);
    pos.set(p.id, { id: p.id, x: leftoverX, y: maxY + ROW_STEP });
    leftoverX += NODE_WIDTH + COL_GAP;
  }

  return [...pos.values()];
}
