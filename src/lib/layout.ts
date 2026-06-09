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

  return [...pos.values()];
}
