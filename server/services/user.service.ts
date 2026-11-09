import type { Db } from '../db/index'
import { userRoles, type UserRole } from '../db/schema/users'
import {
  findUserById,
  findUserByNim,
  findUserByUsername,
  insertUser as insertUserRepo,
  listUsers,
  softDeleteUser as softDeleteUserRepo,
  updateUser as updateUserRepo
} from '../repositories/user.repository'
import { hashPassword } from '../lib/password'
import {
  AppError,
  forbidden,
  notFound,
  validationError
} from '../utils/app-error'
import { ErrorCodes } from '../../shared/error-codes'
import type { AuthenticatedUser } from './auth.service'

export interface PublicUser {
  id: number
  name: string
  username: string
  role: UserRole
  nim: string | null
  createdAt: string
  updatedAt: string
  deletedAt: string | null
}

type UserRecord = Awaited<ReturnType<typeof findUserById>>

function toPublicUser(user: NonNullable<UserRecord>): PublicUser {
  return {
    id: user.id,
    name: user.name,
    username: user.username,
    role: user.role as UserRole,
    nim: user.nim,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
    deletedAt: user.deletedAt?.toISOString() ?? null
  }
}

function requireAdmin(actor: AuthenticatedUser) {
  if (actor.role !== 'admin')
    throw forbidden('Only administrators can manage users')
}

function validateRole(
  role: unknown,
  fieldErrors: Record<string, string[]>
): UserRole | undefined {
  if (
    typeof role !== 'string' ||
    !(userRoles as readonly string[]).includes(role)
  ) {
    fieldErrors.role = ['Role must be admin, lecturer, or student']
    return undefined
  }
  return role as UserRole
}

function validateNim(
  role: UserRole,
  nim: unknown,
  fieldErrors: Record<string, string[]>
): string | null | undefined {
  if (role !== 'student') {
    if (
      nim !== undefined &&
      nim !== null &&
      !(typeof nim === 'string' && nim.trim() === '')
    ) {
      fieldErrors.nim = ['NIM is only applicable for students']
      return undefined
    }
    return null
  }
  if (
    nim === undefined ||
    nim === null ||
    (typeof nim === 'string' && nim.trim() === '')
  ) {
    fieldErrors.nim = ['NIM is required for students']
    return undefined
  }
  if (typeof nim !== 'string') {
    fieldErrors.nim = ['NIM must be a string']
    return undefined
  }
  const value = nim.trim()
  if (value.length < 8 || value.length > 20) {
    fieldErrors.nim = ['NIM must be between 8 and 20 digits']
    return undefined
  }
  if (!/^[0-9]+$/.test(value)) {
    fieldErrors.nim = ['NIM may only contain digits']
    return undefined
  }
  return value
}

function validateName(
  username: unknown,
  fieldErrors: Record<string, string[]>
) {
  if (
    typeof username !== 'string' ||
    username.trim().length < 2 ||
    username.trim().length > 100
  ) {
    fieldErrors.name = ['Name must be between 2 and 100 characters']
    return undefined
  }
  return username.trim()
}

function validateUsername(
  username: unknown,
  fieldErrors: Record<string, string[]>
) {
  if (typeof username !== 'string') {
    fieldErrors.username = ['Username is required']
    return undefined
  }
  const value = username.trim()
  if (value.length < 3 || value.length > 50) {
    fieldErrors.username = ['Username must be between 3 and 50 characters']
    return undefined
  }
  if (!/^[a-zA-Z0-9_.-]+$/.test(value)) {
    fieldErrors.username = [
      'Username may only contain letters, numbers, underscore, dot, or hyphen'
    ]
    return undefined
  }
  return value
}

function validatePassword(
  password: unknown,
  fieldErrors: Record<string, string[]>
) {
  if (typeof password !== 'string' || !password) {
    fieldErrors.password = ['Password is required']
    return undefined
  }
  if (password.length < 8 || password.length > 128) {
    fieldErrors.password = ['Password must be between 8 and 128 characters']
    return undefined
  }
  return password
}

async function assertUnique(
  db: Db,
  excludeId: number | undefined,
  username: string | undefined,
  nim: string | null | undefined
) {
  if (username !== undefined) {
    const existing = await findUserByUsername(db, username)
    if (existing && existing.id !== excludeId) {
      throw new AppError(ErrorCodes.CONFLICT, 409, 'Username already in use', {
        fieldErrors: { username: ['Username is already in use'] }
      })
    }
  }
  if (nim !== undefined && nim !== null) {
    const existing = await findUserByNim(db, nim)
    if (existing && existing.id !== excludeId) {
      throw new AppError(ErrorCodes.CONFLICT, 409, 'NIM already in use', {
        fieldErrors: { nim: ['NIM is already in use'] }
      })
    }
  }
}

export async function createUser(
  db: Db,
  actor: AuthenticatedUser,
  input: {
    name?: unknown
    username?: unknown
    password?: unknown
    role?: unknown
    nim?: unknown
  }
): Promise<PublicUser> {
  requireAdmin(actor)
  const fieldErrors: Record<string, string[]> = {}
  const name = validateName(input.name, fieldErrors)
  const username = validateUsername(input.username, fieldErrors)
  const password = validatePassword(input.password, fieldErrors)
  const role = validateRole(input.role, fieldErrors)
  const nim = role ? validateNim(role, input.nim, fieldErrors) : undefined
  if (Object.keys(fieldErrors).length)
    throw validationError('User validation failed', fieldErrors)
  await assertUnique(db, undefined, username, nim)
  const hashed = await hashPassword(password!)
  const created = await insertUserRepo(db, {
    name: name!,
    username: username!,
    password: hashed,
    role: role!,
    nim: nim ?? null
  })
  if (!created) throw validationError('Failed to create user')
  return toPublicUser(created)
}

