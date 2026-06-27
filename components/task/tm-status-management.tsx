'use client'

import React, { useState } from 'react'
import { Plus, GripVertical, CheckCircle2, Circle, Clock, AlertTriangle, Shield, Settings2, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const mockStatuses = [
  { id: '1', name: 'Draft', type: 'todo', color: 'bg-muted text-foreground' },
  { id: '2', name: 'To Do', type: 'todo', color: 'bg-primary/5 text-primary' },
  { id: '3', name: 'In Progress', type: 'in_progress', color: 'bg-primary/20 text-primary' },
  { id: '4', name: 'Review', type: 'in_progress', color: 'bg-primary/40 text-primary-foreground' },
  { id: '5', name: 'Blocked', type: 'blocked', color: 'bg-background text-primary border-primary' },
  { id: '6', name: 'Completed', type: 'done', color: 'bg-primary text-primary-foreground' },
]

export function TmStatusManagement() {
  const [statuses, setStatuses] = useState(mockStatuses)

  return (
    <div className="flex h-full flex-col gap-8 p-8 overflow-y-auto g2g-scrollbar">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex flex-col gap-1.5">
          <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-3">
            <div className="p-2.5 bg-primary/10 rounded-xl border border-primary/20 text-primary shadow-sm">
              <Settings2 className="w-6 h-6" />
            </div>
            Status Management
          </h1>
        </div>
        <Button className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90 shadow-md shadow-primary/20 rounded-xl px-5 h-11 font-bold">
          <Plus className="w-4 h-4 stroke-[3]" /> Add Status
        </Button>
      </div>

      {/* Main Content */}
      <div className="flex flex-col gap-6 w-full">
        <div className="bg-card/90 backdrop-blur-2xl border border-primary/10 rounded-[24px] shadow-xl overflow-hidden">
          
          <div className="grid grid-cols-12 gap-4 px-6 py-4 border-b border-primary/10 bg-primary/5 text-xs font-bold uppercase tracking-wider text-muted-foreground">
            <div className="col-span-1 flex items-center justify-center"></div>
            <div className="col-span-4 flex items-center">Status Name</div>
            <div className="col-span-3 flex items-center">Category</div>
            <div className="col-span-3 flex items-center">Preview</div>
            <div className="col-span-1 flex items-center justify-end">Actions</div>
          </div>

          <div className="flex flex-col">
            {statuses.map((status) => (
              <div key={status.id} className="grid grid-cols-12 gap-4 px-6 py-4 items-center border-b border-border/50 last:border-0 hover:bg-primary/5 transition-colors group">
                <div className="col-span-1 flex justify-center cursor-grab text-muted-foreground hover:text-primary">
                  <GripVertical className="w-5 h-5" />
                </div>
                <div className="col-span-4 font-bold text-sm text-foreground flex items-center">
                  {status.name}
                </div>
                <div className="col-span-3 flex items-center">
                  <span className="px-3 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider bg-background border border-border text-muted-foreground">
                    {status.type.replace('_', ' ')}
                  </span>
                </div>
                <div className="col-span-3 flex items-center">
                  <div className={cn("px-4 py-1.5 rounded-full text-xs font-bold border flex items-center gap-2", status.color, status.type === 'blocked' ? 'border-primary' : 'border-transparent')}>
                    {status.type === 'todo' && <Circle className="w-3.5 h-3.5" />}
                    {status.type === 'in_progress' && <Clock className="w-3.5 h-3.5" />}
                    {status.type === 'blocked' && <AlertTriangle className="w-3.5 h-3.5" />}
                    {status.type === 'done' && <CheckCircle2 className="w-3.5 h-3.5" />}
                    {status.name}
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
