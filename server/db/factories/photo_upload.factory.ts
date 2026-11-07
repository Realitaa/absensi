import { faker } from '@faker-js/faker'
import {
  photoUploadStatuses,
  type NewPhotoUpload
} from '../schema/photo_uploads'

export function photoUploadFactory(
  overrides: Partial<NewPhotoUpload> & { userId: number }
): NewPhotoUpload {
  const status = faker.helpers.arrayElement([...photoUploadStatuses])
  const uploadedAt = faker.date.recent({ days: 30 })
  return {
    photoPath: `selfies/${faker.string.uuid()}.jpg`,
    status,
    uploadedAt,
    consumedAt: status === 'consumed' ? uploadedAt : null,
    attendanceId: null,
    ...overrides
  }
}
