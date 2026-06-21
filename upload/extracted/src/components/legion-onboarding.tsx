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
  ' Banner-emulating crests', // (ignored, kept for spacing)
]
const PRESET_LOGOS_CLEAN = PRESET_LOGOS.filter((s) => s.trim().length > 0 && s.length <= 4)

export interface CreateLegionPayload {
  name: string
  tag: string
  description: string
  icon: string
  iconType: 'emoji' | 'image'
  inGameLegionId: string
}

interface Props {
  openLegions: Legion[]
  onCreate: (data: CreateLegionPayload) => void
  onJoin: (legionId: string) => void
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
    <div className="flex flex-1 flex-col items-center justify-center overflow-hidden p-4">
      <div className="w-full max-w-2xl">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-4 grid h-16 w-16 place-items-center rounded-2xl bg-amber-500/15 text-4xl">
            🛡️
          </div>
          <h2 className="text-xl font-bold tracking-tight">Join or Create a Legion</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Legions are private squads with their own chat, member roster, and task assigner. Only
            the leader can assign tasks, kick members, and post notices.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* Create card */}
          <button
            onClick={() => setCreateOpen(true)}
            className="group rounded-xl border border-amber-500/30 bg-amber-500/5 p-5 text-left transition-all hover:border-amber-500/60 hover:bg-amber-500/10"
          >
            <div className="mb-3 grid h-12 w-12 place-items-center rounded-lg bg-amber-500/20 text-2xl">
              👑
            </div>
            <h3 className="font-semibold text-amber-200">Create a Legion</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Found a new legion. Pick or upload a logo, become its leader — assign tasks, kick
              members, post notices, and disband when ready.
            </p>
            <div className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-amber-300">
              <Plus className="h-3 w-3" />
              Become a leader
            </div>
          </button>

          {/* Join card */}
          <button
            onClick={() => {
              setMode('join')
              onRefresh()
            }}
            className="group rounded-xl border border-border bg-card/60 p-5 text-left transition-all hover:border-primary/40 hover:bg-card"
          >
            <div className="mb-3 grid h-12 w-12 place-items-center rounded-lg bg-emerald-500/15 text-2xl">
              ⚔️
            </div>
            <h3 className="font-semibold">Join a Legion</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Browse existing legions and join one as a member. The leader can assign you tasks
              that you can mark in-progress or complete.
            </p>
            <div className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-emerald-300">
              <LogIn className="h-3 w-3" />
              Find a squad
            </div>
          </button>
        </div>

        {mode === 'join' && (
          <div className="mt-4 rounded-xl border border-border bg-card/60 p-4">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <Users className="h-4 w-4" />
                Open Legions ({filtered.length})
              </h3>
              <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={onRefresh}>
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
                className="h-8 pl-7 text-xs"
              />
            </div>

            <ScrollArea className="h-64 scrollbar-survival">
              <div className="space-y-2 pr-1">
                {filtered.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-10 text-center">
                    <div className="mb-2 text-3xl">🕸️</div>
                    <p className="text-xs text-muted-foreground">
                      No open legions found. Be the first — create one!
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
          <div className="rounded-lg border border-border bg-card/40 p-3">
            <div className="mb-1 text-lg">💬</div>
            Private legion chat
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
        className={`rounded-lg object-cover ring-1 ring-amber-500/30 ${className}`}
        style={{ width: size, height: size }}
        onError={(e) => {
          // Hide broken image; parent should fall back gracefully
          ;(e.currentTarget as HTMLImageElement).style.display = 'none'
        }}
      />
    )
  }
  // Emoji fallback
  const fontSize = Math.round(size * 0.55)
  return (
    <div
      className={`grid place-items-center rounded-lg bg-amber-500/15 ring-1 ring-amber-500/20 ${className}`}
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
  onJoin: (legionId: string) => void
}) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-border bg-background/40 p-3">
      <LegionLogo
        icon={legion.icon}
        iconType={legion.iconType || 'emoji'}
        size={40}
        className="shrink-0"
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="truncate text-sm font-semibold">{legion.name}</span>
          <span className="rounded bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-mono font-bold text-amber-200">
            [{legion.tag}]
          </span>
          <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">
            <Users className="mr-1 h-2.5 w-2.5" />
            {legion.memberCount}/50
          </Badge>
        </div>
        <p className="truncate text-xs text-muted-foreground">{legion.description}</p>
      </div>
      <Button size="sm" className="h-8 shrink-0" onClick={() => onJoin(legion.id)}>
        <LogIn className="mr-1 h-3.5 w-3.5" />
        Join
      </Button>
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
      // Reset file input so the same file can be re-selected
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const handleSubmit = () => {
    if (!name.trim() || tag.trim().length < 2) return
    if (iconType === 'image' && !imageIcon) return
    if (!inGameLegionId.trim()) return

    onCreate({
      name: name.trim(),
      tag: tag.trim().toUpperCase(),
      description: description.trim(),
      icon: iconType === 'image' ? imageIcon : emojiIcon,
      iconType,
      inGameLegionId: inGameLegionId.trim(),
    })

    // Reset form
    setName('')
    setTag('')
    setDescription('')
    setInGameLegionId('')
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
    (iconType === 'emoji' ? !!emojiIcon : !!imageIcon)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto scrollbar-survival">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Crown className="h-4 w-4 text-amber-400" />
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
            <Label>Legion logo</Label>
            <p className="text-xs text-muted-foreground">
              Pick a preset crest or upload your own image (PNG/JPG/WebP, max 2MB).
            </p>

            {/* Preview + upload trigger */}
            <div className="flex items-center gap-3">
              <div className="grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-xl bg-amber-500/10 ring-1 ring-amber-500/30">
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
                  className="w-full"
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
                      Upload custom logo
                    </>
                  )}
                </Button>
                {iconType === 'image' && imageIcon && !uploading && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="w-full h-7 text-xs"
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
              <p className="text-xs text-rose-400">⚠️ {uploadError}</p>
            )}

            {/* Preset grid — only show when not using an uploaded image */}
            {iconType !== 'image' && (
              <div className="rounded-lg border border-border bg-background/40 p-2">
                <p className="mb-1.5 flex items-center gap-1 px-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  <ImageIcon className="h-3 w-3" />
                  Preset crests
                </p>
                <div className="grid grid-cols-9 gap-1">
                  {PRESET_LOGOS_CLEAN.map((emoji) => (
                    <button
                      key={emoji}
                      type="button"
                      onClick={() => {
                        setEmojiIcon(emoji)
                        setIconType('emoji')
                      }}
                      className={`grid h-8 w-8 place-items-center rounded-md text-lg transition-all ${
                        emojiIcon === emoji
                          ? 'bg-amber-500/30 ring-2 ring-amber-500'
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
            <Label htmlFor="legion-name">Legion name</Label>
            <Input
              id="legion-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Wasteland Wolves"
              maxLength={30}
              autoFocus
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="legion-tag">
              Legion tag{' '}
              <span className="text-xs text-muted-foreground">(2-6 letters, unique)</span>
            </Label>
            <Input
              id="legion-tag"
              value={tag}
              onChange={(e) => setTag(e.target.value.toUpperCase().slice(0, 6))}
              placeholder="e.g. WLF"
              className="font-mono"
              maxLength={6}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="legion-ingame-id">
              In-game Legion ID{' '}
              <span className="text-xs text-amber-400">(required — from Last Island of Survival)</span>
            </Label>
            <Input
              id="legion-ingame-id"
              value={inGameLegionId}
              onChange={(e) => setInGameLegionId(e.target.value.slice(0, 50))}
              placeholder="e.g. 1234567"
              maxLength={50}
            />
            <p className="text-[11px] text-muted-foreground">
              Enter the legion ID from your in-game profile. The admin will verify this before approving your legion.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="legion-desc">
              Description <span className="text-xs text-muted-foreground">(optional)</span>
            </Label>
            <Textarea
              id="legion-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What is your legion about? Recruiting raiders? Builders? Traders?"
              rows={3}
              maxLength={200}
            />
          </div>

          <Separator />

          <div className="rounded-lg bg-amber-500/5 p-3 text-xs text-amber-200/80">
            <p className="flex items-center gap-1 font-semibold text-amber-200">
              <Flame className="h-3 w-3" />
              Leader powers
            </p>
            <ul className="mt-1 space-y-0.5 list-disc list-inside text-muted-foreground">
              <li>Assign tasks to any legion member</li>
              <li>Kick members from the legion</li>
              <li>Post and edit the legion notice</li>
              <li>Recruit players to the Guild Recruitment channel</li>
              <li>Disband the legion (deletes everything)</li>
            </ul>
          </div>

          <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs">
            <p className="flex items-center gap-1 font-semibold text-amber-200">
              <Shield className="h-3 w-3" />
              Admin approval required
            </p>
            <p className="mt-1 text-muted-foreground">
              Your legion will be created in a <strong>pending</strong> state. The admin
              (<span className="font-mono text-amber-300">zadxoy@gmail.com</span>) must approve it
              before you can recruit members or post to the Guild Recruitment channel.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!canSubmit}>
            <Crown className="mr-2 h-4 w-4" />
            Found Legion
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
