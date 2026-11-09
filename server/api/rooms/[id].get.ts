import { getDb } from '../../utils/db'
import { requireRole } from '../../utils/http'
import { getRoom } from '../../services/room.service'
import { apiHandler } from '../../utils/app-error'

/**
 * GET /api/rooms/:id – view a single room (admin + lecturer).
 */
export default apiHandler(async event => {
  const actor = await requireRole(event, 'admin', 'lecturer')
  const db = getDb(event as never)
  const id = Number(event.context.params?.id)
  const room = await getRoom(db, actor, id)
  return { room }
})
