import { getDb } from '../../utils/db'
import { requireRole } from '../../utils/http'
import { apiHandler } from '../../utils/app-error'
import { listOwnAttendanceHistory } from '../../services/student-attendance.service'

export default apiHandler(async event => {
  const actor = await requireRole(event, 'student')
  const attendances = await listOwnAttendanceHistory(
    getDb(event as never),
    actor
  )
  return { attendances }
})
