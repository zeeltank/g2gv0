'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { AlertCircle, Camera, Check, Info } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { useLaravelContext } from '@/hooks/use-agentic'
import type { useAccount } from '@/hooks/use-account'
import { accountService, type AccountProfile } from '@/services/account'
import { apiClient } from '@/services/core'
import { SaveButton } from '@/components/settings/settings-shell'
import { useAppPreferences } from '@/components/providers/preferences-provider'
import { Field, SectionBlock, SectionHint } from './section-primitives'

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
export function ProfileSection({ account }: { account: ReturnType<typeof useAccount> }) {
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
  const [photo, setPhoto] = useState<{ file: File; preview: string } | null>(null)

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
      await account.reload()
      // The app-wide copy, which is what the header's avatar reads.
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
          <div className="relative">
            {photo || profile.image_url ? (
              <img
                src={photo?.preview ?? profile.image_url ?? ''}
                alt=""
                className="size-20 rounded-full border border-border object-cover"
              />
            ) : (
              <span className="grid size-20 place-items-center rounded-full border border-border bg-primary/10 text-xl font-semibold text-primary">
                {initials}
              </span>
            )}
          </div>

          <div className="space-y-2">
            <input
              ref={fileInput}
              type="file"
              accept="image/*"
              className="sr-only"
              onChange={(event) => {
                const file = event.target.files?.[0] ?? null
                setSaved(false)
                setPhoto(file ? { file, preview: URL.createObjectURL(file) } : null)
                // So choosing the same file twice in a row still fires onChange.
                event.target.value = ''
              }}
            />
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => fileInput.current?.click()}>
                <Camera className="size-4" aria-hidden="true" />
                {profile.image_url ? 'Change photo' : 'Upload photo'}
              </Button>
              {photo && (
                <Button type="button" variant="ghost" size="sm" onClick={() => setPhoto(null)}>
                  Cancel
                </Button>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              {photo ? `${photo.file.name} — not saved yet` : 'JPG or PNG, up to 2 MB.'}
            </p>
          </div>
        </div>
      </SectionBlock>

      <SectionBlock title="Your name" description="How you appear to colleagues.">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="First name" required>
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

      <div className="flex justify-end border-t border-border pt-5">
        <SaveButton dirty={dirty} saving={saving} onClick={save} />
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
