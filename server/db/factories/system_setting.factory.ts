import { faker } from '@faker-js/faker'
import { validationPolicies } from '../schema/attendances'
import type { NewSystemSetting } from '../schema/system_settings'

export function systemSettingFactory(
  overrides: Partial<NewSystemSetting> = {}
): NewSystemSetting {
  return {
    id: 1,
    gpsValidationPolicy: faker.helpers.arrayElement([...validationPolicies]),
    ...overrides
  }
}
