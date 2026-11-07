import { eq } from 'drizzle-orm'
import type { Db } from '../index'
import { attendanceAttempts } from '../schema/attendance_attempts'
import { attendanceAttemptFactory } from '../factories/attendance_attempt.factory'
import { users } from '../schema/users'
import { sessions } from '../schema/sessions'

export async function seedAttendanceAttempts(db: Db, roomId: number) {
  const students = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.role, 'student'))
    .limit(5)
  const sess = await db
    .select({ id: sessions.id, roomId: sessions.roomId })
    .from(sessions)
    .limit(5)

  for (const s of sess) {
    const room = roomId ?? s.roomId
    for (const student of students) {
      await db.insert(attendanceAttempts).values(
        attendanceAttemptFactory({
          studentId: student.id,
          sessionId: s.id,
          roomId: room
        })
      )
    }
  }
}
