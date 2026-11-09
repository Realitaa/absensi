import type { Db } from '../db/index'
import { findUserByIdentifier } from '../repositories/user.repository'
import { verifyPassword } from '../lib/password'
import { invalidCredentials } from '../utils/app-error'

export interface AuthenticatedUser {
  id: number
  name: string
  username: string
  role: string
  nim: string | null
}

function toAuthenticatedUser(user: {
  id: number
  name: string
  username: string
  role: string
  nim: string | null
}): AuthenticatedUser {
  return {
    id: user.id,
    name: user.name,
    username: user.username,
    role: user.role,
    nim: user.nim
  }
}

export async function authenticateByIdentifier(
  db: Db,
  identifier: string,
  password: string
): Promise<AuthenticatedUser> {
  const value = identifier.trim()
  if (!value) throw invalidCredentials()

  const user = await findUserByIdentifier(db, value)
  if (!user) throw invalidCredentials()
  if (user.deletedAt) throw invalidCredentials()

  const ok = await verifyPassword(password, user.password)
  if (!ok) throw invalidCredentials()

  return toAuthenticatedUser(user)
}
