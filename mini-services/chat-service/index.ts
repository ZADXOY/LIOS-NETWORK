import { createServer } from 'http'
import { Server, Socket } from 'socket.io'
import webpush from 'web-push'
import { VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT } from './vapid-config.ts'

// Configure web-push with VAPID keys
webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY)

const httpServer = createServer()
const io = new Server(httpServer, {
  // DO NOT change the path, it is used by Caddy to forward the request to the correct port
  path: '/',
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
  pingTimeout: 60000,
  pingInterval: 25000,
})

// ---------- Types ----------
interface User {
  id: string // socket id
  username: string
  email: string
  avatar: string // emoji
  level: number
  joinedAt: Date
  legionId: string | null // legion the user currently belongs to
  isAdmin: boolean
  legionLeftAt: Date | null // cooldown timestamp — can't join another legion for 24h after leaving
  inGameLegionId: string | null
}

interface ChatMessage {
  id: string
  channelId: string // game channel id OR `legion:<legionId>` OR `legion-raids:<legionId>`
  username: string
  avatar: string
  content: string
  timestamp: string
  type: 'user' | 'system'
}

interface ChannelDef {
  id: string
  name: string
  description: string
  icon: string
  accent: string
}

type LegionRole = 'captain' | 'vice_captain' | 'elite' | 'member'

/** Raid alarm payload sent to all legion members when someone says "raid". */
interface RaidAlarm {
  legionId: string
  legionName: string
  tag: string
  triggeredBy: string
  avatar: string
  message: string
  channelId: string
  timestamp: string
}

interface LegionMember {
  userId: string
  username: string
  avatar: string
  level: number
  role: LegionRole
  joinedAt: string
  email: string // needed to look up push subscriptions for offline members
}

type LegionTaskStatus = 'pending' | 'in_progress' | 'done' | 'failed'

interface LegionTask {
  id: string
  title: string
  description: string
  assigneeId: string // user id of the assignee
  assigneeName: string
  assignerId: string // leader
  assignerName: string
  status: LegionTaskStatus
  createdAt: string
  updatedAt: string
}

type LegionStatus = 'pending' | 'approved' | 'rejected'

interface Legion {
  id: string
  name: string
  tag: string // short tag, e.g. "WLF"
  description: string
  /** Logo identifier. Either an emoji string OR a path/URL to an uploaded image */
  icon: string
  /** 'emoji' if icon is an emoji string, 'image' if icon is a URL/path */
  iconType: 'emoji' | 'image'
  /** In-game legion ID (provided by leader at creation) */
  inGameLegionId: string
  leaderId: string
  leaderEmail: string
  members: Map<string, LegionMember> // userId -> member
  notice: string | null
  noticeUpdatedAt: string | null
  noticeUpdatedBy: string | null
  tasks: LegionTask[]
  createdAt: string
  chatHistory: ChatMessage[]
  raidChatHistory: ChatMessage[]
  /** 'pending' = awaiting admin approval, 'approved' = live, 'rejected' = denied */
  status: LegionStatus
}

// ---------- Predefined game channels ----------
const CHANNELS: ChannelDef[] = [
  { id: 'general', name: 'General', description: 'Main chat for all survivors', icon: '🏝️', accent: 'flame' },
  { id: 'trading', name: 'Trading Post', description: 'Buy, sell & trade loot', icon: '💱', accent: 'gold' },
  { id: 'pvp', name: 'PvP Arena', description: 'Find duel partners and rivals', icon: '⚔️', accent: 'blood' },
  { id: 'guilds', name: 'Legion Recruitment', description: 'Recruit or join a legion', icon: '🛡️', accent: 'olive' },
  { id: 'help', name: 'Help & Guides', description: 'Tips, quests and strategies', icon: '📜', accent: 'cyan' },
  { id: 'base-building', name: 'Base Building', description: 'Show off your fortress', icon: '🏗️', accent: 'rust' },
  { id: 'off-topic', name: 'Off-Topic', description: 'Anything goes', icon: '💬', accent: 'slate' },
]

const MAX_HISTORY = 50
const COOLDOWN_MS = 24 * 60 * 60 * 1000 // 24 hours
const RAID_ALARM_COOLDOWN_MS = 30 * 1000 // 30 seconds between raid alarms per legion

// Rank limits — enforced when the Captain assigns roles
const MAX_VICE_CAPTAINS = 1
const MAX_ELITES = 3

// ---------- State ----------
const users = new Map<string, User>() // socketId -> user
const channelHistory = new Map<string, ChatMessage[]>()
const channelUsers = new Map<string, Set<string>>()

// Legion state
const legions = new Map<string, Legion>() // legionId -> legion
const userLegion = new Map<string, string>() // socketId -> legionId (for quick lookup)
const raidAlarmCooldown = new Map<string, number>() // legionId -> last alarm timestamp (ms)

// Push notification subscriptions — keyed by email so they persist across socket reconnects.
// A user subscribes once (per browser/device) and receives push notifications even when the app is closed.
const pushSubscriptions = new Map<string, PushSubscriptionLike>() // email -> subscription

// Minimal shape of a web push subscription (what the browser sends us)
interface PushSubscriptionLike {
  endpoint: string
  keys: { p256dh: string; auth: string }
}

for (const c of CHANNELS) {
  channelHistory.set(c.id, [])
  channelUsers.set(c.id, new Set())
}

// ---------- Helpers ----------
const AVATARS = ['🦊', '🦅', '🐺', '🐻', '🦝', '🐍', '🦖', '🦈', '🐊', '🦂', '🐲', '🦉']
const LEGION_ICONS = ['🛡️', '⚔️', '🦅', '🐺', '🐉', '🔥', '💀', '👑', '⚜️', '🔱', '🎯', '⚡']
const generateId = (prefix = '') => prefix + Math.random().toString(36).slice(2, 10)
const pickAvatar = (seed: string) => {
  let sum = 0
  for (let i = 0; i < seed.length; i++) sum += seed.charCodeAt(i)
  return AVATARS[sum % AVATARS.length]
}
const pickLegionIcon = (seed: string) => {
  let sum = 0
  for (let i = 0; i < seed.length; i++) sum += seed.charCodeAt(i)
  return LEGION_ICONS[sum % LEGION_ICONS.length]
}
const randomLevel = () => Math.floor(Math.random() * 80) + 1

