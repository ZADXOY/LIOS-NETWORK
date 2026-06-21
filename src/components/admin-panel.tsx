'use client'

import { useEffect, useState, useCallback } from 'react'
import { ShieldCheck, Check, X, Users, Flag, RefreshCw, Loader2, Clock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { useToast } from '@/hooks/use-toast'
import { LegionLogo } from '@/components/legion-onboarding'
import type { Legion, AuthUser } from '@/lib/chat-types'

interface PendingUser {
  id: string
  email: string
  username: string
  verified: boolean
  isAdmin: boolean
  createdAt: string
}

interface Props {
  user: AuthUser
  token: string
  onApproveLegion: (legionId: string) => void
  onRejectLegion: (legionId: string, reason?: string) => void
  pendingLegions?: Legion[]
  allLegions?: Legion[]
}

export function AdminPanel({
  user,
  token,
  onApproveLegion,
  onRejectLegion,
  pendingLegions: pendingLegionsProp,
  allLegions: allLegionsProp,
}: Props) {
  const { toast } = useToast()
  const [pendingUsers, setPendingUsers] = useState<PendingUser[]>([])
  const [loadingUsers, setLoadingUsers] = useState(false)

  // Use socket-emitted legion lists from props (real-time), fall back to empty
  const pendingLegions = pendingLegionsProp || []
  const allLegions = allLegionsProp || []

  // Poll for pending users from the API
  const refreshUsers = useCallback(async () => {
    setLoadingUsers(true)
    try {
      const res = await fetch('/api/admin/pending-users', {
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json()
      if (res.ok && data.users) {
        setPendingUsers(data.users)
      } else if (res.status === 403) {
        toast({ title: 'Admin access required', variant: 'destructive' })
      }
    } catch (err) {
      console.error('[admin] failed to fetch pending users:', err)
    } finally {
      setLoadingUsers(false)
    }
  }, [token, toast])

  // Approve or reject a user
  const handleUserAction = async (userId: string, action: 'verify' | 'reject') => {
    try {
      const res = await fetch('/api/admin/verify-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, userId, action }),
      })
      const data = await res.json()
      if (res.ok) {
        toast({
          title: action === 'verify' ? 'User verified' : 'User rejected',
          description: action === 'verify'
            ? `${data.user.username} can now log in.`
            : 'Account has been deleted.',
        })
        refreshUsers()
      } else {
        toast({ title: 'Action failed', description: data.error, variant: 'destructive' })
      }
    } catch (err) {
      toast({ title: 'Network error', variant: 'destructive' })
    }
  }

  // Initial load + polling for pending users
  useEffect(() => {
    refreshUsers()
    const interval = setInterval(refreshUsers, 10000)
    return () => clearInterval(interval)
  }, [refreshUsers])

  return (
    <div className="flex flex-1 flex-col overflow-hidden min-w-0 panel-in">
      {/* Header */}
      <div className="border-b border-border/60 px-3 sm:px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-lg bg-primary/20 text-primary">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div>
            <h2 className="font-semibold leading-tight">Admin Control Panel</h2>
            <p className="text-xs text-muted-foreground">
              Verify users · Approve squads · Manage the hearth
            </p>
          </div>
        </div>
      </div>

      <ScrollArea className="flex-1 scrollbar-hearth">
        <div className="mx-auto max-w-3xl space-y-6 p-3 sm:p-4">
          {/* Pending User Verifications */}
          <section className="rounded-xl border border-border bg-card/60 p-4">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="flex items-center gap-2 text-sm font-semibold">
                <Users className="h-4 w-4 text-primary" />
                Pending User Verifications
                <Badge variant="secondary" className="text-[10px]">{pendingUsers.length}</Badge>
              </h3>
              <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={refreshUsers} disabled={loadingUsers}>
                {loadingUsers ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <RefreshCw className="mr-1 h-3 w-3" />}
                Refresh
              </Button>
            </div>

            {pendingUsers.length === 0 ? (
              <p className="py-6 text-center text-xs text-muted-foreground">
                ✓ No pending user verifications. Everyone is verified.
              </p>
            ) : (
              <div className="space-y-2">
                {pendingUsers.map((u) => (
                  <div key={u.id} className="flex items-center gap-3 rounded-lg border border-border bg-background/40 p-3">
                    <div className="grid h-9 w-9 place-items-center rounded-md bg-muted/60 text-sm font-semibold">
                      {u.username.slice(0, 2).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-sm font-medium">{u.username}</span>
                        <span className="truncate text-xs text-muted-foreground">{u.email}</span>
                      </div>
                      <p className="text-[10px] text-muted-foreground">
                        Signed up {new Date(u.createdAt).toLocaleString()}
                      </p>
                    </div>
                    <div className="flex gap-1">
                      <Button
                        size="sm"
                        variant="default"
                        className="h-7 px-2 text-xs"
                        onClick={() => handleUserAction(u.id, 'verify')}
                      >
                        <Check className="mr-1 h-3 w-3" />
                        Verify
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 px-2 text-xs text-rose-400 hover:bg-rose-500/10"
                        onClick={() => handleUserAction(u.id, 'reject')}
                      >
                        <X className="mr-1 h-3 w-3" />
                        Reject
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <Separator />

          {/* Pending Legion Approvals */}
          <section className="rounded-xl border border-border bg-card/60 p-4">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="flex items-center gap-2 text-sm font-semibold">
                <Flag className="h-4 w-4 text-primary" />
                Pending Squad Approvals
                <Badge variant="secondary" className="text-[10px]">{pendingLegions.length}</Badge>
              </h3>
            </div>

            {pendingLegions.length === 0 ? (
              <p className="py-6 text-center text-xs text-muted-foreground">
                ✓ No squads awaiting approval.
              </p>
            ) : (
              <div className="space-y-2">
                {pendingLegions.map((l) => (
                  <div key={l.id} className="rounded-lg border border-primary/30 bg-primary/5 p-3">
                    <div className="flex items-start gap-3">
                      <LegionLogo icon={l.icon} iconType={l.iconType || 'emoji'} size={40} className="shrink-0" />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-semibold">{l.name}</span>
                          <span className="rounded bg-primary/20 px-1.5 py-0.5 text-[10px] font-mono font-bold text-primary">
                            [{l.tag}]
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground">{l.description}</p>
                        <div className="mt-1 flex items-center gap-3 text-[11px] text-muted-foreground">
                          <span>👤 Leader: {l.members[0]?.username || 'Unknown'}</span>
                          <span>✉️ {l.leaderEmail}</span>
                        </div>
                        <div className="mt-1 flex items-center gap-3 text-[11px]">
                          <span className="text-primary">🎮 In-game ID: {l.inGameLegionId}</span>
                          <span className="text-muted-foreground flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {new Date(l.createdAt).toLocaleString()}
                          </span>
                        </div>
                      </div>
                      <div className="flex flex-col gap-1 shrink-0">
                        <Button
                          size="sm"
                          variant="default"
                          className="h-7 px-2 text-xs"
                          onClick={() => onApproveLegion(l.id)}
                        >
                          <Check className="mr-1 h-3 w-3" />
                          Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 px-2 text-xs text-rose-400 hover:bg-rose-500/10"
                          onClick={() => onRejectLegion(l.id)}
                        >
                          <X className="mr-1 h-3 w-3" />
                          Reject
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <Separator />

          {/* All Legions Overview */}
          <section className="rounded-xl border border-border bg-card/60 p-4">
            <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold">
              <Flag className="h-4 w-4 text-accent" />
              All Squads
              <Badge variant="secondary" className="text-[10px]">{allLegions.length}</Badge>
            </h3>

            {allLegions.length === 0 ? (
              <p className="py-6 text-center text-xs text-muted-foreground">
                No squads exist yet.
              </p>
            ) : (
              <div className="space-y-2">
                {allLegions.map((l) => (
                  <div key={l.id} className="flex items-center gap-3 rounded-lg border border-border bg-background/40 p-2">
                    <LegionLogo icon={l.icon} iconType={l.iconType || 'emoji'} size={32} className="shrink-0" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-sm font-medium">{l.name}</span>
                        <span className="rounded bg-primary/20 px-1.5 py-0.5 text-[10px] font-mono font-bold text-primary">
                          [{l.tag}]
                        </span>
                        <Badge
                          variant="secondary"
                          className={
                            l.status === 'approved'
                              ? 'h-5 px-1.5 text-[10px] bg-accent/15 text-accent'
                              : l.status === 'pending'
                                ? 'h-5 px-1.5 text-[10px] bg-primary/15 text-primary'
                                : 'h-5 px-1.5 text-[10px] bg-rose-500/15 text-rose-300'
                          }
                        >
                          {l.status}
                        </Badge>
                      </div>
                      <p className="text-[11px] text-muted-foreground">
                        {l.memberCount} members · Leader: {l.members[0]?.username || 'N/A'} · ID: {l.inGameLegionId}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </ScrollArea>
    </div>
  )
}
