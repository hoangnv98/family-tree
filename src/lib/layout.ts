import Dagre from '@dagrejs/dagre';
import type { Person, Relationship } from '../types';
import { resolveMarriedIn } from './marriage';

export const NODE_WIDTH = 260;
export const NODE_HEIGHT = 96;

export interface Positioned {
  id: string;
  x: number;
  y: number;
}

/**
 * Auto-layout the family tree with dagre.
 *
 * Strategy: only parent→child links drive dagre's hierarchy (ranks = generations).
 * Two parents of the same children get pulled close together naturally because
 * they share child edges. As a second pass we snap childless spouse pairs next to
 * each other so couples always read as a unit.
 */
export function layoutTree(
  people: Person[],
  relationships: Relationship[],
): Positioned[] {
  const g = new Dagre.graphlib.Graph().setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: 'TB', nodesep: 60, ranksep: 90, marginx: 40, marginy: 40 });

  for (const p of people) {
    g.setNode(p.id, { width: NODE_WIDTH, height: NODE_HEIGHT });
  }

  for (const r of relationships) {
    if (r.type === 'parent' && g.hasNode(r.parentId) && g.hasNode(r.childId)) {
      g.setEdge(r.parentId, r.childId);
    }
  }

  Dagre.layout(g);

  const pos = new Map<string, Positioned>();
  for (const p of people) {
    const n = g.node(p.id);
    if (!n) continue;
    // dagre gives center coords; React Flow expects top-left.
    pos.set(p.id, { id: p.id, x: n.x - NODE_WIDTH / 2, y: n.y - NODE_HEIGHT / 2 });
  }

  // Second pass: seat each "married-in" spouse right next to their partner,
  // shifting that row's right-hand neighbours to make room. Their link back to
  // their birth parents is later drawn as a thin origin line (see Canvas).
  for (const { moverId, anchorId } of resolveMarriedIn(relationships)) {
    const anchor = pos.get(anchorId);
    const mover = pos.get(moverId);
    if (!anchor || !mover) continue;
    const targetX = anchor.x + NODE_WIDTH + 50;
    for (const p of pos.values()) {
      if (p.id === moverId || p.id === anchorId) continue;
      if (Math.abs(p.y - anchor.y) < 1 && p.x >= targetX - 1) {
        p.x += NODE_WIDTH + 50;
      }
    }
    mover.x = targetX;
    mover.y = anchor.y;
  }

  // Third pass: make sure every monogamous couple sits side by side, even
  // cross-branch spouses that dagre left apart. Multi-spouse people (vợ 2) are
  // skipped — a husband can't be adjacent to two wives at once.
  const GAP = 50;
  const spouseCount = new Map<string, number>();
  for (const r of relationships)
    if (r.type === 'spouse') {
      spouseCount.set(r.aId, (spouseCount.get(r.aId) ?? 0) + 1);
      spouseCount.set(r.bId, (spouseCount.get(r.bId) ?? 0) + 1);
    }
  const hasKids = (id: string) =>
    relationships.some((x) => x.type === 'parent' && x.parentId === id);
  for (const r of relationships) {
    if (r.type !== 'spouse') continue;
    if ((spouseCount.get(r.aId) ?? 0) !== 1 || (spouseCount.get(r.bId) ?? 0) !== 1) continue;
    const a = pos.get(r.aId);
    const b = pos.get(r.bId);
    if (!a || !b) continue;
    // keep the partner that carries the children as the anchor
    const anchor = hasKids(r.bId) && !hasKids(r.aId) ? b : a;
    const mover = anchor === a ? b : a;
    const targetX = anchor.x + NODE_WIDTH + GAP;
    // already adjacent (either side)?
    if (
      Math.abs(mover.y - anchor.y) < 2 &&
      (Math.abs(mover.x - targetX) < 2 || Math.abs(mover.x - (anchor.x - NODE_WIDTH - GAP)) < 2)
    )
      continue;
    for (const p of pos.values()) {
      if (p.id === mover.id || p.id === anchor.id) continue;
      if (Math.abs(p.y - anchor.y) < 1 && p.x >= targetX - 1) p.x += NODE_WIDTH + GAP;
    }
    mover.x = targetX;
    mover.y = anchor.y;
  }

  // Final pass: within each married couple keep the husband on the left and the
  // wife on the right (swap their x if needed) so the marriage line reads a
  // clean left→right and the cards never overlap.
  const genderOf = new Map(people.map((p) => [p.id, p.gender]));
  for (const r of relationships) {
    if (r.type !== 'spouse') continue;
    const a = pos.get(r.aId);
    const b = pos.get(r.bId);
    if (!a || !b || Math.abs(a.y - b.y) > 1) continue; // only same-row couples
    const ga = genderOf.get(r.aId);
    const gb = genderOf.get(r.bId);
    let male, female;
    if (ga === 'male' && gb !== 'male') [male, female] = [a, b];
    else if (gb === 'male' && ga !== 'male') [male, female] = [b, a];
    else continue; // can't tell (same gender / unknown) → leave as is
    if (male.x > female.x) [male.x, female.x] = [female.x, male.x];
  }

  return [...pos.values()];
}
