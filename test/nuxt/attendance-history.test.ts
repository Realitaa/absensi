/**
 * Feature test: student personal attendance history (SRS §1.3, §9.1)
 * GET /api/attendance/history.
 *
 * Real D1 via Miniflare (see test/nuxt/helpers/api-db.ts).
 */

import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
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
import { attendanceAttempts } from '../../server/db/schema/attendance_attempts'

let sessionUserId: number | undefined

Object.assign(globalThis, {
  setUserSession: async (_event: unknown, data: unknown) => ({ data }),
  clearUserSession: async () => true,
  getUserSession: async () =>
    sessionUserId ? { user: { id: sessionUserId } } : {},
  requireUserSession: async () => ({})
})

const { default: attendanceHistoryGet } =
  await import('../../server/api/attendance/history.get')

const PASSWORD = 'password123'

describe('student attendance history (SRS §9.1)', () => {
  let db: Db
  let studentId = 0
  let otherStudentId = 0
  let lecturerId = 0
  let adminId = 0

  beforeAll(async () => {
    db = await createApiDb()
  })

  afterAll(async () => {
    await closeApiDb()
  })

  beforeEach(async () => {
    sessionUserId = undefined
    await db.delete(attendanceAttempts)
    await db.delete(attendances)
    await db.delete(sessions)
    await db.delete(rooms)
    await clearUsers(db)

    const hashed = await hashPassword(PASSWORD)
    adminId = await insertUser(db, {
      name: 'Admin Riwayat',
      username: 'admin-history',
      password: hashed,
      role: 'admin',
      nim: null
    })
    lecturerId = await insertUser(db, {
      name: 'Dosen Riwayat',
      username: 'dosen-history',
      password: hashed,
      role: 'lecturer',
      nim: null
    })
    studentId = await insertUser(db, {
      name: 'Mahasiswa Riwayat',
      username: 'student-history',
      password: hashed,
      role: 'student',
      nim: '20260002'
    })
    otherStudentId = await insertUser(db, {
      name: 'Mahasiswa Lain',
      username: 'other-history',
      password: hashed,
      role: 'student',
      nim: '20260003'
    })

    const [room] = await db
      .insert(rooms)
      .values({
        name: 'Ruang Riwayat',
        latitude: -7.7495,
        longitude: 110.3778,
        radius: 20
      })
      .returning({ id: rooms.id })

    const [firstSession] = await db
      .insert(sessions)
      .values({
        lecturerId,
        roomId: room!.id,
        name: 'Pemrograman Web',
        startsAt: new Date('2026-11-01T01:00:00.000Z'),
        lateThresholdAt: new Date('2026-11-01T01:15:00.000Z'),
        closesAt: new Date('2026-11-01T03:00:00.000Z')
      })
      .returning({ id: sessions.id })

    const [secondSession] = await db
      .insert(sessions)
      .values({
        lecturerId,
        roomId: room!.id,
        name: 'Basis Data',
        startsAt: new Date('2026-11-02T01:00:00.000Z'),
        lateThresholdAt: new Date('2026-11-02T01:15:00.000Z'),
        closesAt: new Date('2026-11-02T03:00:00.000Z')
      })
      .returning({ id: sessions.id })

    await db.insert(attendances).values([
      {
        studentId,
        sessionId: firstSession!.id,
        status: 'present',
        attendanceTimestamp: new Date('2026-11-01T01:10:00.000Z'),
        latitude: -7.7495,
        longitude: 110.3778,
        accuracy: 5,
        calculatedDistance: 0,
        validationPolicy: 'K2',
        photoPath: `selfies/${studentId}/history-1.jpg`
      },
      {
        studentId,
        sessionId: secondSession!.id,
        status: 'late',
        attendanceTimestamp: new Date('2026-11-02T01:40:00.000Z'),
        latitude: -7.7495,
        longitude: 110.3778,
        accuracy: 8,
        calculatedDistance: 2,
        validationPolicy: 'K2',
        photoPath: `selfies/${studentId}/history-2.jpg`
      },
      {
        studentId: otherStudentId,
        sessionId: firstSession!.id,
        status: 'present',
        attendanceTimestamp: new Date('2026-11-01T01:05:00.000Z'),
        latitude: -7.7495,
        longitude: 110.3778,
        accuracy: 5,
        calculatedDistance: 0,
        validationPolicy: 'K2',
        photoPath: `selfies/${otherStudentId}/history-1.jpg`
      }
    ])
  })

  async function callHistory(userId?: number) {
    sessionUserId = userId
    const event = await createApiEvent({}, '/api/attendance/history')
    ;(event as unknown as Record<string, unknown>)._method = 'GET'
    ;(event as unknown as Record<string, unknown>).method = 'GET'
    const req = (event as unknown as { node: { req: Record<string, unknown> } })
      .node.req
    req.method = 'GET'
    const result = await (
      attendanceHistoryGet as (e: never) => Promise<unknown>
    )(event as never)

    if (result && typeof result === 'object' && 'error' in result) {
      return {
        statusCode: (result as unknown as ApiErrorBody).error.status,
        body: result
      }
    }
    return { statusCode: 200, body: result }
  }

  interface HistoryItem {
    id: number
    sessionId: number
    sessionName: string
    roomName: string | null
    lecturerName: string
    status: string
    attendanceTimestamp: string
  }

  it('returns only the requesting student records, newest first', async () => {
    const result = await callHistory(studentId)
    expect(result.statusCode).toBe(200)
    const attendancesBody = (result.body as { attendances: HistoryItem[] })
      .attendances
    expect(attendancesBody).toHaveLength(2)
    expect(attendancesBody.map(item => item.sessionName)).toEqual([
      'Basis Data',
      'Pemrograman Web'
    ])
    expect(attendancesBody[0]).toMatchObject({
      sessionName: 'Basis Data',
      roomName: 'Ruang Riwayat',
      lecturerName: 'Dosen Riwayat',
      status: 'late',
      attendanceTimestamp: '2026-11-02T01:40:00.000Z'
    })
  })

  it('returns an empty list when the student has no attendance', async () => {
    await db.delete(attendances)
    const result = await callHistory(studentId)
    expect(result.statusCode).toBe(200)
    expect((result.body as { attendances: HistoryItem[] }).attendances).toEqual(
      []
    )
  })

  it('rejects lecturers (403 FORBIDDEN)', async () => {
    const result = await callHistory(lecturerId)
    expect(result.statusCode).toBe(403)
    expect((result.body as ApiErrorBody).error.code).toBe('FORBIDDEN')
  })

  it('rejects admins (403 FORBIDDEN)', async () => {
    const result = await callHistory(adminId)
    expect(result.statusCode).toBe(403)
    expect((result.body as ApiErrorBody).error.code).toBe('FORBIDDEN')
  })

  it('rejects unauthenticated requests (401 UNAUTHORIZED)', async () => {
    const result = await callHistory(undefined)
    expect(result.statusCode).toBe(401)
    expect((result.body as ApiErrorBody).error.code).toBe('UNAUTHORIZED')
  })
})
