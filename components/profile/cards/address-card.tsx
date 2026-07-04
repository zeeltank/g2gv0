'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { MoreHorizontal, Building2 } from 'lucide-react'
import { Profile } from '@/components/profile/mock-profile-data'

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

export function AddressCard({ profile, isActive }: AddressCardProps) {
  return (
    <Card className={isActive ? 'border-warning' : ''}>
      <div className="flex items-start justify-between p-6 pb-0">
        <CardHeader className="p-0">
          <CardTitle>Address Details</CardTitle>
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
