import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { sanitizeUser, legionCooldownRemaining } from '@/lib/auth'

/** Validates a session token and returns the user (or 401). */
export async function GET(req: NextRequest) {
  try {
    const token = req.headers.get('authorization')?.replace('Bearer ', '') ||
                  new URL(req.url).searchParams.get('token')

    if (!token) {
      return NextResponse.json({ error: 'No token provided.' }, { status: 401 })
    }

    const user = await db.user.findFirst({ where: { sessionToken: token } })
    if (!user || !user.verified) {
      return NextResponse.json({ error: 'Invalid or expired token.' }, { status: 401 })
    }

    const cooldownMs = legionCooldownRemaining(user.legionLeftAt)

    return NextResponse.json({
      user: sanitizeUser(user),
      token,
      cooldownMs,
    })
  } catch (err) {
    console.error('[verify-token] error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Token verification failed' },
      { status: 500 },
    )
  }
}
