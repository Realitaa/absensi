import { count, desc, eq, sql } from 'drizzle-orm'
import type { Db } from '../db/index'
import { rooms } from '../db/schema/rooms'
import { sessions, type Session } from '../db/schema/sessions'
import { attendances } from '../db/schema/attendances'
import { attendanceAttempts } from '../db/schema/attendance_attempts'

export interface SessionWithRoom extends Session {
  roomName: string | null
  room: { id: number; name: string } | null
}

export async function listSessionsByLecturer(
  db: Db,
  lecturerId: number,
  query: { page: number; pageSize: number }
): Promise<{ rows: SessionWithRoom[]; total: number }> {
  const rows = await db
    .select({ session: sessions, roomName: rooms.name })
    .from(sessions)
    .leftJoin(rooms, eq(sessions.roomId, rooms.id))
    .where(eq(sessions.lecturerId, lecturerId))
    .orderBy(desc(sessions.startsAt), desc(sessions.id))
    .limit(query.pageSize)
    .offset((query.page - 1) * query.pageSize)
  const [countRow] = await db
    .select({ count: count() })
    .from(sessions)
    .where(eq(sessions.lecturerId, lecturerId))
  return {
    rows: rows.map(r => ({
      ...r.session,
      roomName: r.roomName,
      room:
        r.roomName !== null ? { id: r.session.roomId, name: r.roomName } : null
    })),
    total: countRow?.count ?? 0
  }
}

export async function findSessionById(
  db: Db,
  id: number
): Promise<Session | null> {
  const rows = await db
    .select()
    .from(sessions)
    .where(eq(sessions.id, id))
    .limit(1)
  return rows[0] ?? null
}

export async function findSessionWithRoomById(
  db: Db,
  id: number
): Promise<SessionWithRoom | null> {
  const rows = await db
    .select({ session: sessions, roomName: rooms.name })
    .from(sessions)
    .leftJoin(rooms, eq(sessions.roomId, rooms.id))
    .where(eq(sessions.id, id))
    .limit(1)
  const row = rows[0]
  if (!row) return null
  return {
    ...row.session,
    roomName: row.roomName,
    room:
      row.roomName !== null
        ? { id: row.session.roomId, name: row.roomName }
        : null
  }
}

export async function insertSession(
  db: Db,
  values: typeof sessions.$inferInsert
): Promise<Session | null> {
  const rows = await db.insert(sessions).values(values).returning()
  return rows[0] ?? null
}

export async function updateSession(
  db: Db,
  id: number,
  values: Partial<typeof sessions.$inferInsert>
): Promise<Session | null> {
  const rows = await db
    .update(sessions)
    .set({ ...values, updatedAt: new Date() })
    .where(eq(sessions.id, id))
    .returning()
  return rows[0] ?? null
}

export async function deleteSessionRow(db: Db, id: number): Promise<boolean> {
  const rows = await db
    .delete(sessions)
    .where(sql`${sessions.id} = ${id} and ${sessions.manuallyClosedAt} is null`)
    .returning({ id: sessions.id })
  return rows.length > 0
}

export async function countAttendanceReferences(
  db: Db,
  sessionId: number
): Promise<{ attendances: number; attempts: number }> {
  const [attRow] = await db
    .select({ count: count() })
    .from(attendances)
    .where(eq(attendances.sessionId, sessionId))
  const [attAttemptRow] = await db
    .select({ count: count() })
    .from(attendanceAttempts)
    .where(eq(attendanceAttempts.sessionId, sessionId))
  return {
    attendances: attRow?.count ?? 0,
    attempts: attAttemptRow?.count ?? 0
  }
}
