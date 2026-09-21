'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  BookOpen,
  Calendar,
  Clock,
  KeyRound,
  Landmark,
  Mail,
  MapPin,
  Pencil,
  Phone,
  Target,
  User,
  Users,
} from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import type { Profile } from '@/types/profile'
import { PersonalCard } from '@/components/profile/cards/personal-card'
import { AddressCard } from '@/components/profile/cards/address-card'
import { ReportingCard } from '@/components/profile/cards/reporting-card'
import { AttendanceCard } from '@/components/profile/cards/attendance-card'
import { BankCard } from '@/components/profile/cards/bank-card'
import { SkillsPanel } from '@/components/profile/skills-panel'
import { useEmployeeProfile } from '@/hooks/use-employee-profile'
import { ProfilePhotoPicker } from '@/components/settings/profile-photo-picker'
import { accountService } from '@/services/account'
import { useLaravelContext } from '@/hooks/use-agentic'
import { cn } from '@/lib/utils'
import { useAppPreferences } from '@/components/providers/preferences-provider'
import { CmMyCapabilityScreen } from '@/domain/competency/cm-my-capability-screen'

type TabId = 'personal' | 'address' | 'reporting' | 'attendance' | 'bank' | 'skills' | 'capability'

interface ProfileProps {
  user?: {
    id: string
    name: string
    email: string
    role: string
  }
}

const navItems: { id: TabId; label: string; icon: any }[] = [
  { id: 'personal', label: 'Personal Details', icon: User },
  { id: 'address', label: 'Address', icon: MapPin },
  { id: 'reporting', label: 'Reporting', icon: Users },
  { id: 'attendance', label: 'Attendance', icon: Clock },
  { id: 'bank', label: 'Deposit', icon: Landmark },
  { id: 'skills', label: 'Job Role Skills', icon: BookOpen },
  // MY CAPABILITY LIVES HERE NOW, not as its own sidebar submenu. It shows the
  // signed-in person their own standing, which is what a profile is - and the
  // endpoint behind it takes no user id at all, so it can only ever answer for
  // whoever is asking.
  { id: 'capability', label: 'My Capability', icon: Target },
]

