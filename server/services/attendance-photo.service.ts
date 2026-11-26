import type { Db } from '../db/index'
import type { AuthenticatedUser } from './auth.service'
import { findAttendancePhotoAccess } from '../repositories/attendance-photo.repository'
import { forbidden, notFound } from '../utils/app-error'
import type { PhotoStorage } from '../utils/storage'

export async function getAuthorizedAttendancePhoto(
  db: Db,
  actor: AuthenticatedUser,
  attendanceId: number,
  storage: PhotoStorage
) {
  const attendance = await findAttendancePhotoAccess(db, attendanceId)
  if (!attendance) throw notFound('Attendance photo not found')

  const authorized =
    actor.role === 'admin' ||
    (actor.role === 'student' && attendance.studentId === actor.id) ||
    (actor.role === 'lecturer' && attendance.lecturerId === actor.id)
  if (!authorized) throw forbidden('Access denied')

  const photo = await storage.get(attendance.photoPath)
  if (!photo) throw notFound('Attendance photo not found')

  const contentType = photo.contentType?.toLowerCase()
  if (
    !contentType ||
    !['image/jpeg', 'image/png', 'image/webp'].includes(contentType)
  ) {
    throw notFound('Attendance photo not found')
  }

  return { body: photo.body, contentType }
}
