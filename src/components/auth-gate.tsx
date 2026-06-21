'use client'

import { useState, useEffect } from 'react'
import { Flame, Loader2, Mail, Lock, User, ShieldCheck, AlertCircle, Radio } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { AuthUser } from '@/lib/chat-types'

const TOKEN_KEY = 'island-token'

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
            src="/island-logo.png"
            alt="Last Island logo"
            className="mx-auto mb-4 h-20 w-20 rounded-md object-cover ring-2 ring-primary/40 shadow-2xl ember-flicker"
          />
          <div className="mb-1 inline-flex items-center gap-1.5 rounded-sm border border-primary/30 bg-primary/10 px-2 py-0.5 text-[10px] mono-header text-primary">
            <Radio className="h-2.5 w-2.5" />
            Survivor Comms Network
          </div>
          <h1 className="text-3xl font-bold tracking-tight mono-header">
            Last <span className="text-primary">Island</span>
          </h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Coordinate. Trade. Raid. Survive the island together.
          </p>
        </div>

        {/* Mode toggle */}
        <div className="mb-4 flex rounded-sm border border-border bg-card/40 p-0.5">
          <button
            type="button"
            onClick={() => { setMode('login'); setError(null); setInfo(null) }}
            className={`flex-1 rounded-sm py-2 text-sm font-medium mono-header transition-colors ${
              mode === 'login' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Log In
          </button>
          <button
            type="button"
            onClick={() => { setMode('signup'); setError(null); setInfo(null) }}
            className={`flex-1 rounded-sm py-2 text-sm font-medium mono-header transition-colors ${
              mode === 'signup' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Sign Up
          </button>
        </div>

        <form onSubmit={handleSubmit} className="rounded-md border border-border bg-card/80 p-6 backdrop-blur shadow-2xl space-y-4">
          {mode === 'signup' && (
            <div className="space-y-2">
              <Label htmlFor="username" className="mono-header text-xs">Survivor Name</Label>
              <div className="relative">
                <User className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="e.g. WastelandWolf"
                  maxLength={24}
                  className="pl-9 rounded-sm"
                  autoComplete="username"
                />
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="email" className="mono-header text-xs">Email</Label>
            <div className="relative">
              <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="survivor@example.com"
                className="pl-9 rounded-sm"
                autoComplete="email"
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="password" className="mono-header text-xs">Password</Label>
            <div className="relative">
              <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 6 characters"
                className="pl-9 rounded-sm"
                autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                required
              />
            </div>
          </div>

          {error && (
            <div className="flex items-start gap-2 rounded-sm border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {info && (
            <div className="flex items-start gap-2 rounded-sm border border-primary/40 bg-primary/10 p-3 text-sm text-primary">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{info}</span>
            </div>
          )}

          <Button type="submit" disabled={loading} className="h-11 w-full rounded-sm mono-header">
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {mode === 'signup' ? 'Creating Account…' : 'Connecting…'}
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
              New accounts require admin verification before login. Admin:{' '}
              <span className="font-mono text-primary">zadxoy@gmail.com</span>
            </p>
          )}
        </form>

        <div className="mt-6 grid grid-cols-2 gap-2 text-center text-xs text-muted-foreground">
          <div className="rounded-sm border border-border bg-card/40 p-3">
            <div className="mb-1 text-lg">📡</div>
            <span className="mono-header text-[10px]">7 Radio Channels</span>
          </div>
          <div className="rounded-sm border border-border bg-card/40 p-3">
            <div className="mb-1 text-lg">🛡️</div>
            <span className="mono-header text-[10px]">Legion System</span>
          </div>
        </div>

        <p className="mt-6 text-center text-[11px] text-muted-foreground mono-header">
          Stay alert. The island never sleeps.
        </p>
      </div>
    </div>
  )
}

export { TOKEN_KEY }
