import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'
import { sql } from 'drizzle-orm'
import { attendances, attendanceStatuses } from './attendances'
import { users } from './users'

export const attendanceCorrections = sqliteTable(
  'attendance_corrections',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    attendanceId: integer('attendance_id')
      .notNull()
      .references(() => attendances.id, { onDelete: 'restrict' }),
    lecturerId: integer('lecturer_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    previousStatus: text('previous_status', {
      enum: attendanceStatuses
    }).notNull(),
    newStatus: text('new_status', { enum: attendanceStatuses }).notNull(),
    reason: text('reason').notNull(),
    correctedAt: integer('corrected_at', { mode: 'timestamp' }).notNull(),
    createdAt: integer('created_at', { mode: 'timestamp' })
      .notNull()
      .default(sql`(strftime('%s', 'now'))`)
  },
  t => [
    index('attendance_corrections_attendance_id_idx').on(t.attendanceId),
    index('attendance_corrections_lecturer_id_idx').on(t.lecturerId)
  ]
)

export type AttendanceCorrection = typeof attendanceCorrections.$inferSelect
export type NewAttendanceCorrection = typeof attendanceCorrections.$inferInsert
