import { getDb } from '../../../utils/db'
import { requireRole } from '../../../utils/http'
import { closeOwnSession } from '../../../services/session.service'
import { apiHandler } from '../../../utils/app-error'

/**
 * POST /api/sessions/:id/close - manually close own ongoing session.
 * Scheduled sessions cannot be manually opened early (409 SESSION_NOT_OPEN).
 * Sessions owned by another lecturer return 403 FORBIDDEN.
 * Already-closed sessions return current state (idempotent).
 */
export default apiHandler(async event => {
  const actor = await requireRole(event, 'lecturer')
  const db = getDb(event as never)
  const id = Number((event.context as { params?: { id?: string } })?.params?.id)
  const session = await closeOwnSession(db, actor, id)
  return { session }
})
