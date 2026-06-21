'use client'

import { useRef, useState } from 'react'
import {
  Shield,
  Plus,
  Search,
  Loader2,
  Users,
  Crown,
  LogIn,
  Flame,
  Upload,
  Image as ImageIcon,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import type { Legion } from '@/lib/chat-types'

// Preset legion emoji logos the leader can pick from
const PRESET_LOGOS = [
  '🛡️', '⚔️', '🦅', '🐺', '🐉', '🔥',
  '💀', '👑', '⚜️', '🔱', '🎯', '⚡',
  '🦁', '🦂', '🐍', '🦈', '🦖', '🦊',
]

export interface CreateLegionPayload {
  name: string
  tag: string
  description: string
  icon: string
  iconType: 'emoji' | 'image'
  inGameLegionId: string
  visibility: 'public' | 'private'
  password?: string
}

interface Props {
  openLegions: Legion[]
  onCreate: (data: CreateLegionPayload) => void
  onJoin: (legionId: string, password?: string) => void
  onRefresh: () => void
}

export function LegionOnboarding({ openLegions, onCreate, onJoin, onRefresh }: Props) {
  const [mode, setMode] = useState<'choose' | 'create' | 'join'>('choose')
  const [createOpen, setCreateOpen] = useState(false)
  const [search, setSearch] = useState('')

  const filtered = openLegions.filter(
    (l) =>
      l.name.toLowerCase().includes(search.toLowerCase()) ||
      l.tag.toLowerCase().includes(search.toLowerCase()) ||
      l.description.toLowerCase().includes(search.toLowerCase()),
  )

  return (
    <div className="flex flex-1 flex-col items-center justify-center overflow-hidden p-4 panel-in">
      <div className="w-full max-w-2xl">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-4 grid h-16 w-16 place-items-center rounded-md bg-primary/15 text-4xl ring-1 ring-primary/30 ember-flicker">
            🛡️
          </div>
          <div className="mb-1 inline-flex items-center gap-1.5 rounded-sm border border-primary/30 bg-primary/10 px-2 py-0.5 text-[10px] mono-header text-primary">
            <Shield className="h-2.5 w-2.5" />
            Legion System
          </div>
          <h2 className="text-xl font-bold tracking-tight mono-header">Join or Found a Legion</h2>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Legions are private crews with their own chat, member roster, and task assigner. Only
            the leader can assign tasks, kick members, and post notices.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* Create card */}
          <button
            onClick={() => setCreateOpen(true)}
            className="group rounded-md border border-primary/30 bg-primary/5 p-5 text-left transition-all hover:border-primary/60 hover:bg-primary/10 clip-corner"
          >
            <div className="mb-3 grid h-12 w-12 place-items-center rounded-sm bg-primary/20 text-2xl">
              👑
            </div>
            <h3 className="font-semibold text-primary mono-header">Found a Legion</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Start a new legion. Pick or upload a logo, become its leader — assign tasks, kick
              members, post notices, and disband when ready.
            </p>
            <div className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-primary mono-header">
              <Plus className="h-3 w-3" />
              Become a Leader
            </div>
          </button>

          {/* Join card */}
          <button
            onClick={() => {
              setMode('join')
              onRefresh()
            }}
            className="group rounded-md border border-border bg-card/60 p-5 text-left transition-all hover:border-accent/40 hover:bg-card clip-corner"
          >
            <div className="mb-3 grid h-12 w-12 place-items-center rounded-sm bg-accent/15 text-2xl">
              ⚔️
            </div>
            <h3 className="font-semibold mono-header">Join a Legion</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Browse existing legions and join one as a member. The leader can assign you tasks
              that you can mark in-progress or complete.
            </p>
            <div className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-accent mono-header">
              <LogIn className="h-3 w-3" />
              Find a Crew
            </div>
          </button>
        </div>

        {mode === 'join' && (
          <div className="mt-4 rounded-md border border-border bg-card/60 p-4">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h3 className="text-sm font-semibold flex items-center gap-2 mono-header">
                <Users className="h-4 w-4" />
                Open Legions ({filtered.length})
              </h3>
              <Button size="sm" variant="ghost" className="h-7 text-xs rounded-sm" onClick={onRefresh}>
                <Loader2 className="mr-1 h-3 w-3" />
                Refresh
              </Button>
            </div>

            <div className="relative mb-3">
              <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by name, tag, or description…"
                className="h-8 pl-7 text-xs rounded-sm"
              />
            </div>

            <ScrollArea className="h-64 scrollbar-island">
              <div className="space-y-2 pr-1">
                {filtered.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-10 text-center">
                    <div className="mb-2 text-3xl">🕸️</div>
                    <p className="text-xs text-muted-foreground">
                      No open legions found. Be the first — found one!
                    </p>
                  </div>
                ) : (
                  filtered.map((l) => <LegionListCard key={l.id} legion={l} onJoin={onJoin} />)
                )}
              </div>
            </ScrollArea>
          </div>
        )}

        <div className="mt-6 grid grid-cols-3 gap-2 text-center text-[11px] text-muted-foreground">
          <div className="rounded-sm border border-border bg-card/40 p-3">
            <div className="mb-1 text-lg">💬</div>
            <span className="mono-header text-[10px]">Private Chat</span>
          </div>
          <div className="rounded-sm border border-border bg-card/40 p-3">
            <div className="mb-1 text-lg">📋</div>
            <span className="mono-header text-[10px]">Task Assigner</span>
          </div>
          <div className="rounded-sm border border-border bg-card/40 p-3">
            <div className="mb-1 text-lg">📢</div>
            <span className="mono-header text-[10px]">Notice Board</span>
          </div>
        </div>
      </div>

      <CreateLegionDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreate={(d) => {
          onCreate(d)
          setCreateOpen(false)
        }}
      />
    </div>
  )
}

