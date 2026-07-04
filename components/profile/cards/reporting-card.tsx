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
import { MoreHorizontal, User } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Profile } from '@/components/profile/mock-profile-data'

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

export function ReportingCard({
  profile,
  isActive,
}: ReportingCardProps) {
  return (
    <Card className={cn(isActive && 'border-warning')}>
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