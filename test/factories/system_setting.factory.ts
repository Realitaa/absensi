import { faker } from '@faker-js/faker'
import { validationPolicies } from '../../server/db/schema/attendances'
import type { NewSystemSetting } from '../../server/db/schema/system_settings'

export function systemSettingFactory(
  overrides: Partial<NewSystemSetting> = {}
): NewSystemSetting {
  return {
    id: 1,
    gpsValidationPolicy: faker.helpers.arrayElement([...validationPolicies]),
    ...overrides
  }
}
