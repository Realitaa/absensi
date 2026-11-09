import { getQuery } from 'h3'
import { getDb } from '../../utils/db'
import { requireRole } from '../../utils/http'
import { getRooms } from '../../services/room.service'
import { apiHandler } from '../../utils/app-error'

/**
 * GET /api/rooms - list rooms (paginated, admin + lecturer).
 * Lecturers need room options for session forms; management stays admin-only.
 */
export default apiHandler(async event => {
  const actor = await requireRole(event, 'admin', 'lecturer')
  const db = getDb(event as never)
  const q = getQuery(event)
  const page = Number(q.page) || 1
  const pageSize = Number(q.pageSize) || 50
  return await getRooms(db, actor, { page, pageSize })
})
