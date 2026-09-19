'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { AlertCircle, Camera, Check, Crop, Info } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { ImageCropper } from '@/components/settings/image-cropper'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { useLaravelContext } from '@/hooks/use-agentic'
import { useUnsavedGuard } from '@/hooks/use-unsaved-guard'
import type { useAccount } from '@/hooks/use-account'
import { accountService, type AccountProfile } from '@/services/account'
import { apiClient } from '@/services/core'
import { useAppPreferences } from '@/components/providers/preferences-provider'
import { Field, SaveButton, SectionBlock, SectionHint } from './section-primitives'

/**
 * THE FIRST SELF-SERVICE WRITE IN THIS PRODUCT.
 *
 * `/profile` shows seven tabs and can change nothing - its own comment says so.
 * The only self-service write that existed anywhere was
 * `POST /api/update-fcm-token`, a device push token set on 0 of 2,373 users.
 *
 * ── WHAT IS DELIBERATELY READ-ONLY, AND SAYS SO ─────────────────────────────
 *
 * Email, employee number, department, job role and salary are shown but not
 * editable, each with the reason beside it. A greyed field with no explanation
 * reads as a bug; a greyed field that says "HR changes this" reads as a rule.
 *
 * Email is the sharpest case: it is the login identifier and the only unique key
 * on `tbluser`, so letting somebody retype it here is how an account quietly
 * walks away from the person meant to hold it.
 */
type DirtyReporter = {
  /** Lets the shell refuse to change section while a draft is unsaved. */
  onDirtyChange?: (id: 'profile' | 'delivery' | 'organization' | 'policy', label: string, dirty: boolean) => void
}

