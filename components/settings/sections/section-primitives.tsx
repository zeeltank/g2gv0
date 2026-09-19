'use client'

import {
  Component,
  cloneElement,
  isValidElement,
  useId,
  type ReactElement,
  type ReactNode,
} from 'react'
import { Check, Info, Loader2 } from 'lucide-react'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Skeleton } from '@/components/ui/skeleton'
import { ErrorState } from '@/components/ui/error-state'
import { EmptyState } from '@/components/ui/empty-state'
import { Button } from '@/components/ui/button'
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { cn } from '@/lib/utils'

/**
 * The pieces every settings section is built from.
 *
 * One block vocabulary across eleven sections, so a person who has learnt to
 * read Preferences can read Notifications without learning it again. This is the
 * whole reason they live in one file rather than being re-typed per section —
 * eleven near-copies is how two sections end up looking like two products.
 */

export function SectionBlock({
  title,
  description,
  badge,
  badgeTitle,
  actions,
  children,
  className,
}: {
  title: string
  description?: string
  /** Two or three words of state, where a banner would have been. */
  badge?: string
  /** The long explanation, on hover, instead of on the page. */
  badgeTitle?: string
  actions?: React.ReactNode
  children: React.ReactNode
  className?: string
}) {
  return (
    /*
     * ═══════════════════════════════════════════════════════════════════════
     * WHITE CARD ON A TINTED PAGE — NOT THE OTHER WAY ROUND
     * ═══════════════════════════════════════════════════════════════════════
     *
     * This was `bg-background` sitting inside a `bg-card` pane, which inverted
     * the product's surface hierarchy: faint grey cards on a white container,
     * where every other screen in the product is white cards on a tinted page.
     * That one class is the main reason the settings area read as washed out
     * next to Role & Permissions or the Employee Directory.
     *
     * `bg-card` + `shadow-sm` + `rounded-xl` + `p-6` are the measurements
     * `components/ui/card.tsx` uses, so these now sit at the same elevation and
     * the same rhythm as cards everywhere else.
     */
    <section
      className={cn(
        'rounded-xl border border-border bg-card p-6 shadow-sm',
        className,
      )}
    >
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            {/*
              * `text-base font-semibold` against a `text-sm` description.
              *
              * Title and description used to both be `text-sm`, with weight as
              * the only difference — and with the toggle labels and their
              * descriptions below at `text-sm` too, four levels of hierarchy
              * rendered at one size. That is why nothing on these screens read
              * as more important than anything else.
              */}
            <h3 className="text-base font-semibold text-foreground">{title}</h3>

            {badge && (
              <span
                title={badgeTitle}
                className={cn(
                  'shrink-0 rounded-full border border-border bg-muted px-2 py-0.5',
                  'text-[11px] font-medium text-muted-foreground',
                  badgeTitle && 'cursor-help',
                )}
              >
                {badge}
              </span>
            )}
          </div>

          {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
        </div>

        {actions && <div className="shrink-0">{actions}</div>}
      </div>
      {children}
    </section>
  )
}

/**
 * The confirmation for a control that saves on change.
 *
 * ── WHY THIS IS NOT A BANNER ────────────────────────────────────────────────
 *
 * With autosave, a full-width "Saved" banner would appear on every click of
 * every switch. Confirmation belongs next to the thing that changed, small
 * enough to ignore and close enough to connect — and it must reserve its own
 * space, or the layout jumps each time it appears.
 */
export function SavedTick({ saving, className }: { saving: boolean; className?: string }) {
  return (
    <span
      className={cn('inline-flex h-4 items-center text-xs text-muted-foreground', className)}
      aria-live="polite"
    >
      {saving ? 'Saving…' : ''}
    </span>
  )
}

/**
 * A labelled control in a form grid.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * THE LABEL IS WIRED TO THE CONTROL, NOT JUST PLACED ABOVE IT
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * This rendered `<Label>` and `{children}` as SIBLINGS in a plain div, with no
 * `htmlFor` and no id. `Label` emits a bare `<label>`, so it was associated with
 * nothing: every Input and Select across the whole settings area had no
 * accessible name. A screen reader announced "edit text, blank" for the field
 * holding somebody's mobile number, and clicking the word "Mobile" did not focus
 * anything.
 *
 * A generated id is cloned onto the child, and the hint becomes its
 * `aria-describedby`, so the explanation is read out with the field rather than
 * being visible-only. `useId` is used rather than a counter because it is stable
 * across server and client render - a hand-rolled id would mismatch on hydration.
 *
 * A child that is not a single element (two controls, a fragment) is left alone
 * and wrapped in a `<fieldset>`-style group instead, so this can never throw on
 * a shape it was not designed for.
 */
export function Field({
  label,
  hint,
  required,
  error,
  className,
  children,
}: {
  label: string
  hint?: string
  required?: boolean
  /*
   * WHY VALIDATION LIVES HERE AND NOT IN EACH SECTION.
   *
   * Seven fields were marked `required` — the asterisk was drawn, `aria-required`
   * was set — and not one of them was checked before the form was sent. Blanking
   * "Send from" and pressing Save posted an empty address to the server and
   * surfaced whatever the server said about it, which for one of them was a 500.
   *
   * Passing the message here rather than rendering it per section keeps three
   * things in step that were drifting: the red text under the control, the
   * `aria-invalid` on the control itself, and the `aria-describedby` that makes a
   * screen reader read the error out instead of the hint. Security policy had
   * hand-rolled exactly this, correctly, in one place out of eight.
   */
  error?: string | null
  className?: string
  children: React.ReactNode
}) {
  const id = useId()
  const hintId = hint ? `${id}-hint` : undefined
  const errorId = error ? `${id}-error` : undefined

  const control = isValidElement(children)
    ? cloneElement(children as ReactElement<Record<string, unknown>>, {
        id: (children.props as Record<string, unknown>).id ?? id,
        // The error replaces the hint as the description: both at once means a
        // screen reader reads the advice before the problem.
        'aria-describedby':
          (children.props as Record<string, unknown>)['aria-describedby'] ?? errorId ?? hintId,
        ...(required ? { 'aria-required': true } : {}),
        ...(error ? { 'aria-invalid': true } : {}),
      })
    : children

  return (
    <div className={className}>
      <Label
        htmlFor={isValidElement(children) ? id : undefined}
        className="mb-1.5 text-sm font-medium text-foreground"
      >
        {label}
        {required && (
          <span className="ml-0.5 text-destructive" aria-hidden="true">
            *
          </span>
        )}
      </Label>
      {control}
      {error ? (
        // `role="alert"` so it is announced when it appears, not only when the
        // field is next focused.
        <p id={errorId} role="alert" className="mt-1 text-xs text-destructive">
          {error}
        </p>
      ) : (
        hint && (
          <p id={hintId} className="mt-1 text-xs text-muted-foreground">
            {hint}
          </p>
        )
      )}
    </div>
  )
}

/**
 * A switch with its own label and explanation, as one clickable row.
 *
 * The whole row is the target, not just the switch — a 20px hit area beside a
 * paragraph of text is how somebody toggles the wrong setting. Wrapping it in a
 * <label> gives that for free, and keeps the control and its name associated
 * for a screen reader without an id to keep in step.
 *
 * The switch itself is `components/ui/switch.tsx`, not a private copy. A
 * hand-rolled one here would be a SECOND switch implementation in the product,
 * and the two would drift the first time either is restyled.
 */
export function ToggleRow({
  label,
  description,
  checked,
  disabled,
  onChange,
}: {
  label: string
  description?: string
  checked: boolean
  disabled?: boolean
  onChange: (next: boolean) => void
}) {
  return (
    <label
      className={cn(
        'flex cursor-pointer items-start justify-between gap-4 rounded-lg border border-transparent px-3 py-3 transition-colors',
        disabled ? 'cursor-not-allowed opacity-60' : 'hover:bg-muted/50',
      )}
    >
      <span className="min-w-0">
        <span className="block text-sm font-medium text-foreground">{label}</span>
        {description && (
          <span className="mt-0.5 block text-sm text-muted-foreground">{description}</span>
        )}
      </span>

      <Switch
        size="sm"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
        className="mt-0.5 shrink-0"
      />
    </label>
  )
}

/** A quiet explanatory line, for a fact rather than a warning. */
export function SectionHint({ children }: { children: React.ReactNode }) {
  return (
    <p className="flex items-start gap-2 text-sm text-muted-foreground">
      <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
      <span>{children}</span>
    </p>
  )
}

/**
 * ONE LOADING SHAPE FOR EVERY SECTION.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * FIVE HAND-ROLLED HEIGHTS, NONE OF THEM THE PRIMITIVE
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Twelve places across the settings area wrote their own
 * `<div className="h-NN animate-pulse rounded-xl bg-muted/40" />`, at five
 * different heights — h-20, h-24, h-28, h-32, h-56 — while `components/ui/
 * skeleton.tsx` sat unused. So every section flickered at a different rhythm,
 * and nothing could be restyled in one place.
 *
 * `rows` is the only knob, because the thing being approximated is always the
 * same: a stack of blocks roughly the height of a card. Matching the exact
 * geometry of the real content is a nicety; matching it FIVE DIFFERENT WAYS is
 * just inconsistency.
 */
export function SectionSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="space-y-4" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading…</span>
      {Array.from({ length: rows }).map((_, index) => (
        <Skeleton key={index} className="h-28 w-full rounded-xl" />
      ))}
    </div>
  )
}

