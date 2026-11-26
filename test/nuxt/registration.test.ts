/**
 * Feature test: public student self-registration
 * POST /api/auth/register.
 *
 * Real D1 via Miniflare (see test/nuxt/helpers/api-db.ts).
 * Registration must always create a `student` account, regardless of any
 * role value sent by the client.
 */

import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { eq } from 'drizzle-orm'
import {
  clearUsers,
  closeApiDb,
  createApiDb,
  createApiEvent,
  insertUser,
  type Db
} from './helpers/api-db'
import { hashPassword, verifyPassword } from '../../server/lib/password'
import type { ApiErrorBody } from '../../shared/error-codes'
import { users } from '../../server/db/schema/users'
import { authenticateByIdentifier } from '../../server/services/auth.service'

const { default: registerHandler } =
  await import('../../server/api/auth/register.post')

function validPayload(overrides: Record<string, unknown> = {}) {
  return {
    name: 'Mahasiswa Baru',
    username: 'mahasiswa-baru',
    nim: '20260099',
    password: 'rahasia123',
    confirmPassword: 'rahasia123',
    ...overrides
  }
}

describe('student self-registration', () => {
  let db: Db

  beforeAll(async () => {
    db = await createApiDb()
  })

  afterAll(async () => {
    await closeApiDb()
  })

  beforeEach(async () => {
    await clearUsers(db)
  })

  async function callRegister(body: unknown) {
    const event = await createApiEvent(body, '/api/auth/register')
    const result = await (registerHandler as (e: unknown) => Promise<unknown>)(
      event
    )

    if (result && typeof result === 'object' && 'error' in result) {
      return {
        statusCode: (result as unknown as ApiErrorBody).error.status,
        body: result
      }
    }
    return { statusCode: 200, body: result }
  }

  it('creates an active student account with a hashed password', async () => {
    const result = await callRegister(validPayload())
    expect(result.statusCode).toBe(200)

    const user = (result.body as { user: Record<string, unknown> }).user
    expect(user).toMatchObject({
      name: 'Mahasiswa Baru',
      username: 'mahasiswa-baru',
      role: 'student',
      nim: '20260099'
    })
    expect(user).not.toHaveProperty('password')

    const [row] = await db
      .select()
      .from(users)
      .where(eqUsername('mahasiswa-baru'))
    expect(row?.role).toBe('student')
    expect(row?.password).not.toBe('rahasia123')
    expect(await verifyPassword('rahasia123', row!.password)).toBe(true)

    const authenticated = await authenticateByIdentifier(
      db,
      '20260099',
      'rahasia123'
    )
    expect(authenticated.role).toBe('student')
  })

  it('always creates a student even when a role is supplied', async () => {
    const result = await callRegister(validPayload({ role: 'admin' }))
    expect(result.statusCode).toBe(200)
    const user = (result.body as { user: { role: string } }).user
    expect(user.role).toBe('student')

    const authenticated = await authenticateByIdentifier(
      db,
      'mahasiswa-baru',
      'rahasia123'
    )
    expect(authenticated.role).toBe('student')
  })

  it('rejects a username already in use (409 USERNAME_TAKEN)', async () => {
    await insertUser(db, {
      name: 'Pengguna Lama',
      username: 'mahasiswa-baru',
      password: await hashPassword('password'),
      role: 'student',
      nim: '20260001'
    })
    const result = await callRegister(validPayload({ nim: '20260100' }))
    expect(result.statusCode).toBe(409)
    expect((result.body as ApiErrorBody).error.code).toBe('USERNAME_TAKEN')
  })

  it('keeps usernames reserved after soft deletion (409 USERNAME_TAKEN)', async () => {
    await insertUser(db, {
      name: 'Pengguna Dihapus',
      username: 'mahasiswa-baru',
      password: await hashPassword('password'),
      role: 'student',
      nim: '20260002',
      deletedAt: new Date()
    })
    const result = await callRegister(validPayload({ nim: '20260101' }))
    expect(result.statusCode).toBe(409)
    expect((result.body as ApiErrorBody).error.code).toBe('USERNAME_TAKEN')
  })

  it('rejects a NIM already in use (409 NIM_TAKEN)', async () => {
    await insertUser(db, {
      name: 'NIM Lama',
      username: 'pengguna-lain',
      password: await hashPassword('password'),
      role: 'student',
      nim: '20260099'
    })
    const result = await callRegister(
      validPayload({ username: 'mahasiswa-lain' })
    )
    expect(result.statusCode).toBe(409)
    expect((result.body as ApiErrorBody).error.code).toBe('NIM_TAKEN')
  })

  it('rejects invalid fields (400 REGISTRATION_INVALID)', async () => {
    const result = await callRegister(
      validPayload({
        name: 'A',
        username: 'ab',
        nim: 'abc',
        password: 'pendek',
        confirmPassword: 'pendek'
      })
    )
    expect(result.statusCode).toBe(400)
    const error = (result.body as ApiErrorBody).error
    expect(error.code).toBe('REGISTRATION_INVALID')
    const fieldErrors = (
      error.details as { fieldErrors: Record<string, string[]> }
    ).fieldErrors
    expect(Object.keys(fieldErrors).sort()).toEqual(
      ['name', 'nim', 'password', 'username'].sort()
    )
  })

  it('rejects a password confirmation mismatch (400 PASSWORD_MISMATCH)', async () => {
    const result = await callRegister(
      validPayload({ confirmPassword: 'beda12345' })
    )
    expect(result.statusCode).toBe(400)
    expect((result.body as ApiErrorBody).error.code).toBe('PASSWORD_MISMATCH')
  })
})

function eqUsername(username: string) {
  return eq(users.username, username)
}
