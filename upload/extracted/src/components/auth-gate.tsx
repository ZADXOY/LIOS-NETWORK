'use client'

import { useState, useEffect } from 'react'
import { Flame, Loader2, Mail, Lock, User, ShieldCheck, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { AuthUser } from '@/lib/chat-types'

const TOKEN_KEY = 'lis-chat-token'

interface Props {
  onAuthed: (user: AuthUser, token: string) => void
}

export function AuthGate({ onAuthed }: Props) {
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [email, setEmail] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)

  // Try to restore session from stored token
  useEffect(() => {
    const token = localStorage.getItem(TOKEN_KEY)
    if (!token) return
    setLoading(true)
    fetch(`/api/auth/verify-token?token=${encodeURIComponent(token)}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.user && !data.error) {
          onAuthed(data.user, token)
        } else {
          localStorage.removeItem(TOKEN_KEY)
        }
      })
      .catch(() => {
        localStorage.removeItem(TOKEN_KEY)
      })
      .finally(() => setLoading(false))
  }, [onAuthed])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setInfo(null)

    if (mode === 'signup' && (!email || !username || !password)) {
      setError('All fields are required.')
      return
    }
    if (mode === 'login' && (!email || !password)) {
      setError('Email and password are required.')
      return
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.')
      return
    }

    setLoading(true)
    try {
      const endpoint = mode === 'signup' ? '/api/auth/signup' : '/api/auth/login'
      const body: Record<string, string> = { email: email.trim().toLowerCase(), password }
      if (mode === 'signup') body.username = username.trim()

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Something went wrong.')
        return
      }

      if (mode === 'signup') {
        // For signup, store token and authed user
        if (data.token && data.user) {
          localStorage.setItem(TOKEN_KEY, data.token)
          if (data.user.verified) {
            onAuthed(data.user, data.token)
          } else {
            setInfo(data.message || 'Account created. An admin must verify your email before you can log in.')
            setMode('login')
          }
        }
      } else {
        // Login success
        if (data.token && data.user) {
          localStorage.setItem(TOKEN_KEY, data.token)
          onAuthed(data.user, data.token)
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-island min-h-screen flex flex-col items-center justify-center px-4 text-foreground">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <img
            src="/app-logo.webp"
            alt="Last Island of Survival logo"
            className="mx-auto mb-4 h-16 w-16 rounded-2xl object-cover ring-1 ring-primary/40 shadow-lg"
          />
          <h1 className="text-2xl font-bold tracking-tight">Last Island of Survival</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Survivor Comms Hub — coordinate, trade, raid, survive.
          </p>
        </div>

        {/* Mode toggle */}
        <div className="mb-4 flex rounded-lg border border-border bg-card/40 p-1">
          <button
            type="button"
            onClick={() => { setMode('login'); setError(null); setInfo(null) }}
            className={`flex-1 rounded-md py-2 text-sm font-medium transition-colors ${
              mode === 'login' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Log In
          </button>
          <button
            type="button"
            onClick={() => { setMode('signup'); setError(null); setInfo(null) }}
            className={`flex-1 rounded-md py-2 text-sm font-medium transition-colors ${
              mode === 'signup' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Sign Up
          </button>
        </div>

        <form onSubmit={handleSubmit} className="rounded-xl border border-border bg-card/70 p-6 backdrop-blur shadow-xl space-y-4">
          {mode === 'signup' && (
            <div className="space-y-2">
              <Label htmlFor="username">Survivor name</Label>
              <div className="relative">
                <User className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="e.g. WastelandWolf"
                  maxLength={24}
                  className="pl-9"
                  autoComplete="username"
                />
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <div className="relative">
              <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="survivor@example.com"
                className="pl-9"
                autoComplete="email"
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <div className="relative">
              <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 6 characters"
                className="pl-9"
                autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                required
              />
            </div>
          </div>

          {error && (
            <div className="flex items-start gap-2 rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-300">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {info && (
            <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-200">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{info}</span>
            </div>
          )}

          <Button type="submit" disabled={loading} className="h-11 w-full">
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {mode === 'signup' ? 'Creating account…' : 'Logging in…'}
              </>
            ) : (
              <>
                <Flame className="mr-2 h-4 w-4" />
                {mode === 'signup' ? 'Create Account' : 'Enter the Island'}
              </>
            )}
          </Button>

          {mode === 'signup' && (
            <p className="text-center text-[11px] text-muted-foreground">
              New accounts require admin verification before you can log in. The admin email is{' '}
              <span className="font-mono text-amber-300">zadxoy@gmail.com</span>.
            </p>
          )}
        </form>

        <div className="mt-6 grid grid-cols-2 gap-2 text-center text-xs text-muted-foreground">
          <div className="rounded-lg border border-border bg-card/40 p-3">
            <div className="mb-1 text-lg">⚔️</div>
            Themed game channels
          </div>
          <div className="rounded-lg border border-border bg-card/40 p-3">
            <div className="mb-1 text-lg">🛡️</div>
            Legion system with tasks
          </div>
        </div>

        <p className="mt-6 text-center text-[11px] text-muted-foreground">
          By entering, you agree to keep chat respectful. No cheats, no spam, no grief.
        </p>
      </div>
    </div>
  )
}

export { TOKEN_KEY }
