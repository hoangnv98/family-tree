import { z } from 'zod';

/**
 * Domain types + matching zod schemas. The schemas double as the validator for
 * imported JSON files, so the import path can trust the data shape.
 */

export const GENDERS = ['male', 'female', 'other'] as const;
export type Gender = (typeof GENDERS)[number];

export const lifeEventSchema = z.object({
  id: z.string(),
  type: z.string(),
  date: z.string().optional(),
  place: z.string().optional(),
  note: z.string().optional(),
});
export type LifeEvent = z.infer<typeof lifeEventSchema>;

export const personSchema = z.object({
  id: z.string(),
  firstName: z.string(),
  lastName: z.string().default(''),
  gender: z.enum(GENDERS).default('other'),
  birthYear: z.number().optional(),
  deathYear: z.number().optional(),
  photo: z.string().optional(),
  // Tiểu sử & ghi chú
  bio: z.string().optional(),
  notes: z.string().optional(),
  // Liên hệ
  phone: z.string().optional(),
  email: z.string().optional(),
  address: z.string().optional(),
  occupation: z.string().optional(),
  // Sự kiện
  birthPlace: z.string().optional(),
  events: z.array(lifeEventSchema).optional(),
});
export type Person = z.infer<typeof personSchema>;

export const relationshipSchema = z.discriminatedUnion('type', [
  z.object({
    id: z.string(),
    type: z.literal('parent'),
    parentId: z.string(),
    childId: z.string(),
  }),
  z.object({
    id: z.string(),
    type: z.literal('spouse'),
    aId: z.string(),
    bId: z.string(),
  }),
]);
export type Relationship = z.infer<typeof relationshipSchema>;
export type ParentRelationship = Extract<Relationship, { type: 'parent' }>;
export type SpouseRelationship = Extract<Relationship, { type: 'spouse' }>;

// Distributive Omit so each union member keeps its own discriminated shape
// (a plain Omit<Relationship,'id'> collapses to the common keys only).
export type RelationshipInput =
  | Omit<ParentRelationship, 'id'>
  | Omit<SpouseRelationship, 'id'>;

export const familyTreeFileSchema = z.object({
  version: z.literal(1),
  meta: z.object({
    name: z.string(),
    exportedAt: z.string(),
  }),
  people: z.array(personSchema),
  relationships: z.array(relationshipSchema),
});
export type FamilyTreeFile = z.infer<typeof familyTreeFileSchema>;

export function fullName(p: Person): string {
  return [p.lastName, p.firstName].filter(Boolean).join(' ').trim() || 'Chưa đặt tên';
}

export function lifespan(p: Person): string {
  if (!p.birthYear && !p.deathYear) return '';
  return `${p.birthYear ?? '?'} – ${p.deathYear ?? ''}`.trim();
}