const createSystemMessage = (channelId: string, content: string): ChatMessage => ({
  id: generateId(),
  channelId,
  username: 'System',
  avatar: '⚙️',
  content,
  timestamp: new Date().toISOString(),
  type: 'system',
})

const createUserMessage = (
  channelId: string,
  user: User,
  content: string,
): ChatMessage => ({
  id: generateId(),
  channelId,
  username: user.username,
  avatar: user.avatar,
  content,
  timestamp: new Date().toISOString(),
  type: 'user',
})

const pushGameChannelHistory = (channelId: string, msg: ChatMessage) => {
  const list = channelHistory.get(channelId) || []
  list.push(msg)
  if (list.length > MAX_HISTORY) list.shift()
  channelHistory.set(channelId, list)
}

const pushLegionHistory = (legion: Legion, msg: ChatMessage) => {
  legion.chatHistory.push(msg)
  if (legion.chatHistory.length > MAX_HISTORY) legion.chatHistory.shift()
}

const pushLegionRaidHistory = (legion: Legion, msg: ChatMessage) => {
  legion.raidChatHistory.push(msg)
  if (legion.raidChatHistory.length > MAX_HISTORY) legion.raidChatHistory.shift()
}

const broadcastGameChannelUsers = (channelId: string) => {
  const set = channelUsers.get(channelId) || new Set<string>()
  const list = Array.from(set)
    .map((sid) => users.get(sid))
    .filter((u): u is User => !!u)
    .map((u) => ({
      id: u.id,
      username: u.username,
      avatar: u.avatar,
      level: u.level,
      joinedAt: u.joinedAt.toISOString(),
    }))
    .sort((a, b) => a.username.localeCompare(b.username))
  io.to(`channel:${channelId}`).emit('channel-users', { channelId, users: list })
}

/** Check if a user is still in the 24h legion join cooldown. Returns null if clear, or ms remaining. */
const legionCooldownRemaining = (legionLeftAt: Date | null): number | null => {
  if (!legionLeftAt) return null
  const elapsed = Date.now() - legionLeftAt.getTime()
  if (elapsed >= COOLDOWN_MS) return null
  return COOLDOWN_MS - elapsed
}

/** Format ms remaining as a human-readable string. */
const formatCooldown = (ms: number): string => {
  const hours = Math.floor(ms / (60 * 60 * 1000))
  const minutes = Math.floor((ms % (60 * 60 * 1000)) / (60 * 1000))
  if (hours > 0) return `${hours}h ${minutes}m`
  return `${minutes}m`
}

// Serialize legion for client (members Map -> array)
const serializeLegion = (legion: Legion) => ({
  id: legion.id,
  name: legion.name,
  tag: legion.tag,
  description: legion.description,
  icon: legion.icon,
  iconType: legion.iconType,
  inGameLegionId: legion.inGameLegionId,
  leaderId: legion.leaderId,
  leaderEmail: legion.leaderEmail,
  members: Array.from(legion.members.values()).sort((a, b) => {
    if (a.role === 'leader' && b.role !== 'leader') return -1
    if (b.role === 'leader' && a.role !== 'leader') return 1
    return a.username.localeCompare(b.username)
  }),
  notice: legion.notice,
  noticeUpdatedAt: legion.noticeUpdatedAt,
  noticeUpdatedBy: legion.noticeUpdatedBy,
  tasks: legion.tasks,
  createdAt: legion.createdAt,
  memberCount: legion.members.size,
  status: legion.status,
})

const emitLegionUpdate = (legion: Legion) => {
  const serialized = serializeLegion(legion)
  io.to(`legion:${legion.id}`).emit('legion:update', serialized)
}

const emitLegionMessage = (legion: Legion, msg: ChatMessage) => {
  io.to(`legion:${legion.id}`).emit('legion:message', msg)
}

const emitLegionRaidMessage = (legion: Legion, msg: ChatMessage) => {
  io.to(`legion-raids:${legion.id}`).emit('legion:raid:message', msg)
}

/**
 * Detect if a message should trigger a raid alarm.
 * Triggers when the word "raid" appears (case-insensitive, whole word or as part of "raids"/"raiding").
 */
const shouldTriggerRaidAlarm = (content: string): boolean => {
  return /\braid(s|ing|ed)?\b/i.test(content)
}

/**
 * Trigger a raid alarm for all members of a legion (with a 30s cooldown per legion).
 * Emits a `legion:raid-alarm` event to everyone in the legion room + the raids room.
 */
