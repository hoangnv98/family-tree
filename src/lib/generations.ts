import type { Person, Relationship } from '../types';

/**
 * Generation number (1 = oldest) for every person. Blood ancestors with no
 * parents are gen 1; each child is parent+1; a married-in spouse (no parents,
 * but married to someone who has parents) takes its partner's generation so a
 * couple always shares a row. Used to render deep generations (3+) as compact
 * portrait cards and to size them in the layout.
 */
export function computeGenerations(
  people: Person[],
  relationships: Relationship[],
): Map<string, number> {
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

  const isMarriedIn = (id: string) =>
    !(parentsOf.get(id)?.length) &&
    (spouseOf.get(id) ?? []).some((sp) => (parentsOf.get(sp)?.length ?? 0) > 0);

  const gen = new Map<string, number>();
  const queue: string[] = [];
  for (const p of people) {
    if (!(parentsOf.get(p.id)?.length) && !isMarriedIn(p.id)) {
      gen.set(p.id, 1);
      queue.push(p.id);
    }
  }
  while (queue.length) {
    const id = queue.shift()!;
    const g = gen.get(id)!;
    for (const c of childrenOf.get(id) ?? []) {
      if (!gen.has(c) || gen.get(c)! > g + 1) {
        gen.set(c, g + 1);
        queue.push(c);
      }
    }
  }
  // married-in spouses inherit their partner's generation
  for (const p of people) {
    if (gen.has(p.id)) continue;
    const sp = (spouseOf.get(p.id) ?? []).find((s) => gen.has(s));
    gen.set(p.id, sp ? gen.get(sp)! : 1);
  }
  return gen;
}
