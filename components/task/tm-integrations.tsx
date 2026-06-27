'use client'

import React from 'react'
import { Webhook, Link2, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const integrations = [
  { 
    id: 'slack', 
    name: 'Slack', 
    description: 'Send task notifications, updates, and approval requests directly to Slack channels.', 
    connected: true,
    logo: 'S'
  },
  { 
    id: 'jira', 
    name: 'Jira Software', 
    description: 'Sync tickets, statuses, and assignees bi-directionally with Jira projects.', 
    connected: false,
    logo: 'J'
  },
  { 
    id: 'github', 
    name: 'GitHub', 
    description: 'Link pull requests and commits directly to task IDs for automated status updates.', 
    connected: true,
    logo: 'G'
  },
  { 
    id: 'webhooks', 
    name: 'Custom Webhooks', 
    description: 'Trigger external APIs on task creation, completion, or review status changes.', 
    connected: false,
    logo: 'W'
  },
]

export function TmIntegrations() {
  return (
    <div className="flex h-full flex-col gap-8 p-8 overflow-y-auto g2g-scrollbar">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex flex-col gap-1.5">
          <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-3">
            <div className="p-2.5 bg-primary/10 rounded-xl border border-primary/20 text-primary shadow-sm">
              <Link2 className="w-6 h-6" />
            </div>
            Integrations & Webhooks
          </h1>
         
        </div>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 w-full">
        {integrations.map(integration => (
          <div key={integration.id} className="flex flex-col bg-card/90 backdrop-blur-2xl border border-primary/10 rounded-[24px] shadow-xl overflow-hidden group hover:border-primary/30 transition-all duration-500 hover:shadow-2xl hover:-translate-y-1">
            <div className="p-6 flex-1 flex flex-col">
              <div className="flex items-start justify-between mb-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary font-bold text-xl border border-primary/20 shadow-sm">
                  {integration.id === 'webhooks' ? <Webhook className="w-6 h-6" /> : integration.logo}
                </div>
                {integration.connected && (
                  <span className="flex items-center gap-1.5 px-3 py-1 bg-primary/10 text-primary text-xs font-bold rounded-lg border border-primary/20">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Connected
                  </span>
                )}
              </div>
              <h3 className="text-xl font-bold text-foreground mb-2">{integration.name}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed flex-1">
                {integration.description}
              </p>
            </div>
            
            <div className="p-4 border-t border-primary/10 bg-background/50 flex items-center justify-center">
              <Button 
                variant={integration.connected ? "outline" : "default"}
                className={cn(
                  "rounded-xl font-bold px-6 w-full transition-all",
                  integration.connected 
                    ? "border-primary/20 text-primary hover:bg-primary/5 hover:text-primary" 
                    : "shadow-lg shadow-primary/20"
                )}
              >
                {integration.connected ? 'Configure' : 'Connect'}
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
