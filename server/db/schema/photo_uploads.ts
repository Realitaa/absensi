import {
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex
} from 'drizzle-orm/sqlite-core'
import { attendances } from './attendances'
import { users } from './users'

export const photoUploadStatuses = ['pending', 'consumed', 'expired'] as const
export type PhotoUploadStatus = (typeof photoUploadStatuses)[number]

export const photoUploads = sqliteTable(
  'photo_uploads',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    photoPath: text('photo_path').notNull(),
    status: text('status', { enum: photoUploadStatuses }).notNull(),
    uploadedAt: integer('uploaded_at', { mode: 'timestamp' }).notNull(),
    consumedAt: integer('consumed_at', { mode: 'timestamp' }),
    attendanceId: integer('attendance_id').references(() => attendances.id, {
      onDelete: 'restrict'
    })
  },
  t => [
    uniqueIndex('photo_uploads_photo_path_unique').on(t.photoPath),
    index('photo_uploads_user_id_idx').on(t.userId),
    index('photo_uploads_status_idx').on(t.status),
    index('photo_uploads_attendance_id_idx').on(t.attendanceId),
    index('photo_uploads_uploaded_at_idx').on(t.uploadedAt)
  ]
)

export type PhotoUpload = typeof photoUploads.$inferSelect
export type NewPhotoUpload = typeof photoUploads.$inferInsert
