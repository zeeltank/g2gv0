'use client'

import React, { useState } from 'react'
import {
  ArrowLeft,
  Star,
  Building2,
  Briefcase,
  MapPin,
  Mail,
  User,
  Target,
  DollarSign,
  FileText,
  MessageSquare,
  Search,
  Settings,
  MoreHorizontal,
  ChevronRight,
  Upload,
  Download,
  Edit2,
  Phone,
  Calendar,
  Network
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { StatusBadge } from '@/components/ui/status-badge'
import { Input } from '@/components/ui/input'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'
import { mockProfileData, type TalentProfileData } from './talent-profile-data'

interface TalentProfileViewProps {
  profileId?: string
  onBack?: () => void
}

export function TalentProfileView({ profileId, onBack }: TalentProfileViewProps) {
  const [activeTab, setActiveTab] = useState('overview')
  // In a real app we would fetch the profile by ID. For now, use mock.
  const profile = mockProfileData

  const tabs = [
    { id: 'overview', label: 'Overview' },
    { id: 'timeline', label: 'Timeline' },
    { id: 'documents', label: 'Documents' },
    { id: 'goals', label: 'Goals & Performance' },
    { id: 'compensation', label: 'Compensation' },
    { id: 'mobility', label: 'Mobility' },
    { id: 'succession', label: 'Succession' },
    { id: 'activity', label: 'Activity' },
    { id: 'notes', label: 'Notes' },
  ]

  const getTimelineIcon = (icon: string) => {
    switch (icon) {
      case 'user': return <User className="size-4" />
      case 'target': return <Target className="size-4" />
      case 'star': return <Star className="size-4" />
      case 'dollar': return <DollarSign className="size-4" />
      case 'briefcase': return <Briefcase className="size-4" />
      default: return <Calendar className="size-4" />
    }
  }

  return (
    <div className="flex flex-col gap-6 animate-in fade-in duration-300">
      {/* Header Breadcrumb / Search */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span className="hover:text-foreground cursor-pointer transition-colors">Home</span>
          <ChevronRight className="size-3.5" />
          <span className="hover:text-foreground cursor-pointer transition-colors">Talent Management</span>
          <ChevronRight className="size-3.5" />
          <span className="hover:text-foreground cursor-pointer transition-colors">Talent Profile</span>
          <ChevronRight className="size-3.5" />
          <span className="font-semibold text-foreground">{profile.name}</span>
        </div>
        <div className="flex items-center gap-4">
          <div className="relative w-64 hidden sm:block">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input placeholder="Search candidates, employees, jobs..." className="pl-9 bg-background h-9" />
          </div>
          {/* Notifications/Help/Profile usually in App Header, omitted here for focus */}
        </div>
      </div>

      {/* Top Profile Card */}
      <Card className="overflow-hidden border-border/60 shadow-sm">
        <div className="flex items-center justify-between p-4 border-b border-border/40 bg-muted/20">
          <Button variant="ghost" size="sm" className="gap-2 text-muted-foreground hover:text-foreground -ml-2" onClick={onBack}>
            <ArrowLeft className="size-4" /> Back to Search
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger className="inline-flex items-center justify-center gap-2 rounded-md border border-input bg-background px-3 py-1.5 text-sm font-semibold text-foreground shadow-sm transition-colors hover:bg-muted outline-none cursor-pointer">
              Actions <ChevronRight className="size-3.5 rotate-90" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem>Edit Profile</DropdownMenuItem>
              <DropdownMenuItem>Change Status</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="text-destructive">Archive Profile</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="p-6 md:p-8 flex flex-col xl:flex-row gap-8">
          {/* Left: Identity */}
          <div className="flex items-start gap-6 xl:w-1/2">
            <div className="size-24 rounded-full bg-muted flex items-center justify-center text-3xl font-bold text-muted-foreground shrink-0 border-2 border-background shadow-sm">
              {profile.avatarInitials}
            </div>
            <div className="flex flex-col gap-2 min-w-0">
              <div className="flex items-center gap-3">
                <h1 className="text-3xl font-bold tracking-tight text-foreground">{profile.name}</h1>
                <button className="text-muted-foreground hover:text-warning transition-colors outline-none">
                  <Star className="size-5" />
                </button>
              </div>
              <div className="flex items-center gap-3">
                <StatusBadge variant="success" className="rounded-md px-2 py-0.5">{profile.status}</StatusBadge>
              </div>
              <div className="mt-1 text-base text-foreground font-medium flex items-center flex-wrap gap-2">
                <span>{profile.role}</span>
                <span className="text-muted-foreground/60">•</span>
                <span className="text-muted-foreground">{profile.department}</span>
              </div>
              <div className="flex items-center gap-3 text-sm text-muted-foreground flex-wrap">
                <span>{profile.employeeId}</span>
                <span className="text-muted-foreground/40">•</span>
                <span>Joined on {profile.joinedDate}</span>
                <span className="text-muted-foreground/40">•</span>
                <span>{profile.location}</span>
              </div>
            </div>
          </div>

          {/* Right: Key Info Grid */}
          <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6 xl:border-l xl:border-border/60 xl:pl-8">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 p-1.5 rounded-md bg-primary/10 text-primary">
                <Building2 className="size-4" />
              </div>
              <div className="flex flex-col min-w-0">
                <span className="text-xs text-muted-foreground font-medium">Business Unit</span>
                <span className="text-sm font-semibold text-foreground truncate">{profile.businessUnit}</span>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="mt-0.5 p-1.5 rounded-md bg-primary/10 text-primary">
                <Target className="size-4" />
              </div>
              <div className="flex flex-col min-w-0">
                <span className="text-xs text-muted-foreground font-medium">Grade</span>
                <span className="text-sm font-semibold text-foreground truncate">{profile.grade}</span>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="mt-0.5 p-1.5 rounded-md bg-primary/10 text-primary">
                <User className="size-4" />
              </div>
              <div className="flex flex-col min-w-0">
                <span className="text-xs text-muted-foreground font-medium">Reports To</span>
                <span className="text-sm font-semibold text-foreground truncate">{profile.reportsTo}</span>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="mt-0.5 p-1.5 rounded-md bg-primary/10 text-primary">
                <MapPin className="size-4" />
              </div>
              <div className="flex flex-col min-w-0">
                <span className="text-xs text-muted-foreground font-medium">Location</span>
                <span className="text-sm font-semibold text-foreground truncate">{profile.location}</span>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="mt-0.5 p-1.5 rounded-md bg-primary/10 text-primary">
                <Briefcase className="size-4" />
              </div>
              <div className="flex flex-col min-w-0">
                <span className="text-xs text-muted-foreground font-medium">Employee Type</span>
                <span className="text-sm font-semibold text-foreground truncate">{profile.employeeType}</span>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="mt-0.5 p-1.5 rounded-md bg-primary/10 text-primary">
                <Mail className="size-4" />
              </div>
              <div className="flex flex-col min-w-0">
                <span className="text-xs text-muted-foreground font-medium">Work Email</span>
                <span className="text-sm font-semibold text-primary truncate hover:underline cursor-pointer">{profile.workEmail}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="px-6 md:px-8 border-t border-border/40 overflow-x-auto">
          <div className="flex items-center gap-6 min-w-max">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  'py-4 text-sm font-semibold transition-all border-b-2 outline-none',
                  activeTab === tab.id
                    ? 'border-primary text-primary'
                    : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </Card>

      {/* Main Content Area */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 pb-12">
          
          {/* Left Column (2/3) */}
          <div className="xl:col-span-2 flex flex-col gap-6">
            
            {/* Top Row: About | Skills | Quick Links */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              
              {/* About */}
              <Card className="shadow-sm md:col-span-1">
                <CardHeader className="p-4 pb-2">
                  <CardTitle className="text-base">About</CardTitle>
                </CardHeader>
                <CardContent className="p-4 pt-2 flex flex-col gap-3">
                  <div className="grid grid-cols-2 gap-2">
                    <span className="text-xs text-muted-foreground font-medium">Date of Birth</span>
                    <span className="text-xs font-semibold text-foreground text-right">{profile.dateOfBirth}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <span className="text-xs text-muted-foreground font-medium">Gender</span>
                    <span className="text-xs font-semibold text-foreground text-right">{profile.gender}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <span className="text-xs text-muted-foreground font-medium">Phone</span>
                    <span className="text-xs font-semibold text-foreground text-right">{profile.phone}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <span className="text-xs text-muted-foreground font-medium">Personal Email</span>
                    <span className="text-xs font-semibold text-primary truncate text-right hover:underline cursor-pointer">{profile.personalEmail}</span>
                  </div>
                </CardContent>
              </Card>

              {/* Skills */}
              <Card className="shadow-sm md:col-span-1">
                <CardHeader className="p-4 pb-2">
                  <CardTitle className="text-base flex items-center justify-between">
                    Skills (Top 6)
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4 pt-2">
                  <div className="flex flex-wrap gap-2">
                    {profile.skills.map(s => (
                      <Badge key={s.id} variant="secondary" className="bg-muted/50 font-medium text-foreground hover:bg-muted">
                        {s.name}
                      </Badge>
                    ))}
                  </div>
                  <button className="text-xs font-semibold text-primary mt-4 hover:underline">View All Skills</button>
                </CardContent>
              </Card>

              {/* Quick Links */}
              <Card className="shadow-sm md:col-span-1">
                <CardHeader className="p-4 pb-2">
                  <CardTitle className="text-base">Quick Links</CardTitle>
                </CardHeader>
                <CardContent className="p-4 pt-2 flex flex-col gap-1">
                  <Button variant="ghost" className="justify-between py-2 text-sm text-foreground hover:bg-muted/50 rounded-md px-2 -mx-2 h-auto">
                    <div className="flex items-center gap-2"><Network className="size-4 text-muted-foreground" /> View Organizational Chart</div>
                    <ChevronRight className="size-3.5 text-muted-foreground" />
                  </Button>
                  <Button variant="ghost" className="justify-between py-2 text-sm text-foreground hover:bg-muted/50 rounded-md px-2 -mx-2 h-auto">
                    <div className="flex items-center gap-2"><User className="size-4 text-muted-foreground" /> View Team</div>
                    <ChevronRight className="size-3.5 text-muted-foreground" />
                  </Button>
                  <Button variant="ghost" className="justify-between py-2 text-sm text-foreground hover:bg-muted/50 rounded-md px-2 -mx-2 h-auto">
                    <div className="flex items-center gap-2"><MessageSquare className="size-4 text-muted-foreground" /> Send Message</div>
                    <ChevronRight className="size-3.5 text-muted-foreground" />
                  </Button>
                  <Button variant="ghost" className="justify-between py-2 text-sm text-foreground hover:bg-muted/50 rounded-md px-2 -mx-2 h-auto">
                    <div className="flex items-center gap-2"><FileText className="size-4 text-muted-foreground" /> Request Update</div>
                    <ChevronRight className="size-3.5 text-muted-foreground" />
                  </Button>
                </CardContent>
              </Card>

            </div>

            {/* Lifecycle Timeline */}
            <Card className="shadow-sm">
              <CardHeader className="p-5 border-b border-border/40">
                <CardTitle className="text-base">Lifecycle Timeline</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="flex flex-col">
                  {profile.timeline.map((event, i) => (
                    <div key={event.id} className="flex items-center justify-between p-4 border-b border-border/40 hover:bg-muted/30 transition-colors group cursor-pointer">
                      <div className="flex items-center gap-4">
                        <div className="size-10 rounded-full bg-muted flex items-center justify-center text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary transition-colors">
                          {getTimelineIcon(event.icon)}
                        </div>
                        <div className="flex flex-col">
                          <span className="text-sm font-bold text-foreground">{event.title}</span>
                          <span className="text-xs text-muted-foreground">{event.description}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className="text-sm font-medium text-foreground">{event.date}</span>
                        <ChevronRight className="size-4 text-muted-foreground/40 group-hover:text-muted-foreground transition-colors" />
                      </div>
                    </div>
                  ))}
                </div>
                <div className="p-4 bg-muted/10">
                  <button className="text-xs font-semibold text-primary hover:underline">View Full Timeline</button>
                </div>
              </CardContent>
            </Card>

            {/* Current Position Details & Team Members */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card className="shadow-sm">
                <CardHeader className="p-5 border-b border-border/40">
                  <CardTitle className="text-base">Current Position Details</CardTitle>
                </CardHeader>
                <CardContent className="p-5 flex flex-col gap-3">
                  <div className="grid grid-cols-2 gap-2">
                    <span className="text-sm text-muted-foreground font-medium">Position Title</span>
                    <span className="text-sm font-semibold text-foreground">{profile.role}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <span className="text-sm text-muted-foreground font-medium">Job Level</span>
                    <span className="text-sm font-semibold text-foreground">{profile.grade}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <span className="text-sm text-muted-foreground font-medium">Business Unit</span>
                    <span className="text-sm font-semibold text-foreground">{profile.businessUnit}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <span className="text-sm text-muted-foreground font-medium">Department</span>
                    <span className="text-sm font-semibold text-foreground">{profile.department}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <span className="text-sm text-muted-foreground font-medium">Employment Type</span>
                    <span className="text-sm font-semibold text-foreground">{profile.employeeType}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <span className="text-sm text-muted-foreground font-medium">Date in Current Role</span>
                    <span className="text-sm font-semibold text-foreground">{profile.dateInCurrentRole}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <span className="text-sm text-muted-foreground font-medium">Total Experience</span>
                    <span className="text-sm font-semibold text-foreground">{profile.totalExperience}</span>
                  </div>
                  <button className="text-xs font-semibold text-primary mt-2 hover:underline w-fit">View Position History</button>
                </CardContent>
              </Card>

              <Card className="shadow-sm">
                <CardHeader className="p-5 border-b border-border/40">
                  <CardTitle className="text-base">Team Members ({profile.teamMembers.length})</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="flex flex-col">
                    {profile.teamMembers.map(member => (
                      <div key={member.id} className="flex items-center justify-between p-4 border-b border-border/40 hover:bg-muted/30 transition-colors">
                        <div className="flex items-center gap-3">
                          <div className="size-8 rounded-full bg-muted flex items-center justify-center text-xs font-bold text-muted-foreground">
                            {member.avatar}
                          </div>
                          <div className="flex flex-col">
                            <span className="text-sm font-bold text-foreground">{member.name}</span>
                            <span className="text-xs text-muted-foreground">{member.role}</span>
                          </div>
                        </div>
                        <StatusBadge variant="success" className="px-2 py-0.5 text-[10px]">{member.status}</StatusBadge>
                      </div>
                    ))}
                  </div>
                  <div className="p-4 bg-muted/10">
                    <button className="text-xs font-semibold text-primary hover:underline">View All Team Members</button>
                  </div>
                </CardContent>
              </Card>
            </div>

          </div>

          {/* Right Column (1/3) */}
          <div className="flex flex-col gap-6">
            
            {/* Current Status */}
            <Card className="shadow-sm">
              <CardContent className="p-5 flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground font-medium">Current Status</span>
                  <StatusBadge variant="success" className="px-2 py-0.5 text-xs font-bold bg-success/20">Active</StatusBadge>
                </div>
                <div className="flex items-center justify-between border-t border-border/40 pt-4">
                  <span className="text-sm text-muted-foreground font-medium">Employment Status</span>
                  <span className="text-sm font-semibold text-foreground">{profile.employmentStatus}</span>
                </div>
                <div className="flex items-center justify-between border-t border-border/40 pt-4">
                  <span className="text-sm text-muted-foreground font-medium">Probation Status</span>
                  <span className="text-sm font-semibold text-foreground">{profile.probationStatus}</span>
                </div>
                <div className="flex items-center justify-between border-t border-border/40 pt-4">
                  <span className="text-sm text-muted-foreground font-medium">Next Review</span>
                  <span className="text-sm font-semibold text-foreground">{profile.nextReview}</span>
                </div>
                <button className="text-xs font-semibold text-primary mt-1 hover:underline w-fit">View Status History</button>
              </CardContent>
            </Card>

            {/* Key Information */}
            <Card className="shadow-sm">
              <CardHeader className="p-5 pb-3 flex flex-row items-center justify-between space-y-0">
                <CardTitle className="text-base">Key Information</CardTitle>
                <button className="text-xs font-semibold text-primary hover:underline flex items-center gap-1">
                  Edit
                </button>
              </CardHeader>
              <CardContent className="p-5 pt-0 flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground font-medium">Employee ID</span>
                  <span className="text-sm font-semibold text-foreground">{profile.employeeId}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground font-medium">Aadhaar No.</span>
                  <span className="text-sm font-semibold text-foreground tabular-nums">{profile.aadhaarNo}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground font-medium">PAN</span>
                  <span className="text-sm font-semibold text-foreground tabular-nums">{profile.pan}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground font-medium">PF Number</span>
                  <span className="text-sm font-semibold text-foreground tabular-nums">{profile.pfNumber}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground font-medium">Blood Group</span>
                  <span className="text-sm font-semibold text-foreground">{profile.bloodGroup}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground font-medium">Nationality</span>
                  <span className="text-sm font-semibold text-foreground">{profile.nationality}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground font-medium">Marital Status</span>
                  <span className="text-sm font-semibold text-foreground">{profile.maritalStatus}</span>
                </div>
              </CardContent>
            </Card>

            {/* Tags */}
            <Card className="shadow-sm">
              <CardHeader className="p-5 pb-3 flex flex-row items-center justify-between space-y-0">
                <CardTitle className="text-base">Tags</CardTitle>
                <button className="text-xs font-semibold text-primary hover:underline flex items-center gap-1">
                  Edit
                </button>
              </CardHeader>
              <CardContent className="p-5 pt-0">
                <div className="flex flex-wrap gap-2">
                  {profile.tags.map(tag => (
                    <Badge key={tag} variant="outline" className="font-medium text-muted-foreground bg-muted/30 hover:bg-muted">
                      {tag}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Attachments */}
            <Card className="shadow-sm">
              <CardHeader className="p-5 pb-3 flex flex-row items-center justify-between space-y-0">
                <CardTitle className="text-base">Attachments</CardTitle>
                <button className="text-xs font-semibold text-primary hover:underline flex items-center gap-1">
                  <Upload className="size-3.5" /> Upload
                </button>
              </CardHeader>
              <CardContent className="p-5 pt-0 flex flex-col gap-3">
                {profile.attachments.map(file => (
                  <div key={file.id} className="flex items-center justify-between group">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="p-1.5 rounded bg-destructive/10 text-destructive shrink-0">
                        <FileText className="size-3.5" />
                      </div>
                      <span className="text-sm font-medium text-foreground truncate cursor-pointer hover:underline group-hover:text-primary transition-colors">
                        {file.name}
                      </span>
                    </div>
                    <span className="text-xs text-muted-foreground shrink-0">{file.size}</span>
                  </div>
                ))}
                <button className="text-xs font-semibold text-primary mt-2 hover:underline w-fit">View All Attachments</button>
              </CardContent>
            </Card>

          </div>
        </div>
      )}

      {activeTab !== 'overview' && (
        <div className="flex flex-col items-center justify-center py-20 text-center bg-card rounded-xl border border-dashed border-border/60">
          <FileText className="size-12 text-muted-foreground/30 mb-4" />
          <h3 className="text-lg font-bold text-foreground mb-1">
            {tabs.find(t => t.id === activeTab)?.label}
          </h3>
          <p className="text-sm text-muted-foreground max-w-sm">
            This section is under construction. Future updates will include detailed {tabs.find(t => t.id === activeTab)?.label.toLowerCase()} information.
          </p>
        </div>
      )}

    </div>
  )
}
