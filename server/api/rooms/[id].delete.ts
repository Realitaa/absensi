import { getDb } from '../../utils/db'
import { requireRole } from '../../utils/http'
import { deleteExistingRoom } from '../../services/room.service'
import { apiHandler } from '../../utils/app-error'

/**
 * DELETE /api/rooms/:id – delete a room (admin only, FR-ROOM-01).
 * Rejects deletion when the room is referenced by historical sessions
 * or attempts (FR-ROOM-05).
 */
export default apiHandler(async event => {
  const actor = await requireRole(event, 'admin')
  const db = getDb(event as never)
  const id = Number(event.context.params?.id)
  return await deleteExistingRoom(db, actor, id)
})
