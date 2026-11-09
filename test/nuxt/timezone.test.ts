import { describe, expect, it } from 'vitest'
import { parseInstant, toLocalInputValue } from '../../shared/utils/timezone'

describe('parseInstant (Asia/Jakarta wall-clock)', () => {
  it('parses offset-less string as Jakarta wall-clock', () => {
    const d = parseInstant('2026-11-10T08:00:00', 'Asia/Jakarta')!
    expect(d.toISOString()).toBe('2026-11-10T01:00:00.000Z')
  })

  it('parses Z and offset strings as instants', () => {
    expect(
      parseInstant('2026-11-10T08:00:00Z', 'Asia/Jakarta')!.toISOString()
    ).toBe('2026-11-10T08:00:00.000Z')
    expect(
      parseInstant('2026-11-10T08:00:00+07:00', 'Asia/Jakarta')!.toISOString()
    ).toBe('2026-11-10T01:00:00.000Z')
  })

  it('round-trips through toLocalInputValue', () => {
    const d = parseInstant('2026-11-10T08:00:00', 'Asia/Jakarta')!
    expect(toLocalInputValue(d, 'Asia/Jakarta')).toBe('2026-11-10T08:00')
  })

  it('rejects impossible dates', () => {
    expect(parseInstant('2026-13-40T99:99:00', 'Asia/Jakarta')).toBeNull()
    expect(parseInstant('not-a-date', 'Asia/Jakarta')).toBeNull()
  })
})
