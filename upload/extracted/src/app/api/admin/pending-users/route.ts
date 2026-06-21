import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { sanitizeUser, ADMIN_EMAIL } from '@/lib/auth'

/** List all unverified users (admin only). */
export async function GET(req: NextRequest) {
  try {
    const token = req.headers.get('authorization')?.replace('Bearer ', '')
    if (!token) {
      return NextResponse.json({ error: 'No token provided.' }, { status: 401 })
    }

    const admin = await db.user.findFirst({ where: { sessionToken: token } })
    if (!admin || !admin.verified || !admin.isAdmin || admin.email !== ADMIN_EMAIL) {
      return NextResponse.json({ error: 'Admin access required.' }, { status: 403 })
    }

    const pending = await db.user.findMany({
      where: { verified: false },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({
      users: pending.map(sanitizeUser),
    })
  } catch (err) {
    console.error('[pending-users] error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to fetch pending users' },
      { status: 500 },
    )
  }
}
