import {
  describe,
  it,
  expect,
  beforeEach,
  beforeAll,
  afterAll
} from 'vitest'
import {
  clearUsers,
  closeApiDb,
  createApiDb,
  createApiEvent,
  insertUser,
  type Db
} from './helpers/api-db'
import { hashPassword } from '../../server/lib/password'
import { AppError, toErrorBody } from '../../server/utils/app-error'

// Handler uses bare `setUserSession` (Nitro auto-import from
// nuxt-auth-utils). No auto-import in vitest — inject the same
// resolution via globalThis so the bare identifier resolves.
Object.assign(globalThis, {
  setUserSession: async (_event: unknown, data: unknown) => ({ data }),
  clearUserSession: async () => true,
  getUserSession: async () => ({}),
  requireUserSession: async () => ({})
})

const { default: loginHandler } =
  await import('../../server/api/auth/login.post')

const PASSWORD = 'password'

/**
 * Feature test: auth login via the REAL API handler
 * (`POST /api/auth/login` → getDb → authenticateByIdentifier).
 *
 * No better-sqlite3, no service-direct call: the test builds an
 * h3-compatible Nitro event (body on `event.node.req`, real D1 binding on
 * `event.context.cloudflare.env.DB`) and invokes the production handler
 * directly. Real D1 via wrangler `getPlatformProxy` (Miniflare)
 * with drizzle migrations applied from `drizzle/` (see
 * `test/nuxt/helpers/api-db.ts`).
 *
 * Covered behavior:
 *  - 200 + `{ user: { id, name, username, role, nim } }` on valid login
 *  - 401 + `error.code === 'INVALID_CREDENTIALS'` on wrong/unknown/empty/deleted
 *  - 400 + `error.code === 'VALIDATION_ERROR'` when identifier/password missing
 *  - no `password` property in response
 */
describe('auth login API (username or NIM)', () => {
  let db: Db

  beforeAll(async () => {
    db = await createApiDb()
  })

  afterAll(async () => {
    await closeApiDb()
  })

  beforeEach(async () => {
    await clearUsers(db)
    const hashed = await hashPassword(PASSWORD)
    await insertUser(db, {
      name: 'Admin Akademik',
      username: 'admin',
      password: hashed,
      role: 'admin',
      nim: null
    })
    await insertUser(db, {
      name: 'Dosen Contoh',
      username: 'dosen',
      password: hashed,
      role: 'lecturer',
      nim: null
    })
    await insertUser(db, {
      name: 'Mahasiswa Contoh',
      username: 'mahasiswa',
      password: hashed,
      role: 'student',
      nim: '2025010001'
    })
  })

  async function callLogin(body: unknown) {
    const event = await createApiEvent(body, '/api/auth/login')
    try {
      const result = await (loginHandler as (e: unknown) => Promise<unknown>)(
        event
      )
      return { statusCode: 200, body: result }
    } catch (error) {
      if (error instanceof AppError) {
        return {
          statusCode: error.status,
          body: toErrorBody(error, 'req_test123')
        }
      }
      const err = error as {
        statusCode?: number
        message?: string
        data?: unknown
      }
      return {
        statusCode: err.statusCode ?? 500,
        body: { message: err.message, data: err.data }
      }
    }
  }

  it('authenticates admin by username (200)', async () => {
    const result = await callLogin({ identifier: 'admin', password: PASSWORD })
    expect(result.statusCode).toBe(200)
    const user = (result.body as { user: Record<string, unknown> }).user
    expect(user.username).toBe('admin')
    expect(user.role).toBe('admin')
    expect(user.nim).toBeNull()
    expect(user).not.toHaveProperty('password')
  })

  it('authenticates lecturer by username (200)', async () => {
    const result = await callLogin({ identifier: 'dosen', password: PASSWORD })
    expect(result.statusCode).toBe(200)
    const user = (result.body as { user: Record<string, unknown> }).user
    expect(user.username).toBe('dosen')
    expect(user.role).toBe('lecturer')
  })

  it('authenticates student by username (200)', async () => {
    const result = await callLogin({
      identifier: 'mahasiswa',
      password: PASSWORD
    })
    expect(result.statusCode).toBe(200)
    const user = (result.body as { user: Record<string, unknown> }).user
    expect(user.username).toBe('mahasiswa')
    expect(user.role).toBe('student')
    expect(user.nim).toBe('2025010001')
  })

  it('authenticates student by NIM (200)', async () => {
    const result = await callLogin({
      identifier: '2025010001',
      password: PASSWORD
    })
    expect(result.statusCode).toBe(200)
    const user = (result.body as { user: Record<string, unknown> }).user
    expect(user.username).toBe('mahasiswa')
    expect(user.role).toBe('student')
    expect(user.nim).toBe('2025010001')
  })

  it('trims whitespace around the identifier (200)', async () => {
    const result = await callLogin({
      identifier: '  admin  ',
      password: PASSWORD
    })
    expect(result.statusCode).toBe(200)
    expect((result.body as { user: { username: string } }).user.username).toBe(
      'admin'
    )
  })

  it('rejects wrong password (401 INVALID_CREDENTIALS)', async () => {
    const result = await callLogin({
      identifier: 'admin',
      password: 'wrong-password'
    })
    expect(result.statusCode).toBe(401)
    expect((result.body as { error: { code: string } }).error.code).toBe(
      'INVALID_CREDENTIALS'
    )
  })

  it('rejects unknown identifier (401 INVALID_CREDENTIALS)', async () => {
    const result = await callLogin({
      identifier: 'unknown-user',
      password: PASSWORD
    })
    expect(result.statusCode).toBe(401)
    expect((result.body as { error: { code: string } }).error.code).toBe(
      'INVALID_CREDENTIALS'
    )
  })

  it('rejects empty identifier (401 INVALID_CREDENTIALS)', async () => {
    const result = await callLogin({ identifier: '   ', password: PASSWORD })
    expect(result.statusCode).toBe(401)
    expect((result.body as { error: { code: string } }).error.code).toBe(
      'INVALID_CREDENTIALS'
    )
  })

  it('rejects soft-deleted users (401 INVALID_CREDENTIALS)', async () => {
    const hashed = await hashPassword(PASSWORD)
    await insertUser(db, {
      name: 'Deleted User',
      username: 'deleted',
      password: hashed,
      role: 'student',
      nim: '2025999999',
      deletedAt: new Date()
    })
    const result = await callLogin({
      identifier: 'deleted',
      password: PASSWORD
    })
    expect(result.statusCode).toBe(401)
    expect((result.body as { error: { code: string } }).error.code).toBe(
      'INVALID_CREDENTIALS'
    )
  })

  it('returns 400 VALIDATION_ERROR when fields are missing', async () => {
    const result = await callLogin({ identifier: 'admin' })
    expect(result.statusCode).toBe(400)
    expect((result.body as { error: { code: string } }).error.code).toBe(
      'VALIDATION_ERROR'
    )
  })

  it('does not leak password in returned user shape', async () => {
    const result = await callLogin({ identifier: 'admin', password: PASSWORD })
    const user = (result.body as { user: Record<string, unknown> }).user
    expect(user).not.toHaveProperty('password')
    expect(Object.keys(user).sort()).toEqual(
      ['id', 'name', 'nim', 'role', 'username'].sort()
    )
  })
})
