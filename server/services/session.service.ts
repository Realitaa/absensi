import type { Db } from '../db/index'
import type { Session } from '../db/schema/sessions'
import {
  countAttendanceReferences,
  deleteSessionRow,
  findSessionById,
  findSessionWithRoomById,
  insertSession,
  listSessionsByLecturer,
  updateSession,
  type SessionWithRoom
} from '../repositories/session.repository'
import { findRoomById } from '../repositories/room.repository'
import {
  AppError,
  forbidden,
  notFound,
  validationError
} from '../utils/app-error'
import { ErrorCodes } from '../../shared/error-codes'
import { getAppTimezone, parseInstant } from '../../shared/utils/timezone'
import type { AuthenticatedUser } from './auth.service'
import { listAttendancesBySession } from '../repositories/session-attendance.repository'

/**
 * Business rules (SRS §4, §10.3):
 *  - Only lecturers manage sessions; ownership enforced here (not UI-only).
 *  - startsAt <= lateThresholdAt < closesAt (else INVALID_SESSION_WINDOW).
 *  - Status derived dynamically from server time + manuallyClosedAt (no cron).
 *  - Manual close only for ongoing sessions; never opens early.
 *  - Delete only when no attendance/attempt records reference the session.
 */

export type SessionStatus =
  'scheduled' | 'open-present' | 'open-late' | 'closed'

export interface SessionDto {
  id: number
  lecturerId: number
  roomId: number
  roomName: string | null
  room: {
    id: number
    name: string
    latitude?: number | null
    longitude?: number | null
    radius?: number | null
  } | null
  name: string
  description: string | null
  startsAt: string
  lateThresholdAt: string
  closesAt: string
  manuallyClosedAt: string | null
  status: SessionStatus
  createdAt: string
  updatedAt: string
}

export interface SessionInput {
  name?: unknown
  description?: unknown
  roomId?: unknown
  startsAt?: unknown
  lateThresholdAt?: unknown
  closesAt?: unknown
}

const EDITABLE_FIELDS = new Set([
  'name',
  'description',
  'roomId',
  'startsAt',
  'lateThresholdAt',
  'closesAt'
])

export function sessionStatus(
  session: Pick<
    Session,
    'startsAt' | 'lateThresholdAt' | 'closesAt' | 'manuallyClosedAt'
  >,
  now: Date = new Date()
): SessionStatus {
  if (session.manuallyClosedAt !== null) return 'closed'
  const nowMs = now.getTime()
  const startsMs = session.startsAt.getTime()
  const lateMs = session.lateThresholdAt.getTime()
  const closesMs = session.closesAt.getTime()
  if (nowMs < startsMs) return 'scheduled'
  if (nowMs >= closesMs) return 'closed'
  if (nowMs >= lateMs) return 'open-late'
  return 'open-present'
}

function toDto(session: SessionWithRoom | Session, now: Date): SessionDto {
  const roomName =
    'roomName' in session && typeof session.roomName === 'string'
      ? session.roomName
      : null
  const room =
    'room' in session && session.room
      ? session.room
      : roomName !== null
        ? { id: session.roomId, name: roomName }
        : null
  return {
    id: session.id,
    lecturerId: session.lecturerId,
    roomId: session.roomId,
    roomName,
    room,
    name: session.name,
    description: session.description ?? null,
    startsAt: session.startsAt.toISOString(),
    lateThresholdAt: session.lateThresholdAt.toISOString(),
    closesAt: session.closesAt.toISOString(),
    manuallyClosedAt: session.manuallyClosedAt?.toISOString() ?? null,
    status: sessionStatus(session, now),
    createdAt: session.createdAt.toISOString(),
    updatedAt: session.updatedAt.toISOString()
  }
}

async function assertRoomExists(db: Db, roomId: number) {
  const room = await findRoomById(db, roomId)
  if (!room) throw notFound('Room not found')
}

