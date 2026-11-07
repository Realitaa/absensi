/**
 * Central seeder entry point.
 *
 * Intended to run against a local D1 database via the Cloudflare Vite plugin
 * (`getPlatformProxy`) or a script that provides a D1 binding.
 * Never run against production automatically.
 */
import { createDb } from './index'
import {
  seedUsers,
  seedRooms,
  seedSystemSettings,
  seedSessions,
  seedAttendances,
  seedAttendanceAttempts,
  seedAttendanceCorrections,
  seedPhotoUploads
} from './seeders'

export async function seedDatabase(d1: Parameters<typeof createDb>[0]) {
  const db = createDb(d1)

  await seedSystemSettings(db)
  const users = await seedUsers(db)
  const rooms = await seedRooms(db)

  const lecturer = users.find(u => u.role === 'lecturer')
  const roomIds = rooms.map(r => r.id)
  const sessions = lecturer ? await seedSessions(db, lecturer.id, roomIds) : []

  await seedAttendances(
    db,
    sessions.map(s => s.id)
  )
  await seedAttendanceAttempts(db, roomIds[0] ?? 1)
  await seedAttendanceCorrections(db)
  await seedPhotoUploads(db)

  return { users, rooms, sessions }
}

if (process.env.DB_SEED_STANDALONE === '1') {
  // Standalone execution requires a D1 binding; see scripts/seed.mjs for the
  // wrangler-based runner used by `pnpm db:seed`.
  console.error('Standalone seed requires a D1 binding. Use: pnpm db:seed')
  process.exit(1)
}
