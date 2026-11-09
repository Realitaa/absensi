/**
 * Feature test: user self-data management (FR-AUTH-04)
 * PATCH /api/auth/me and POST /api/auth/password.
 */

import { describe, it, expect, beforeEach, beforeAll, afterAll } from 'vitest'
import {
  clearUsers,
  closeApiDb,
  createApiDb,
  createApiEvent,
  insertUser,
  type Db
} from './helpers/api-db'
import { hashPassword } from '../../server/lib/password'
import type { ApiErrorBody } from '../../shared/error-codes'

Object.assign(globalThis, {
  setUserSession: async (_event: unknown, data: unknown) => ({ data }),
  clearUserSession: async () => true,
  getUserSession: async () =>
    sessionUserId ? { user: { id: sessionUserId } } : {},
  requireUserSession: async () => ({})
})

let sessionUserId: number | undefined

const { default: mePatchHandler } =
  await import('../../server/api/auth/me.patch')
const { default: passwordHandler } =
  await import('../../server/api/auth/password.post')

const PASSWORD = 'password123'

describe('profile self-data management (FR-AUTH-04)', () => {
  let db: Db
  let adminId = 0
  let studentId = 0
  let lecturerId = 0

  beforeAll(async () => {
    db = await createApiDb()
  })

  afterAll(async () => {
    await closeApiDb()
  })

  beforeEach(async () => {
    sessionUserId = undefined
    await clearUsers(db)
    const hashed = await hashPassword(PASSWORD)
    adminId = await insertUser(db, {
      name: 'Admin Akademik',
      username: 'admin',
      password: hashed,
      role: 'admin',
      nim: null
    })
    lecturerId = await insertUser(db, {
      name: 'Dosen Contoh',
      username: 'dosen',
      password: hashed,
      role: 'lecturer',
      nim: null
    })
    studentId = await insertUser(db, {
      name: 'Mahasiswa Contoh',
      username: 'mahasiswa',
      password: hashed,
      role: 'student',
      nim: '2025010001'
    })
  })

  async function callPatch(body: unknown, userId?: number) {
    sessionUserId = userId
    const event = await createApiEvent(body, '/api/auth/me')
    ;(event as unknown as Record<string, unknown>)._method = 'PATCH'
    const result = await (mePatchHandler as (e: unknown) => Promise<unknown>)(
      event
    )

    // apiHandler returns envelope as body with status on the response

    if (result && typeof result === 'object' && 'error' in result) {
      return {
        statusCode: (result as unknown as ApiErrorBody).error.status,

        body: result
      }
    }
    return { statusCode: 200, body: result }
  }

  async function callPassword(body: unknown, userId?: number) {
    sessionUserId = userId
    const event = await createApiEvent(body, '/api/auth/password')
    const result = await (passwordHandler as (e: unknown) => Promise<unknown>)(
      event
    )

    // apiHandler returns envelope as body with status on the response

    if (result && typeof result === 'object' && 'error' in result) {
      return {
        statusCode: (result as unknown as ApiErrorBody).error.status,

        body: result
      }
    }
    return { statusCode: 200, body: result }
  }

  it('PATCH updates own name (200)', async () => {
    const result = await callPatch({ name: '  Admin Baru  ' }, adminId)
    expect(result.statusCode).toBe(200)
    const user = (result.body as { user: Record<string, unknown> }).user
    expect(user.name).toBe('Admin Baru')
    expect(user.username).toBe('admin')
    expect(user).not.toHaveProperty('password')
  })

  it('PATCH trims username and updates it (200)', async () => {
    const result = await callPatch({ username: '  admin_baru  ' }, adminId)
    expect(result.statusCode).toBe(200)
    expect((result.body as { user: { username: string } }).user.username).toBe(
      'admin_baru'
    )
  })

  it('PATCH rejects username conflict (409 CONFLICT)', async () => {
    const result = await callPatch({ username: 'dosen' }, adminId)
    expect(result.statusCode).toBe(409)
    expect((result.body as { error: { code: string } }).error.code).toBe(
      'CONFLICT'
    )
  })

  it('PATCH allows same username (no conflict)', async () => {
    const result = await callPatch({ username: 'admin' }, adminId)
    expect(result.statusCode).toBe(200)
  })

  it('PATCH rejects invalid username (400 VALIDATION_ERROR)', async () => {
    const result = await callPatch({ username: 'ab!' }, adminId)
    expect(result.statusCode).toBe(400)
    expect((result.body as { error: { code: string } }).error.code).toBe(
      'VALIDATION_ERROR'
    )
  })

  it('PATCH allows student to change NIM (200)', async () => {
    const result = await callPatch({ nim: '2025010002' }, studentId)
    expect(result.statusCode).toBe(200)
    expect((result.body as { user: { nim: string } }).user.nim).toBe(
      '2025010002'
    )
  })

  it('PATCH rejects NIM conflict (409 CONFLICT)', async () => {
    await insertUser(db, {
      name: 'Mahasiswa Lain',
      username: 'mhs2',
      password: await hashPassword(PASSWORD),
      role: 'student',
      nim: '2025010009'
    })
    const result = await callPatch({ nim: '2025010009' }, studentId)
    expect(result.statusCode).toBe(409)
    expect((result.body as { error: { code: string } }).error.code).toBe(
      'CONFLICT'
    )
  })

  it('PATCH allows student to clear NIM with null (200)', async () => {
    const result = await callPatch({ nim: null }, studentId)
    expect(result.statusCode).toBe(200)
    expect(
      (result.body as { user: { nim: string | null } }).user.nim
    ).toBeNull()
  })

  it('PATCH rejects NIM for lecturer (400 VALIDATION_ERROR)', async () => {
    const result = await callPatch({ nim: '2025010003' }, lecturerId)
    expect(result.statusCode).toBe(400)
    expect((result.body as { error: { code: string } }).error.code).toBe(
      'VALIDATION_ERROR'
    )
  })

  it('PATCH rejects NIM for admin (400 VALIDATION_ERROR)', async () => {
    const result = await callPatch({ nim: '2025010003' }, adminId)
    expect(result.statusCode).toBe(400)
    expect((result.body as { error: { code: string } }).error.code).toBe(
      'VALIDATION_ERROR'
    )
  })

  it('PATCH rejects empty update (400 VALIDATION_ERROR)', async () => {
    const result = await callPatch({}, adminId)
    expect(result.statusCode).toBe(400)
    expect((result.body as { error: { code: string } }).error.code).toBe(
      'VALIDATION_ERROR'
    )
  })

  it('PATCH rejects unauthenticated (401 UNAUTHORIZED)', async () => {
    const result = await callPatch({ name: 'X Baru' }, undefined)
    expect(result.statusCode).toBe(401)
    expect((result.body as { error: { code: string } }).error.code).toBe(
      'UNAUTHORIZED'
    )
  })

  it('POST password changes password (200)', async () => {
    const result = await callPassword(
      { currentPassword: PASSWORD, newPassword: 'new-password-1' },
      adminId
    )
    expect(result.statusCode).toBe(200)
    expect((result.body as { success: boolean }).success).toBe(true)
  })

  it('POST password rejects wrong current password (401)', async () => {
    const result = await callPassword(
      { currentPassword: 'wrong-password', newPassword: 'new-password-1' },
      adminId
    )
    expect(result.statusCode).toBe(401)
    expect((result.body as { error: { code: string } }).error.code).toBe(
      'INVALID_CREDENTIALS'
    )
  })

  it('POST password rejects short new password (400)', async () => {
    const result = await callPassword(
      { currentPassword: PASSWORD, newPassword: 'short' },
      adminId
    )
    expect(result.statusCode).toBe(400)
    expect((result.body as { error: { code: string } }).error.code).toBe(
      'VALIDATION_ERROR'
    )
  })

  it('POST password rejects same as current (400)', async () => {
    const result = await callPassword(
      { currentPassword: PASSWORD, newPassword: PASSWORD },
      adminId
    )
    expect(result.statusCode).toBe(400)
    expect((result.body as { error: { code: string } }).error.code).toBe(
      'VALIDATION_ERROR'
    )
  })

  it('POST password rejects unauthenticated (401)', async () => {
    const result = await callPassword(
      { currentPassword: PASSWORD, newPassword: 'new-password-1' },
      undefined
    )
    expect(result.statusCode).toBe(401)
    expect((result.body as { error: { code: string } }).error.code).toBe(
      'UNAUTHORIZED'
    )
  })
})