/**
 * A FAILED LOAD, WITH A WAY OUT.
 *
 * Eight sections rendered a load failure as a bare `<Alert variant="destructive">`
 * or — worse — as a 14px grey caption, and NOT ONE of them offered a retry. The
 * `load` callback was always right there, unbound to anything. So a transient
 * network blip left somebody on a dead screen whose only recovery was to guess
 * that a full page reload might help.
 *
 * `ui/error-state.tsx` has taken a `retry` prop the whole time.
 */
export function SectionError({
  title,
  description,
  onRetry,
  retryLabel,
}: {
  title: string
  description?: string
  onRetry?: () => void
  /*
   * `ErrorState`'s own retry button is hardcoded to the word "Retry", and it
   * lives in `components/ui` which this work does not modify. Where the action is
   * something other than trying the same thing again — reloading the page after a
   * deploy, say — it goes through the `action` slot instead, so the button can
   * say what it does. Same component, same position, honest label.
   */
  retryLabel?: string
}) {
  if (onRetry && retryLabel) {
    return (
      <ErrorState
        title={title}
        description={description}
        action={
          <Button size="sm" onClick={onRetry}>
            {retryLabel}
          </Button>
        }
      />
    )
  }

  return <ErrorState title={title} description={description} retry={onRetry} />
}

