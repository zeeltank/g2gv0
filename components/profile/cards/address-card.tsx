'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Building2 } from 'lucide-react'
import { Profile } from '@/types/profile'

interface AddressCardProps {
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
export function AddressCard({ profile, isActive }: AddressCardProps) {
  return (
    <Card className={isActive ? 'border-warning' : ''}>
      <div className="p-6 pb-0">
        <CardHeader className="p-0">
          <CardTitle>Address Details</CardTitle>
        </CardHeader>
      </div>
      <CardContent>
        <div className="flex gap-6">
          <dl className="grid flex-1 grid-cols-1 gap-4">
            <Field label="Address Line 1" value={profile.address1} />
            <Field label="Address Line 2" value={profile.address2} />
            <Field label="City" value={profile.city} />
            <Field label="State" value={profile.state} />
            <Field label="Pincode" value={profile.pincode} />
          </dl>
          <div className="hidden items-center justify-center lg:flex">
            <Building2 className="size-24 text-muted-foreground/40" />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
