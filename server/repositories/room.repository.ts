import { and, asc, count, eq, ne, type SQL } from 'drizzle-orm'
import type { Db } from '../db/index'
import { rooms, type NewRoom, type Room } from '../db/schema/rooms'
import { sessions } from '../db/schema/sessions'
import { attendanceAttempts } from '../db/schema/attendance_attempts'

export async function findRoomById(db: Db, id: number): Promise<Room | null> {
  const rows = await db.select().from(rooms).where(eq(rooms.id, id)).limit(1)
  return rows[0] ?? null
}

export async function findRoomByName(
  db: Db,
  name: string,
  excludeId?: number
): Promise<Room | null> {
  const conditions: SQL[] = [eq(rooms.name, name)]
  if (excludeId !== undefined) conditions.push(ne(rooms.id, excludeId))
  const rows = await db
    .select()
    .from(rooms)
    .where(and(...conditions))
    .limit(1)
  return rows[0] ?? null
}

export async function listRooms(
  db: Db,
  query: { page: number; pageSize: number }
): Promise<{ rows: Room[]; total: number }> {
  const rows = await db
    .select()
    .from(rooms)
    .orderBy(asc(rooms.name), asc(rooms.id))
    .limit(query.pageSize)
    .offset((query.page - 1) * query.pageSize)
  const [countRow] = await db.select({ count: count() }).from(rooms)
  return { rows, total: countRow?.count ?? 0 }
}

export async function insertRoom(
  db: Db,
  values: NewRoom
): Promise<Room | null> {
  const rows = await db.insert(rooms).values(values).returning()
  return rows[0] ?? null
}

export async function updateRoom(
  db: Db,
  id: number,
  values: Partial<NewRoom>
): Promise<Room | null> {
  const rows = await db
    .update(rooms)
    .set({ ...values, updatedAt: new Date() })
    .where(eq(rooms.id, id))
    .returning()
  return rows[0] ?? null
}

export async function deleteRoom(db: Db, id: number): Promise<boolean> {
  const rows = await db.delete(rooms).where(eq(rooms.id, id)).returning({
    id: rooms.id
  })
  return rows.length > 0
}

/**
 * A room referenced by any attendance session must not be permanently
 * deleted (FR-ROOM-05, SRS §10.2): deletion would break historical
 * references. Count references in both `sessions` and
 * `attendance_attempts` before allowing removal.
 */
export async function countRoomReferences(
  db: Db,
  roomId: number
): Promise<{
  sessions: number
  attempts: number
}> {
  const [sessionRow] = await db
    .select({ count: count() })
    .from(sessions)
    .where(eq(sessions.roomId, roomId))
  const [attemptRow] = await db
    .select({ count: count() })
    .from(attendanceAttempts)
    .where(eq(attendanceAttempts.roomId, roomId))
  return {
    sessions: sessionRow?.count ?? 0,
    attempts: attemptRow?.count ?? 0
  }
}
