import { scryptSync, randomBytes, timingSafeEqual } from 'crypto'
import { db } from '@/lib/db'

const ADMIN_EMAIL = 'zadxoy@gmail.com'
const COOLDOWN_MS = 24 * 60 * 60 * 1000 // 24 hours

/** Hash a password using scrypt with a random salt. */
export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex')
  const hash = scryptSync(password, salt, 64).toString('hex')
  return `${salt}:${hash}`
}

/** Verify a password against a stored salt:hash string. */
export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(':')
  if (!salt || !hash) return false
  const hashBuf = Buffer.from(hash, 'hex')
  const testBuf = scryptSync(password, salt, 64)
  if (hashBuf.length !== testBuf.length) return false
  return timingSafeEqual(hashBuf, testBuf)
}

/** Generate a random session token. */
export function generateToken(): string {
  return randomBytes(32).toString('hex')
}

/** Public-safe user object (no password hash). */
export function sanitizeUser(user: {
  id: string
  email: string
  username: string
  verified: boolean
  isAdmin: boolean
  legionLeftAt: Date | null
  inGameLegionId: string | null
  sessionToken: string | null
  createdAt: Date
}) {
  return {
    id: user.id,
    email: user.email,
    username: user.username,
    verified: user.verified,
    isAdmin: user.isAdmin,
    legionLeftAt: user.legionLeftAt,
    inGameLegionId: user.inGameLegionId,
    createdAt: user.createdAt,
  }
}

/** Check if a user is still in the 24h legion join cooldown. Returns null if clear, or the ms remaining. */
export function legionCooldownRemaining(legionLeftAt: Date | null): number | null {
  if (!legionLeftAt) return null
  const elapsed = Date.now() - legionLeftAt.getTime()
  if (elapsed >= COOLDOWN_MS) return null
  return COOLDOWN_MS - elapsed
}

export { ADMIN_EMAIL, COOLDOWN_MS }
