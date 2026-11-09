const APP_TIMEZONE = 'Asia/Jakarta'

const INDONESIAN_DATE_TIME_FORMATTER = new Intl.DateTimeFormat('id-ID', {
  timeZone: APP_TIMEZONE,
  dateStyle: 'medium',
  timeStyle: 'short'
})

export function formatDateIndonesia(
  value: Date | string | number | null | undefined
): string {
  if (value === null || value === undefined || value === '') return '-'

  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return '-'

  return INDONESIAN_DATE_TIME_FORMATTER.format(date)
}

/** Offset of `timeZone` at instant `date`, in ms (localAsUTC - utc). */
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
 * Parse an offset-less `datetime-local` string as wall-clock in
 * APP_TIMEZONE and return an ISO UTC string. Strings with Z/offset
 * pass through standard parsing.
 */
export function parseLocalToIsoUtc(local: string): string | null {
  const s = local.trim()
  if (!s) return null
  if (/([zZ]|([+-]\d{2}:?\d{2}))$/.test(s)) {
    const d = new Date(s)
    return Number.isNaN(d.getTime()) ? null : d.toISOString()
  }
  const m = s.match(
    /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2})(?:\.(\d+))?)?$/
  )
  if (!m) {
    const d = new Date(s)
    return Number.isNaN(d.getTime()) ? null : d.toISOString()
  }
  const year = Number(m[1])
  const month = Number(m[2])
  const day = Number(m[3])
  const hour = Number(m[4])
  const minute = Number(m[5])
  const sec = m[6] ? Number(m[6]) : 0
  const ms = m[7] ? Number(m[7].padEnd(3, '0').slice(0, 3)) : 0
  const utcGuess = Date.UTC(year, month - 1, day, hour, minute, sec)
  const off1 = tzOffsetMs(APP_TIMEZONE, new Date(utcGuess))
  const utc2 = utcGuess - off1
  const off2 = tzOffsetMs(APP_TIMEZONE, new Date(utc2))
  const offset = off2 !== off1 ? off2 : off1
  return new Date(utcGuess - offset + ms).toISOString()
}

/** Convert a stored instant to a `datetime-local` value in APP_TIMEZONE. */
export function toLocalInputValue(
  value: Date | string | number,
  timeZone = APP_TIMEZONE
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
