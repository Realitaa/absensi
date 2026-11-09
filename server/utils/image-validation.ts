/**
 * Selfie upload configuration and image content validation (FR-UPLOAD-02).
 *
 * SRS requires the allowed formats and maximum size to be configurable.
 * Values are intentionally fail-closed: invalid configuration keeps the
 * conservative defaults instead of accepting arbitrary input.
 */

export interface SelfieUploadConfig {
  maxBytes: number
  allowed: Array<{ mime: string; extension: string }>
}

export const DEFAULT_MAX_SELFIE_BYTES = 5 * 1024 * 1024
export const DEFAULT_ALLOWED_IMAGE_TYPES = [
  { mime: 'image/jpeg', extension: 'jpg' },
  { mime: 'image/png', extension: 'png' }
] as const

type ImageEnv = {
  SELFIE_MAX_BYTES?: string
  SELFIE_MAX_SIZE_BYTES?: string
  SELFIE_ALLOWED_MIME_TYPES?: string
  SELFIE_ALLOWED_FORMATS?: string
}

function envValue(name: string): string | undefined {
  const value = process.env?.[name]
  return value === undefined || value.trim() === '' ? undefined : value.trim()
}

function parseMaxBytes(env: ImageEnv): number {
  const raw =
    env.SELFIE_MAX_BYTES ??
    env.SELFIE_MAX_SIZE_BYTES ??
    envValue('SELFIE_MAX_BYTES') ??
    envValue('SELFIE_MAX_SIZE_BYTES')
  if (raw === undefined) return DEFAULT_MAX_SELFIE_BYTES
  const parsed = Number(raw)
  if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_MAX_SELFIE_BYTES
  return Math.floor(parsed)
}

export function getSelfieUploadConfig(env?: ImageEnv): SelfieUploadConfig {
  const source: ImageEnv = env ?? {
    SELFIE_MAX_BYTES: envValue('SELFIE_MAX_BYTES'),
    SELFIE_MAX_SIZE_BYTES: envValue('SELFIE_MAX_SIZE_BYTES'),
    SELFIE_ALLOWED_MIME_TYPES: envValue('SELFIE_ALLOWED_MIME_TYPES'),
    SELFIE_ALLOWED_FORMATS: envValue('SELFIE_ALLOWED_FORMATS')
  }
  const raw = source.SELFIE_ALLOWED_MIME_TYPES ?? source.SELFIE_ALLOWED_FORMATS
  if (!raw) {
    return {
      maxBytes: parseMaxBytes(source),
      allowed: DEFAULT_ALLOWED_IMAGE_TYPES.map(x => ({ ...x }))
    }
  }
  const mimes = Array.from(
    new Set(
      raw
        .split(',')
        .map(x => x.trim().toLowerCase())
        .filter(x => x.startsWith('image/'))
    )
  )
  const extensionMap: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/jpg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp'
  }
  const allowed = mimes
    .map(mime => {
      if (mime === 'image/jpg') mime = 'image/jpeg'
      const extension = extensionMap[mime]
      return extension ? { mime, extension } : null
    })
    .filter((x): x is { mime: string; extension: string } => x !== null)
  return {
    maxBytes: parseMaxBytes(source),
    allowed:
      allowed.length > 0
        ? allowed
        : DEFAULT_ALLOWED_IMAGE_TYPES.map(x => ({ ...x }))
  }
}

export type DetectedImageType =
  | (typeof DEFAULT_ALLOWED_IMAGE_TYPES)[number]
  | { mime: string; extension: string }

function hasBytes(bytes: Uint8Array, signature: number[], offset = 0) {
  if (bytes.length < offset + signature.length) return false
  for (let i = 0; i < signature.length; i++) {
    if (bytes[offset + i] !== signature[i]) return false
  }
  return true
}

function isJpeg(bytes: Uint8Array) {
  if (!hasBytes(bytes, [0xff, 0xd8, 0xff])) return false
  for (let i = bytes.length - 2; i >= 2; i--) {
    if (bytes[i] === 0xff && bytes[i + 1] === 0xd9) return true
  }
  return false
}

function isPng(bytes: Uint8Array) {
  if (!hasBytes(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
    return false
  }
  const iend = [
    0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82
  ]
  if (bytes.length < iend.length) return false
  for (let i = bytes.length - iend.length; i < bytes.length; i++) {
    if (bytes[i] !== iend[i - (bytes.length - iend.length)]) return false
  }
  return true
}

function isWebp(bytes: Uint8Array) {
  return (
    hasBytes(bytes, [0x52, 0x49, 0x46, 0x46]) &&
    hasBytes(bytes, [0x57, 0x45, 0x42, 0x50], 8)
  )
}

/** Detect only the signed formats known to the server. */
export function detectImageType(
  bytes: Uint8Array,
  config: SelfieUploadConfig
): DetectedImageType | null {
  const supported = new Set(config.allowed.map(x => x.mime))
  if (supported.has('image/jpeg') && isJpeg(bytes)) {
    return { mime: 'image/jpeg', extension: 'jpg' }
  }
  if (supported.has('image/png') && isPng(bytes)) {
    return { mime: 'image/png', extension: 'png' }
  }
  if (supported.has('image/webp') && isWebp(bytes)) {
    return { mime: 'image/webp', extension: 'webp' }
  }
  return null
}
