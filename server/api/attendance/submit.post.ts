import { readBody } from 'h3'
import { getDb } from '../../utils/db'
import { requireRole } from '../../utils/http'
import { getPhotoStorage } from '../../utils/storage'
import { apiHandler } from '../../utils/app-error'
import { submitStudentAttendance } from '../../services/student-attendance.service'

export default apiHandler(async event => {
  const actor = await requireRole(event, 'student')
  const body = (await readBody(event).catch(() => null)) ?? {}
  return await submitStudentAttendance(getDb(event as never), actor, body, {
    storage: getPhotoStorage(event as never)
  })
})
