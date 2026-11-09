import { describe, it, expect } from 'vitest'
import {
  hashPassword,
  verifyPassword,
  ARGON2_MEMORY_KIB,
  ARGON2_ITERATIONS,
  ARGON2_PARALLELISM,
  ARGON2_VERSION
} from '../../server/lib/password'

describe('password hashing (Argon2id)', () => {
  it('produces hash in expected PHC format with default parameters', async () => {
    const hash = await hashPassword('password123')
    expect(ARGON2_VERSION).toBe(19)
    expect(ARGON2_MEMORY_KIB).toBe(19456)
    expect(ARGON2_ITERATIONS).toBe(2)
    expect(ARGON2_PARALLELISM).toBe(1)
    expect(hash.startsWith('$argon2id$v=19$m=19456,t=2,p=1$')).toBe(true)
    const parts = hash.split('$')
    expect(parts).toHaveLength(6)
    expect(parts[1]).toBe('argon2id')
    expect(parts[2]).toBe('v=19')
    expect(parts[3]).toBe('m=19456,t=2,p=1')
    expect(parts[4]).toBeTruthy()
    expect(parts[5]).toBeTruthy()
  })

  it('verifies correct password', async () => {
    const hash = await hashPassword('correct-password')
    await expect(verifyPassword('correct-password', hash)).resolves.toBe(true)
  })

  it('rejects wrong password', async () => {
    const hash = await hashPassword('correct-password')
    await expect(verifyPassword('wrong-password', hash)).resolves.toBe(false)
  })

  it('produces different hashes for same password due to random salt', async () => {
    const hash1 = await hashPassword('same-password')
    const hash2 = await hashPassword('same-password')
    expect(hash1).not.toBe(hash2)
    await expect(verifyPassword('same-password', hash1)).resolves.toBe(true)
    await expect(verifyPassword('same-password', hash2)).resolves.toBe(true)
  })

  it('returns false for malformed stored hashes', async () => {
    await expect(verifyPassword('pw', 'not-a-hash')).resolves.toBe(false)
    await expect(verifyPassword('pw', '')).resolves.toBe(false)
    await expect(
      verifyPassword('pw', '$argon2id$v=19$m=19456,t=2,p=1$bad$bad')
    ).resolves.toBe(false)
    await expect(verifyPassword('pw', 'argon2$something')).resolves.toBe(false)
  })

  it('roundtrips with default parameters', async () => {
    const hash = await hashPassword('default-params-password')
    await expect(verifyPassword('default-params-password', hash)).resolves.toBe(
      true
    )
    await expect(verifyPassword('wrong-password', hash)).resolves.toBe(false)
  })
})
