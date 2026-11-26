import { getDb } from '../../../utils/db'
import { requireAuth } from '../../../utils/http'
import { getPhotoStorage } from '../../../utils/storage'
import { apiHandler, notFound } from '../../../utils/app-error'
import { getAuthorizedAttendancePhoto } from '../../../services/attendance-photo.service'

export default apiHandler(async event => {
  const actor = await requireAuth(event)
  const attendanceId = Number(event.context.params?.id)
  if (!Number.isInteger(attendanceId) || attendanceId <= 0) {
    throw notFound('Attendance photo not found')
  }

  const photo = await getAuthorizedAttendancePhoto(
    getDb(event as never),
    actor,
    attendanceId,
    getPhotoStorage(event as never)
  )
  const body = photo.body.slice().buffer as ArrayBuffer
  return new Response(body, {
    headers: {
      'Content-Type': photo.contentType,
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff'
    }
  })
})
