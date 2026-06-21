import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { sanitizeUser, ADMIN_EMAIL } from '@/lib/auth'

/** Verify (approve) or reject (delete) a user account. */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const token = body?.token
    const userId = body?.userId
    const action = body?.action // 'verify' | 'reject'

    if (!token || !userId || !action) {
      return NextResponse.json({ error: 'Missing token, userId, or action.' }, { status: 400 })
    }

    const admin = await db.user.findFirst({ where: { sessionToken: token } })
    if (!admin || !admin.verified || !admin.isAdmin || admin.email !== ADMIN_EMAIL) {
      return NextResponse.json({ error: 'Admin access required.' }, { status: 403 })
    }

    const target = await db.user.findUnique({ where: { id: userId } })
    if (!target) {
      return NextResponse.json({ error: 'User not found.' }, { status: 404 })
    }
    if (target.email === ADMIN_EMAIL) {
      return NextResponse.json({ error: 'Cannot modify the admin account.' }, { status: 400 })
    }

    if (action === 'verify') {
      const updated = await db.user.update({
        where: { id: userId },
        data: { verified: true },
      })
      return NextResponse.json({ user: sanitizeUser(updated), action: 'verified' })
    }

    if (action === 'reject') {
      await db.user.delete({ where: { id: userId } })
      return NextResponse.json({ userId, action: 'rejected' })
    }

    return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 })
  } catch (err) {
    console.error('[verify-user] error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to update user' },
      { status: 500 },
    )
  }
}
