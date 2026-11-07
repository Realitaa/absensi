import { faker } from '@faker-js/faker'
import type { NewSession } from '../schema/sessions'

export function sessionFactory(
  overrides: Partial<NewSession> & { lecturerId: number; roomId: number }
): NewSession {
  const startsAt = faker.date.recent({ days: 30 })
  const lateThresholdAt = new Date(startsAt.getTime() + 15 * 60 * 1000)
  const closesAt = new Date(lateThresholdAt.getTime() + 90 * 60 * 1000)
  return {
    name: faker.lorem.words(3),
    description: faker.lorem.sentence(),
    startsAt,
    lateThresholdAt,
    closesAt,
    manuallyClosedAt: null,
    ...overrides
  }
}
