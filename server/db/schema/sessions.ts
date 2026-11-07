import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'
import { sql } from 'drizzle-orm'
import { rooms } from './rooms'
import { users } from './users'

export const sessions = sqliteTable(
  'sessions',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    lecturerId: integer('lecturer_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    roomId: integer('room_id')
      .notNull()
      .references(() => rooms.id, { onDelete: 'restrict' }),
    name: text('name').notNull(),
    description: text('description'),
    startsAt: integer('starts_at', { mode: 'timestamp' }).notNull(),
    lateThresholdAt: integer('late_threshold_at', {
      mode: 'timestamp'
    }).notNull(),
    closesAt: integer('closes_at', { mode: 'timestamp' }).notNull(),
    manuallyClosedAt: integer('manually_closed_at', { mode: 'timestamp' }),
    createdAt: integer('created_at', { mode: 'timestamp' })
      .notNull()
      .default(sql`(strftime('%s', 'now'))`),
    updatedAt: integer('updated_at', { mode: 'timestamp' })
      .notNull()
      .default(sql`(strftime('%s', 'now'))`)
  },
  t => [
    index('sessions_lecturer_id_idx').on(t.lecturerId),
    index('sessions_room_id_idx').on(t.roomId),
    index('sessions_starts_at_idx').on(t.startsAt),
    index('sessions_closes_at_idx').on(t.closesAt)
  ]
)

export type Session = typeof sessions.$inferSelect
export type NewSession = typeof sessions.$inferInsert