/** Renders a legion's logo (emoji or uploaded image) at a given pixel size. */
export function LegionLogo({
  icon,
  iconType,
  size = 40,
  className = '',
}: {
  icon: string
  iconType: 'emoji' | 'image'
  size?: number
  className?: string
}) {
  if (iconType === 'image' && icon) {
    return (
      <img
        src={icon}
        alt="Legion logo"
        width={size}
        height={size}
        className={`rounded-sm object-cover ring-1 ring-primary/30 ${className}`}
        style={{ width: size, height: size }}
        onError={(e) => {
          ;(e.currentTarget as HTMLImageElement).style.display = 'none'
        }}
      />
    )
  }
  // Emoji fallback
  const fontSize = Math.round(size * 0.55)
  return (
    <div
      className={`grid place-items-center rounded-sm bg-primary/15 ring-1 ring-primary/20 ${className}`}
      style={{ width: size, height: size, fontSize }}
    >
      <span>{icon || '🛡️'}</span>
    </div>
  )
}

function LegionListCard({
  legion,
  onJoin,
}: {
  legion: Legion
  onJoin: (legionId: string, password?: string) => void
}) {
  const [showPasswordInput, setShowPasswordInput] = useState(false)
  const [password, setPassword] = useState('')

  const handleJoin = () => {
    if (legion.visibility === 'private' && !showPasswordInput) {
      setShowPasswordInput(true)
      return
    }
    onJoin(legion.id, legion.visibility === 'private' ? password : undefined)
    setPassword('')
    setShowPasswordInput(false)
  }

  return (
    <div className="rounded-sm border border-border bg-background/40 p-3">
      <div className="flex items-center gap-3">
        <LegionLogo
          icon={legion.icon}
          iconType={legion.iconType || 'emoji'}
          size={40}
          className="shrink-0"
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="truncate text-sm font-semibold">{legion.name}</span>
            <span className="rounded-sm bg-primary/20 px-1.5 py-0.5 text-[10px] font-mono font-bold text-primary">
              [{legion.tag}]
            </span>
            <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">
              <Users className="mr-1 h-2.5 w-2.5" />
              {legion.memberCount}/50
            </Badge>
            {legion.visibility === 'private' && (
              <Badge className="h-5 gap-1 bg-amber-500/15 px-1.5 text-[10px] text-amber-300 rounded-sm">
                🔒 Private
              </Badge>
            )}
            {legion.visibility === 'public' && (
              <Badge className="h-5 gap-1 bg-accent/15 px-1.5 text-[10px] text-accent rounded-sm">
                🌐 Public
              </Badge>
            )}
          </div>
          <p className="truncate text-xs text-muted-foreground">{legion.description}</p>
        </div>
        {!showPasswordInput && (
          <Button size="sm" className="h-8 shrink-0 rounded-sm mono-header" onClick={handleJoin}>
            <LogIn className="mr-1 h-3.5 w-3.5" />
            Request
          </Button>
        )}
      </div>
      {showPasswordInput && legion.visibility === 'private' && (
        <div className="mt-3 flex items-center gap-2">
          <Input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter legion password…"
            className="h-8 flex-1 rounded-sm text-xs"
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleJoin()
            }}
            autoFocus
          />
          <Button size="sm" className="h-8 rounded-sm mono-header" onClick={handleJoin} disabled={!password.trim()}>
            Submit
          </Button>
          <Button size="sm" variant="ghost" className="h-8 rounded-sm" onClick={() => { setShowPasswordInput(false); setPassword('') }}>
            Cancel
          </Button>
        </div>
      )}
    </div>
  )
}

