/**
 * Centralized application timezone handling (SRS §4.2).
 *
 * DB storage is UTC (unix seconds). Display/session evaluation converts
 * via APP_TIMEZONE. Default Asia/Jakarta; env override wins, validated.
 */

export const APP_TIMEZONE_DEFAULT = 'Asia/Jakarta'

export function getAppTimezone(explicit?: string | null): string {
  const value =
    explicit !== undefined && explicit !== null && explicit !== ''
      ? explicit
      : process.env?.APP_TIMEZONE || APP_TIMEZONE_DEFAULT
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: value })
  } catch {
    return APP_TIMEZONE_DEFAULT
  }
  return value
}

/** offset = localAsUTC - utc, in ms (e.g. +7h for Asia/Jakarta). */
function tzOffsetMs(timeZone: string, date: Date): number {
  const parts: Record<string, number> = {}
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  })
  for (const part of dtf.formatToParts(date)) {
    if (part.type === 'literal') continue
    parts[part.type] = Number.parseInt(part.value, 10)
  }
  if (parts.hour === 24) parts.hour = 0
  const asLocalAsUtc = Date.UTC(
    parts.year!,
    parts.month! - 1,
    parts.day!,
    parts.hour!,
    parts.minute!,
    parts.second!
  )
  return asLocalAsUtc - Math.floor(date.getTime() / 1000) * 1000
}

/**
 * Parse an ISO-8601 datetime into an authoritative UTC instant.
 *
 * - Strings with Z or numeric offset are used as-is (parsed by Date).
 * - Offset-less strings (browser `datetime-local` value) are wall-clock
 *   in the app timezone, converted via Intl offset computation.
 * - Accepts Date or finite epoch number (seconds or ms).
 */
export function parseInstant(
  value: unknown,
  timeZone: string = getAppTimezone()
): Date | null {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value
  }
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return null
    const ms = Math.abs(value) < 1e11 ? value * 1000 : value
    const d = new Date(ms)
    return Number.isNaN(d.getTime()) ? null : d
  }
  if (typeof value !== 'string') return null
  const s = value.trim()
  if (!s) return null

  // Has explicit zone designator -> standard parse.
  if (/([zZ]|([+-]\d{2}:?\d{2}))$/.test(s)) {
    const d = new Date(s)
    return Number.isNaN(d.getTime()) ? null : d
  }

  const m = s.match(
    /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2})(?:\.(\d+))?)?$/
  )
  if (!m) {
    const d = new Date(s)
    return Number.isNaN(d.getTime()) ? null : d
  }
  const year = Number(m[1])
  const month = Number(m[2])
  const day = Number(m[3])
  const hour = Number(m[4])
  const minute = Number(m[5])
  const sec = m[6] ? Number(m[6]) : 0
  const ms = m[7] ? Number(m[7].padEnd(3, '0').slice(0, 3)) : 0
  // Reject impossible calendar values.
  const probe = new Date(Date.UTC(year, month - 1, day, hour, minute, sec))
  if (
    probe.getUTCFullYear() !== year ||
    probe.getUTCMonth() !== month - 1 ||
    probe.getUTCDate() !== day ||
    probe.getUTCHours() !== hour ||
    probe.getUTCMinutes() !== minute ||
    probe.getUTCSeconds() !== sec
  ) {
    return null
  }
  const utcGuess = Date.UTC(year, month - 1, day, hour, minute, sec)
  const off1 = tzOffsetMs(timeZone, new Date(utcGuess))
  const utc2 = utcGuess - off1
  const off2 = tzOffsetMs(timeZone, new Date(utc2))
  const offset = off2 !== off1 ? off2 : off1
  const d = new Date(utcGuess - offset + ms)
  return Number.isNaN(d.getTime()) ? null : d
}

/**
 * Convert a stored instant to an `<input type="datetime-local">` value
 * showing wall-clock time in the app timezone (no zone suffix).
 */
export function toLocalInputValue(
  value: Date | string | number,
  timeZone: string = 'Asia/Jakarta'
): string {
  const d = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(d.getTime())) return ''
  const parts: Record<string, string> = {}
  const dtf = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })
  for (const part of dtf.formatToParts(d)) {
    if (part.type === 'literal') continue
    parts[part.type] = part.value
  }
  const hour = parts.hour === '24' ? '00' : parts.hour!
  return `${parts.year}-${parts.month}-${parts.day}T${hour}:${parts.minute}`
}

/** Indonesian display string in the app timezone. */
export function formatInTimezone(
  value: Date | string | number | null | undefined,
  timeZone: string = 'Asia/Jakarta'
): string {
  if (value === null || value === undefined || value === '') return '-'
  const d = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(d.getTime())) return '-'
  return new Intl.DateTimeFormat('id-ID', {
    timeZone,
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(d)
}
