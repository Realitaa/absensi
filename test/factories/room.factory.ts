import { faker } from '@faker-js/faker'
import type { NewRoom } from '../../server/db/schema/rooms'

export function roomFactory(overrides: Partial<NewRoom> = {}): NewRoom {
  return {
    name: `Ruang ${faker.number.int({ min: 101, max: 999 })}`,
    latitude: Number(faker.location.latitude().toFixed(7)),
    longitude: Number(faker.location.longitude().toFixed(7)),
    radius: faker.number.int({ min: 5, max: 20 }),
    ...overrides
  }
}
