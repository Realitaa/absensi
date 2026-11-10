import { eq } from 'drizzle-orm'
import type { Db } from '../db/index'
import { systemSettings } from '../db/schema/system_settings'
import type { ValidationPolicy } from '../db/schema/attendances'
import { AppError, validationError } from '../utils/app-error'
import { ErrorCodes } from '../../shared/error-codes'

export interface Coordinates {
  latitude: number
  longitude: number
  accuracy: number
}

export interface GpsEvaluation {
  policy: ValidationPolicy
  distance: number | null
  accepted: boolean
  reason?: string
}

export function haversineDistance(
  latitude: number,
  longitude: number,
  roomLatitude: number,
  roomLongitude: number
): number {
  const earthRadius = 6_371_000
  const toRadians = (value: number) => (value * Math.PI) / 180
  const latitudeDelta = toRadians(roomLatitude - latitude)
  const longitudeDelta = toRadians(roomLongitude - longitude)
  const a =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(toRadians(latitude)) *
      Math.cos(toRadians(roomLatitude)) *
      Math.sin(longitudeDelta / 2) ** 2
  return 2 * earthRadius * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

export function validateCoordinates(input: unknown): Coordinates {
  const value = (input ?? {}) as Record<string, unknown>
  if (
    value.latitude === null ||
    value.latitude === undefined ||
    value.longitude === null ||
    value.longitude === undefined ||
    value.accuracy === null ||
    value.accuracy === undefined
  ) {
    throw new AppError(
      ErrorCodes.GPS_UNAVAILABLE,
      400,
      'Valid GPS coordinates and accuracy are required'
    )
  }
  const latitude = Number(value.latitude)
  const longitude = Number(value.longitude)
  const accuracy = Number(value.accuracy)
  if (
    !Number.isFinite(latitude) ||
    latitude < -90 ||
    latitude > 90 ||
    !Number.isFinite(longitude) ||
    longitude < -180 ||
    longitude > 180 ||
    !Number.isFinite(accuracy) ||
    accuracy < 0 ||
    accuracy > 100_000
  ) {
    throw new AppError(
      ErrorCodes.GPS_UNAVAILABLE,
      400,
      'Valid GPS coordinates and accuracy are required'
    )
  }
  return { latitude, longitude, accuracy }
}

export function evaluateGps(
  coordinates: Coordinates,
  room: { latitude: number; longitude: number; radius: number },
  policy: ValidationPolicy
): GpsEvaluation {
  const distance = haversineDistance(
    coordinates.latitude,
    coordinates.longitude,
    room.latitude,
    room.longitude
  )
  const accepted =
    policy === 'K1'
      ? distance <= room.radius
      : policy === 'K2'
        ? distance <= room.radius && coordinates.accuracy <= room.radius
        : distance + coordinates.accuracy <= room.radius
  return {
    policy,
    distance,
    accepted,
    ...(accepted
      ? {}
      : { reason: 'GPS location does not satisfy the active policy' })
  }
}

export async function getActiveGpsPolicy(db: Db): Promise<ValidationPolicy> {
  const [setting] = await db
    .select({ policy: systemSettings.gpsValidationPolicy })
    .from(systemSettings)
    .where(eq(systemSettings.id, 1))
    .limit(1)
  if (!setting)
    throw new AppError(
      ErrorCodes.INTERNAL_ERROR,
      500,
      'GPS policy is not configured'
    )
  return setting.policy
}

export function missingGpsAttemptReason(
  errorCode = ErrorCodes.GPS_UNAVAILABLE
) {
  return errorCode === ErrorCodes.GPS_UNAVAILABLE
    ? 'GPS coordinates were unavailable'
    : 'GPS validation failed'
}

export function assertStudentSessionId(value: unknown): number {
  const id = Number(value)
  if (!Number.isInteger(id) || id <= 0) {
    throw validationError('A valid session_id is required')
  }
  return id
}
