import { getDb } from '../../utils/db'
import { requireRole } from '../../utils/http'
import { deleteOwnSession } from '../../services/session.service'
import { apiHandler } from '../../utils/app-error'

/**
 * DELETE /api/sessions/:id - delete own session.
 * Sessions containing attendance records must not be deleted
 * (409 SESSION_IN_USE, FR-SESSION-08 / SRS §10.3).
 * Sessions owned by another lecturer return 403 FORBIDDEN.
 */
export default apiHandler(async event => {
  const actor = await requireRole(event, 'lecturer')
  const db = getDb(event as never)
  const id = Number((event.context as { params?: { id?: string } })?.params?.id)
  return await deleteOwnSession(db, actor, id)
})
