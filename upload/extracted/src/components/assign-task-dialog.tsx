'use client'

import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { LegionMember } from '@/lib/chat-types'
import { ClipboardList, Loader2 } from 'lucide-react'

interface Props {
  open: boolean
  onOpenChange: (v: boolean) => void
  members: LegionMember[] // includes the leader
  onAssign: (data: { assigneeId: string; title: string; description: string }) => void
}

export function AssignTaskDialog({ open, onOpenChange, members, onAssign }: Props) {
  const [assigneeId, setAssigneeId] = useState('')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // Exclude leader from being assigned (they assign to others)
  const assignableMembers = members.filter((m) => m.role !== 'leader')

  const handleSubmit = () => {
    if (!assigneeId || !title.trim()) return
    setSubmitting(true)
    onAssign({
      assigneeId,
      title: title.trim(),
      description: description.trim(),
    })
    // Reset
    setAssigneeId('')
    setTitle('')
    setDescription('')
    setSubmitting(false)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ClipboardList className="h-4 w-4 text-primary" />
            Assign Legion Task
          </DialogTitle>
          <DialogDescription>
            Delegate a mission to a legion member. They will see it in their task list and can
            update its status.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="assignee">Assign to</Label>
            <Select value={assigneeId} onValueChange={setAssigneeId}>
              <SelectTrigger id="assignee" className="w-full">
                <SelectValue placeholder="Select a legion member…" />
              </SelectTrigger>
              <SelectContent>
                {assignableMembers.length === 0 ? (
                  <SelectItem value="__none" disabled>
                    No assignable members
                  </SelectItem>
                ) : (
                  assignableMembers.map((m) => (
                    <SelectItem key={m.userId} value={m.userId}>
                      <span className="mr-2">{m.avatar}</span>
                      {m.username}
                      <span className="ml-2 text-xs text-muted-foreground">Lv {m.level}</span>
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="title">Task title</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Gather 500 wood for the barricade"
              maxLength={120}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description (optional)</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Add details, location, deadline, or special instructions…"
              rows={3}
              maxLength={400}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!assigneeId || !title.trim() || submitting}
          >
            {submitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Assigning…
              </>
            ) : (
              <>
                <ClipboardList className="mr-2 h-4 w-4" />
                Assign Task
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