export function ProfileSection({
  account,
  onDirtyChange,
}: { account: ReturnType<typeof useAccount> } & DirtyReporter) {
  const resolveContext = useLaravelContext()
  // So a new photo reaches the header immediately, not on the next page load.
  const { refresh: refreshAccount } = useAppPreferences()
  const fileInput = useRef<HTMLInputElement | null>(null)

  const [form, setForm] = useState<Partial<AccountProfile>>({})
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  /*
   * The chosen file and its preview URL are ONE piece of state.
   *
   * They were two, synchronised by an effect that called createObjectURL. Held
   * together they are created in the event that chooses the file - where the
   * work belongs - and the effect below only has to revoke, which is a pure
   * cleanup with no setState in it.
   */
  const [photo, setPhoto] = useState<{
    file: File
    preview: string
    /** The file as picked, kept so "Adjust" can reframe from full resolution. */
    original: File
  } | null>(null)

  // Why the last picked file was refused. Beside the photo state, not in the
  // section-wide `error`, which is for what the server said.
  const [photoError, setPhotoError] = useState<string | null>(null)

  /*
   * THE PICKED FILE IS NOT THE SAVED FILE ANY MORE.
   *
   * Choosing a file used to stage it for upload directly, and the avatar is round
   * with `object-cover` — so a 4:3 phone photo lost its left and right thirds,
   * always those thirds, whatever was in them. Somebody whose face sits off to one
   * side got a picture of their shoulder and had no way to say otherwise.
   *
   * A pick now opens the cropper, and only what comes back out of it is staged.
   * `pending` is that in-between state: chosen, not yet framed, definitely not yet
   * uploaded.
   */
  const [pending, setPending] = useState<File | null>(null)

  useEffect(() => {
    if (!photo) return

    // Without this, every photo somebody previews leaks for the life of the tab.
    return () => URL.revokeObjectURL(photo.preview)
  }, [photo])

  const profile = account.profile

  /*
   * SYNC FROM THE SERVER'S COPY, DURING RENDER.
   *
   * Not in an effect. React's own guidance for "adjust state when a prop
   * changes" is to compare against the last value seen and set during render:
   * the component re-renders immediately with the right value and the browser
   * never paints the stale one. An effect would paint an empty form first, and
   * `react-hooks/set-state-in-effect` flags it for exactly that reason.
   */
  const [syncedFrom, setSyncedFrom] = useState<AccountProfile | null>(null)

  if (profile && profile !== syncedFrom) {
    setSyncedFrom(profile)
    setForm(profile)
  }

  const dirty = useMemo(() => {
    if (photo) return true
    if (!profile) return false

    return EDITABLE.some((field) => (form[field] ?? '') !== (profile[field] ?? ''))
  }, [form, profile, photo])

  /*
   * VALIDATION THAT MATCHES THE SERVER, CHECKED BEFORE THE ROUND TRIP.
   *
   * `AccountController` requires `first_name` (max 100) — so a blank one was a
   * 422 shown as a red banner at the top of a long form, with nothing indicating
   * WHICH field it meant. Caught here it lands on the field itself.
   */
  const problems = useMemo(() => {
    const found: Record<string, string> = {}

    if (!(form.first_name ?? '').trim()) found.first_name = 'A first name is needed.'
    else if ((form.first_name ?? '').length > 100) found.first_name = 'That is too long — 100 characters at most.'

    return found
  }, [form.first_name])

  const [attempted, setAttempted] = useState(false)
  const shown = attempted ? problems : {}
  const valid = Object.keys(problems).length === 0

  // A draft in useState is lost on refresh; warn before that happens.
  useUnsavedGuard(dirty)

  // And tell the shell, which can refuse to change section while this is true.
  useEffect(() => {
    onDirtyChange?.('profile', 'Profile', dirty)

    // And on unmount: a section swapped out for the loading skeleton while
    // dirty would otherwise leave the flag set, prompting about a draft that
    // is no longer on screen.
    return () => onDirtyChange?.('profile', 'Profile', false)
  }, [dirty, onDirtyChange])

  const initials = useMemo(() => {
    const letters = `${form.first_name ?? ''} ${form.last_name ?? ''}`
      .split(' ')
      .filter(Boolean)
      .map((part) => part[0])
      .join('')

    return (letters || form.email?.[0] || '?').slice(0, 2).toUpperCase()
  }, [form.first_name, form.last_name, form.email])

  function set(field: keyof AccountProfile, value: string) {
    setSaved(false)
    setForm((current) => ({ ...current, [field]: value }))
  }

  async function save() {
    setAttempted(true)

    if (!valid) return

    setSaving(true)
    setError(null)
    setSaved(false)

    try {
      const context = resolveContext()

      if (photo) {
        /*
         * A picture cannot go in a JSON body, so this one call is multipart.
         * `putForm` adds `_method=PUT`, which Laravel's method spoofing turns
         * back into the PUT route - the same route the JSON path uses, so there
         * is no second endpoint to keep in step.
         */
        const body = new FormData()
        body.append('type', 'api')
        body.append('token', context.token)
        body.append('image', photo.file)

        for (const field of EDITABLE) {
          const value = form[field]
          if (value !== null && value !== undefined) body.append(field, String(value))
        }

        const response = await apiClient.putForm<{
          data: { profile: AccountProfile }
          image_error?: string
        }>('/account/profile', body)

        if (response.image_error) setError(response.image_error)
      } else {
        const changes: Partial<AccountProfile> = {}

        for (const field of EDITABLE) {
          if ((form[field] ?? '') !== (profile?.[field] ?? '')) {
            changes[field] = (form[field] ?? '') as never
          }
        }

        await accountService.updateProfile(context, changes)
      }

      setPhoto(null)
      setSaved(true)

      /*
       * ONE REFETCH, NOT TWO.
       *
       * This was `await account.reload()` followed by `await refreshAccount()` —
       * the screen's own copy, then the app-wide one, back when those were two
       * separate fetches of `/account/me`. They are the same function now that
       * `useAccount` reads from the provider, so calling both sent two identical
       * requests on every photo save and made the header flicker twice.
       *
       * The provider's copy is the only copy, and it is what the header avatar
       * reads — which is the whole point of refreshing here at all.
       */
      await refreshAccount()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not save your profile.')
    } finally {
      setSaving(false)
    }
  }

  if (!profile) {
    return <SectionHint>Your account could not be loaded.</SectionHint>
  }

  return (
    <div className="space-y-6">
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="size-4" aria-hidden="true" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {saved && !error && (
        <Alert variant="success">
          <Check className="size-4" aria-hidden="true" />
          <AlertDescription>Saved. Your details are updated everywhere they appear.</AlertDescription>
        </Alert>
      )}

      <SectionBlock title="Photo" description="Shown beside your name across the product.">
        <div className="flex flex-wrap items-center gap-5">
          {/*
            THE HOUSE `Avatar`, AND NOT ONLY FOR CONSISTENCY.
            ─────────────────────────────────────────────────────────────────
            The hand-rolled version branched on whether an image URL EXISTED —
            `photo || profile.image_url ? <img> : <initials>` — which is not the
            same question as whether the image LOADS. An avatar key is
            `<id>_<random>.<ext>` and every upload writes a new one, so a URL
            held in a stale `/account/me` response, or an object removed from
            storage, gave a bare `<img>` with `alt=""`: a broken-image glyph, or
            in most browsers an empty 80px box, with no initials and nothing to
            say what had happened.

            `AvatarImage` falls back on the load ERROR, so a URL that no longer
            resolves shows the initials — which is what the person expects to
            see when they have no photo, and is indistinguishable from never
            having had one. The primitive also carries the ring as an `::after`
            pseudo-element, so the explicit border is gone with it.
          */}
          <Avatar className="size-20">
            <AvatarImage
              src={photo?.preview ?? profile.image_url ?? undefined}
              alt=""
            />
            <AvatarFallback className="bg-primary/10 text-xl font-semibold text-primary">
              {initials}
            </AvatarFallback>
          </Avatar>

          <div className="space-y-2">
            <input
              ref={fileInput}
              type="file"
              /*
               * THE SERVER'S OWN LIST, NOT `image/*`.
               *
               * `image/*` offers every format the operating system can produce,
               * and the server accepts five. The gap is not theoretical: an
               * iPhone photographs in HEIC by default, so the most likely file
               * anybody picks on a phone was one the server would reject — after
               * it had been uploaded in full.
               *
               * Spelling the extensions out means the picker greys those files
               * out instead. `accept` is a hint a determined person can bypass,
               * which is why the check below repeats it rather than trusting it.
               */
              accept="image/jpeg,image/png,image/gif,image/webp,.jpg,.jpeg,.png,.gif,.webp"
              className="sr-only"
              onChange={(event) => {
                const file = event.target.files?.[0] ?? null
                // So choosing the same file twice in a row still fires onChange.
                event.target.value = ''
                setSaved(false)

                if (!file) {
                  setPhoto(null)
                  return
                }

                /*
                 * ═══════════════════════════════════════════════════════════
                 * THE CROPPER CHANGED WHAT THIS CHECK SHOULD BE
                 * ═══════════════════════════════════════════════════════════
                 *
                 * This used to refuse anything over 2MB, because 2MB is the
                 * server's `max:2048` and the picked file was the file that got
                 * uploaded. That is no longer true: what gets uploaded is the
                 * cropper's 512x512 export, which is about 80KB whatever came in.
                 *
                 * So the old limit had become a rule that refused the very files
                 * it was meant to help with — a phone photo is routinely 4 to 8MB,
                 * and every one of them would have been turned away by a check
                 * whose reason for existing the cropper had already removed.
                 *
                 * A ceiling is still worth having, an order of magnitude higher:
                 * decoding an image costs roughly width x height x 4 bytes of
                 * memory regardless of how well the file compresses, so a
                 * genuinely enormous file can still take the tab down. 25MB
                 * clears any camera and refuses the 200MB scan.
                 */
                const MAX_PICK = 25 * 1024 * 1024
                const ALLOWED = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']

                if (!ALLOWED.includes(file.type)) {
                  setPhotoError(
                    'That kind of image cannot be used. JPG, PNG, GIF or WEBP — a photo from an iPhone may need converting.',
                  )
                  setPhoto(null)
                  return
                }

                if (file.size > MAX_PICK) {
                  setPhotoError(
                    `That image is ${(file.size / 1024 / 1024).toFixed(0)}MB, which is too large to open here. Anything up to 25MB is fine — it gets resized when you position it.`,
                  )
                  setPhoto(null)
                  return
                }

                setPhotoError(null)

                // Off to the cropper. Nothing is staged until it comes back.
                setPending(file)
              }}
            />
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => fileInput.current?.click()}>
                <Camera className="size-4" aria-hidden="true" />
                {profile.image_url ? 'Change photo' : 'Upload photo'}
              </Button>

              {/*
                REFRAMING WITHOUT RE-PICKING.

                Without this, changing your mind about the framing meant finding
                the file again — and on a phone, going back through the camera roll
                to the same photo is the moment people give up. The original file
                is still in `photo.file`, so it costs nothing to reopen it.

                It reopens the ORIGINAL, not the cropped result: cropping a crop
                loses resolution each time and cannot get framing back that has
                already been discarded.
              */}
              {photo && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setPending(photo.original)}
                >
                  <Crop className="size-4" aria-hidden="true" />
                  Adjust
                </Button>
              )}

              {photo && (
                <Button type="button" variant="ghost" size="sm" onClick={() => setPhoto(null)}>
                  Cancel
                </Button>
              )}
            </div>
            {/*
              ONE LINE, THREE STATES: refused, chosen but unsaved, or the rules.
              The refusal takes the same slot so it cannot be missed — it was
              going to be a banner at the top of the form, a full screen away
              from the button that caused it.
            */}
            {photoError ? (
              <p role="alert" className="text-xs text-destructive">
                {photoError}
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">
                {photo
                  ? `${photo.file.name} — positioned, not saved yet`
                  : 'JPG, PNG, GIF or WEBP. You choose which part is used.'}
              </p>
            )}
          </div>
        </div>
      </SectionBlock>

      <SectionBlock title="Your name" description="How you appear to colleagues.">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="First name" required error={shown.first_name}>
            <Input value={form.first_name ?? ''} onChange={(e) => set('first_name', e.target.value)} />
          </Field>
          <Field label="Middle name">
            <Input value={form.middle_name ?? ''} onChange={(e) => set('middle_name', e.target.value)} />
          </Field>
          <Field label="Last name">
            <Input value={form.last_name ?? ''} onChange={(e) => set('last_name', e.target.value)} />
          </Field>
          <Field label="Suffix" hint="Jr., III, and so on">
            <Input value={form.name_suffix ?? ''} onChange={(e) => set('name_suffix', e.target.value)} />
          </Field>
        </div>
      </SectionBlock>

      <SectionBlock title="Contact" description="Where the organisation reaches you.">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Mobile">
            <Input
              value={form.mobile ?? ''}
              inputMode="tel"
              onChange={(e) => set('mobile', e.target.value)}
            />
          </Field>

          <Field label="Email address" hint="Only HR can change this — it is how you sign in.">
            <Input value={profile.email ?? ''} readOnly disabled />
          </Field>

          <Field label="Gender">
            <Select
              value={form.gender ?? ''}
              onChange={(value) => set('gender', String(value))}
              placeholder="Prefer not to say"
              options={[
                /*
                 * "Prefer not to say" is an OPTION, not only the placeholder.
                 *
                 * As a placeholder alone it was display-only - the house Select
                 * builds its list from `options`, so once somebody picked a
                 * gender they could never clear it again, even though the
                 * backend rule is `nullable`. The empty string is turned into
                 * null by Laravel's ConvertEmptyStringsToNull before validation
                 * sees it.
                 */
                { value: '', label: 'Prefer not to say' },
                { value: 'M', label: 'Male' },
                { value: 'F', label: 'Female' },
                { value: 'O', label: 'Other' },
              ]}
            />
          </Field>

          <Field label="Date of birth">
            <Input
              type="date"
              value={(form.birthdate ?? '').slice(0, 10)}
              onChange={(e) => set('birthdate', e.target.value)}
            />
          </Field>
        </div>
      </SectionBlock>

      <SectionBlock title="Address" description="Used on documents and for statutory records.">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Address" className="sm:col-span-2">
            <Input value={form.address ?? ''} onChange={(e) => set('address', e.target.value)} />
          </Field>
          <Field label="Address line 2" className="sm:col-span-2">
            <Input value={form.address_2 ?? ''} onChange={(e) => set('address_2', e.target.value)} />
          </Field>
          <Field label="City">
            <Input value={form.city ?? ''} onChange={(e) => set('city', e.target.value)} />
          </Field>
          <Field label="State">
            <Input value={form.state ?? ''} onChange={(e) => set('state', e.target.value)} />
          </Field>
          <Field label="PIN code">
            <Input value={form.pincode ?? ''} onChange={(e) => set('pincode', e.target.value)} />
          </Field>
        </div>
      </SectionBlock>

      <SectionBlock title="Your record at work" description="Set by HR. Shown here so you can check it.">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Employee number">
            <Input value={profile.employee_no ?? 'Not assigned'} readOnly disabled />
          </Field>
          <Field label="Last signed in">
            <Input
              value={profile.last_login ? new Date(profile.last_login).toLocaleString() : 'Never'}
              readOnly
              disabled
            />
          </Field>
        </div>

        <p className="mt-3 flex items-start gap-2 text-xs text-muted-foreground">
          <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
          Your department, job role, reporting manager and pay are part of your employment
          record. Ask HR to change any of them — they are not editable here on purpose.
        </p>
      </SectionBlock>

      {/*
        THE CROPPER, mounted only while a file is waiting to be framed.

        `key={...}` so picking a second file resets zoom, pan and rotation rather
        than opening the new photo at the previous photo's framing — which would
        look like the control had ignored the new file.
      */}
      {pending && (
        <ImageCropper
          key={`${pending.name}-${pending.size}-${pending.lastModified}`}
          file={pending}
          shape="circle"
          title="Position your photo"
          onCancel={() => setPending(null)}
          onApply={({ file: cropped, preview }) => {
            setSaved(false)
            setPhotoError(null)
            setPhoto({ file: cropped, preview, original: pending })
            setPending(null)
          }}
        />
      )}

      <div className="flex flex-wrap items-center justify-end gap-3 border-t border-border pt-5">
        {attempted && !valid && (
          <span className="text-xs text-destructive">Check the fields marked above.</span>
        )}
        <SaveButton dirty={dirty} saving={saving} saved={saved} onClick={save} />
      </div>
    </div>
  )
}

/** Exactly the fields `AccountController::EDITABLE` accepts. */
const EDITABLE = [
  'first_name',
  'middle_name',
  'last_name',
  'name_suffix',
  'mobile',
  'gender',
  'birthdate',
  'address',
  'address_2',
  'city',
  'state',
  'pincode',
] as const satisfies readonly (keyof AccountProfile)[]
