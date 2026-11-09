import {
  and,
  asc,
  count,
  desc,
  eq,
  isNotNull,
  isNull,
  like,
  or,
  type SQL
} from 'drizzle-orm'
import type { Db } from '../db/index'
import {
  users,
  type NewUser,
  type User,
  type UserRole
} from '../db/schema/users'

/**
 * Find a user by either username or NIM. The identifier is trimmed by
 * the caller (service layer). Used so all roles (admin, lecturer,
 * student) can sign in from the same login page.
 */
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

export async function insertUser(
  db: Db,
  values: NewUser
): Promise<User | null> {
  const rows = await db.insert(users).values(values).returning()
  return rows[0] ?? null
}

export async function updateUser(
  db: Db,
  id: number,
  values: Partial<NewUser>
): Promise<User | null> {
  const rows = await db
    .update(users)
    .set({ ...values, updatedAt: new Date() })
    .where(eq(users.id, id))
    .returning()
  return rows[0] ?? null
}

export async function softDeleteUser(db: Db, id: number): Promise<User | null> {
  return updateUser(db, id, { deletedAt: new Date() })
}

export interface ListUsersQuery {
  search?: string
  role?: UserRole
  status?: 'active' | 'deleted'
  page: number
  pageSize: number
}

export async function listUsers(db: Db, query: ListUsersQuery) {
  const conditions: SQL[] = []
  if (query.status === 'deleted') conditions.push(isNotNull(users.deletedAt))
  else if (query.status === 'active') conditions.push(isNull(users.deletedAt))
  if (query.role) conditions.push(eq(users.role, query.role))
  const trimmed = query.search?.trim()
  if (trimmed) {
    const pattern = `%${trimmed}%`
    conditions.push(
      or(
        like(users.name, pattern),
        like(users.username, pattern),
        like(users.nim, pattern)
      )!
    )
  }
  const where = and(...conditions)
  const rows = await db
    .select()
    .from(users)
    .where(where)
    .orderBy(desc(users.createdAt), asc(users.id))
    .limit(query.pageSize)
    .offset((query.page - 1) * query.pageSize)
  const [countRow] = await db
    .select({ count: count() })
    .from(users)
    .where(where)
  return { rows, total: countRow?.count ?? 0 }
}
