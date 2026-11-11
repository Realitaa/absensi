import { asc, eq } from 'drizzle-orm'
import type { Db } from '../db/index'
import { attendances } from '../db/schema/attendances'
import { users } from '../db/schema/users'

export async function listAttendancesBySession(db: Db, sessionId: number) {
  return await db
    .select({
      id: attendances.id,
      studentId: attendances.studentId,
      studentName: users.name,
      nim: users.nim,
      status: attendances.status,
      attendanceTimestamp: attendances.attendanceTimestamp,
      latitude: attendances.latitude,
      longitude: attendances.longitude,
      accuracy: attendances.accuracy,
      calculatedDistance: attendances.calculatedDistance,
      validationPolicy: attendances.validationPolicy,
      photoPath: attendances.photoPath
    })
    .from(attendances)
    .innerJoin(users, eq(attendances.studentId, users.id))
    .where(eq(attendances.sessionId, sessionId))
    .orderBy(asc(attendances.attendanceTimestamp), asc(attendances.id))
}
