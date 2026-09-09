'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Profile } from '@/types/profile'

interface BankCardProps {
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
 * recorded in profile-dashboard.tsx. Self-service editing now exists at
 * `/settings?s=profile`, but it does NOT cover this card: these fields are part
 * of the employment record and the write path behind Employee Directory is
 * gated `profile:admin,hr`. Somebody changing them about themselves would not
 * be a settings change. The header says who to ask, once. `View History` stays
 * gone: there is no record history feature at all.
 */
export function BankCard({ profile, isActive }: BankCardProps) {
  return (
    <Card className={isActive ? 'border-warning' : ''}>
      <div className="p-6 pb-0">
        <CardHeader className="p-0">
          <CardTitle>Deposit (Bank Details)</CardTitle>
        </CardHeader>
      </div>
      <CardContent>
        <div className="grid grid-cols-2 gap-x-8 gap-y-4 lg:grid-cols-3 xl:grid-cols-6">
          <Field label="Bank Name" value={profile.bankDetails.bankName} />
          <Field label="Branch Name" value={profile.bankDetails.branchName} />
          <Field label="Account Number" value={profile.bankDetails.accountNumber} />
          <Field label="IFSC Code" value={profile.bankDetails.ifscCode} />
          <Field label="Amount" value={profile.bankDetails.amount} />
          <Field label="Transfer Type" value={profile.bankDetails.transferType} />
        </div>
      </CardContent>
    </Card>
  )
}
