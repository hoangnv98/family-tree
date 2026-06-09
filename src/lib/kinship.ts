import type { Person, Relationship } from '../types';

/**
 * Northern-Vietnamese kinship terms: how the hovered person (ego) would address
 * everyone else. Covers the common relations — bố/mẹ, ông/bà (nội/ngoại), cụ,
 * con/cháu/chắt, anh/chị/em, vợ/chồng, bác/chú/cô/cậu/dì and their spouses
 * (thím/mợ/dượng/bác gái/bác trai), nieces/nephews (cháu), cousins (… họ), and
 * con dâu/rể. Seniority (bác vs chú/cô, anh/chị vs em) uses birth years when
 * available, otherwise defaults to the younger form.
 */
export function computeKinship(
  egoId: string,
  people: Person[],
  relationships: Relationship[],
): Map<string, string> {
  const byId = new Map(people.map((p) => [p.id, p]));
  const result = new Map<string, string>();
  if (!byId.has(egoId)) return result;

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
  const gender = (id: string) => byId.get(id)?.gender;
  // Seniority between siblings: manual birth order first (1 = con cả), then year.
  const older = (a: string, b: string) => {
    const oa = byId.get(a)?.birthOrder;
    const ob = byId.get(b)?.birthOrder;
    if (oa != null && ob != null) return oa < ob;
    const ya = byId.get(a)?.birthYear;
    const yb = byId.get(b)?.birthYear;
    return ya != null && yb != null ? ya < yb : false;
  };
  const siblingsOf = (id: string) => {
    const s = new Set<string>();
    for (const p of parentsOf.get(id) ?? [])
      for (const c of childrenOf.get(p) ?? []) if (c !== id) s.add(c);
    return s;
  };

  const parents = parentsOf.get(egoId) ?? [];
  const father = parents.find((p) => gender(p) === 'male');
  const mother = parents.find((p) => gender(p) === 'female');

  // ancestors: id → { dist, side }
  const anc = new Map<string, { dist: number; side: 'noi' | 'ngoai' | null }>();
  const walkUp = (id: string, dist: number, side: 'noi' | 'ngoai' | null) => {
    const ex = anc.get(id);
    if (ex && ex.dist <= dist) return;
    anc.set(id, { dist, side });
    for (const gp of parentsOf.get(id) ?? []) walkUp(gp, dist + 1, side);
  };
  for (const p of parents) {
    const side = gender(p) === 'male' ? 'noi' : gender(p) === 'female' ? 'ngoai' : null;
    walkUp(p, 1, side);
  }

  // descendants: id → dist
  const desc = new Map<string, number>();
  const walkDown = (id: string, dist: number) => {
    const ex = desc.get(id);
    if (ex != null && ex <= dist) return;
    desc.set(id, dist);
    for (const c of childrenOf.get(id) ?? []) walkDown(c, dist + 1);
  };
  for (const c of childrenOf.get(egoId) ?? []) walkDown(c, 1);

  const egoSibs = siblingsOf(egoId);

  const siblingTerm = (id: string, ho = false) => {
    const g = gender(id);
    const base = older(id, egoId)
      ? g === 'male'
        ? 'Anh'
        : g === 'female'
          ? 'Chị'
          : 'Anh/Chị'
      : 'Em';
    return base + (ho ? ' họ' : '');
  };

  // sibling of ego's father (nội) or mother (ngoại) → bác/chú/cô/cậu/dì
  const uncleAunt = (id: string): string | null => {
    if (father && siblingsOf(father).has(id)) {
      const g = gender(id);
      const isOlder = older(id, father);
      if (g === 'male') return isOlder ? 'Bác' : 'Chú';
      if (g === 'female') return isOlder ? 'Bác' : 'Cô';
      return 'Bác/Chú';
    }
    if (mother && siblingsOf(mother).has(id)) {
      const g = gender(id);
      const isOlder = older(id, mother);
      if (g === 'male') return isOlder ? 'Bác' : 'Cậu';
      if (g === 'female') return isOlder ? 'Bác' : 'Dì';
      return 'Cậu/Dì';
    }
    return null;
  };
  const spouseOfUncleAunt = (id: string): string | null => {
    for (const sp of spouseOf.get(id) ?? []) {
      const ut = uncleAunt(sp);
      if (!ut) continue;
      const g = gender(id);
      if (ut === 'Bác') return g === 'female' ? 'Bác gái' : 'Bác trai';
      if (ut === 'Chú') return 'Thím';
      if (ut === 'Cô') return 'Dượng';
      if (ut === 'Cậu') return 'Mợ';
      if (ut === 'Dì') return 'Dượng';
      return ut;
    }
    return null;
  };

  for (const person of people) {
    const id = person.id;
    if (id === egoId) continue;
    const g = gender(id);
    let term: string | null = null;

    if ((spouseOf.get(egoId) ?? []).includes(id)) {
      term = g === 'male' ? 'Chồng' : 'Vợ';
    } else if (anc.has(id)) {
      const { dist, side } = anc.get(id)!;
      if (dist === 1) term = g === 'male' ? 'Bố' : 'Mẹ';
      else if (dist === 2)
        term = (g === 'male' ? 'Ông' : 'Bà') + (side === 'noi' ? ' nội' : side === 'ngoai' ? ' ngoại' : '');
      else term = 'Cụ';
    } else if (desc.has(id)) {
      const d = desc.get(id)!;
      term = d === 1 ? 'Con' : d === 2 ? 'Cháu' : d === 3 ? 'Chắt' : 'Chút';
    } else if (egoSibs.has(id)) {
      term = siblingTerm(id);
    } else if ((parentsOf.get(id) ?? []).some((p) => egoSibs.has(p))) {
      term = 'Cháu'; // niece / nephew
    } else {
      term =
        uncleAunt(id) ??
        spouseOfUncleAunt(id) ??
        ((parentsOf.get(id) ?? []).some((p) => uncleAunt(p))
          ? siblingTerm(id, true) // cousin → anh/chị/em họ
          : (spouseOf.get(id) ?? []).some((sp) => desc.get(sp) === 1)
            ? g === 'male'
              ? 'Con rể'
              : 'Con dâu'
            : null);
    }

    if (term) result.set(id, term);
  }
  return result;
}
