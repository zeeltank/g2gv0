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
import {
  lmsCatalogService,
  lmsGovernanceService,
  type SessionPayload,
  type SessionType,
  type TrainingSession,
} from '@/services/lms'
import { useAuth } from '@/hooks/use-auth'
import { getLaravelContext, isLaravelContextReady } from '@/lib/laravel-context'

interface FormState {
  room_name: string
  session_type: SessionType
  /**
   * The course this session belongs to, as a string because that is what the
   * Select yields; '' means standalone.
   *
   * NOT `subject_id`, which looks like the course link and is not one — it
   * carries a foreign key to `subject`, a five-row legacy master list, and the
   * database refuses a course id outright. `course_id` is the real link, added
   * because none existed. Until then a session could not be attached to a
   * course at all, so attendance could never count toward one.
   */
  course_id: string
  /**
   * The trainer RECORD, when one is chosen; '' means the typed name below.
   *
   * `lms_virtual_classroom.trainer_id` has always existed and nothing ever
   * wrote it, so Governance kept a trainer directory - rates, vendor,
   * specialisation - that no session pointed at, while every session carried a
   * free-text name nobody could reconcile with it.
   */
  trainer_id: string
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
  course_id: '',
  trainer_id: '',
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
    course_id: session.course_id != null ? String(session.course_id) : '',
    trainer_id: session.trainer_id != null ? String(session.trainer_id) : '',
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
  const { user } = useAuth()
  const [form, setForm] = useState<FormState>(EMPTY)
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({})
  const [courses, setCourses] = useState<{ label: string; value: string }[]>([])
  const [trainers, setTrainers] = useState<{ label: string; value: string }[]>([])

  useEffect(() => {
    if (!open) return
    queueMicrotask(() => {
      setForm(toFormState(session))
      setErrors({})
    })
  }, [open, session])

  /*
   * The tenant's courses, for the Course field.
   *
   * Loaded when the sheet opens rather than with the calendar, so the list is
   * current every time somebody schedules something and the calendar does not
   * pay for it on every render.
   */
  useEffect(() => {
    if (!open) return

    const context = getLaravelContext(user)
    if (!isLaravelContextReady(context)) return

    let cancelled = false

    void lmsCatalogService
      .getCourses(context, { perPage: 200, sortBy: 'title', sortDir: 'asc' })
      .then((response) => {
        if (cancelled) return
        setCourses(
          (response.data ?? []).map((course) => ({
            label: course.display_name ?? `Course #${course.id}`,
            value: String(course.id),
          })),
        )
      })
      // A session can legitimately have no course, so a failure here degrades
      // to an empty picker rather than blocking the whole form.
      .catch(() => {
        if (!cancelled) setCourses([])
      })

    /*
     * The tenant's trainer directory.
     *
     * Only ACTIVE trainers are offered - somebody deactivated in Governance
     * should not be schedulable, which is the whole reason deactivation now
     * exists rather than deletion.
     */
    void lmsGovernanceService
      .trainers(context, undefined, undefined, 1)
      .then((response) => {
        if (cancelled) return
        setTrainers(
          (response.data ?? []).map((trainer) => ({
            label: trainer.specialisation
              ? `${trainer.name} - ${trainer.specialisation}`
              : trainer.name,
            value: String(trainer.id),
          })),
        )
      })
      .catch(() => {
        if (!cancelled) setTrainers([])
      })

    return () => {
      cancelled = true
    }
  }, [open, user])

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
        // Always sent, including as null: the controller only leaves the link
        // alone when the key is absent entirely, so sending it explicitly is
        // what makes "no course" a choice rather than an accident.
        course_id: form.course_id ? Number(form.course_id) : null,
        trainer_id: form.trainer_id ? Number(form.trainer_id) : null,
        // Kept alongside the id: a session may name a guest trainer who has no
        // record, and clearing the name on every linked save would lose that.
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

          {/*
            * The course this session belongs to.
            *
            * Not decoration: once linked, attending the session counts toward
            * that course's completion for everyone registered — which is the
            * whole point of scheduling training against a course rather than
            * beside it. Leaving it blank keeps the session standalone.
            */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="session-course">Part of course</Label>
            <Select
              id="session-course"
              value={form.course_id}
              onChange={(value) => setField('course_id', value)}
              options={[{ label: 'Standalone — not part of a course', value: '' }, ...courses]}
            />
            <p className="text-xs text-muted-foreground">
              {form.course_id
                ? 'Attendance will count toward this course for registered learners.'
                : 'This session stands on its own and affects no course progress.'}
            </p>
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
              <Label htmlFor="session-trainer-id">Trainer</Label>
              <Select
                id="session-trainer-id"
                value={form.trainer_id}
                onChange={(value) => setField('trainer_id', value)}
                options={[
                  { label: trainers.length ? 'Not from the directory' : 'No trainers on record', value: '' },
                  ...trainers,
                ]}
              />
              {/*
                * The typed name stays, for a guest who has no record. When a
                * directory trainer is chosen their name is what the calendar
                * shows, so this becomes a note rather than the source.
                */}
              <Input
                id="session-trainer"
                className="mt-1"
                value={form.trainer_name}
                onChange={(event) => setField('trainer_name', event.target.value)}
                placeholder={form.trainer_id ? 'Optional note' : 'Or type a name'}
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
