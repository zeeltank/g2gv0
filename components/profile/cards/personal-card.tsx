'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Profile } from '@/types/profile'

interface PersonalCardProps {
  profile: Profile
  isActive?: boolean
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-0.5">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="truncate text-sm font-medium text-foreground" title={value}>
        {value}
      </p>
    </div>
  )
}

/*
 * ── THE "..." MENU IS GONE, NOT DISABLED ────────────────────────────────────
 *
 * Every one of these five cards carried a MoreHorizontal trigger opening
 * `Edit` and `View History`, and NEITHER ITEM HAD AN onClick. Ten controls
 * across the profile screen that opened, looked live, and did nothing.
 *
 * They are removed rather than greyed out, following the decision already
 * recorded in profile-dashboard.tsx. The reason has since CHANGED and the note
 * is corrected here rather than left to rot: self-service editing now exists,
 * at `/settings?s=profile`, so this card's contents ARE the person's to change.
 * What has not come back is a per-card Edit menu - the header links to the one
 * place that edits them, and five menus pointing at the same screen would be
 * five things to keep in step. `View History` stays gone: there is no record
 * history feature at all.
 */
export function PersonalCard({ profile, isActive }: PersonalCardProps) {
  return (
    <Card className={isActive ? 'border-warning' : ''}>
      <div className="p-6 pb-0">
        <CardHeader className="p-0">
          <CardTitle>Personal Details</CardTitle>
        </CardHeader>
      </div>
      <CardContent>
        {/*
          FULL NAME, DEPARTMENT AND JOB ROLE ARE GONE FROM HERE.

          The header above this card now shows all three - the name as an `h1`,
          the job title and department on one line beneath it. Repeating them in a
          grid a few hundred pixels lower was not redundancy for emphasis; the two
          could disagree, because until now they came from DIFFERENT fetches. The
          header reads `/account/me` and this card reads the employee record, so a
          stale response in either made one screen contradict itself.

          What stays is what the header does not say.
        */}
        <dl className="grid grid-cols-2 gap-4">
          <Field label="Mobile Number" value={profile.mobileNumber} />
          <Field label="Email" value={profile.email} />
          <Field label="Date of Birth" value={profile.dob} />
          <Field label="Gender" value={profile.gender} />
          <Field label="Join Year" value={profile.joinYear} />
        </dl>
      </CardContent>
    </Card>
  )
}