export function ProfileDashboard({ user }: ProfileProps) {
  const [activeTab, setActiveTab] = useState<TabId>('personal')
  const { profile: employeeProfile, loading, error } = useEmployeeProfile()

  /**
   * ── THE SIGNED-IN PERSON'S OWN RECORD ────────────────────────────────
   *
   * This was `{ ...mockProfile, email, fullName }` - a fixture with the real
   * name and email pasted over it. Everything else on the screen - date of
   * birth, gender, address, bank account, reporting line, attendance - was
   * one invented person, shown identically to every employee on the platform.
   * The real API was already being called on the line above and its result was
   * used for exactly one thing: the skills panel.
   *
   * The response carries all of it (/user/add_user returns the tbluser row);
   * nothing was declared, so nothing was read. Blank now stays blank - the
   * cards render an em dash - because an employee seeing a stranger's bank
   * details where their own should be is worse than seeing none.
   */
  const profile = {
    id: String(employeeProfile?.id ?? user?.id ?? ''),
    fullName:
      user?.name ||
      [employeeProfile?.first_name, employeeProfile?.last_name].filter(Boolean).join(' ') ||
      employeeProfile?.name ||
      '',
    email: user?.email || employeeProfile?.email || '',
    mobileNumber: employeeProfile?.mobile ?? '',
    department: employeeProfile?.department ?? '',
    jobRole: employeeProfile?.jobrole ?? '',
    dob: employeeProfile?.birthdate ?? '',
    gender: employeeProfile?.gender ?? '',
    joinYear: employeeProfile?.joined_date ?? '',
    address1: employeeProfile?.address ?? '',
    address2: '',
    city: employeeProfile?.city ?? '',
    state: employeeProfile?.state ?? '',
    pincode: employeeProfile?.pincode ?? '',
    bankDetails: {
      bankName: employeeProfile?.bank_name ?? '',
      branchName: employeeProfile?.branch_name ?? '',
      accountNumber: employeeProfile?.account_no ?? '',
      ifscCode: employeeProfile?.ifsc_code ?? '',
      amount: '',
      transferType: '',
    },
    /*
     * Reporting line and attendance are NOT in this response, and inventing
     * them is what the fixture did. Empty arrays, so the cards show their own
     * empty state rather than somebody else's manager and week.
     *
     * Reporting is genuinely unknown platform-wide: tbluser.reporting_manager_id
     * is set on 0 of 299 live rows.
     */
    reporting: [] as Profile['reporting'],
    attendance: [] as Profile['attendance'],
    skills: employeeProfile?.skills ?? [],
  }

  /*
   * The photo, from the ONE app-wide `/account/me` response.
   *
   * Read from the provider rather than fetched here, so this screen and the header
   * avatar cannot disagree about whose photo it is - which is the class of bug
   * that produced this report.
   */
  const {
    profile: accountProfile,
    preferences,
    refresh: refreshAccount,
  } = useAppPreferences()

  /** Employment facts, from the one account response rather than a second fetch. */
  const work = accountProfile?.work ?? null

  /*
   * What to call this person.
   *
   * Their display name if they set one, then the name on the account, and only
   * then the employee record's - in that order because the earlier sources are
   * the ones THEY control. Falling back the other way round would show the legal
   * name HR typed to somebody who has explicitly asked to be called something
   * else.
   */
  const shownName =
    (preferences?.display_name || '').trim() ||
    [accountProfile?.first_name, accountProfile?.last_name].filter(Boolean).join(' ').trim() ||
    profile.fullName
  const resolveContext = useLaravelContext()

  const [savingPhoto, setSavingPhoto] = useState(false)
  const [photoNotice, setPhotoNotice] = useState<{ ok: boolean; message: string } | null>(null)

  /**
   * Upload the framed photo now, because this screen has no Save button.
   *
   * ── THE REFRESH IS NOT OPTIONAL ─────────────────────────────────────────
   *
   * The header avatar reads the shared `/account/me` response. Without the
   * refresh the photo would be stored, this screen would still be showing the
   * cropper's local blob preview, and the header would keep the old picture until
   * the next full page load - which is exactly the "the photo is not updating on
   * other pages" report that started this work.
   *
   * ── A 200 IS NOT NECESSARILY A SUCCESS ──────────────────────────────────
   *
   * `AccountController` writes the profile row and then puts the object on the
   * store. If the store refuses it the response is still 200 with an
   * `image_error`, so treating the status alone as success would tell somebody
   * their photo was saved when only the row was.
   */
  async function savePhoto(file: File) {
    setSavingPhoto(true)
    setPhotoNotice(null)

    try {
      const response = await accountService.updatePhoto(resolveContext(), file)

      await refreshAccount()

      setPhotoNotice(
        response.image_error
          ? { ok: false, message: response.image_error }
          : { ok: true, message: 'Photo saved.' },
      )
    } catch (caught) {
      setPhotoNotice({
        ok: false,
        message: caught instanceof Error ? caught.message : 'That photo could not be saved.',
      })
    } finally {
      setSavingPhoto(false)
    }
  }

  const initials = profile.fullName
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()

  /*
   * `loading` and `error` were destructured from the hook and never used,
   * because the screen had a fixture to fall back on and so never needed to
   * know whether the real call had finished. With the fixture gone it does:
   * otherwise a slow response renders as a person with no name and no
   * details, which reads as an empty record rather than as a pending one.
   */
  if (loading) {
    return (
      <div className="flex flex-col gap-6">
        <div className="h-40 animate-pulse rounded-xl bg-muted/40" />
        <div className="h-96 animate-pulse rounded-xl bg-muted/40" />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      {error && (
        <div className="rounded-lg border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          Your profile could not be loaded: {error}
        </div>
      )}
      {/* Top Header Section */}
      <Card className="p-6">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          {/* Left Section */}
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center flex-1">
            {/*
              ═══════════════════════════════════════════════════════════════
              THIS SCREEN SHOWED NO PHOTO, THEN LINKED AWAY TO SET ONE
              ═══════════════════════════════════════════════════════════════

              First it rendered `AvatarFallback` and nothing else - no
              `AvatarImage`, no reference to `image_url` anywhere in the file. So
              somebody set their photo in Settings, came to Profile, and saw their
              initials. Reported as the profile image not being theirs.

              Then it showed the photo but sent you to Settings to change it, which
              was called out as a hack, and fairly: this is the screen somebody
              opens when they want their profile, and the photo was the one thing
              on it they could not set.

              The picker is here now. It is the SAME component Settings uses, so
              the `accept` list, the size and type refusals and the cropper cannot
              drift between the two screens.

              ── WHAT IS DIFFERENT HERE IS WHEN IT SAVES ────────────────────

              Settings stages the photo and sends it with the text fields, because
              there it is one field of a form. This screen has no form and nothing
              to press, so a staged photo would sit there unsaved with no way to
              commit it. It uploads on Apply and then refreshes the shared
              `/account/me`, which is what makes the header avatar follow at once
              rather than on the next full page load.
            */}
            <div className="relative shrink-0">
              <ProfilePhotoPicker
                imageUrl={accountProfile?.image_url}
                initials={initials}
                busy={savingPhoto}
                onPicked={(picked) => {
                  if (picked) void savePhoto(picked.file)
                }}
              />

              {photoNotice && (
                <p
                  role="status"
                  className={cn(
                    'mt-2 text-xs',
                    photoNotice.ok ? 'text-success' : 'text-destructive',
                  )}
                >
                  {photoNotice.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              {/*
                ═══════════════════════════════════════════════════════════════
                ONE SOURCE FOR THE NAME AND THE JOB, NOT TWO
                ═══════════════════════════════════════════════════════════════

                This read `profile.fullName`, `profile.jobRole` and
                `profile.department` from `useEmployeeProfile` - a SECOND fetch of
                a second set of endpoints - while Settings read the same person
                from `/account/me`. Two sources for one person, with nothing
                making them agree.

                `/account/me` carries the work identity now, so both screens read
                it. `employeeProfile` is still the source for the cards below
                (skills, attendance, bank) which genuinely live elsewhere; what it
                is no longer the source for is who this person is.

                ── AND THE DISPLAY NAME IS HONOURED HERE ────────────────────

                Somebody who set one has said what they want to be called. A
                profile page that shows their legal name instead is the one place
                that choice most obviously has to hold.
              */}
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="text-2xl font-semibold">{shownName}</h1>

                {preferences?.pronouns && (
                  <span className="text-sm text-muted-foreground">
                    ({preferences.pronouns})
                  </span>
                )}

                <Badge variant="success">Active</Badge>
              </div>

              {/*
                Job title and department on ONE line, not two stacked paragraphs
                in the same colour and weight - which read as two headings and
                gave no clue which was which.

                Rendered only when set: an organisation that has not filled these
                in should see nothing rather than an empty coloured line.
              */}
              {(work?.job_title || work?.department) && (
                <p className="text-sm font-medium text-primary">
                  {[work?.job_title, work?.department].filter(Boolean).join('  ·  ')}
                </p>
              )}

              {preferences?.about && (
                <p className="max-w-prose text-sm text-muted-foreground">{preferences.about}</p>
              )}

              <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted-foreground">

                <span className="flex items-center gap-1.5">
                  <Mail className="h-4 w-4" />
                  {profile.email}
                </span>

                <span className="flex items-center gap-1.5">
                  <Phone className="h-4 w-4" />
                  {profile.mobileNumber}
                </span>

                <span className="flex items-center gap-1.5">
                  <Calendar className="h-4 w-4" />
                  Joined: {profile.joinYear}
                </span>
              </div>
            </div>
          </div>

          {/*
            * ── THE TWO BUTTONS THAT DID NOTHING NOW GO SOMEWHERE ───────
            *
            * "Change Password" and "Edit Profile" originally had no onClick at
            * all, as did the avatar camera and the Edit item in all five cards.
            * They were removed rather than left as decoration, with a note that
            * self-service editing did not exist - which was true: there was NO
            * endpoint for an employee to change their own record.
            *
            * There is now. `/settings` carries both, and each link goes to the
            * exact section rather than to a hub the person then has to search.
            *
            * The note stays underneath, because it is still true of everything
            * these links CANNOT change - department, job role, pay, employee
            * number - which is most of what this page displays.
            */}
          <div className="flex flex-col gap-2 lg:items-end lg:self-start">
            <div className="flex flex-wrap gap-2">
              <Button asChild variant="outline" size="sm">
                <Link href="/settings?s=profile">
                  <Pencil className="h-4 w-4" aria-hidden="true" />
                  Edit my details
                </Link>
              </Button>
              <Button asChild variant="outline" size="sm">
                <Link href="/settings?s=security">
                  <KeyRound className="h-4 w-4" aria-hidden="true" />
                  Change password
                </Link>
              </Button>
            </div>

            <p className="max-w-xs text-xs leading-snug text-muted-foreground lg:text-right">
              Your name, contact details and photo are yours to change. Your department, job role,
              reporting manager and pay are part of your employment record — ask an administrator
              or HR to correct those.
            </p>
          </div>
        </div>
      </Card>


      {/* Left Navigation Panel + Main Content Area */}
      <div className="flex gap-6">
        {/* Left Navigation Panel */}
        <Card className="w-56 shrink-0 p-2">
          <nav className="flex flex-col gap-1">
            {navItems.map((item) => (
              <button
  key={item.id}
  onClick={() => setActiveTab(item.id)}
  className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors outline-none ${
    activeTab === item.id
      ? 'bg-warning/10 text-warning'
      : 'text-muted-foreground hover:bg-muted hover:text-foreground'
  }`}
>
  <item.icon className="size-4" />
  {item.label}
</button>
            ))}
          </nav>
        </Card>

        {/* Main Content Area */}
        <div className="flex-1 space-y-6">
          {activeTab === 'capability' ? (
            <CmMyCapabilityScreen />
          ) : activeTab === 'skills' ? (
            loading ? (
              <Card className="p-6">
                <div className="flex items-center justify-center py-12">
                  <p className="text-sm text-muted-foreground">Loading skills...</p>
                </div>
              </Card>
            ) : error ? (
              <Card className="p-6">
                <div className="flex items-center justify-center py-12">
                  <p className="text-sm text-destructive">{error}</p>
                </div>
              </Card>
            ) : (
              <SkillsPanel skills={employeeProfile?.skills ?? []} />
            )
          ) : (
            <>
              {/* Row 1: Personal Details + Address */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <PersonalCard profile={profile} isActive={activeTab === 'personal'} />
                <AddressCard profile={profile} isActive={activeTab === 'address'} />
              </div>

              {/* Row 2: Reporting + Attendance */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <ReportingCard profile={profile} isActive={activeTab === 'reporting'} />
                <AttendanceCard profile={profile} isActive={activeTab === 'attendance'} />
              </div>

              {/* Row 3: Bank Details (Full Width) */}
              <BankCard profile={profile} isActive={activeTab === 'bank'} />
            </>
          )}
        </div>
      </div>
    </div>
  )
}