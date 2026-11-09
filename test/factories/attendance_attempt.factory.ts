import { faker } from '@faker-js/faker'
import { validationPolicies } from '../../server/db/schema/attendances'
import {
  attemptResults,
  type NewAttendanceAttempt
} from '../../server/db/schema/attendance_attempts'

export function attendanceAttemptFactory(
  overrides: Partial<NewAttendanceAttempt> & {
    studentId: number
    sessionId: number
    roomId: number
  }
): NewAttendanceAttempt {
  const result = faker.helpers.arrayElement([...attemptResults])
  const hasGps = faker.datatype.boolean({ probability: 0.8 })
  return {
    latitude: hasGps ? Number(faker.location.latitude().toFixed(7)) : null,
    longitude: hasGps ? Number(faker.location.longitude().toFixed(7)) : null,
    accuracy: hasGps ? faker.number.int({ min: 3, max: 50 }) : null,
    calculatedDistance: hasGps ? faker.number.int({ min: 1, max: 100 }) : null,
    validationPolicy: faker.helpers.arrayElement([...validationPolicies]),
    result,
    rejectionReason:
      result === 'rejected'
        ? faker.helpers.arrayElement([
            'outside_geofence',
            'gps_inaccurate',
            'session_closed'
          ])
        : null,
    attemptedAt: faker.date.recent({ days: 30 }),
    attendanceId: null,
    ...overrides
  }
}
