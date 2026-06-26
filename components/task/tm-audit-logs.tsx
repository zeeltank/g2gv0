'use client'

import React, { useState } from 'react'
import { History, Search, Download, Filter } from 'lucide-react'
import { Button } from '@/components/ui/button'

const mockLogs = [
  { id: '1', user: 'Sarah Chen', action: 'Approved Task', resource: 'T-101: Finalize Q3 Budget', time: '10 mins ago', details: 'Status changed from Review to Completed' },
  { id: '2', user: 'Michael Scott', action: 'Updated Config', resource: 'Priority Management', time: '1 hour ago', details: 'Changed High Priority SLA from 48h to 24h' },
  { id: '3', user: 'Pam Beesly', action: 'Created Task', resource: 'T-107: Update Onboarding', time: '3 hours ago', details: 'Assigned to Jim Halpert' },
  { id: '4', user: 'System', action: 'Webhook Triggered', resource: 'Integration: Slack', time: '3 hours ago', details: 'Payload sent to #engineering' },
  { id: '5', user: 'Dwight Schrute', action: 'Deleted Task', resource: 'T-099: Old Draft', time: '1 day ago', details: 'Permanently removed' },
]

export function TmAuditLogs() {
  const [search, setSearch] = useState('')

  return (
    <div className="flex h-full flex-col gap-8 p-8 overflow-y-auto g2g-scrollbar">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex flex-col gap-1.5">
          <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-3">
            <div className="p-2.5 bg-primary/10 rounded-xl border border-primary/20 text-primary shadow-sm">
              <History className="w-6 h-6" />
            </div>
            Audit Logs
          </h1>
         
        </div>
        <Button variant="outline" className="gap-2 rounded-xl px-5 h-11 font-bold border-border hover:bg-muted text-foreground">
          <Download className="w-4 h-4" /> Export CSV
        </Button>
      </div>

      {/* Main Content */}
      <div className="flex flex-col gap-6 w-full">
        {/* Action Bar */}
        <div className="flex items-center gap-4 bg-card/50 backdrop-blur-md p-2 rounded-2xl border border-primary/10 shadow-sm">
          <div className="flex items-center gap-2 flex-1 ml-2 relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search by user, action, or resource..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-9 w-full rounded-md border border-input bg-background/50 pl-9 pr-3 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary transition-all"
            />
          </div>
          <Button variant="ghost" className="h-9 rounded-lg font-bold text-muted-foreground hover:text-foreground">
            <Filter className="w-4 h-4 mr-2" /> Filter
          </Button>
        </div>

        {/* Log Table */}
        <div className="bg-card/90 backdrop-blur-2xl border border-primary/10 rounded-[24px] shadow-xl overflow-hidden">
          <div className="grid grid-cols-12 gap-4 px-6 py-4 border-b border-primary/10 bg-primary/5 text-xs font-bold uppercase tracking-wider text-muted-foreground">
            <div className="col-span-2 flex items-center">User</div>
            <div className="col-span-2 flex items-center">Action</div>
            <div className="col-span-3 flex items-center">Resource</div>
            <div className="col-span-3 flex items-center">Details</div>
            <div className="col-span-2 flex items-center justify-end">Timestamp</div>
          </div>
          
          <div className="flex flex-col">
            {mockLogs.filter(l => l.user.toLowerCase().includes(search.toLowerCase()) || l.resource.toLowerCase().includes(search.toLowerCase())).map((log) => (
              <div key={log.id} className="grid grid-cols-12 gap-4 px-6 py-5 border-b border-border/50 last:border-0 hover:bg-primary/5 transition-colors">
                <div className="col-span-2 font-bold text-sm text-foreground flex items-center">
                  {log.user}
                </div>
                <div className="col-span-2 flex items-center">
                  <span className="px-2.5 py-1 bg-background border border-border rounded-lg text-xs font-bold">
                    {log.action}
                  </span>
                </div>
                <div className="col-span-3 font-medium text-sm text-foreground flex items-center truncate">
                  {log.resource}
                </div>
                <div className="col-span-3 text-sm text-muted-foreground flex items-center truncate">
                  {log.details}
                </div>
                <div className="col-span-2 text-sm text-muted-foreground font-medium flex items-center justify-end">
                  {log.time}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
