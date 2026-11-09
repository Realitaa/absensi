import { eq } from 'drizzle-orm'
import { faker } from '@faker-js/faker'
import type { Db } from '../index'
import { users } from '../schema/users'
import { hashPassword } from '../../lib/password'

const SEEDED_USERS = [
  {
    username: 'admin',
    name: 'Administrator',
    role: 'admin' as const,
    nim: null
  },
  {
    username: 'dosen',
    name: 'Dosen Contoh',
    role: 'lecturer' as const,
    nim: null
  },
  {
    username: 'mahasiswa',
    name: 'Mahasiswa Contoh',
    role: 'student' as const,
    nim: '2025010001'
  }
]

export async function seedUsers(db: Db, count = 5) {
  const seeded: Array<{ id: number; username: string; role: string }> = []

  for (const u of SEEDED_USERS) {
    const existing = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.username, u.username))
      .limit(1)
    if (existing[0]) {
      seeded.push({ id: existing[0].id, username: u.username, role: u.role })
      continue
    }
    const [row] = await db
      .insert(users)
      .values({ ...u, password: await hashPassword('password') })
      .returning({ id: users.id, username: users.username, role: users.role })
    if (!row) continue
    seeded.push(row)
  }

  const students = seeded.filter(u => u.role === 'student')
  const extra: Array<{ username: string; role: 'student' }> = []
  for (let i = students.length; i < count; i++) {
    extra.push({ username: `mahasiswa${i + 1}`, role: 'student' })
  }
  for (const u of extra) {
    const existing = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.username, u.username))
      .limit(1)
    if (existing[0]) continue
    await db.insert(users).values({
      name: faker.person.fullName(),
      username: u.username,
      password: await hashPassword('password'),
      role: u.role,
      nim: String(faker.number.int({ min: 2000000000, max: 2999999999 }))
    })
  }
  return seeded
}