export async function updateUser(
  db: Db,
  actor: AuthenticatedUser,
  id: number,
  input: {
    name?: unknown
    username?: unknown
    role?: unknown
    nim?: unknown
    password?: unknown
  }
): Promise<PublicUser> {
  requireAdmin(actor)
  if (!Number.isInteger(id) || id <= 0) throw notFound('User not found')
  const target = await findUserById(db, id)
  if (!target || target.deletedAt) throw notFound('User not found')

  const fieldErrors: Record<string, string[]> = {}
  const values: {
    name?: string
    username?: string
    role?: UserRole
    nim?: string | null
    password?: string
  } = {}

  if (input.name !== undefined) {
    const name = validateName(input.name, fieldErrors)
    if (name !== undefined) values.name = name
  }
  if (input.username !== undefined) {
    const username = validateUsername(input.username, fieldErrors)
    if (username !== undefined) values.username = username
  }
  const nextRole =
    input.role !== undefined
      ? validateRole(input.role, fieldErrors)
      : (target.role as UserRole)
  if (input.role !== undefined && nextRole !== undefined) values.role = nextRole
  if (input.password !== undefined) {
    const password = validatePassword(input.password, fieldErrors)
    if (password !== undefined) values.password = await hashPassword(password)
  }

  // NIM must follow the effective (possibly new) role. An explicit nim=null
  // for an active student is allowed (mirrors the self-profile behavior).
  if (nextRole !== 'student') {
    if (
      input.nim !== undefined &&
      input.nim !== null &&
      !(typeof input.nim === 'string' && input.nim.trim() === '')
    ) {
      fieldErrors.nim = ['NIM is only applicable for students']
    } else if (target.nim !== null || input.nim !== undefined) {
      values.nim = null
    }
  } else if (
    input.nim !== undefined &&
    (input.nim === null ||
      (typeof input.nim === 'string' && input.nim.trim() === ''))
  ) {
    values.nim = null
  } else if (input.nim !== undefined) {
    const nim = validateNim('student', input.nim, fieldErrors)
    if (nim !== undefined) values.nim = nim
  } else if (input.role !== undefined && target.nim === null) {
    // Role changed to student but target has no NIM: require one.
    fieldErrors.nim = ['NIM is required for students']
  }

  if (Object.keys(fieldErrors).length)
    throw validationError('User validation failed', fieldErrors)
  if (Object.keys(values).length === 0)
    throw validationError('No user fields provided for update')

  await assertUnique(db, target.id, values.username, values.nim)
  const updated = await updateUserRepo(db, target.id, values)
  if (!updated) throw notFound('User not found')
  return toPublicUser(updated)
}

export async function getUser(
  db: Db,
  actor: AuthenticatedUser,
  id: number
): Promise<PublicUser> {
  requireAdmin(actor)
  if (!Number.isInteger(id) || id <= 0) throw notFound('User not found')
  const target = await findUserById(db, id)
  if (!target) throw notFound('User not found')
  return toPublicUser(target)
}

export async function softDeleteUser(
  db: Db,
  actor: AuthenticatedUser,
  id: number
): Promise<void> {
  requireAdmin(actor)
  if (!Number.isInteger(id) || id <= 0) throw notFound('User not found')
  const target = await findUserById(db, id)
  if (!target || target.deletedAt) throw notFound('User not found')
  await softDeleteUserRepo(db, id)
}

export async function listManagedUsers(
  db: Db,
  actor: AuthenticatedUser,
  query: {
    search?: string
    role?: string
    status?: string
    page?: number
    pageSize?: number
  }
): Promise<{
  users: PublicUser[]
  total: number
  page: number
  pageSize: number
}> {
  requireAdmin(actor)
  const fieldErrors: Record<string, string[]> = {}
  let role: UserRole | undefined
  if (query.role !== undefined && query.role !== '' && query.role !== 'all') {
    if (!(userRoles as readonly string[]).includes(query.role))
      fieldErrors.role = ['Invalid role filter']
    else role = query.role as UserRole
  }
  let status: 'active' | 'deleted' | undefined
  if (
    query.status !== undefined &&
    query.status !== '' &&
    query.status !== 'all'
  ) {
    if (!['active', 'deleted'].includes(query.status))
      fieldErrors.status = ['Invalid status filter']
    else status = query.status as 'active' | 'deleted'
  }
  const page = query.page === undefined ? 1 : Math.trunc(query.page)
  const pageSize =
    query.pageSize === undefined ? 20 : Math.trunc(query.pageSize)
  if (!Number.isFinite(page) || page < 1)
    fieldErrors.page = ['Page must be at least 1']
  if (!Number.isFinite(pageSize) || pageSize < 1 || pageSize > 100)
    fieldErrors.pageSize = ['Page size must be between 1 and 100']
  if (Object.keys(fieldErrors).length)
    throw validationError('Invalid query parameters', fieldErrors)

  const { rows, total } = await listUsers(db, {
    search: query.search,
    role,
    status,
    page,
    pageSize
  })
  return { users: rows.map(toPublicUser), total, page, pageSize }
}
