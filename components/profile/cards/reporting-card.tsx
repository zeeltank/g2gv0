'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Separator } from '@/components/ui/separator'
import { MoreHorizontal } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Profile } from '@/components/profile/mock-profile-data'

interface ReportingCardProps {
  profile: Profile
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

function OrgNode({ label, highlighted }: { label: string; highlighted?: boolean }) {
  return (
    <div className="flex flex-col items-center gap-1.5">
      <div
        className={cn(
          'flex size-10 items-center justify-center rounded-full border-2 text-xs font-semibold',
          highlighted
            ? 'border-primary/30 bg-primary/10 text-primary'
            : 'border-border bg-muted text-foreground'
        )}
      >
        {label}
      </div>
      <span className="text-xs text-muted-foreground">{label}</span>
    </div>
  )
}

export function ReportingCard({ profile }: ReportingCardProps) {
  return (
    <Card>
      <div className="flex items-start justify-between p-6 pb-0">
        <CardHeader className="p-0">
          <CardTitle>Reporting Structure</CardTitle>
        </CardHeader>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="size-8">
              <MoreHorizontal className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem>Edit</DropdownMenuItem>
            <DropdownMenuItem>View History</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <CardContent>
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
                <TableCell className="font-medium">{r.supervisorType}</TableCell>
                <TableCell>{r.employeeName}</TableCell>
                <TableCell>{r.reportingMethod}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <Separator className="my-4" />
        <div className="flex flex-col items-center gap-3">
          <OrgNode label="CEO" />
          <div className="h-6 w-px bg-border" />
          <OrgNode label="Manager" />
          <div className="h-6 w-px bg-border" />
          <OrgNode label="Employee" highlighted />
        </div>
      </CardContent>
    </Card>
  )
}
