import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { eq } from 'drizzle-orm'
import { closeApiDb, createApiDb, insertUser, type Db } from './helpers/api-db'
import { rooms } from '../../server/db/schema/rooms'
import { sessions } from '../../server/db/schema/sessions'
import { systemSettings } from '../../server/db/schema/system_settings'
import { photoUploads } from '../../server/db/schema/photo_uploads'
import { attendances } from '../../server/db/schema/attendances'
import { attendanceAttempts } from '../../server/db/schema/attendance_attempts'
import {
  evaluateGps,
  haversineDistance
} from '../../server/services/gps-validation.service'
import {
  listEligibleStudentSessions,
  submitStudentAttendance,
  verifyStudentGps
} from '../../server/services/student-attendance.service'

describe('student attendance workflow', () => {
  let db: Db
  let studentId = 0
  let lecturerId = 0
  let roomId = 0
  let sessionId = 0
  const now = new Date('2026-11-09T08:00:00.000Z')
  const actor = {
    id: 0,
    name: 'Mahasiswa',
    username: 'student',
    role: 'student' as const,
    nim: '20260001'
  }

  beforeAll(async () => {
    db = await createApiDb()
  })

  afterAll(async () => {
    await closeApiDb()
  })

  beforeEach(async () => {
    await db.delete(attendanceAttempts)
    await db.delete(photoUploads)
    await db.delete(attendances)
    await db.delete(sessions)
    await db.delete(rooms)
    await db.delete(systemSettings)
    // The shared test database keeps users from other feature files; clear it
    // last after all referencing records have been removed.
    const { users } = await import('../../server/db/schema/users')
    await db.delete(users)
    lecturerId = await insertUser(db, {
      name: 'Dosen',
      username: 'lecturer-workflow',
      password: 'hash',
      role: 'lecturer'
    })
    studentId = await insertUser(db, {
      name: 'Mahasiswa',
      username: 'student-workflow',
      password: 'hash',
      role: 'student',
      nim: '20260001'
    })
    actor.id = studentId
    await db.insert(systemSettings).values({ id: 1, gpsValidationPolicy: 'K2' })
    const [room] = await db
      .insert(rooms)
      .values({
        name: 'Ruang A',
        latitude: 0,
        longitude: 0,
        radius: 20
      })
      .returning({ id: rooms.id })
    roomId = room!.id
    const [session] = await db
      .insert(sessions)
      .values({
        lecturerId,
        roomId,
        name: 'Matematika',
        startsAt: new Date('2026-11-09T07:00:00.000Z'),
        lateThresholdAt: new Date('2026-11-09T08:30:00.000Z'),
        closesAt: new Date('2026-11-09T09:00:00.000Z')
      })
      .returning({ id: sessions.id })
    sessionId = session!.id
    await db.insert(sessions).values([
      {
        lecturerId,
        roomId,
        name: 'Sesi Terjadwal',
        startsAt: new Date('2026-11-09T09:00:00.000Z'),
        lateThresholdAt: new Date('2026-11-09T09:30:00.000Z'),
        closesAt: new Date('2026-11-09T10:00:00.000Z')
      },
      {
        lecturerId,
        roomId,
        name: 'Sesi Ditutup',
        startsAt: new Date('2026-11-09T06:00:00.000Z'),
        lateThresholdAt: new Date('2026-11-09T06:30:00.000Z'),
        closesAt: new Date('2026-11-09T07:00:00.000Z')
      }
    ])
  })

  it('GPS engine implements K1, K2, and K3 independently', () => {
    const distance = haversineDistance(0, 0.00005, 0, 0)
    expect(
      evaluateGps(
        { latitude: 0, longitude: 0.0003, accuracy: 30 },
        { latitude: 0, longitude: 0, radius: 20 },
        'K1'
      ).accepted
    ).toBe(false)
    expect(
      evaluateGps(
        { latitude: 0, longitude: 0, accuracy: 20 },
        { latitude: 0, longitude: 0, radius: 20 },
        'K2'
      ).accepted
    ).toBe(true)
    expect(
      evaluateGps(
        { latitude: 0, longitude: 0.00005, accuracy: 15 },
        { latitude: 0, longitude: 0, radius: 20 },
        'K3'
      ).accepted
    ).toBe(distance > 0 && distance + 15 <= 20)
  })

  it('only open sessions are listed and server policy is authoritative', async () => {
    const result = await listEligibleStudentSessions(db, now)
    expect(result.sessions.map(session => session.name)).toEqual(['Matematika'])
    const gps = await verifyStudentGps(
      db,
      actor,
      {
        sessionId,
        latitude: 0,
        longitude: 0,
        accuracy: 5
      },
      now
    )
    expect(gps.policy).toBe('K2')
    await expect(
      verifyStudentGps(
        db,
        actor,
        {
          sessionId,
          latitude: 0,
          longitude: 0,
          accuracy: 30
        },
        now
      )
    ).rejects.toMatchObject({ code: 'OUTSIDE_GEOFENCE' })
    await db
      .update(systemSettings)
      .set({ gpsValidationPolicy: 'K3' })
      .where(eq(systemSettings.id, 1))
    await expect(
      verifyStudentGps(
        db,
        actor,
        {
          sessionId,
          latitude: 0,
          longitude: 0,
          accuracy: 30
        },
        now
      )
    ).rejects.toMatchObject({ code: 'OUTSIDE_GEOFENCE' })
    const attempts = await db.select().from(attendanceAttempts)
    expect(attempts.some(attempt => attempt.result === 'rejected')).toBe(true)
  })

  it('valid attendance consumes only the owned pending photo and prevents duplicates', async () => {
    const photoPath = `selfies/${studentId}/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa.jpg`
    await db.insert(photoUploads).values({
      userId: studentId,
      photoPath,
      status: 'pending',
      uploadedAt: now
    })
    const storage = {
      head: async () => ({ size: 10, contentType: 'image/jpeg' })
    } as never
    const result = await submitStudentAttendance(
      db,
      actor,
      {
        sessionId,
        photoPath,
        latitude: 0,
        longitude: 0,
        accuracy: 5
      },
      { storage },
      now
    )
    expect(result.attendance.status).toBe('present')
    expect((await db.select().from(attendances)).length).toBe(1)
    expect((await db.select().from(photoUploads))[0]?.status).toBe('consumed')
    await expect(
      submitStudentAttendance(
        db,
        actor,
        {
          sessionId,
          photoPath,
          latitude: 0,
          longitude: 0,
          accuracy: 5
        },
        { storage },
        now
      )
    ).rejects.toMatchObject({ code: 'DUPLICATE_ATTENDANCE' })
  })
})
