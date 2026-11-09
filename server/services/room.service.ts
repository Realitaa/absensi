import type { Db } from '../db/index'
import type { Room } from '../db/schema/rooms'
import {
  countRoomReferences,
  deleteRoom,
  findRoomById,
  findRoomByName,
  insertRoom,
  listRooms,
  updateRoom
} from '../repositories/room.repository'
import { conflict, notFound, validationError } from '../utils/app-error'
import { ErrorCodes } from '../../shared/error-codes'
import type { AuthenticatedUser } from './auth.service'

/**
 * Business rules (SRS §3, FR-ROOM-01..05):
 *  - Only administrators manage rooms (authorization enforced in API layer).
 *  - Name required; latitude −90..90; longitude −180..180;
 *    radius > 0 and ≤ 20 meters.
 *  - A room referenced by historical sessions must not be permanently
 *    deleted (deletion is rejected, not archived — no soft deletion).
 */

export const MAX_RADIUS_METERS = 20

export interface RoomInput {
  name: string
  latitude: number
  longitude: number
  radius: number
}

export type RoomOperation = 'create' | 'update'

function validateRoomInput(
  input: Partial<RoomInput>,
  operation: RoomOperation
): { data: Partial<RoomInput>; fieldErrors: Record<string, string[]> } {
  const data: Partial<RoomInput> = {}
  const fieldErrors: Record<string, string[]> = {}

  if (operation === 'create' || input.name !== undefined) {
    const name = typeof input.name === 'string' ? input.name.trim() : ''
    if (!name) {
      fieldErrors.name = ['Room name is required']
    } else if (name.length < 2 || name.length > 100) {
      fieldErrors.name = ['Room name must be between 2 and 100 characters']
    } else {
      data.name = name
    }
  }

  const checkCoordinate = (
    field: 'latitude' | 'longitude',
    min: number,
    max: number,
    label: string
  ) => {
    const value = input[field]
    if (value === undefined) {
      if (operation === 'create') {
        fieldErrors[field] = [`${label} is required`]
      }
      return
    }
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      fieldErrors[field] = [`${label} must be a valid number`]
    } else if (value < min || value > max) {
      fieldErrors[field] = [`${label} must be between ${min} and ${max}`]
    } else {
      data[field] = value
    }
  }

  checkCoordinate('latitude', -90, 90, 'Latitude')
  checkCoordinate('longitude', -180, 180, 'Longitude')

  const radius = input.radius
  if (radius === undefined) {
    if (operation === 'create') {
      fieldErrors.radius = ['Radius is required']
    }
  } else if (typeof radius !== 'number' || !Number.isFinite(radius)) {
    fieldErrors.radius = ['Radius must be a valid number']
  } else if (radius <= 0) {
    fieldErrors.radius = ['Radius must be greater than 0 meters']
  } else if (radius > MAX_RADIUS_METERS) {
    fieldErrors.radius = [`Radius must not exceed ${MAX_RADIUS_METERS} meters`]
  } else {
    data.radius = radius
  }

  return { data, fieldErrors }
}

function assertNoFieldErrors(fieldErrors: Record<string, string[]>) {
  if (Object.keys(fieldErrors).length > 0) {
    throw validationError('Room validation failed', fieldErrors)
  }
}

function toRoomDto(room: Room) {
  return {
    id: room.id,
    name: room.name,
    latitude: room.latitude,
    longitude: room.longitude,
    radius: room.radius,
    createdAt: room.createdAt,
    updatedAt: room.updatedAt
  }
}

export async function createRoom(
  db: Db,
  _actor: AuthenticatedUser,
  input: Partial<RoomInput>
) {
  const { data, fieldErrors } = validateRoomInput(input, 'create')
  assertNoFieldErrors(fieldErrors)

  const existing = await findRoomByName(db, data.name!)
  if (existing) {
    throw conflict(
      ErrorCodes.CONFLICT,
      'A room with this name already exists',
      { fieldErrors: { name: ['A room with this name already exists'] } }
    )
  }

  const room = await insertRoom(db, data as RoomInput)
  return toRoomDto(room!)
}

export async function getRoom(db: Db, _actor: AuthenticatedUser, id: number) {
  const room = await findRoomById(db, id)
  if (!room) throw notFound('Room not found')
  return toRoomDto(room)
}

export async function getRooms(
  db: Db,
  _actor: AuthenticatedUser,
  query: { page?: number; pageSize?: number }
) {
  const page = Math.max(1, Math.floor(query.page ?? 1))
  const pageSize = Math.min(100, Math.max(1, Math.floor(query.pageSize ?? 50)))
  const { rows, total } = await listRooms(db, { page, pageSize })
  return {
    rooms: rows.map(toRoomDto),
    page,
    pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / pageSize))
  }
}

export async function updateExistingRoom(
  db: Db,
  actor: AuthenticatedUser,
  id: number,
  input: Partial<RoomInput>
) {
  const room = await findRoomById(db, id)
  if (!room) throw notFound('Room not found')

  const { data, fieldErrors } = validateRoomInput(input, 'update')
  assertNoFieldErrors(fieldErrors)

  if (data.name !== undefined) {
    const existing = await findRoomByName(db, data.name, id)
    if (existing) {
      throw conflict(
        ErrorCodes.CONFLICT,
        'A room with this name already exists',
        { fieldErrors: { name: ['A room with this name already exists'] } }
      )
    }
  }

  const updated = await updateRoom(db, id, data)
  return toRoomDto(updated!)
}

/**
 * FR-ROOM-05 / SRS §10.2: a room referenced by historical sessions
 * must not be permanently deleted. Reject with a predictable error.
 */
export async function deleteExistingRoom(
  db: Db,
  actor: AuthenticatedUser,
  id: number
) {
  const room = await findRoomById(db, id)
  if (!room) throw notFound('Room not found')

  const references = await countRoomReferences(db, id)
  if (references.sessions > 0 || references.attempts > 0) {
    throw conflict(
      ErrorCodes.ROOM_IN_USE,
      'Room cannot be deleted because it is referenced by historical attendance sessions'
    )
  }

  await deleteRoom(db, id)
  return { deleted: true, id: room.id }
}
