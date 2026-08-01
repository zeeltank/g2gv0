'use client'

import React, { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import type { SessionPayload, SessionType, TrainingSession } from '@/services/lms'

interface FormState {
  room_name: string
  session_type: SessionType
  trainer_name: string
  trainer_email: string
  venue: string
  url: string
  seats_total: string
  event_date: string
  from_time: string
  to_time: string
  description: string
  notes: string
}

const EMPTY: FormState = {
  room_name: '',
  session_type: 'virtual',
  trainer_name: '',
  trainer_email: '',
  venue: '',
  url: '',
  seats_total: '',
  event_date: '',
  from_time: '09:00',
  to_time: '10:00',
  description: '',
  notes: '',
}

/** The API stores H:i:s; the time input needs H:i. */
function toTimeInput(value: string | null) {
  return value ? value.slice(0, 5) : ''
}

function toFormState(session: TrainingSession | null): FormState {
  if (!session) return EMPTY

  return {
    room_name: session.room_name ?? '',
    session_type: session.session_type ?? 'virtual',
    trainer_name: session.trainer_name ?? '',
    trainer_email: session.trainer_email ?? '',
    venue: session.venue ?? '',
    url: session.url ?? '',
    seats_total: session.seats_total != null ? String(session.seats_total) : '',
    event_date: session.event_date ?? '',
    from_time: toTimeInput(session.from_time) || '09:00',
    to_time: toTimeInput(session.to_time) || '10:00',
    description: session.description ?? '',
    notes: session.notes ?? '',
  }
}

/**
 * Schedule / edit a training session.
 *
 * Validation mirrors LmsSessionController: name, date and both times are
 * required and the end must be after the start. Seats may be left blank for an
 * uncapped session, which is why the field is a string here rather than 0.
 */
export function SessionFormSheet({
  open,
  onOpenChange,
  session,
  saving,
  onSubmit,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  session: TrainingSession | null
  saving: boolean
  onSubmit: (payload: SessionPayload, id?: number) => Promise<{ ok: boolean; message: string }>
}) {
  const [form, setForm] = useState<FormState>(EMPTY)
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({})

  useEffect(() => {
    if (!open) return
    queueMicrotask(() => {
      setForm(toFormState(session))
      setErrors({})
    })
  }, [open, session])

  const setField = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((current) => ({ ...current, [key]: value }))
    setErrors((current) => ({ ...current, [key]: undefined }))
  }

  const validate = () => {
    const next: Partial<Record<keyof FormState, string>> = {}

    if (!form.room_name.trim()) next.room_name = 'Session name is required.'
    if (!form.event_date) next.event_date = 'Date is required.'
    if (!form.from_time) next.from_time = 'Start time is required.'
    if (!form.to_time) next.to_time = 'End time is required.'
    else if (form.from_time && form.to_time <= form.from_time) {
      next.to_time = 'End time must be after the start time.'
    }
    if (form.trainer_email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.trainer_email)) {
      next.trainer_email = 'Enter a valid email address.'
    }
    if (form.seats_total && Number(form.seats_total) < 1) {
      next.seats_total = 'Seats must be at least 1.'
    }

    setErrors(next)
    return Object.keys(next).length === 0
  }

  const handleSubmit = async () => {
    if (!validate()) return

    const result = await onSubmit(
      {
        room_name: form.room_name.trim(),
        session_type: form.session_type,
        trainer_name: form.trainer_name.trim() || null,
        trainer_email: form.trainer_email.trim() || null,
        venue: form.venue.trim() || null,
        url: form.url.trim() || null,
        seats_total: form.seats_total ? Number(form.seats_total) : null,
        event_date: form.event_date,
        from_time: form.from_time,
        to_time: form.to_time,
        description: form.description.trim() || null,
        notes: form.notes.trim() || null,
      },
      session?.id,
    )

    if (result.ok) onOpenChange(false)
  }

  const isVirtual = form.session_type === 'virtual'

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex flex-col overflow-hidden p-0 sm:max-w-lg">
        <SheetHeader className="border-b border-border/60 p-6 pb-4">
          <SheetTitle>{session ? 'Edit session' : 'Schedule a session'}</SheetTitle>
          <SheetDescription>
            {session
              ? 'Changes apply to everyone already registered.'
              : 'Instructor-led training that learners can register for.'}
          </SheetDescription>
        </SheetHeader>

        <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-6">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="session-name">
              Session name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="session-name"
              value={form.room_name}
              onChange={(event) => setField('room_name', event.target.value)}
              placeholder="e.g. Effective Communication"
            />
            {errors.room_name && (
              <p className="text-xs font-medium text-destructive">{errors.room_name}</p>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="session-type">Format</Label>
              <Select
                id="session-type"
                value={form.session_type}
                onChange={(value) => setField('session_type', value as SessionType)}
                options={[
                  { label: 'Virtual', value: 'virtual' },
                  { label: 'Classroom', value: 'classroom' },
                ]}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="session-seats">Seats</Label>
              <Input
                id="session-seats"
                type="number"
                min={1}
                value={form.seats_total}
                onChange={(event) => setField('seats_total', event.target.value)}
                placeholder="Unlimited"
              />
              {errors.seats_total && (
                <p className="text-xs font-medium text-destructive">{errors.seats_total}</p>
              )}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="session-date">
                Date <span className="text-destructive">*</span>
              </Label>
              <Input
                id="session-date"
                type="date"
                value={form.event_date}
                onChange={(event) => setField('event_date', event.target.value)}
              />
              {errors.event_date && (
                <p className="text-xs font-medium text-destructive">{errors.event_date}</p>
              )}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="session-from">
                Start <span className="text-destructive">*</span>
              </Label>
              <Input
                id="session-from"
                type="time"
                value={form.from_time}
                onChange={(event) => setField('from_time', event.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="session-to">
                End <span className="text-destructive">*</span>
              </Label>
              <Input
                id="session-to"
                type="time"
                value={form.to_time}
                onChange={(event) => setField('to_time', event.target.value)}
              />
            </div>
          </div>
          {errors.to_time && <p className="text-xs font-medium text-destructive">{errors.to_time}</p>}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="session-trainer">Trainer</Label>
              <Input
                id="session-trainer"
                value={form.trainer_name}
                onChange={(event) => setField('trainer_name', event.target.value)}
                placeholder="Optional"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="session-trainer-email">Trainer email</Label>
              <Input
                id="session-trainer-email"
                type="email"
                value={form.trainer_email}
                onChange={(event) => setField('trainer_email', event.target.value)}
                placeholder="Optional"
              />
              {errors.trainer_email && (
                <p className="text-xs font-medium text-destructive">{errors.trainer_email}</p>
              )}
            </div>
          </div>

          {/* Virtual sessions join by link; classroom ones meet somewhere. */}
          {isVirtual ? (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="session-url">Join link</Label>
              <Input
                id="session-url"
                value={form.url}
                onChange={(event) => setField('url', event.target.value)}
                placeholder="https://..."
              />
            </div>
          ) : (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="session-venue">Venue</Label>
              <Input
                id="session-venue"
                value={form.venue}
                onChange={(event) => setField('venue', event.target.value)}
                placeholder="e.g. Training Room 2"
              />
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="session-description">Description</Label>
            <Textarea
              id="session-description"
              rows={3}
              value={form.description}
              onChange={(event) => setField('description', event.target.value)}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="session-notes">Joining notes</Label>
            <Textarea
              id="session-notes"
              rows={2}
              value={form.notes}
              onChange={(event) => setField('notes', event.target.value)}
              placeholder="Shown to registered learners"
            />
          </div>
        </div>

        <SheetFooter className="border-t border-border/60 p-6">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={() => void handleSubmit()} disabled={saving} className="gap-2">
            {saving && <Loader2 className="size-4 animate-spin" />}
            {session ? 'Save changes' : 'Schedule session'}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
