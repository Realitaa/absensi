import { check, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'
import { sql } from 'drizzle-orm'
import { validationPolicies } from './attendances'

export const systemSettings = sqliteTable(
  'system_settings',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    gpsValidationPolicy: text('gps_validation_policy', {
      enum: validationPolicies
    }).notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp' })
      .notNull()
      .default(sql`(strftime('%s', 'now'))`)
  },
  t => [check('system_settings_singleton_check', sql`${t.id} = 1`)]
)

export type SystemSetting = typeof systemSettings.$inferSelect
export type NewSystemSetting = typeof systemSettings.$inferInsert
