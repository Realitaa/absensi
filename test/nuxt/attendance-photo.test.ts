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
import { rooms } from '../../server/db/schema/rooms'
import { sessions } from '../../server/db/schema/sessions'
import { attendances } from '../../server/db/schema/attendances'
import { attendanceAttempts } from '../../server/db/schema/attendance_attempts'
import type { PhotoStorage } from '../../server/utils/storage'

let sessionUserId: number | undefined

Object.assign(globalThis, {
  getUserSession: async () =>
    sessionUserId ? { user: { id: sessionUserId } } : {}
})

const { default: attendancePhotoGet } =
  await import('../../server/api/attendance/[id]/photo.get')

describe('attendance photo access', () => {
  let db: Db
  let studentId = 0
  let otherStudentId = 0
  let lecturerId = 0
  let otherLecturerId = 0
  let adminId = 0
  let attendanceId = 0
  const photoBytes = new Uint8Array([255, 216, 255, 217])
  const storage: PhotoStorage = {
    put: async () => {},
    delete: async () => {},
    head: async () => ({ size: photoBytes.length, contentType: 'image/jpeg' }),
    get: async key =>
      key === 'selfies/private/photo.jpg'
        ? { body: photoBytes, contentType: 'image/jpeg' }
        : null
  }

  beforeAll(async () => {
    db = await createApiDb()
  })

  afterAll(async () => {
    await closeApiDb()
  })

  beforeEach(async () => {
    sessionUserId = undefined
    await db.delete(attendances)
    await db.delete(attendanceAttempts)
    await db.delete(sessions)
    await db.delete(rooms)
    await clearUsers(db)

    const password = await hashPassword('password123')
    studentId = await insertUser(db, {
      name: 'Mahasiswa',
      username: 'mahasiswa',
      password,
      role: 'student',
      nim: '20260001'
    })
    otherStudentId = await insertUser(db, {
      name: 'Mahasiswa Lain',
      username: 'mahasiswa-lain',
      password,
      role: 'student',
      nim: '20260002'
    })
    lecturerId = await insertUser(db, {
      name: 'Dosen',
      username: 'dosen',
      password,
      role: 'lecturer'
    })
    otherLecturerId = await insertUser(db, {
      name: 'Dosen Lain',
      username: 'dosen-lain',
      password,
      role: 'lecturer'
    })
    adminId = await insertUser(db, {
      name: 'Admin',
      username: 'admin',
      password,
      role: 'admin'
    })
    const [room] = await db
      .insert(rooms)
      .values({
        name: 'Ruang A',
        latitude: -6.2,
        longitude: 106.8,
        radius: 100
      })
      .returning({ id: rooms.id })
    const [session] = await db
      .insert(sessions)
      .values({
        lecturerId,
        roomId: room!.id,
        name: 'Sesi A',
        startsAt: new Date('2026-01-01T00:00:00.000Z'),
        lateThresholdAt: new Date('2026-01-01T00:15:00.000Z'),
        closesAt: new Date('2026-01-01T01:00:00.000Z')
      })
      .returning({ id: sessions.id })
    const [attendance] = await db
      .insert(attendances)
      .values({
        studentId,
        sessionId: session!.id,
        status: 'present',
        attendanceTimestamp: new Date('2026-01-01T00:05:00.000Z'),
        validationPolicy: 'K1',
        photoPath: 'selfies/private/photo.jpg'
      })
      .returning({ id: attendances.id })
    attendanceId = attendance!.id
  })

  async function requestPhoto(userId: number | undefined, id = attendanceId) {
    sessionUserId = userId
    const event = await createApiEvent(null, `/api/attendance/${id}/photo`)
    const typedEvent = event as unknown as {
      context: { params: { id: string }; photostorage: PhotoStorage }
    }
    typedEvent.context.params = { id: String(id) }
    typedEvent.context.photostorage = storage
    return await (attendancePhotoGet as (event: unknown) => Promise<unknown>)(
      event
    )
  }

  it('serves own photo to student with private response headers', async () => {
    const result = (await requestPhoto(studentId)) as Response
    expect(result.headers.get('content-type')).toBe('image/jpeg')
    expect(result.headers.get('cache-control')).toBe('private, no-store')
    expect(result.headers.get('x-content-type-options')).toBe('nosniff')
    expect(Array.from(new Uint8Array(await result.arrayBuffer()))).toEqual(
      Array.from(photoBytes)
    )
  })

  it('serves photo to owning lecturer and admin', async () => {
    expect(await requestPhoto(lecturerId)).toBeInstanceOf(Response)
    expect(await requestPhoto(adminId)).toBeInstanceOf(Response)
  })

  it('denies another student or lecturer', async () => {
    for (const userId of [otherStudentId, otherLecturerId]) {
      const result = await requestPhoto(userId)
      expect(result).toMatchObject({
        error: { code: 'FORBIDDEN', status: 403 }
      })
    }
  })

  it('requires authentication and hides missing photo records', async () => {
    expect(await requestPhoto(undefined)).toMatchObject({
      error: { code: 'UNAUTHORIZED', status: 401 }
    })
    expect(await requestPhoto(studentId, 999999)).toMatchObject({
      error: { code: 'NOT_FOUND', status: 404 }
    })
  })
})
