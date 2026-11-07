import { eq } from 'drizzle-orm'
import type { Db } from '../index'
import { systemSettings } from '../schema/system_settings'

export async function seedSystemSettings(db: Db) {
  const existing = await db
    .select({ id: systemSettings.id })
    .from(systemSettings)
    .where(eq(systemSettings.id, 1))
    .limit(1)
  if (!existing[0]) {
    await db.insert(systemSettings).values({ id: 1, gpsValidationPolicy: 'K2' })
  }
}
