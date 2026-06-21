'use client'

import { useState } from 'react'
import {
  Crown,
  Shield,
  User as UserIcon,
  UserPlus,
  Plus,
  Megaphone,
  LogOut,
  Trash2,
  UserMinus,
  ClipboardList,
  StickyNote,
  Send,
  Flag,
  Flame,
  Check,
  X,
  Clock,
  Loader2,
  ChevronDown,
  Star,
  Award,
} from 'lucide-react'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import type { Legion, LegionTask, LegionTaskStatus, ChatMessage, LegionMember, LegionRole, RaidAlarm } from '@/lib/chat-types'
import { cn } from '@/lib/utils'
import { AssignTaskDialog } from '@/components/assign-task-dialog'
import { LegionLogo } from '@/components/legion-onboarding'

interface Props {
  legion: Legion
  currentUserId: string
  messages: ChatMessage[]
  typingUsers: { username: string; avatar: string }[]
  onSendMessage: (content: string) => void
  onTyping: (isTyping: boolean) => void
  onLeave: () => void
  onDisband: () => void
  onKick: (userId: string) => void
  onSetNotice: (notice: string) => void
  onAssignTask: (data: { assigneeId: string; title: string; description: string }) => void
  onUpdateTask: (taskId: string, status: LegionTaskStatus) => void
  onDeleteTask: (taskId: string) => void
  onRecruit: (reason: string) => void
  raidMessages: ChatMessage[]
  raidTypingUsers: { username: string; avatar: string }[]
  onRaidJoin: () => void
  onRaidSendMessage: (content: string) => void
  onRaidTyping: (isTyping: boolean) => void
  /** Captain assigns Vice Captain / Elite / Member ranks */
  onAssignRole: (userId: string, role: 'vice_captain' | 'elite' | 'member') => void
  /** Active raid alarm (if any) — shown as a flashing banner */
  raidAlarm: RaidAlarm | null
  /** Dismiss the raid alarm banner */
  onDismissAlarm: () => void
}

const TASK_STATUS_META: Record<
  LegionTaskStatus,
  { label: string; icon: React.ReactNode; chipBg: string; chipText: string }
> = {
  pending: {
    label: 'Pending',
    icon: <Clock className="h-3 w-3" />,
    chipBg: 'bg-primary/15',
    chipText: 'text-primary',
  },
  in_progress: {
    label: 'In Progress',
    icon: <Loader2 className="h-3 w-3" />,
    chipBg: 'bg-cyan-500/15',
    chipText: 'text-cyan-300',
  },
  done: {
    label: 'Done',
    icon: <Check className="h-3 w-3" />,
    chipBg: 'bg-accent/15',
    chipText: 'text-accent',
  },
  failed: {
    label: 'Failed',
    icon: <X className="h-3 w-3" />,
    chipBg: 'bg-destructive/15',
    chipText: 'text-destructive',
  },
}

/** Rank metadata — badge styling for each legion role. */
const RANK_META: Record<LegionRole, { label: string; icon: React.ReactNode; chipBg: string; chipText: string }> = {
  captain: {
    label: 'Captain',
    icon: <Crown className="h-3 w-3" />,
    chipBg: 'bg-primary/20',
    chipText: 'text-primary',
  },
  vice_captain: {
    label: 'Vice Captain',
    icon: <Award className="h-3 w-3" />,
    chipBg: 'bg-amber-500/20',
    chipText: 'text-amber-300',
  },
  elite: {
    label: 'Elite',
    icon: <Star className="h-3 w-3" />,
    chipBg: 'bg-accent/20',
    chipText: 'text-accent',
  },
  member: {
    label: 'Member',
    icon: <Shield className="h-3 w-3" />,
    chipBg: 'bg-muted/40',
    chipText: 'text-muted-foreground',
  },
}

