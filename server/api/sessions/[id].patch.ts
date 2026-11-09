import { readBody } from 'h3'
import { getDb } from '../../utils/db'
import { requireRole } from '../../utils/http'
import { updateOwnSession } from '../../services/session.service'
import { apiHandler } from '../../utils/app-error'

/**
 * PATCH /api/sessions/:id - edit own session details.
 * Closed sessions are not editable (409 SESSION_NOT_EDITABLE).
 * Sessions owned by another lecturer return 403 FORBIDDEN.
 */
export default apiHandler(async event => {
  const actor = await requireRole(event, 'lecturer')
  const db = getDb(event as never)
  const id = Number((event.context as { params?: { id?: string } })?.params?.id)
  const body = (await readBody(event).catch(() => null)) ?? {}
  const session = await updateOwnSession(db, actor, id, body)
  return { session }
})