function CreateLegionDialog({
  open,
  onOpenChange,
  onCreate,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  onCreate: (data: CreateLegionPayload) => void
}) {
  const [name, setName] = useState('')
  const [tag, setTag] = useState('')
  const [description, setDescription] = useState('')
  const [inGameLegionId, setInGameLegionId] = useState('')
  const [visibility, setVisibility] = useState<'public' | 'private'>('public')
  const [password, setPassword] = useState('')

  // Logo state: either an emoji from presets, or an uploaded image URL
  const [iconType, setIconType] = useState<'emoji' | 'image'>('emoji')
  const [emojiIcon, setEmojiIcon] = useState<string>('🛡️')
  const [imageIcon, setImageIcon] = useState<string>('')
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const currentIcon = iconType === 'image' ? imageIcon : emojiIcon

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setUploadError(null)
    setUploading(true)

    try {
      const formData = new FormData()
      formData.append('logo', file)

      const res = await fetch('/api/legion-upload', {
        method: 'POST',
        body: formData,
      })

      const data = await res.json()
      if (!res.ok) {
        setUploadError(data?.error || 'Upload failed')
        return
      }

      setImageIcon(data.url)
      setIconType('image')
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Network error during upload')
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const handleSubmit = () => {
    if (!name.trim() || tag.trim().length < 2) return
    if (iconType === 'image' && !imageIcon) return
    if (!inGameLegionId.trim()) return
    if (visibility === 'private' && !password.trim()) return

    onCreate({
      name: name.trim(),
      tag: tag.trim().toUpperCase(),
      description: description.trim(),
      icon: iconType === 'image' ? imageIcon : emojiIcon,
      iconType,
      inGameLegionId: inGameLegionId.trim(),
      visibility,
      password: visibility === 'private' ? password.trim() : undefined,
    })

    // Reset form
    setName('')
    setTag('')
    setDescription('')
    setInGameLegionId('')
    setVisibility('public')
    setPassword('')
    setIconType('emoji')
    setEmojiIcon('🛡️')
    setImageIcon('')
    setUploadError(null)
  }

  const canSubmit =
    name.trim().length > 0 &&
    tag.trim().length >= 2 &&
    inGameLegionId.trim().length > 0 &&
    !uploading &&
    (iconType === 'emoji' ? !!emojiIcon : !!imageIcon) &&
    (visibility === 'public' || password.trim().length > 0)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto scrollbar-island rounded-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 mono-header">
            <Crown className="h-4 w-4 text-primary" />
            Found a New Legion
          </DialogTitle>
          <DialogDescription>
            Create a legion and become its leader. Pick a preset logo or upload your own, then
            recruit members, assign tasks, post notices, and disband at any time.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Logo picker */}
          <div className="space-y-2">
            <Label className="mono-header text-xs">Legion Logo</Label>
            <p className="text-xs text-muted-foreground">
              Pick a preset crest or upload your own image (PNG/JPG/WebP, max 2MB).
            </p>

            {/* Preview + upload trigger */}
            <div className="flex items-center gap-3">
              <div className="grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-sm bg-primary/10 ring-1 ring-primary/30">
                {iconType === 'image' && imageIcon ? (
                  <img
                    src={imageIcon}
                    alt="Legion logo preview"
                    className="h-full w-full object-cover"
                    onError={(e) => {
                      ;(e.currentTarget as HTMLImageElement).style.display = 'none'
                    }}
                  />
                ) : (
                  <span className="text-3xl">{emojiIcon}</span>
                )}
              </div>
              <div className="flex-1 space-y-1.5">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml"
                  onChange={handleFileChange}
                  className="hidden"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="w-full rounded-sm"
                  disabled={uploading}
                  onClick={() => fileInputRef.current?.click()}
                >
                  {uploading ? (
                    <>
                      <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                      Uploading…
                    </>
                  ) : (
                    <>
                      <Upload className="mr-2 h-3.5 w-3.5" />
                      Upload Custom Logo
                    </>
                  )}
                </Button>
                {iconType === 'image' && imageIcon && !uploading && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="w-full h-7 text-xs rounded-sm"
                    onClick={() => {
                      setIconType('emoji')
                      setImageIcon('')
                    }}
                  >
                    Use preset instead
                  </Button>
                )}
              </div>
            </div>

            {uploadError && (
              <p className="text-xs text-destructive">⚠️ {uploadError}</p>
            )}

            {/* Preset grid — only show when not using an uploaded image */}
            {iconType !== 'image' && (
              <div className="rounded-sm border border-border bg-background/40 p-2">
                <p className="mb-1.5 flex items-center gap-1 px-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mono-header">
                  <ImageIcon className="h-3 w-3" />
                  Preset Crests
                </p>
                <div className="grid grid-cols-9 gap-1">
                  {PRESET_LOGOS.map((emoji) => (
                    <button
                      key={emoji}
                      type="button"
                      onClick={() => {
                        setEmojiIcon(emoji)
                        setIconType('emoji')
                      }}
                      className={`grid h-8 w-8 place-items-center rounded-sm text-lg transition-all ${
                        emojiIcon === emoji
                          ? 'bg-primary/30 ring-2 ring-primary'
                          : 'bg-muted/40 hover:bg-muted/70'
                      }`}
                      aria-label={`Pick ${emoji} as logo`}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <Separator />

          <div className="space-y-2">
            <Label htmlFor="legion-name" className="mono-header text-xs">Legion Name</Label>
            <Input
              id="legion-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Wasteland Wolves"
              maxLength={30}
              autoFocus
              className="rounded-sm"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="legion-tag" className="mono-header text-xs">
              Legion Tag{' '}
              <span className="text-muted-foreground">(2-6 letters, unique)</span>
            </Label>
            <Input
              id="legion-tag"
              value={tag}
              onChange={(e) => setTag(e.target.value.toUpperCase().slice(0, 6))}
              placeholder="e.g. WLF"
              className="font-mono rounded-sm"
              maxLength={6}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="legion-ingame-id" className="mono-header text-xs">
              In-game Legion ID{' '}
              <span className="text-primary">(required)</span>
            </Label>
            <Input
              id="legion-ingame-id"
              value={inGameLegionId}
              onChange={(e) => setInGameLegionId(e.target.value.slice(0, 50))}
              placeholder="e.g. 1234567"
              maxLength={50}
              className="rounded-sm"
            />
            <p className="text-[11px] text-muted-foreground">
              Enter the legion ID from your in-game profile. The admin will verify this before approving your legion.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="legion-desc" className="mono-header text-xs">
              Description <span className="text-muted-foreground">(optional)</span>
            </Label>
            <Textarea
              id="legion-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What is your legion about? Recruiting raiders? Builders? Traders?"
              rows={3}
              maxLength={200}
              className="rounded-sm"
            />
          </div>

          <Separator />

          {/* Visibility + Password */}
          <div className="space-y-3">
            <Label className="mono-header text-xs">Visibility</Label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setVisibility('public')}
                className={`rounded-sm border p-3 text-left transition-all ${
                  visibility === 'public'
                    ? 'border-accent bg-accent/10 ring-1 ring-accent'
                    : 'border-border hover:border-accent/40'
                }`}
              >
                <div className="text-lg">🌐</div>
                <div className="mt-1 text-xs font-semibold mono-header">Public</div>
                <div className="text-[10px] text-muted-foreground">Anyone can request to join (needs approval)</div>
              </button>
              <button
                type="button"
                onClick={() => setVisibility('private')}
                className={`rounded-sm border p-3 text-left transition-all ${
                  visibility === 'private'
                    ? 'border-primary bg-primary/10 ring-1 ring-primary'
                    : 'border-border hover:border-primary/40'
                }`}
              >
                <div className="text-lg">🔒</div>
                <div className="mt-1 text-xs font-semibold mono-header">Private</div>
                <div className="text-[10px] text-muted-foreground">Requires password + approval</div>
              </button>
            </div>

            {visibility === 'private' && (
              <div className="space-y-2">
                <Label htmlFor="legion-password" className="mono-header text-xs">
                  Password <span className="text-primary">(required for private)</span>
                </Label>
                <Input
                  id="legion-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Members need this to request to join"
                  maxLength={100}
                  className="rounded-sm"
                />
                <p className="text-[11px] text-muted-foreground">
                  You can change this later from the legion settings. Members still need Captain / Vice Captain approval after entering the password.
                </p>
              </div>
            )}
          </div>

          <Separator />

          <div className="rounded-sm bg-primary/5 p-3 text-xs text-primary/80 border-l-2 border-primary">
            <p className="flex items-center gap-1 font-semibold text-primary mono-header">
              <Flame className="h-3 w-3" />
              Leader Powers
            </p>
            <ul className="mt-1 space-y-0.5 list-disc list-inside text-muted-foreground">
              <li>Assign tasks to any legion member</li>
              <li>Kick members from the legion</li>
              <li>Post and edit the legion notice</li>
              <li>Recruit players to the Legion Recruitment channel</li>
              <li>Disband the legion (deletes everything)</li>
            </ul>
          </div>

          <div className="rounded-sm border border-primary/30 bg-primary/10 p-3 text-xs">
            <p className="flex items-center gap-1 font-semibold text-primary mono-header">
              <Shield className="h-3 w-3" />
              Admin Approval Required
            </p>
            <p className="mt-1 text-muted-foreground">
              Your legion will be created in a <strong>pending</strong> state. The admin
              (<span className="font-mono text-primary">zadxoy@gmail.com</span>) must approve it
              before you can recruit members or post to the Legion Recruitment channel.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} className="rounded-sm">
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!canSubmit} className="rounded-sm mono-header">
            <Crown className="mr-2 h-4 w-4" />
            Found Legion
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