/**
 * Nothing here yet — as a state, not as a sentence.
 *
 * Four sections hand-rolled this with a dashed border, at three different
 * paddings (py-8, py-10, py-10) and a smaller type scale than the primitive,
 * while `ui/empty-state.tsx` went unused. One of them was a bare `<p>`.
 */
export function SectionEmpty({
  icon,
  title,
  description,
  action,
}: {
  icon?: React.ReactNode
  title: string
  description?: string
  action?: React.ReactNode
}) {
  return <EmptyState icon={icon} title={title} description={description} action={action} />
}

/**
 * ASK BEFORE SOMETHING IRREVERSIBLE.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * THREE ACTIONS FIRED ON THE FIRST CLICK, WITH NO WAY BACK
 * ═══════════════════════════════════════════════════════════════════════════
 *
 *   "Sign out everywhere else"  ends every other session. One live account holds
 *                               2,140 tokens; there is no undo and no list of
 *                               what was ended.
 *   "Clear" a saved view        deletes it from this browser. The reassurance
 *                               that it is safe sat in a paragraph BELOW the
 *                               button, which is the wrong order.
 *   "Save modules"              switches modules off for the whole organisation,
 *                               removing screens from every administrator's
 *                               navigation, under a label that says "Save".
 *
 * `components/ui/alert-dialog.tsx` existed and was used by sixteen other files.
 * The shape here matches theirs (`LeaveTypesTab`): title, a description that
 * states the CONSEQUENCE rather than asking "are you sure", Cancel, then a
 * destructive confirm.
 *
 * ── THE DESCRIPTION IS THE WHOLE POINT ──────────────────────────────────────
 *
 * "Are you sure?" adds a click and no information. What a person needs is the
 * count and the blast radius — "12 other devices will be signed out" — which is
 * why `description` is required rather than optional.
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  busy,
  onConfirm,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: React.ReactNode
  confirmLabel: string
  busy?: boolean
  onConfirm: () => void
}) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="w-[calc(100%-2rem)] max-w-lg">
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="flex-col-reverse gap-2 sm:flex-row sm:gap-0">
          <Button
            variant="outline"
            className="w-full sm:w-auto"
            onClick={() => onOpenChange(false)}
            disabled={busy}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            className="w-full sm:w-auto"
            onClick={onConfirm}
            disabled={busy}
          >
            {busy ? 'Working…' : confirmLabel}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

/**
 * ONE BROKEN SECTION INSTEAD OF A BLANK ROUTE.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * THE FAILURE THIS EXISTS FOR IS A DEPLOY, NOT A BUG
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * All twelve sections are `lazy()` imports, so opening one fetches a chunk by a
 * hashed filename. Deploy while somebody has Settings open and those filenames
 * change: their next click asks for a chunk that no longer exists, the dynamic
 * import rejects, and with no boundary the rejection climbs past `Suspense` and
 * unmounts the entire route. A white page, and nothing on screen to explain it or
 * to click.
 *
 * There is no deploy pipeline here — live is updated by a `git pull` — so this is
 * not a rare race. It is what happens every time the frontend is updated while
 * anybody is using it.
 *
 * ── A RETRY THAT ACTUALLY RETRIES ───────────────────────────────────────────
 *
 * The product's one existing boundary (private to `gtg-app-shell.tsx`) renders
 * "Something went wrong" and stops — no button, so the only way out is a manual
 * refresh. A boundary cannot re-run a failed import by itself, but clearing the
 * error re-mounts the child, which retries it. `key` on the wrapper means
 * switching section also clears a stuck error, so one broken pane never poisons
 * the eleven beside it.
 *
 * `reload` is offered alongside, because a chunk that 404s will keep 404ing until
 * the page is fetched again — which is the one case where telling somebody to
 * refresh is the correct answer rather than an apology.
 */
