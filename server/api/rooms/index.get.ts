import { defineEventHandler, getQuery } from 'h3'
import { getDb } from '../../utils/db'
import { requireRole } from '../../utils/http'
import { getRooms } from '../../services/room.service'

/**
 * GET /api/rooms - list rooms (paginated, any authenticated user).
 */
export default defineEventHandler(async event => {
  const actor = await requireRole(event, 'admin')
  const db = getDb(event as never)
  const q = getQuery(event)
  const page = Number(q.page) || 1
  const pageSize = Number(q.pageSize) || 50
  return await getRooms(db, actor, { page, pageSize })
})
