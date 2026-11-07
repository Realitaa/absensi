import { eq } from 'drizzle-orm'
import type { Db } from '../index'
import { attendances } from '../schema/attendances'
import { attendanceFactory } from '../factories/attendance.factory'
import { users } from '../schema/users'
import { photoUploads } from '../schema/photo_uploads'

export async function seedAttendances(db: Db, sessionIds: number[]) {
  const students = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.role, 'student'))
    .limit(10)

  const created: Array<{
    id: number
    studentId: number
    sessionId: number
    photoPath: string
  }> = []

  for (const sessionId of sessionIds) {
    for (const student of students) {
      const photoPath = `selfies/seed-${student.id}-${sessionId}.jpg`
      // Unique (student_id, session_id) is enforced by the schema; onConflictDoNothing handles re-runs.

      const values = attendanceFactory({
        studentId: student.id,
        sessionId,
        photoPath
      })
      try {
        const [row] = await db
          .insert(attendances)
          .values(values)
          .onConflictDoNothing({
            target: [attendances.studentId, attendances.sessionId]
          })
          .returning({ id: attendances.id })
        if (!row) continue
        await db
          .insert(photoUploads)
          .values({
            userId: student.id,
            photoPath,
            status: 'consumed',
            uploadedAt: values.attendanceTimestamp,
            consumedAt: values.attendanceTimestamp,
            attendanceId: row.id
          })
          .onConflictDoNothing()
        created.push({
          id: row.id,
          studentId: student.id,
          sessionId,
          photoPath
        })
      } catch {
        // Skip duplicates on re-run.
      }
    }
  }
  return created
}
