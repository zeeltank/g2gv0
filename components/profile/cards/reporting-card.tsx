'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { User } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Profile } from '@/types/profile'

interface ReportingCardProps {
  profile: Profile
  isActive?: boolean
}

function OrgNode({
  label,
  highlighted,
}: {
  label: string
  highlighted?: boolean
}) {
  return (
    <div className="flex flex-col items-center gap-1.5">
      <div
        className={cn(
          'flex size-10 items-center justify-center rounded-full border-2',
          highlighted
            ? 'border-primary/30 bg-primary/10 text-primary'
            : 'border-border bg-muted text-foreground'
        )}
      >
        <User className="size-4" />
      </div>

      <span className="text-xs text-muted-foreground">{label}</span>
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
export function ReportingCard({
  profile,
  isActive,
}: ReportingCardProps) {
  return (
    <Card className={cn(isActive && 'border-warning')}>
      <div className="p-6 pb-0">
        <CardHeader className="p-0">
          <CardTitle>Reporting Structure</CardTitle>
        </CardHeader>
      </div>

      <CardContent>
        {/* Table */}
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Supervisor Type</TableHead>
              <TableHead>Employee Name</TableHead>
              <TableHead>Reporting Method</TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {profile.reporting.map((r, idx) => (
              <TableRow key={idx}>
                <TableCell className="font-medium">
                  {r.supervisorType}
                </TableCell>
                <TableCell>{r.employeeName}</TableCell>
                <TableCell>{r.reportingMethod}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        {/* Organization Chart */}
        <div className="mt-10 flex flex-col items-center">
          {/* Top Node */}
          <OrgNode label="Manager" highlighted />

          {/* Vertical Line */}
          <div className="h-8 w-px bg-border" />

          {/* Horizontal Connector */}
          <div className="relative w-56 border-t border-border">
            <div className="absolute left-0 top-0 h-6 w-px bg-border" />
            <div className="absolute left-1/2 top-0 h-6 w-px -translate-x-1/2 bg-border" />
            <div className="absolute right-0 top-0 h-6 w-px bg-border" />
          </div>

          {/* Bottom Nodes */}
          <div className="mt-6 flex w-56 justify-between">
            <OrgNode label="HR" />
            <OrgNode label="Employee" />
            <OrgNode label="Admin" />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}