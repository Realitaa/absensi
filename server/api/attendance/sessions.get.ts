import { getDb } from '../../utils/db'
import { requireRole } from '../../utils/http'
import { apiHandler } from '../../utils/app-error'
import { listEligibleStudentSessions } from '../../services/student-attendance.service'

export default apiHandler(async event => {
  await requireRole(event, 'student')
  return await listEligibleStudentSessions(getDb(event as never))
})
