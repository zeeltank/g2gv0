'use client'

import { useState } from 'react'
import {
  Camera,
  User,
  MapPin,
  Users,
  Clock,
  Landmark,
  MoreHorizontal,
  Mail,
  Phone,
  Calendar,
  Briefcase,
  Lock,
  Pencil,
  Building2,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
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
import { cn } from '@/lib/utils'

type TabId = 'personal' | 'address' | 'reporting' | 'attendance' | 'bank'

interface ProfileProps {
  user?: {
    id: string
    name: string
    email: string
    role: string
  }
}

const mockProfile = {
  fullName: 'Alex Morgan',
  mobileNumber: '+1 234 567 8900',
  email: 'alex.morgan@company.com',
  department: 'Engineering',
  dob: '1990-05-15',
  jobRole: 'Senior Software Engineer',
  gender: 'Male',
  joinYear: '2020-01-10',
  address1: '123 Main Street',
  address2: 'Apt 4B',
  city: 'San Francisco',
  state: 'California',
  pincode: '94102',
  reporting: [
    { supervisorType: 'Direct', employeeName: 'Sarah Wilson', reportingMethod: 'Formal' },
    { supervisorType: 'Function', employeeName: 'James Chen', reportingMethod: 'Informal' },
  ],
  attendance: [
    { day: 'Monday', login: '09:00 AM', logout: '06:00 PM' },
    { day: 'Tuesday', login: '09:00 AM', logout: '06:00 PM' },
    { day: 'Wednesday', login: '09:00 AM', logout: '06:00 PM' },
    { day: 'Thursday', login: '09:00 AM', logout: '06:00 PM' },
    { day: 'Friday', login: '09:30 AM', logout: '06:30 PM' },
    { day: 'Saturday', login: '09:00 AM', logout: '01:00 PM' },
  ],
  bankDetails: {
    bankName: 'HDFC Bank',
    branchName: 'Main Branch',
    accountNumber: '1234567890',
    ifscCode: 'HDFC0001234',
    amount: '5,000.00',
    transferType: 'NEFT',
  },
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
      <Card className="flex items-center justify-between gap-6 p-6">
        <div className="flex items-center gap-6">
          <div className="relative shrink-0">
            <Avatar className="size-20">
              <AvatarFallback className="bg-primary text-primary-foreground text-lg">
                {initials}
              </AvatarFallback>
            </Avatar>
            <button
              type="button"
              className="absolute -bottom-1 -right-1 flex size-6 cursor-pointer items-center justify-center rounded-full bg-primary text-primary-foreground"
              aria-label="Update profile picture"
            >
              <Camera className="size-3" />
            </button>
          </div>
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-semibold text-foreground">
                {profile.fullName}
              </h1>
              <Badge variant="success">Active</Badge>
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <Briefcase className="size-3.5" />
                {profile.jobRole}
              </span>
              <span className="flex items-center gap-1.5">
                <Users className="size-3.5" />
                {profile.department}
              </span>
              <span className="flex items-center gap-1.5">
                <Mail className="size-3.5" />
                {profile.email}
              </span>
              <span className="flex items-center gap-1.5">
                <Phone className="size-3.5" />
                {profile.mobileNumber}
              </span>
              <span className="flex items-center gap-1.5">
                <Calendar className="size-3.5" />
                Joined {profile.joinYear}
              </span>
            </div>
          </div>
        </div>
        <div className="flex shrink-0 gap-2">
          <Button variant="outline" size="sm" className="gap-1.5">
            <Lock className="size-3.5" />
            Change Password
          </Button>
          <Button size="sm" className="gap-1.5">
            <Pencil className="size-3.5" />
            Edit Profile
          </Button>
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
                className={cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors outline-none',
                  activeTab === item.id
                    ? 'bg-warning/10 text-warning'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                )}
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
            {/* Personal Details Card */}
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

            {/* Address Details Card */}
            <Card>
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
          </div>

          {/* Row 2: Reporting + Attendance */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Reporting Structure Card */}
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

            {/* Attendance Schedule Card */}
            <Card>
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
          </div>

          {/* Row 3: Bank Details (Full Width) */}
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
        </div>
      </div>
    </div>
  )
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
