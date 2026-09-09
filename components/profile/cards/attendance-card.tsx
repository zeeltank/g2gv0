'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Clock } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Separator } from '@/components/ui/separator'
import { Profile } from '@/types/profile'

interface AttendanceCardProps {
  profile: Profile
  isActive?: boolean
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
export function AttendanceCard({ profile, isActive }: AttendanceCardProps) {
  return (
    <Card className={isActive ? 'border-warning' : ''}>
      <div className="p-6 pb-0">
        <CardHeader className="p-0">
          <CardTitle>Attendance Schedule</CardTitle>
        </CardHeader>
      </div>
      <CardContent>
        <div className="grid grid-cols-3 gap-3">
          {profile.attendance.map((slot) => (
            <div
              key={slot.day}
              className={cn(
                'rounded-lg border border-border bg-card p-3',
                slot.day === 'Saturday' && 'bg-warning/5'
              )}
            >
              <p className="text-sm font-semibold text-foreground">
                {slot.day}
              </p>
              <Separator className="my-2" />
              <div className="space-y-0.5 text-xs">
                <p className="text-muted-foreground">
                  {slot.login} – {slot.logout}
                </p>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
