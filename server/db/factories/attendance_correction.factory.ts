import { faker } from '@faker-js/faker'
import { attendanceStatuses } from '../schema/attendances'
import type { NewAttendanceCorrection } from '../schema/attendance_corrections'

export function attendanceCorrectionFactory(
  overrides: Partial<NewAttendanceCorrection> & {
    attendanceId: number
    lecturerId: number
  }
): NewAttendanceCorrection {
  const [
    previousStatus = attendanceStatuses[0],
    newStatus = attendanceStatuses[1]
  ] = faker.helpers.arrayElements([...attendanceStatuses], 2)
  return {
    previousStatus,
    newStatus,
    reason: faker.lorem.sentence(),
    correctedAt: faker.date.recent({ days: 30 }),
    ...overrides
  }
}
