import type { Db } from '../db/index'
import { sessionStatus } from './session.service'
import type { AuthenticatedUser } from './auth.service'
import { ErrorCodes } from '../../shared/error-codes'
import {
  AppError,
  conflict,
  notFound,
  validationError
} from '../utils/app-error'
import {
  assertStudentSessionId,
  evaluateGps,
  getActiveGpsPolicy,
  type Coordinates,
  validateCoordinates
} from './gps-validation.service'
import {
  attachAcceptedAttempt,
  createAttendanceAndConsumePhoto,
  findAttendanceForStudentSession,
  findPendingOwnedPhoto,
  findStudentSession,
  insertGpsAttempt,
  listOpenStudentSessions
} from '../repositories/student-attendance.repository'
import { isSafePhotoPath, type PhotoStorage } from '../utils/storage'

function sessionResultStatus(session: { lateThresholdAt: Date }, now: Date) {
  return now.getTime() >= session.lateThresholdAt.getTime() ? 'late' : 'present'
}

function serializeSession(row: Awaited<ReturnType<typeof findStudentSession>>) {
  if (!row) return null
  return {
    id: row.id,
    name: row.name,
    lecturerName: row.lecturerName,
    startsAt: row.startsAt.toISOString(),
    lateThresholdAt: row.lateThresholdAt.toISOString(),
    closesAt: row.closesAt.toISOString(),
    room: {
      id: row.roomId,
      name: row.roomName,
      latitude: row.roomLatitude,
      longitude: row.roomLongitude,
      radius: row.roomRadius
    }
  }
}

export async function listEligibleStudentSessions(db: Db, now = new Date()) {
  const rows = await listOpenStudentSessions(db, now)
  return {
    serverTime: now.toISOString(),
    sessions: rows.map(row => ({
      id: row.id,
      name: row.name,
      description: row.description,
      lecturerName: row.lecturerName,
      startsAt: row.startsAt.toISOString(),
      lateThresholdAt: row.lateThresholdAt.toISOString(),
      closesAt: row.closesAt.toISOString(),
      status: sessionStatus(row, now),
      room: {
        id: row.roomId,
        name: row.roomName,
        latitude: row.roomLatitude,
        longitude: row.roomLongitude,
        radius: row.roomRadius
      }
    }))
  }
}

async function getEligibleSession(db: Db, sessionId: number, now: Date) {
  const session = await findStudentSession(db, sessionId)
  if (!session) throw notFound('Session not found')
  const status = sessionStatus(session, now)
  if (status !== 'open-present' && status !== 'open-late') {
    throw new AppError(
      status === 'closed'
        ? ErrorCodes.SESSION_CLOSED
        : ErrorCodes.SESSION_NOT_OPEN,
      409,
      status === 'closed' ? 'Session is closed' : 'Session is not open'
    )
  }
  return session
}

async function recordRejectedAttempt(
  db: Db,
  actor: AuthenticatedUser,
  session: NonNullable<Awaited<ReturnType<typeof findStudentSession>>>,
  coordinates: Partial<Coordinates>,
  policy: 'K1' | 'K2' | 'K3' | null,
  distance: number | null,
  reason: string,
  now: Date
) {
  await insertGpsAttempt(db, {
    studentId: actor.id,
    sessionId: session.id,
    roomId: session.roomId,
    latitude: coordinates.latitude ?? null,
    longitude: coordinates.longitude ?? null,
    accuracy: coordinates.accuracy ?? null,
    calculatedDistance: distance,
    validationPolicy: policy,
    result: 'rejected',
    rejectionReason: reason,
    attemptedAt: now
  })
}

