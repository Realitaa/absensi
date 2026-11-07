import {
  index,
  integer,
  real,
  sqliteTable,
  text,
  uniqueIndex
} from 'drizzle-orm/sqlite-core'
import { sql } from 'drizzle-orm'
import { sessions } from './sessions'
import { users } from './users'

export const attendanceStatuses = [
  'present',
  'late',
  'excused',
  'sick'
] as const
export type AttendanceStatus = (typeof attendanceStatuses)[number]

export const validationPolicies = ['K1', 'K2', 'K3'] as const
export type ValidationPolicy = (typeof validationPolicies)[number]

export const attendances = sqliteTable(
  'attendances',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    studentId: integer('student_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    sessionId: integer('session_id')
      .notNull()
      .references(() => sessions.id, { onDelete: 'restrict' }),
    status: text('status', { enum: attendanceStatuses }).notNull(),
    attendanceTimestamp: integer('attendance_timestamp', {
      mode: 'timestamp'
    }).notNull(),
    latitude: real('latitude'),
    longitude: real('longitude'),
    accuracy: real('accuracy'),
    calculatedDistance: real('calculated_distance'),
    validationPolicy: text('validation_policy', {
      enum: validationPolicies
    }).notNull(),
    photoPath: text('photo_path').notNull(),
    createdAt: integer('created_at', { mode: 'timestamp' })
      .notNull()
      .default(sql`(strftime('%s', 'now'))`),
    updatedAt: integer('updated_at', { mode: 'timestamp' })
      .notNull()
      .default(sql`(strftime('%s', 'now'))`)
  },
  t => [
    uniqueIndex('attendances_student_session_unique').on(
      t.studentId,
      t.sessionId
    ),
    index('attendances_student_id_idx').on(t.studentId),
    index('attendances_session_id_idx').on(t.sessionId),
    index('attendances_status_idx').on(t.status),
    index('attendances_timestamp_idx').on(t.attendanceTimestamp)
  ]
)

export type Attendance = typeof attendances.$inferSelect
export type NewAttendance = typeof attendances.$inferInsert
