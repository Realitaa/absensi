import { readBody } from 'h3'
import { getDb } from '../../utils/db'
import { requireRole } from '../../utils/http'
import { createSession } from '../../services/session.service'
import { apiHandler } from '../../utils/app-error'

/**
 * POST /api/sessions - create a session (lecturer only, FR-SESSION-01).
 * Lecturer ownership is taken from the authenticated user.
 */
export default apiHandler(async event => {
  const actor = await requireRole(event, 'lecturer')
  const db = getDb(event as never)
  const body = (await readBody(event).catch(() => null)) ?? {}
  const session = await createSession(db, actor, body)
  return { session }
})
