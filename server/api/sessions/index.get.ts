import { getQuery } from 'h3'
import { getDb } from '../../utils/db'
import { requireRole } from '../../utils/http'
import { listOwnSessions } from '../../services/session.service'
import { apiHandler } from '../../utils/app-error'

/**
 * GET /api/sessions - list own sessions (lecturer only, FR-SESSION-02).
 * Sessions are filtered server-side by authenticated lecturer.
 */
export default apiHandler(async event => {
  const actor = await requireRole(event, 'lecturer')
  const db = getDb(event as never)
  const q = getQuery(event)
  const page = Number(q.page) || 1
  const pageSize = Number(q.pageSize) || 50
  return await listOwnSessions(db, actor, { page, pageSize })
})
