// Shared types for the Last Island of Survival chat app.
// Keep in sync with mini-services/chat-service/index.ts

export interface ChannelDef {
  id: string
  name: string
  description: string
  icon: string // emoji
  accent: string // tailwind color token, e.g. 'flame'
}

export interface ChatUser {
  id: string
  username: string
  email: string
  avatar: string
  level: number
  joinedAt: string | Date
  isAdmin: boolean
  legionLeftAt: string | null
  inGameLegionId: string | null
}

export interface ChatMessage {
  id: string
  channelId: string // game channel id OR `legion:<legionId>` OR `legion-raids:<legionId>`
  username: string
  avatar: string
  content: string
  timestamp: string
  type: 'user' | 'system'
}

export interface TypingEvent {
  channelId?: string
  username: string
  avatar: string
  isTyping: boolean
}

// ---------- AUTH TYPES ----------

export interface AuthUser {
  id: string
  email: string
  username: string
  verified: boolean
  isAdmin: boolean
  legionLeftAt: string | null
  inGameLegionId: string | null
  createdAt: string
}

// ---------- LEGION TYPES ----------

export type LegionRole = 'captain' | 'vice_captain' | 'elite' | 'member'

/** A raid alarm triggered when someone says "raid" in legion chat. */
export interface RaidAlarm {
  legionId: string
  legionName: string
  tag: string
  triggeredBy: string
  avatar: string
  message: string
  channelId: string
  timestamp: string
}

export interface LegionMember {
  userId: string
  username: string
  avatar: string
  level: number
  role: LegionRole
  joinedAt: string
}

export type LegionTaskStatus = 'pending' | 'in_progress' | 'done' | 'failed'

export interface LegionTask {
  id: string
  title: string
  description: string
  assigneeId: string
  assigneeName: string
  assignerId: string
  assignerName: string
  status: LegionTaskStatus
  createdAt: string
  updatedAt: string
}

export type LegionStatus = 'pending' | 'approved' | 'rejected'

export interface Legion {
  id: string
  name: string
  tag: string // short tag, e.g. "WLF"
  description: string
  /**
   * Logo identifier. Either:
   *  - An emoji string (e.g. "🛡️"), OR
   *  - A path/URL to an uploaded image (starts with "/" or "http")
   */
  icon: string
  iconType: 'emoji' | 'image'
  /** In-game Legion ID from Last Island of Survival (provided by leader at creation) */
  inGameLegionId: string
  leaderId: string
  leaderEmail: string
  members: LegionMember[]
  notice: string | null
  noticeUpdatedAt: string | null
  noticeUpdatedBy: string | null
  tasks: LegionTask[]
  createdAt: string
  memberCount: number
  /** 'pending' = awaiting admin approval, 'approved' = live, 'rejected' = denied */
  status: LegionStatus
}