export class SectionBoundary extends Component<
  { children: ReactNode },
  { error: Error | null }
> {
  state: { error: Error | null } = { error: null }

  static getDerivedStateFromError(error: Error) {
    return { error }
  }

  componentDidCatch(error: Error) {
    // Deliberately kept: without it a failed chunk load leaves no trace at all,
    // and this is the class of failure nobody can reproduce on request.
    console.error('[settings] a section failed to render', error)
  }

  render() {
    if (this.state.error) {
      const stale = /chunk|dynamically imported module|Failed to fetch/i.test(
        this.state.error.message,
      )

      return (
        <SectionError
          title={stale ? 'This section needs a reload' : 'This section could not be shown'}
          description={
            stale
              ? 'The product was updated while you had this page open, so this part of it is out of date. Reloading will pick up the new version — nothing you have saved is affected.'
              : this.state.error.message ||
                'Something in this section failed. The rest of your settings are unaffected.'
          }
          onRetry={() => {
            if (stale) window.location.reload()
            else this.setState({ error: null })
          }}
          retryLabel={stale ? 'Reload the page' : undefined}
        />
      )
    }

    return this.props.children
  }
}

/**
 * THE SAVE BUTTON, AND THE WORD IT USED TO SAY WHEN NOTHING HAD BEEN SAVED.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * IT READ "Saved" ON A FORM THAT HAD NEVER BEEN SAVED
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * The label was `saving ? 'Saving…' : dirty ? label : 'Saved'` — so "not dirty"
 * was rendered as "Saved", and "not dirty" is the state every one of these forms
 * opens in. Open Profile, touch nothing, and a grey button below the fields told
 * you your profile was saved.
 *
 * That is not a cosmetic slip. It is the exact confirmation somebody looks for
 * after typing, and it was being given out unconditionally — which is how a
 * person concludes their changes are stored when they are not. It was the second
 * half of the original complaint: the theme picker applied instantly and
 * persisted nothing, and the button underneath said "Saved" the whole time.
 *
 * ── WHAT IT SAYS NOW ────────────────────────────────────────────────────────
 *
 *   saving        "Saving…" with a spinner
 *   dirty         the label — "Save profile", "Save policy"
 *   just saved    "Saved" with a tick, and ONLY after a real save this session
 *   otherwise     the label, disabled
 *
 * `saved` is a prop rather than internal state on purpose: the section owns it
 * because the section is what knows whether the server actually accepted the
 * write. A button cannot know that, and the old code proved what happens when it
 * guesses.
 *
 * It also no longer lives in `settings-shell.tsx`, which never rendered it —
 * four section files were importing it from the shell that imports them.
 */
export function SaveButton({
  dirty,
  saving,
  saved = false,
  onClick,
  label = 'Save changes',
}: {
  dirty: boolean
  saving: boolean
  /**
   * Whether a save has actually succeeded since the last edit.
   *
   * Defaults to false, so a caller that does not pass it gets the honest
   * behaviour rather than the old claim.
   */
  saved?: boolean
  onClick: () => void
  label?: string
}) {
  // Only when a save really happened AND there is nothing outstanding.
  const showSaved = saved && !dirty && !saving

  return (
    <Button
      onClick={onClick}
      disabled={!dirty || saving}
      className={cn(
        'shadow-sm transition-all duration-300 active:scale-95',
        dirty && !saving
          ? 'hover:-translate-y-0.5 hover:shadow-md'
          : 'bg-muted text-muted-foreground',
      )}
    >
      {saving && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
      {showSaved && <Check className="size-4" aria-hidden="true" />}
      {saving ? 'Saving…' : showSaved ? 'Saved' : label}
    </Button>
  )
}