export async function verifyStudentGps(
  db: Db,
  actor: AuthenticatedUser,
  input: {
    sessionId?: unknown
    latitude?: unknown
    longitude?: unknown
    accuracy?: unknown
  },
  now = new Date()
) {
  const sessionId = assertStudentSessionId(input.sessionId)
  const session = await findStudentSession(db, sessionId)
  if (!session) throw notFound('Session not found')
  const policy = await getActiveGpsPolicy(db)
  let coordinates: Coordinates
  try {
    coordinates = validateCoordinates(input)
  } catch (error) {
    await recordRejectedAttempt(
      db,
      actor,
      session,
      {},
      policy,
      null,
      'GPS coordinates were unavailable',
      now
    )
    throw error
  }
  const status = sessionStatus(session, now)
  if (status !== 'open-present' && status !== 'open-late') {
    await recordRejectedAttempt(
      db,
      actor,
      session,
      coordinates,
      policy,
      null,
      'Session is no longer open',
      now
    )
    throw new AppError(
      ErrorCodes.SESSION_CLOSED,
      409,
      'Session is no longer open'
    )
  }
  const evaluation = evaluateGps(
    coordinates,
    {
      latitude: session.roomLatitude,
      longitude: session.roomLongitude,
      radius: session.roomRadius
    },
    policy
  )
  await insertGpsAttempt(db, {
    studentId: actor.id,
    sessionId: session.id,
    roomId: session.roomId,
    ...coordinates,
    calculatedDistance: evaluation.distance,
    validationPolicy: policy,
    result: evaluation.accepted ? 'accepted' : 'rejected',
    rejectionReason: evaluation.reason ?? null,
    attemptedAt: now
  })
  if (!evaluation.accepted) {
    throw new AppError(
      ErrorCodes.OUTSIDE_GEOFENCE,
      403,
      'GPS location does not satisfy the active policy',
      {
        distance: evaluation.distance,
        accuracy: coordinates.accuracy,
        radius: session.roomRadius,
        policy
      }
    )
  }
  return {
    valid: true,
    policy,
    distance: evaluation.distance,
    accuracy: coordinates.accuracy,
    session: serializeSession(session)
  }
}

export async function submitStudentAttendance(
  db: Db,
  actor: AuthenticatedUser,
  input: {
    sessionId?: unknown
    photoPath?: unknown
    latitude?: unknown
    longitude?: unknown
    accuracy?: unknown
  },
  deps: { storage: PhotoStorage },
  now = new Date()
) {
  const sessionId = assertStudentSessionId(input.sessionId)
  const session = await getEligibleSession(db, sessionId, now)
  const coordinates = validateCoordinates(input)
  if (await findAttendanceForStudentSession(db, actor.id, sessionId)) {
    throw conflict(
      ErrorCodes.DUPLICATE_ATTENDANCE,
      'Attendance already exists for this session'
    )
  }
  if (!isSafePhotoPath(input.photoPath))
    throw validationError('A valid photo_path is required')
  const photoPath = input.photoPath
  const photo = await findPendingOwnedPhoto(db, actor.id, photoPath)
  if (!photo)
    throw new AppError(
      ErrorCodes.CAPTURE_MISMATCH,
      409,
      'Photo upload is invalid or already consumed'
    )
  if (!(await deps.storage.head(photoPath)))
    throw new AppError(
      ErrorCodes.STORAGE_ERROR,
      503,
      'Uploaded photo is unavailable'
    )
  const policy = await getActiveGpsPolicy(db)
  const evaluation = evaluateGps(
    coordinates,
    {
      latitude: session.roomLatitude,
      longitude: session.roomLongitude,
      radius: session.roomRadius
    },
    policy
  )
  if (!evaluation.accepted) {
    await recordRejectedAttempt(
      db,
      actor,
      session,
      coordinates,
      policy,
      evaluation.distance,
      evaluation.reason ?? 'GPS validation failed',
      now
    )
    throw new AppError(
      ErrorCodes.OUTSIDE_GEOFENCE,
      403,
      'GPS location does not satisfy the active policy',
      {
        distance: evaluation.distance,
        policy
      }
    )
  }
  const attendance = await createAttendanceAndConsumePhoto(db, {
    studentId: actor.id,
    sessionId,
    status: sessionResultStatus(session, now),
    attendanceTimestamp: now,
    latitude: coordinates.latitude,
    longitude: coordinates.longitude,
    accuracy: coordinates.accuracy,
    calculatedDistance: evaluation.distance!,
    validationPolicy: policy,
    photoPath
  })
  if (!attendance) {
    if (await findAttendanceForStudentSession(db, actor.id, sessionId)) {
      throw conflict(
        ErrorCodes.DUPLICATE_ATTENDANCE,
        'Attendance already exists for this session'
      )
    }
    throw new AppError(
      ErrorCodes.CAPTURE_MISMATCH,
      409,
      'Photo upload could not be consumed'
    )
  }
  await insertGpsAttempt(db, {
    studentId: actor.id,
    sessionId,
    roomId: session.roomId,
    ...coordinates,
    calculatedDistance: evaluation.distance,
    validationPolicy: policy,
    result: 'accepted',
    rejectionReason: null,
    attemptedAt: now,
    attendanceId: attendance.id
  })
  await attachAcceptedAttempt(db, {
    studentId: actor.id,
    sessionId,
    attendanceId: attendance.id
  })
  return {
    attendance: {
      id: attendance.id,
      sessionName: session.name,
      roomName: session.roomName,
      timestamp: attendance.attendanceTimestamp.toISOString(),
      status: attendance.status
    }
  }
}