const triggerRaidAlarm = (
  socket: Socket,
  legion: Legion,
  user: User,
  content: string,
  channelId: string,
): boolean => {
  const now = Date.now()
  const last = raidAlarmCooldown.get(legion.id) || 0
  if (now - last < RAID_ALARM_COOLDOWN_MS) {
    // On cooldown — don't alarm again, but still send a soft notice to the sender
    const remaining = Math.ceil((RAID_ALARM_COOLDOWN_MS - (now - last)) / 1000)
    socket.emit('error-message', {
      message: `Raid alarm on cooldown — ${remaining}s remaining. The legion was already alerted recently.`,
      cooldown: true,
    })
    return false
  }

  raidAlarmCooldown.set(legion.id, now)
  const alarm: RaidAlarm = {
    legionId: legion.id,
    legionName: legion.name,
    tag: legion.tag,
    triggeredBy: user.username,
    avatar: user.avatar,
    message: content,
    channelId,
    timestamp: new Date().toISOString(),
  }
  // Emit to everyone in the legion room (including sender so they see confirmation)
  io.to(`legion:${legion.id}`).emit('legion:raid-alarm', alarm)
  // Also emit to anyone in the raids room
  io.to(`legion-raids:${legion.id}`).emit('legion:raid-alarm', alarm)
  console.log(`[legion] RAID ALARM triggered in [${legion.tag}] ${legion.name} by ${user.username}`)

  // ---- PUSH NOTIFICATIONS ----
  // Send a web push notification to every legion member who has a push subscription,
  // so they receive the alarm even if the app is closed. Each member's email is stored
  // on the LegionMember object, and push subscriptions are keyed by email.
  const pushPayload = JSON.stringify({
    title: `🚨 RAID ALARM [${legion.tag}]`,
    body: `${user.username}: ${content}`,
    tag: `raid-alarm-${legion.id}`,
    icon: '/island-logo.png',
    badge: '/island-logo.png',
    requireInteraction: true,
    data: {
      url: '/',
      legionId: legion.id,
      type: 'raid-alarm',
    },
  })

  let pushSent = 0
  for (const m of legion.members.values()) {
    if (!m.email) continue
    const sub = pushSubscriptions.get(m.email)
    if (!sub) continue
    // Don't send a push to the person who triggered the alarm (they're online)
    if (m.email === user.email) continue
    webpush.sendNotification(sub, pushPayload).then(() => {
      pushSent++
    }).catch((err) => {
      // 410 = subscription expired/unsubscribed — remove it
      if (err.statusCode === 410 || err.statusCode === 404) {
        pushSubscriptions.delete(m.email)
        console.log(`[push] removed expired subscription for ${m.email}`)
      } else {
        console.error(`[push] failed to send to ${m.email}:`, err.statusCode, err.message)
      }
    })
  }

  return true
}

/** Count members of a given role in a legion. */
const countRole = (legion: Legion, role: LegionRole): number => {
  let count = 0
  for (const m of legion.members.values()) {
    if (m.role === role) count++
  }
  return count
}

/** Get all admin sockets currently connected. */
const getAdminSockets = (): Socket[] => {
  const result: Socket[] = []
  for (const [sid, user] of users.entries()) {
    if (user.isAdmin) {
      const sock = io.sockets.sockets.get(sid)
      if (sock) result.push(sock)
    }
  }
  return result
}

/** Notify all admins of the current pending legions list. */
const broadcastPendingLegions = () => {
  const pending = Array.from(legions.values())
    .filter((l) => l.status === 'pending')
    .map(serializeLegion)
  for (const adminSock of getAdminSockets()) {
    adminSock.emit('admin:pending-legions', pending)
  }
}

/** Notify all admins of all legions (approved + pending). */
const broadcastAllLegionsToAdmins = () => {
  const all = Array.from(legions.values()).map(serializeLegion)
  for (const adminSock of getAdminSockets()) {
    adminSock.emit('admin:all-legions', all)
  }
}

