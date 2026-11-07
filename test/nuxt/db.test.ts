import { describe, it, expect } from 'vitest'
import { eq } from 'drizzle-orm'
import { userFactory } from '../../server/db/factories/user.factory'
import { roomFactory } from '../../server/db/factories/room.factory'
import { users } from '../../server/db/schema/users'
import { rooms } from '../../server/db/schema/rooms'
import { attendances } from '../../server/db/schema/attendances'
import { createDb } from '../../server/db/index'

function createMockD1() {
  // Tiny in-memory D1 stub covering the statements used by the seeders under test.
  // Full integration against real D1 is covered by `pnpm db:migrate && pnpm db:seed`.
  return {
    prepare: (_sql: string) => ({
      bind: () => ({
        all: async () => ({
          results: [],
          success: true,
          meta: { rows_read: 0, rows_written: 0 }
        }),
        first: async () => null,
        run: async () => ({
          success: true,
          meta: { rows_read: 0, rows_written: 0, last_row_id: 0, changes: 0 }
        }),
        raw: async () => []
      }),
      all: async () => ({ results: [] }),
      first: async () => null,
      run: async () => ({ success: true, meta: {} }),
      raw: async () => []
    }),
    batch: async (statements: unknown[]) =>
      statements.map(() => ({ success: true, meta: {} })),
    exec: async (_sql: string) => ({ count: 0, duration: 0 }),
    dump: async () => new ArrayBuffer(0)
  } as unknown as Parameters<typeof createDb>[0]
}

describe('db factories', () => {
  it('userFactory respects overrides and generates student nim', () => {
    const student = userFactory({ role: 'student' })
    expect(student.role).toBe('student')
    expect(student.nim).not.toBeNull()

    const lecturer = userFactory({ role: 'lecturer', username: 'custom' })
    expect(lecturer.username).toBe('custom')
    expect(lecturer.nim).toBeNull()
  })

  it('roomFactory generates accorinding radius within ERD max 20m', () => {
    const room = roomFactory()
    expect(room.radius).toBeGreaterThanOrEqual(5)
    expect(room.radius).toBeLessThanOrEqual(20)
  })

  it('mock db can be created via createDb', () => {
    const db = createDb(createMockD1())
    expect(db).toBeDefined()
    expect(users).toBeDefined()
    expect(rooms).toBeDefined()
    expect(attendances).toBeDefined()
    // eq helper works against schema columns (used by seeders for idempotent lookups)
    expect(eq(users.username, 'admin')).toBeDefined()
  })
})
