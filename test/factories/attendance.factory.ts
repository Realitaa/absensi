import { faker } from '@faker-js/faker'
import {
  attendanceStatuses,
  validationPolicies,
  type NewAttendance
} from '../../server/db/schema/attendances'

export function attendanceFactory(
  overrides: Partial<NewAttendance> & { studentId: number; sessionId: number }
): NewAttendance {
  const attendanceTimestamp = faker.date.recent({ days: 30 })
  return {
    status: faker.helpers.arrayElement([...attendanceStatuses]),
    attendanceTimestamp,
    latitude: Number(faker.location.latitude().toFixed(7)),
    longitude: Number(faker.location.longitude().toFixed(7)),
    accuracy: faker.number.int({ min: 3, max: 30 }),
    calculatedDistance: faker.number.int({ min: 1, max: 25 }),
    validationPolicy: faker.helpers.arrayElement([...validationPolicies]),
    photoPath: `selfies/${faker.string.uuid()}.jpg`,
    ...overrides
  }
}
