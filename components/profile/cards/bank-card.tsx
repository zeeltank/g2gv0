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

interface BankCardProps {
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

export function BankCard({ profile }: BankCardProps) {
  return (
    <Card>
      <div className="flex items-start justify-between p-6 pb-0">
        <CardHeader className="p-0">
          <CardTitle>Deposit (Bank Details)</CardTitle>
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
