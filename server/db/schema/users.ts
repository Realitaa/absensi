import {
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex
} from 'drizzle-orm/sqlite-core'
import { sql } from 'drizzle-orm'

export const userRoles = ['admin', 'lecturer', 'student'] as const
export type UserRole = (typeof userRoles)[number]

export const users = sqliteTable(
  'users',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    name: text('name').notNull(),
    username: text('username').notNull(),
    password: text('password').notNull(),
    role: text('role', { enum: userRoles }).notNull(),
    nim: text('nim'),
    createdAt: integer('created_at', { mode: 'timestamp' })
      .notNull()
      .default(sql`(strftime('%s', 'now'))`),
    updatedAt: integer('updated_at', { mode: 'timestamp' })
      .notNull()
      .default(sql`(strftime('%s', 'now'))`),
    deletedAt: integer('deleted_at', { mode: 'timestamp' })
  },
  t => [
    uniqueIndex('users_username_unique').on(t.username),
    uniqueIndex('users_nim_unique').on(t.nim),
    index('users_role_idx').on(t.role),
    index('users_deleted_at_idx').on(t.deletedAt)
  ]
)

export type User = typeof users.$inferSelect
export type NewUser = typeof users.$inferInsert
