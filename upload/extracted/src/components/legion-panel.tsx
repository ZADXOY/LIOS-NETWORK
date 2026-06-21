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
import type { Legion, LegionTask, LegionTaskStatus, ChatMessage, LegionMember } from '@/lib/chat-types'
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
}

const TASK_STATUS_META: Record<
  LegionTaskStatus,
  { label: string; icon: React.ReactNode; chipBg: string; chipText: string }
> = {
  pending: {
    label: 'Pending',
    icon: <Clock className="h-3 w-3" />,
    chipBg: 'bg-amber-500/15',
    chipText: 'text-amber-300',
  },
  in_progress: {
    label: 'In Progress',
    icon: <Loader2 className="h-3 w-3" />,
    chipBg: 'bg-sky-500/15',
    chipText: 'text-sky-300',
  },
  done: {
    label: 'Done',
    icon: <Check className="h-3 w-3" />,
    chipBg: 'bg-emerald-500/15',
    chipText: 'text-emerald-300',
  },
  failed: {
    label: 'Failed',
    icon: <X className="h-3 w-3" />,
    chipBg: 'bg-rose-500/15',
    chipText: 'text-rose-300',
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
    <div className="flex flex-1 flex-col overflow-hidden min-w-0">
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
              <h2 className="truncate font-semibold leading-tight">{legion.name}</h2>
              <span className="rounded bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-mono font-bold text-amber-200">
                [{legion.tag}]
              </span>
              {isLeader && (
                <Badge className="h-5 gap-1 bg-amber-500/20 px-1.5 text-[10px] text-amber-200 hover:bg-amber-500/30">
                  <Crown className="h-3 w-3" />
                  Leader
                </Badge>
              )}
              <Badge
                variant="secondary"
                className={
                  isApproved
                    ? 'h-5 px-1.5 text-[10px] bg-emerald-500/15 text-emerald-300'
                    : 'h-5 px-1.5 text-[10px] bg-amber-500/15 text-amber-300'
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
              className="h-8 gap-1 border-amber-500/30 text-amber-300 hover:bg-amber-500/10"
              onClick={() => setRecruitOpen(true)}
              title="Post a recruitment message to the Guild Recruitment channel"
            >
              <UserPlus className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Recruit</span>
            </Button>
          )}
          {isLeader && (
            <Button
              size="sm"
              variant="default"
              className="h-8 gap-1"
              onClick={() => setTaskDialogOpen(true)}
            >
              <ClipboardList className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Assign Task</span>
            </Button>
          )}
          <Button
            size="sm"
            variant="ghost"
            className="h-8"
            onClick={() => onLeave()}
            title="Leave legion"
          >
            <LogOut className="h-3.5 w-3.5" />
          </Button>
          {isLeader && (
            <Button
              size="sm"
              variant="ghost"
              className="h-8 text-rose-400 hover:text-rose-300"
              onClick={() => setDisbandDialogOpen(true)}
              title="Disband legion"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </div>

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
              'flex items-center gap-1.5 px-3 py-2.5 text-xs font-medium border-b-2 -mb-px transition-colors',
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
        <div className="border-b border-border/60 bg-amber-500/5 px-3 sm:px-4 py-2">
          <div className="flex items-start gap-2">
            <Megaphone className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-400" />
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-amber-400">
                  Legion Notice
                </span>
                {isLeader && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-5 px-1.5 text-[10px] text-amber-400 hover:text-amber-300"
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
                    className="text-xs"
                    autoFocus
                  />
                  <div className="flex gap-1">
                    <Button size="sm" className="h-6 text-[11px]" onClick={handleSaveNotice} disabled={!noticeDraft.trim()}>
                      Save Notice
                    </Button>
                    <Button size="sm" variant="ghost" className="h-6 text-[11px]" onClick={() => setEditingNotice(false)}>
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
          <ScrollArea className="flex-1 scrollbar-survival px-2 sm:px-4 py-3">
            <div className="mx-auto max-w-3xl space-y-1">
              {messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
                  <div className="mb-3 grid h-14 w-14 place-items-center rounded-2xl bg-muted/40 text-3xl">
                    🛡️
                  </div>
                  <h3 className="text-sm font-semibold">Legion chat is quiet</h3>
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
                  className="min-h-[44px] max-h-40 resize-none scrollbar-survival"
                />
                <p className="mt-1 px-1 text-[10px] text-muted-foreground">
                  Press <kbd className="rounded bg-muted px-1 py-0.5">Enter</kbd> to send,
                  <kbd className="ml-1 rounded bg-muted px-1 py-0.5">Shift</kbd>+
                  <kbd className="rounded bg-muted px-1 py-0.5">Enter</kbd> for new line · Only legion members can see this
                </p>
              </div>
              <Button
                onClick={handleSend}
                disabled={!draft.trim()}
                size="icon"
                className="h-11 w-11 shrink-0"
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
          <ScrollArea className="flex-1 scrollbar-survival px-2 sm:px-4 py-3">
            <div className="mx-auto max-w-3xl space-y-1">
              <div className="mb-3 rounded-lg border border-red-500/20 bg-red-500/5 p-3">
                <p className="flex items-center gap-1.5 text-xs font-semibold text-red-300">
                  <Flame className="h-3.5 w-3.5" />
                  Legion Raid Planning
                </p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  Private to your legion. Coordinate attack times, target selection, and loadouts here.
                </p>
              </div>
              {raidMessages.length === 0 ? (
                <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
                  <div className="mb-3 grid h-14 w-14 place-items-center rounded-2xl bg-red-500/10 text-3xl">
                    🔥
                  </div>
                  <h3 className="text-sm font-semibold">No raid plans yet</h3>
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
                  className="min-h-[44px] max-h-40 resize-none scrollbar-survival"
                />
                <p className="mt-1 px-1 text-[10px] text-muted-foreground">
                  Press <kbd className="rounded bg-muted px-1 py-0.5">Enter</kbd> to send · Only legion members can see this
                </p>
              </div>
              <Button
                onClick={handleRaidSend}
                disabled={!raidDraft.trim()}
                size="icon"
                className="h-11 w-11 shrink-0"
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
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="h-4 w-4 text-amber-400" />
              Recruit Players
            </DialogTitle>
            <DialogDescription>
              Write a recruitment pitch. It will be posted to the public{' '}
              <strong>Guild Recruitment</strong> channel for all survivors to see.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="rounded-lg border border-border bg-background/40 p-2 text-xs">
              <p className="text-muted-foreground">Your recruitment post will look like:</p>
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
            />
            <p className="text-[11px] text-muted-foreground">
              {recruitReason.length}/400 characters
            </p>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setRecruitOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleRecruit} disabled={!recruitReason.trim()}>
              <UserPlus className="mr-2 h-4 w-4" />
              Post to Guild Recruitment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Disband dialog */}
      <AlertDialog open={disbandDialogOpen} onOpenChange={setDisbandDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Disband {legion.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove the legion, kick all {legion.memberCount} member
              {legion.memberCount === 1 ? '' : 's'}, and delete all tasks and chat history. This
              action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-rose-600 hover:bg-rose-700 text-white"
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
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Kick {kickTarget?.avatar} {kickTarget?.username}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This member will be removed from {legion.name} immediately. They will need to find or
              create a new legion to rejoin. You can undo this only by re-inviting them.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-rose-600 hover:bg-rose-700 text-white"
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
        <span className="rounded-full bg-muted/40 px-3 py-0.5 text-[11px] italic text-muted-foreground">
          ⚙️ {msg.content} · {formatTime(msg.timestamp)}
        </span>
      </div>
    )
  }
  return (
    <div className={cn('msg-in group flex items-start gap-3 rounded-lg px-2 py-1.5 hover:bg-amber-500/5', isSelf && 'bg-amber-500/10')}>
      <Avatar className="h-8 w-8 shrink-0">
        <AvatarFallback
          className={cn(
            'text-sm',
            isSelf ? 'bg-amber-500/25 text-amber-200' : 'bg-muted text-foreground',
          )}
        >
          {msg.avatar}
        </AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <span className={cn('text-sm font-semibold', isSelf && 'text-amber-300')}>
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
    <ScrollArea className="flex-1 scrollbar-survival">
      <div className="mx-auto max-w-3xl space-y-4 p-3 sm:p-4">
        {tasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
            <div className="mb-3 grid h-14 w-14 place-items-center rounded-2xl bg-muted/40 text-3xl">
              📋
            </div>
            <h3 className="text-sm font-semibold">No tasks assigned yet</h3>
            <p className="mt-1 max-w-xs text-xs text-muted-foreground">
              {isLeader
                ? 'As the leader, assign missions to your legion members to coordinate your survival effort.'
                : 'Your leader has not assigned any tasks yet. Check back later.'}
            </p>
            {isLeader && (
              <Button size="sm" className="mt-3" onClick={onAssign}>
                <ClipboardList className="mr-2 h-3.5 w-3.5" />
                Assign First Task
              </Button>
            )}
          </div>
        ) : (
          <>
            {myTasks.length > 0 && (
              <div>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-amber-400">
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
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
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
    <div className="rounded-lg border border-border bg-card/60 p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h4 className="text-sm font-semibold">{task.title}</h4>
            <span
              className={cn(
                'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium',
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
              <Crown className="h-3 w-3 text-amber-400" />
              By {task.assignerName}
            </span>
            <span>· {formatTime(task.createdAt)}</span>
          </div>
        </div>
        {canDelete && (
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7 shrink-0 text-muted-foreground hover:text-rose-400"
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
              className="h-7 gap-1 text-[11px]"
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
              className="h-7 gap-1 text-[11px]"
              onClick={() => onUpdate(task.id, 'pending')}
            >
              <Clock className="h-3 w-3" />
              Pause
            </Button>
          )}
          <Button
            size="sm"
            variant="outline"
            className="h-7 gap-1 text-[11px] text-emerald-400 hover:text-emerald-300"
            onClick={() => onUpdate(task.id, 'done')}
          >
            <Check className="h-3 w-3" />
            Complete
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-7 gap-1 text-[11px] text-rose-400 hover:text-rose-300"
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
}: {
  members: LegionMember[]
  isLeader: boolean
  currentUserId: string
  onKick: (m: LegionMember) => void
}) {
  return (
    <ScrollArea className="flex-1 scrollbar-survival">
      <div className="mx-auto max-w-3xl space-y-1 p-3 sm:p-4">
        {members.map((m) => {
          const isSelf = m.userId === currentUserId
          const isMemberLeader = m.role === 'leader'
          return (
            <div
              key={m.userId}
              className={cn(
                'flex items-center gap-3 rounded-lg border border-border bg-card/40 p-3',
                isSelf && 'border-amber-500/40 bg-amber-500/5',
              )}
            >
              <div className="relative">
                <Avatar className="h-9 w-9">
                  <AvatarFallback className="bg-muted text-sm">{m.avatar}</AvatarFallback>
                </Avatar>
                <span className="dot-online absolute -bottom-0 -right-0 h-2.5 w-2.5 rounded-full bg-emerald-500 ring-2 ring-card" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="truncate text-sm font-semibold">
                    {m.username}
                    {isSelf && (
                      <span className="ml-1 text-[10px] text-muted-foreground">(you)</span>
                    )}
                  </span>
                  {isMemberLeader ? (
                    <Badge className="h-5 gap-1 bg-amber-500/20 px-1.5 text-[10px] text-amber-200 hover:bg-amber-500/30">
                      <Crown className="h-3 w-3" />
                      Leader
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="h-5 gap-1 px-1.5 text-[10px]">
                      <Shield className="h-3 w-3" />
                      Member
                    </Badge>
                  )}
                  <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">
                    Lv {m.level}
                  </Badge>
                </div>
                <p className="text-[10px] text-muted-foreground">
                  Joined {formatDate(m.joinedAt)}
                </p>
              </div>
              {isLeader && !isSelf && !isMemberLeader && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8 text-rose-400 hover:text-rose-300"
                  onClick={() => onKick(m)}
                >
                  <UserMinus className="h-3.5 w-3.5" />
                  <span className="ml-1 hidden sm:inline">Kick</span>
                </Button>
              )}
            </div>
          )
        })}
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
