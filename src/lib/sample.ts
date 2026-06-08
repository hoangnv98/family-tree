import type { Person, Relationship } from '../types';

/** Seed data shown the first time the app opens (empty localStorage). */
export function sampleData(): { people: Person[]; relationships: Relationship[] } {
  const people: Person[] = [
    {
      id: 'p1',
      firstName: 'Văn An',
      lastName: 'Nguyễn',
      gender: 'male',
      birthYear: 1940,
      deathYear: 2015,
      occupation: 'Giáo viên',
      birthPlace: 'Nam Định',
      bio: 'Ông cố của gia đình, người gây dựng nề nếp gia phong.',
    },
    {
      id: 'p2',
      firstName: 'Thị Lan',
      lastName: 'Trần',
      gender: 'female',
      birthYear: 1944,
      deathYear: 2018,
      occupation: 'Nội trợ',
      birthPlace: 'Thái Bình',
    },
    {
      id: 'p3',
      firstName: 'Văn Bình',
      lastName: 'Nguyễn',
      gender: 'male',
      birthYear: 1968,
      occupation: 'Kỹ sư',
      phone: '0901 234 567',
      email: 'binh@example.com',
    },
    {
      id: 'p4',
      firstName: 'Thị Hoa',
      lastName: 'Lê',
      gender: 'female',
      birthYear: 1970,
      occupation: 'Bác sĩ',
    },
    {
      id: 'p5',
      firstName: 'Minh Khôi',
      lastName: 'Nguyễn',
      gender: 'male',
      birthYear: 1996,
      occupation: 'Lập trình viên',
    },
    {
      id: 'p6',
      firstName: 'Bảo Ngọc',
      lastName: 'Nguyễn',
      gender: 'female',
      birthYear: 2000,
      occupation: 'Sinh viên',
    },
  ];

  const relationships: Relationship[] = [
    { id: 'r1', type: 'spouse', aId: 'p1', bId: 'p2' },
    { id: 'r2', type: 'spouse', aId: 'p3', bId: 'p4' },
    { id: 'r3', type: 'parent', parentId: 'p1', childId: 'p3' },
    { id: 'r4', type: 'parent', parentId: 'p2', childId: 'p3' },
    { id: 'r5', type: 'parent', parentId: 'p3', childId: 'p5' },
    { id: 'r6', type: 'parent', parentId: 'p4', childId: 'p5' },
    { id: 'r7', type: 'parent', parentId: 'p3', childId: 'p6' },
    { id: 'r8', type: 'parent', parentId: 'p4', childId: 'p6' },
  ];

  return { people, relationships };
}
