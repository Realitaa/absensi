import { faker } from '@faker-js/faker'
import type { NewUser, UserRole } from '../../server/db/schema/users'

export function userFactory(overrides: Partial<NewUser> = {}): NewUser {
  const role: UserRole =
    overrides.role ??
    faker.helpers.arrayElement(['student', 'student', 'lecturer', 'admin'])
  return {
    name: faker.person.fullName(),
    username: faker.internet.username(),
    password: faker.string.alphanumeric(32),
    role,
    nim:
      role === 'student'
        ? String(faker.number.int({ min: 1000000000, max: 9999999999 }))
        : null,
    ...overrides
  }
}

export function makeMany<T>(
  factory: (overrides?: Partial<T>) => T,
  count: number,
  overrides: Partial<T> = {}
): T[] {
  return Array.from({ length: count }, () => factory(overrides))
}
