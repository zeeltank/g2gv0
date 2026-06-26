'use client'

import React from 'react'
import { ShieldCheck, Check, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const roles = ['Admin', 'Executive', 'Dept Head', 'HR Manager', 'Employee']

const permissionsMatrix = [
  { module: 'Tasks', actions: [
    { name: 'Create Task', access: [true, false, true, false, true] },
    { name: 'Assign Task', access: [true, false, true, false, false] },
    { name: 'Update Status', access: [true, false, true, false, true] },
    { name: 'Approve Task', access: [true, true, true, true, false] },
    { name: 'Delete Task', access: [true, false, false, false, false] },
  ]},
  { module: 'Projects', actions: [
    { name: 'Create Project', access: [true, false, true, false, false] },
    { name: 'Manage Workstreams', access: [true, true, true, false, false] },
  ]},
  { module: 'Administration', actions: [
    { name: 'Manage Config', access: [true, false, false, false, false] },
    { name: 'View Audit Logs', access: [true, true, false, true, false] },
  ]}
]

export function TmPermissions() {
  return (
    <div className="flex h-full flex-col gap-8 p-8 overflow-y-auto g2g-scrollbar">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex flex-col gap-1.5">
          <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-3">
            <div className="p-2.5 bg-primary/10 rounded-xl border border-primary/20 text-primary shadow-sm">
              <ShieldCheck className="w-6 h-6" />
            </div>
            Permissions Matrix
          </h1>
      
        </div>
        <Button className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90 shadow-md shadow-primary/20 rounded-xl px-5 h-11 font-bold">
          Save Changes
        </Button>
      </div>

      {/* Main Content */}
      <div className="flex flex-col gap-6 w-full">
        <div className="bg-card/90 backdrop-blur-2xl border border-primary/10 rounded-[24px] shadow-xl overflow-hidden">
          
          {/* Header Row */}
          <div className="grid grid-cols-6 border-b border-primary/10 bg-primary/5">
            <div className="p-4 font-bold text-sm text-foreground flex items-center">
              Capability
            </div>
            {roles.map(role => (
              <div key={role} className="p-4 flex items-center justify-center font-bold text-sm text-primary">
                {role}
              </div>
            ))}
          </div>

          {/* Matrix Body */}
          <div className="flex flex-col">
            {permissionsMatrix.map((section, idx) => (
              <React.Fragment key={section.module}>
                <div className={cn("p-4 font-bold text-muted-foreground uppercase tracking-wider text-xs bg-background/50 flex items-center", idx !== 0 ? "border-t border-primary/10" : "")}>
                  {section.module}
                </div>
                {section.actions.map((action) => (
                  <div key={action.name} className="grid grid-cols-6 border-t border-primary/5 hover:bg-primary/5 transition-colors group">
                    <div className="p-4 text-sm font-bold text-foreground flex items-center">
                      {action.name}
                    </div>
                    {action.access.map((hasAccess, rIdx) => (
                      <div key={rIdx} className="p-4 flex items-center justify-center">
                        <Button className={cn(
                          "w-8 h-8 rounded-lg flex items-center justify-center transition-all shadow-sm border",
                          hasAccess 
                            ? "bg-primary/10 text-primary border-primary/30 hover:bg-primary hover:text-primary-foreground" 
                            : "bg-background border-border text-muted-foreground/30 hover:bg-muted hover:text-muted-foreground"
                        )}>
                          {hasAccess ? <Check className="w-4 h-4 stroke-[3]" /> : <X className="w-4 h-4" />}
                        </Button>
                      </div>
                    ))}
                  </div>
                ))}
              </React.Fragment>
            ))}
          </div>

        </div>
      </div>
    </div>
  )
}