// ---------- Connection ----------
io.on('connection', (socket: Socket) => {
  console.log(`[chat] connected: ${socket.id}`)

  // Handshake: register user with auth info from the Next.js API
  socket.on('register', (data: {
    username: string
    email: string
    isAdmin?: boolean
    legionLeftAt?: string | null
    inGameLegionId?: string | null
  }) => {
    const username = (data?.username || '').trim().slice(0, 24)
    const email = (data?.email || '').trim().toLowerCase()
    if (!username || !email) {
      socket.emit('error-message', { message: 'Username and email are required' })
      return
    }

    const user: User = {
      id: socket.id,
      username,
      email,
      avatar: pickAvatar(username),
      level: randomLevel(),
      joinedAt: new Date(),
      legionId: null,
      isAdmin: !!data?.isAdmin,
      legionLeftAt: data?.legionLeftAt ? new Date(data.legionLeftAt) : null,
      inGameLegionId: data?.inGameLegionId || null,
    }
    users.set(socket.id, user)

    socket.emit('registered', { user, channels: CHANNELS })
    console.log(`[chat] registered: ${username} (${email}) admin=${user.isAdmin}`)

    // If admin, send them the pending legions list immediately
    if (user.isAdmin) {
      broadcastPendingLegions()
      broadcastAllLegionsToAdmins()
    }
  })

  // ---------- PUSH NOTIFICATION SUBSCRIPTION ----------
  // Client sends their web push subscription so the server can send them push
  // notifications (raid alarms) even when the app is closed.
  socket.on('push:subscribe', (data: { email: string; subscription: PushSubscriptionLike }) => {
    const email = (data?.email || '').trim().toLowerCase()
    if (!email || !data?.subscription?.endpoint || !data?.subscription?.keys) {
      socket.emit('error-message', { message: 'Invalid push subscription' })
      return
    }
    pushSubscriptions.set(email, data.subscription)
    console.log(`[push] subscription registered for ${email} (${pushSubscriptions.size} total)`)
    socket.emit('push:subscribed', { success: true, email })
  })

  socket.on('push:unsubscribe', (data: { email: string }) => {
    const email = (data?.email || '').trim().toLowerCase()
    if (email) {
      pushSubscriptions.delete(email)
      console.log(`[push] subscription removed for ${email}`)
    }
  })

  // ---------- Game channels ----------
  socket.on('join-channel', (data: { channelId: string }) => {
    const user = users.get(socket.id)
    if (!user) return
    const channel = CHANNELS.find((c) => c.id === data.channelId)
    if (!channel) return

    // Leave all previously joined game channel rooms (legion rooms handled separately)
    for (const room of socket.rooms) {
      if (room.startsWith('channel:')) {
        const oldId = room.slice('channel:'.length)
        socket.leave(room)
        const set = channelUsers.get(oldId)
        if (set) {
          set.delete(socket.id)
          broadcastGameChannelUsers(oldId)
        }
      }
    }

    const roomName = `channel:${channel.id}`
    socket.join(roomName)
    const set = channelUsers.get(channel.id) || new Set<string>()
    set.add(socket.id)
    channelUsers.set(channel.id, set)

    socket.emit('channel-history', {
      channelId: channel.id,
      messages: channelHistory.get(channel.id) || [],
    })

    const joinMsg = createSystemMessage(channel.id, `${user.username} entered the channel`)
    pushGameChannelHistory(channel.id, joinMsg)
    io.to(roomName).emit('message', joinMsg)
    broadcastGameChannelUsers(channel.id)
  })

  socket.on('send-message', (data: { channelId: string; content: string }) => {
    const user = users.get(socket.id)
    if (!user) return
    const content = (data?.content || '').trim().slice(0, 500)
    if (!content) return
    const channel = CHANNELS.find((c) => c.id === data.channelId)
    if (!channel) return
    if (!socket.rooms.has(`channel:${channel.id}`)) return

    const msg = createUserMessage(channel.id, user, content)
    pushGameChannelHistory(channel.id, msg)
    io.to(`channel:${channel.id}`).emit('message', msg)
  })

  socket.on('typing', (data: { channelId: string; isTyping: boolean }) => {
    const user = users.get(socket.id)
    if (!user) return
    const room = `channel:${data.channelId}`
    if (!socket.rooms.has(room)) return
    socket.to(room).emit('typing', {
      channelId: data.channelId,
      username: user.username,
      avatar: user.avatar,
      isTyping: data.isTyping,
    })
  })

  // ---------- LEGION SYSTEM ----------
  socket.on('legion:create', (data: {
    name: string
    tag: string
    description?: string
    icon?: string
    iconType?: 'emoji' | 'image'
    inGameLegionId?: string
  }) => {
    const user = users.get(socket.id)
    if (!user) {
      socket.emit('error-message', { message: 'Not registered' })
      return
    }
    if (user.legionId) {
      socket.emit('error-message', { message: 'You are already in a legion. Leave first.' })
      return
    }
    const name = (data?.name || '').trim().slice(0, 30)
    const tag = (data?.tag || '').trim().slice(0, 6).toUpperCase()
    const description = (data?.description || '').trim().slice(0, 200)
    const inGameLegionId = (data?.inGameLegionId || '').trim().slice(0, 50)
    if (!name || !tag) {
      socket.emit('error-message', { message: 'Legion name and tag are required' })
      return
    }
    if (!inGameLegionId) {
      socket.emit('error-message', { message: 'In-game Legion ID is required' })
      return
    }
    // Ensure tag is unique
    for (const l of legions.values()) {
      if (l.tag === tag) {
        socket.emit('error-message', { message: `Tag [${tag}] is already taken` })
        return
      }
    }

    // Resolve logo: prefer client-provided icon, fall back to a seeded emoji pick
    const clientIconType = data?.iconType === 'image' ? 'image' : 'emoji'
    let icon = (data?.icon || '').trim().slice(0, 500)
    if (clientIconType === 'image') {
      if (!icon || (!icon.startsWith('/') && !/^https?:\/\//i.test(icon))) {
        icon = pickLegionIcon(name)
      } else if (icon.length > 500) {
        icon = icon.slice(0, 500)
      }
    } else {
      if (!icon) icon = pickLegionIcon(name)
      if (icon.length > 8) icon = icon.slice(0, 8)
    }

    const legionId = generateId('leg_')
    const member: LegionMember = {
      userId: socket.id,
      username: user.username,
      avatar: user.avatar,
      level: user.level,
      role: 'captain',
      joinedAt: new Date().toISOString(),
      email: user.email,
    }
    const legion: Legion = {
      id: legionId,
      name,
      tag,
      description: description || `Legion ${name} — survival together`,
      icon,
      iconType: clientIconType,
      inGameLegionId,
      leaderId: socket.id,
      leaderEmail: user.email,
      members: new Map([[socket.id, member]]),
      notice: null,
      noticeUpdatedAt: null,
      noticeUpdatedBy: null,
      tasks: [],
      createdAt: new Date().toISOString(),
      chatHistory: [],
      raidChatHistory: [],
      status: 'pending', // requires admin approval
    }
    legions.set(legionId, legion)
    userLegion.set(socket.id, legionId)
    user.legionId = legionId

    socket.join(`legion:${legionId}`)

    // Tell the leader their legion is pending approval
    socket.emit('legion:pending', serializeLegion(legion))
    console.log(`[legion] pending approval: [${tag}] ${name} by ${user.username} (in-game ID: ${inGameLegionId})`)

    // Notify all admins
    broadcastPendingLegions()
    broadcastAllLegionsToAdmins()
  })

  // List all approved legions (for joining UI)
  socket.on('legion:list', () => {
    const list = Array.from(legions.values())
      .filter((l) => l.status === 'approved' && l.members.size < 50)
      .map(serializeLegion)
    socket.emit('legion:list', list)
  })

  socket.on('legion:join', (data: { legionId: string }) => {
    const user = users.get(socket.id)
    if (!user) return
    if (user.legionId) {
      socket.emit('error-message', { message: 'You are already in a legion' })
      return
    }
    const legion = legions.get(data.legionId)
    if (!legion) {
      socket.emit('error-message', { message: 'Legion not found' })
      return
    }
    if (legion.status !== 'approved') {
      socket.emit('error-message', { message: 'This legion is not yet approved' })
      return
    }
    if (legion.members.size >= 50) {
      socket.emit('error-message', { message: 'Legion is full (50 members max)' })
      return
    }

    // 24h cooldown check
    const cooldownMs = legionCooldownRemaining(user.legionLeftAt)
    if (cooldownMs !== null) {
      socket.emit('error-message', {
        message: `You left a legion recently. You can join another in ${formatCooldown(cooldownMs)}.`,
        cooldownMs,
      })
      return
    }

    const member: LegionMember = {
      userId: socket.id,
      username: user.username,
      avatar: user.avatar,
      level: user.level,
      role: 'member',
      joinedAt: new Date().toISOString(),
      email: user.email,
    }
    legion.members.set(socket.id, member)
    userLegion.set(socket.id, legion.id)
    user.legionId = legion.id
    socket.join(`legion:${legion.id}`)

    // Send recent chat history
    socket.emit('legion:history', { legionId: legion.id, messages: legion.chatHistory })

    // Notify legion
    const sysMsg = createSystemMessage(`legion:${legion.id}`, `${user.username} joined the legion`)
    pushLegionHistory(legion, sysMsg)
    emitLegionMessage(legion, sysMsg)

    socket.emit('legion:joined', serializeLegion(legion))
    emitLegionUpdate(legion)
    console.log(`[legion] ${user.username} joined [${legion.tag}] ${legion.name}`)
  })

  socket.on('legion:leave', () => {
    const user = users.get(socket.id)
    if (!user || !user.legionId) return
    const legion = legions.get(user.legionId)
    if (!legion) return

    handleLegionLeave(socket, user, legion, 'left')

    // Record cooldown — user can't join another legion for 24h
    user.legionLeftAt = new Date()
    socket.emit('legion:cooldown', {
      legionLeftAt: user.legionLeftAt.toISOString(),
      cooldownMs: COOLDOWN_MS,
      message: `You left [${legion.name}]. You can join another legion in 24 hours.`,
    })
    console.log(`[legion] ${user.username} entered 24h cooldown`)
  })

  socket.on('legion:disband', () => {
    const user = users.get(socket.id)
    if (!user || !user.legionId) return
    const legion = legions.get(user.legionId)
    if (!legion) return
    if (legion.leaderId !== socket.id) {
      socket.emit('error-message', { message: 'Only the leader can disband the legion' })
      return
    }

    // Notify all members
    const sysMsg = createSystemMessage(
      `legion:${legion.id}`,
      `Legion [${legion.tag}] ${legion.name} has been disbanded by the leader`,
    )
    io.to(`legion:${legion.id}`).emit('legion:message', sysMsg)
    io.to(`legion:${legion.id}`).emit('legion:disbanded', { legionId: legion.id })

    // Remove all members from legion room and clear their legionId
    for (const memberId of legion.members.keys()) {
      const memberSocket = io.sockets.sockets.get(memberId)
      memberSocket?.leave(`legion:${legion.id}`)
      memberSocket?.leave(`legion-raids:${legion.id}`)
      const memberUser = users.get(memberId)
      if (memberUser) {
        memberUser.legionId = null
        userLegion.delete(memberId)
      }
    }

    legions.delete(legion.id)
    console.log(`[legion] disbanded: [${legion.tag}] ${legion.name}`)
    broadcastAllLegionsToAdmins()
  })

  socket.on('legion:kick', (data: { userId: string }) => {
    const user = users.get(socket.id)
    if (!user || !user.legionId) return
    const legion = legions.get(user.legionId)
    if (!legion) return
    if (legion.leaderId !== socket.id) {
      socket.emit('error-message', { message: 'Only the leader can kick members' })
      return
    }
    if (data.userId === socket.id) {
      socket.emit('error-message', { message: 'Cannot kick yourself. Use disband or leave.' })
      return
    }
    const target = legion.members.get(data.userId)
    if (!target) {
      socket.emit('error-message', { message: 'Member not found in this legion' })
      return
    }

    const targetSocket = io.sockets.sockets.get(data.userId)
    targetSocket?.leave(`legion:${legion.id}`)
    targetSocket?.leave(`legion-raids:${legion.id}`)

    legion.members.delete(data.userId)
    const targetUser = users.get(data.userId)
    if (targetUser) {
      targetUser.legionId = null
      userLegion.delete(data.userId)
      // Kicked users also get the 24h cooldown
      targetUser.legionLeftAt = new Date()
      targetSocket?.emit('legion:cooldown', {
        legionLeftAt: targetUser.legionLeftAt.toISOString(),
        cooldownMs: COOLDOWN_MS,
        message: `You were kicked from [${legion.name}]. You can join another legion in 24 hours.`,
      })
    }

    // Notify kicked user
    targetSocket?.emit('legion:kicked', { legionId: legion.id, legionName: legion.name })

    // Notify legion
    const sysMsg = createSystemMessage(
      `legion:${legion.id}`,
      `${target.username} was kicked from the legion`,
    )
    pushLegionHistory(legion, sysMsg)
    emitLegionMessage(legion, sysMsg)
    emitLegionUpdate(legion)
    console.log(`[legion] ${target.username} kicked from [${legion.tag}]`)
  })

  socket.on('legion:notice', (data: { notice: string }) => {
    const user = users.get(socket.id)
    if (!user || !user.legionId) return
    const legion = legions.get(user.legionId)
    if (!legion) return
    if (legion.leaderId !== socket.id) {
      socket.emit('error-message', { message: 'Only the leader can set the notice' })
      return
    }
    const notice = (data?.notice || '').trim().slice(0, 500)
    if (!notice) {
      socket.emit('error-message', { message: 'Notice cannot be empty' })
      return
    }

    legion.notice = notice
    legion.noticeUpdatedAt = new Date().toISOString()
    legion.noticeUpdatedBy = user.username

    const sysMsg = createSystemMessage(
      `legion:${legion.id}`,
      `Leader ${user.username} updated the legion notice`,
    )
    pushLegionHistory(legion, sysMsg)
    emitLegionMessage(legion, sysMsg)
    emitLegionUpdate(legion)
    console.log(`[legion] notice updated in [${legion.tag}]`)
  })

  socket.on('legion:chat', (data: { content: string }) => {
    const user = users.get(socket.id)
    if (!user || !user.legionId) return
    const legion = legions.get(user.legionId)
    if (!legion) return
    const content = (data?.content || '').trim().slice(0, 500)
    if (!content) return

    const msg = createUserMessage(`legion:${legion.id}`, user, content)
    pushLegionHistory(legion, msg)
    emitLegionMessage(legion, msg)

    // Raid alarm — if the message mentions "raid", alert the whole legion
    if (shouldTriggerRaidAlarm(content)) {
      triggerRaidAlarm(socket, legion, user, content, `legion:${legion.id}`)
    }
  })

  socket.on('legion:typing', (data: { isTyping: boolean }) => {
    const user = users.get(socket.id)
    if (!user || !user.legionId) return
    const legion = legions.get(user.legionId)
    if (!legion) return
    socket.to(`legion:${legion.id}`).emit('legion:typing', {
      username: user.username,
      avatar: user.avatar,
      isTyping: data.isTyping,
    })
  })

  // ---------- LEGION RECRUITMENT ----------
  socket.on('legion:recruit', (data: { reason: string }) => {
    const user = users.get(socket.id)
    if (!user || !user.legionId) return
    const legion = legions.get(user.legionId)
    if (!legion) return
    if (legion.leaderId !== socket.id) {
      socket.emit('error-message', { message: 'Only the leader can post recruitment messages' })
      return
    }
    if (legion.status !== 'approved') {
      socket.emit('error-message', { message: 'Legion must be approved before recruiting' })
      return
    }
    const reason = (data?.reason || '').trim().slice(0, 400)
    if (!reason) {
      socket.emit('error-message', { message: 'Please explain why you need players' })
      return
    }

    // Post a formatted recruitment message to the public guilds channel
    const logoDisplay = legion.iconType === 'image' ? '[Logo]' : legion.icon
    const recruitContent = `${logoDisplay} [${legion.tag}] ${legion.name} is recruiting!\n━ ${reason}\n━ In-game ID: ${legion.inGameLegionId}\n━ Contact leader @${user.username}`

    const msg = createUserMessage('guilds', user, recruitContent)
    pushGameChannelHistory('guilds', msg)
    io.to(`channel:guilds`).emit('message', msg)

    // Confirm to the leader
    socket.emit('legion:recruit-posted', {
      message: 'Your recruitment post was published to the Legion Recruitment channel.',
    })

    // System message in legion chat
    const sysMsg = createSystemMessage(
      `legion:${legion.id}`,
      `Leader ${user.username} posted a recruitment message to the Legion Recruitment channel`,
    )
    pushLegionHistory(legion, sysMsg)
    emitLegionMessage(legion, sysMsg)

    console.log(`[legion] recruitment posted for [${legion.tag}] ${legion.name}`)
  })

  // ---------- LEGION RAIDS (legion-scoped raid planning chat) ----------
  socket.on('legion:raid:join', () => {
    const user = users.get(socket.id)
    if (!user || !user.legionId) return
    const legion = legions.get(user.legionId)
    if (!legion) return

    socket.join(`legion-raids:${legion.id}`)
    socket.emit('legion:raid:history', {
      legionId: legion.id,
      messages: legion.raidChatHistory,
    })
  })

  socket.on('legion:raid:chat', (data: { content: string }) => {
    const user = users.get(socket.id)
    if (!user || !user.legionId) return
    const legion = legions.get(user.legionId)
    if (!legion) return
    const content = (data?.content || '').trim().slice(0, 500)
    if (!content) return

    const msg = createUserMessage(`legion-raids:${legion.id}`, user, content)
    pushLegionRaidHistory(legion, msg)
    emitLegionRaidMessage(legion, msg)

    // Raid alarm — if the message mentions "raid", alert the whole legion
    if (shouldTriggerRaidAlarm(content)) {
      triggerRaidAlarm(socket, legion, user, content, `legion-raids:${legion.id}`)
    }
  })

  socket.on('legion:raid:typing', (data: { isTyping: boolean }) => {
    const user = users.get(socket.id)
    if (!user || !user.legionId) return
    const legion = legions.get(user.legionId)
    if (!legion) return
    socket.to(`legion-raids:${legion.id}`).emit('legion:raid:typing', {
      username: user.username,
      avatar: user.avatar,
      isTyping: data.isTyping,
    })
  })

  // ---------- LEGION TASKS ----------
  socket.on('legion:task-assign', (data: { assigneeId: string; title: string; description?: string }) => {
    const user = users.get(socket.id)
    if (!user || !user.legionId) return
    const legion = legions.get(user.legionId)
    if (!legion) return
    if (legion.leaderId !== socket.id) {
      socket.emit('error-message', { message: 'Only the leader can assign tasks' })
      return
    }
    const assignee = legion.members.get(data.assigneeId)
    if (!assignee) {
      socket.emit('error-message', { message: 'Assignee is not a legion member' })
      return
    }
    const title = (data?.title || '').trim().slice(0, 120)
    if (!title) {
      socket.emit('error-message', { message: 'Task title is required' })
      return
    }
    const description = (data?.description || '').trim().slice(0, 400)

    const task: LegionTask = {
      id: generateId('task_'),
      title,
      description,
      assigneeId: assignee.userId,
      assigneeName: assignee.username,
      assignerId: socket.id,
      assignerName: user.username,
      status: 'pending',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    legion.tasks.push(task)
    if (legion.tasks.length > 100) legion.tasks = legion.tasks.slice(-100)

    const sysMsg = createSystemMessage(
      `legion:${legion.id}`,
      `Leader assigned task "${title}" to ${assignee.username}`,
    )
    pushLegionHistory(legion, sysMsg)
    emitLegionMessage(legion, sysMsg)
    emitLegionUpdate(legion)
    console.log(`[legion] task "${title}" assigned to ${assignee.username} in [${legion.tag}]`)
  })

  socket.on('legion:task-update', (data: { taskId: string; status: LegionTaskStatus }) => {
    const user = users.get(socket.id)
    if (!user || !user.legionId) return
    const legion = legions.get(user.legionId)
    if (!legion) return

    const task = legion.tasks.find((t) => t.id === data.taskId)
    if (!task) {
      socket.emit('error-message', { message: 'Task not found' })
      return
    }

    const isLeader = legion.leaderId === socket.id
    const isAssignee = task.assigneeId === socket.id
    if (!isLeader && !isAssignee) {
      socket.emit('error-message', { message: 'You can only update your own tasks' })
      return
    }
    const validStatuses: LegionTaskStatus[] = ['pending', 'in_progress', 'done', 'failed']
    if (!validStatuses.includes(data.status)) {
      socket.emit('error-message', { message: 'Invalid task status' })
      return
    }

    const oldStatus = task.status
    task.status = data.status
    task.updatedAt = new Date().toISOString()

    const sysMsg = createSystemMessage(
      `legion:${legion.id}`,
      `Task "${task.title}" status: ${oldStatus} → ${data.status} (by ${user.username})`,
    )
    pushLegionHistory(legion, sysMsg)
    emitLegionMessage(legion, sysMsg)
    emitLegionUpdate(legion)
    console.log(`[legion] task ${task.id} status ${oldStatus} → ${data.status}`)
  })

  socket.on('legion:task-delete', (data: { taskId: string }) => {
    const user = users.get(socket.id)
    if (!user || !user.legionId) return
    const legion = legions.get(user.legionId)
    if (!legion) return
    if (legion.leaderId !== socket.id) {
      socket.emit('error-message', { message: 'Only the leader can delete tasks' })
      return
    }
    const idx = legion.tasks.findIndex((t) => t.id === data.taskId)
    if (idx === -1) {
      socket.emit('error-message', { message: 'Task not found' })
      return
    }
    const [removed] = legion.tasks.splice(idx, 1)
    const sysMsg = createSystemMessage(
      `legion:${legion.id}`,
      `Task "${removed.title}" was removed by the leader`,
    )
    pushLegionHistory(legion, sysMsg)
    emitLegionMessage(legion, sysMsg)
    emitLegionUpdate(legion)
  })

  // ---------- LEGION RANK ASSIGNMENT ----------
  // Only the Captain can assign Vice Captain / Elite ranks, or demote back to Member.
  // Limits: max 1 Vice Captain, max 3 Elite. Captain role cannot be assigned (only via auto-promotion on leave).
  socket.on('legion:assign-role', (data: { userId: string; role: 'vice_captain' | 'elite' | 'member' }) => {
    const user = users.get(socket.id)
    if (!user || !user.legionId) return
    const legion = legions.get(user.legionId)
    if (!legion) return
    // Only the Captain (leader) can assign roles
    if (legion.leaderId !== socket.id) {
      socket.emit('error-message', { message: 'Only the Captain can assign ranks' })
      return
    }
    const target = legion.members.get(data.userId)
    if (!target) {
      socket.emit('error-message', { message: 'Member not found in this legion' })
      return
    }
    if (target.role === 'captain') {
      socket.emit('error-message', { message: 'Cannot change the Captain\'s rank' })
      return
    }
    const newRole = data.role
    // Validate limits
    if (newRole === 'vice_captain') {
      // If someone else is already Vice Captain, demote them to Member (auto-swap)
      for (const m of legion.members.values()) {
        if (m.role === 'vice_captain' && m.userId !== data.userId) {
          m.role = 'member'
        }
      }
    } else if (newRole === 'elite') {
      // Count current elites (excluding the target if they're already elite)
      const currentElites = countRole(legion, 'elite') - (target.role === 'elite' ? 1 : 0)
      if (currentElites >= MAX_ELITES) {
        socket.emit('error-message', { message: `Elite rank is full (max ${MAX_ELITES}). Demote an existing Elite first.` })
        return
      }
    }
    // 'member' is always allowed (demotion)

    const oldRole = target.role
    target.role = newRole

    const roleLabel = (r: LegionRole): string => {
      switch (r) {
        case 'captain': return 'Captain'
        case 'vice_captain': return 'Vice Captain'
        case 'elite': return 'Elite'
        case 'member': return 'Member'
      }
    }

    const action = newRole === 'member' ? 'demoted to' : 'promoted to'
    const sysMsg = createSystemMessage(
      `legion:${legion.id}`,
      `Captain ${user.username} ${action} ${target.username} from ${roleLabel(oldRole as LegionRole)} to ${roleLabel(newRole)}`,
    )
    pushLegionHistory(legion, sysMsg)
    emitLegionMessage(legion, sysMsg)
    emitLegionUpdate(legion)
    console.log(`[legion] rank change in [${legion.tag}]: ${target.username} ${oldRole} -> ${newRole}`)
  })

  // ---------- ADMIN: LEGION APPROVAL ----------
  socket.on('admin:approve-legion', (data: { legionId: string }) => {
    const user = users.get(socket.id)
    if (!user || !user.isAdmin) {
      socket.emit('error-message', { message: 'Admin access required' })
      return
    }
    const legion = legions.get(data.legionId)
    if (!legion) {
      socket.emit('error-message', { message: 'Legion not found' })
      return
    }
    if (legion.status !== 'pending') {
      socket.emit('error-message', { message: `Legion is already ${legion.status}` })
      return
    }

    legion.status = 'approved'

    // Notify the leader
    const leaderSocket = io.sockets.sockets.get(legion.leaderId)
    leaderSocket?.emit('legion:approved', serializeLegion(legion))

    // System message in legion chat
    const sysMsg = createSystemMessage(
      `legion:${legion.id}`,
      `✅ Legion has been approved by admin. You can now recruit members and post to the Legion Recruitment channel.`,
    )
    pushLegionHistory(legion, sysMsg)
    emitLegionMessage(legion, sysMsg)

    console.log(`[admin] legion approved: [${legion.tag}] ${legion.name}`)
    broadcastPendingLegions()
    broadcastAllLegionsToAdmins()
  })

  socket.on('admin:reject-legion', (data: { legionId: string; reason?: string }) => {
    const user = users.get(socket.id)
    if (!user || !user.isAdmin) {
      socket.emit('error-message', { message: 'Admin access required' })
      return
    }
    const legion = legions.get(data.legionId)
    if (!legion) {
      socket.emit('error-message', { message: 'Legion not found' })
      return
    }
    if (legion.status !== 'pending') {
      socket.emit('error-message', { message: `Legion is already ${legion.status}` })
      return
    }

    legion.status = 'rejected'

    // Notify the leader
    const leaderSocket = io.sockets.sockets.get(legion.leaderId)
    leaderSocket?.emit('legion:rejected', {
      legionId: legion.id,
      legionName: legion.name,
      tag: legion.tag,
      reason: data?.reason || 'No reason provided',
    })

    // Remove the leader from the legion room
    leaderSocket?.leave(`legion:${legion.id}`)
    leaderSocket?.leave(`legion-raids:${legion.id}`)

    // Clear leader's legion membership
    const leaderUser = users.get(legion.leaderId)
    if (leaderUser) {
      leaderUser.legionId = null
      userLegion.delete(legion.leaderId)
    }

    // Delete the legion
    legions.delete(legion.id)

    console.log(`[admin] legion rejected: [${legion.tag}] ${legion.name}`)
    broadcastPendingLegions()
    broadcastAllLegionsToAdmins()
  })

  socket.on('admin:list-pending-legions', () => {
    const user = users.get(socket.id)
    if (!user || !user.isAdmin) return
    broadcastPendingLegions()
    broadcastAllLegionsToAdmins()
  })

  // ---------- Disconnect ----------
  socket.on('disconnect', () => {
    const user = users.get(socket.id)
    if (!user) {
      console.log(`[chat] disconnected: ${socket.id}`)
      return
    }

    // Leave any game channels
    for (const room of socket.rooms) {
      if (room.startsWith('channel:')) {
        const channelId = room.slice('channel:'.length)
        socket.leave(room)
        const set = channelUsers.get(channelId)
        if (set) {
          set.delete(socket.id)
          const leaveMsg = createSystemMessage(channelId, `${user.username} left the channel`)
          pushGameChannelHistory(channelId, leaveMsg)
          io.to(room).emit('message', leaveMsg)
          broadcastGameChannelUsers(channelId)
        }
      }
    }

    // Leave legion (but keep membership — just disconnect the socket)
    if (user.legionId) {
      const legion = legions.get(user.legionId)
      if (legion) {
        const sysMsg = createSystemMessage(
          `legion:${legion.id}`,
          `${user.username} went offline`,
        )
        pushLegionHistory(legion, sysMsg)
        emitLegionMessage(legion, sysMsg)
        emitLegionUpdate(legion)
      }
      userLegion.delete(socket.id)
    }

    users.delete(socket.id)
    console.log(`[chat] disconnected: ${user.username} (${socket.id})`)
  })

  socket.on('error', (err) => {
    console.error(`[chat] socket error (${socket.id}):`, err)
  })
})

// Helper: handle a user leaving a legion (voluntary or kicked)
function handleLegionLeave(socket: Socket, user: User, legion: Legion, reason: 'left' | 'kicked') {
  socket.leave(`legion:${legion.id}`)
  socket.leave(`legion-raids:${legion.id}`)
  legion.members.delete(socket.id)
  user.legionId = null
  userLegion.delete(socket.id)

  // If leader left and there are still members, promote the longest-tenured member
  if (legion.leaderId === socket.id && legion.members.size > 0) {
    const sortedMembers = Array.from(legion.members.values()).sort(
      (a, b) => new Date(a.joinedAt).getTime() - new Date(b.joinedAt).getTime(),
    )
    const newLeader = sortedMembers[0]
    if (newLeader) {
      newLeader.role = 'captain'
      legion.leaderId = newLeader.userId
      const promoteMsg = createSystemMessage(
        `legion:${legion.id}`,
        `${newLeader.username} has been promoted to Captain`,
      )
      pushLegionHistory(legion, promoteMsg)
      emitLegionMessage(legion, promoteMsg)
    }
  }

  // If legion is empty, remove it
  if (legion.members.size === 0) {
    legions.delete(legion.id)
    socket.emit('legion:left', { legionId: legion.id })
    console.log(`[legion] [${legion.tag}] ${legion.name} removed (empty)`)
    broadcastAllLegionsToAdmins()
    return
  }

  const sysMsg = createSystemMessage(
    `legion:${legion.id}`,
    `${user.username} ${reason === 'kicked' ? 'was kicked from' : 'left'} the legion`,
  )
  pushLegionHistory(legion, sysMsg)
  emitLegionMessage(legion, sysMsg)
  emitLegionUpdate(legion)
  socket.emit('legion:left', { legionId: legion.id })
  console.log(`[legion] ${user.username} ${reason} [${legion.tag}]`)
}

const PORT = 3003
httpServer.listen(PORT, () => {
  console.log(`Last Island chat service running on port ${PORT}`)
  console.log(`Game channels: ${CHANNELS.map((c) => c.id).join(', ')}`)
  console.log(`Legion system: enabled (with admin approval + 24h cooldown + raids tab)`)
})

const shutdown = (signal: string) => {
  console.log(`[chat] received ${signal}, shutting down...`)
  httpServer.close(() => {
    console.log('[chat] server closed')
    process.exit(0)
  })
}
process.on('SIGTERM', () => shutdown('SIGTERM'))
process.on('SIGINT', () => shutdown('SIGINT'))
