'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { MoreHorizontal } from 'lucide-react'
import { Profile } from '@/components/profile/mock-profile-data'

interface PersonalCardProps {
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

export function PersonalCard({ profile }: PersonalCardProps) {
  return (
    <Card>
      <div className="flex items-start justify-between p-6 pb-0">
        <CardHeader className="p-0">
          <CardTitle>Personal Details</CardTitle>
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
        <dl className="grid grid-cols-2 gap-4">
          <Field label="Full Name" value={profile.fullName} />
          <Field label="Mobile Number" value={profile.mobileNumber} />
          <Field label="Email" value={profile.email} />
          <Field label="Department" value={profile.department} />
          <Field label="Date of Birth" value={profile.dob} />
          <Field label="Job Role" value={profile.jobRole} />
          <Field label="Gender" value={profile.gender} />
          <Field label="Join Year" value={profile.joinYear} />
        </dl>
      </CardContent>
    </Card>
  )
}