export function LegionPanel({
  legion,
  currentUserId,
  messages,
  typingUsers,
  onSendMessage,
  onTyping,
  onLeave,
  onDisband,
  onKick,
  onSetNotice,
  onAssignTask,
  onUpdateTask,
  onDeleteTask,
  onRecruit,
  raidMessages,
  raidTypingUsers,
  onRaidJoin,
  onRaidSendMessage,
  onRaidTyping,
  onAssignRole,
  raidAlarm,
  onDismissAlarm,
}: Props) {
  const [draft, setDraft] = useState('')
  const [noticeDraft, setNoticeDraft] = useState('')
  const [editingNotice, setEditingNotice] = useState(false)
  const [taskDialogOpen, setTaskDialogOpen] = useState(false)
  const [disbandDialogOpen, setDisbandDialogOpen] = useState(false)
  const [kickTarget, setKickTarget] = useState<LegionMember | null>(null)
  const [activeTab, setActiveTab] = useState<'chat' | 'raids' | 'tasks' | 'members'>('chat')
  const [recruitOpen, setRecruitOpen] = useState(false)
  const [recruitReason, setRecruitReason] = useState('')
  const [raidDraft, setRaidDraft] = useState('')
  const [raidJoined, setRaidJoined] = useState(false)

  const isLeader = legion.leaderId === currentUserId
  const myMember = legion.members.find((m) => m.userId === currentUserId)
  const isApproved = legion.status === 'approved'

  const handleSend = () => {
    const text = draft.trim()
    if (!text) return
    onSendMessage(text)
    setDraft('')
    onTyping(false)
  }

  const handleRaidSend = () => {
    const text = raidDraft.trim()
    if (!text) return
    onRaidSendMessage(text)
    setRaidDraft('')
    onRaidTyping(false)
  }

  const handleJoinRaids = () => {
    if (!raidJoined) {
      onRaidJoin()
      setRaidJoined(true)
    }
  }

  const handleRecruit = () => {
    const reason = recruitReason.trim()
    if (!reason) return
    onRecruit(reason)
    setRecruitReason('')
    setRecruitOpen(false)
  }

  const handleSaveNotice = () => {
    const text = noticeDraft.trim()
    if (!text) return
    onSetNotice(text)
    setNoticeDraft('')
    setEditingNotice(false)
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden min-w-0 panel-in">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 border-b border-border/60 px-3 sm:px-4 py-3">
        <div className="flex items-center gap-3 min-w-0">
          <LegionLogo
            icon={legion.icon}
            iconType={legion.iconType || 'emoji'}
            size={40}
            className="shrink-0"
          />
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="truncate font-semibold leading-tight mono-header">{legion.name}</h2>
              <span className="rounded-sm bg-primary/20 px-1.5 py-0.5 text-[10px] font-mono font-bold text-primary">
                [{legion.tag}]
              </span>
              {isLeader && (
                <Badge className="h-5 gap-1 bg-primary/20 px-1.5 text-[10px] text-primary hover:bg-primary/30 rounded-sm">
                  <Crown className="h-3 w-3" />
                  Captain
                </Badge>
              )}
              <Badge
                variant="secondary"
                className={
                  isApproved
                    ? 'h-5 px-1.5 text-[10px] bg-accent/15 text-accent rounded-sm'
                    : 'h-5 px-1.5 text-[10px] bg-primary/15 text-primary rounded-sm'
                }
              >
                {isApproved ? 'Approved' : 'Pending'}
              </Badge>
            </div>
            <p className="truncate text-xs text-muted-foreground">
              {legion.memberCount} member{legion.memberCount === 1 ? '' : 's'} · In-game ID: {legion.inGameLegionId}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {isLeader && isApproved && (
            <Button
              size="sm"
              variant="outline"
              className="h-8 gap-1 border-primary/30 text-primary hover:bg-primary/10 rounded-sm mono-header"
              onClick={() => setRecruitOpen(true)}
              title="Post a recruitment message to the Legion Recruitment channel"
            >
              <UserPlus className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Recruit</span>
            </Button>
          )}
          {isLeader && (
            <Button
              size="sm"
              variant="default"
              className="h-8 gap-1 rounded-sm mono-header"
              onClick={() => setTaskDialogOpen(true)}
            >
              <ClipboardList className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Assign Task</span>
            </Button>
          )}
          <Button
            size="sm"
            variant="ghost"
            className="h-8 rounded-sm"
            onClick={() => onLeave()}
            title="Leave legion"
          >
            <LogOut className="h-3.5 w-3.5" />
          </Button>
          {isLeader && (
            <Button
              size="sm"
              variant="ghost"
              className="h-8 text-destructive hover:text-destructive rounded-sm"
              onClick={() => setDisbandDialogOpen(true)}
              title="Disband legion"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </div>

      {/* Raid alarm banner — flashing red overlay shown to all legion members when someone says "raid" */}
      {raidAlarm && (
        <div className="border-b-2 border-destructive bg-destructive/20 px-3 sm:px-4 py-3 animate-pulse">
          <div className="mx-auto flex max-w-3xl items-start gap-3">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-sm bg-destructive/30 text-destructive">
              <Flame className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-destructive mono-header">
                  🚨 RAID ALARM
                </span>
                <span className="rounded-sm bg-destructive/30 px-1.5 py-0.5 text-[10px] font-mono font-bold text-destructive">
                  [{raidAlarm.tag}]
                </span>
              </div>
              <p className="mt-0.5 text-xs text-foreground/90 break-words">
                <span className="font-semibold">{raidAlarm.triggeredBy}</span> sounded the alarm:
                {' "'}<span className="italic">{raidAlarm.message}</span>{'"'}
              </p>
              <p className="mt-0.5 text-[10px] text-muted-foreground font-mono">
                {new Date(raidAlarm.timestamp).toLocaleTimeString()} · Rally your legion now!
              </p>
            </div>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 px-2 text-xs text-destructive hover:bg-destructive/20 rounded-sm mono-header shrink-0"
              onClick={onDismissAlarm}
            >
              <X className="h-3.5 w-3.5" />
              Dismiss
            </Button>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-border/60 px-2 sm:px-3">
        {([
          { id: 'chat', label: 'Chat', icon: <Send className="h-3.5 w-3.5" /> },
          { id: 'raids', label: 'Raids', icon: <Flame className="h-3.5 w-3.5" /> },
          { id: 'tasks', label: `Tasks (${legion.tasks.length})`, icon: <ClipboardList className="h-3.5 w-3.5" /> },
          { id: 'members', label: `Members (${legion.memberCount})`, icon: <Shield className="h-3.5 w-3.5" /> },
        ] as const).map((tab) => (
          <button
            key={tab.id}
            onClick={() => {
              setActiveTab(tab.id)
              if (tab.id === 'raids') handleJoinRaids()
            }}
            className={cn(
              'flex items-center gap-1.5 px-3 py-2.5 text-xs font-medium border-b-2 -mb-px transition-colors mono-header',
              activeTab === tab.id
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Notice board (always visible above the tab content) */}
      {(legion.notice || isLeader) && (
        <div className="border-b border-border/60 bg-primary/5 px-3 sm:px-4 py-2 border-l-2 border-l-primary">
          <div className="flex items-start gap-2">
            <Megaphone className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-primary mono-header">
                  Legion Notice
                </span>
                {isLeader && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-5 px-1.5 text-[10px] text-primary hover:text-primary rounded-sm"
                    onClick={() => {
                      setEditingNotice((v) => !v)
                      setNoticeDraft(legion.notice || '')
                    }}
                  >
                    <StickyNote className="h-3 w-3" />
                    {legion.notice ? 'Edit' : 'Set'}
                  </Button>
                )}
              </div>
              {editingNotice ? (
                <div className="mt-1 space-y-2">
                  <Textarea
                    value={noticeDraft}
                    onChange={(e) => setNoticeDraft(e.target.value)}
                    placeholder="Write a notice for your legion…"
                    rows={2}
                    maxLength={500}
                    className="text-xs rounded-sm"
                    autoFocus
                  />
                  <div className="flex gap-1">
                    <Button size="sm" className="h-6 text-[11px] rounded-sm mono-header" onClick={handleSaveNotice} disabled={!noticeDraft.trim()}>
                      Save Notice
                    </Button>
                    <Button size="sm" variant="ghost" className="h-6 text-[11px] rounded-sm" onClick={() => setEditingNotice(false)}>
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : legion.notice ? (
                <p className="mt-0.5 text-xs text-foreground/90 whitespace-pre-wrap break-words">
                  {legion.notice}
                  {legion.noticeUpdatedAt && legion.noticeUpdatedBy && (
                    <span className="block mt-1 text-[10px] text-muted-foreground">
                      — {legion.noticeUpdatedBy} · {formatTime(legion.noticeUpdatedAt)}
                    </span>
                  )}
                </p>
              ) : (
                <p className="mt-0.5 text-xs italic text-muted-foreground">
                  No notice set. Click "Set" to broadcast an announcement to your legion.
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Tab content */}
      {activeTab === 'chat' && (
        <>
          <ScrollArea className="flex-1 scrollbar-island px-2 sm:px-4 py-3">
            <div className="mx-auto max-w-3xl space-y-1">
              {messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
                  <div className="mb-3 grid h-14 w-14 place-items-center rounded-sm bg-muted/40 text-3xl">
                    🛡️
                  </div>
                  <h3 className="text-sm font-semibold mono-header">Legion chat is quiet</h3>
                  <p className="mt-1 max-w-xs text-xs text-muted-foreground">
                    Send the first message to rally your legion. Only legion members can see this chat.
                  </p>
                </div>
              ) : (
                messages.map((msg) => (
                  <LegionMessageRow
                    key={msg.id}
                    msg={msg}
                    isSelf={msg.username === myMember?.username}
                  />
                ))
              )}
              {typingUsers.length > 0 && (
                <div className="flex items-center gap-2 px-1 pt-1 text-xs text-muted-foreground">
                  <span className="flex gap-1">
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground/70 [animation-delay:-0.2s]" />
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground/70 [animation-delay:-0.1s]" />
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground/70" />
                  </span>
                  <span>
                    {typingUsers.length === 1
                      ? `${typingUsers[0].username} is typing…`
                      : `${typingUsers.length} members are typing…`}
                  </span>
                </div>
              )}
              <div className="h-1" />
            </div>
          </ScrollArea>

          <div className="border-t border-border/60 p-3">
            <div className="mx-auto flex max-w-3xl items-end gap-2">
              <div className="flex-1">
                <Textarea
                  value={draft}
                  onChange={(e) => {
                    setDraft(e.target.value)
                    onTyping(e.target.value.length > 0)
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault()
                      handleSend()
                    }
                  }}
                  placeholder={`Message ${legion.name} legion…`}
                  rows={1}
                  className="min-h-[44px] max-h-40 resize-none scrollbar-island rounded-sm"
                />
                <p className="mt-1 px-1 text-[10px] text-muted-foreground">
                  Press <kbd className="rounded-sm bg-muted px-1 py-0.5">Enter</kbd> to send,
                  <kbd className="ml-1 rounded-sm bg-muted px-1 py-0.5">Shift</kbd>+
                  <kbd className="rounded-sm bg-muted px-1 py-0.5">Enter</kbd> for new line · Only legion members can see this
                </p>
                <p className="mt-0.5 px-1 text-[10px] text-destructive/80 mono-header">
                  💡 Type "raid" to sound the raid alarm and alert every member of your legion
                </p>
              </div>
              <Button
                onClick={handleSend}
                disabled={!draft.trim()}
                size="icon"
                className="h-11 w-11 shrink-0 rounded-sm"
                aria-label="Send message"
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </>
      )}

      {activeTab === 'raids' && (
        <>
          <ScrollArea className="flex-1 scrollbar-island px-2 sm:px-4 py-3">
            <div className="mx-auto max-w-3xl space-y-1">
              <div className="mb-3 rounded-sm border border-destructive/30 bg-destructive/5 p-3 border-l-2 border-l-destructive">
                <p className="flex items-center gap-1.5 text-xs font-semibold text-destructive mono-header">
                  <Flame className="h-3.5 w-3.5" />
                  Legion Raid Planning
                </p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  Private to your legion. Coordinate attack times, target selection, and loadouts here.
                </p>
              </div>
              {raidMessages.length === 0 ? (
                <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
                  <div className="mb-3 grid h-14 w-14 place-items-center rounded-sm bg-destructive/10 text-3xl">
                    🔥
                  </div>
                  <h3 className="text-sm font-semibold mono-header">No raid plans yet</h3>
                  <p className="mt-1 max-w-xs text-xs text-muted-foreground">
                    Start planning your next raid. Discuss targets, timing, and strategy with your legion.
                  </p>
                </div>
              ) : (
                raidMessages.map((msg) => (
                  <LegionMessageRow
                    key={msg.id}
                    msg={msg}
                    isSelf={msg.username === myMember?.username}
                  />
                ))
              )}
              {raidTypingUsers.length > 0 && (
                <div className="flex items-center gap-2 px-1 pt-1 text-xs text-muted-foreground">
                  <span className="flex gap-1">
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground/70 [animation-delay:-0.2s]" />
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground/70 [animation-delay:-0.1s]" />
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground/70" />
                  </span>
                  <span>
                    {raidTypingUsers.length === 1
                      ? `${raidTypingUsers[0].username} is typing…`
                      : `${raidTypingUsers.length} members are typing…`}
                  </span>
                </div>
              )}
              <div className="h-1" />
            </div>
          </ScrollArea>

          <div className="border-t border-border/60 p-3">
            <div className="mx-auto flex max-w-3xl items-end gap-2">
              <div className="flex-1">
                <Textarea
                  value={raidDraft}
                  onChange={(e) => {
                    setRaidDraft(e.target.value)
                    onRaidTyping(e.target.value.length > 0)
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault()
                      handleRaidSend()
                    }
                  }}
                  placeholder={`Plan a raid with ${legion.name}…`}
                  rows={1}
                  className="min-h-[44px] max-h-40 resize-none scrollbar-island rounded-sm"
                />
                <p className="mt-1 px-1 text-[10px] text-muted-foreground">
                  Press <kbd className="rounded-sm bg-muted px-1 py-0.5">Enter</kbd> to send · Only legion members can see this
                </p>
              </div>
              <Button
                onClick={handleRaidSend}
                disabled={!raidDraft.trim()}
                size="icon"
                className="h-11 w-11 shrink-0 rounded-sm"
                aria-label="Send raid message"
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </>
      )}

      {activeTab === 'tasks' && (
        <TaskListPanel
          tasks={legion.tasks}
          isLeader={isLeader}
          currentUserId={currentUserId}
          onUpdateTask={onUpdateTask}
          onDeleteTask={onDeleteTask}
          onAssign={() => setTaskDialogOpen(true)}
        />
      )}

      {activeTab === 'members' && (
        <MembersPanel
          members={legion.members}
          isLeader={isLeader}
          currentUserId={currentUserId}
          onKick={(m) => setKickTarget(m)}
          onAssignRole={onAssignRole}
        />
      )}

      {/* Assign task dialog */}
      <AssignTaskDialog
        open={taskDialogOpen}
        onOpenChange={setTaskDialogOpen}
        members={legion.members}
        onAssign={onAssignTask}
      />

      {/* Recruit dialog */}
      <Dialog open={recruitOpen} onOpenChange={setRecruitOpen}>
        <DialogContent className="sm:max-w-md rounded-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 mono-header">
              <UserPlus className="h-4 w-4 text-primary" />
              Recruit Players
            </DialogTitle>
            <DialogDescription>
              Write a recruitment pitch. It will be posted to the public{' '}
              <strong>Legion Recruitment</strong> channel for all survivors to see.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="rounded-sm border border-border bg-background/40 p-2 text-xs">
              <p className="text-muted-foreground mono-header text-[10px]">Preview:</p>
              <p className="mt-1 whitespace-pre-wrap text-foreground/90">
                {legion.iconType === 'image' ? '[Logo]' : legion.icon} [{legion.tag}] {legion.name} is recruiting!
                <br />━ <em>{recruitReason.trim() || 'your reason here'}</em>
                <br />━ In-game ID: {legion.inGameLegionId}
                <br />━ Contact leader @{myMember?.username || 'you'}
              </p>
            </div>
            <Textarea
              value={recruitReason}
              onChange={(e) => setRecruitReason(e.target.value)}
              placeholder="Why do you need players? e.g. 'Looking for 5 active raiders for daily island raids. Must be level 50+.'"
              rows={4}
              maxLength={400}
              autoFocus
              className="rounded-sm"
            />
            <p className="text-[11px] text-muted-foreground">
              {recruitReason.length}/400 characters
            </p>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setRecruitOpen(false)} className="rounded-sm">
              Cancel
            </Button>
            <Button onClick={handleRecruit} disabled={!recruitReason.trim()} className="rounded-sm mono-header">
              <UserPlus className="mr-2 h-4 w-4" />
              Post to Recruitment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Disband dialog */}
      <AlertDialog open={disbandDialogOpen} onOpenChange={setDisbandDialogOpen}>
        <AlertDialogContent className="rounded-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="mono-header">Disband {legion.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove the legion, kick all {legion.memberCount} member
              {legion.memberCount === 1 ? '' : 's'}, and delete all tasks and chat history. This
              action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-sm">Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90 text-destructive-foreground rounded-sm mono-header"
              onClick={() => {
                onDisband()
                setDisbandDialogOpen(false)
              }}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Disband Legion
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Kick member dialog */}
      <AlertDialog open={!!kickTarget} onOpenChange={(v) => !v && setKickTarget(null)}>
        <AlertDialogContent className="rounded-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="mono-header">
              Kick {kickTarget?.avatar} {kickTarget?.username}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This member will be removed from {legion.name} immediately. They will need to find or
              create a new legion to rejoin. You can undo this only by re-inviting them.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-sm">Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90 text-destructive-foreground rounded-sm mono-header"
              onClick={() => {
                if (kickTarget) onKick(kickTarget.userId)
                setKickTarget(null)
              }}
            >
              <UserMinus className="mr-2 h-4 w-4" />
              Kick Member
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

function LegionMessageRow({ msg, isSelf }: { msg: ChatMessage; isSelf: boolean }) {
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
    <div className={cn('msg-in group flex items-start gap-3 rounded-sm px-2 py-1.5 hover:bg-primary/5', isSelf && 'bg-primary/10 border-l-2 border-l-primary')}>
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

function TaskListPanel({
  tasks,
  isLeader,
  currentUserId,
  onUpdateTask,
  onDeleteTask,
  onAssign,
}: {
  tasks: LegionTask[]
  isLeader: boolean
  currentUserId: string
  onUpdateTask: (taskId: string, status: LegionTaskStatus) => void
  onDeleteTask: (taskId: string) => void
  onAssign: () => void
}) {
  const myTasks = tasks.filter((t) => t.assigneeId === currentUserId)
  const otherTasks = tasks.filter((t) => t.assigneeId !== currentUserId)

  return (
    <ScrollArea className="flex-1 scrollbar-island">
      <div className="mx-auto max-w-3xl space-y-4 p-3 sm:p-4">
        {tasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
            <div className="mb-3 grid h-14 w-14 place-items-center rounded-sm bg-muted/40 text-3xl">
              📋
            </div>
            <h3 className="text-sm font-semibold mono-header">No tasks assigned yet</h3>
            <p className="mt-1 max-w-xs text-xs text-muted-foreground">
              {isLeader
                ? 'As the leader, assign missions to your legion members to coordinate your survival effort.'
                : 'Your leader has not assigned any tasks yet. Check back later.'}
            </p>
            {isLeader && (
              <Button size="sm" className="mt-3 rounded-sm mono-header" onClick={onAssign}>
                <ClipboardList className="mr-2 h-3.5 w-3.5" />
                Assign First Task
              </Button>
            )}
          </div>
        ) : (
          <>
            {myTasks.length > 0 && (
              <div>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-primary mono-header">
                  Your Tasks ({myTasks.length})
                </h3>
                <div className="space-y-2">
                  {myTasks.map((t) => (
                    <TaskCard
                      key={t.id}
                      task={t}
                      canUpdate
                      canDelete={isLeader}
                      onUpdate={onUpdateTask}
                      onDelete={onDeleteTask}
                    />
                  ))}
                </div>
              </div>
            )}

            {otherTasks.length > 0 && (
              <div>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground mono-header">
                  Legion Tasks ({otherTasks.length})
                </h3>
                <div className="space-y-2">
                  {otherTasks.map((t) => (
                    <TaskCard
                      key={t.id}
                      task={t}
                      canUpdate={isLeader}
                      canDelete={isLeader}
                      onUpdate={onUpdateTask}
                      onDelete={onDeleteTask}
                    />
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </ScrollArea>
  )
}

function TaskCard({
  task,
  canUpdate,
  canDelete,
  onUpdate,
  onDelete,
}: {
  task: LegionTask
  canUpdate: boolean
  canDelete: boolean
  onUpdate: (taskId: string, status: LegionTaskStatus) => void
  onDelete: (taskId: string) => void
}) {
  const meta = TASK_STATUS_META[task.status]
  return (
    <div className="rounded-sm border border-border bg-card/60 p-3 border-l-2 border-l-primary/50">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h4 className="text-sm font-semibold">{task.title}</h4>
            <span
              className={cn(
                'inline-flex items-center gap-1 rounded-sm px-2 py-0.5 text-[10px] font-medium mono-header',
                meta.chipBg,
                meta.chipText,
              )}
            >
              {meta.icon}
              {meta.label}
            </span>
          </div>
          {task.description && (
            <p className="mt-1 text-xs text-muted-foreground whitespace-pre-wrap break-words">
              {task.description}
            </p>
          )}
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-muted-foreground">
            <span className="flex items-center gap-1">
              <UserIcon className="h-3 w-3" />
              Assigned to <strong className="text-foreground">{task.assigneeName}</strong>
            </span>
            <span className="flex items-center gap-1">
              <Crown className="h-3 w-3 text-primary" />
              By {task.assignerName}
            </span>
            <span className="font-mono">· {formatTime(task.createdAt)}</span>
          </div>
        </div>
        {canDelete && (
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive rounded-sm"
            onClick={() => onDelete(task.id)}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>

      {canUpdate && task.status !== 'done' && task.status !== 'failed' && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {task.status === 'pending' && (
            <Button
              size="sm"
              variant="outline"
              className="h-7 gap-1 text-[11px] rounded-sm mono-header"
              onClick={() => onUpdate(task.id, 'in_progress')}
            >
              <Flag className="h-3 w-3" />
              Start
            </Button>
          )}
          {task.status === 'in_progress' && (
            <Button
              size="sm"
              variant="outline"
              className="h-7 gap-1 text-[11px] rounded-sm mono-header"
              onClick={() => onUpdate(task.id, 'pending')}
            >
              <Clock className="h-3 w-3" />
              Pause
            </Button>
          )}
          <Button
            size="sm"
            variant="outline"
            className="h-7 gap-1 text-[11px] text-accent hover:text-accent rounded-sm mono-header"
            onClick={() => onUpdate(task.id, 'done')}
          >
            <Check className="h-3 w-3" />
            Complete
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-7 gap-1 text-[11px] text-destructive hover:text-destructive rounded-sm mono-header"
            onClick={() => onUpdate(task.id, 'failed')}
          >
            <X className="h-3 w-3" />
            Mark Failed
          </Button>
        </div>
      )}
    </div>
  )
}

function MembersPanel({
  members,
  isLeader,
  currentUserId,
  onKick,
  onAssignRole,
}: {
  members: LegionMember[]
  isLeader: boolean
  currentUserId: string
  onKick: (m: LegionMember) => void
  onAssignRole: (userId: string, role: 'vice_captain' | 'elite' | 'member') => void
}) {
  // Count current ranks for display + limit enforcement in the UI
  const viceCaptainCount = members.filter((m) => m.role === 'vice_captain').length
  const eliteCount = members.filter((m) => m.role === 'elite').length

  return (
    <ScrollArea className="flex-1 scrollbar-island">
      <div className="mx-auto max-w-3xl space-y-3 p-3 sm:p-4">
        {/* Rank overview */}
        <div className="rounded-sm border border-border bg-card/40 p-3">
          <h3 className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mono-header">
            Rank Roster
          </h3>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="rounded-sm bg-primary/10 p-2">
              <div className="flex items-center justify-center gap-1 text-primary">
                <Crown className="h-3 w-3" />
                <span className="text-[10px] font-bold mono-header">CAPTAIN</span>
              </div>
              <p className="mt-0.5 text-xs font-mono">1 / 1</p>
            </div>
            <div className="rounded-sm bg-amber-500/10 p-2">
              <div className="flex items-center justify-center gap-1 text-amber-300">
                <Award className="h-3 w-3" />
                <span className="text-[10px] font-bold mono-header">VICE CAPTAIN</span>
              </div>
              <p className="mt-0.5 text-xs font-mono">{viceCaptainCount} / 1</p>
            </div>
            <div className="rounded-sm bg-accent/10 p-2">
              <div className="flex items-center justify-center gap-1 text-accent">
                <Star className="h-3 w-3" />
                <span className="text-[10px] font-bold mono-header">ELITE</span>
              </div>
              <p className="mt-0.5 text-xs font-mono">{eliteCount} / 3</p>
            </div>
          </div>
          {isLeader && (
            <p className="mt-2 text-center text-[10px] text-muted-foreground mono-header">
              As Captain, use the ⋮ menu on each member to assign ranks
            </p>
          )}
        </div>

        {/* Member list */}
        <div className="space-y-1">
          {members.map((m) => {
            const isSelf = m.userId === currentUserId
            const isCaptain = m.role === 'captain'
            const rank = RANK_META[m.role]
            return (
              <div
                key={m.userId}
                className={cn(
                  'flex items-center gap-3 rounded-sm border border-border bg-card/40 p-3',
                  isSelf && 'border-primary/40 bg-primary/5 border-l-2 border-l-primary',
                )}
              >
                <div className="relative">
                  <Avatar className="h-9 w-9 rounded-sm">
                    <AvatarFallback className="bg-muted text-sm rounded-sm">{m.avatar}</AvatarFallback>
                  </Avatar>
                  <span className="signal-pulse absolute -bottom-0 -right-0 h-2.5 w-2.5 rounded-full bg-accent ring-2 ring-card" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="truncate text-sm font-semibold">
                      {m.username}
                      {isSelf && (
                        <span className="ml-1 text-[10px] text-muted-foreground">(you)</span>
                      )}
                    </span>
                    <Badge className={cn('h-5 gap-1 px-1.5 text-[10px] rounded-sm', rank.chipBg, rank.chipText)}>
                      {rank.icon}
                      {rank.label}
                    </Badge>
                    <Badge variant="secondary" className="h-5 px-1.5 text-[10px] rounded-sm">
                      Lv {m.level}
                    </Badge>
                  </div>
                  <p className="text-[10px] text-muted-foreground font-mono">
                    Joined {formatDate(m.joinedAt)}
                  </p>
                </div>

                {/* Captain actions: rank assignment dropdown + kick */}
                {isLeader && !isSelf && !isCaptain && (
                  <div className="flex items-center gap-1 shrink-0">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 gap-1 rounded-sm mono-header"
                          title="Assign rank"
                        >
                          <span className="text-[11px]">Rank</span>
                          <ChevronDown className="h-3.5 w-3.5" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="rounded-sm">
                        <DropdownMenuLabel className="mono-header text-[10px]">Assign Rank</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="gap-2 mono-header text-xs"
                          disabled={m.role === 'vice_captain'}
                          onClick={() => onAssignRole(m.userId, 'vice_captain')}
                        >
                          <Award className="h-3.5 w-3.5 text-amber-300" />
                          Vice Captain
                          {viceCaptainCount >= 1 && m.role !== 'vice_captain' && (
                            <span className="ml-auto text-[10px] text-amber-400">(swaps current)</span>
                          )}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="gap-2 mono-header text-xs"
                          disabled={m.role === 'elite' || eliteCount >= 3}
                          onClick={() => onAssignRole(m.userId, 'elite')}
                        >
                          <Star className="h-3.5 w-3.5 text-accent" />
                          Elite
                          {eliteCount >= 3 && m.role !== 'elite' && (
                            <span className="ml-auto text-[10px] text-destructive">(full)</span>
                          )}
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="gap-2 mono-header text-xs"
                          disabled={m.role === 'member'}
                          onClick={() => onAssignRole(m.userId, 'member')}
                        >
                          <Shield className="h-3.5 w-3.5 text-muted-foreground" />
                          Demote to Member
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 text-destructive hover:text-destructive rounded-sm"
                      onClick={() => onKick(m)}
                      title="Kick member"
                    >
                      <UserMinus className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </ScrollArea>
  )
}

/* ----------------------------- Helpers ----------------------------- */

function formatTime(ts: string | Date): string {
  const d = typeof ts === 'string' ? new Date(ts) : ts
  if (isNaN(d.getTime())) return ''
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function formatDate(ts: string | Date): string {
  const d = typeof ts === 'string' ? new Date(ts) : ts
  if (isNaN(d.getTime())) return ''
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' })
}
