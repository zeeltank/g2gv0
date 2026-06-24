'use client'

import React, { useState, useMemo } from 'react'
import {
  Search,
  Plus,
  ShieldCheck,
  Settings2,
  Save,
  Users
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { cn } from '@/lib/utils'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

// Mock Data
type ActionKey = 'view' | 'add' | 'edit' | 'delete' | 'dashboard' | 'mobile'

interface ScreenPermission {
  id: string
  name: string
  actions: Record<ActionKey, boolean>
}

interface ModulePermission {
  id: string
  name: string
  screens: ScreenPermission[]
}

const MOCK_ROLES = [
  { id: '1', name: 'System Administrator', description: 'Full access to all modules and system settings.', users: 3 },
  { id: '2', name: 'HR Manager', description: 'Manage employee data, recruitment, and organizational structure.', users: 5 },
  { id: '3', name: 'Recruiter', description: 'Access to talent acquisition and onboarding.', users: 8 },
  { id: '4', name: 'Department Head', description: 'View and manage their department\'s employees and tasks.', users: 12 },
  { id: '5', name: 'Employee', description: 'Basic access to own profile, attendance, and tasks.', users: 145 }
]

const MOCK_MODULES: ModulePermission[] = [
  {
    id: 'm1',
    name: 'Organization Management',
    screens: [
      { id: 's1', name: 'Organization Profile', actions: { view: true, add: false, edit: false, delete: false, dashboard: true, mobile: true } },
      { id: 's2', name: 'Department Hierarchy', actions: { view: true, add: true, edit: true, delete: false, dashboard: false, mobile: false } },
      { id: 's3', name: 'Employee Directory', actions: { view: true, add: true, edit: true, delete: false, dashboard: true, mobile: true } },
      { id: 's4', name: 'Role & Permissions', actions: { view: true, add: true, edit: true, delete: true, dashboard: false, mobile: false } }
    ]
  },
  {
    id: 'm2',
    name: 'Competency Management',
    screens: [
      { id: 's5', name: 'Taxonomy Library', actions: { view: true, add: false, edit: false, delete: false, dashboard: false, mobile: false } },
      { id: 's6', name: 'Job Role Catalogue', actions: { view: true, add: false, edit: false, delete: false, dashboard: false, mobile: false } },
      { id: 's7', name: 'Employee Rating', actions: { view: true, add: true, edit: true, delete: false, dashboard: true, mobile: false } }
    ]
  },
  {
    id: 'm3',
    name: 'Talent Management',
    screens: [
      { id: 's8', name: 'Recruitment Dashboard', actions: { view: true, add: false, edit: false, delete: false, dashboard: true, mobile: true } },
      { id: 's9', name: 'Job Postings', actions: { view: true, add: true, edit: true, delete: true, dashboard: false, mobile: false } },
      { id: 's10', name: 'Candidate Tracking', actions: { view: true, add: true, edit: true, delete: false, dashboard: false, mobile: true } }
    ]
  }
]

export function RolePermissions() {
  const [searchQuery, setSearchQuery] = useState('')
  const [activeRoleId, setActiveRoleId] = useState<string>('2') // Default to HR Manager
  const [permissions, setPermissions] = useState<ModulePermission[]>(MOCK_MODULES)
  const [hasChanges, setHasChanges] = useState(false)
  const [roles, setRoles] = useState(MOCK_ROLES)
  const [isAddRoleOpen, setIsAddRoleOpen] = useState(false)
  const [newRoleName, setNewRoleName] = useState('')
  const [newRoleDesc, setNewRoleDesc] = useState('')
  const [animateKey, setAnimateKey] = useState(0) // Used to trigger animation on role change

  const activeRole = useMemo(() => roles.find(r => r.id === activeRoleId), [activeRoleId, roles])
  const filteredRoles = useMemo(() => roles.filter(r => r.name.toLowerCase().includes(searchQuery.toLowerCase())), [searchQuery, roles])

  React.useEffect(() => {
    // In a real app, this would fetch from API based on activeRoleId
    setHasChanges(false)
    setAnimateKey(prev => prev + 1)
  }, [activeRoleId])

  const handleAddRole = () => {
    if (!newRoleName.trim()) return
    const newRole = {
      id: Date.now().toString(),
      name: newRoleName,
      description: newRoleDesc,
      users: 0
    }
    setRoles([...roles, newRole])
    setActiveRoleId(newRole.id)
    setIsAddRoleOpen(false)
    setNewRoleName('')
    setNewRoleDesc('')
  }

  const handleActionToggle = (moduleId: string, screenId: string, action: ActionKey) => {
    setPermissions(prev => {
      const next = JSON.parse(JSON.stringify(prev)) as ModulePermission[]
      const mod = next.find(m => m.id === moduleId)
      if (mod) {
        const screen = mod.screens.find(s => s.id === screenId)
        if (screen) {
          screen.actions[action] = !screen.actions[action]
          
          if (action !== 'view' && screen.actions[action]) {
            screen.actions.view = true
          }
          if (action === 'view' && !screen.actions.view) {
            screen.actions.add = false
            screen.actions.edit = false
            screen.actions.delete = false
          }
        }
      }
      return next
    })
    setHasChanges(true)
  }

  const handleScreenToggleAll = (moduleId: string, screenId: string, value: boolean) => {
    setPermissions(prev => {
      const next = JSON.parse(JSON.stringify(prev)) as ModulePermission[]
      const mod = next.find(m => m.id === moduleId)
      if (mod) {
        const screen = mod.screens.find(s => s.id === screenId)
        if (screen) {
          screen.actions.view = value
          screen.actions.add = value
          screen.actions.edit = value
          screen.actions.delete = value
          screen.actions.dashboard = value
          screen.actions.mobile = value
        }
      }
      return next
    })
    setHasChanges(true)
  }

  const handleModuleToggleAll = (moduleId: string, action: ActionKey, value: boolean) => {
    setPermissions(prev => {
      const next = JSON.parse(JSON.stringify(prev)) as ModulePermission[]
      const mod = next.find(m => m.id === moduleId)
      if (mod) {
        mod.screens.forEach(screen => {
          screen.actions[action] = value
          if (value && action !== 'view') screen.actions.view = true
          if (!value && action === 'view') {
            screen.actions.add = false
            screen.actions.edit = false
            screen.actions.delete = false
          }
        })
      }
      return next
    })
    setHasChanges(true)
  }

  const handleSave = () => {
    setHasChanges(false)
  }

  return (
    <div className="flex h-full min-h-0 gap-6 overflow-hidden">
      
      {/* Left Sidebar: Roles List */}
      <div className="flex w-80 flex-col rounded-xl border bg-card shadow-sm overflow-hidden shrink-0">
        <div className="p-4 border-b bg-muted/20">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-primary" />
              Access Roles
            </h2>
            <Button 
              size="sm" 
              variant="ghost" 
              onClick={() => setIsAddRoleOpen(true)}
              className="h-8 px-2 text-primary cursor-pointer hover:bg-primary/10 active:scale-95 transition-all duration-200"
            >
              <Plus className="h-4 w-4 mr-1" /> Add
            </Button>
          </div>
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search roles..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="h-9 w-full rounded-md border border-input bg-background pl-9 pr-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {filteredRoles.map(role => (
            <button
              key={role.id}
              onClick={() => setActiveRoleId(role.id)}
              className={cn(
                "w-full text-left px-3 py-3 rounded-lg transition-all duration-300 cursor-pointer flex flex-col gap-1 active:scale-[0.98]",
                activeRoleId === role.id 
                  ? "bg-primary/10 border border-primary/20 shadow-sm" 
                  : "hover:bg-muted/60 border border-transparent hover:shadow-sm"
              )}
            >
              <div className="flex justify-between items-center w-full">
                <span className={cn(
                  "font-medium text-sm",
                  activeRoleId === role.id ? "text-primary font-semibold" : "text-foreground"
                )}>
                  {role.name}
                </span>
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <Users className="h-3 w-3" /> {role.users}
                </span>
              </div>
              <span className="text-xs text-muted-foreground line-clamp-1">
                {role.description}
              </span>
            </button>
          ))}
          {filteredRoles.length === 0 && (
            <div className="text-center py-8 text-sm text-muted-foreground">
              No roles found.
            </div>
          )}
        </div>
      </div>

      {/* Right Main Area: Permissions */}
      <div className="flex flex-1 flex-col rounded-xl border bg-card shadow-sm overflow-hidden">
        {activeRole ? (
          <>
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b bg-muted/10 shrink-0">
              <div>
                <h1 className="text-2xl font-bold text-foreground tracking-tight">
                  {activeRole.name} Permissions
                </h1>
                <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
                  {activeRole.description} Configure what users with this role can see and do.
                </p>
              </div>
              <Button 
                onClick={handleSave}
                disabled={!hasChanges}
                className={cn(
                  "cursor-pointer shadow-sm transition-all duration-300 active:scale-95",
                  hasChanges 
                    ? "bg-primary text-primary-foreground hover:bg-primary/90 hover:shadow-md hover:-translate-y-0.5" 
                    : "bg-muted text-muted-foreground"
                )}
              >
                <Save className="mr-2 h-4 w-4" />
                {hasChanges ? 'Save Changes' : 'Saved'}
              </Button>
            </div>

            {/* Permissions List */}
            <div key={animateKey} className="flex-1 overflow-y-auto p-6 bg-surface animate-in fade-in slide-in-from-bottom-4 duration-500">
              <Accordion type="multiple" defaultValue={MOCK_MODULES.map(m => m.id)} className="space-y-4">
                {permissions.map((module) => (
                  <AccordionItem 
                    key={module.id} 
                    value={module.id} 
                    className="border rounded-xl bg-card overflow-hidden shadow-sm data-[state=open]:border-primary/20 transition-all duration-300 px-0 hover:shadow-md"
                  >
                    <AccordionTrigger className="hover:no-underline px-6 py-4 bg-muted/10 hover:bg-muted/30 cursor-pointer transition-colors duration-300 group">
                      <div className="flex items-center gap-3 text-left">
                        <div className="p-2 bg-primary/10 rounded-md shrink-0 group-hover:bg-primary/20 transition-colors duration-300">
                          <Settings2 className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <h3 className="text-base font-semibold text-foreground">{module.name}</h3>
                          <p className="text-xs text-muted-foreground font-normal mt-0.5">
                            {module.screens.length} Screens
                          </p>
                        </div>
                      </div>
                    </AccordionTrigger>
                    
                    <AccordionContent className="px-0 pb-0 pt-0">
                      <div className="w-full overflow-x-auto">
                        <table className="w-full text-sm text-left">
                          <thead className="text-xs text-muted-foreground uppercase bg-muted/10 border-y">
                            <tr>
                              <th className="px-6 py-3 font-semibold">Screen / Feature</th>
                              <th className="px-4 py-3 font-semibold text-center w-24">
                                <div className="flex flex-col items-center gap-2">
                                  <span>View</span>
                                  <div className="hover:scale-110 active:scale-95 transition-transform">
                                    <Checkbox 
                                      className="cursor-pointer"
                                      checked={module.screens.length > 0 && module.screens.every(s => s.actions.view)}
                                      onCheckedChange={(c) => handleModuleToggleAll(module.id, 'view', !!c)}
                                    />
                                  </div>
                                </div>
                              </th>
                              <th className="px-4 py-3 font-semibold text-center w-24">
                                <div className="flex flex-col items-center gap-2">
                                  <span>Add</span>
                                  <div className="hover:scale-110 active:scale-95 transition-transform">
                                    <Checkbox 
                                      className="cursor-pointer"
                                      checked={module.screens.length > 0 && module.screens.every(s => s.actions.add)}
                                      onCheckedChange={(c) => handleModuleToggleAll(module.id, 'add', !!c)}
                                    />
                                  </div>
                                </div>
                              </th>
                              <th className="px-4 py-3 font-semibold text-center w-24">
                                <div className="flex flex-col items-center gap-2">
                                  <span>Edit</span>
                                  <div className="hover:scale-110 active:scale-95 transition-transform">
                                    <Checkbox 
                                      className="cursor-pointer"
                                      checked={module.screens.length > 0 && module.screens.every(s => s.actions.edit)}
                                      onCheckedChange={(c) => handleModuleToggleAll(module.id, 'edit', !!c)}
                                    />
                                  </div>
                                </div>
                              </th>
                              <th className="px-4 py-3 font-semibold text-center w-24">
                                <div className="flex flex-col items-center gap-2">
                                  <span>Delete</span>
                                  <div className="hover:scale-110 active:scale-95 transition-transform">
                                    <Checkbox 
                                      className="cursor-pointer"
                                      checked={module.screens.length > 0 && module.screens.every(s => s.actions.delete)}
                                      onCheckedChange={(c) => handleModuleToggleAll(module.id, 'delete', !!c)}
                                    />
                                  </div>
                                </div>
                              </th>
                              <th className="px-4 py-3 font-semibold text-center w-28 border-l">
                                <div className="flex flex-col items-center gap-2">
                                  <span>Dashboard</span>
                                  <div className="hover:scale-110 active:scale-95 transition-transform">
                                    <Checkbox 
                                      className="cursor-pointer"
                                      checked={module.screens.length > 0 && module.screens.every(s => s.actions.dashboard)}
                                      onCheckedChange={(c) => handleModuleToggleAll(module.id, 'dashboard', !!c)}
                                    />
                                  </div>
                                </div>
                              </th>
                              <th className="px-4 py-3 font-semibold text-center w-24">
                                <div className="flex flex-col items-center gap-2">
                                  <span>Mobile</span>
                                  <div className="hover:scale-110 active:scale-95 transition-transform">
                                    <Checkbox 
                                      className="cursor-pointer"
                                      checked={module.screens.length > 0 && module.screens.every(s => s.actions.mobile)}
                                      onCheckedChange={(c) => handleModuleToggleAll(module.id, 'mobile', !!c)}
                                    />
                                  </div>
                                </div>
                              </th>
                              <th className="px-6 py-3 font-semibold text-right border-l w-32">Quick Select</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border/50">
                            {module.screens.map((screen) => {
                              const isAllSelected = ['view', 'add', 'edit', 'delete', 'dashboard', 'mobile'].every(
                                a => screen.actions[a as ActionKey]
                              )
                              
                              return (
                                <tr key={screen.id} className="hover:bg-muted/30 transition-colors">
                                  <td className="px-6 py-4 font-medium text-foreground">
                                    {screen.name}
                                  </td>
                                  <td className="px-4 py-4 text-center">
                                    <div className="hover:scale-110 active:scale-95 transition-transform inline-block">
                                      <Checkbox 
                                        checked={screen.actions.view} 
                                        onCheckedChange={() => handleActionToggle(module.id, screen.id, 'view')}
                                        className="cursor-pointer"
                                      />
                                    </div>
                                  </td>
                                  <td className="px-4 py-4 text-center">
                                    <div className="hover:scale-110 active:scale-95 transition-transform inline-block">
                                      <Checkbox 
                                        checked={screen.actions.add} 
                                        onCheckedChange={() => handleActionToggle(module.id, screen.id, 'add')}
                                        className="cursor-pointer"
                                      />
                                    </div>
                                  </td>
                                  <td className="px-4 py-4 text-center">
                                    <div className="hover:scale-110 active:scale-95 transition-transform inline-block">
                                      <Checkbox 
                                        checked={screen.actions.edit} 
                                        onCheckedChange={() => handleActionToggle(module.id, screen.id, 'edit')}
                                        className="cursor-pointer"
                                      />
                                    </div>
                                  </td>
                                  <td className="px-4 py-4 text-center">
                                    <div className="hover:scale-110 active:scale-95 transition-transform inline-block">
                                      <Checkbox 
                                        checked={screen.actions.delete} 
                                        onCheckedChange={() => handleActionToggle(module.id, screen.id, 'delete')}
                                        className="cursor-pointer"
                                      />
                                    </div>
                                  </td>
                                  <td className="px-4 py-4 text-center border-l bg-muted/5">
                                    <div className="hover:scale-110 active:scale-95 transition-transform inline-block">
                                      <Checkbox 
                                        checked={screen.actions.dashboard} 
                                        onCheckedChange={() => handleActionToggle(module.id, screen.id, 'dashboard')}
                                        className="cursor-pointer"
                                      />
                                    </div>
                                  </td>
                                  <td className="px-4 py-4 text-center bg-muted/5">
                                    <div className="hover:scale-110 active:scale-95 transition-transform inline-block">
                                      <Checkbox 
                                        checked={screen.actions.mobile} 
                                        onCheckedChange={() => handleActionToggle(module.id, screen.id, 'mobile')}
                                        className="cursor-pointer"
                                      />
                                    </div>
                                  </td>
                                  <td className="px-6 py-4 text-right border-l">
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => handleScreenToggleAll(module.id, screen.id, !isAllSelected)}
                                      className="h-7 text-xs cursor-pointer hover:bg-primary/10 hover:text-primary active:scale-95 transition-all duration-200"
                                    >
                                      {isAllSelected ? 'Deselect All' : 'Select All'}
                                    </Button>
                                  </td>
                                </tr>
                              )
                            })}
                          </tbody>
                        </table>
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-muted-foreground flex-col">
            <ShieldCheck className="h-12 w-12 opacity-20 mb-4 animate-pulse" />
            <p>Select a role from the sidebar to configure permissions.</p>
          </div>
        )}
      </div>

      <Dialog open={isAddRoleOpen} onOpenChange={setIsAddRoleOpen}>
        <DialogContent className="sm:max-w-[425px] data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%] sm:rounded-xl">
          <DialogHeader>
            <DialogTitle>Add New Role</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="name">Role Name</Label>
              <Input
                id="name"
                value={newRoleName}
                onChange={(e) => setNewRoleName(e.target.value)}
                placeholder="e.g. Sales Director"
                className="transition-all duration-200 focus-visible:ring-primary/50"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="description">Description</Label>
              <Input
                id="description"
                value={newRoleDesc}
                onChange={(e) => setNewRoleDesc(e.target.value)}
                placeholder="Brief description of responsibilities"
                className="transition-all duration-200 focus-visible:ring-primary/50"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddRoleOpen(false)} className="active:scale-95 transition-transform">
              Cancel
            </Button>
            <Button onClick={handleAddRole} disabled={!newRoleName.trim()} className="active:scale-95 transition-transform">
              Save Role
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
