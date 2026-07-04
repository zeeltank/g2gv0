'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { MoreHorizontal, Clock } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Separator } from '@/components/ui/separator'
import { Profile } from '@/components/profile/mock-profile-data'

interface AttendanceCardProps {
  profile: Profile
  isActive?: boolean
}

export function AttendanceCard({ profile, isActive }: AttendanceCardProps) {
  return (
    <Card className={isActive ? 'border-warning' : ''}>
      <div className="flex items-start justify-between p-6 pb-0">
        <CardHeader className="p-0">
          <CardTitle>Attendance Schedule</CardTitle>
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
