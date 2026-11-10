import { readBody } from 'h3'
import { getDb } from '../../utils/db'
import { requireRole } from '../../utils/http'
import { apiHandler } from '../../utils/app-error'
import { verifyStudentGps } from '../../services/student-attendance.service'

export default apiHandler(async event => {
  const actor = await requireRole(event, 'student')
  const body = (await readBody(event).catch(() => null)) ?? {}
  return await verifyStudentGps(getDb(event as never), actor, body)
})
