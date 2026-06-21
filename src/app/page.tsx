'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { io, Socket } from 'socket.io-client'
import {
  Send,
  Users,
  Flame,
  Shield,
  ShieldCheck,
  LogOut,
  Loader2,
  Wifi,
  WifiOff,
  Crown,
  Megaphone,
  Radio,
  MessageCircle,
  PanelRightOpen,
  PanelRightClose,
  Menu,
  X,
  Trash2,
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
  LegionRole,
  AuthUser,
  RaidAlarm,
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
  { bg: string; text: string; border: string; ring: string; chipBg: string; chipText: string; dot: string; bar: string }
> = {
  flame: {
    bg: 'bg-primary/15',
    text: 'text-primary',
    border: 'border-primary/40',
    ring: 'ring-primary/40',
    chipBg: 'bg-primary/20',
    chipText: 'text-primary',
    dot: 'bg-primary',
    bar: 'bg-primary',
  },
  gold: {
    bg: 'bg-amber-500/15',
    text: 'text-amber-300',
    border: 'border-amber-500/40',
    ring: 'ring-amber-500/40',
    chipBg: 'bg-amber-500/20',
    chipText: 'text-amber-200',
    dot: 'bg-amber-500',
    bar: 'bg-amber-500',
  },
  blood: {
    bg: 'bg-destructive/15',
    text: 'text-destructive',
    border: 'border-destructive/40',
    ring: 'ring-destructive/40',
    chipBg: 'bg-destructive/20',
    chipText: 'text-destructive',
    dot: 'bg-destructive',
    bar: 'bg-destructive',
  },
  olive: {
    bg: 'bg-accent/15',
    text: 'text-accent',
    border: 'border-accent/40',
    ring: 'ring-accent/40',
    chipBg: 'bg-accent/20',
    chipText: 'text-accent',
    dot: 'bg-accent',
    bar: 'bg-accent',
  },
  cyan: {
    bg: 'bg-cyan-500/15',
    text: 'text-cyan-300',
    border: 'border-cyan-500/40',
    ring: 'ring-cyan-500/40',
    chipBg: 'bg-cyan-500/20',
    chipText: 'text-cyan-200',
    dot: 'bg-cyan-500',
    bar: 'bg-cyan-500',
  },
  rust: {
    bg: 'bg-orange-700/15',
    text: 'text-orange-400',
    border: 'border-orange-700/40',
    ring: 'ring-orange-700/40',
    chipBg: 'bg-orange-700/20',
    chipText: 'text-orange-300',
    dot: 'bg-orange-700',
    bar: 'bg-orange-700',
  },
  slate: {
    bg: 'bg-slate-500/15',
    text: 'text-slate-300',
    border: 'border-slate-500/40',
    ring: 'ring-slate-500/40',
    chipBg: 'bg-slate-500/20',
    chipText: 'text-slate-200',
    dot: 'bg-slate-500',
    bar: 'bg-slate-500',
  },
}

const accent = (token: string) => ACCENT_CLASSES[token] || ACCENT_CLASSES.slate

// Sidebar section type
type Section = 'comms' | 'legion' | 'admin'

/**
 * Play a raid alarm siren using the Web Audio API (no external sound file needed).
 * Generates an alternating two-tone siren that repeats 4 times.
 */
function playRaidAlarmSiren() {
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    if (!AudioCtx) return
    const ctx = new AudioCtx()
    const now = ctx.currentTime

    // Siren: alternating 600Hz / 900Hz tones, 4 cycles, ~2.5s total
    const tones = [
      { freq: 600, start: 0, dur: 0.3 },
      { freq: 900, start: 0.3, dur: 0.3 },
      { freq: 600, start: 0.6, dur: 0.3 },
      { freq: 900, start: 0.9, dur: 0.3 },
      { freq: 600, start: 1.2, dur: 0.3 },
      { freq: 900, start: 1.5, dur: 0.3 },
      { freq: 600, start: 1.8, dur: 0.3 },
      { freq: 900, start: 2.1, dur: 0.3 },
    ]

    for (const tone of tones) {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'square'
      osc.frequency.setValueAtTime(tone.freq, now + tone.start)
      gain.gain.setValueAtTime(0, now + tone.start)
      gain.gain.linearRampToValueAtTime(0.18, now + tone.start + 0.02)
      gain.gain.linearRampToValueAtTime(0, now + tone.start + tone.dur)
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start(now + tone.start)
      osc.stop(now + tone.start + tone.dur + 0.02)
    }

    // Close the context after the siren finishes to free resources
    setTimeout(() => ctx.close().catch(() => {}), 2800)
  } catch (err) {
    console.warn('[raid-alarm] could not play siren:', err)
  }
}

/**
 * Convert a base64 string to a Uint8Array (needed for the VAPID applicationServerKey).
 */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = typeof window !== 'undefined' ? window.atob(base64) : Buffer.from(base64, 'base64').toString('binary')
  const output = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; ++i) {
    output[i] = rawData.charCodeAt(i)
  }
  return output
}

/**
 * Register the service worker for background push notifications.
 * Returns the registration or null on failure.
 */
async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return null
  try {
    const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' })
    console.log('[push] service worker registered:', reg.scope)
    return reg
  } catch (err) {
    console.warn('[push] service worker registration failed:', err)
    return null
  }
}

/**
 * Subscribe the current browser to web push notifications.
 * 1. Requests notification permission from the user
 * 2. Creates a PushSubscription using the VAPID public key
 * 3. Returns the subscription (to be sent to the server) or null on failure/denial
 */
