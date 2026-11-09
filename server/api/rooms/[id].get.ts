import { defineEventHandler } from 'h3'
import { getDb } from '../../utils/db'
import { requireRole } from '../../utils/http'
import { getRoom } from '../../services/room.service'

/**
 * GET /api/rooms/:id – view a single room (any authenticated user).
 */
export default defineEventHandler(async event => {
  const actor = await requireRole(event, 'admin')
  const db = getDb(event as never)
  const id = Number(event.context.params?.id)
  const room = await getRoom(db, actor, id)
  return { room }
})
