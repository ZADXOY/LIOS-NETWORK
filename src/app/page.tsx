'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { io, Socket } from 'socket.io-client'
import {
  Send,
  Users,
  Flame,
  Shield,
  Sword,
  Hammer,
  ScrollText,
  MessageCircle,
  LogOut,
  Loader2,
  Wifi,
  WifiOff,
  Search,
  Crown,
  Megaphone,
  Radio,
  Hash,
  ShieldCheck,
  PanelRightOpen,
  PanelRightClose,
  Menu,
  X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { useToast } from '@/hooks/use-toast'
import type {
  ChannelDef,
  ChatUser,
  ChatMessage,
  TypingEvent,
  Legion,
  LegionTaskStatus,
  AuthUser,
} from '@/lib/chat-types'
import { cn } from '@/lib/utils'
import { LegionPanel } from '@/components/legion-panel'
import { LegionOnboarding } from '@/components/legion-onboarding'
import { LegionLogo } from '@/components/legion-onboarding'
import { AuthGate, TOKEN_KEY } from '@/components/auth-gate'
import { AdminPanel } from '@/components/admin-panel'

// Accent → tailwind classes map (kept explicit to keep Tailwind from purging them)
const ACCENT_CLASSES: Record<
  string,
  { bg: string; text: string; border: string; ring: string; chipBg: string; chipText: string; dot: string }
> = {
  coral: {
    bg: 'bg-primary/15',
    text: 'text-primary',
    border: 'border-primary/30',
    ring: 'ring-primary/40',
    chipBg: 'bg-primary/20',
    chipText: 'text-primary',
    dot: 'bg-primary',
  },
  amber: {
    bg: 'bg-amber-500/15',
    text: 'text-amber-300',
    border: 'border-amber-500/30',
    ring: 'ring-amber-500/40',
    chipBg: 'bg-amber-500/20',
    chipText: 'text-amber-200',
    dot: 'bg-amber-500',
  },
  rose: {
    bg: 'bg-rose-500/15',
    text: 'text-rose-300',
    border: 'border-rose-500/30',
    ring: 'ring-rose-500/40',
    chipBg: 'bg-rose-500/20',
    chipText: 'text-rose-200',
    dot: 'bg-rose-500',
  },
  teal: {
    bg: 'bg-accent/15',
    text: 'text-accent',
    border: 'border-accent/30',
    ring: 'ring-accent/40',
    chipBg: 'bg-accent/20',
    chipText: 'text-accent',
    dot: 'bg-accent',
  },
  violet: {
    bg: 'bg-violet-500/15',
    text: 'text-violet-300',
    border: 'border-violet-500/30',
    ring: 'ring-violet-500/40',
    chipBg: 'bg-violet-500/20',
    chipText: 'text-violet-200',
    dot: 'bg-violet-500',
  },
  orange: {
    bg: 'bg-orange-500/15',
    text: 'text-orange-300',
    border: 'border-orange-500/30',
    ring: 'ring-orange-500/40',
    chipBg: 'bg-orange-500/20',
    chipText: 'text-orange-200',
    dot: 'bg-orange-500',
  },
  slate: {
    bg: 'bg-slate-500/15',
    text: 'text-slate-300',
    border: 'border-slate-500/30',
    ring: 'ring-slate-500/40',
    chipBg: 'bg-slate-500/20',
    chipText: 'text-slate-200',
    dot: 'bg-slate-500',
  },
}

const accent = (token: string) => ACCENT_CLASSES[token] || ACCENT_CLASSES.slate

// Sidebar section type
type Section = 'comms' | 'squad' | 'admin'

export default function Home() {
  const { toast } = useToast()

  // Connection / registration state
  const socketRef = useRef<Socket | null>(null)
  const [isConnected, setIsConnected] = useState(false)
  const [currentUser, setCurrentUser] = useState<ChatUser | null>(null)
  const [channels, setChannels] = useState<ChannelDef[]>([])

  // Active section: 'comms' (game chat) or 'squad' (squad chat + tasks) or 'admin'
  const [activeSection, setActiveSection] = useState<Section>('comms')

  // Game-channel state
  const [activeChannel, setActiveChannel] = useState<ChannelDef | null>(null)
  const [messagesByChannel, setMessagesByChannel] = useState<Record<string, ChatMessage[]>>({})
  const [usersByChannel, setUsersByChannel] = useState<Record<string, ChatUser[]>>({})
  const [typingByChannel, setTypingByChannel] = useState<Record<string, Record<string, TypingEvent>>>(
    {},
  )
  const [draft, setDraft] = useState('')
  const [showOnlinePanel, setShowOnlinePanel] = useState(false)
  const [showMobileChannels, setShowMobileChannels] = useState(false)

  // Squad state
  const [legion, setLegion] = useState<Legion | null>(null)
  const [openLegions, setOpenLegions] = useState<Legion[]>([])
  const [legionMessages, setLegionMessages] = useState<ChatMessage[]>([])
  const [legionTyping, setLegionTyping] = useState<{ username: string; avatar: string }[]>([])

  // Squad raids state
  const [raidMessages, setRaidMessages] = useState<ChatMessage[]>([])
  const [raidTyping, setRaidTyping] = useState<{ username: string; avatar: string }[]>([])

  // Admin state
  const [authUser, setAuthUser] = useState<AuthUser | null>(null)
  const [authToken, setAuthToken] = useState<string | null>(null)
  const [adminPendingLegions, setAdminPendingLegions] = useState<Legion[]>([])
  const [adminAllLegions, setAdminAllLegions] = useState<Legion[]>([])

  // Refs
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const legionMessagesEndRef = useRef<HTMLDivElement>(null)
  const typingTimeoutRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({})
  const lastTypingSentRef = useRef<number>(0)
  const lastLegionTypingSentRef = useRef<number>(0)
  const legionTypingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ---------- Socket setup ----------
  useEffect(() => {
    // Ensure the chat-service mini-service is running (spawned as a child of the Next.js server)
    fetch('/api/start-chat-service').catch(() => {
      // non-fatal — the socket will retry
    })

    const sock = io('/?XTransformPort=3003', {
      transports: ['websocket', 'polling'],
      forceNew: true,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      timeout: 10000,
    })
    socketRef.current = sock

    sock.on('connect', () => setIsConnected(true))
    sock.on('disconnect', () => setIsConnected(false))

    sock.on('registered', (data: { user: ChatUser; channels: ChannelDef[] }) => {
      setCurrentUser(data.user)
      setChannels(data.channels)
      const general = data.channels.find((c) => c.id === 'general') || data.channels[0]
      if (general) {
        setActiveChannel(general)
        sock.emit('join-channel', { channelId: general.id })
      }
      toast({
        title: 'Welcome to the Hearth',
        description: `Hello, ${data.user.username}. Pick a channel or build your squad.`,
      })
    })

    sock.on('error-message', (data: { message: string }) => {
      toast({ title: 'Error', description: data.message, variant: 'destructive' })
    })

    // Game-channel events
    sock.on('channel-history', (data: { channelId: string; messages: ChatMessage[] }) => {
      setMessagesByChannel((prev) => ({ ...prev, [data.channelId]: data.messages }))
    })
    sock.on('message', (msg: ChatMessage) => {
      setMessagesByChannel((prev) => {
        const list = prev[msg.channelId] || []
        if (list.some((m) => m.id === msg.id)) return prev
        return { ...prev, [msg.channelId]: [...list, msg].slice(-200) }
      })
      setTypingByChannel((prev) => {
        const chan = prev[msg.channelId] || {}
        const next = { ...chan }
        delete next[msg.username]
        return { ...prev, [msg.channelId]: next }
      })
    })
    sock.on('channel-users', (data: { channelId: string; users: ChatUser[] }) => {
      setUsersByChannel((prev) => ({ ...prev, [data.channelId]: data.users }))
    })
    sock.on('typing', (evt: TypingEvent) => {
      setTypingByChannel((prev) => {
        const chan = { ...(prev[evt.channelId!] || {}) }
        if (evt.isTyping) {
          chan[evt.username] = evt
          const key = `${evt.channelId}:${evt.username}`
          if (typingTimeoutRef.current[key]) clearTimeout(typingTimeoutRef.current[key])
          typingTimeoutRef.current[key] = setTimeout(() => {
            setTypingByChannel((p) => {
              const c = { ...(p[evt.channelId!] || {}) }
              delete c[evt.username]
              return { ...p, [evt.channelId!]: c }
            })
          }, 4000)
        } else {
          delete chan[evt.username]
        }
        return { ...prev, [evt.channelId!]: chan }
      })
    })

    // Squad events
    sock.on('legion:created', (l: Legion) => {
      setLegion(l)
      setLegionMessages([])
      setActiveSection('squad')
      toast({
        title: 'Squad founded',
        description: `You are now the leader of [${l.tag}] ${l.name}.`,
      })
    })
    sock.on('legion:pending', (l: Legion) => {
      setLegion(l)
      setLegionMessages([])
      setActiveSection('squad')
      toast({
        title: 'Squad submitted for approval',
        description: `[${l.tag}] ${l.name} is pending admin approval. You'll be notified once approved.`,
      })
    })
    sock.on('legion:joined', (l: Legion) => {
      setLegion(l)
      setActiveSection('squad')
      toast({
        title: 'Joined squad',
        description: `You are now a member of [${l.tag}] ${l.name}.`,
      })
    })
    sock.on('legion:history', (data: { legionId: string; messages: ChatMessage[] }) => {
      setLegionMessages(data.messages)
    })
    sock.on('legion:message', (msg: ChatMessage) => {
      setLegionMessages((prev) => {
        if (prev.some((m) => m.id === msg.id)) return prev
        return [...prev, msg].slice(-200)
      })
      // Clear typing for this user
      setLegionTyping((prev) => prev.filter((t) => t.username !== msg.username))
    })
    sock.on('legion:update', (l: Legion) => {
      setLegion(l)
    })
    sock.on('legion:typing', (evt: { username: string; avatar: string; isTyping: boolean }) => {
      setLegionTyping((prev) => {
        if (evt.isTyping) {
          if (prev.some((t) => t.username === evt.username)) return prev
          return [...prev, { username: evt.username, avatar: evt.avatar }]
        }
        return prev.filter((t) => t.username !== evt.username)
      })
      // Auto-clear after 4s
      if (evt.isTyping) {
        if (legionTypingTimeoutRef.current) clearTimeout(legionTypingTimeoutRef.current)
        legionTypingTimeoutRef.current = setTimeout(() => {
          setLegionTyping((prev) => prev.filter((t) => t.username !== evt.username))
        }, 4000)
      }
    })
    sock.on('legion:list', (list: Legion[]) => {
      setOpenLegions(list)
    })
    sock.on('legion:left', () => {
      setLegion(null)
      setLegionMessages([])
      setLegionTyping([])
      setActiveSection('comms')
    })
    sock.on('legion:kicked', (data: { legionId: string; legionName: string }) => {
      setLegion(null)
      setLegionMessages([])
      setLegionTyping([])
      setActiveSection('comms')
      toast({
        title: 'Kicked from squad',
        description: `You were removed from ${data.legionName}.`,
        variant: 'destructive',
      })
    })
    sock.on('legion:disbanded', () => {
      setLegion(null)
      setLegionMessages([])
      setLegionTyping([])
      setActiveSection('comms')
      toast({
        title: 'Squad disbanded',
        description: 'The squad has been disbanded by its leader.',
        variant: 'destructive',
      })
    })

    // Squad approval events
    sock.on('legion:approved', (l: Legion) => {
      setLegion(l)
      toast({
        title: 'Squad approved!',
        description: `[${l.tag}] ${l.name} is now live. You can recruit members and post to the Squad Recruitment channel.`,
      })
    })
    sock.on('legion:rejected', (data: { legionId: string; legionName: string; tag: string; reason: string }) => {
      setLegion(null)
      setLegionMessages([])
      setLegionTyping([])
      setActiveSection('comms')
      toast({
        title: 'Squad rejected',
        description: `[${data.tag}] ${data.legionName} was rejected by admin. Reason: ${data.reason}`,
        variant: 'destructive',
      })
    })

    // Squad raid chat events
    sock.on('legion:raid:history', (data: { legionId: string; messages: ChatMessage[] }) => {
      setRaidMessages(data.messages)
    })
    sock.on('legion:raid:message', (msg: ChatMessage) => {
      setRaidMessages((prev) => {
        if (prev.some((m) => m.id === msg.id)) return prev
        return [...prev, msg].slice(-200)
      })
      setRaidTyping((prev) => prev.filter((t) => t.username !== msg.username))
    })
    sock.on('legion:raid:typing', (evt: { username: string; avatar: string; isTyping: boolean }) => {
      setRaidTyping((prev) => {
        if (evt.isTyping) {
          if (prev.some((t) => t.username === evt.username)) return prev
          return [...prev, { username: evt.username, avatar: evt.avatar }]
        }
        return prev.filter((t) => t.username !== evt.username)
      })
    })

    // Squad recruit confirmation
    sock.on('legion:recruit-posted', (data: { message: string }) => {
      toast({ title: 'Recruitment posted', description: data.message })
    })

    // Admin events
    sock.on('admin:pending-legions', (list: Legion[]) => {
      setAdminPendingLegions(list)
    })
    sock.on('admin:all-legions', (list: Legion[]) => {
      setAdminAllLegions(list)
    })

    return () => {
      sock.disconnect()
    }
  }, [toast])

  // ---------- Auto-scroll on new message ----------
  useEffect(() => {
    if (activeSection === 'comms') {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
    } else {
      legionMessagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
    }
  }, [messagesByChannel, legionMessages, activeChannel, activeSection, legion])

  // ---------- Auth handler (called by AuthGate after email+password login) ----------
  const handleAuthed = useCallback(
    (user: AuthUser, token: string) => {
      setAuthUser(user)
      setAuthToken(token)
      const sock = socketRef.current
      if (!sock) {
        // Socket not yet ready — retry shortly
        setTimeout(() => {
          const s = socketRef.current
          if (s) {
            s.emit('register', {
              username: user.username,
              email: user.email,
              isAdmin: user.isAdmin,
              legionLeftAt: user.legionLeftAt,
              inGameLegionId: user.inGameLegionId,
            })
          }
        }, 500)
        return
      }
      sock.emit('register', {
        username: user.username,
        email: user.email,
        isAdmin: user.isAdmin,
        legionLeftAt: user.legionLeftAt,
        inGameLegionId: user.inGameLegionId,
      })
    },
    [],
  )

  // ---------- Game channel handlers ----------
  const handleSwitchChannel = useCallback(
    (channel: ChannelDef) => {
      const sock = socketRef.current
      if (!sock || !currentUser) return
      setActiveSection('comms')
      setActiveChannel(channel)
      sock.emit('join-channel', { channelId: channel.id })
      setShowMobileChannels(false)
    },
    [currentUser],
  )

  const handleSelectSquad = useCallback(() => {
    setActiveSection('squad')
    setShowMobileChannels(false)
  }, [])

  const handleSend = useCallback(() => {
    const text = draft.trim()
    const sock = socketRef.current
    if (!text || !sock || !activeChannel) return
    sock.emit('send-message', { channelId: activeChannel.id, content: text })
    setDraft('')
    sock.emit('typing', { channelId: activeChannel.id, isTyping: false })
    lastTypingSentRef.current = 0
  }, [draft, activeChannel])

  const handleDraftChange = useCallback(
    (val: string) => {
      setDraft(val)
      const sock = socketRef.current
      if (!sock || !activeChannel) return
      const now = Date.now()
      if (now - lastTypingSentRef.current > 1500) {
        sock.emit('typing', { channelId: activeChannel.id, isTyping: true })
        lastTypingSentRef.current = now
      }
    },
    [activeChannel],
  )

  // ---------- Squad handlers ----------
  const handleCreateLegion = useCallback(
    (data: {
      name: string
      tag: string
      description: string
      icon?: string
      iconType?: 'emoji' | 'image'
      inGameLegionId?: string
    }) => {
      const sock = socketRef.current
      if (!sock) return
      sock.emit('legion:create', data)
    },
    [],
  )

  const handleJoinLegion = useCallback((legionId: string) => {
    const sock = socketRef.current
    if (!sock) return
    sock.emit('legion:join', { legionId })
  }, [])

  const handleRefreshLegions = useCallback(() => {
    const sock = socketRef.current
    if (!sock) return
    sock.emit('legion:list')
  }, [])

  const handleLegionMessage = useCallback((content: string) => {
    const sock = socketRef.current
    if (!sock) return
    sock.emit('legion:chat', { content })
  }, [])

  const handleLegionTyping = useCallback((isTyping: boolean) => {
    const sock = socketRef.current
    if (!sock) return
    const now = Date.now()
    if (isTyping) {
      if (now - lastLegionTypingSentRef.current > 1500) {
        sock.emit('legion:typing', { isTyping: true })
        lastLegionTypingSentRef.current = now
      }
    } else {
      sock.emit('legion:typing', { isTyping: false })
      lastLegionTypingSentRef.current = 0
    }
  }, [])

  const handleLegionLeave = useCallback(() => {
    const sock = socketRef.current
    if (!sock) return
    sock.emit('legion:leave')
    // Record the cooldown timestamp on the server (auth DB)
    if (authToken) {
      fetch('/api/auth/update-cooldown', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: authToken }),
      }).catch(() => {
        // non-fatal — backend will still enforce via socket state
      })
    }
  }, [authToken])

  const handleLegionDisband = useCallback(() => {
    const sock = socketRef.current
    if (!sock) return
    sock.emit('legion:disband')
  }, [])

  const handleLegionKick = useCallback((userId: string) => {
    const sock = socketRef.current
    if (!sock) return
    sock.emit('legion:kick', { userId })
  }, [])

  const handleLegionNotice = useCallback((notice: string) => {
    const sock = socketRef.current
    if (!sock) return
    sock.emit('legion:notice', { notice })
  }, [])

  const handleLegionTaskAssign = useCallback(
    (data: { assigneeId: string; title: string; description: string }) => {
      const sock = socketRef.current
      if (!sock) return
      sock.emit('legion:task-assign', data)
    },
    [],
  )

  const handleLegionTaskUpdate = useCallback((taskId: string, status: LegionTaskStatus) => {
    const sock = socketRef.current
    if (!sock) return
    sock.emit('legion:task-update', { taskId, status })
  }, [])

  const handleLegionTaskDelete = useCallback((taskId: string) => {
    const sock = socketRef.current
    if (!sock) return
    sock.emit('legion:task-delete', { taskId })
  }, [])

  // ---------- Squad recruit handler (leader posts to Squad Recruitment channel) ----------
  const handleLegionRecruit = useCallback((reason: string) => {
    const sock = socketRef.current
    if (!sock) return
    sock.emit('legion:recruit', { reason })
  }, [])

  // ---------- Squad raid handlers ----------
  const handleRaidJoin = useCallback(() => {
    const sock = socketRef.current
    if (!sock) return
    sock.emit('legion:raid:join')
  }, [])

  const handleRaidSendMessage = useCallback((content: string) => {
    const sock = socketRef.current
    if (!sock) return
    sock.emit('legion:raid:chat', { content })
  }, [])

  const handleRaidTyping = useCallback((isTyping: boolean) => {
    const sock = socketRef.current
    if (!sock) return
    sock.emit('legion:raid:typing', { isTyping })
  }, [])

  // ---------- Admin handlers (approve/reject pending squads) ----------
  const handleAdminApproveLegion = useCallback((legionId: string) => {
    const sock = socketRef.current
    if (!sock) return
    sock.emit('admin:approve-legion', { legionId })
  }, [])

  const handleAdminRejectLegion = useCallback((legionId: string, reason?: string) => {
    const sock = socketRef.current
    if (!sock) return
    sock.emit('admin:reject-legion', { legionId, reason })
  }, [])

  const handleSelectAdmin = useCallback(() => {
    setActiveSection('admin')
    setShowMobileChannels(false)
    // Refresh pending legions + all legions from server
    const sock = socketRef.current
    if (sock) {
      sock.emit('admin:list-pending-legions')
    }
  }, [])

  const handleLogout = useCallback(() => {
    const oldSock = socketRef.current
    if (oldSock) oldSock.disconnect()
    localStorage.removeItem(TOKEN_KEY)
    setCurrentUser(null)
    setAuthUser(null)
    setAuthToken(null)
    setActiveChannel(null)
    setMessagesByChannel({})
    setUsersByChannel({})
    setTypingByChannel({})
    setChannels([])
    setLegion(null)
    setLegionMessages([])
    setLegionTyping([])
    setRaidMessages([])
    setRaidTyping([])
    setOpenLegions([])
    setAdminPendingLegions([])
    setAdminAllLegions([])
    setActiveSection('comms')
    setTimeout(() => {
      const sock = io('/?XTransformPort=3003', {
        transports: ['websocket', 'polling'],
        forceNew: true,
        reconnection: true,
        reconnectionAttempts: Infinity,
        reconnectionDelay: 1000,
        timeout: 10000,
      })
      socketRef.current = sock
      sock.on('connect', () => setIsConnected(true))
      sock.on('disconnect', () => setIsConnected(false))
      sock.on('registered', (data: { user: ChatUser; channels: ChannelDef[] }) => {
        setCurrentUser(data.user)
        setChannels(data.channels)
        const general = data.channels.find((c) => c.id === 'general') || data.channels[0]
        if (general) {
          setActiveChannel(general)
          sock.emit('join-channel', { channelId: general.id })
        }
      })
      sock.on('channel-history', (d: { channelId: string; messages: ChatMessage[] }) => {
        setMessagesByChannel((prev) => ({ ...prev, [d.channelId]: d.messages }))
      })
      sock.on('message', (msg: ChatMessage) => {
        setMessagesByChannel((prev) => {
          const list = prev[msg.channelId] || []
          if (list.some((m) => m.id === msg.id)) return prev
          return { ...prev, [msg.channelId]: [...list, msg].slice(-200) }
        })
      })
      sock.on('channel-users', (d: { channelId: string; users: ChatUser[] }) => {
        setUsersByChannel((prev) => ({ ...prev, [d.channelId]: d.users }))
      })
    }, 200)
  }, [])

  // ---------- Render: Auth Gate (email + password) ----------
  if (!authUser) {
    return <AuthGate onAuthed={handleAuthed} />
  }

  // If authed but socket not yet registered, show a brief loading state
  if (!currentUser) {
    return (
      <div className="bg-hearth min-h-screen flex flex-col items-center justify-center px-4 text-foreground">
        <div className="flex flex-col items-center gap-3">
          <Flame className="h-8 w-8 animate-pulse text-primary ember-flicker" />
          <p className="text-sm text-muted-foreground">Lighting the hearth…</p>
        </div>
      </div>
    )
  }

  const messages = activeChannel ? messagesByChannel[activeChannel.id] || [] : []
  const onlineUsers = activeChannel ? usersByChannel[activeChannel.id] || [] : []
  const typingList = activeChannel
    ? Object.values(typingByChannel[activeChannel.id] || {}).filter(
        (t) => t.username !== currentUser.username,
      )
    : []
  const a = activeChannel ? accent(activeChannel.accent) : accent('slate')
  const isLeader = legion && legion.leaderId === currentUser.id

  const sectionTabs: { id: Section; label: string; icon: React.ReactNode; visible: boolean; badge?: number }[] = [
    { id: 'comms', label: 'Comms', icon: <MessageCircle className="h-4 w-4" />, visible: true },
    { id: 'squad', label: legion ? 'My Squad' : 'Squads', icon: <Shield className="h-4 w-4" />, visible: true },
    { id: 'admin', label: 'Admin', icon: <ShieldCheck className="h-4 w-4" />, visible: !!authUser?.isAdmin, badge: adminPendingLegions.length },
  ]

  return (
    <div className="bg-hearth min-h-screen flex flex-col text-foreground">
      {/* Top bar */}
      <header className="sticky top-0 z-30 border-b border-border/60 bg-card/80 backdrop-blur supports-[backdrop-filter]:bg-card/60">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between gap-3 px-3 sm:px-4">
          <div className="flex items-center gap-2 min-w-0">
            {/* Mobile menu button */}
            <button
              onClick={() => setShowMobileChannels(true)}
              className="md:hidden inline-flex h-9 w-9 items-center justify-center rounded-md border border-border bg-background/60 hover:bg-accent/20"
              aria-label="Open channels"
            >
              <Menu className="h-4 w-4" />
            </button>
            <div className="flex items-center gap-2 min-w-0">
              <img
                src="/hearth-logo.png"
                alt="Hearth logo"
                className="h-8 w-8 rounded-md object-cover ring-1 ring-primary/30 ember-flicker"
              />
              <div className="min-w-0">
                <h1 className="truncate text-sm font-bold leading-tight">
                  Hearth
                </h1>
                <p className="hidden sm:block truncate text-[11px] text-muted-foreground leading-tight">
                  Where squads gather
                </p>
              </div>
            </div>
          </div>

          {/* Section tabs — desktop */}
          <nav className="hidden md:flex items-center gap-1">
            {sectionTabs.filter(t => t.visible).map((tab) => (
              <button
                key={tab.id}
                onClick={() => tab.id === 'squad' ? handleSelectSquad() : tab.id === 'admin' ? handleSelectAdmin() : setActiveSection('comms')}
                className={cn(
                  'relative inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                  activeSection === tab.id
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:text-foreground hover:bg-accent/10',
                )}
              >
                {tab.icon}
                {tab.label}
                {tab.badge ? (
                  <span className="ml-1 rounded-full bg-rose-500 px-1.5 py-0.5 text-[10px] font-bold text-rose-50">
                    {tab.badge}
                  </span>
                ) : null}
              </button>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <span
              className={cn(
                'inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-medium',
                isConnected
                  ? 'bg-accent/15 text-accent'
                  : 'bg-rose-500/15 text-rose-300',
              )}
            >
              {isConnected ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
              <span className="hidden sm:inline">{isConnected ? 'Online' : 'Offline'}</span>
            </span>
            <div className="hidden sm:flex items-center gap-2 rounded-md border border-border bg-background/60 px-2 py-1">
              <Avatar className="h-6 w-6">
                <AvatarFallback className="bg-primary/20 text-primary text-xs">
                  {currentUser.avatar}
                </AvatarFallback>
              </Avatar>
              <span className="text-xs font-medium">{currentUser.username}</span>
              <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">
                Lv {currentUser.level}
              </Badge>
              {legion && (
                <Badge className="h-5 gap-1 bg-primary/20 px-1.5 text-[10px] text-primary hover:bg-primary/30">
                  <Shield className="h-2.5 w-2.5" />
                  [{legion.tag}]
                </Badge>
              )}
            </div>
            {activeSection === 'comms' && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowOnlinePanel((v) => !v)}
                title="Toggle online members panel"
                className="h-9 w-9"
              >
                {showOnlinePanel ? <PanelRightClose className="h-4 w-4" /> : <PanelRightOpen className="h-4 w-4" />}
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              onClick={handleLogout}
              title="Sign out"
              className="h-9 w-9"
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Section tabs — mobile */}
        <nav className="md:hidden flex items-center gap-1 border-t border-border/60 px-2 py-1.5">
          {sectionTabs.filter(t => t.visible).map((tab) => (
            <button
              key={tab.id}
              onClick={() => tab.id === 'squad' ? handleSelectSquad() : tab.id === 'admin' ? handleSelectAdmin() : setActiveSection('comms')}
              className={cn(
                'relative inline-flex flex-1 items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium transition-colors',
                activeSection === tab.id
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground hover:bg-accent/10',
              )}
            >
              {tab.icon}
              {tab.label}
              {tab.badge ? (
                <span className="ml-1 rounded-full bg-rose-500 px-1.5 py-0.5 text-[10px] font-bold text-rose-50">
                  {tab.badge}
                </span>
              ) : null}
            </button>
          ))}
        </nav>
      </header>

      {/* Channel pills bar — only in comms section */}
      {activeSection === 'comms' && (
        <div className="sticky top-[7.5rem] md:top-14 z-20 border-b border-border/60 bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="mx-auto max-w-7xl px-2 sm:px-4">
            <ScrollArea className="w-full whitespace-nowrap scrollbar-hearth">
              <div className="flex items-center gap-2 py-2">
                {channels.map((c) => {
                  const isActive = activeSection === 'comms' && activeChannel?.id === c.id
                  const ca = accent(c.accent)
                  const count = (usersByChannel[c.id] || []).length
                  return (
                    <button
                      key={c.id}
                      onClick={() => handleSwitchChannel(c)}
                      className={cn(
                        'inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-all',
                        isActive
                          ? cn(ca.bg, ca.text, ca.border, 'shadow-sm')
                          : 'border-border bg-card/40 text-muted-foreground hover:text-foreground hover:bg-card/70',
                      )}
                    >
                      <span className="text-sm">{c.icon}</span>
                      <span>{c.name}</span>
                      {count > 0 && (
                        <span className={cn(
                          'ml-0.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-bold',
                          isActive ? ca.chipBg : 'bg-muted/60 text-muted-foreground',
                        )}>
                          {count}
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>
            </ScrollArea>
          </div>
        </div>
      )}

      {/* Main content area */}
      <main className="mx-auto flex w-full max-w-7xl flex-1 overflow-hidden px-2 sm:px-4 py-2 gap-2">
        {/* Mobile channels drawer */}
        {showMobileChannels && activeSection === 'comms' && (
          <div className="md:hidden fixed inset-0 z-40 flex">
            <div
              className="absolute inset-0 bg-black/60"
              onClick={() => setShowMobileChannels(false)}
            />
            <div className="relative z-10 w-72 max-w-[80%] flex flex-col rounded-r-xl border-l border-border bg-card shadow-xl">
              <div className="flex items-center justify-between border-b border-border/60 p-3">
                <h3 className="text-sm font-semibold">Channels</h3>
                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setShowMobileChannels(false)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <ScrollArea className="flex-1 scrollbar-hearth">
                <div className="space-y-1 p-2">
                  {channels.map((c) => {
                    const isActive = activeSection === 'comms' && activeChannel?.id === c.id
                    const ca = accent(c.accent)
                    const count = (usersByChannel[c.id] || []).length
                    return (
                      <button
                        key={c.id}
                        onClick={() => handleSwitchChannel(c)}
                        className={cn(
                          'flex w-full items-center gap-3 rounded-lg px-2 py-2.5 text-left transition-colors',
                          isActive
                            ? cn(ca.bg, ca.text, 'border', ca.border)
                            : 'hover:bg-accent/10 border border-transparent',
                        )}
                      >
                        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-md text-base bg-muted/60">
                          {c.icon}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium">{c.name}</span>
                          <span className="block truncate text-[11px] text-muted-foreground">{c.description}</span>
                        </span>
                        {count > 0 && (
                          <span className="shrink-0 rounded-full bg-background/80 px-1.5 py-0.5 text-[10px] text-muted-foreground">
                            {count}
                          </span>
                        )}
                      </button>
                    )
                  })}
                </div>
              </ScrollArea>
            </div>
          </div>
        )}

        {/* Main panel: either game channel, squad, or admin */}
        {activeSection === 'admin' && authUser?.isAdmin ? (
          <section className="flex flex-1 flex-col overflow-hidden rounded-xl border border-border bg-card/60 backdrop-blur min-w-0">
            <AdminPanel
              user={authUser}
              token={authToken || ''}
              onApproveLegion={handleAdminApproveLegion}
              onRejectLegion={handleAdminRejectLegion}
              pendingLegions={adminPendingLegions}
              allLegions={adminAllLegions}
            />
          </section>
        ) : activeSection === 'squad' && legion ? (
          <section className="flex flex-1 flex-col overflow-hidden rounded-xl border border-primary/30 bg-card/60 backdrop-blur min-w-0">
            <LegionPanel
              legion={legion}
              currentUserId={currentUser.id}
              messages={legionMessages}
              typingUsers={legionTyping.filter((t) => t.username !== currentUser.username)}
              onSendMessage={handleLegionMessage}
              onTyping={handleLegionTyping}
              onLeave={handleLegionLeave}
              onDisband={handleLegionDisband}
              onKick={handleLegionKick}
              onSetNotice={handleLegionNotice}
              onAssignTask={handleLegionTaskAssign}
              onUpdateTask={handleLegionTaskUpdate}
              onDeleteTask={handleLegionTaskDelete}
              onRecruit={handleLegionRecruit}
              raidMessages={raidMessages}
              raidTypingUsers={raidTyping.filter((t) => t.username !== currentUser.username)}
              onRaidJoin={handleRaidJoin}
              onRaidSendMessage={handleRaidSendMessage}
              onRaidTyping={handleRaidTyping}
            />
          </section>
        ) : activeSection === 'squad' && !legion ? (
          <section className="flex flex-1 flex-col overflow-hidden rounded-xl border border-border bg-card/60 backdrop-blur min-w-0">
            <LegionOnboarding
              openLegions={openLegions}
              onCreate={handleCreateLegion}
              onJoin={handleJoinLegion}
              onRefresh={handleRefreshLegions}
            />
          </section>
        ) : (
          <section className="flex flex-1 flex-col overflow-hidden rounded-xl border border-border bg-card/60 backdrop-blur min-w-0">
            {/* Channel header */}
            <div className="flex items-center justify-between gap-2 border-b border-border/60 px-4 py-3">
              <div className="flex items-center gap-3 min-w-0">
                <div
                  className={cn(
                    'grid h-10 w-10 shrink-0 place-items-center rounded-lg text-xl',
                    a.bg,
                    a.text,
                  )}
                >
                  {activeChannel?.icon || '#'}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h2 className="truncate font-semibold leading-tight">
                      {activeChannel?.name || '—'}
                    </h2>
                    <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px]', a.chipBg, a.chipText)}>
                      channel
                    </span>
                  </div>
                  <p className="truncate text-xs text-muted-foreground">
                    {activeChannel?.description}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Badge variant="outline" className="gap-1">
                  <Users className="h-3 w-3" />
                  {onlineUsers.length}
                </Badge>
              </div>
            </div>

            {/* Messages */}
            <ScrollArea className="flex-1 scrollbar-hearth px-2 sm:px-4 py-3">
              <div className="mx-auto max-w-3xl space-y-1">
                {messages.length === 0 ? (
                  <EmptyChannel channelName={activeChannel?.name || 'this channel'} />
                ) : (
                  messages.map((msg) => (
                    <MessageRow
                      key={msg.id}
                      msg={msg}
                      isSelf={msg.username === currentUser.username}
                    />
                  ))
                )}
                {typingList.length > 0 && (
                  <div className="flex items-center gap-2 px-1 pt-1 text-xs text-muted-foreground">
                    <span className="flex gap-1">
                      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground/70 [animation-delay:-0.2s]" />
                      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground/70 [animation-delay:-0.1s]" />
                      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground/70" />
                    </span>
                    <span>
                      {typingList.length === 1
                        ? `${typingList[0].username} is typing…`
                        : `${typingList.length} people are typing…`}
                    </span>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>
            </ScrollArea>

            {/* Composer */}
            <div className="border-t border-border/60 p-3">
              <div className="mx-auto flex max-w-3xl items-end gap-2">
                <div className="flex-1">
                  <Textarea
                    value={draft}
                    onChange={(e) => handleDraftChange(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault()
                        handleSend()
                      }
                    }}
                    placeholder={`Message #${activeChannel?.name || ''}…`}
                    rows={1}
                    className="min-h-[44px] max-h-40 resize-none scrollbar-hearth"
                    disabled={!isConnected}
                  />
                  <p className="mt-1 px-1 text-[10px] text-muted-foreground">
                    Press <kbd className="rounded bg-muted px-1 py-0.5">Enter</kbd> to send,
                    <kbd className="ml-1 rounded bg-muted px-1 py-0.5">Shift</kbd>+
                    <kbd className="rounded bg-muted px-1 py-0.5">Enter</kbd> for new line
                  </p>
                </div>
                <Button
                  onClick={handleSend}
                  disabled={!isConnected || !draft.trim()}
                  size="icon"
                  className="h-11 w-11 shrink-0"
                  aria-label="Send message"
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </section>
        )}

        {/* Right rail — online users (togglable) */}
        {activeSection === 'comms' && showOnlinePanel && (
          <aside className="hidden md:flex w-64 flex-col rounded-xl border border-border bg-card/60 backdrop-blur">
            <OnlineUsers users={onlineUsers} currentUser={currentUser} />
          </aside>
        )}

        {/* Mobile online users drawer */}
        {activeSection === 'comms' && showOnlinePanel && (
          <div className="md:hidden fixed inset-0 z-40 flex justify-end">
            <div
              className="absolute inset-0 bg-black/60"
              onClick={() => setShowOnlinePanel(false)}
            />
            <div className="relative z-10 w-72 max-w-[80%] flex flex-col rounded-l-xl border-r border-border bg-card shadow-xl">
              <OnlineUsers users={onlineUsers} currentUser={currentUser} />
            </div>
          </div>
        )}
      </main>

      {/* Footer — sticky to bottom */}
      <footer className="mt-auto border-t border-border/60 bg-card/40 px-4 py-2">
        <div className="mx-auto flex max-w-7xl items-center justify-between text-[11px] text-muted-foreground">
          <span className="flex items-center gap-1">
            <Flame className="h-3 w-3 text-primary" />
            Tend the fire. The hearth never sleeps.
          </span>
          <span className="hidden sm:inline">
            {activeSection === 'squad' && legion
              ? `In squad [${legion.tag}] ${legion.name} · ${legion.memberCount} members · ${legion.tasks.length} tasks`
              : activeSection === 'admin'
                ? `${adminPendingLegions.length} pending approvals · ${adminAllLegions.length} total squads`
                : `${onlineUsers.length} online in #${activeChannel?.name || ''}`}
          </span>
        </div>
      </footer>
    </div>
  )
}

/* ----------------------------- Sub-components ----------------------------- */

function MessageRow({ msg, isSelf }: { msg: ChatMessage; isSelf: boolean }) {
  if (msg.type === 'system') {
    return (
      <div className="msg-in flex items-center justify-center py-1.5">
        <span className="rounded-full bg-muted/40 px-3 py-0.5 text-[11px] italic text-muted-foreground">
          ⚙️ {msg.content} · {formatTime(msg.timestamp)}
        </span>
      </div>
    )
  }
  return (
    <div className={cn('msg-in group flex items-start gap-3 rounded-lg px-2 py-1.5 hover:bg-accent/5', isSelf && 'bg-primary/5')}>
      <Avatar className="h-8 w-8 shrink-0">
        <AvatarFallback
          className={cn(
            'text-sm',
            isSelf ? 'bg-primary/25 text-primary' : 'bg-muted text-foreground',
          )}
        >
          {msg.avatar}
        </AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <span className={cn('text-sm font-semibold', isSelf && 'text-primary')}>
            {msg.username}
            {isSelf && <span className="ml-1 text-[10px] text-muted-foreground">(you)</span>}
          </span>
          <span className="text-[10px] text-muted-foreground">{formatTime(msg.timestamp)}</span>
        </div>
        <p className="whitespace-pre-wrap break-words text-sm leading-snug text-foreground/90">
          {msg.content}
        </p>
      </div>
    </div>
  )
}

function EmptyChannel({ channelName }: { channelName: string }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
      <div className="mb-3 grid h-14 w-14 place-items-center rounded-2xl bg-muted/40 text-3xl">
        📭
      </div>
      <h3 className="text-sm font-semibold">No messages yet in #{channelName}</h3>
      <p className="mt-1 max-w-xs text-xs text-muted-foreground">
        Be the first to break the silence. Send a message below to start the conversation.
      </p>
    </div>
  )
}

function OnlineUsers({
  users,
  currentUser,
}: {
  users: ChatUser[]
  currentUser: ChatUser
}) {
  const sorted = [...users].sort((a, b) => {
    if (a.id === currentUser.id) return -1
    if (b.id === currentUser.id) return 1
    return a.username.localeCompare(b.username)
  })
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-border/60 px-3 py-3">
        <h3 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          <Users className="h-3.5 w-3.5" />
          Online Now
        </h3>
        <Badge variant="secondary" className="text-[10px]">
          {users.length}
        </Badge>
      </div>
      <ScrollArea className="flex-1 scrollbar-hearth">
        <div className="space-y-1 p-2">
          {sorted.length === 0 ? (
            <p className="px-2 py-4 text-center text-xs text-muted-foreground">
              No one online yet.
            </p>
          ) : (
            sorted.map((u) => {
              const isSelf = u.id === currentUser.id
              return (
                <div
                  key={u.id}
                  className={cn(
                    'flex items-center gap-2 rounded-lg px-2 py-1.5',
                    isSelf ? 'bg-primary/10' : 'hover:bg-accent/10',
                  )}
                >
                  <div className="relative">
                    <Avatar className="h-7 w-7">
                      <AvatarFallback className="bg-muted text-xs">{u.avatar}</AvatarFallback>
                    </Avatar>
                    <span className="dot-online absolute -bottom-0 -right-0 h-2.5 w-2.5 rounded-full bg-accent ring-2 ring-card" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1">
                      <span className="truncate text-xs font-medium">
                        {u.username}
                        {isSelf && (
                          <span className="ml-1 text-[10px] text-muted-foreground">(you)</span>
                        )}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                      <Badge variant="outline" className="h-4 px-1 text-[9px]">
                        Lv {u.level}
                      </Badge>
                    </div>
                  </div>
                </div>
              )
            })
          )}
        </div>
      </ScrollArea>
      <Separator />
      <div className="p-3 text-[11px] text-muted-foreground">
        <p className="flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-accent" />
          Online now
        </p>
      </div>
    </div>
  )
}

/* ----------------------------- Helpers ----------------------------- */

function formatTime(ts: string | Date): string {
  const d = typeof ts === 'string' ? new Date(ts) : ts
  if (isNaN(d.getTime())) return ''
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}
