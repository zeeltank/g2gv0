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
      { id: 's4', name: 'Role & Responsibility', actions: { view: true, add: true, edit: true, delete: true, dashboard: false, mobile: false } }
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

export function RoleResponsibility() {
  const [searchQuery, setSearchQuery] = useState('')
  const [activeRoleId, setActiveRoleId] = useState<string>('2') // Default to HR Manager
  const [permissions, setPermissions] = useState<ModulePermission[]>(MOCK_MODULES)
  const [hasChanges, setHasChanges] = useState(false)

  const activeRole = useMemo(() => MOCK_ROLES.find(r => r.id === activeRoleId), [activeRoleId])
  const filteredRoles = useMemo(() => MOCK_ROLES.filter(r => r.name.toLowerCase().includes(searchQuery.toLowerCase())), [searchQuery])

  React.useEffect(() => {
    // In a real app, this would fetch from API based on activeRoleId
    setHasChanges(false)
  }, [activeRoleId])

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
    <div className="flex h-[calc(100vh-8rem)] gap-6 overflow-hidden">
      
      {/* Left Sidebar: Roles List */}
      <div className="flex w-80 flex-col rounded-xl border bg-card shadow-sm overflow-hidden shrink-0">
        <div className="p-4 border-b bg-muted/20">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-primary" />
              Access Roles
            </h2>
            <Button size="sm" variant="ghost" className="h-8 px-2 text-primary cursor-pointer hover:bg-primary/10">
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
                "w-full text-left px-3 py-3 rounded-lg transition-all cursor-pointer flex flex-col gap-1",
                activeRoleId === role.id 
                  ? "bg-primary/10 border border-primary/20" 
                  : "hover:bg-muted border border-transparent"
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
                  "cursor-pointer shadow-sm transition-all",
                  hasChanges ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                )}
              >
                <Save className="mr-2 h-4 w-4" />
                {hasChanges ? 'Save Changes' : 'Saved'}
              </Button>
            </div>

            {/* Permissions List */}
            <div className="flex-1 overflow-y-auto p-6 bg-surface">
              <Accordion type="multiple" defaultValue={MOCK_MODULES.map(m => m.id)} className="space-y-4">
                {permissions.map((module) => (
                  <AccordionItem 
                    key={module.id} 
                    value={module.id} 
                    className="border rounded-xl bg-card overflow-hidden shadow-sm data-[state=open]:border-primary/20 transition-all px-0"
                  >
                    <AccordionTrigger className="hover:no-underline px-6 py-4 bg-muted/20 cursor-pointer">
                      <div className="flex items-center gap-3 text-left">
                        <div className="p-2 bg-primary/10 rounded-md shrink-0">
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
                                  <Checkbox 
                                    className="cursor-pointer"
                                    checked={module.screens.length > 0 && module.screens.every(s => s.actions.view)}
                                    onCheckedChange={(c) => handleModuleToggleAll(module.id, 'view', !!c)}
                                  />
                                </div>
                              </th>
                              <th className="px-4 py-3 font-semibold text-center w-24">
                                <div className="flex flex-col items-center gap-2">
                                  <span>Add</span>
                                  <Checkbox 
                                    className="cursor-pointer"
                                    checked={module.screens.length > 0 && module.screens.every(s => s.actions.add)}
                                    onCheckedChange={(c) => handleModuleToggleAll(module.id, 'add', !!c)}
                                  />
                                </div>
                              </th>
                              <th className="px-4 py-3 font-semibold text-center w-24">
                                <div className="flex flex-col items-center gap-2">
                                  <span>Edit</span>
                                  <Checkbox 
                                    className="cursor-pointer"
                                    checked={module.screens.length > 0 && module.screens.every(s => s.actions.edit)}
                                    onCheckedChange={(c) => handleModuleToggleAll(module.id, 'edit', !!c)}
                                  />
                                </div>
                              </th>
                              <th className="px-4 py-3 font-semibold text-center w-24">
                                <div className="flex flex-col items-center gap-2">
                                  <span>Delete</span>
                                  <Checkbox 
                                    className="cursor-pointer"
                                    checked={module.screens.length > 0 && module.screens.every(s => s.actions.delete)}
                                    onCheckedChange={(c) => handleModuleToggleAll(module.id, 'delete', !!c)}
                                  />
                                </div>
                              </th>
                              <th className="px-4 py-3 font-semibold text-center w-28 border-l">
                                <div className="flex flex-col items-center gap-2">
                                  <span>Dashboard</span>
                                  <Checkbox 
                                    className="cursor-pointer"
                                    checked={module.screens.length > 0 && module.screens.every(s => s.actions.dashboard)}
                                    onCheckedChange={(c) => handleModuleToggleAll(module.id, 'dashboard', !!c)}
                                  />
                                </div>
                              </th>
                              <th className="px-4 py-3 font-semibold text-center w-24">
                                <div className="flex flex-col items-center gap-2">
                                  <span>Mobile</span>
                                  <Checkbox 
                                    className="cursor-pointer"
                                    checked={module.screens.length > 0 && module.screens.every(s => s.actions.mobile)}
                                    onCheckedChange={(c) => handleModuleToggleAll(module.id, 'mobile', !!c)}
                                  />
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
                                    <Checkbox 
                                      checked={screen.actions.view} 
                                      onCheckedChange={() => handleActionToggle(module.id, screen.id, 'view')}
                                      className="cursor-pointer"
                                    />
                                  </td>
                                  <td className="px-4 py-4 text-center">
                                    <Checkbox 
                                      checked={screen.actions.add} 
                                      onCheckedChange={() => handleActionToggle(module.id, screen.id, 'add')}
                                      className="cursor-pointer"
                                    />
                                  </td>
                                  <td className="px-4 py-4 text-center">
                                    <Checkbox 
                                      checked={screen.actions.edit} 
                                      onCheckedChange={() => handleActionToggle(module.id, screen.id, 'edit')}
                                      className="cursor-pointer"
                                    />
                                  </td>
                                  <td className="px-4 py-4 text-center">
                                    <Checkbox 
                                      checked={screen.actions.delete} 
                                      onCheckedChange={() => handleActionToggle(module.id, screen.id, 'delete')}
                                      className="cursor-pointer"
                                    />
                                  </td>
                                  <td className="px-4 py-4 text-center border-l bg-muted/5">
                                    <Checkbox 
                                      checked={screen.actions.dashboard} 
                                      onCheckedChange={() => handleActionToggle(module.id, screen.id, 'dashboard')}
                                      className="cursor-pointer"
                                    />
                                  </td>
                                  <td className="px-4 py-4 text-center bg-muted/5">
                                    <Checkbox 
                                      checked={screen.actions.mobile} 
                                      onCheckedChange={() => handleActionToggle(module.id, screen.id, 'mobile')}
                                      className="cursor-pointer"
                                    />
                                  </td>
                                  <td className="px-6 py-4 text-right border-l">
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => handleScreenToggleAll(module.id, screen.id, !isAllSelected)}
                                      className="h-7 text-xs cursor-pointer hover:bg-primary/10 hover:text-primary"
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
            <ShieldCheck className="h-12 w-12 opacity-20 mb-4" />
            <p>Select a role from the sidebar to configure permissions.</p>
          </div>
        )}
      </div>

    </div>
  )
}
