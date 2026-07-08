'use client'

import React, { useState } from 'react'
import {
  X,
  Mail,
  Phone,
  CalendarDays,
  MoreHorizontal,
  Star,
  Download,
  FileText,
  ArrowRight,
  Clock,
  CheckCircle2,
  AlertCircle,
  MessageSquare,
  Maximize2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Select } from '@/components/ui/select'
import { StatusBadge } from '@/components/ui/status-badge'
import { Sheet, SheetContent } from '@/components/ui/sheet'
import { cn } from '@/lib/utils'
import type { Candidate, CandidateStage, TimelineEvent } from './recruitment-data'
import { mockTimeline, PIPELINE_STAGES } from './recruitment-data'

interface CandidateDetailPanelProps {
  candidate: Candidate | null
  onClose: () => void
  onViewProfile?: () => void
}

const stageOptions = PIPELINE_STAGES.map((s) => ({ label: s.label, value: s.id }))

const stageVariantMap: Record<CandidateStage, string> = {
  Applied: 'default',
  Screened: 'processing',
  Assessment: 'pending',
  Interview: 'processing',
  Offer: 'active',
  Hired: 'active',
  Rejected: 'error',
}

const timelineIconMap: Record<string, React.ElementType> = {
  stage_change: ArrowRight,
  interview: CalendarDays,
  assessment: CheckCircle2,
  note: MessageSquare,
  email: Mail,
}

export function CandidateDetailPanel({ candidate, onClose, onViewProfile }: CandidateDetailPanelProps) {
  const [activeTab, setActiveTab] = useState<'timeline' | 'interviews' | 'assessments' | 'offer' | 'notes'>('timeline')

  if (!candidate) return null

  const tabs = [
    { id: 'timeline' as const, label: 'Timeline' },
    { id: 'interviews' as const, label: 'Interviews' },
    { id: 'assessments' as const, label: 'Assessments' },
    { id: 'offer' as const, label: 'Offer' },
    { id: 'notes' as const, label: 'Notes' },
  ]

  const detailRows = [
    { label: 'Current Stage', value: candidate.stage, isStage: true },
    { label: 'Recruiter', value: candidate.recruiter },
    { label: 'Source', value: candidate.source },
    { label: 'Location', value: candidate.location },
    { label: 'Experience', value: candidate.experience },
    { label: 'Notice Period', value: candidate.noticePeriod },
    { label: 'Expected CTC', value: candidate.expectedCtc },
    { label: 'Resume', value: candidate.resume, isResume: true },
  ]

  return (
    <Sheet open={true} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-md p-0 flex flex-col h-full overflow-hidden">
        {/* Header */}
        <div className="flex items-start justify-between p-5 pb-4 border-b border-border/40">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-bold text-foreground">{candidate.name}</h3>
              <div className="size-2 rounded-full bg-success" title="Active" />
            </div>
            <p className="text-sm text-muted-foreground font-medium">{candidate.role}</p>
            <p className="text-xs text-muted-foreground">Applied on {candidate.appliedOn}</p>
          </div>
          {/* SheetContent has its own close button, but we can keep Maximize if we want. For now just removing the custom close button */}
          <div className="flex items-center gap-1 mr-6">
            <Button size="icon" variant="ghost" className="p-1.5 text-muted-foreground">
              <Maximize2 className="size-4" />
            </Button>
          </div>
        </div>

      {/* Quick Actions */}
      <div className="flex items-center justify-around px-5 py-3 border-b border-border/40">
        {[
          { icon: Mail, label: 'Email' },
          { icon: Phone, label: 'Call' },
          { icon: CalendarDays, label: 'Schedule' },
          { icon: MoreHorizontal, label: 'More' },
        ].map((action) => (
          <button key={action.label} className="flex flex-col items-center gap-1 text-muted-foreground hover:text-primary transition-colors cursor-pointer group">
            <div className="p-2 rounded-lg group-hover:bg-primary/5 transition-colors">
              <action.icon className="size-4" />
            </div>
            <span className="text-[10px] font-semibold">{action.label}</span>
          </button>
        ))}
      </div>

      {/* Details */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-5 space-y-3">
          {detailRows.map((row) => (
            <div key={row.label} className="flex items-center justify-between gap-4">
              <span className="text-xs font-semibold text-muted-foreground whitespace-nowrap">{row.label}</span>
              {'isStage' in row && row.isStage ? (
                <Select
                  value={candidate.stage}
                  onChange={() => {}}
                  options={stageOptions}
                  size="sm"
                  className="w-32"
                />
              ) : 'isResume' in row && row.isResume ? (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-primary font-medium truncate max-w-[160px]">{row.value as string}</span>
                  <button className="text-muted-foreground hover:text-primary transition-colors">
                    <Download className="size-3.5" />
                  </button>
                </div>
              ) : (
                <span className="text-sm text-foreground font-medium text-right truncate max-w-[180px]">{row.value as string}</span>
              )}
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="border-t border-border/40">
          <div className="flex gap-0 px-5">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  'px-3 py-2.5 text-xs font-semibold transition-colors border-b-2 whitespace-nowrap',
                  activeTab === tab.id
                    ? 'text-primary border-primary'
                    : 'text-muted-foreground border-transparent hover:text-foreground'
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Tab Content */}
        <div className="p-5">
          {activeTab === 'timeline' && (
            <div className="relative">
              <div className="absolute left-[11px] top-2 bottom-2 w-px bg-border/60" />
              <div className="flex flex-col gap-5">
                {mockTimeline.map((event) => {
                  const EventIcon = timelineIconMap[event.type] || Clock
                  return (
                    <div key={event.id} className="flex gap-3 relative">
                      <div className={cn(
                        'size-6 rounded-full flex items-center justify-center shrink-0 z-10 border',
                        event.type === 'stage_change' ? 'bg-primary/10 border-primary/30 text-primary' :
                        event.type === 'assessment' ? 'bg-success/10 border-success/30 text-success' :
                        'bg-muted border-border/60 text-muted-foreground'
                      )}>
                        <EventIcon className="size-3" />
                      </div>
                      <div className="flex flex-col gap-0.5 flex-1 min-w-0">
                        <span className="text-sm font-medium text-foreground">{event.title}</span>
                        <span className="text-xs text-muted-foreground">{event.description}</span>
                      </div>
                      <span className="text-[10px] font-medium text-muted-foreground whitespace-nowrap shrink-0 pt-0.5">{event.timestamp}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
          {activeTab === 'interviews' && (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <CalendarDays className="size-8 text-muted-foreground/40 mb-2" />
              <p className="text-sm text-muted-foreground font-medium">Interview details will appear here</p>
            </div>
          )}
          {activeTab === 'assessments' && (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <CheckCircle2 className="size-8 text-muted-foreground/40 mb-2" />
              <p className="text-sm text-muted-foreground font-medium">Assessment results will appear here</p>
            </div>
          )}
          {activeTab === 'offer' && (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <FileText className="size-8 text-muted-foreground/40 mb-2" />
              <p className="text-sm text-muted-foreground font-medium">Offer details will appear here</p>
            </div>
          )}
          {activeTab === 'notes' && (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <MessageSquare className="size-8 text-muted-foreground/40 mb-2" />
              <p className="text-sm text-muted-foreground font-medium">Notes will appear here</p>
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="p-4 border-t border-border/40">
        <Button className="w-full bg-background text-foreground border border-input shadow-sm hover:bg-muted font-bold py-5" onClick={onViewProfile}>
          View Full Profile
        </Button>
      </div>
      </SheetContent>
    </Sheet>
  )
}
