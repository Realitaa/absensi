import { eq, or } from 'drizzle-orm'
import type { Db } from '../db/index'
import { users, type User } from '../db/schema/users'

export async function findUserByUsername(
  db: Db,
  username: string
): Promise<User | null> {
  const rows = await db
    .select()
    .from(users)
    .where(eq(users.username, username))
    .limit(1)
  return rows[0] ?? null
}

export async function findUserByNim(db: Db, nim: string): Promise<User | null> {
  const rows = await db.select().from(users).where(eq(users.nim, nim)).limit(1)
  return rows[0] ?? null
}

export async function updateOwnProfile(
  db: Db,
  userId: number,
  values: { name?: string; username?: string; nim?: string | null }
): Promise<User | null> {
  const set: {
    name?: string
    username?: string
    nim?: string | null
    updatedAt: Date
  } = { updatedAt: new Date() }
  if (values.name !== undefined) set.name = values.name
  if (values.username !== undefined) set.username = values.username
  if (values.nim !== undefined) set.nim = values.nim
  const rows = await db
    .update(users)
    .set(set)
    .where(eq(users.id, userId))
    .returning()
  return rows[0] ?? null
}

export async function updateOwnPassword(
  db: Db,
  userId: number,
  hashedPassword: string
): Promise<User | null> {
  const rows = await db
    .update(users)
    .set({ password: hashedPassword, updatedAt: new Date() })
    .where(eq(users.id, userId))
    .returning()
  return rows[0] ?? null
}

/**
 * Find a user by either username or NIM. The identifier is trimmed by
 * the caller (service layer). Used so all roles (admin, lecturer,
 * student) can sign in from the same login page.
 */
export async function findUserByIdentifier(
  db: Db,
  identifier: string
): Promise<User | null> {
  const value = identifier.trim()
  const rows = await db
    .select()
    .from(users)
    .where(or(eq(users.username, value), eq(users.nim, value)))
    .limit(1)
  return rows[0] ?? null
}

export async function findUserById(db: Db, id: number): Promise<User | null> {
  const rows = await db.select().from(users).where(eq(users.id, id)).limit(1)
  return rows[0] ?? null
}
