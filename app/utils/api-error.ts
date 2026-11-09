// Error code strings MUST match shared/error-codes.ts. Duplicated here
// (not imported) because Nitro bundles client chunks without access to
// project-root `shared/` (Cannot resolve shared/error-codes.ts).
// Keep in sync manually — codes are stable by design.

const ErrorCodes = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',
  ROOM_IN_USE: 'ROOM_IN_USE',
  SESSION_IN_USE: 'SESSION_IN_USE',
  SESSION_NOT_EDITABLE: 'SESSION_NOT_EDITABLE',
  CAPTURE_EXPIRED: 'CAPTURE_EXPIRED',
  CAPTURE_MISMATCH: 'CAPTURE_MISMATCH',
  CAPTURE_INCOMPLETE: 'CAPTURE_INCOMPLETE',
  SESSION_CLOSED: 'SESSION_CLOSED',
  SESSION_NOT_OPEN: 'SESSION_NOT_OPEN',
  OUTSIDE_GEOFENCE: 'OUTSIDE_GEOFENCE',
  DUPLICATE_ATTENDANCE: 'DUPLICATE_ATTENDANCE',
  INVALID_SESSION_WINDOW: 'INVALID_SESSION_WINDOW',
  GPS_UNAVAILABLE: 'GPS_UNAVAILABLE',
  STORAGE_ERROR: 'STORAGE_ERROR',
  INTERNAL_ERROR: 'INTERNAL_ERROR'
} as const

type ErrorCode = (typeof ErrorCodes)[keyof typeof ErrorCodes]

const FALLBACK = 'Terjadi kesalahan. Coba lagi nanti.'

const MESSAGE_MAP: Partial<Record<ErrorCode, string>> = {
  [ErrorCodes.VALIDATION_ERROR]: 'Username/NIM dan kata sandi wajib diisi.',
  [ErrorCodes.INVALID_CREDENTIALS]: 'Username/NIM atau kata sandi salah.',
  [ErrorCodes.UNAUTHORIZED]: 'Sesi berakhir. Silakan masuk kembali.',
  [ErrorCodes.FORBIDDEN]: 'Anda tidak memiliki akses ke halaman ini.',
  [ErrorCodes.NOT_FOUND]: 'Data tidak ditemukan.',
  [ErrorCodes.CONFLICT]: 'Data sudah ada atau sedang digunakan.',
  [ErrorCodes.ROOM_IN_USE]:
    'Ruangan tidak dapat dihapus karena masih digunakan oleh sesi absensi.',
  [ErrorCodes.SESSION_IN_USE]:
    'Sesi tidak dapat dihapus karena sudah memiliki catatan absensi.',
  [ErrorCodes.SESSION_NOT_EDITABLE]:
    'Sesi yang sudah ditutup tidak dapat diubah.',
  [ErrorCodes.CAPTURE_EXPIRED]: 'Tautan absensi sudah kedaluwarsa.',
  [ErrorCodes.CAPTURE_MISMATCH]: 'Tautan absensi tidak valid.',
  [ErrorCodes.CAPTURE_INCOMPLETE]: 'Data absensi belum lengkap.',
  [ErrorCodes.SESSION_CLOSED]: 'Sesi absensi sudah ditutup.',
  [ErrorCodes.SESSION_NOT_OPEN]: 'Sesi absensi belum dibuka.',
  [ErrorCodes.OUTSIDE_GEOFENCE]:
    'Anda berada di luar radius lokasi yang diizinkan.',
  [ErrorCodes.DUPLICATE_ATTENDANCE]:
    'Anda sudah mengisi absensi untuk sesi ini.',
  [ErrorCodes.INVALID_SESSION_WINDOW]: 'Waktu sesi tidak valid.',
  [ErrorCodes.GPS_UNAVAILABLE]:
    'Lokasi GPS tidak tersedia. Periksa izin lokasi Anda.',
  [ErrorCodes.STORAGE_ERROR]: 'Gagal menyimpan foto. Coba lagi nanti.',
  [ErrorCodes.INTERNAL_ERROR]: FALLBACK
}

function extractCode(err: unknown): ErrorCode | undefined {
  const candidate = (err as { data?: { error?: { code?: unknown } } })?.data
    ?.error?.code
  if (typeof candidate === 'string' && candidate in ErrorCodes) {
    return candidate as ErrorCode
  }
  return undefined
}

export function getApiErrorMessage(err: unknown): string {
  const code = extractCode(err)
  return code ? (MESSAGE_MAP[code] ?? FALLBACK) : FALLBACK
}

export function getApiErrorCode(err: unknown): ErrorCode | undefined {
  return extractCode(err)
}
