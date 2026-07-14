'use client'

import React, { useState } from 'react'
import {
  Search,
  Filter,
  Users,
  Shield,
  Key,
  GraduationCap,
  Building2,
  Zap,
  FileText,
  Settings,
  Upload,
  Plus,
  MoreVertical,
  ChevronLeft,
  ChevronRight,
  UserPlus,
  UsersRound,
  ShieldCheck,
  Activity,
  CheckCircle2,
  ExternalLink,
  Eye,
  Edit2
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { StatusBadge } from '@/components/ui/status-badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { cn } from '@/lib/utils'

// ─── Dummy Data ─────────────────────────────────────────────────────────────

const STATS = [
  { label: 'Users', value: '3,248', sub: 'Active Users', icon: Users },
  { label: 'Roles', value: '18', sub: 'System Roles', icon: Shield },
  { label: 'Permissions', value: '276', sub: 'Total Permissions', icon: Key },
  { label: 'Trainers', value: '156', sub: 'Active Trainers', icon: GraduationCap },
  { label: 'Vendors', value: '32', sub: 'Active Vendors', icon: Building2 },
  { label: 'Integrations', value: '7', sub: 'Connected', icon: Zap },
  { label: 'Audit Logs', value: '21,458', sub: 'Total Logs (30 Days)', icon: FileText },
]

const QUICK_ACTIONS = [
  { label: 'Add New User', icon: UserPlus },
  { label: 'Bulk Import Users', icon: UsersRound },
  { label: 'Manage Roles', icon: Shield },
  { label: 'Permission Matrix', icon: ShieldCheck },
  { label: 'Manage Integrations', icon: Zap },
  { label: 'View Audit Logs', icon: FileText },
]

const SYSTEM_HEALTH = [
  { label: 'SSO', status: 'Connected', variant: 'active' },
  { label: 'Email Service', status: 'Healthy', variant: 'active' },
  { label: 'Storage', status: 'Healthy', variant: 'active' },
  { label: 'Database', status: 'Healthy', variant: 'active' },
]

const USERS_DATA = [
  { initials: 'RK', name: 'Ravi Kumar', email: 'ravi.kumar@acme.com', department: 'Operations', role: 'Department Head', status: 'active', lastLogin: '02 May 2025, 09:15 AM' },
  { initials: 'SP', name: 'Sneha Patel', email: 'sneha.patel@acme.com', department: 'Human Resources', role: 'HR Manager', status: 'active', lastLogin: '02 May 2025, 08:42 AM' },
  { initials: 'AD', name: 'Admin User', email: 'admin@acme.com', department: 'IT', role: 'System Administrator', status: 'active', lastLogin: '02 May 2025, 10:20 AM' },
  { initials: 'AS', name: 'Arjun Singh', email: 'arjun.singh@acme.com', department: 'Sales', role: 'Employee', status: 'active', lastLogin: '01 May 2025, 05:30 PM' },
  { initials: 'PM', name: 'Priya Mehta', email: 'priya.mehta@acme.com', department: 'Learning & Development', role: 'Trainer', status: 'active', lastLogin: '01 May 2025, 03:22 PM' },
  { initials: 'KT', name: 'Karan Tiwari', email: 'karan.tiwari@acme.com', department: 'Finance', role: 'Employee', status: 'inactive', lastLogin: '28 Apr 2025, 11:05 AM' },
]

const TABS = [
  { id: 'users', label: 'Users', icon: Users },
  { id: 'roles', label: 'Roles & Permissions', icon: Shield },
  { id: 'trainers', label: 'Trainers', icon: GraduationCap },
  { id: 'vendors', label: 'Vendors', icon: Building2 },
  { id: 'integrations', label: 'Integrations', icon: Zap },
  { id: 'audit', label: 'Audit Logs', icon: FileText },
  { id: 'settings', label: 'Settings', icon: Settings },
]

// ─── Component ──────────────────────────────────────────────────────────────

export function LmsGovernance() {
  const [activeTab, setActiveTab] = useState('users')

  return (
    <div className="flex flex-col gap-6 pb-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Administration & Governance
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage users, roles, permissions, trainers, vendors, integrations and system settings.
          </p>
        </div>
        <div>
          <Button variant="outline" className="h-9 gap-2">
            <Settings className="size-4" /> System Settings
          </Button>
        </div>
      </div>

      {/* Stats Overflow Container */}
      <div className="flex items-center gap-4 overflow-x-auto g2g-scrollbar pb-2 -mb-2">
        {STATS.map((stat, i) => {
          const Icon = stat.icon
          return (
            <Card key={i} className="shadow-sm min-w-[200px] flex-1 shrink-0">
              <CardContent className="p-5 flex flex-col gap-3 relative overflow-hidden">
                <div className="flex items-center gap-2">
                  <Icon className="size-4 text-muted-foreground" />
                  <span className="text-sm font-semibold text-foreground">{stat.label}</span>
                </div>
                <div>
                  <div className="text-3xl font-bold tracking-tight">{stat.value}</div>
                  <div className="text-xs text-muted-foreground mt-1">{stat.sub}</div>
                </div>
                <Button variant="link" className="p-0 h-auto text-primary justify-start text-xs mt-2 font-semibold">
                  View all
                </Button>
                {/* Decorative Icon Background */}
                <Icon className="absolute -right-4 -bottom-4 size-24 text-muted/10 pointer-events-none" />
              </CardContent>
            </Card>
          )
        })}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_320px] gap-6">
        
        {/* Main Content Area */}
        <div className="flex flex-col gap-6">
          {/* Tabs */}
          <div className="flex items-center gap-6 border-b border-border/60 overflow-x-auto g2g-scrollbar">
            {TABS.map((tab) => {
              const TabIcon = tab.icon
              const isActive = activeTab === tab.id
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    'relative flex items-center gap-2 -mb-px pb-3 text-sm font-semibold transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring whitespace-nowrap',
                    isActive ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  <TabIcon className="size-4" />
                  {tab.label}
                  {isActive && (
                    <span className="absolute inset-x-0 bottom-0 h-[2px] rounded-full bg-primary" />
                  )}
                </button>
              )
            })}
          </div>

          {activeTab === 'users' && (
            <Card className="shadow-sm border-border/60 overflow-hidden flex flex-col flex-1">
              <div className="p-4 border-b border-border/60 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-muted/10 shrink-0">
                <div className="flex items-center gap-3 w-full sm:w-auto flex-wrap">
                  <div className="relative w-full sm:w-[280px]">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                    <input
                      type="text"
                      placeholder="Search users by name, email or ID..."
                      className="w-full h-9 pl-9 pr-4 rounded-md border border-border bg-background text-sm outline-none focus:ring-1 focus:ring-ring"
                    />
                  </div>
                  <Button variant="outline" size="sm" className="h-9 bg-background">
                    <Filter className="mr-2 size-4" /> Filters
                  </Button>
                  <select className="h-9 rounded-md border border-border bg-background px-3 py-1 text-sm outline-none focus:ring-1 focus:ring-ring min-w-[120px]">
                    <option>Status: Active</option>
                    <option>Status: Inactive</option>
                    <option>Status: Suspended</option>
                  </select>
                </div>
                
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <Button variant="outline" size="sm" className="h-9 bg-background">
                    <Upload className="mr-2 size-4" /> Import Users
                  </Button>
                  <Button size="sm" className="h-9 bg-primary text-primary-foreground">
                    <Plus className="mr-2 size-4" /> Add User
                  </Button>
                  <Button variant="outline" size="icon" className="h-9 w-9 bg-background shrink-0">
                    <MoreVertical className="size-4" />
                  </Button>
                </div>
              </div>

              <div className="overflow-x-auto flex-1">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/30 hover:bg-muted/30">
                      <TableHead className="w-12 text-center pl-4">
                        <input type="checkbox" className="rounded border-input" />
                      </TableHead>
                      <TableHead className="font-semibold">User Name</TableHead>
                      <TableHead className="font-semibold">Email</TableHead>
                      <TableHead className="font-semibold">Department</TableHead>
                      <TableHead className="font-semibold">Role</TableHead>
                      <TableHead className="font-semibold">Status</TableHead>
                      <TableHead className="font-semibold">Last Login</TableHead>
                      <TableHead className="font-semibold text-right pr-4">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {USERS_DATA.map((user, idx) => (
                      <TableRow key={idx} className="hover:bg-muted/30">
                        <TableCell className="text-center pl-4">
                          <input type="checkbox" className="rounded border-input" />
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className="size-8 rounded-full bg-muted flex items-center justify-center shrink-0 border border-border/50">
                              <span className="text-xs font-semibold text-muted-foreground">{user.initials}</span>
                            </div>
                            <span className="font-medium text-foreground whitespace-nowrap">{user.name}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-muted-foreground">{user.email}</TableCell>
                        <TableCell>{user.department}</TableCell>
                        <TableCell>{user.role}</TableCell>
                        <TableCell>
                          <StatusBadge variant={user.status === 'active' ? 'active' : 'inactive'} className="font-medium">
                            {user.status === 'active' ? 'Active' : 'Inactive'}
                          </StatusBadge>
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm whitespace-nowrap">{user.lastLogin}</TableCell>
                        <TableCell className="text-right pr-4">
                          <div className="flex items-center justify-end gap-1">
                            <Button variant="ghost" size="icon" className="size-8">
                              <Eye className="size-4 text-muted-foreground" />
                            </Button>
                            <Button variant="ghost" size="icon" className="size-8">
                              <Edit2 className="size-4 text-muted-foreground" />
                            </Button>
                            <Button variant="ghost" size="icon" className="size-8">
                              <MoreVertical className="size-4 text-muted-foreground" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Pagination */}
              <div className="mt-auto flex items-center justify-between px-6 py-4 border-t border-border/60 bg-muted/10 shrink-0">
                <span className="text-sm text-muted-foreground">
                  Showing 1 to 6 of 3,248 users
                </span>
                <div className="flex items-center gap-6">
                  <div className="flex items-center gap-1">
                    <Button variant="outline" size="icon" className="size-8 text-muted-foreground bg-background" disabled>
                      <ChevronLeft className="size-4" />
                    </Button>
                    <Button variant="outline" size="icon" className="size-8 bg-primary text-primary-foreground border-primary hover:bg-primary/90 hover:text-primary-foreground">1</Button>
                    <Button variant="outline" size="icon" className="size-8 bg-background">2</Button>
                    <Button variant="outline" size="icon" className="size-8 bg-background">3</Button>
                    <span className="px-2 text-muted-foreground">...</span>
                    <Button variant="outline" size="icon" className="size-8 bg-background">542</Button>
                    <Button variant="outline" size="icon" className="size-8 bg-background">
                      <ChevronRight className="size-4" />
                    </Button>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">Rows per page:</span>
                    <select className="h-8 rounded-md border border-border bg-background px-2 py-1 text-sm outline-none">
                      <option>10</option>
                      <option>20</option>
                      <option>50</option>
                    </select>
                  </div>
                </div>
              </div>
            </Card>
          )}

          {activeTab !== 'users' && (
            <Card className="shadow-sm border-border/60 p-12 flex flex-col items-center justify-center text-center">
              <Settings className="size-12 text-muted-foreground/30 mb-4" />
              <h3 className="text-lg font-semibold text-foreground">Configuration Module</h3>
              <p className="text-sm text-muted-foreground max-w-sm mt-2">
                This section handles {TABS.find(t => t.id === activeTab)?.label.toLowerCase()} configuration and management.
              </p>
              <Button variant="outline" className="mt-6">Configure {TABS.find(t => t.id === activeTab)?.label}</Button>
            </Card>
          )}
        </div>

        {/* Right Sidebar - Quick Actions & Health */}
        <div className="flex flex-col gap-6">
          <Card className="shadow-sm border-border/60 shrink-0">
            <CardHeader className="pb-3 border-b border-border/60">
              <CardTitle className="text-base">Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="flex flex-col">
                {QUICK_ACTIONS.map((action, i) => {
                  const Icon = action.icon
                  return (
                    <button 
                      key={i}
                      className="w-full flex items-center gap-3 px-5 py-3.5 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors border-b border-border/60 last:border-0"
                    >
                      <Icon className="size-4 shrink-0" />
                      {action.label}
                    </button>
                  )
                })}
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-sm border-border/60 flex-1 flex flex-col">
            <CardHeader className="pb-3 border-b border-border/60 shrink-0">
              <CardTitle className="text-base">System Health</CardTitle>
            </CardHeader>
            <CardContent className="p-5 flex flex-col gap-4 flex-1">
              {SYSTEM_HEALTH.map((item, i) => (
                <div key={i} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {i === 0 ? <Key className="size-4 text-muted-foreground" /> :
                     i === 1 ? <Activity className="size-4 text-muted-foreground" /> :
                     i === 2 ? <Building2 className="size-4 text-muted-foreground" /> :
                     <ShieldCheck className="size-4 text-muted-foreground" />}
                    <span className="text-sm font-medium text-foreground">{item.label}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="size-2 rounded-full bg-emerald-500" />
                    <span className="text-xs font-semibold text-muted-foreground">{item.status}</span>
                  </div>
                </div>
              ))}
              
              <div className="mt-auto pt-4 border-t border-border/60 shrink-0">
                <Button variant="link" className="p-0 h-auto text-primary font-semibold text-sm gap-1">
                  View System Status <ExternalLink className="size-3" />
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
