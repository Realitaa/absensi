/**
 * Feature test: admin user management (FR-AUTH-03, FR-AUTH-06, FR-AUTH-07)
 * /api/users CRUD + soft delete.
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
import { hashPassword, verifyPassword } from '../../server/lib/password'
import { AppError, toErrorBody } from '../../server/utils/app-error'
import { eq } from 'drizzle-orm'
import { users } from '../../server/db/schema/users'

let sessionUserId: number | undefined

Object.assign(globalThis, {
  setUserSession: async (_event: unknown, data: unknown) => ({ data }),
  clearUserSession: async () => true,
  getUserSession: async () =>
    sessionUserId ? { user: { id: sessionUserId } } : {},
  requireUserSession: async () => ({})
})

async function callHandler(handler, body, userId = undefined, url = undefined) {
  sessionUserId = userId
  const event = await createApiEvent(body, url ?? '/api/users')
  try {
    const result = await handler(event)
    return { statusCode: 200, body: result }
  } catch (error) {
    if (error instanceof AppError) {
      return { statusCode: error.status, body: toErrorBody(error, 'req_test') }
    }
    throw error
  }
}

const postHandler = (await import('../../server/api/users/index.post')).default
const getListHandler = (await import('../../server/api/users/index.get'))
  .default
const patchHandler = (await import('../../server/api/users/[id].patch')).default
const deleteHandler = (await import('../../server/api/users/[id].delete'))
  .default
const getHandler = (await import('../../server/api/users/[id].get')).default
const loginHandler = (await import('../../server/api/auth/login.post')).default

const PASSWORD = 'password123'

describe('admin user management', () => {
  let db: Db
  let adminId = 0
  let lecturerId = 0
  let studentId = 0

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

  it('admin creates student with valid data (200)', async () => {
    const result = await callHandler(
      postHandler,
      {
        name: 'Mahasiswa Baru',
        username: 'mhs_baru',
        password: PASSWORD,
        role: 'student',
        nim: '2025020001'
      },
      adminId
    )
    expect(result.statusCode).toBe(200)
    const user = (result.body as { user: Record<string, unknown> }).user
    expect(user.username).toBe('mhs_baru')
    expect(user.role).toBe('student')
    expect(user.nim).toBe('2025020001')
    expect(user).not.toHaveProperty('password')
  })

  it('admin creates lecturer and admin', async () => {
    const r1 = await callHandler(
      postHandler,
      {
        name: 'Dosen Baru',
        username: 'dosen_baru',
        password: PASSWORD,
        role: 'lecturer',
        nim: null
      },
      adminId
    )
    expect(r1.statusCode).toBe(200)
    expect((r1.body as { user: { nim: unknown } }).user.nim).toBeNull()
    const r2 = await callHandler(
      postHandler,
      {
        name: 'Admin Baru',
        username: 'admin_baru',
        password: PASSWORD,
        role: 'admin'
      },
      adminId
    )
    expect(r2.statusCode).toBe(200)
  })

  it('rejects invalid data (400 VALIDATION_ERROR)', async () => {
    const cases: Array<Record<string, unknown>> = [
      {
        name: 'A',
        username: 'ok_user',
        password: PASSWORD,
        role: 'student',
        nim: '2025030001'
      },
      {
        name: 'Valid Name',
        username: 'ab',
        password: PASSWORD,
        role: 'lecturer'
      },
      {
        name: 'Valid Name',
        username: 'ok_user',
        password: 'short',
        role: 'lecturer'
      },
      {
        name: 'Valid Name',
        username: 'ok_user',
        password: PASSWORD,
        role: 'invalid'
      },
      {
        name: 'Valid Name',
        username: 'ok_user',
        password: PASSWORD,
        role: 'student'
      },
      {
        name: 'Valid Name',
        username: 'ok_user',
        password: PASSWORD,
        role: 'student',
        nim: '123'
      },
      {
        name: 'Valid Name',
        username: 'ok_user',
        password: PASSWORD,
        role: 'student',
        nim: '2025ABC001'
      },
      {
        name: 'Valid Name',
        username: 'ok_user',
        password: PASSWORD,
        role: 'lecturer',
        nim: '2025010002'
      },
      {
        name: 'Valid Name',
        username: 'bad user',
        password: PASSWORD,
        role: 'lecturer'
      }
    ]
    for (const body of cases) {
      const result = await callHandler(postHandler, body, adminId)
      expect(result.statusCode).toBe(400)
      expect((result.body as { error: { code: string } }).error.code).toBe(
        'VALIDATION_ERROR'
      )
    }
  })

  it('rejects duplicate username (409)', async () => {
    const result = await callHandler(
      postHandler,
      {
        name: 'Dup User',
        username: 'admin',
        password: PASSWORD,
        role: 'lecturer'
      },
      adminId
    )
    expect(result.statusCode).toBe(409)
    expect((result.body as { error: { code: string } }).error.code).toBe(
      'CONFLICT'
    )
  })

  it('rejects duplicate NIM (409)', async () => {
    const result = await callHandler(
      postHandler,
      {
        name: 'Dup NIM',
        username: 'unique_user',
        password: PASSWORD,
        role: 'student',
        nim: '2025010001'
      },
      adminId
    )
    expect(result.statusCode).toBe(409)
    expect((result.body as { error: { code: string } }).error.code).toBe(
      'CONFLICT'
    )
  })

  it('non-admin cannot create (403)', async () => {
    const result = await callHandler(
      postHandler,
      {
        name: 'Hacker',
        username: 'hacker',
        password: PASSWORD,
        role: 'lecturer'
      },
      lecturerId
    )
    expect(result.statusCode).toBe(403)
    expect((result.body as { error: { code: string } }).error.code).toBe(
      'FORBIDDEN'
    )
    const r2 = await callHandler(
      postHandler,
      {
        name: 'Hacker',
        username: 'hacker2',
        password: PASSWORD,
        role: 'student',
        nim: '2025090001'
      },
      studentId
    )
    expect(r2.statusCode).toBe(403)
  })

  it('non-admin cannot list, update, or delete (403)', async () => {
    const list = await callHandler(getListHandler, {}, lecturerId)
    expect(list.statusCode).toBe(403)
    const upd = await callHandler(
      patchHandler,
      { name: 'Changed' },
      studentId,
      `/api/users/${lecturerId}`
    )
    expect(upd.statusCode).toBe(403)
    const del = await callHandler(
      deleteHandler,
      {},
      studentId,
      `/api/users/${lecturerId}`
    )
    expect(del.statusCode).toBe(403)
  })

  it('unauthenticated cannot create (401)', async () => {
    const result = await callHandler(
      postHandler,
      {
        name: 'No Auth',
        username: 'noauth',
        password: PASSWORD,
        role: 'lecturer'
      },
      undefined
    )
    expect(result.statusCode).toBe(401)
  })

  it('admin can list active users', async () => {
    const result = await callHandler(getListHandler, {}, adminId)
    expect(result.statusCode).toBe(200)
    const body = result.body as {
      users: Array<Record<string, unknown>>
      total: number
    }
    expect(body.total).toBe(3)
    expect(body.users.every(u => !('password' in u))).toBe(true)
  })

  it('admin can search and filter by role', async () => {
    const result = await callHandler(
      getListHandler,
      {},
      adminId,
      '/api/users?search=mahasiswa&role=student'
    )
    // query params in url are not read by the test harness; role filter via url won't apply.
    // Search via direct service call instead:
    const { listManagedUsers } =
      await import('../../server/services/user.service')
    const filtered = await listManagedUsers(
      db,
      {
        id: adminId,
        name: 'Admin Akademik',
        username: 'admin',
        role: 'admin',
        nim: null
      },
      { search: 'mahasiswa', role: 'student' }
    )
    expect(filtered.total).toBe(1)
    expect(filtered.users[0]?.username).toBe('mahasiswa')
    expect(result.statusCode).toBe(200)
  })

  it('admin can update another user', async () => {
    const result = await callHandler(
      patchHandler,
      { name: 'Dosen Diubah', role: 'lecturer' },
      adminId,
      `/api/users/${lecturerId}`
    )
    expect(result.statusCode).toBe(200)
    expect((result.body as { user: { name: string } }).user.name).toBe(
      'Dosen Diubah'
    )
  })

  it('admin can change role to student with NIM', async () => {
    const result = await callHandler(
      patchHandler,
      { role: 'student', nim: '2025040001' },
      adminId,
      `/api/users/${lecturerId}`
    )
    expect(result.statusCode).toBe(200)
    const user = (result.body as { user: { role: string; nim: string } }).user
    expect(user.role).toBe('student')
    expect(user.nim).toBe('2025040001')
  })

  it('changing role to student without NIM fails (400)', async () => {
    const result = await callHandler(
      patchHandler,
      { role: 'student' },
      adminId,
      `/api/users/${lecturerId}`
    )
    expect(result.statusCode).toBe(400)
    expect((result.body as { error: { code: string } }).error.code).toBe(
      'VALIDATION_ERROR'
    )
  })

  it('changing role to lecturer clears NIM', async () => {
    const result = await callHandler(
      patchHandler,
      { role: 'lecturer' },
      adminId,
      `/api/users/${studentId}`
    )
    expect(result.statusCode).toBe(200)
    expect((result.body as { user: { nim: unknown } }).user.nim).toBeNull()
  })

  it('admin can update password for another user', async () => {
    const result = await callHandler(
      patchHandler,
      { password: 'new-password-9' },
      adminId,
      `/api/users/${lecturerId}`
    )
    expect(result.statusCode).toBe(200)
    expect(
      (result.body as { user: Record<string, unknown> }).user
    ).not.toHaveProperty('password')
    // Verify new password works via login
    const login = await callHandler(
      loginHandler,
      { identifier: 'dosen', password: 'new-password-9' },
      undefined
    )
    expect(login.statusCode).toBe(200)
  })

  it('update rejects duplicate username (409)', async () => {
    const result = await callHandler(
      patchHandler,
      { username: 'admin' },
      adminId,
      `/api/users/${lecturerId}`
    )
    expect(result.statusCode).toBe(409)
  })

  it('update rejects duplicate NIM (409)', async () => {
    await insertUser(db, {
      name: 'Mhs2',
      username: 'mhs2',
      password: await hashPassword(PASSWORD),
      role: 'student',
      nim: '2025060001'
    })
    const result = await callHandler(
      patchHandler,
      { nim: '2025060001' },
      adminId,
      `/api/users/${studentId}`
    )
    expect(result.statusCode).toBe(409)
  })

  it('update non-existent user returns 404', async () => {
    const result = await callHandler(
      patchHandler,
      { name: 'Ghost' },
      adminId,
      '/api/users/9999'
    )
    expect(result.statusCode).toBe(404)
  })

  it('soft delete preserves record and cannot authenticate', async () => {
    const del = await callHandler(
      deleteHandler,
      {},
      adminId,
      `/api/users/${studentId}`
    )
    expect(del.statusCode).toBe(200)
    const [row] = await db.select().from(users).where(eq(users.id, studentId))
    expect(row).toBeDefined()
    expect(row?.deletedAt).toBeInstanceOf(Date)
    const login = await callHandler(
      loginHandler,
      { identifier: 'mahasiswa', password: PASSWORD },
      undefined
    )
    expect(login.statusCode).toBe(401)
    // Also NIM login must fail
    const loginNim = await callHandler(
      loginHandler,
      { identifier: '2025010001', password: PASSWORD },
      undefined
    )
    expect(loginNim.statusCode).toBe(401)
  })

  it('deleted username and NIM remain reserved (409)', async () => {
    await callHandler(deleteHandler, {}, adminId, `/api/users/${studentId}`)
    const dupUsername = await callHandler(
      postHandler,
      {
        name: 'Recycle User',
        username: 'mahasiswa',
        password: PASSWORD,
        role: 'lecturer'
      },
      adminId
    )
    expect(dupUsername.statusCode).toBe(409)
    const dupNim = await callHandler(
      postHandler,
      {
        name: 'Recycle NIM',
        username: 'new_unique',
        password: PASSWORD,
        role: 'student',
        nim: '2025010001'
      },
      adminId
    )
    expect(dupNim.statusCode).toBe(409)
  })

  it('soft delete does not physically delete (row remains, double delete 404)', async () => {
    await callHandler(deleteHandler, {}, adminId, `/api/users/${studentId}`)
    const second = await callHandler(
      deleteHandler,
      {},
      adminId,
      `/api/users/${studentId}`
    )
    expect(second.statusCode).toBe(404)
    const [row] = await db.select().from(users).where(eq(users.id, studentId))
    expect(row?.id).toBe(studentId)
  })

  it('password hashes never exposed in list or detail', async () => {
    const list = await callHandler(getListHandler, {}, adminId)
    expect(JSON.stringify(list.body)).not.toMatch(/\$argon2id\$|\bpassword\b/)
    const detail = await callHandler(
      getHandler,
      {},
      adminId,
      `/api/users/${lecturerId}`
    )
    expect(detail.statusCode).toBe(200)
    expect(
      (detail.body as { user: Record<string, unknown> }).user
    ).not.toHaveProperty('password')
    expect(JSON.stringify(detail.body)).not.toMatch(/\$argon2id\$/)
  })

  it('password is hashed and verifiable', async () => {
    const created = await callHandler(
      postHandler,
      {
        name: 'Check Hash',
        username: 'checkhash',
        password: PASSWORD,
        role: 'lecturer'
      },
      adminId
    )
    expect(created.statusCode).toBe(200)
    const [row] = await db
      .select()
      .from(users)
      .where(eq(users.username, 'checkhash'))
    expect(row?.password).toMatch(/^\$argon2id\$/)
    expect(row?.password).not.toBe(PASSWORD)
    expect(await verifyPassword(PASSWORD, row!.password)).toBe(true)
  })

  it('active list excludes soft-deleted users', async () => {
    await callHandler(deleteHandler, {}, adminId, `/api/users/${studentId}`)
    const { listManagedUsers } =
      await import('../../server/services/user.service')
    const actor = {
      id: adminId,
      name: 'Admin Akademik',
      username: 'admin',
      role: 'admin',
      nim: null
    }
    const active = await listManagedUsers(db, actor, { status: 'active' })
    expect(active.total).toBe(2)
    const deleted = await listManagedUsers(db, actor, { status: 'deleted' })
    expect(deleted.total).toBe(1)
    expect(deleted.users[0]?.username).toBe('mahasiswa')
  })

  it('users cannot modify another user profile via admin endpoints (403)', async () => {
    const result = await callHandler(
      patchHandler,
      { name: 'Hacked Name' },
      lecturerId,
      `/api/users/${studentId}`
    )
    expect(result.statusCode).toBe(403)
  })
})