function parseSessionFields(
  input: SessionInput,
  existing?: Session
): {
  values: Partial<{
    name: string
    description: string | null
    roomId: number
    startsAt: Date
    lateThresholdAt: Date
    closesAt: Date
  }>
  fieldErrors: Record<string, string[]>
} {
  const tz = getAppTimezone()
  const fieldErrors: Record<string, string[]> = {}
  const values: Partial<{
    name: string
    description: string | null
    roomId: number
    startsAt: Date
    lateThresholdAt: Date
    closesAt: Date
  }> = {}

  if (input.name === undefined) {
    if (!existing) fieldErrors.name = ['Session name is required']
  } else if (typeof input.name !== 'string' || !input.name.trim()) {
    fieldErrors.name = ['Session name is required']
  } else if (input.name.trim().length < 2 || input.name.trim().length > 200) {
    fieldErrors.name = ['Session name must be between 2 and 200 characters']
  } else {
    values.name = input.name.trim()
  }

  if (input.description !== undefined) {
    if (input.description === null || input.description === '') {
      values.description = null
    } else if (typeof input.description !== 'string') {
      fieldErrors.description = ['Description must be text']
    } else if (input.description.length > 2000) {
      fieldErrors.description = ['Description must not exceed 2000 characters']
    } else {
      values.description = input.description
    }
  }

  if (input.roomId === undefined) {
    if (!existing) fieldErrors.roomId = ['Room is required']
  } else {
    const parsed =
      typeof input.roomId === 'number'
        ? input.roomId
        : typeof input.roomId === 'string' && input.roomId.trim() !== ''
          ? Number(input.roomId)
          : NaN
    if (!Number.isInteger(parsed) || parsed <= 0) {
      fieldErrors.roomId = ['Room is required']
    } else {
      values.roomId = parsed
    }
  }

  const timeFields = ['startsAt', 'lateThresholdAt', 'closesAt'] as const
  for (const field of timeFields) {
    const raw = input[field]
    if (raw === undefined) {
      if (!existing) fieldErrors[field] = [`${field} is required`]
      continue
    }
    const parsed = parseInstant(raw, tz)
    if (!parsed) {
      fieldErrors[field] = [`${field} must be a valid date time`]
    } else {
      values[field] = parsed
    }
  }

  // Cross-field window validation on the merged (existing + patch) values.
  // Time fields are DTO-named so they can be attributed precisely.
  const merged = {
    startsAt: values.startsAt ?? existing?.startsAt,
    lateThresholdAt: values.lateThresholdAt ?? existing?.lateThresholdAt,
    closesAt: values.closesAt ?? existing?.closesAt
  }
  if (merged.startsAt && merged.lateThresholdAt && merged.closesAt) {
    const s = merged.startsAt.getTime()
    const l = merged.lateThresholdAt.getTime()
    const c = merged.closesAt.getTime()
    if (s > l) {
      const field =
        input.startsAt !== undefined ? 'startsAt' : 'lateThresholdAt'
      fieldErrors[field] = ['Late threshold must be at or after start time']
    }
    if (l >= c) {
      const field =
        input.closesAt !== undefined ? 'closesAt' : 'lateThresholdAt'
      fieldErrors[field] = ['Closing time must be after late threshold']
    }
  }

  return { values, fieldErrors }
}

function throwIfFieldErrors(fieldErrors: Record<string, string[]>) {
  if (Object.keys(fieldErrors).length === 0) return
  const isWindow =
    Object.values(fieldErrors).some(msgs =>
      msgs.some(m => m.includes('Late threshold') || m.includes('Closing time'))
    ) &&
    Object.keys(fieldErrors).every(k =>
      ['startsAt', 'lateThresholdAt', 'closesAt'].includes(k)
    ) &&
    !Object.keys(fieldErrors).some(k =>
      fieldErrors[k]?.some(
        m => m.includes('valid date time') || m.includes('required')
      )
    )
  if (isWindow) {
    throw new AppError(
      ErrorCodes.INVALID_SESSION_WINDOW,
      400,
      'Invalid session time window',
      { fieldErrors }
    )
  }
  throw validationError('Session validation failed', fieldErrors)
}

export async function createSession(
  db: Db,
  actor: AuthenticatedUser,
  input: SessionInput,
  now: Date = new Date()
): Promise<SessionDto> {
  const unknownFields = Object.keys(input ?? {}).filter(
    k => !EDITABLE_FIELDS.has(k)
  )
  if (unknownFields.length > 0) {
    throw validationError('Session validation failed', {
      [unknownFields[0]!]: ['Unknown field']
    })
  }
  const { values, fieldErrors } = parseSessionFields(input ?? {})
  throwIfFieldErrors(fieldErrors)
  await assertRoomExists(db, values.roomId!)
  const row = await insertSession(db, {
    lecturerId: actor.id,
    roomId: values.roomId!,
    name: values.name!,
    description: values.description ?? null,
    startsAt: values.startsAt!,
    lateThresholdAt: values.lateThresholdAt!,
    closesAt: values.closesAt!
  })
  const full = await findSessionWithRoomById(db, row!.id)
  return toDto(full ?? row!, now)
}

export async function listOwnSessions(
  db: Db,
  actor: AuthenticatedUser,
  query: { page?: number; pageSize?: number },
  now: Date = new Date()
) {
  const page = Math.max(1, Math.floor(query.page ?? 1))
  const pageSize = Math.min(100, Math.max(1, Math.floor(query.pageSize ?? 50)))
  const { rows, total } = await listSessionsByLecturer(db, actor.id, {
    page,
    pageSize
  })
  return {
    sessions: rows.map(r => toDto(r, now)),
    page,
    pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / pageSize))
  }
}

