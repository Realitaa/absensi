import { and, asc, eq, gt, lte, sql } from 'drizzle-orm'
import type { Db } from '../db/index'
import { attendanceAttempts } from '../db/schema/attendance_attempts'
import { attendances } from '../db/schema/attendances'
import { photoUploads } from '../db/schema/photo_uploads'
import { rooms } from '../db/schema/rooms'
import { sessions } from '../db/schema/sessions'
import { users } from '../db/schema/users'

export async function listOpenStudentSessions(db: Db, now: Date) {
  return await db
    .select({
      id: sessions.id,
      lecturerId: sessions.lecturerId,
      lecturerName: users.name,
      roomId: rooms.id,
      roomName: rooms.name,
      roomLatitude: rooms.latitude,
      roomLongitude: rooms.longitude,
      roomRadius: rooms.radius,
      name: sessions.name,
      description: sessions.description,
      startsAt: sessions.startsAt,
      lateThresholdAt: sessions.lateThresholdAt,
      closesAt: sessions.closesAt,
      manuallyClosedAt: sessions.manuallyClosedAt
    })
    .from(sessions)
    .innerJoin(rooms, eq(sessions.roomId, rooms.id))
    .innerJoin(users, eq(sessions.lecturerId, users.id))
    .where(
      and(
        lte(sessions.startsAt, now),
        gt(sessions.closesAt, now),
        sql`${sessions.manuallyClosedAt} is null`
      )
    )
    .orderBy(asc(sessions.startsAt), asc(sessions.id))
}

export async function findStudentSession(db: Db, sessionId: number) {
  const rows = await db
    .select({
      id: sessions.id,
      lecturerName: users.name,
      roomId: rooms.id,
      roomName: rooms.name,
      roomLatitude: rooms.latitude,
      roomLongitude: rooms.longitude,
      roomRadius: rooms.radius,
      name: sessions.name,
      startsAt: sessions.startsAt,
      lateThresholdAt: sessions.lateThresholdAt,
      closesAt: sessions.closesAt,
      manuallyClosedAt: sessions.manuallyClosedAt
    })
    .from(sessions)
    .innerJoin(rooms, eq(sessions.roomId, rooms.id))
    .innerJoin(users, eq(sessions.lecturerId, users.id))
    .where(eq(sessions.id, sessionId))
    .limit(1)
  return rows[0] ?? null
}

export async function findAttendanceForStudentSession(
  db: Db,
  studentId: number,
  sessionId: number
) {
  const rows = await db
    .select()
    .from(attendances)
    .where(
      and(
        eq(attendances.studentId, studentId),
        eq(attendances.sessionId, sessionId)
      )
    )
    .limit(1)
  return rows[0] ?? null
}

export async function insertGpsAttempt(
  db: Db,
  values: typeof attendanceAttempts.$inferInsert
) {
  const rows = await db.insert(attendanceAttempts).values(values).returning()
  return rows[0] ?? null
}

export async function findPendingOwnedPhoto(
  db: Db,
  studentId: number,
  photoPath: string
) {
  const rows = await db
    .select()
    .from(photoUploads)
    .where(
      and(
        eq(photoUploads.userId, studentId),
        eq(photoUploads.photoPath, photoPath),
        eq(photoUploads.status, 'pending')
      )
    )
    .limit(1)
  return rows[0] ?? null
}

export async function createAttendanceAndConsumePhoto(
  db: Db,
  input: {
    studentId: number
    sessionId: number
    status: 'present' | 'late'
    attendanceTimestamp: Date
    latitude: number
    longitude: number
    accuracy: number
    calculatedDistance: number
    validationPolicy: 'K1' | 'K2' | 'K3'
    photoPath: string
  }
) {
  const attendanceId = sql<number>`(
    select id from attendances
    where student_id = ${input.studentId} and session_id = ${input.sessionId}
    limit 1
  )`
  const rows = await db.batch([
    db
      .insert(attendances)
      .values({
        studentId: input.studentId,
        sessionId: input.sessionId,
        status: input.status,
        attendanceTimestamp: input.attendanceTimestamp,
        latitude: input.latitude,
        longitude: input.longitude,
        accuracy: input.accuracy,
        calculatedDistance: input.calculatedDistance,
        validationPolicy: input.validationPolicy,
        photoPath: input.photoPath
      })
      .returning(),
    db
      .update(photoUploads)
      .set({
        status: 'consumed',
        consumedAt: input.attendanceTimestamp,
        attendanceId
      })
      .where(
        and(
          eq(photoUploads.userId, input.studentId),
          eq(photoUploads.photoPath, input.photoPath),
          eq(photoUploads.status, 'pending')
        )
      )
      .returning()
  ])
  const attendance = rows[0]?.[0] as typeof attendances.$inferSelect | undefined
  const photo = rows[1]?.[0]
  if (!attendance || !photo) return null
  return attendance
}

export async function attachAcceptedAttempt(
  db: Db,
  input: { studentId: number; sessionId: number; attendanceId: number }
) {
  await db
    .update(attendanceAttempts)
    .set({ attendanceId: input.attendanceId })
    .where(
      and(
        eq(attendanceAttempts.studentId, input.studentId),
        eq(attendanceAttempts.sessionId, input.sessionId),
        eq(attendanceAttempts.result, 'accepted'),
        sql`${attendanceAttempts.attendanceId} is null`
      )
    )
}
