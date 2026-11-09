import type { H3Event } from 'h3'
import { getDb } from './db'
import { forbidden, unauthorized } from './app-error'
import { findUserById } from '../repositories/user.repository'
import type { AuthenticatedUser } from '../services/auth.service'
import type { UserRole } from '../db/schema/users'

export async function requireAuth(
  event: H3Event
): Promise<AuthenticatedUser> {
  let sessionUser: { id?: number } | undefined
  try {
    const session = await getUserSession(event)
    sessionUser = session.user as { id?: number } | undefined
  } catch {
    throw unauthorized()
  }
  if (!sessionUser?.id) throw unauthorized()

  const db = getDb(event as never)
  const user = await findUserById(db, sessionUser.id)
  if (!user || user.deletedAt) throw unauthorized()

  return {
    id: user.id,
    name: user.name,
    username: user.username,
    role: user.role,
    nim: user.nim
  }
}

export async function requireRole(
  event: H3Event,
  ...roles: UserRole[]
): Promise<AuthenticatedUser> {
  const user = await requireAuth(event)
  if (!roles.includes(user.role as UserRole)) throw forbidden()
  return user
}

export async function optionalAuth(
  event: H3Event
): Promise<AuthenticatedUser | null> {
  try {
    return await requireAuth(event)
  } catch {
    return null
  }
}
