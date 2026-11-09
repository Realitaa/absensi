import { getDb } from '../../utils/db'
import { requireRole } from '../../utils/http'
import { getOwnSession } from '../../services/session.service'
import { apiHandler } from '../../utils/app-error'

/**
 * GET /api/sessions/:id - view own session (lecturer only, FR-SESSION-02).
 * Returns 403 FORBIDDEN for sessions owned by another lecturer,
 * 404 NOT_FOUND for nonexistent sessions.
 */
export default apiHandler(async event => {
  const actor = await requireRole(event, 'lecturer')
  const db = getDb(event as never)
  const id = Number((event.context as { params?: { id?: string } })?.params?.id)
  const session = await getOwnSession(db, actor, id)
  return { session }
})