async function subscribeToPushNotifications(): Promise<PushSubscription | null> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator) || !('PushManager' in window)) {
    console.warn('[push] push notifications not supported in this browser')
    return null
  }

  // Request notification permission
  const permission = await Notification.requestPermission()
  if (permission !== 'granted') {
    console.log('[push] notification permission denied')
    return null
  }

  try {
    const reg = await navigator.serviceWorker.ready
    // Fetch the VAPID public key from our API
    const res = await fetch('/api/vapid-public-key')
    const data = await res.json()
    if (!data.publicKey) {
      console.warn('[push] no VAPID public key returned')
      return null
    }

    const applicationServerKey = urlBase64ToUint8Array(data.publicKey)
    const subscription = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey,
    })
    console.log('[push] subscribed to push notifications:', subscription.endpoint)
    return subscription
  } catch (err) {
    console.warn('[push] subscription failed:', err)
    return null
  }
}

/**
 * Convert a PushSubscription to a plain object suitable for sending over socket.io.
 */
function serializePushSubscription(sub: PushSubscription) {
  return {
    endpoint: sub.endpoint,
    keys: {
      p256dh: sub.toJSON().keys?.p256dh || '',
      auth: sub.toJSON().keys?.auth || '',
    },
  }
}

export default function Home() {
  const { toast } = useToast()

  // Connection / registration state
  const socketRef = useRef<Socket | null>(null)
  const [isConnected, setIsConnected] = useState(false)
  const [currentUser, setCurrentUser] = useState<ChatUser | null>(null)
  const [channels, setChannels] = useState<ChannelDef[]>([])

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
  const [showMobileNav, setShowMobileNav] = useState(false)

  // Legion state
  const [legion, setLegion] = useState<Legion | null>(null)
  const [openLegions, setOpenLegions] = useState<Legion[]>([])
  const [legionMessages, setLegionMessages] = useState<ChatMessage[]>([])
  const [legionTyping, setLegionTyping] = useState<{ username: string; avatar: string }[]>([])

  // Legion raids state
  const [raidMessages, setRaidMessages] = useState<ChatMessage[]>([])
  const [raidTyping, setRaidTyping] = useState<{ username: string; avatar: string }[]>([])

  // Raid alarm state — when someone says "raid" in legion chat, all members get an alarm
  const [raidAlarm, setRaidAlarm] = useState<RaidAlarm | null>(null)
  const audioCtxRef = useRef<AudioContext | null>(null)
  const alarmTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

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
    // Connect to the chat-service (socket.io) — deployed on Railway.
    // Uses NEXT_PUBLIC_CHAT_SERVICE_URL env var if set, otherwise falls back to the
    // hardcoded Railway production URL (so it works even without the env var).
    const chatServiceUrl = process.env.NEXT_PUBLIC_CHAT_SERVICE_URL || 'https://lios-network-production-b635.up.railway.app'
    const socketUrl = `${chatServiceUrl}/?XTransformPort=3003`

    const sock = io(socketUrl, {
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
        title: 'Welcome to the island',
        description: `Hello, ${data.user.username}. Pick a channel or build your legion.`,
      })
    })

    sock.on('error-message', (data: { message: string }) => {
      toast({ title: 'Error', description: data.message, variant: 'destructive' })
    })

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
      toast({ title: 'Legion founded', description: `You are now the leader of [${l.tag}] ${l.name}.` })
    })
    sock.on('legion:pending', (l: Legion) => {
      setLegion(l)
      setLegionMessages([])
      setActiveSection('legion')
      toast({ title: 'Legion submitted for approval', description: `[${l.tag}] ${l.name} is pending admin approval.` })
    })
    sock.on('legion:joined', (l: Legion) => {
      setLegion(l)
      setActiveSection('legion')
      toast({ title: 'Joined legion', description: `You are now a member of [${l.tag}] ${l.name}.` })
    })
    sock.on('legion:history', (data: { legionId: string; messages: ChatMessage[] }) => {
      setLegionMessages(data.messages)
    })
    sock.on('legion:message', (msg: ChatMessage) => {
      setLegionMessages((prev) => {
        if (prev.some((m) => m.id === msg.id)) return prev
        return [...prev, msg].slice(-200)
      })
      setLegionTyping((prev) => prev.filter((t) => t.username !== msg.username))
    })
    sock.on('legion:update', (l: Legion) => setLegion(l))
    sock.on('legion:typing', (evt: { username: string; avatar: string; isTyping: boolean }) => {
      setLegionTyping((prev) => {
        if (evt.isTyping) {
          if (prev.some((t) => t.username === evt.username)) return prev
          return [...prev, { username: evt.username, avatar: evt.avatar }]
        }
        return prev.filter((t) => t.username !== evt.username)
      })
      if (evt.isTyping) {
        if (legionTypingTimeoutRef.current) clearTimeout(legionTypingTimeoutRef.current)
        legionTypingTimeoutRef.current = setTimeout(() => {
          setLegionTyping((prev) => prev.filter((t) => t.username !== evt.username))
        }, 4000)
      }
    })
    sock.on('legion:list', (list: Legion[]) => setOpenLegions(list))
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
      toast({ title: 'Kicked from legion', description: `You were removed from ${data.legionName}.`, variant: 'destructive' })
    })
    sock.on('legion:disbanded', () => {
      setLegion(null)
      setLegionMessages([])
      setLegionTyping([])
      setActiveSection('comms')
      toast({ title: 'Legion disbanded', description: 'The legion has been disbanded by its leader.', variant: 'destructive' })
    })

    sock.on('legion:approved', (l: Legion) => {
      setLegion(l)
      toast({ title: 'Legion approved!', description: `[${l.tag}] ${l.name} is now live. You can recruit members.` })
    })
    sock.on('legion:rejected', (data: { legionId: string; legionName: string; tag: string; reason: string }) => {
      setLegion(null)
      setLegionMessages([])
      setLegionTyping([])
      setActiveSection('comms')
      toast({ title: 'Legion rejected', description: `[${data.tag}] ${data.legionName} was rejected by admin.`, variant: 'destructive' })
    })

    sock.on('legion:raid:history', (data: { legionId: string; messages: ChatMessage[] }) => setRaidMessages(data.messages))
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

    sock.on('legion:recruit-posted', (data: { message: string }) => {
      toast({ title: 'Recruitment posted', description: data.message })
    })

    // Join request sent (to the requester)
    sock.on('legion:join-requested', (data: { legionId: string; legionName: string; tag: string; message: string }) => {
      toast({
        title: 'Join request sent',
        description: data.message,
      })
    })

    // Join request approved/rejected notifications come through error-message / legion:joined

    // Raid alarm — triggered when someone says "raid" in legion chat
    sock.on('legion:raid-alarm', (alarm: RaidAlarm) => {
      setRaidAlarm(alarm)
      // Play the siren
      playRaidAlarmSiren()
      // Vibrate on mobile (if supported)
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate([400, 200, 400, 200, 400])
      }
      // Show a toast as well
      toast({
        title: '🚨 RAID ALARM',
        description: `${alarm.triggeredBy} sounded the alarm in [${alarm.tag}] ${alarm.legionName}: "${alarm.message}"`,
        variant: 'destructive',
      })
      // Auto-dismiss the banner after 12 seconds
      if (alarmTimeoutRef.current) clearTimeout(alarmTimeoutRef.current)
      alarmTimeoutRef.current = setTimeout(() => setRaidAlarm(null), 12000)
    })

    sock.on('admin:pending-legions', (list: Legion[]) => setAdminPendingLegions(list))
    sock.on('admin:all-legions', (list: Legion[]) => setAdminAllLegions(list))

    return () => {
      sock.disconnect()
    }
  }, [toast])

  useEffect(() => {
    if (activeSection === 'comms') {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
    } else {
      legionMessagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
    }
  }, [messagesByChannel, legionMessages, activeChannel, activeSection, legion])

  const handleAuthed = useCallback((user: AuthUser, token: string) => {
    setAuthUser(user)
    setAuthToken(token)
    const sock = socketRef.current
    if (!sock) {
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
  }, [])

  // ---------- Push notification subscription ----------
  // After the user logs in, register the service worker and subscribe to push notifications
  // so they receive raid alarms even when the app is closed.
  const [pushEnabled, setPushEnabled] = useState(false)
  useEffect(() => {
    if (!authUser) return
    let cancelled = false

    async function setupPush() {
      // Register the service worker
      const swReg = await registerServiceWorker()
      if (!swReg || cancelled) return

      // Subscribe to push
      const subscription = await subscribeToPushNotifications()
      if (!subscription || cancelled) {
        // Permission may have been denied — that's OK, in-app alarm still works
        return
      }

      setPushEnabled(true)

      // Send the subscription to the server via socket
      const sock = socketRef.current
      const serialized = serializePushSubscription(subscription)
      const sendSub = () => {
        const s = socketRef.current
        if (s && s.connected) {
          s.emit('push:subscribe', { email: authUser.email, subscription: serialized })
        } else {
          // Retry after a short delay if socket isn't ready yet
          setTimeout(sendSub, 1000)
        }
      }
      sendSub()
    }

    setupPush()

    return () => {
      cancelled = true
    }
  }, [authUser])

  const handleSwitchChannel = useCallback((channel: ChannelDef) => {
    const sock = socketRef.current
    if (!sock || !currentUser) return
    setActiveSection('comms')
    setActiveChannel(channel)
    sock.emit('join-channel', { channelId: channel.id })
    setShowMobileNav(false)
  }, [currentUser])

  const handleSelectLegion = useCallback(() => {
    setActiveSection('legion')
    setShowMobileNav(false)
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

  const handleDraftChange = useCallback((val: string) => {
    setDraft(val)
    const sock = socketRef.current
    if (!sock || !activeChannel) return
    const now = Date.now()
    if (now - lastTypingSentRef.current > 1500) {
      sock.emit('typing', { channelId: activeChannel.id, isTyping: true })
      lastTypingSentRef.current = now
    }
  }, [activeChannel])

  const handleCreateLegion = useCallback((data: { name: string; tag: string; description: string; icon?: string; iconType?: 'emoji' | 'image'; inGameLegionId?: string; visibility?: 'public' | 'private'; password?: string }) => {
    const sock = socketRef.current
    if (!sock) return
    sock.emit('legion:create', data)
  }, [])

  const handleJoinLegion = useCallback((legionId: string, password?: string) => {
    const sock = socketRef.current
    if (!sock) return
    sock.emit('legion:join', { legionId, password })
  }, [])

  // ---------- Legion join request approval (Captain / Vice Captain) ----------
  const handleApproveJoin = useCallback((requestId: string) => {
    const sock = socketRef.current
    if (!sock) return
    sock.emit('legion:approve-join', { requestId })
  }, [])

  const handleRejectJoin = useCallback((requestId: string) => {
    const sock = socketRef.current
    if (!sock) return
    sock.emit('legion:reject-join', { requestId })
  }, [])

  // ---------- Legion visibility + password (Captain / Vice Captain) ----------
  const handleSetVisibility = useCallback((visibility: 'public' | 'private', password?: string) => {
    const sock = socketRef.current
    if (!sock) return
    sock.emit('legion:set-visibility', { visibility, password })
  }, [])

  const handleSetPassword = useCallback((password: string) => {
    const sock = socketRef.current
    if (!sock) return
    sock.emit('legion:set-password', { password })
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
    if (authToken) {
      fetch('/api/auth/update-cooldown', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: authToken }),
      }).catch(() => {})
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

  const handleLegionTaskAssign = useCallback((data: { assigneeId: string; title: string; description: string }) => {
    const sock = socketRef.current
    if (!sock) return
    sock.emit('legion:task-assign', data)
  }, [])

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

  // ---------- Legion rank assignment (Captain assigns Vice Captain / Elite) ----------
  const handleLegionAssignRole = useCallback((userId: string, role: 'vice_captain' | 'elite' | 'member') => {
    const sock = socketRef.current
    if (!sock) return
    sock.emit('legion:assign-role', { userId, role })
  }, [])

  const handleLegionRecruit = useCallback((reason: string) => {
    const sock = socketRef.current
    if (!sock) return
    sock.emit('legion:recruit', { reason })
  }, [])

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
    setShowMobileNav(false)
    const sock = socketRef.current
    if (sock) sock.emit('admin:list-pending-legions')
  }, [])

  const handleLogout = useCallback(() => {
    const oldSock = socketRef.current
    // Unsubscribe from push notifications (user is logging out)
    if (oldSock && authUser) {
      oldSock.emit('push:unsubscribe', { email: authUser.email })
    }
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
    setPushEnabled(false)
    setTimeout(() => {
      const chatServiceUrl2 = process.env.NEXT_PUBLIC_CHAT_SERVICE_URL || 'https://lios-network-production-b635.up.railway.app'
      const socketUrl2 = `${chatServiceUrl2}/?XTransformPort=3003`
      const sock = io(socketUrl2, {
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
  }, [authUser])

  // ---------- Render: Auth Gate ----------
  if (!authUser) {
    return <AuthGate onAuthed={handleAuthed} />
  }

  if (!currentUser) {
    return (
      <div className="bg-island min-h-screen flex flex-col items-center justify-center px-4 text-foreground">
        <div className="flex flex-col items-center gap-3">
          <Flame className="h-8 w-8 animate-pulse text-primary ember-flicker" />
          <p className="text-sm text-muted-foreground mono-header">Lighting the fire…</p>
        </div>
      </div>
    )
  }

  const messages = activeChannel ? messagesByChannel[activeChannel.id] || [] : []
  const onlineUsers = activeChannel ? usersByChannel[activeChannel.id] || [] : []
  const typingList = activeChannel
    ? Object.values(typingByChannel[activeChannel.id] || {}).filter((t) => t.username !== currentUser.username)
    : []
  const a = activeChannel ? accent(activeChannel.accent) : accent('slate')
  const isLeader = legion && legion.leaderId === currentUser.id

  return (
    <div className="bg-island min-h-screen flex flex-col text-foreground">
      <div className="flex flex-1 overflow-hidden">
        {/* ---------- LEFT ICON RAIL (64px) — NOT Discord's server list ---------- */}
        <aside className="hidden md:flex w-16 shrink-0 flex-col items-center border-r border-border/60 bg-sidebar/80 py-3 gap-2">
          {/* Brand mark */}
          <button
            onClick={() => setActiveSection('comms')}
            className="mb-2 grid h-11 w-11 place-items-center rounded-sm bg-primary/15 ring-1 ring-primary/40 ember-flicker"
            title="Last Island"
          >
            <img src="/island-logo.png" alt="Last Island" className="h-9 w-9 rounded-sm object-cover" />
          </button>

          <div className="h-px w-8 bg-border/60 my-1" />

          {/* Comms nav */}
          <RailButton
            active={activeSection === 'comms'}
            onClick={() => setActiveSection('comms')}
            icon={<MessageCircle className="h-5 w-5" />}
            label="Comms"
          />

          {/* Legion nav */}
          <RailButton
            active={activeSection === 'legion'}
            onClick={handleSelectLegion}
            icon={<Shield className="h-5 w-5" />}
            label="Legion"
            badge={legion ? legion.memberCount : undefined}
          />

          {/* Admin nav */}
          {authUser?.isAdmin && (
            <RailButton
              active={activeSection === 'admin'}
              onClick={handleSelectAdmin}
              icon={<ShieldCheck className="h-5 w-5" />}
              label="Admin"
              badge={adminPendingLegions.length > 0 ? adminPendingLegions.length : undefined}
              badgeVariant="danger"
            />
          )}

          {/* Spacer + status */}
          <div className="mt-auto flex flex-col items-center gap-2">
            <span
              className={cn(
                'inline-flex items-center justify-center rounded-sm p-1.5',
                isConnected ? 'bg-accent/15 text-accent' : 'bg-destructive/15 text-destructive',
              )}
              title={isConnected ? 'Signal: Online' : 'Signal: Offline'}
            >
              {isConnected ? <Wifi className="h-4 w-4" /> : <WifiOff className="h-4 w-4" />}
            </span>
            <button
              onClick={handleLogout}
              className="grid h-10 w-10 place-items-center rounded-sm text-muted-foreground hover:text-foreground hover:bg-muted/40"
              title="Sign out"
            >
              <LogOut className="h-5 w-5" />
            </button>
          </div>
        </aside>

        {/* ---------- MAIN COLUMN ---------- */}
        <div className="flex flex-1 flex-col overflow-hidden min-w-0">
          {/* Top bar */}
          <header className="sticky top-0 z-30 border-b border-border/60 bg-card/80 backdrop-blur supports-[backdrop-filter]:bg-card/60">
            <div className="flex h-14 items-center justify-between gap-3 px-3 sm:px-4">
              <div className="flex items-center gap-2 min-w-0">
                {/* Mobile menu button */}
                <button
                  onClick={() => setShowMobileNav(true)}
                  className="md:hidden inline-flex h-9 w-9 items-center justify-center rounded-sm border border-border bg-background/60 hover:bg-accent/20"
                  aria-label="Open navigation"
                >
                  <Menu className="h-4 w-4" />
                </button>
                {/* Mobile brand */}
                <img src="/island-logo.png" alt="Last Island" className="md:hidden h-8 w-8 rounded-sm object-cover ring-1 ring-primary/30" />
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h1 className="truncate text-sm font-bold leading-tight mono-header">
                      {activeSection === 'comms' && (activeChannel?.name || 'Comms')}
                      {activeSection === 'legion' && (legion ? legion.name : 'Legions')}
                      {activeSection === 'admin' && 'Admin'}
                    </h1>
                    {activeSection === 'comms' && activeChannel && (
                      <span className={cn('hidden sm:inline-flex items-center gap-1 rounded-sm px-2 py-0.5 text-[10px] mono-header', a.chipBg, a.chipText)}>
                        <Radio className="h-2.5 w-2.5" />
                        Channel
                      </span>
                    )}
                    {activeSection === 'legion' && legion && (
                      <span className="rounded-sm bg-primary/20 px-1.5 py-0.5 text-[10px] font-mono font-bold text-primary">
                        [{legion.tag}]
                      </span>
                    )}
                  </div>
                  <p className="truncate text-[11px] text-muted-foreground leading-tight">
                    {activeSection === 'comms' && activeChannel?.description}
                    {activeSection === 'legion' && (legion ? `${legion.memberCount} members · ${legion.tasks.length} tasks` : 'Join or found a legion')}
                    {activeSection === 'admin' && 'Verify users · Approve legions'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {/* Player chip */}
                <div className="hidden sm:flex items-center gap-2 rounded-sm border border-border bg-background/60 px-2 py-1">
                  <Avatar className="h-6 w-6 rounded-sm">
                    <AvatarFallback className="bg-primary/20 text-primary text-xs rounded-sm">
                      {currentUser.avatar}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-xs font-medium font-mono">{currentUser.username}</span>
                  <Badge variant="secondary" className="h-5 px-1.5 text-[10px] rounded-sm font-mono">
                    Lv {currentUser.level}
                  </Badge>
                  {legion && (
                    <Badge className="h-5 gap-1 bg-primary/20 px-1.5 text-[10px] text-primary hover:bg-primary/30 rounded-sm">
                      <Shield className="h-2.5 w-2.5" />
                      [{legion.tag}]
                    </Badge>
                  )}
                  {pushEnabled && (
                    <span
                      className="inline-flex items-center gap-1 rounded-sm bg-accent/15 px-1.5 py-0.5 text-[9px] font-medium text-accent mono-header"
                      title="Push notifications enabled — raid alarms will reach you even when the app is closed"
                    >
                      <Flame className="h-2.5 w-2.5" />
                      ALERTS ON
                    </span>
                  )}
                </div>
                {/* Mobile connection dot */}
                <span
                  className={cn(
                    'sm:hidden inline-flex items-center justify-center rounded-sm p-1.5',
                    isConnected ? 'bg-accent/15 text-accent' : 'bg-destructive/15 text-destructive',
                  )}
                >
                  {isConnected ? <Wifi className="h-4 w-4" /> : <WifiOff className="h-4 w-4" />}
                </span>
                {activeSection === 'comms' && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setShowOnlinePanel((v) => !v)}
                    title="Toggle online survivors"
                    className="h-9 w-9 rounded-sm"
                  >
                    {showOnlinePanel ? <PanelRightClose className="h-4 w-4" /> : <PanelRightOpen className="h-4 w-4" />}
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleLogout}
                  title="Sign out"
                  className="hidden sm:grid h-9 w-9 rounded-sm"
                >
                  <LogOut className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Mobile nav tabs */}
            <nav className="md:hidden flex items-center gap-1 border-t border-border/60 px-2 py-1.5">
              {([
                { id: 'comms' as Section, label: 'Comms', icon: <MessageCircle className="h-3.5 w-3.5" /> },
                { id: 'legion' as Section, label: legion ? 'Legion' : 'Legions', icon: <Shield className="h-3.5 w-3.5" /> },
                ...(authUser?.isAdmin ? [{ id: 'admin' as Section, label: 'Admin', icon: <ShieldCheck className="h-3.5 w-3.5" />, badge: adminPendingLegions.length }] : []),
              ]).map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => tab.id === 'legion' ? handleSelectLegion() : tab.id === 'admin' ? handleSelectAdmin() : setActiveSection('comms')}
                  className={cn(
                    'relative inline-flex flex-1 items-center justify-center gap-1.5 rounded-sm px-2 py-1.5 text-xs font-medium transition-colors mono-header',
                    activeSection === tab.id
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:text-foreground hover:bg-accent/10',
                  )}
                >
                  {tab.icon}
                  {tab.label}
                  {'badge' in tab && tab.badge ? (
                    <span className="ml-1 rounded-full bg-destructive px-1.5 py-0.5 text-[10px] font-bold text-destructive-foreground">
                      {tab.badge}
                    </span>
                  ) : null}
                </button>
              ))}
            </nav>
          </header>

          {/* Horizontal channel tabs — only in comms section (NOT Discord's sidebar list) */}
          {activeSection === 'comms' && (
            <div className="z-20 border-b border-border/60 bg-background/80 backdrop-blur">
              <ScrollArea className="w-full whitespace-nowrap scrollbar-island">
                <div className="flex items-center gap-1.5 px-3 sm:px-4 py-2">
                  {channels.map((c) => {
                    const isActive = activeSection === 'comms' && activeChannel?.id === c.id
                    const ca = accent(c.accent)
                    const count = (usersByChannel[c.id] || []).length
                    return (
                      <button
                        key={c.id}
                        onClick={() => handleSwitchChannel(c)}
                        className={cn(
                          'inline-flex shrink-0 items-center gap-1.5 rounded-sm border px-3 py-1.5 text-xs font-medium transition-all mono-header',
                          isActive
                            ? cn(ca.bg, ca.text, ca.border, 'shadow-sm')
                            : 'border-border bg-card/40 text-muted-foreground hover:text-foreground hover:bg-card/70',
                        )}
                      >
                        <span className="text-sm">{c.icon}</span>
                        <span>{c.name}</span>
                        {count > 0 && (
                          <span className={cn(
                            'ml-0.5 inline-flex h-4 min-w-4 items-center justify-center rounded-sm px-1 text-[10px] font-bold',
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
          )}

          {/* Main panel */}
          <main className="flex flex-1 overflow-hidden p-2 sm:p-3 gap-2">
            {activeSection === 'admin' && authUser?.isAdmin ? (
              <section className="flex flex-1 flex-col overflow-hidden rounded-md border border-border bg-card/60 backdrop-blur min-w-0">
                <AdminPanel
                  user={authUser}
                  token={authToken || ''}
                  onApproveLegion={handleAdminApproveLegion}
                  onRejectLegion={handleAdminRejectLegion}
                  pendingLegions={adminPendingLegions}
                  allLegions={adminAllLegions}
                />
              </section>
            ) : activeSection === 'legion' && legion && legion.status === 'pending' ? (
              <section className="flex flex-1 flex-col overflow-hidden rounded-md border border-primary/30 bg-card/60 backdrop-blur min-w-0">
                <PendingLegionApproval legion={legion} onLeave={handleLegionLeave} onDisband={handleLegionDisband} isLeader={legion.leaderId === currentUser.id} />
              </section>
            ) : activeSection === 'legion' && legion ? (
              <section className="flex flex-1 flex-col overflow-hidden rounded-md border border-primary/30 bg-card/60 backdrop-blur min-w-0">
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
                  onAssignRole={handleLegionAssignRole}
                  onApproveJoin={handleApproveJoin}
                  onRejectJoin={handleRejectJoin}
                  onSetVisibility={handleSetVisibility}
                  onSetPassword={handleSetPassword}
                  raidAlarm={raidAlarm}
                  onDismissAlarm={() => {
                    setRaidAlarm(null)
                    if (alarmTimeoutRef.current) clearTimeout(alarmTimeoutRef.current)
                  }}
                />
              </section>
            ) : activeSection === 'legion' && !legion ? (
              <section className="flex flex-1 flex-col overflow-hidden rounded-md border border-border bg-card/60 backdrop-blur min-w-0">
                <LegionOnboarding
                  openLegions={openLegions}
                  onCreate={handleCreateLegion}
                  onJoin={handleJoinLegion}
                  onRefresh={handleRefreshLegions}
                />
              </section>
            ) : (
              <section className="flex flex-1 flex-col overflow-hidden rounded-md border border-border bg-card/60 backdrop-blur min-w-0">
                {/* Channel header */}
                <div className="flex items-center justify-between gap-2 border-b border-border/60 px-3 sm:px-4 py-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={cn(
                        'grid h-10 w-10 shrink-0 place-items-center rounded-sm text-xl ring-1',
                        a.bg,
                        a.text,
                        a.ring,
                      )}
                    >
                      {activeChannel?.icon || '#'}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h2 className="truncate font-semibold leading-tight mono-header">
                          {activeChannel?.name || '—'}
                        </h2>
                      </div>
                      <p className="truncate text-xs text-muted-foreground">
                        {activeChannel?.description}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge variant="outline" className="gap-1 rounded-sm mono-header">
                      <Users className="h-3 w-3" />
                      {onlineUsers.length}
                    </Badge>
                  </div>
                </div>

                {/* Messages */}
                <ScrollArea className="flex-1 scrollbar-island px-2 sm:px-4 py-3">
                  <div className="mx-auto max-w-3xl space-y-1">
                    {messages.length === 0 ? (
                      <EmptyChannel channelName={activeChannel?.name || 'this channel'} />
                    ) : (
                      messages.map((msg) => (
                        <MessageRow
                          key={msg.id}
                          msg={msg}
                          isSelf={msg.username === currentUser.username}
                          accentColor={a}
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
                        placeholder={`Broadcast on #${activeChannel?.name || ''}…`}
                        rows={1}
                        className="min-h-[44px] max-h-40 resize-none scrollbar-island rounded-sm"
                        disabled={!isConnected}
                      />
                      <p className="mt-1 px-1 text-[10px] text-muted-foreground">
                        Press <kbd className="rounded-sm bg-muted px-1 py-0.5">Enter</kbd> to broadcast,
                        <kbd className="ml-1 rounded-sm bg-muted px-1 py-0.5">Shift</kbd>+
                        <kbd className="rounded-sm bg-muted px-1 py-0.5">Enter</kbd> for new line
                      </p>
                    </div>
                    <Button
                      onClick={handleSend}
                      disabled={!isConnected || !draft.trim()}
                      size="icon"
                      className="h-11 w-11 shrink-0 rounded-sm"
                      aria-label="Send message"
                    >
                      <Send className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </section>
            )}

            {/* Right rail — online survivors (togglable, NOT persistent like Discord) */}
            {activeSection === 'comms' && showOnlinePanel && (
              <aside className="hidden md:flex w-64 flex-col rounded-md border border-border bg-card/60 backdrop-blur">
                <OnlineUsers users={onlineUsers} currentUser={currentUser} onClose={() => setShowOnlinePanel(false)} />
              </aside>
            )}

            {/* Mobile online drawer */}
            {activeSection === 'comms' && showOnlinePanel && (
              <div className="md:hidden fixed inset-0 z-40 flex justify-end">
                <div className="absolute inset-0 bg-black/60" onClick={() => setShowOnlinePanel(false)} />
                <div className="relative z-10 w-72 max-w-[80%] flex flex-col rounded-l-md border-r border-border bg-card shadow-xl">
                  <OnlineUsers users={onlineUsers} currentUser={currentUser} onClose={() => setShowOnlinePanel(false)} />
                </div>
              </div>
            )}
          </main>
        </div>
      </div>

      {/* Mobile nav drawer */}
      {showMobileNav && (
        <div className="md:hidden fixed inset-0 z-40 flex">
          <div className="absolute inset-0 bg-black/60" onClick={() => setShowMobileNav(false)} />
          <div className="relative z-10 w-16 flex flex-col items-center border-r border-border bg-sidebar py-3 gap-2">
            <button
              onClick={() => { setActiveSection('comms'); setShowMobileNav(false) }}
              className="grid h-11 w-11 place-items-center rounded-sm bg-primary/15 ring-1 ring-primary/40 mb-2"
            >
              <img src="/island-logo.png" alt="Last Island" className="h-9 w-9 rounded-sm object-cover" />
            </button>
            <div className="h-px w-8 bg-border/60 my-1" />
            <RailButton active={activeSection === 'comms'} onClick={() => { setActiveSection('comms'); setShowMobileNav(false) }} icon={<MessageCircle className="h-5 w-5" />} label="Comms" />
            <RailButton active={activeSection === 'legion'} onClick={() => { handleSelectLegion(); }} icon={<Shield className="h-5 w-5" />} label="Legion" badge={legion ? legion.memberCount : undefined} />
            {authUser?.isAdmin && (
              <RailButton active={activeSection === 'admin'} onClick={() => { handleSelectAdmin(); }} icon={<ShieldCheck className="h-5 w-5" />} label="Admin" badge={adminPendingLegions.length > 0 ? adminPendingLegions.length : undefined} badgeVariant="danger" />
            )}
            <div className="mt-auto flex flex-col items-center gap-2">
              <span className={cn('inline-flex items-center justify-center rounded-sm p-1.5', isConnected ? 'bg-accent/15 text-accent' : 'bg-destructive/15 text-destructive')}>
                {isConnected ? <Wifi className="h-4 w-4" /> : <WifiOff className="h-4 w-4" />}
              </span>
              <button onClick={() => { handleLogout(); }} className="grid h-10 w-10 place-items-center rounded-sm text-muted-foreground hover:text-foreground hover:bg-muted/40" title="Sign out">
                <LogOut className="h-5 w-5" />
              </button>
            </div>
          </div>
          <button onClick={() => setShowMobileNav(false)} className="flex-1 flex items-start justify-end p-3">
            <X className="h-5 w-5 text-foreground/60" />
          </button>
        </div>
      )}

      {/* Footer — sticky to bottom */}
      <footer className="mt-auto border-t border-border/60 bg-card/40 px-4 py-2">
        <div className="mx-auto flex max-w-7xl items-center justify-between text-[11px] text-muted-foreground">
          <span className="flex items-center gap-1.5 mono-header">
            <Flame className="h-3 w-3 text-primary" />
            Stay Alert · The Island Never Sleeps
          </span>
          <span className="hidden sm:inline font-mono">
            {activeSection === 'legion' && legion
              ? `In legion [${legion.tag}] ${legion.name} · ${legion.memberCount} members · ${legion.tasks.length} tasks`
              : activeSection === 'admin'
                ? `${adminPendingLegions.length} pending approvals · ${adminAllLegions.length} total legions`
                : `${onlineUsers.length} survivors in #${activeChannel?.name || ''}`}
          </span>
        </div>
      </footer>
    </div>
  )
}

/* ----------------------------- Sub-components ----------------------------- */

/** Left rail icon button (NOT a Discord server icon) */
function RailButton({
  active,
  onClick,
  icon,
  label,
  badge,
  badgeVariant = 'default',
}: {
  active: boolean
  onClick: () => void
  icon: React.ReactNode
  label: string
  badge?: number
  badgeVariant?: 'default' | 'danger'
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'group relative grid h-11 w-11 place-items-center rounded-sm transition-all',
        active
          ? 'bg-primary/20 text-primary ring-1 ring-primary/40'
          : 'text-muted-foreground hover:text-foreground hover:bg-muted/40',
      )}
      title={label}
    >
      {/* Active left bar indicator */}
      {active && <span className="absolute -left-3 top-1/2 h-6 w-1 -translate-y-1/2 rounded-r-sm bg-primary" />}
      {icon}
      {badge ? (
        <span
          className={cn(
            'absolute -right-1 -top-1 grid h-4 min-w-4 place-items-center rounded-full px-1 text-[10px] font-bold',
            badgeVariant === 'danger'
              ? 'bg-destructive text-destructive-foreground'
              : 'bg-accent text-accent-foreground',
          )}
        >
          {badge}
        </span>
      ) : null}
      {/* Tooltip label on hover (desktop) */}
      <span className="pointer-events-none absolute left-12 z-50 hidden whitespace-nowrap rounded-sm border border-border bg-popover px-2 py-1 text-[11px] text-foreground shadow-md group-hover:block mono-header">
        {label}
      </span>
    </button>
  )
}

function MessageRow({ msg, isSelf, accentColor }: { msg: ChatMessage; isSelf: boolean; accentColor: typeof ACCENT_CLASSES[keyof typeof ACCENT_CLASSES] }) {
  if (msg.type === 'system') {
    return (
      <div className="msg-in flex items-center justify-center py-1.5">
        <span className="rounded-sm bg-muted/40 px-3 py-0.5 text-[11px] italic text-muted-foreground mono-header">
          ⚙️ {msg.content} · {formatTime(msg.timestamp)}
        </span>
      </div>
    )
  }
  return (
    <div className={cn('msg-in group flex items-start gap-3 rounded-sm px-2 py-1.5 hover:bg-accent/5', isSelf && cn(accentColor.bg, 'border-l-2', accentColor.bar ? '' : ''))}>
      <Avatar className="h-8 w-8 shrink-0 rounded-sm">
        <AvatarFallback
          className={cn(
            'text-sm rounded-sm',
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
          <span className="text-[10px] text-muted-foreground font-mono">{formatTime(msg.timestamp)}</span>
        </div>
        <p className="whitespace-pre-wrap break-words text-sm leading-snug text-foreground/90">
          {msg.content}
        </p>
      </div>
    </div>
  )
}

/** Pending Legion Approval screen — shown when a legion is awaiting admin approval */
function PendingLegionApproval({ legion, onLeave, onDisband, isLeader }: { legion: Legion; onLeave: () => void; onDisband: () => void; isLeader: boolean }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center overflow-hidden p-4 panel-in">
      <div className="w-full max-w-md text-center">
        <div className="mx-auto mb-4 grid h-20 w-20 place-items-center rounded-sm bg-primary/15 text-5xl ring-2 ring-primary/30 ember-flicker">
          ⏳
        </div>
        <div className="mb-2 inline-flex items-center gap-1.5 rounded-sm border border-primary/40 bg-primary/10 px-3 py-1 text-[10px] mono-header text-primary">
          <ShieldCheck className="h-3 w-3" />
          PENDING ADMIN APPROVAL
        </div>
        <h2 className="text-xl font-bold tracking-tight mono-header">{legion.name}</h2>
        <div className="mt-1 flex items-center justify-center gap-2">
          <span className="rounded-sm bg-primary/20 px-2 py-0.5 text-xs font-mono font-bold text-primary">
            [{legion.tag}]
          </span>
          <span className="text-xs text-muted-foreground">In-game ID: {legion.inGameLegionId}</span>
        </div>

        <div className="mt-6 rounded-sm border border-primary/30 bg-primary/5 p-4 text-left">
          <p className="text-sm font-semibold text-primary mono-header mb-2">⏳ Awaiting Approval</p>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Your legion has been submitted for admin approval. The admin
            (<span className="font-mono text-primary">zadxoy@gmail.com</span>) must approve it before you can:
          </p>
          <ul className="mt-2 space-y-1 text-xs text-muted-foreground list-disc list-inside">
            <li>Access the legion chat</li>
            <li>Assign tasks to members</li>
            <li>Post the legion notice</li>
            <li>Recruit players to the Legion Recruitment channel</li>
            <li>Use the raid planning chat</li>
          </ul>
          <p className="mt-3 text-xs text-foreground/80">
            You'll be notified automatically once the admin approves your legion.
          </p>
        </div>

        <div className="mt-4 flex items-center justify-center gap-2">
          <LegionLogo icon={legion.icon} iconType={legion.iconType || 'emoji'} size={32} />
          <span className="text-xs text-muted-foreground">{legion.memberCount} member{legion.memberCount === 1 ? '' : 's'}</span>
        </div>

        <div className="mt-6 flex gap-2 justify-center">
          <Button variant="outline" className="rounded-sm mono-header" onClick={onLeave}>
            <LogOut className="mr-2 h-4 w-4" />
            Leave Legion
          </Button>
          {isLeader && (
            <Button variant="ghost" className="rounded-sm text-destructive hover:text-destructive mono-header" onClick={onDisband}>
              <Trash2 className="mr-2 h-4 w-4" />
              Disband
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}

function EmptyChannel({ channelName }: { channelName: string }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
      <div className="mb-3 grid h-14 w-14 place-items-center rounded-sm bg-muted/40 text-3xl">
        📭
      </div>
      <h3 className="text-sm font-semibold mono-header">No transmissions in #{channelName}</h3>
      <p className="mt-1 max-w-xs text-xs text-muted-foreground">
        Be the first to break the silence. Broadcast a message below to start the conversation.
      </p>
    </div>
  )
}

function OnlineUsers({
  users,
  currentUser,
  onClose,
}: {
  users: ChatUser[]
  currentUser: ChatUser
  onClose?: () => void
}) {
  const sorted = [...users].sort((a, b) => {
    if (a.id === currentUser.id) return -1
    if (b.id === currentUser.id) return 1
    return a.username.localeCompare(b.username)
  })
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-border/60 px-3 py-3">
        <h3 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground mono-header">
          <Users className="h-3.5 w-3.5" />
          Survivors Online
        </h3>
        <div className="flex items-center gap-1">
          <Badge variant="secondary" className="text-[10px] rounded-sm">{users.length}</Badge>
          {onClose && (
            <Button size="icon" variant="ghost" className="h-6 w-6 rounded-sm" onClick={onClose}>
              <X className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </div>
      <ScrollArea className="flex-1 scrollbar-island">
        <div className="space-y-1 p-2">
          {sorted.length === 0 ? (
            <p className="px-2 py-4 text-center text-xs text-muted-foreground mono-header">
              No survivors online yet.
            </p>
          ) : (
            sorted.map((u) => {
              const isSelf = u.id === currentUser.id
              return (
                <div
                  key={u.id}
                  className={cn(
                    'flex items-center gap-2 rounded-sm px-2 py-1.5',
                    isSelf ? 'bg-primary/10' : 'hover:bg-accent/10',
                  )}
                >
                  <div className="relative">
                    <Avatar className="h-7 w-7 rounded-sm">
                      <AvatarFallback className="bg-muted text-xs rounded-sm">{u.avatar}</AvatarFallback>
                    </Avatar>
                    <span className="signal-pulse absolute -bottom-0 -right-0 h-2.5 w-2.5 rounded-full bg-accent ring-2 ring-card" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1">
                      <span className="truncate text-xs font-medium font-mono">
                        {u.username}
                        {isSelf && <span className="ml-1 text-[10px] text-muted-foreground">(you)</span>}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                      <Badge variant="outline" className="h-4 px-1 text-[9px] rounded-sm font-mono">
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
      <div className="p-3 text-[11px] text-muted-foreground mono-header">
        <p className="flex items-center gap-1">
          <span className="signal-pulse h-2 w-2 rounded-full bg-accent" />
          Online Now
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