export async function listOwnSessionAttendances(
  db: Db,
  actor: AuthenticatedUser,
  id: number
) {
  await getOwnSession(db, actor, id)
  const rows = await listAttendancesBySession(db, id)
  return rows.map(row => ({
    id: row.id,
    studentId: row.studentId,
    studentName: row.studentName,
    nim: row.nim,
    status: row.status,
    attendanceTimestamp: row.attendanceTimestamp.toISOString(),
    latitude: row.latitude,
    longitude: row.longitude,
    accuracy: row.accuracy,
    calculatedDistance: row.calculatedDistance,
    validationPolicy: row.validationPolicy,
    photoPath: row.photoPath
  }))
}

export async function getOwnSession(
  db: Db,
  actor: AuthenticatedUser,
  id: number,
  now: Date = new Date()
): Promise<SessionDto> {
  const session = await findSessionById(db, id)
  if (!session) throw notFound('Session not found')
  if (session.lecturerId !== actor.id) throw forbidden('Access denied')
  const full = await findSessionWithRoomById(db, id)
  return toDto(full ?? session, now)
}

export async function updateOwnSession(
  db: Db,
  actor: AuthenticatedUser,
  id: number,
  input: SessionInput,
  now: Date = new Date()
): Promise<SessionDto> {
  const session = await findSessionById(db, id)
  if (!session) throw notFound('Session not found')
  if (session.lecturerId !== actor.id) throw forbidden('Access denied')

  const unknownFields = Object.keys(input ?? {}).filter(
    k => !EDITABLE_FIELDS.has(k)
  )
  if (unknownFields.length > 0) {
    throw validationError('Session validation failed', {
      [unknownFields[0]!]: ['Unknown field']
    })
  }
  if (Object.keys(input ?? {}).length === 0) {
    throw validationError('No session fields provided for update')
  }

  const { values, fieldErrors } = parseSessionFields(input ?? {}, session)
  throwIfFieldErrors(fieldErrors)

  if (values.roomId !== undefined) await assertRoomExists(db, values.roomId)

  const status = sessionStatus(session, now)
  if (status === 'closed') {
    throw new AppError(
      ErrorCodes.SESSION_NOT_EDITABLE,
      409,
      'Closed sessions cannot be edited'
    )
  }
  // Changing times on an ongoing session: merged window must stay in the
  // future relative to server time. Never allow moving the window into
  // the past on an open session.
  const hasTimeChange =
    values.startsAt !== undefined ||
    values.lateThresholdAt !== undefined ||
    values.closesAt !== undefined
  if (hasTimeChange && (status === 'open-present' || status === 'open-late')) {
    const mergedStarts = values.startsAt ?? session.startsAt
    const mergedCloses = values.closesAt ?? session.closesAt
    if (
      mergedStarts.getTime() < now.getTime() ||
      mergedCloses.getTime() <= now.getTime()
    ) {
      throw new AppError(
        ErrorCodes.INVALID_SESSION_WINDOW,
        400,
        'Invalid session time window',
        {
          fieldErrors: {
            startsAt: ['Session times must not be moved into the past']
          }
        }
      )
    }
  }

  const updated = await updateSession(db, id, values)
  const full = await findSessionWithRoomById(db, updated!.id)
  return toDto(full ?? updated!, new Date())
}

export async function closeOwnSession(
  db: Db,
  actor: AuthenticatedUser,
  id: number,
  now: Date = new Date()
): Promise<SessionDto> {
  const session = await findSessionById(db, id)
  if (!session) throw notFound('Session not found')
  if (session.lecturerId !== actor.id) throw forbidden('Access denied')

  const status = sessionStatus(session, now)
  // Idempotent for already-closed sessions: return current state.
  if (status === 'closed') {
    const full = await findSessionWithRoomById(db, id)
    return toDto(full ?? session, now)
  }
  // FR-SESSION-04: never manually open before scheduled start.
  if (status === 'scheduled') {
    throw new AppError(
      ErrorCodes.SESSION_NOT_OPEN,
      409,
      'Session has not opened yet'
    )
  }
  const updated = await updateSession(db, id, { manuallyClosedAt: now })
  const full = await findSessionWithRoomById(db, updated!.id)
  return toDto(full ?? updated!, new Date())
}

export async function deleteOwnSession(
  db: Db,
  actor: AuthenticatedUser,
  id: number
): Promise<{ deleted: boolean; id: number }> {
  const session = await findSessionById(db, id)
  if (!session) throw notFound('Session not found')
  if (session.lecturerId !== actor.id) throw forbidden('Access denied')

  const refs = await countAttendanceReferences(db, id)
  if (refs.attendances > 0) {
    throw new AppError(
      ErrorCodes.SESSION_IN_USE,
      409,
      'Session cannot be deleted because it has attendance records'
    )
  }

  // A session without official attendance may be deleted even when it was
  // closed. Its rejected GPS attempts are discarded with the session.
  const ok = await deleteSessionRow(db, id)
  if (!ok) throw notFound('Session not found')
  return { deleted: true, id: session.id }
}
