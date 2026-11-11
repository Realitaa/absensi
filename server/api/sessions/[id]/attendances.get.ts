import { getDb } from '../../../utils/db'
import { requireRole } from '../../../utils/http'
import { apiHandler } from '../../../utils/app-error'
import { listOwnSessionAttendances } from '../../../services/session.service'

export default apiHandler(async event => {
  const actor = await requireRole(event, 'lecturer')
  const db = getDb(event as never)
  const id = Number(event.context.params?.id)
  const attendances = await listOwnSessionAttendances(db, actor, id)
  return { attendances }
})
