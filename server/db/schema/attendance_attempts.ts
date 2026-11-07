import {
  index,
  integer,
  real,
  sqliteTable,
  text
} from 'drizzle-orm/sqlite-core'
import { sql } from 'drizzle-orm'
import { attendances, validationPolicies } from './attendances'
import { rooms } from './rooms'
import { sessions } from './sessions'
import { users } from './users'

export const attemptResults = ['accepted', 'rejected'] as const
export type AttemptResult = (typeof attemptResults)[number]

export const attendanceAttempts = sqliteTable(
  'attendance_attempts',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    studentId: integer('student_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    sessionId: integer('session_id')
      .notNull()
      .references(() => sessions.id, { onDelete: 'restrict' }),
    roomId: integer('room_id')
      .notNull()
      .references(() => rooms.id, { onDelete: 'restrict' }),
    latitude: real('latitude'),
    longitude: real('longitude'),
    accuracy: real('accuracy'),
    calculatedDistance: real('calculated_distance'),
    validationPolicy: text('validation_policy', { enum: validationPolicies }),
    result: text('result', { enum: attemptResults }).notNull(),
    rejectionReason: text('rejection_reason'),
    attemptedAt: integer('attempted_at', { mode: 'timestamp' }).notNull(),
    attendanceId: integer('attendance_id').references(() => attendances.id, {
      onDelete: 'restrict'
    }),
    createdAt: integer('created_at', { mode: 'timestamp' })
      .notNull()
      .default(sql`(strftime('%s', 'now'))`)
  },
  t => [
    index('attendance_attempts_student_id_idx').on(t.studentId),
    index('attendance_attempts_session_id_idx').on(t.sessionId),
    index('attendance_attempts_room_id_idx').on(t.roomId),
    index('attendance_attempts_attendance_id_idx').on(t.attendanceId),
    index('attendance_attempts_result_idx').on(t.result),
    index('attendance_attempts_attempted_at_idx').on(t.attemptedAt)
  ]
)

export type AttendanceAttempt = typeof attendanceAttempts.$inferSelect
export type NewAttendanceAttempt = typeof attendanceAttempts.$inferInsert
