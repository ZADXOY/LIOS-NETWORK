import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { sanitizeUser, legionCooldownRemaining } from '@/lib/auth'

/** Update the legion cooldown timestamp (called when a user leaves a legion). */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const token = body?.token

    if (!token) {
      return NextResponse.json({ error: 'No token provided.' }, { status: 401 })
    }

    const user = await db.user.findFirst({ where: { sessionToken: token } })
    if (!user || !user.verified) {
      return NextResponse.json({ error: 'Invalid token.' }, { status: 401 })
    }

    // Set legionLeftAt to now
    const updated = await db.user.update({
      where: { id: user.id },
      data: { legionLeftAt: new Date() },
    })

    return NextResponse.json({
      user: sanitizeUser(updated),
      cooldownMs: legionCooldownRemaining(updated.legionLeftAt),
    })
  } catch (err) {
    console.error('[update-cooldown] error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to update cooldown' },
      { status: 500 },
    )
  }
}
