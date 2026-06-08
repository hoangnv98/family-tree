import type { Relationship } from '../types';

export interface Union {
  id: string;
  parentIds: string[]; // 1 or more parents that share the same set of children
  childIds: string[];
}

/**
 * Group parent→child links into "unions": every child is attached to the exact
 * set of parents it has, and children sharing the same parent-set form one
 * union (a couple + their kids). A 2-parent union renders as a single junction
 * knot on the marriage line with one shared line fanning out to the children.
 */
export function computeUnions(relationships: Relationship[]): Union[] {
  const parentsByChild = new Map<string, string[]>();
  for (const r of relationships) {
    if (r.type !== 'parent') continue;
    const list = parentsByChild.get(r.childId) ?? [];
    list.push(r.parentId);
    parentsByChild.set(r.childId, list);
  }

  const groups = new Map<string, Union>();
  for (const [childId, parents] of parentsByChild) {
    const parentIds = [...new Set(parents)].sort();
    const key = parentIds.join('+');
    const existing = groups.get(key);
    if (existing) existing.childIds.push(childId);
    else groups.set(key, { id: `u_${key}`, parentIds, childIds: [childId] });
  }

  return [...groups.values()];
}
