'use client'

import { useState } from 'react'
import {
  User,
  MapPin,
  Users,
  Clock,
  Landmark,
  Mail,
  Calendar,
  Phone,
  BookOpen,
  Target,
} from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import type { Profile } from '@/lib/mock-data/profile'
import { PersonalCard } from '@/components/profile/cards/personal-card'
import { AddressCard } from '@/components/profile/cards/address-card'
import { ReportingCard } from '@/components/profile/cards/reporting-card'
import { AttendanceCard } from '@/components/profile/cards/attendance-card'
import { BankCard } from '@/components/profile/cards/bank-card'
import { SkillsPanel } from '@/components/profile/skills-panel'
import { useEmployeeProfile } from '@/hooks/use-employee-profile'
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
            <div className="relative shrink-0">
              <Avatar className="h-20 w-20">
                <AvatarFallback className="bg-primary text-primary-foreground text-lg">
                  {initials}
                </AvatarFallback>
              </Avatar>

              {/* The camera button here had no onClick either - see the note by
                  the header actions. Removed rather than left looking live. */}
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-semibold">
                  {profile.fullName}
                </h1>
                <Badge variant="success">Active</Badge>
              </div>

              <p className="text-sm font-medium text-primary">
                {profile.jobRole}
              </p>

              <p className="text-sm font-medium text-primary">
                {profile.department}
              </p>

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
            * ── TWO BUTTONS THAT DID NOTHING ────────────────────────────
            *
            * "Change Password" and "Edit Profile" had no onClick at all, as
            * did the avatar camera and the Edit item in all five cards. A
            * control that looks live and does nothing is worse than one that
            * is absent: somebody presses it, believes they changed something,
            * and finds out later that they did not.
            *
            * Self-service editing does not exist yet - there is no endpoint
            * for an employee to change their own record; /user/add_user is a
            * read here, and the write path behind Employee Directory is
            * gated profile:admin,hr. So the honest thing is to say who can
            * change it rather than to offer a control that cannot.
            */}
          <p className="max-w-xs text-xs leading-snug text-muted-foreground lg:self-start lg:text-right">
            To correct anything here, ask an administrator or HR — they can edit
            your record from the Employee Directory.
          </p>
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