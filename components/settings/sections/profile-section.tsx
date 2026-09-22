'use client'

import { useEffect, useMemo, useState } from 'react'
import { AlertCircle, Check, Info } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { useLaravelContext } from '@/hooks/use-agentic'
import { useUnsavedGuard } from '@/hooks/use-unsaved-guard'
import type { useAccount } from '@/hooks/use-account'
import { accountService, type AccountPreferences, type AccountProfile } from '@/services/account'
import { apiClient } from '@/services/core'
import { ProfilePhotoPicker } from '@/components/settings/profile-photo-picker'
import { useAppPreferences } from '@/components/providers/preferences-provider'
import { useEmployeeProfile } from '@/hooks/use-employee-profile'
import type { Profile } from '@/types/profile'
import { BankCard } from '@/components/profile/cards/bank-card'
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
  /*
   * The bank details, for the read-only block at the foot of this section.
   *
   * A second fetch, deliberately: this is HRMS data `/account/me` does not carry,
   * and the hook re-runs when the signed-in user changes - which is what keeps this
   * block honest across a sign-out, the bug this release is about.
   *
   * Only the four fields `BankCard` actually reads are mapped. The dashboard builds
   * a full 40-line `Profile` literal; copying that here would be two mappings of one
   * response, drifting from the day it was written - which is the shape of the
   * two-profile problem this change exists to end.
   */
  const { profile: employeeRecord } = useEmployeeProfile()

  const bankProfile = employeeRecord
    ? ({
        bankDetails: {
          bankName: employeeRecord.bank_name ?? '',
          branchName: employeeRecord.branch_name ?? '',
          accountNumber: employeeRecord.account_no ?? '',
          ifscCode: employeeRecord.ifsc_code ?? '',
          // Neither is in the response. Blank renders an em dash; inventing a
          // value is what the removed fixture did.
          amount: '',
          transferType: '',
        },
      } as Profile)
    : null

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

  /*
   * Read-only employment facts. Null while loading, and null if the server's
   * lookup degraded — see `workIdentity()`, which returns nulls rather than
   * letting a missing table take `/account/me` down with it.
   *
   * Optional chaining because this sits above the `if (!profile)` guard, which
   * has to stay below the hooks. Reading it here keeps the value next to the
   * other derived state rather than buried in the JSX.
   */
  const work = profile?.work ?? null

  const initials = useMemo(() => {
    const letters = `${form.first_name ?? ''} ${form.last_name ?? ''}`
      .split(' ')
      .filter(Boolean)
      .map((part) => part[0])
      .join('')

    return (letters || form.email?.[0] || '?').slice(0, 2).toUpperCase()
  }, [form.first_name, form.last_name, form.email])

  /** The preference values behind the identity and visibility controls. */
  const preferences = account.preferences

  /*
   * AND THE SAME FOR THE THREE IDENTITY FIELDS, WHICH WERE UNCONTROLLED.
   *
   * These were `defaultValue={preferences?.display_name}` and friends. An
   * uncontrolled input reads its default ONCE, at mount — so when the signed-in
   * user changed and `preferences` was replaced, these three kept showing the
   * previous person's display name, pronouns and about text until something
   * happened to remount them.
   *
   * That was the second half of the profile-bleed bug on live, independent of the
   * provider: even after the provider was fixed to refetch per user, these would
   * still have shown the wrong name.
   *
   * They save on BLUR rather than on change (a single value with nothing to leave
   * half-finished, unlike the name-and-address record above), so they need local
   * state to be controlled at all — hence the same render-phase sync as the form.
   */
  const [identity, setIdentity] = useState({ display_name: '', pronouns: '', about: '' })
  const [identityFrom, setIdentityFrom] = useState<AccountPreferences | null>(null)

  if (preferences && preferences !== identityFrom) {
    setIdentityFrom(preferences)
    setIdentity({
      display_name: preferences.display_name ?? '',
      pronouns: preferences.pronouns ?? '',
      about: preferences.about ?? '',
    })
  }

  /*
   * Save one identity or visibility preference immediately.
   *
   * ── WHY THESE DO NOT JOIN THE FORM'S DRAFT ────────────────────────────────
   *
   * The name and address fields are one record: they should save together or not
   * at all, which is why they have a Save button and an unsaved-changes guard.
   * "My pronouns" is a single independent value with nothing to be half-finished
   * with, so it persists on blur like every other preference in the product.
   *
   * Guarded on no-change because `onBlur` fires on every tab-through: without it,
   * moving focus across three untouched fields would send three pointless writes.
   */
  function saveIdentity(
    key: 'display_name' | 'pronouns' | 'about' | 'visible_mobile' | 'visible_birthdate' | 'visible_address',
    value: string,
  ) {
    if ((preferences?.[key] ?? '') === value) return

    void account.saveNow(key, value as never)
  }

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

        /*
         * ONLY THE FIELDS THAT CHANGED — same rule as the JSON path below.
         *
         * This used to append EVERY editable field unconditionally, and that was a
         * cross-user write waiting to happen. The form is seeded from the cached
         * account payload; while that cache could belong to a previously
         * signed-in user (the bug this release fixes), uploading a photo would
         * have written THAT person's mobile, gender, birthdate and full home
         * address onto this person's row. A photo upload silently carrying
         * somebody else's address is far worse than showing it.
         *
         * The provider fix stops the form being seeded wrongly in the first place.
         * This makes the write safe even if it ever is again: a field the person
         * did not touch is not sent, so there is nothing to overwrite with.
         */
        for (const field of EDITABLE) {
          if ((form[field] ?? '') === (profile?.[field] ?? '')) continue

          body.append(field, String(form[field] ?? ''))
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
        {/*
          THE CONTROL LIVES IN `profile-photo-picker.tsx` NOW.

          It was ~160 lines here: the file input, the server's `accept` list, the
          type and size refusals, the cropper hand-off, the object-URL lifecycle
          and the preview. `/profile` needed all of it, and a second copy would
          have drifted at the first change to any of them — the `accept` list in
          particular has to match the server's five formats or the upload fails
          after the work.

          What stays here is the only part that is this screen's business: WHEN it
          saves. This is a form, so a picked photo is staged and goes up with the
          text fields in one multipart PUT. `/profile` has no form and saves
          immediately. The picker does not know or care which.
        */}
        <ProfilePhotoPicker
          imageUrl={profile.image_url}
          initials={initials}
          preview={photo?.preview ?? null}
          busy={saving}
          onPicked={(picked) => {
            setSaved(false)

            if (!picked) {
              setPhoto(null)
              return
            }

            setPhoto({ file: picked.file, preview: picked.preview, original: picked.file })
          }}
        />
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

      {/*
        ═══════════════════════════════════════════════════════════════════════
        HOW YOU APPEAR TO COLLEAGUES — three fields this product had none of
        ═══════════════════════════════════════════════════════════════════════

        Every comparable product has a display name, pronouns and a line about
        yourself. Without them a person is only ever the legal name HR typed:
        somebody called Alexandra who goes by Alex has nowhere to say so, and a
        name HR spelled wrong is stuck that way until a ticket is raised.

        ── THESE AUTOSAVE; THE FIELDS BELOW DO NOT ──────────────────────────

        They are preferences, not `tbluser` columns, so they go through
        `saveNow` and persist on blur. That is deliberate and not an
        inconsistency: the name and address fields below form ONE record that
        should save or not save together, while "my pronouns" is a single
        independent value with nothing to be half-finished with.

        Stored as preferences rather than columns because `tbluser` is already 99
        columns wide and read by dozens of controllers — three more nullable
        strings there is three more things every SELECT carries.
      */}
      <SectionBlock
        title="How you appear to colleagues"
        description="Saved as you type. Your legal name above is what appears on documents."
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Display name"
            hint="What colleagues see. Leave it empty to use your real name."
          >
            <Input
              value={identity.display_name}
              onChange={(e) => setIdentity((c) => ({ ...c, display_name: e.target.value }))}
              placeholder={[profile.first_name, profile.last_name].filter(Boolean).join(' ')}
              maxLength={60}
              onBlur={(e) => saveIdentity('display_name', e.target.value)}
            />
          </Field>

          <Field label="Pronouns" hint="For example she/her, he/him, they/them.">
            <Input
              value={identity.pronouns}
              onChange={(e) => setIdentity((c) => ({ ...c, pronouns: e.target.value }))}
              placeholder="Optional"
              maxLength={30}
              onBlur={(e) => saveIdentity('pronouns', e.target.value)}
            />
          </Field>

          <Field
            label="About"
            className="sm:col-span-2"
            hint="A line or two about what you do. Up to 300 characters."
          >
            <Input
              value={identity.about}
              onChange={(e) => setIdentity((c) => ({ ...c, about: e.target.value }))}
              placeholder="Optional"
              maxLength={300}
              onBlur={(e) => saveIdentity('about', e.target.value)}
            />
          </Field>
        </div>
      </SectionBlock>

      {/*
        ═══════════════════════════════════════════════════════════════════════
        WHO CAN SEE WHAT — and this one is enforced on the server
        ═══════════════════════════════════════════════════════════════════════

        Before this, every colleague who could open the Employee Directory could
        read everybody's personal mobile number, date of birth and home address.
        That was not a setting anybody chose; it was the absence of one.

        The redaction happens in `EmployeeDirectoryController` via
        `ProfileVisibility`, not here — a control that only hides fields in React
        is privacy-shaped decoration with the data one request away.

        HR and administrators still see everything: they maintain the record, and
        their edit form has to round-trip what it loaded or saving blanks it. The
        wording says so rather than implying otherwise.
      */}
      <SectionBlock
        title="Who can see your details"
        description="Applies to colleagues browsing the Employee Directory. HR and administrators always see your full record."
      >
        <div className="grid gap-4 sm:grid-cols-3">
          {VISIBILITY_FIELDS.map(({ key, label, hint }) => (
            <Field key={key} label={label} hint={hint}>
              <Select
                value={preferences?.[key] ?? 'everyone'}
                onChange={(value) => saveIdentity(key, String(value))}
                options={VISIBILITY_CHOICES}
                aria-label={label}
              />
            </Field>
          ))}
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

      {/*
        ═══════════════════════════════════════════════════════════════════════
        THIS BLOCK USED TO PROMISE THIS INFORMATION AND NOT SHOW IT
        ═══════════════════════════════════════════════════════════════════════

        It printed an employee number and a last-signed-in date, then a sentence
        saying "your department, job role and reporting manager are part of your
        employment record" — naming three things it did not display. To see them
        you had to know `/profile` existed and went somewhere else for them.

        `/account/me` carries them now, so they are here. Read-only, and the
        server enforces that rather than the `disabled` attribute: a PUT naming
        `jobtitle_id` is discarded like an invented field.
      */}
      <SectionBlock
        title="Your record at work"
        description="Set by HR. Shown here so you can check it is right."
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Job title">
            <Input value={work?.job_title ?? 'Not set'} readOnly disabled />
          </Field>
          <Field label="Department">
            <Input value={work?.department ?? 'Not set'} readOnly disabled />
          </Field>

          {/*
            Only when set. `reporting_manager_id` is populated for nobody on live
            today, and `joined_date` for 14 of 299 — rendering "Not set" for a
            field the organisation has never filled in reads as a fault in the
            product rather than an empty record.
          */}
          {work?.reporting_manager && (
            <Field label="Reports to">
              <Input value={work.reporting_manager} readOnly disabled />
            </Field>
          )}
          {work?.joined_date && (
            <Field label="Joined">
              <Input value={new Date(work.joined_date).toLocaleDateString()} readOnly disabled />
            </Field>
          )}

          <Field label="Employee number">
            <Input value={work?.employee_no ?? profile.employee_no ?? 'Not assigned'} readOnly disabled />
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
          These come from your employment record. Ask HR to change any of them — moving your own
          department is a promotion, not a setting, so it is not editable here on purpose.
        </p>
      </SectionBlock>


      {/*
        ══════════════════════════════════════════════════════════════════════
        YOUR BANK DETAILS — MOVED HERE FROM THE SECOND PROFILE PAGE
        ══════════════════════════════════════════════════════════════════════

        This product had TWO profile URLs. `/profile` was entirely read-only and
        `/settings?s=profile` was the only place anything could be changed, so
        somebody looking for "my profile" landed on a page that could not edit it and
        had no way of knowing the other existed. `/profile` now redirects here.

        Of the five cards that page held, FOUR are already covered: personal details
        and address are the editable fields above, and the job title and department
        are in the work block. Bank details were the one thing that existed there and
        nowhere else, so they move rather than being quietly dropped in a redirect.

        ── AND THE TWO CARDS THAT ARE NOT HERE ─────────────────────────────────

        Reporting line and attendance are deliberately NOT moved. In the page that
        was deleted, both were fed hardcoded empty arrays - `reporting: []`,
        `attendance: []` - so they rendered an empty state for every person, always,
        whatever the data said. The data agrees: `reporting_manager_id` is set on
        0 of 299 live accounts. Carrying them across would have added two permanently
        blank blocks to this screen. When either gains a real source it belongs here,
        not on a second page.

        ── STILL READ-ONLY, AND FOR THE SAME REASON AS BEFORE ──────────────────

        This is the employment record, not a setting. The write path is Employee
        Directory, gated `profile:admin,hr` - somebody changing their own bank
        account is not a preference change. The card component is reused unchanged,
        so the wording about who to ask travels with it.
      */}
      {bankProfile && (
        <SectionBlock
          title="Your bank details"
          description="Held by HR for payroll. Ask HR if any of it is wrong — it cannot be changed here."
        >
          <BankCard profile={bankProfile} />
        </SectionBlock>
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

/**
 * The visibility choices, worded as a person would ask the question.
 *
 * "Everyone in my organisation" rather than "public": nothing here is ever
 * visible outside the tenant, and "public" would suggest otherwise on a screen
 * about privacy.
 */
const VISIBILITY_CHOICES = [
  { value: 'everyone', label: 'Everyone in my organisation' },
  { value: 'department', label: 'Only my department' },
  { value: 'private', label: 'Only me' },
]

const VISIBILITY_FIELDS = [
  {
    key: 'visible_mobile' as const,
    label: 'Mobile number',
    hint: 'Your personal number, as shown in the directory.',
  },
  {
    key: 'visible_birthdate' as const,
    label: 'Date of birth',
    hint: 'Hiding it does not affect leave or payroll.',
  },
  {
    key: 'visible_address' as const,
    label: 'Home address',
    hint: 'Covers the street, city, state and PIN code together.',
  },
]

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
