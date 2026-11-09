/**
 * Feature test: lecturer session management (SRS §4, §10.3)
 * POST /api/sessions, GET /api/sessions, GET/PATCH/DELETE /api/sessions/:id,
 * POST /api/sessions/:id/close.
 *
 * Real D1 via Miniflare (see test/nuxt/helpers/api-db.ts).
 * Time is controlled by inserting sessions with fixed timestamps and
 * passing explicit `now` to the service-level status function; HTTP
 * handlers are exercised against `new Date()` so boundary sessions are
 * fixed-offset relative to test start.
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
import { rooms } from '../../server/db/schema/rooms'
import { sessions } from '../../server/db/schema/sessions'
import { attendances } from '../../server/db/schema/attendances'
import { sessionStatus } from '../../server/services/session.service'

let sessionUserId: number | undefined

Object.assign(globalThis, {
  setUserSession: async (_event: unknown, data: unknown) => ({ data }),
  clearUserSession: async () => true,
  getUserSession: async () =>
    sessionUserId ? { user: { id: sessionUserId } } : {},
  requireUserSession: async () => ({})
})

const { default: sessionsIndexGet } =
  await import('../../server/api/sessions/index.get')
const { default: sessionsIndexPost } =
  await import('../../server/api/sessions/index.post')
const { default: sessionIdGet } =
  await import('../../server/api/sessions/[id].get')
const { default: sessionIdPatch } =
  await import('../../server/api/sessions/[id].patch')
const { default: sessionIdDelete } =
  await import('../../server/api/sessions/[id].delete')
const { default: sessionClosePost } =
  await import('../../server/api/sessions/[id]/close.post')

const PASSWORD = 'password123'

function windowAround(
  base: Date,
  startMs: number,
  lateMs: number,
  closeMs: number
) {
  const t = base.getTime()
  return {
    startsAt: new Date(t + startMs),
    lateThresholdAt: new Date(t + lateMs),
    closesAt: new Date(t + closeMs)
  }
}

describe('session status derivation (pure, fixed now)', () => {
  const startsAt = new Date('2026-11-10T01:00:00.000Z')
  const lateThresholdAt = new Date('2026-11-10T01:15:00.000Z')
  const closesAt = new Date('2026-11-10T02:45:00.000Z')
  const base = {
    startsAt,
    lateThresholdAt,
    closesAt,
    manuallyClosedAt: null as Date | null
  }

  it('scheduled before start', () => {
    expect(sessionStatus(base, new Date('2026-11-10T00:59:59.000Z'))).toBe(
      'scheduled'
    )
  })

  it('open-present at start boundary', () => {
    expect(sessionStatus(base, new Date('2026-11-10T01:00:00.000Z'))).toBe(
      'open-present'
    )
  })

  it('open-present before late threshold', () => {
    expect(sessionStatus(base, new Date('2026-11-10T01:14:59.000Z'))).toBe(
      'open-present'
    )
  })

  it('open-late at late threshold boundary', () => {
    expect(sessionStatus(base, new Date('2026-11-10T01:15:00.000Z'))).toBe(
      'open-late'
    )
  })

  it('closed at closing time boundary', () => {
    expect(sessionStatus(base, new Date('2026-11-10T02:45:00.000Z'))).toBe(
      'closed'
    )
  })

  it('manual close wins even before closing time', () => {
    expect(
      sessionStatus(
        { ...base, manuallyClosedAt: new Date('2026-11-10T01:10:00.000Z') },
        new Date('2026-11-10T01:20:00.000Z')
      )
    ).toBe('closed')
  })
})

describe('lecturer session management (FR-SESSION-01..08)', () => {
  let db: Db
  let lecturerId = 0
  let lecturer2Id = 0
  let studentId = 0
  let adminId = 0
  let roomId = 0

  beforeAll(async () => {
    db = await createApiDb()
  })

  afterAll(async () => {
    await closeApiDb()
  })

  beforeEach(async () => {
    sessionUserId = undefined
    await db.delete(attendances)
    await db.delete(sessions)
    await db.delete(rooms)
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
      name: 'Dosen Satu',
      username: 'dosen1',
      password: hashed,
      role: 'lecturer',
      nim: null
    })
    lecturer2Id = await insertUser(db, {
      name: 'Dosen Dua',
      username: 'dosen2',
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
    const [room] = await db
      .insert(rooms)
      .values({
        name: 'Ruang Sesi Test',
        latitude: -7.7495,
        longitude: 110.3778,
        radius: 15
      })
      .returning()
    roomId = room!.id
  })

  async function callHandler(
    handler: unknown,
    body: unknown,
    path: string,
    method: string,
    userId?: number
  ) {
    sessionUserId = userId
    const event = await createApiEvent(body ?? {}, path)
    ;(event as unknown as Record<string, unknown>)._method = method
    ;(event as unknown as Record<string, unknown>).method = method
    const req = (event as unknown as { node: { req: Record<string, unknown> } })
      .node.req
    req.method = method
    const match = path.match(/\/api\/sessions\/(\d+)/)
    if (match) {
      ;(
        event as unknown as { context: Record<string, unknown> }
      ).context.params = {
        id: match[1]
      }
    }
    const callable = handler as (event: never) => Promise<unknown>
    const result = await callable(event as never)

    // apiHandler returns envelope as body with status on the response

    if (result && typeof result === 'object' && 'error' in result) {
      return {
        statusCode: (result as unknown as ApiErrorBody).error.status,

        body: result
      }
    }
    return { statusCode: 200, body: result }
  }

  function futurePayload(overrides: Record<string, unknown> = {}) {
    const now = Date.now()
    return {
      name: 'Perkuliahan Pengantar',
      description: 'Sesi absensi test',
      roomId,
      startsAt: new Date(now + 60 * 60 * 1000).toISOString(),
      lateThresholdAt: new Date(now + 75 * 60 * 1000).toISOString(),
      closesAt: new Date(now + 180 * 60 * 1000).toISOString(),
      ...overrides
    }
  }

  async function createViaApi(overrides: Record<string, unknown> = {}) {
    return callHandler(
      sessionsIndexPost,
      futurePayload(overrides),
      '/api/sessions',
      'POST',
      lecturerId
    )
  }

  it('POST creates a session as lecturer (200, owner set server-side)', async () => {
    const result = await createViaApi()
    expect(result.statusCode).toBe(200)
    const session = (result.body as { session: Record<string, unknown> })
      .session
    expect(session.lecturerId).toBe(lecturerId)
    expect(session.roomId).toBe(roomId)
    expect(session.status).toBe('scheduled')
    expect(session.name).toBe('Perkuliahan Pengantar')
  })

  it('POST rejects student (403 FORBIDDEN)', async () => {
    const result = await callHandler(
      sessionsIndexPost,
      futurePayload(),
      '/api/sessions',
      'POST',
      studentId
    )
    expect(result.statusCode).toBe(403)
    expect((result.body as { error: { code: string } }).error.code).toBe(
      'FORBIDDEN'
    )
  })

  it('POST rejects admin (403 FORBIDDEN)', async () => {
    const result = await callHandler(
      sessionsIndexPost,
      futurePayload(),
      '/api/sessions',
      'POST',
      adminId
    )
    expect(result.statusCode).toBe(403)
  })

  it('POST rejects unauthenticated (401 UNAUTHORIZED)', async () => {
    const result = await callHandler(
      sessionsIndexPost,
      futurePayload(),
      '/api/sessions',
      'POST'
    )
    expect(result.statusCode).toBe(401)
    expect((result.body as { error: { code: string } }).error.code).toBe(
      'UNAUTHORIZED'
    )
  })

  it('POST rejects missing name (400 VALIDATION_ERROR)', async () => {
    const result = await createViaApi({ name: '   ' })
    expect(result.statusCode).toBe(400)
    expect((result.body as { error: { code: string } }).error.code).toBe(
      'VALIDATION_ERROR'
    )
  })

  it('POST rejects start after late threshold (400 INVALID_SESSION_WINDOW)', async () => {
    const now = Date.now()
    const result = await createViaApi({
      startsAt: new Date(now + 90 * 60 * 1000).toISOString(),
      lateThresholdAt: new Date(now + 60 * 60 * 1000).toISOString(),
      closesAt: new Date(now + 180 * 60 * 1000).toISOString()
    })
    expect(result.statusCode).toBe(400)
    expect((result.body as { error: { code: string } }).error.code).toBe(
      'INVALID_SESSION_WINDOW'
    )
  })

  it('POST rejects late threshold equal to closing time (400 INVALID_SESSION_WINDOW)', async () => {
    const now = Date.now()
    const result = await createViaApi({
      startsAt: new Date(now + 60 * 60 * 1000).toISOString(),
      lateThresholdAt: new Date(now + 120 * 60 * 1000).toISOString(),
      closesAt: new Date(now + 120 * 60 * 1000).toISOString()
    })
    expect(result.statusCode).toBe(400)
    expect((result.body as { error: { code: string } }).error.code).toBe(
      'INVALID_SESSION_WINDOW'
    )
  })

  it('POST accepts start equal to late threshold (200)', async () => {
    const now = Date.now()
    const result = await createViaApi({
      startsAt: new Date(now + 60 * 60 * 1000).toISOString(),
      lateThresholdAt: new Date(now + 60 * 60 * 1000).toISOString(),
      closesAt: new Date(now + 180 * 60 * 1000).toISOString()
    })
    expect(result.statusCode).toBe(200)
  })

  it('POST rejects nonexistent room (404 NOT_FOUND)', async () => {
    const result = await createViaApi({ roomId: 999999 })
    expect(result.statusCode).toBe(404)
    expect((result.body as { error: { code: string } }).error.code).toBe(
      'NOT_FOUND'
    )
  })

  it('POST rejects invalid room id (400 VALIDATION_ERROR)', async () => {
    const result = await createViaApi({ roomId: 0 })
    expect(result.statusCode).toBe(400)
    expect((result.body as { error: { code: string } }).error.code).toBe(
      'VALIDATION_ERROR'
    )
  })

  it('POST rejects malformed datetime (400 VALIDATION_ERROR)', async () => {
    const result = await createViaApi({ startsAt: 'not-a-date' })
    expect(result.statusCode).toBe(400)
    expect((result.body as { error: { code: string } }).error.code).toBe(
      'VALIDATION_ERROR'
    )
  })

  it('GET lists only own sessions (200)', async () => {
    const now = new Date()
    // Own session in the past-closed window + own scheduled session.
    await db.insert(sessions).values({
      lecturerId,
      roomId,
      name: 'Sesi Sendiri Lama',
      ...windowAround(
        now,
        -4 * 3600 * 1000,
        -3.75 * 3600 * 1000,
        -1.25 * 3600 * 1000
      )
    })
    await db.insert(sessions).values({
      lecturerId: lecturer2Id,
      roomId,
      name: 'Sesi Dosen Lain',
      ...windowAround(now, 3600 * 1000, 3750 * 1000, 180 * 60 * 1000)
    })
    const result = await callHandler(
      sessionsIndexGet,
      undefined,
      '/api/sessions',
      'GET',
      lecturerId
    )
    expect(result.statusCode).toBe(200)
    const body = result.body as {
      sessions: Array<{ name: string; lecturerId: number; status: string }>
      total: number
    }
    expect(body.total).toBe(1)
    expect(body.sessions).toHaveLength(1)
    expect(body.sessions[0]!.name).toBe('Sesi Sendiri Lama')
    expect(body.sessions[0]!.lecturerId).toBe(lecturerId)
    expect(body.sessions[0]!.status).toBe('closed')
  })

  it('GET reports open-present / open-late / scheduled for own sessions', async () => {
    const now = new Date()
    await db.insert(sessions).values({
      lecturerId,
      roomId,
      name: 'Terjadwal',
      ...windowAround(now, 3600 * 1000, 3800 * 1000, 7200 * 1000)
    })
    await db.insert(sessions).values({
      lecturerId,
      roomId,
      name: 'Hadir',
      ...windowAround(now, -600 * 1000, 900 * 1000, 3600 * 1000)
    })
    await db.insert(sessions).values({
      lecturerId,
      roomId,
      name: 'Terlambat',
      ...windowAround(now, -3600 * 1000, -600 * 1000, 3600 * 1000)
    })
    const result = await callHandler(
      sessionsIndexGet,
      undefined,
      '/api/sessions',
      'GET',
      lecturerId
    )
    expect(result.statusCode).toBe(200)
    const byName = Object.fromEntries(
      (
        result.body as { sessions: Array<{ name: string; status: string }> }
      ).sessions.map(s => [s.name, s.status])
    )
    expect(byName.Terjadwal).toBe('scheduled')
    expect(byName.Hadir).toBe('open-present')
    expect(byName.Terlambat).toBe('open-late')
  })

  it('GET single own session (200)', async () => {
    const created = await createViaApi()
    const id = (created.body as { session: { id: number } }).session.id
    const result = await callHandler(
      sessionIdGet,
      undefined,
      `/api/sessions/${id}`,
      'GET',
      lecturerId
    )
    expect(result.statusCode).toBe(200)
    expect((result.body as { session: { id: number } }).session.id).toBe(id)
  })

  it('GET another lecturer session returns 403 FORBIDDEN', async () => {
    const created = await createViaApi()
    const id = (created.body as { session: { id: number } }).session.id
    const result = await callHandler(
      sessionIdGet,
      undefined,
      `/api/sessions/${id}`,
      'GET',
      lecturer2Id
    )
    expect(result.statusCode).toBe(403)
    expect((result.body as { error: { code: string } }).error.code).toBe(
      'FORBIDDEN'
    )
  })

  it('GET unknown session returns 404 NOT_FOUND', async () => {
    const result = await callHandler(
      sessionIdGet,
      undefined,
      '/api/sessions/999999',
      'GET',
      lecturerId
    )
    expect(result.statusCode).toBe(404)
    expect((result.body as { error: { code: string } }).error.code).toBe(
      'NOT_FOUND'
    )
  })

  it('PATCH edits own scheduled session (200)', async () => {
    const created = await createViaApi()
    const id = (created.body as { session: { id: number } }).session.id
    const result = await callHandler(
      sessionIdPatch,
      { name: 'Nama Diubah', description: 'Desk baru' },
      `/api/sessions/${id}`,
      'PATCH',
      lecturerId
    )
    expect(result.statusCode).toBe(200)
    const session = (result.body as { session: Record<string, unknown> })
      .session
    expect(session.name).toBe('Nama Diubah')
    expect(session.description).toBe('Desk baru')
  })

  it('PATCH rejects other lecturer session (403 FORBIDDEN)', async () => {
    const created = await createViaApi()
    const id = (created.body as { session: { id: number } }).session.id
    const result = await callHandler(
      sessionIdPatch,
      { name: 'Bajak' },
      `/api/sessions/${id}`,
      'PATCH',
      lecturer2Id
    )
    expect(result.statusCode).toBe(403)
  })

  it('PATCH rejects merged invalid window (400 INVALID_SESSION_WINDOW)', async () => {
    const created = await createViaApi()
    const id = (created.body as { session: { id: number } }).session.id
    const result = await callHandler(
      sessionIdPatch,
      { closesAt: new Date(Date.now() + 30 * 60 * 1000).toISOString() },
      `/api/sessions/${id}`,
      'PATCH',
      lecturerId
    )
    expect(result.statusCode).toBe(400)
    expect((result.body as { error: { code: string } }).error.code).toBe(
      'INVALID_SESSION_WINDOW'
    )
  })

  it('PATCH rejects invalid room (404 NOT_FOUND)', async () => {
    const created = await createViaApi()
    const id = (created.body as { session: { id: number } }).session.id
    const result = await callHandler(
      sessionIdPatch,
      { roomId: 999999 },
      `/api/sessions/${id}`,
      'PATCH',
      lecturerId
    )
    expect(result.statusCode).toBe(404)
  })

  it('PATCH rejects editing a closed session (409 SESSION_NOT_EDITABLE)', async () => {
    const now = new Date()
    const [row] = await db
      .insert(sessions)
      .values({
        lecturerId,
        roomId,
        name: 'Sudah Ditutup',
        ...windowAround(
          now,
          -4 * 3600 * 1000,
          -3.75 * 3600 * 1000,
          -1 * 3600 * 1000
        )
      })
      .returning()
    const result = await callHandler(
      sessionIdPatch,
      { name: 'Ubah Setelah Ditutup' },
      `/api/sessions/${row!.id}`,
      'PATCH',
      lecturerId
    )
    expect(result.statusCode).toBe(409)
    expect((result.body as { error: { code: string } }).error.code).toBe(
      'SESSION_NOT_EDITABLE'
    )
  })

  it('close rejects scheduled session (409 SESSION_NOT_OPEN, no early open)', async () => {
    const created = await createViaApi()
    const id = (created.body as { session: { id: number } }).session.id
    const result = await callHandler(
      sessionClosePost,
      {},
      `/api/sessions/${id}/close`,
      'POST',
      lecturerId
    )
    expect(result.statusCode).toBe(409)
    expect((result.body as { error: { code: string } }).error.code).toBe(
      'SESSION_NOT_OPEN'
    )
    const after = await db.select().from(sessions)
    expect(after[0]!.manuallyClosedAt).toBeNull()
  })

  it('close rejects other lecturer session (403 FORBIDDEN)', async () => {
    const now = new Date()
    const [row] = await db
      .insert(sessions)
      .values({
        lecturerId,
        roomId,
        name: 'Terbuka',
        ...windowAround(now, -600 * 1000, 900 * 1000, 3600 * 1000)
      })
      .returning()
    const result = await callHandler(
      sessionClosePost,
      {},
      `/api/sessions/${row!.id}/close`,
      'POST',
      lecturer2Id
    )
    expect(result.statusCode).toBe(403)
  })

  it('close closes an ongoing session early (200)', async () => {
    const now = new Date()
    const [row] = await db
      .insert(sessions)
      .values({
        lecturerId,
        roomId,
        name: 'Terbuka Untuk Ditutup',
        ...windowAround(now, -600 * 1000, 900 * 1000, 3600 * 1000)
      })
      .returning()
    const result = await callHandler(
      sessionClosePost,
      {},
      `/api/sessions/${row!.id}/close`,
      'POST',
      lecturerId
    )
    expect(result.statusCode).toBe(200)
    const session = (result.body as { session: Record<string, unknown> })
      .session
    expect(session.status).toBe('closed')
    expect(session.manuallyClosedAt).not.toBeNull()
  })

  it('manually closed session remains closed in list (200 closed)', async () => {
    const now = new Date()
    const [row] = await db
      .insert(sessions)
      .values({
        lecturerId,
        roomId,
        name: 'Ditutup Manual',
        ...windowAround(now, -600 * 1000, 900 * 1000, 3600 * 1000)
      })
      .returning()
    sessionUserId = lecturerId
    const closeRes = await callHandler(
      sessionClosePost,
      {},
      `/api/sessions/${row!.id}/close`,
      'POST',
      lecturerId
    )
    expect(closeRes.statusCode).toBe(200)
    const list = await callHandler(
      sessionsIndexGet,
      undefined,
      '/api/sessions',
      'GET',
      lecturerId
    )
    const found = (
      list.body as { sessions: Array<{ id: number; status: string }> }
    ).sessions.find(s => s.id === row!.id)
    expect(found?.status).toBe('closed')
  })

  it('close on already-closed session is idempotent (200 closed)', async () => {
    const now = new Date()
    const [row] = await db
      .insert(sessions)
      .values({
        lecturerId,
        roomId,
        name: 'Sudah Tertutup',
        ...windowAround(
          now,
          -4 * 3600 * 1000,
          -3.75 * 3600 * 1000,
          -1 * 3600 * 1000
        )
      })
      .returning()
    const result = await callHandler(
      sessionClosePost,
      {},
      `/api/sessions/${row!.id}/close`,
      'POST',
      lecturerId
    )
    expect(result.statusCode).toBe(200)
    expect(
      (result.body as { session: { status: string } }).session.status
    ).toBe('closed')
  })

  it('DELETE removes session without attendance (200)', async () => {
    const created = await createViaApi()
    const id = (created.body as { session: { id: number } }).session.id
    const result = await callHandler(
      sessionIdDelete,
      undefined,
      `/api/sessions/${id}`,
      'DELETE',
      lecturerId
    )
    expect(result.statusCode).toBe(200)
    expect((result.body as { deleted: boolean }).deleted).toBe(true)
    const remaining = await db.select().from(sessions)
    expect(remaining.length).toBe(0)
  })

  it('DELETE rejects session with attendance (409 SESSION_IN_USE)', async () => {
    const created = await createViaApi()
    const id = (created.body as { session: { id: number } }).session.id
    const now = new Date()
    await db.insert(attendances).values({
      studentId,
      sessionId: id,
      status: 'present',
      attendanceTimestamp: now,
      validationPolicy: 'K1',
      photoPath: '/private/selfie-1.jpg'
    })
    const result = await callHandler(
      sessionIdDelete,
      undefined,
      `/api/sessions/${id}`,
      'DELETE',
      lecturerId
    )
    expect(result.statusCode).toBe(409)
    expect((result.body as { error: { code: string } }).error.code).toBe(
      'SESSION_IN_USE'
    )
    const remaining = await db.select().from(sessions)
    expect(remaining.length).toBe(1)
  })

  it('DELETE rejects other lecturer session (403 FORBIDDEN)', async () => {
    const created = await createViaApi()
    const id = (created.body as { session: { id: number } }).session.id
    const result = await callHandler(
      sessionIdDelete,
      undefined,
      `/api/sessions/${id}`,
      'DELETE',
      lecturer2Id
    )
    expect(result.statusCode).toBe(403)
    const remaining = await db.select().from(sessions)
    expect(remaining.length).toBe(1)
  })

  it('DELETE unknown session returns 404 NOT_FOUND', async () => {
    const result = await callHandler(
      sessionIdDelete,
      undefined,
      '/api/sessions/999999',
      'DELETE',
      lecturerId
    )
    expect(result.statusCode).toBe(404)
  })
})
