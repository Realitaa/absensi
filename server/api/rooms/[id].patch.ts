import { defineEventHandler, readBody } from 'h3'
import { getDb } from '../../utils/db'
import { requireRole } from '../../utils/http'
import { updateExistingRoom } from '../../services/room.service'

/**
 * PATCH /api/rooms/:id – update a room (admin only, FR-ROOM-01).
 */
export default defineEventHandler(async event => {
  const actor = await requireRole(event, 'admin')
  const db = getDb(event as never)
  const id = Number(event.context.params?.id)
  const body = (await readBody(event).catch(() => null)) ?? {}
  const room = await updateExistingRoom(db, actor, id, body)
  return { room }
})
