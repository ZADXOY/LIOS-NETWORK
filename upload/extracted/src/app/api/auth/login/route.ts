import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { verifyPassword, generateToken, sanitizeUser } from '@/lib/auth'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const email = (body?.email || '').toString().trim().toLowerCase()
    const password = (body?.password || '').toString()

    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password are required.' }, { status: 400 })
    }

    const user = await db.user.findUnique({ where: { email } })
    if (!user) {
      return NextResponse.json({ error: 'Invalid email or password.' }, { status: 401 })
    }

    if (!verifyPassword(password, user.passwordHash)) {
      return NextResponse.json({ error: 'Invalid email or password.' }, { status: 401 })
    }

    if (!user.verified) {
      return NextResponse.json({
        error: 'Your email has not been verified yet. An admin must approve your account before you can log in.',
        verified: false,
      }, { status: 403 })
    }

    // Refresh session token on each login
    const token = generateToken()
    await db.user.update({
      where: { id: user.id },
      data: { sessionToken: token },
    })

    return NextResponse.json({
      user: sanitizeUser({ ...user, sessionToken: token }),
      token,
    })
  } catch (err) {
    console.error('[login] error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Login failed' },
      { status: 500 },
    )
  }
}
