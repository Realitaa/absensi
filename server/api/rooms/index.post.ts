import { defineEventHandler, readBody } from 'h3'
import { getDb } from '../../utils/db'
import { requireRole } from '../../utils/http'
import { createRoom } from '../../services/room.service'

/**
 * POST /api/rooms - create a room (admin only, FR-ROOM-01).
 */
export default defineEventHandler(async event => {
  const actor = await requireRole(event, 'admin')
  const db = getDb(event as never)
  const body = (await readBody(event).catch(() => null)) ?? {}
  const room = await createRoom(db, actor, body)
  return { room }
})
