import type { Relationship, ParentRelationship } from '../types';

export interface MarriedIn {
  moverId: string; // spouse displayed next to their partner ("married in")
  anchorId: string; // partner who stays in their own family position
}

/**
 * Ids of every spouse who married INTO the family (dâu / rể) — i.e. their own
 * birth parents are not in the tree. For each spouse pair we tag the partner
 * without parent links; when neither has parents (e.g. the top couple) we tag
 * `bId`, matching the relocation preference in {@link resolveMarriedIn}. The
 * dâu-vs-rể wording is decided later from the person's gender.
 */
export function marriedInIds(relationships: Relationship[]): Set<string> {
  const hasParents = (id: string) =>
    relationships.some((r) => r.type === 'parent' && r.childId === id);

  const ids = new Set<string>();
  for (const r of relationships) {
    if (r.type !== 'spouse') continue;
    const aP = hasParents(r.aId);
    const bP = hasParents(r.bId);
    if (aP && bP) continue; // both rooted in the tree → neither "married in"
    if (aP) ids.add(r.bId);
    else if (bP) ids.add(r.aId);
    else ids.add(r.bId); // neither rooted → second-added is the in-married one
  }
  return ids;
}

/**
 * Decide which spouse of each "cross-family" marriage should be drawn next to
 * their partner. A couple that already shares children is grouped by dagre, so
 * we skip those. For the rest we relocate the leaf spouse (no descendants) so we
 * never orphan a subtree; their link back to their birth parents becomes a thin
 * "origin" line. Preference goes to the spouse listed as `bId` (the one the user
 * added second), which usually is the partner who married into the family.
 */
export function resolveMarriedIn(relationships: Relationship[]): MarriedIn[] {
  const hasParents = (id: string) =>
    relationships.some((r) => r.type === 'parent' && r.childId === id);
  const childrenOf = (id: string) =>
    relationships
      .filter((r): r is ParentRelationship => r.type === 'parent' && r.parentId === id)
      .map((r) => r.childId);
  const shareChild = (a: string, b: string) =>
    childrenOf(a).some((c) => childrenOf(b).includes(c));

  const out: MarriedIn[] = [];
  const used = new Set<string>();

  for (const r of relationships) {
    if (r.type !== 'spouse') continue;
    if (shareChild(r.aId, r.bId)) continue; // dagre already groups them

    const aP = hasParents(r.aId);
    const bP = hasParents(r.bId);

    let mover: string | null = null;
    let anchor: string | null = null;

    if (aP && bP) {
      // both rooted in their own family — relocate whichever is a leaf
      if (childrenOf(r.bId).length === 0) { mover = r.bId; anchor = r.aId; }
      else if (childrenOf(r.aId).length === 0) { mover = r.aId; anchor = r.bId; }
      else continue; // both carry subtrees → leave in place
    } else if (!bP) {
      mover = r.bId; anchor = r.aId; // b married in (or both loose)
    } else {
      mover = r.aId; anchor = r.bId; // a married in
    }

    if (!mover || !anchor) continue;
    if (childrenOf(mover).length > 0) continue; // never relocate a node with a subtree
    if (used.has(mover) || used.has(anchor)) continue;
    used.add(mover);
    out.push({ moverId: mover, anchorId: anchor });
  }

  return out;
}
