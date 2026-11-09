import { eq, or } from 'drizzle-orm'
import type { Db } from '../db/index'
import { users, type User } from '../db/schema/users'

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
