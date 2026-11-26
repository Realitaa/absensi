import { eq } from 'drizzle-orm'
import type { Db } from '../db/index'
import { attendances } from '../db/schema/attendances'
import { sessions } from '../db/schema/sessions'

export async function findAttendancePhotoAccess(db: Db, attendanceId: number) {
  const rows = await db
    .select({
      studentId: attendances.studentId,
      lecturerId: sessions.lecturerId,
      photoPath: attendances.photoPath
    })
    .from(attendances)
    .innerJoin(sessions, eq(attendances.sessionId, sessions.id))
    .where(eq(attendances.id, attendanceId))
    .limit(1)

  return rows[0] ?? null
}
