import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { createApiDb, closeApiDb, insertUser, type Db } from './helpers/api-db'
import { systemSettings } from '../../server/db/schema/system_settings'
import {
  getGpsSettings,
  updateGpsSettings
} from '../../server/services/system-settings.service'

describe('GPS settings administration', () => {
  let db: Db
  let adminId = 0
  const admin = {
    id: 0,
    name: 'Admin',
    username: 'admin-gps-settings',
    role: 'admin' as const,
    nim: null
  }

  beforeAll(async () => {
    db = await createApiDb()
  })

  afterAll(async () => {
    await closeApiDb()
  })

  beforeEach(async () => {
    await db.delete(systemSettings)
    adminId = await insertUser(db, {
      name: 'Admin',
      username: `admin-gps-${Date.now()}`,
      password: 'hash',
      role: 'admin'
    })
    admin.id = adminId
  })

  it('returns the default policy and detailed policy information', async () => {
    const result = await getGpsSettings(db, admin)
    expect(result.policy).toBe('K2')
    expect(result.formula).toBe('d ≤ r dan a ≤ r')
    expect(result.description).toContain('akurasi GPS')
  })

  it('allows an administrator to change the active policy', async () => {
    const result = await updateGpsSettings(db, admin, { policy: 'K3' })
    expect(result.policy).toBe('K3')
    expect((await getGpsSettings(db, admin)).policy).toBe('K3')
  })

  it('rejects unsupported policies', async () => {
    await expect(
      updateGpsSettings(db, admin, { policy: 'K4' })
    ).rejects.toMatchObject({
      code: 'VALIDATION_ERROR'
    })
  })
})
