import { eq } from 'drizzle-orm'
import type { Db } from '../index'
import { rooms } from '../schema/rooms'

const SEEDED_ROOMS = [
  { name: 'Ruang 101', latitude: -7.7495, longitude: 110.3778, radius: 20 },
  { name: 'Ruang 102', latitude: -7.7496, longitude: 110.378, radius: 15 },
  { name: 'Lab Komputer 1', latitude: -7.7497, longitude: 110.3782, radius: 20 }
]

export async function seedRooms(db: Db) {
  const seeded: Array<{ id: number; name: string }> = []
  for (const r of SEEDED_ROOMS) {
    const existing = await db
      .select({ id: rooms.id })
      .from(rooms)
      .where(eq(rooms.name, r.name))
      .limit(1)
    if (existing[0]) {
      seeded.push({ id: existing[0].id, name: r.name })
      continue
    }
    const [row] = await db
      .insert(rooms)
      .values(r)
      .returning({ id: rooms.id, name: rooms.name })
    if (!row) continue
    seeded.push(row)
  }
  return seeded
}
