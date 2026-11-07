import { eq } from 'drizzle-orm'
import type { Db } from '../index'
import { attendances } from '../schema/attendances'
import { attendanceCorrections } from '../schema/attendance_corrections'
import { attendanceCorrectionFactory } from '../factories/attendance_correction.factory'
import { users } from '../schema/users'

export async function seedAttendanceCorrections(db: Db) {
  const lecturer = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.role, 'lecturer'))
    .limit(1)
  if (!lecturer[0]) return

  const records = await db
    .select({ id: attendances.id })
    .from(attendances)
    .limit(3)
  for (const record of records) {
    await db.insert(attendanceCorrections).values(
      attendanceCorrectionFactory({
        attendanceId: record.id,
        lecturerId: lecturer[0].id
      })
    )
  }
}
