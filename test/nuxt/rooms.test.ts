/**
 * Feature test: room management (FR-ROOM-01..05)
 * POST /api/rooms, GET /api/rooms, GET /api/rooms/:id,
 * PATCH /api/rooms/:id, DELETE /api/rooms/:id.
 *
 * Real D1 via Miniflare (see test/nuxt/helpers/api-db.ts).
 * Covered behavior:
 *  - 200 + room on valid create (admin)
 *  - 403 + FORBIDDEN on create/update/delete as non-admin
 *  - 401 + UNAUTHORIZED when unauthenticated
 *  - 400 + VALIDATION_ERROR on missing name, invalid latitude/longitude,
 *    zero/negative radius, radius > 20
 *  - 200 on list and single GET
 *  - 200 on PATCH update
 *  - 200 + deleted on DELETE of unreferenced room
 *  - 409 + ROOM_IN_USE on DELETE of room referenced by a session
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

let sessionUserId: number | undefined

Object.assign(globalThis, {
  setUserSession: async (_event: unknown, data: unknown) => ({ data }),
  clearUserSession: async () => true,
  getUserSession: async () =>
    sessionUserId ? { user: { id: sessionUserId } } : {},
  requireUserSession: async () => ({})
})

const { default: roomsIndexGet } =
  await import('../../server/api/rooms/index.get')
const { default: roomsIndexPost } =
  await import('../../server/api/rooms/index.post')
const { default: roomIdGet } = await import('../../server/api/rooms/[id].get')
const { default: roomIdPatch } =
  await import('../../server/api/rooms/[id].patch')
const { default: roomIdDelete } =
  await import('../../server/api/rooms/[id].delete')

const PASSWORD = 'password123'

const VALID_ROOM = {
  name: 'Ruang Test Alpha',
  latitude: -7.7495,
  longitude: 110.3778,
  radius: 15
}

describe('room management (FR-ROOM-01..05)', () => {
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
    if (path.includes(':id') || /\/api\/rooms\/\d+/.test(path)) {
      const match = path.match(/\/api\/rooms\/(\d+)/)
      ;(
        event as unknown as { context: Record<string, unknown> }
      ).context.params = {
        id: match?.[1]
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

  it('POST creates a room as admin (200)', async () => {
    const result = await callHandler(
      roomsIndexPost,
      VALID_ROOM,
      '/api/rooms',
      'POST',
      adminId
    )
    expect(result.statusCode).toBe(200)
    const room = (result.body as { room: Record<string, unknown> }).room
    expect(room.name).toBe('Ruang Test Alpha')
    expect(room.radius).toBe(15)
  })

  it('POST rejects non-admin lecturer (403 FORBIDDEN)', async () => {
    const result = await callHandler(
      roomsIndexPost,
      VALID_ROOM,
      '/api/rooms',
      'POST',
      lecturerId
    )
    expect(result.statusCode).toBe(403)
    expect((result.body as { error: { code: string } }).error.code).toBe(
      'FORBIDDEN'
    )
  })

  it('POST rejects student (403 FORBIDDEN)', async () => {
    const result = await callHandler(
      roomsIndexPost,
      VALID_ROOM,
      '/api/rooms',
      'POST',
      studentId
    )
    expect(result.statusCode).toBe(403)
  })

  it('POST rejects unauthenticated (401 UNAUTHORIZED)', async () => {
    const result = await callHandler(
      roomsIndexPost,
      VALID_ROOM,
      '/api/rooms',
      'POST'
    )
    expect(result.statusCode).toBe(401)
    expect((result.body as { error: { code: string } }).error.code).toBe(
      'UNAUTHORIZED'
    )
  })

  it('POST rejects missing name (400 VALIDATION_ERROR)', async () => {
    const result = await callHandler(
      roomsIndexPost,
      { ...VALID_ROOM, name: '   ' },
      '/api/rooms',
      'POST',
      adminId
    )
    expect(result.statusCode).toBe(400)
    expect((result.body as { error: { code: string } }).error.code).toBe(
      'VALIDATION_ERROR'
    )
  })

  it('POST rejects latitude out of range (400)', async () => {
    const result = await callHandler(
      roomsIndexPost,
      { ...VALID_ROOM, latitude: 91 },
      '/api/rooms',
      'POST',
      adminId
    )
    expect(result.statusCode).toBe(400)
    expect((result.body as { error: { code: string } }).error.code).toBe(
      'VALIDATION_ERROR'
    )
  })

  it('POST accepts latitude at boundary -90 (200)', async () => {
    const result = await callHandler(
      roomsIndexPost,
      { ...VALID_ROOM, name: 'Boundary Lat', latitude: -90 },
      '/api/rooms',
      'POST',
      adminId
    )
    expect(result.statusCode).toBe(200)
  })

  it('POST rejects longitude out of range (400)', async () => {
    const result = await callHandler(
      roomsIndexPost,
      { ...VALID_ROOM, longitude: -181 },
      '/api/rooms',
      'POST',
      adminId
    )
    expect(result.statusCode).toBe(400)
  })

  it('POST rejects zero radius (400)', async () => {
    const result = await callHandler(
      roomsIndexPost,
      { ...VALID_ROOM, radius: 0 },
      '/api/rooms',
      'POST',
      adminId
    )
    expect(result.statusCode).toBe(400)
  })

  it('POST rejects negative radius (400)', async () => {
    const result = await callHandler(
      roomsIndexPost,
      { ...VALID_ROOM, radius: -5 },
      '/api/rooms',
      'POST',
      adminId
    )
    expect(result.statusCode).toBe(400)
  })

  it('POST rejects radius above 20 meters (400)', async () => {
    const result = await callHandler(
      roomsIndexPost,
      { ...VALID_ROOM, radius: 20.5 },
      '/api/rooms',
      'POST',
      adminId
    )
    expect(result.statusCode).toBe(400)
  })

  it('POST accepts radius exactly 20 meters (200)', async () => {
    const result = await callHandler(
      roomsIndexPost,
      { ...VALID_ROOM, name: 'Boundary Radius', radius: 20 },
      '/api/rooms',
      'POST',
      adminId
    )
    expect(result.statusCode).toBe(200)
    expect((result.body as { room: { radius: number } }).room.radius).toBe(20)
  })

  it('POST rejects duplicate room name (409 CONFLICT)', async () => {
    await db.insert(rooms).values(VALID_ROOM)
    const result = await callHandler(
      roomsIndexPost,
      VALID_ROOM,
      '/api/rooms',
      'POST',
      adminId
    )
    expect(result.statusCode).toBe(409)
    expect((result.body as { error: { code: string } }).error.code).toBe(
      'CONFLICT'
    )
  })

  it('GET lists rooms with pagination (200)', async () => {
    await db.insert(rooms).values(VALID_ROOM)
    const result = await callHandler(
      roomsIndexGet,
      undefined,
      '/api/rooms',
      'GET',
      adminId
    )
    expect(result.statusCode).toBe(200)
    const body = result.body as { rooms: unknown[]; total: number }
    expect(body.rooms.length).toBe(1)
    expect(body.total).toBe(1)
  })

  it('GET single room returns it (200)', async () => {
    const [inserted] = await db.insert(rooms).values(VALID_ROOM).returning()
    const result = await callHandler(
      roomIdGet,
      undefined,
      `/api/rooms/${inserted!.id}`,
      'GET',
      adminId
    )
    expect(result.statusCode).toBe(200)
    expect((result.body as { room: { id: number } }).room.id).toBe(inserted!.id)
  })

  it('GET unknown room returns 404 NOT_FOUND', async () => {
    const result = await callHandler(
      roomIdGet,
      undefined,
      '/api/rooms/999999',
      'GET',
      adminId
    )
    expect(result.statusCode).toBe(404)
    expect((result.body as { error: { code: string } }).error.code).toBe(
      'NOT_FOUND'
    )
  })

  it('PATCH updates room as admin (200)', async () => {
    const [inserted] = await db.insert(rooms).values(VALID_ROOM).returning()
    const result = await callHandler(
      roomIdPatch,
      { name: 'Ruang Modifiée', radius: 10 },
      `/api/rooms/${inserted!.id}`,
      'PATCH',
      adminId
    )
    expect(result.statusCode).toBe(200)
    const room = (result.body as { room: Record<string, unknown> }).room
    expect(room.name).toBe('Ruang Modifiée')
    expect(room.radius).toBe(10)
  })

  it('PATCH rejects non-admin (403 FORBIDDEN)', async () => {
    const [inserted] = await db.insert(rooms).values(VALID_ROOM).returning()
    const result = await callHandler(
      roomIdPatch,
      { name: 'Hack' },
      `/api/rooms/${inserted!.id}`,
      'PATCH',
      studentId
    )
    expect(result.statusCode).toBe(403)
  })

  it('PATCH rejects radius above 20 (400)', async () => {
    const [inserted] = await db.insert(rooms).values(VALID_ROOM).returning()
    const result = await callHandler(
      roomIdPatch,
      { radius: 25 },
      `/api/rooms/${inserted!.id}`,
      'PATCH',
      adminId
    )
    expect(result.statusCode).toBe(400)
  })

  it('DELETE removes unreferenced room (200)', async () => {
    const [inserted] = await db.insert(rooms).values(VALID_ROOM).returning()
    const result = await callHandler(
      roomIdDelete,
      undefined,
      `/api/rooms/${inserted!.id}`,
      'DELETE',
      adminId
    )
    expect(result.statusCode).toBe(200)
    expect((result.body as { deleted: boolean }).deleted).toBe(true)
    const remaining = await db.select().from(rooms)
    expect(remaining.length).toBe(0)
  })

  it('DELETE rejects room referenced by a session (409 ROOM_IN_USE)', async () => {
    const [inserted] = await db.insert(rooms).values(VALID_ROOM).returning()
    const now = new Date()
    await db.insert(sessions).values({
      lecturerId,
      roomId: inserted!.id,
      name: 'Session Historique',
      startsAt: now,
      lateThresholdAt: now,
      closesAt: now
    })
    const result = await callHandler(
      roomIdDelete,
      undefined,
      `/api/rooms/${inserted!.id}`,
      'DELETE',
      adminId
    )
    expect(result.statusCode).toBe(409)
    expect((result.body as { error: { code: string } }).error.code).toBe(
      'ROOM_IN_USE'
    )
    const remaining = await db.select().from(rooms)
    expect(remaining.length).toBe(1)
  })

  it('DELETE rejects non-admin (403 FORBIDDEN)', async () => {
    const [inserted] = await db.insert(rooms).values(VALID_ROOM).returning()
    const result = await callHandler(
      roomIdDelete,
      undefined,
      `/api/rooms/${inserted!.id}`,
      'DELETE',
      lecturerId
    )
    expect(result.statusCode).toBe(403)
  })
})
