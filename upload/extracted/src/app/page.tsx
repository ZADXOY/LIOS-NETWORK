'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { io, Socket } from 'socket.io-client'
import {
  Send,
  Users,
  Radio,
  Skull,
  Shield,
  Sword,
  Hammer,
  Flame,
  ScrollText,
  MessageCircle,
  LogOut,
  Loader2,
  Wifi,
  WifiOff,
  Search,
  Hash,
  Crown,
  Megaphone,
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

const STORAGE_KEY = 'lis-chat-username'

// Accent → tailwind classes map (kept explicit to keep Tailwind from purging them)
const ACCENT_CLASSES: Record<
  string,
  { bg: string; text: string; border: string; ring: string; chipBg: string; chipText: string }
> = {
  emerald: {
    bg: 'bg-emerald-500/15',
    text: 'text-emerald-300',
    border: 'border-emerald-500/30',
    ring: 'ring-emerald-500/40',
    chipBg: 'bg-emerald-500/20',
    chipText: 'text-emerald-200',
  },
  amber: {
    bg: 'bg-amber-500/15',
    text: 'text-amber-300',
    border: 'border-amber-500/30',
    ring: 'ring-amber-500/40',
    chipBg: 'bg-amber-500/20',
    chipText: 'text-amber-200',
  },
  rose: {
    bg: 'bg-rose-500/15',
    text: 'text-rose-300',
    border: 'border-rose-500/30',
    ring: 'ring-rose-500/40',
    chipBg: 'bg-rose-500/20',
    chipText: 'text-rose-200',
  },
  sky: {
    bg: 'bg-sky-500/15',
    text: 'text-sky-300',
    border: 'border-sky-500/30',
    ring: 'ring-sky-500/40',
    chipBg: 'bg-sky-500/20',
    chipText: 'text-sky-200',
  },
  violet: {
    bg: 'bg-violet-500/15',
    text: 'text-violet-300',
    border: 'border-violet-500/30',
    ring: 'ring-violet-500/40',
    chipBg: 'bg-violet-500/20',
    chipText: 'text-violet-200',
  },
  orange: {
    bg: 'bg-orange-500/15',
    text: 'text-orange-300',
    border: 'border-orange-500/30',
    ring: 'ring-orange-500/40',
    chipBg: 'bg-orange-500/20',
    chipText: 'text-orange-200',
  },
  red: {
    bg: 'bg-red-500/15',
    text: 'text-red-300',
    border: 'border-red-500/30',
    ring: 'ring-red-500/40',
    chipBg: 'bg-red-500/20',
    chipText: 'text-red-200',
  },
  slate: {
    bg: 'bg-slate-500/15',
    text: 'text-slate-300',
    border: 'border-slate-500/30',
    ring: 'ring-slate-500/40',
    chipBg: 'bg-slate-500/20',
    chipText: 'text-slate-200',
  },
}

const accent = (token: string) => ACCENT_CLASSES[token] || ACCENT_CLASSES.slate

// Map channel id → lucide icon
const CHANNEL_ICON: Record<string, React.ReactNode> = {
  general: <MessageCircle className="h-4 w-4" />,
  trading: <Radio className="h-4 w-4" />,
  pvp: <Sword className="h-4 w-4" />,
  guilds: <Shield className="h-4 w-4" />,
  help: <ScrollText className="h-4 w-4" />,
  'base-building': <Hammer className="h-4 w-4" />,
  raids: <Flame className="h-4 w-4" />,
  'off-topic': <Hash className="h-4 w-4" />,
}

// Sidebar section type
type Section = 'channels' | 'legion' | 'admin'

export default function Home() {
  const { toast } = useToast()

  // Connection / registration state
  const socketRef = useRef<Socket | null>(null)
  const [isConnected, setIsConnected] = useState(false)
  const [usernameInput, setUsernameInput] = useState('')
  const [isRegistering, setIsRegistering] = useState(false)
  const [currentUser, setCurrentUser] = useState<ChatUser | null>(null)
  const [channels, setChannels] = useState<ChannelDef[]>([])

  // Active section: 'channels' (game chat) or 'legion' (legion chat + tasks)
  const [activeSection, setActiveSection] = useState<Section>('channels')

  // Game-channel state
  const [activeChannel, setActiveChannel] = useState<ChannelDef | null>(null)
  const [messagesByChannel, setMessagesByChannel] = useState<Record<string, ChatMessage[]>>({})
  const [usersByChannel, setUsersByChannel] = useState<Record<string, ChatUser[]>>({})
  const [typingByChannel, setTypingByChannel] = useState<Record<string, Record<string, TypingEvent>>>(
    {},
  )
  const [draft, setDraft] = useState('')
  const [channelSearch, setChannelSearch] = useState('')
  const [showSidebarMobile, setShowSidebarMobile] = useState(false)

  // Legion state
  const [legion, setLegion] = useState<Legion | null>(null)
  const [openLegions, setOpenLegions] = useState<Legion[]>([])
  const [legionMessages, setLegionMessages] = useState<ChatMessage[]>([])
  const [legionTyping, setLegionTyping] = useState<{ username: string; avatar: string }[]>([])

  // Legion raids state
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
      setIsRegistering(false)
      toast({
        title: 'Connected to the island',
        description: `Welcome, ${data.user.username}. Pick a channel or found a legion.`,
      })
    })

    sock.on('error-message', (data: { message: string }) => {
      toast({ title: 'Error', description: data.message, variant: 'destructive' })
      setIsRegistering(false)
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

    // Legion events
    sock.on('legion:created', (l: Legion) => {
      setLegion(l)
      setLegionMessages([])
      setActiveSection('legion')
      toast({
        title: 'Legion founded',
        description: `You are now the leader of [${l.tag}] ${l.name}.`,
      })
    })
    sock.on('legion:pending', (l: Legion) => {
      setLegion(l)
      setLegionMessages([])
      setActiveSection('legion')
      toast({
        title: 'Legion submitted for approval',
        description: `[${l.tag}] ${l.name} is pending admin approval. You'll be notified once approved.`,
      })
    })
    sock.on('legion:joined', (l: Legion) => {
      setLegion(l)
      setActiveSection('legion')
      toast({
        title: 'Joined legion',
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
      setActiveSection('channels')
    })
    sock.on('legion:kicked', (data: { legionId: string; legionName: string }) => {
      setLegion(null)
      setLegionMessages([])
      setLegionTyping([])
      setActiveSection('channels')
      toast({
        title: 'Kicked from legion',
        description: `You were removed from ${data.legionName}.`,
        variant: 'destructive',
      })
    })
    sock.on('legion:disbanded', () => {
      setLegion(null)
      setLegionMessages([])
      setLegionTyping([])
      setActiveSection('channels')
      toast({
        title: 'Legion disbanded',
        description: 'The legion has been disbanded by its leader.',
        variant: 'destructive',
      })
    })

    // Legion approval events
    sock.on('legion:approved', (l: Legion) => {
      setLegion(l)
      toast({
        title: 'Legion approved!',
        description: `[${l.tag}] ${l.name} is now live. You can recruit members and post to the Guild Recruitment channel.`,
      })
    })
    sock.on('legion:rejected', (data: { legionId: string; legionName: string; tag: string; reason: string }) => {
      setLegion(null)
      setLegionMessages([])
      setLegionTyping([])
      setActiveSection('channels')
      toast({
        title: 'Legion rejected',
        description: `[${data.tag}] ${data.legionName} was rejected by admin. Reason: ${data.reason}`,
        variant: 'destructive',
      })
    })

    // Legion raid chat events
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

    // Legion recruit confirmation
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
    if (activeSection === 'channels') {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
    } else {
      legionMessagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
    }
  }, [messagesByChannel, legionMessages, activeChannel, activeSection, legion])

  // ---------- Restore username on mount ----------
  useEffect(() => {
    const saved = typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null
    if (saved) {
      Promise.resolve().then(() => setUsernameInput(saved))
    }
  }, [])

  // ---------- Auth handler (called by AuthGate after email+password login) ----------
  const handleAuthed = useCallback(
    (user: AuthUser, token: string) => {
      setAuthUser(user)
      setAuthToken(token)
      setIsRegistering(true)
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
  const handleRegister = useCallback(() => {
    const name = usernameInput.trim()
    if (!name) {
      toast({ title: 'Username required', description: 'Pick a survivor name to continue.', variant: 'destructive' })
      return
    }
    const sock = socketRef.current
    if (!sock || !isConnected) {
      toast({ title: 'Not connected', description: 'Waiting for the server...', variant: 'destructive' })
      return
    }
    localStorage.setItem(STORAGE_KEY, name)
    setIsRegistering(true)
    sock.emit('register', { username: name })
  }, [usernameInput, isConnected, toast])

  const handleSwitchChannel = useCallback(
    (channel: ChannelDef) => {
      const sock = socketRef.current
      if (!sock || !currentUser) return
      if (activeChannel?.id === channel.id && activeSection === 'channels') {
        setShowSidebarMobile(false)
        return
      }
      setActiveSection('channels')
      setActiveChannel(channel)
      sock.emit('join-channel', { channelId: channel.id })
      setShowSidebarMobile(false)
    },
    [currentUser, activeChannel, activeSection],
  )

  const handleSelectLegion = useCallback(() => {
    setActiveSection('legion')
    setShowSidebarMobile(false)
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

  // ---------- Legion handlers ----------
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

  // ---------- Legion recruit handler (leader posts to Guild Recruitment channel) ----------
  const handleLegionRecruit = useCallback((reason: string) => {
    const sock = socketRef.current
    if (!sock) return
    sock.emit('legion:recruit', { reason })
  }, [])

  // ---------- Legion raid handlers ----------
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

  // ---------- Admin handlers (approve/reject pending legions) ----------
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
    setShowSidebarMobile(false)
    // Refresh pending legions + all legions from server
    const sock = socketRef.current
    if (sock) {
      sock.emit('admin:list-pending-legions')
    }
  }, [])

  const handleLogout = useCallback(() => {
    const oldSock = socketRef.current
    if (oldSock) oldSock.disconnect()
    localStorage.removeItem(STORAGE_KEY)
    localStorage.removeItem('lis-chat-token')
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
    setActiveSection('channels')
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

  const filteredChannels = channels.filter(
    (c) =>
      c.name.toLowerCase().includes(channelSearch.toLowerCase()) ||
      c.description.toLowerCase().includes(channelSearch.toLowerCase()),
  )

  // ---------- Render: Auth Gate (email + password) ----------
  if (!authUser) {
    return <AuthGate onAuthed={handleAuthed} />
  }

  // If authed but socket not yet registered, show a brief loading state
  if (!currentUser) {
    return (
      <div className="bg-island min-h-screen flex flex-col items-center justify-center px-4 text-foreground">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Connecting to the island…</p>
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

  return (
    <div className="bg-island min-h-screen flex flex-col text-foreground">
      {/* Top bar */}
      <header className="sticky top-0 z-30 border-b border-border/60 bg-card/80 backdrop-blur supports-[backdrop-filter]:bg-card/60">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between gap-3 px-3 sm:px-4">
          <div className="flex items-center gap-2 min-w-0">
            <button
              onClick={() => setShowSidebarMobile(true)}
              className="md:hidden inline-flex h-9 w-9 items-center justify-center rounded-md border border-border bg-background/60 hover:bg-accent/20"
              aria-label="Open sidebar"
            >
              <Hash className="h-4 w-4" />
            </button>
            <div className="flex items-center gap-2 min-w-0">
              <img
                src="/app-logo.webp"
                alt="Last Island of Survival logo"
                className="h-8 w-8 rounded-md object-cover ring-1 ring-primary/30"
              />
              <div className="min-w-0">
                <h1 className="truncate text-sm font-semibold leading-tight">
                  Last Island of Survival
                </h1>
                <p className="truncate text-[11px] text-muted-foreground leading-tight">
                  Survivor Comms Hub
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span
              className={cn(
                'inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-medium',
                isConnected
                  ? 'bg-emerald-500/15 text-emerald-300'
                  : 'bg-rose-500/15 text-rose-300',
              )}
            >
              {isConnected ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
              {isConnected ? 'Online' : 'Offline'}
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
                <Badge className="h-5 gap-1 bg-amber-500/20 px-1.5 text-[10px] text-amber-200 hover:bg-amber-500/30">
                  <Shield className="h-2.5 w-2.5" />
                  [{legion.tag}]
                </Badge>
              )}
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleLogout}
              title="Leave the island"
              className="h-9 w-9"
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      {/* Main chat layout */}
      <main className="mx-auto flex w-full max-w-7xl flex-1 overflow-hidden px-2 sm:px-4 py-2 gap-2">
        {/* Sidebar — desktop */}
        <aside className="hidden md:flex w-64 lg:w-72 flex-col rounded-xl border border-border bg-card/60 backdrop-blur">
          <Sidebar
            channels={filteredChannels}
            activeChannel={activeChannel}
            activeSection={activeSection}
            onSelectChannel={handleSwitchChannel}
            onSelectLegion={handleSelectLegion}
            onSelectAdmin={authUser?.isAdmin ? handleSelectAdmin : undefined}
            legion={legion}
            search={channelSearch}
            setSearch={setChannelSearch}
            onlineCounts={usersByChannel}
            currentUserId={currentUser.id}
            isAdmin={authUser?.isAdmin}
            pendingLegionsCount={adminPendingLegions.length}
          />
        </aside>

        {/* Sidebar — mobile drawer */}
        {showSidebarMobile && (
          <div className="md:hidden fixed inset-0 z-40 flex">
            <div
              className="absolute inset-0 bg-black/60"
              onClick={() => setShowSidebarMobile(false)}
            />
            <div className="relative z-10 w-72 max-w-[80%] flex flex-col rounded-r-xl border-l border-border bg-card shadow-xl">
              <Sidebar
                channels={filteredChannels}
                activeChannel={activeChannel}
                activeSection={activeSection}
                onSelectChannel={handleSwitchChannel}
                onSelectLegion={handleSelectLegion}
                onSelectAdmin={authUser?.isAdmin ? handleSelectAdmin : undefined}
                legion={legion}
                search={channelSearch}
                setSearch={setChannelSearch}
                onlineCounts={usersByChannel}
                currentUserId={currentUser.id}
                isAdmin={authUser?.isAdmin}
                pendingLegionsCount={adminPendingLegions.length}
              />
            </div>
          </div>
        )}

        {/* Main panel: either game channel, legion, or admin */}
        {activeSection === 'admin' && authUser?.isAdmin ? (
          <section className="flex flex-1 flex-col overflow-hidden rounded-xl border border-rose-500/30 bg-card/60 backdrop-blur min-w-0">
            <AdminPanel
              user={authUser}
              token={authToken || ''}
              onApproveLegion={handleAdminApproveLegion}
              onRejectLegion={handleAdminRejectLegion}
              pendingLegions={adminPendingLegions}
              allLegions={adminAllLegions}
            />
          </section>
        ) : activeSection === 'legion' && legion ? (
          <section className="flex flex-1 flex-col overflow-hidden rounded-xl border border-amber-500/30 bg-card/60 backdrop-blur min-w-0">
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
        ) : activeSection === 'legion' && !legion ? (
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
                      {CHANNEL_ICON[activeChannel?.id || ''] || <Hash className="h-3 w-3" />}
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
            <ScrollArea className="flex-1 scrollbar-survival px-2 sm:px-4 py-3">
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
                        : `${typingList.length} survivors are typing…`}
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
                    className="min-h-[44px] max-h-40 resize-none scrollbar-survival"
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

        {/* Right rail — context-aware */}
        {activeSection === 'channels' && (
          <aside className="hidden lg:flex w-64 flex-col rounded-xl border border-border bg-card/60 backdrop-blur">
            <OnlineUsers users={onlineUsers} currentUser={currentUser} />
          </aside>
        )}

        {/* Legion preview card on right rail when in channels mode */}
        {activeSection === 'channels' && legion && (
          <aside className="hidden xl:flex w-64 flex-col rounded-xl border border-amber-500/30 bg-card/60 backdrop-blur">
            <LegionPreviewCard
              legion={legion}
              isLeader={!!isLeader}
              onClick={() => setActiveSection('legion')}
            />
          </aside>
        )}
      </main>

      {/* Footer */}
      <footer className="mt-auto border-t border-border/60 bg-card/40 px-4 py-2">
        <div className="mx-auto flex max-w-7xl items-center justify-between text-[11px] text-muted-foreground">
          <span className="flex items-center gap-1">
            <Skull className="h-3 w-3" />
            Stay alert. The island never sleeps.
          </span>
          <span className="hidden sm:inline">
            {activeSection === 'legion' && legion
              ? `In legion [${legion.tag}] ${legion.name} · ${legion.memberCount} members · ${legion.tasks.length} tasks`
              : `${onlineUsers.length} survivor${onlineUsers.length === 1 ? '' : 's'} in #${activeChannel?.name}`}
          </span>
        </div>
      </footer>
    </div>
  )
}

/* ----------------------------- Sub-components ----------------------------- */

function LoginGate({
  username,
  setUsername,
  onSubmit,
  isConnected,
  isRegistering,
}: {
  username: string
  setUsername: (v: string) => void
  onSubmit: () => void
  isConnected: boolean
  isRegistering: boolean
}) {
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

        <div className="rounded-xl border border-border bg-card/70 p-6 backdrop-blur shadow-xl">
          <label htmlFor="username" className="text-sm font-medium">
            Pick your survivor name
          </label>
          <p className="mb-3 text-xs text-muted-foreground">
            Used to identify you across all game channels and your legion. You can change it any time.
          </p>
          <Input
            id="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') onSubmit()
            }}
            placeholder="e.g. WastelandWolf"
            maxLength={24}
            className="h-11"
            autoFocus
          />
          <Button
            onClick={onSubmit}
            disabled={!isConnected || isRegistering || !username.trim()}
            className="mt-4 h-11 w-full"
          >
            {isRegistering ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Entering the island…
              </>
            ) : (
              <>
                <Flame className="mr-2 h-4 w-4" />
                Enter the Island
              </>
            )}
          </Button>
          {!isConnected && (
            <p className="mt-3 flex items-center justify-center gap-1 text-xs text-amber-400">
              <Loader2 className="h-3 w-3 animate-spin" />
              Connecting to chat server…
            </p>
          )}
        </div>

        <div className="mt-6 grid grid-cols-2 gap-2 text-center text-xs text-muted-foreground">
          <div className="rounded-lg border border-border bg-card/40 p-3">
            <div className="mb-1 text-lg">⚔️</div>
            8 themed channels
          </div>
          <div className="rounded-lg border border-border bg-card/40 p-3">
            <div className="mb-1 text-lg">🛡️</div>
            Legion system
          </div>
          <div className="rounded-lg border border-border bg-card/40 p-3">
            <div className="mb-1 text-lg">📋</div>
            Leader task assigner
          </div>
          <div className="rounded-lg border border-border bg-card/40 p-3">
            <div className="mb-1 text-lg">📢</div>
            Legion notice board
          </div>
        </div>

        <p className="mt-6 text-center text-[11px] text-muted-foreground">
          By entering, you agree to keep chat respectful. No cheats, no spam, no grief.
        </p>
      </div>
    </div>
  )
}

function Sidebar(props: {
  channels: ChannelDef[]
  activeChannel: ChannelDef | null
  activeSection: Section
  onSelectChannel: (c: ChannelDef) => void
  onSelectLegion: () => void
  onSelectAdmin?: () => void
  legion: Legion | null
  search: string
  setSearch: (v: string) => void
  onlineCounts: Record<string, ChatUser[]>
  currentUserId: string
  isAdmin?: boolean
  pendingLegionsCount?: number
}) {
  const {
    channels,
    activeChannel,
    activeSection,
    onSelectChannel,
    onSelectLegion,
    onSelectAdmin,
    legion,
    search,
    setSearch,
    onlineCounts,
    currentUserId,
    isAdmin,
    pendingLegionsCount = 0,
  } = props

  return (
    <div className="flex h-full flex-col">
      {/* Legion section at top */}
      <div className="border-b border-border/60 p-3">
        <button
          onClick={onSelectLegion}
          className={cn(
            'group flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left transition-colors',
            activeSection === 'legion'
              ? 'bg-amber-500/15 text-amber-200 border border-amber-500/30'
              : 'hover:bg-amber-500/10 border border-transparent',
          )}
        >
          <LegionLogo
            icon={legion ? legion.icon : '🛡️'}
            iconType={legion ? legion.iconType || 'emoji' : 'emoji'}
            size={32}
            className="shrink-0"
          />
          <span className="min-w-0 flex-1">
            <span className="flex items-center justify-between gap-1">
              <span className="truncate text-sm font-semibold">
                {legion ? legion.name : 'My Legion'}
              </span>
              {legion && (
                <span className="shrink-0 rounded bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-mono font-bold text-amber-200">
                  [{legion.tag}]
                </span>
              )}
            </span>
            <span className="block truncate text-[11px] text-muted-foreground">
              {legion
                ? legion.leaderId === currentUserId
                  ? `You lead · ${legion.memberCount} members`
                  : `${legion.memberCount} members · ${legion.tasks.length} tasks`
                : 'Create or join a legion'}
            </span>
          </span>
        </button>
        {legion?.notice && (
          <div className="mt-2 rounded-md bg-amber-500/5 p-2 text-[10px] text-amber-200/80">
            <p className="flex items-center gap-1 font-semibold text-amber-300">
              <Megaphone className="h-2.5 w-2.5" />
              Notice
            </p>
            <p className="mt-0.5 line-clamp-2 break-words">{legion.notice}</p>
          </div>
        )}
      </div>

      {/* Admin section — only for admin users */}
      {isAdmin && onSelectAdmin && (
        <div className="border-b border-border/60 p-3">
          <button
            onClick={onSelectAdmin}
            className={cn(
              'group flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left transition-colors',
              activeSection === 'admin'
                ? 'bg-rose-500/15 text-rose-200 border border-rose-500/30'
                : 'hover:bg-rose-500/10 border border-transparent',
            )}
          >
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-rose-500/20 text-base">
              🛡️
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex items-center justify-between gap-1">
                <span className="truncate text-sm font-semibold">Admin Panel</span>
                {pendingLegionsCount > 0 && (
                  <span className="shrink-0 rounded-full bg-rose-500 px-1.5 py-0.5 text-[10px] font-bold text-rose-50">
                    {pendingLegionsCount}
                  </span>
                )}
              </span>
              <span className="block truncate text-[11px] text-muted-foreground">
                Approve legions · verify users
              </span>
            </span>
          </button>
        </div>
      )}

      <div className="border-b border-border/60 p-3">
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Game Channels
          </h3>
          <Badge variant="secondary" className="text-[10px]">
            {channels.length}
          </Badge>
        </div>
        <div className="relative">
          <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search channels…"
            className="h-8 pl-7 text-xs"
          />
        </div>
      </div>

      <ScrollArea className="flex-1 scrollbar-survival">
        <div className="space-y-0.5 p-2">
          {channels.length === 0 ? (
            <p className="px-2 py-4 text-center text-xs text-muted-foreground">
              No channels match your search.
            </p>
          ) : (
            channels.map((c) => {
              const isActive = activeSection === 'channels' && activeChannel?.id === c.id
              const a = accent(c.accent)
              const count = (onlineCounts[c.id] || []).length
              return (
                <button
                  key={c.id}
                  onClick={() => onSelectChannel(c)}
                  className={cn(
                    'group flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left transition-colors',
                    isActive
                      ? cn(a.bg, a.text, 'border', a.border)
                      : 'hover:bg-accent/10 border border-transparent',
                  )}
                >
                  <span
                    className={cn(
                      'grid h-8 w-8 shrink-0 place-items-center rounded-md text-base',
                      isActive ? a.chipBg : 'bg-muted/60',
                    )}
                  >
                    {c.icon}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center justify-between gap-1">
                      <span className="truncate text-sm font-medium">{c.name}</span>
                      {count > 0 && (
                        <span className="shrink-0 rounded-full bg-background/80 px-1.5 py-0.5 text-[10px] text-muted-foreground">
                          {count}
                        </span>
                      )}
                    </span>
                    <span className="block truncate text-[11px] text-muted-foreground">
                      {c.description}
                    </span>
                  </span>
                </button>
              )
            })
          )}
        </div>
      </ScrollArea>

      <div className="border-t border-border/60 p-3">
        <div className="rounded-lg bg-muted/40 p-2 text-[11px] text-muted-foreground">
          <p className="flex items-center gap-1 font-medium text-foreground">
            <Crown className="h-3 w-3 text-amber-400" />
            Survivor Tip
          </p>
          <p className="mt-1">
            Click <strong>My Legion</strong> to access the private legion chat, member roster, and leader task assigner.
          </p>
        </div>
      </div>
    </div>
  )
}

function LegionPreviewCard({
  legion,
  isLeader,
  onClick,
}: {
  legion: Legion
  isLeader: boolean
  onClick: () => void
}) {
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-border/60 px-3 py-3">
        <h3 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-amber-400">
          <Shield className="h-3.5 w-3.5" />
          My Legion
        </h3>
        {isLeader && (
          <Badge className="h-5 gap-1 bg-amber-500/20 px-1.5 text-[10px] text-amber-200 hover:bg-amber-500/30">
            <Crown className="h-2.5 w-2.5" />
            Leader
          </Badge>
        )}
      </div>
      <div className="flex-1 p-3 space-y-3">
        <div className="flex items-center gap-3">
          <LegionLogo
            icon={legion.icon}
            iconType={legion.iconType || 'emoji'}
            size={48}
          />
          <div className="min-w-0">
            <div className="flex items-center gap-1">
              <span className="truncate text-sm font-semibold">{legion.name}</span>
              <span className="rounded bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-mono font-bold text-amber-200">
                [{legion.tag}]
              </span>
            </div>
            <p className="text-[11px] text-muted-foreground">
              {legion.memberCount} members · {legion.tasks.length} tasks
            </p>
          </div>
        </div>

        {legion.notice ? (
          <div className="rounded-md bg-amber-500/5 p-2 text-[11px]">
            <p className="flex items-center gap-1 font-semibold text-amber-300">
              <Megaphone className="h-2.5 w-2.5" />
              Notice
            </p>
            <p className="mt-1 line-clamp-3 break-words text-foreground/80">{legion.notice}</p>
          </div>
        ) : (
          <div className="rounded-md bg-muted/30 p-2 text-[11px] italic text-muted-foreground">
            No notice set.
          </div>
        )}

        <div className="space-y-1">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Recent Tasks
          </p>
          {legion.tasks.slice(-3).reverse().map((t) => (
            <div key={t.id} className="rounded-md bg-muted/30 p-2 text-[11px]">
              <p className="truncate font-medium">{t.title}</p>
              <p className="text-[10px] text-muted-foreground">
                → {t.assigneeName} · {t.status.replace('_', ' ')}
              </p>
            </div>
          ))}
          {legion.tasks.length === 0 && (
            <p className="text-[11px] italic text-muted-foreground">No tasks assigned yet.</p>
          )}
        </div>
      </div>
      <Separator />
      <div className="p-3">
        <Button size="sm" variant="outline" className="w-full" onClick={onClick}>
          Open Legion HQ
        </Button>
      </div>
    </div>
  )
}

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
        Be the first survivor to break the silence. Send a message below to start the conversation.
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
          Survivors Online
        </h3>
        <Badge variant="secondary" className="text-[10px]">
          {users.length}
        </Badge>
      </div>
      <ScrollArea className="flex-1 scrollbar-survival">
        <div className="space-y-1 p-2">
          {sorted.length === 0 ? (
            <p className="px-2 py-4 text-center text-xs text-muted-foreground">
              No survivors online yet.
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
                    <span className="dot-online absolute -bottom-0 -right-0 h-2.5 w-2.5 rounded-full bg-emerald-500 ring-2 ring-card" />
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
          <span className="h-2 w-2 rounded-full bg-emerald-500" />
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
