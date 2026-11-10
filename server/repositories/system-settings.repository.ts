import { eq } from 'drizzle-orm'
import type { Db } from '../db/index'
import {
  systemSettings,
  type SystemSetting
} from '../db/schema/system_settings'

export async function findSystemSettings(
  db: Db
): Promise<SystemSetting | null> {
  const rows = await db
    .select()
    .from(systemSettings)
    .where(eq(systemSettings.id, 1))
    .limit(1)
  return rows[0] ?? null
}

export async function updateGpsValidationPolicy(
  db: Db,
  policy: 'K1' | 'K2' | 'K3'
): Promise<SystemSetting | null> {
  const rows = await db
    .update(systemSettings)
    .set({ gpsValidationPolicy: policy, updatedAt: new Date() })
    .where(eq(systemSettings.id, 1))
    .returning()
  return rows[0] ?? null
}

export async function insertSystemSettings(
  db: Db,
  policy: 'K1' | 'K2' | 'K3'
): Promise<SystemSetting | null> {
  const rows = await db
    .insert(systemSettings)
    .values({ id: 1, gpsValidationPolicy: policy })
    .returning()
  return rows[0] ?? null
}
