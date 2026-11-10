import type { Db } from '../db/index'
import {
  insertSystemSettings,
  findSystemSettings,
  updateGpsValidationPolicy
} from '../repositories/system-settings.repository'
import { internalError, validationError } from '../utils/app-error'
import {
  validationPolicies,
  type ValidationPolicy
} from '../db/schema/attendances'
import type { AuthenticatedUser } from './auth.service'

export const gpsPolicyDetails: Record<
  ValidationPolicy,
  {
    name: string
    formula: string
    description: string
  }
> = {
  K1: {
    name: 'K1 — Jarak saja',
    formula: 'd ≤ r',
    description:
      'Hanya memastikan jarak dari lokasi mahasiswa ke ruangan tidak melebihi radius geofence. Akurasi GPS tidak menjadi syarat tambahan.'
  },
  K2: {
    name: 'K2 — Jarak dan akurasi',
    formula: 'd ≤ r dan a ≤ r',
    description:
      'Memastikan mahasiswa berada dalam radius dan nilai akurasi GPS tidak lebih besar dari radius ruangan.'
  },
  K3: {
    name: 'K3 — Akurasi konservatif',
    formula: 'd + a ≤ r',
    description:
      'Menggabungkan jarak dan ketidakpastian akurasi GPS. Ini adalah kebijakan paling ketat dan membantu mengurangi penerimaan posisi yang tidak pasti.'
  }
}

function toDto(setting: {
  gpsValidationPolicy: ValidationPolicy
  updatedAt: Date
}) {
  const policy = setting.gpsValidationPolicy
  return {
    policy,
    name: gpsPolicyDetails[policy].name,
    formula: gpsPolicyDetails[policy].formula,
    description: gpsPolicyDetails[policy].description,
    updatedAt: setting.updatedAt.toISOString()
  }
}

export async function getGpsSettings(db: Db, _actor: AuthenticatedUser) {
  const setting = await findSystemSettings(db)
  if (setting) return toDto(setting)
  const created = await insertSystemSettings(db, 'K2')
  if (!created) throw internalError()
  return toDto(created)
}

export async function updateGpsSettings(
  db: Db,
  _actor: AuthenticatedUser,
  input: { policy?: unknown }
) {
  if (
    typeof input.policy !== 'string' ||
    !validationPolicies.includes(input.policy as ValidationPolicy)
  ) {
    throw validationError('GPS validation policy is invalid', {
      policy: ['Policy must be one of K1, K2, or K3']
    })
  }
  const policy = input.policy as ValidationPolicy
  const existing = await findSystemSettings(db)
  const setting = existing
    ? await updateGpsValidationPolicy(db, policy)
    : await insertSystemSettings(db, policy)
  if (!setting) throw internalError()
  return toDto(setting)
}
