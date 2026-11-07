import type { Db } from '../index'
import { sessions } from '../schema/sessions'
import { sessionFactory } from '../factories/session.factory'

export async function seedSessions(
  db: Db,
  lecturerId: number,
  roomIds: number[],
  count = 3
) {
  if (!roomIds.length) return []
  const seeded: Array<{ id: number }> = []
  for (let i = 0; i < count; i++) {
    const roomId = roomIds[i % roomIds.length]
    if (roomId === undefined) continue
    const values = sessionFactory({ lecturerId, roomId })
    const [row] = await db
      .insert(sessions)
      .values(values)
      .returning({ id: sessions.id })
    if (!row) continue
    seeded.push(row)
  }
  return seeded
}
