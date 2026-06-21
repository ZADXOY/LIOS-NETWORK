import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { hashPassword, generateToken, sanitizeUser, ADMIN_EMAIL } from '@/lib/auth'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const email = (body?.email || '').toString().trim().toLowerCase()
    const username = (body?.username || '').toString().trim()
    const password = (body?.password || '').toString()

    if (!email || !email.includes('@')) {
      return NextResponse.json({ error: 'A valid email is required.' }, { status: 400 })
    }
    if (!username || username.length < 2 || username.length > 24) {
      return NextResponse.json({ error: 'Username must be 2-24 characters.' }, { status: 400 })
    }
    if (!password || password.length < 6) {
      return NextResponse.json({ error: 'Password must be at least 6 characters.' }, { status: 400 })
    }

    // Check for existing email or username
    const existing = await db.user.findFirst({
      where: {
        OR: [{ email }, { username }],
      },
    })
    if (existing) {
      if (existing.email === email) {
        return NextResponse.json({ error: 'An account with this email already exists.' }, { status: 409 })
      }
      return NextResponse.json({ error: 'This username is already taken.' }, { status: 409 })
    }

    // The admin email is auto-verified + gets admin privileges
    const isAdminEmail = email === ADMIN_EMAIL

    const user = await db.user.create({
      data: {
        email,
        username,
        passwordHash: hashPassword(password),
        verified: isAdminEmail, // admin auto-verified
        isAdmin: isAdminEmail,
        sessionToken: generateToken(),
      },
    })

    return NextResponse.json({
      user: sanitizeUser(user),
      token: user.sessionToken,
      message: isAdminEmail
        ? 'Admin account created. You are verified.'
        : 'Account created. An admin must verify your email before you can log in.',
    })
  } catch (err) {
    console.error('[signup] error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Signup failed' },
      { status: 500 },
    )
  }
}
