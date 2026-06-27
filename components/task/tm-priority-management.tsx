'use client'

import React, { useState } from 'react'
import { Plus, GripVertical, Settings2, Trash2, ShieldAlert } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const mockPriorities = [
  { id: '1', name: 'Critical', slaHours: 4, color: 'bg-primary/20 text-primary border-primary/40' },
  { id: '2', name: 'High', slaHours: 24, color: 'bg-primary/10 text-primary border-primary/20' },
  { id: '3', name: 'Medium', slaHours: 72, color: 'bg-background text-foreground border-border' },
  { id: '4', name: 'Low', slaHours: 168, color: 'bg-muted/50 text-muted-foreground border-transparent' },
]

export function TmPriorityManagement() {
  const [priorities, setPriorities] = useState(mockPriorities)

  return (
    <div className="flex h-full flex-col gap-8 p-8 overflow-y-auto g2g-scrollbar">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex flex-col gap-1.5">
          <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-3">
            <div className="p-2.5 bg-primary/10 rounded-xl border border-primary/20 text-primary shadow-sm">
              <ShieldAlert className="w-6 h-6" />
            </div>
            Priority Management
          </h1>
         
        </div>
        <Button className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90 shadow-md shadow-primary/20 rounded-xl px-5 h-11 font-bold">
          <Plus className="w-4 h-4 stroke-[3]" /> Add Priority
        </Button>
      </div>

      {/* Main Content */}
      <div className="flex flex-col gap-6 w-full">
        <div className="bg-card/90 backdrop-blur-2xl border border-primary/10 rounded-[24px] shadow-xl overflow-hidden">
          
          <div className="grid grid-cols-12 gap-4 px-6 py-4 border-b border-primary/10 bg-primary/5 text-xs font-bold uppercase tracking-wider text-muted-foreground">
            <div className="col-span-1 flex items-center justify-center"></div>
            <div className="col-span-4 flex items-center">Priority Name</div>
            <div className="col-span-3 flex items-center">Resolution SLA</div>
            <div className="col-span-3 flex items-center">Preview</div>
            <div className="col-span-1 flex items-center justify-end">Actions</div>
          </div>

          <div className="flex flex-col">
            {priorities.map((priority) => (
              <div key={priority.id} className="grid grid-cols-12 gap-4 px-6 py-4 items-center border-b border-border/50 last:border-0 hover:bg-primary/5 transition-colors group">
                <div className="col-span-1 flex justify-center cursor-grab text-muted-foreground hover:text-primary">
                  <GripVertical className="w-5 h-5" />
                </div>
                <div className="col-span-4 font-bold text-sm text-foreground flex items-center">
                  {priority.name}
                </div>
                <div className="col-span-3 flex items-center gap-2">
                  <span className="font-bold text-primary">{priority.slaHours}</span>
                  <span className="text-muted-foreground text-[10px] uppercase tracking-wider font-bold">Hours</span>
                </div>
                <div className="col-span-3 flex items-center">
                  <div className={cn("px-4 py-1.5 rounded-xl text-xs font-bold border", priority.color)}>
                    {priority.name}
                  </div>
                </div>
                <div className="col-span-1 flex justify-end items-center">
                  <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg">
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
