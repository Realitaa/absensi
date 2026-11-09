import type { Db } from '../db/index'
import {
  findUserById,
  findUserByNim,
  findUserByUsername,
  updateOwnPassword,
  updateOwnProfile as updateProfileRepo
} from '../repositories/user.repository'
import { hashPassword, verifyPassword } from '../lib/password'
import {
  AppError,
  invalidCredentials,
  validationError
} from '../utils/app-error'
import { ErrorCodes } from '../../shared/error-codes'
import type { AuthenticatedUser } from './auth.service'

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

export async function updateOwnProfile(
  db: Db,
  actor: AuthenticatedUser,
  input: { name?: string; username?: string; nim?: string | null }
): Promise<AuthenticatedUser> {
  const normalized: { name?: string; username?: string; nim?: string | null } =
    {}
  const fieldErrors: Record<string, string[]> = {}

  if (input.name !== undefined) {
    const name = input.name.trim()
    if (name.length < 2 || name.length > 100) {
      fieldErrors.name = ['Name must be between 2 and 100 characters']
    } else {
      normalized.name = name
    }
  }

  if (input.username !== undefined) {
    const username = input.username.trim()
    if (username.length < 3 || username.length > 50) {
      fieldErrors.username = ['Username must be between 3 and 50 characters']
    } else if (!/^[a-zA-Z0-9_.-]+$/.test(username)) {
      fieldErrors.username = [
        'Username may only contain letters, numbers, underscore, dot, or hyphen'
      ]
    } else {
      normalized.username = username
    }
  }

  if (input.nim !== undefined) {
    if (actor.role !== 'student') {
      if (input.nim !== null) {
        fieldErrors.nim = ['NIM is only applicable for students']
      }
    } else if (input.nim === null) {
      normalized.nim = null
    } else {
      const nim = input.nim.trim()
      if (nim.length < 8 || nim.length > 20) {
        fieldErrors.nim = ['NIM must be between 8 and 20 digits']
      } else if (!/^[0-9]+$/.test(nim)) {
        fieldErrors.nim = ['NIM may only contain digits']
      } else {
        normalized.nim = nim
      }
    }
  }

  if (Object.keys(fieldErrors).length) {
    throw validationError('Profile validation failed', fieldErrors)
  }

  if (Object.keys(normalized).length === 0) {
    throw validationError('No profile fields provided for update')
  }

  if (
    normalized.username !== undefined &&
    normalized.username !== actor.username
  ) {
    const existing = await findUserByUsername(db, normalized.username)
    if (existing && existing.id !== actor.id) {
      throw new AppError(ErrorCodes.CONFLICT, 409, 'Username already in use', {
        fieldErrors: { username: ['Username is already in use'] }
      })
    }
  }

  if (
    normalized.nim !== undefined &&
    normalized.nim !== null &&
    normalized.nim !== actor.nim
  ) {
    const existing = await findUserByNim(db, normalized.nim)
    if (existing && existing.id !== actor.id) {
      throw new AppError(ErrorCodes.CONFLICT, 409, 'NIM already in use', {
        fieldErrors: { nim: ['NIM is already in use'] }
      })
    }
  }

  const updated = await updateProfileRepo(db, actor.id, normalized)
  if (!updated || updated.deletedAt) throw invalidCredentials()

  return toAuthenticatedUser(updated)
}

export async function changePassword(
  db: Db,
  actor: AuthenticatedUser,
  input: { currentPassword: string; newPassword: string }
): Promise<void> {
  const { currentPassword, newPassword } = input
  if (
    typeof currentPassword !== 'string' ||
    typeof newPassword !== 'string' ||
    !currentPassword ||
    !newPassword
  ) {
    throw validationError('Current and new password are required', {
      currentPassword: ['Current password is required'],
      newPassword: ['New password is required']
    })
  }

  if (newPassword.length < 8 || newPassword.length > 128) {
    throw validationError('New password must be between 8 and 128 characters', {
      newPassword: ['New password must be between 8 and 128 characters']
    })
  }

  const user = await findUserById(db, actor.id)
  if (!user || user.deletedAt) throw invalidCredentials()

  const currentOk = await verifyPassword(currentPassword, user.password)
  if (!currentOk) throw invalidCredentials()

  const sameAsCurrent = await verifyPassword(newPassword, user.password)
  if (sameAsCurrent) {
    throw validationError('New password must differ from current password', {
      newPassword: ['New password must differ from current password']
    })
  }

  const hashed = await hashPassword(newPassword)
  const updated = await updateOwnPassword(db, actor.id, hashed)
  if (!updated || updated.deletedAt) throw invalidCredentials()
}
