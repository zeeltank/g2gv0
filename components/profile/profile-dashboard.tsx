'use client'

import { useState } from 'react'
import {
  Camera,
  User,
  MapPin,
  Users,
  Clock,
  Landmark,
  Mail,
  Calendar,
  Phone,
  Lock,
  Pencil,
} from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { mockProfile } from '@/lib/mock-data/profile'
import { PersonalCard } from '@/components/profile/cards/personal-card'
import { AddressCard } from '@/components/profile/cards/address-card'
import { ReportingCard } from '@/components/profile/cards/reporting-card'
import { AttendanceCard } from '@/components/profile/cards/attendance-card'
import { BankCard } from '@/components/profile/cards/bank-card'

type TabId = 'personal' | 'address' | 'reporting' | 'attendance' | 'bank'

interface ProfileProps {
  user?: {
    id: string
    name: string
    email: string
    role: string
  }
}

const navItems: { id: TabId; label: string; icon: any }[] = [
  { id: 'personal', label: 'Personal Details', icon: User },
  { id: 'address', label: 'Address', icon: MapPin },
  { id: 'reporting', label: 'Reporting', icon: Users },
  { id: 'attendance', label: 'Attendance', icon: Clock },
  { id: 'bank', label: 'Deposit', icon: Landmark },
]

export function ProfileDashboard({ user }: ProfileProps) {
  const [activeTab, setActiveTab] = useState<TabId>('personal')

  const profile = {
    ...mockProfile,
    email: user?.email || mockProfile.email,
    fullName: user?.name || mockProfile.fullName,
  }

  const initials = profile.fullName
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()

  return (
    <div className="flex flex-col gap-6">
      {/* Top Header Section */}
      <Card className="p-6">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          {/* Left Section */}
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center flex-1">
            <div className="relative shrink-0">
              <Avatar className="h-20 w-20">
                <AvatarFallback className="bg-primary text-primary-foreground text-lg">
                  {initials}
                </AvatarFallback>
              </Avatar>

              <button
                type="button"
                className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground shadow"
              >
                <Camera className="h-3 w-3" />
              </button>
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-semibold">
                  {profile.fullName}
                </h1>
                <Badge variant="success">Active</Badge>
              </div>

              <p className="text-sm font-medium text-primary">
                {profile.jobRole}
              </p>

              <p className="text-sm font-medium text-primary">
                {profile.department} 
              </p>

              <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted-foreground">

                <span className="flex items-center gap-1.5">
                  <Mail className="h-4 w-4" />
                  {profile.email}
                </span>

                <span className="flex items-center gap-1.5">
                  <Phone className="h-4 w-4" />
                  {profile.mobileNumber}
                </span>

                <span className="flex items-center gap-1.5">
                  <Calendar className="h-4 w-4" />
                  Joined: {profile.joinYear}
                </span>
              </div>
            </div>
          </div>

          {/* Right Section */}
          <div className="flex gap-3 lg:self-start">
            <Button variant="outline" size="sm">
              <Lock className="mr-2 h-4 w-4" />
              Change Password
            </Button>

            <Button size="sm">
              <Pencil className="mr-2 h-4 w-4" />
              Edit Profile
            </Button>
          </div>
        </div>
      </Card>


      {/* Left Navigation Panel + Main Content Area */}
      <div className="flex gap-6">
        {/* Left Navigation Panel */}
        <Card className="w-56 shrink-0 p-2">
          <nav className="flex flex-col gap-1">
            {navItems.map((item) => (
              <button
  key={item.id}
  onClick={() => setActiveTab(item.id)}
  className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors outline-none ${
    activeTab === item.id
      ? 'bg-warning/10 text-warning'
      : 'text-muted-foreground hover:bg-muted hover:text-foreground'
  }`}
>
  <item.icon className="size-4" />
  {item.label}
</button>
            ))}
          </nav>
        </Card>

        {/* Main Content Area */}
        <div className="flex-1 space-y-6">
          {/* Row 1: Personal Details + Address */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <PersonalCard profile={profile} isActive={activeTab === 'personal'} />
            <AddressCard profile={profile} isActive={activeTab === 'address'} />
          </div>

          {/* Row 2: Reporting + Attendance */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <ReportingCard profile={profile} isActive={activeTab === 'reporting'} />
            <AttendanceCard profile={profile} isActive={activeTab === 'attendance'} />
          </div>

          {/* Row 3: Bank Details (Full Width) */}
          <BankCard profile={profile} isActive={activeTab === 'bank'} />
        </div>
      </div>
    </div>
  )
}