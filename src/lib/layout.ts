import Dagre from '@dagrejs/dagre';
import type { Person, Relationship, ParentRelationship } from '../types';

export const NODE_WIDTH = 210;
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

  // Second pass: tidy childless couples — but never drag a spouse out of their
  // own birth family. Only reposition a "married-in" spouse that has no parents
  // of their own; if both partners belong to a family (cross-branch marriage)
  // leave them in place and let the marriage line connect across.
  const childrenOf = (id: string) =>
    relationships
      .filter((r): r is ParentRelationship => r.type === 'parent' && r.parentId === id)
      .map((r) => r.childId);
  const hasParents = (id: string) =>
    relationships.some((r) => r.type === 'parent' && r.childId === id);

  const placeBeside = (anchor: Positioned, moving: Positioned) => {
    moving.y = anchor.y;
    moving.x = anchor.x + NODE_WIDTH + 50;
  };

  for (const r of relationships) {
    if (r.type !== 'spouse') continue;
    const a = pos.get(r.aId);
    const b = pos.get(r.bId);
    if (!a || !b) continue;
    const shareChild = childrenOf(r.aId).some((c) => childrenOf(r.bId).includes(c));
    if (shareChild) continue; // dagre already grouped them via shared children
    if (!hasParents(r.bId)) placeBeside(a, b);
    else if (!hasParents(r.aId)) placeBeside(b, a);
    // both rooted in their own family → don't move either one
  }

  return [...pos.values()];
}
