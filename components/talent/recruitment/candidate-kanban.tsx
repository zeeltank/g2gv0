'use client'

import React from 'react'
import { Star, MoreVertical, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { Candidate, CandidateStage } from './recruitment-data'

interface CandidateCardProps {
  candidate: Candidate
  onClick: (candidate: Candidate) => void
}

export function CandidateCard({ candidate, onClick }: CandidateCardProps) {
  return (
    <div
      onClick={() => onClick(candidate)}
      className="group flex flex-col gap-2 rounded-lg border border-border/60 bg-card p-3 shadow-sm cursor-pointer transition-all duration-200 hover:shadow-md hover:border-primary/30 hover:-translate-y-0.5"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-col gap-0.5 min-w-0">
          <span className="text-sm font-semibold text-foreground truncate">{candidate.name}</span>
          <span className="text-xs text-muted-foreground truncate">{candidate.role}</span>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {candidate.starred && <Star className="size-3.5 text-warning fill-warning" />}
          <Button
            size="icon"
            variant="ghost"
            className="p-0.5 size-6 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={(e) => { e.stopPropagation() }}
          >
            <MoreVertical className="size-3.5" />
          </Button>
        </div>
      </div>
      <span className="text-[11px] text-muted-foreground">{candidate.lastUpdated}</span>
    </div>
  )
}

interface KanbanColumnProps {
  stage: { id: CandidateStage; label: string; color: string }
  candidates: Candidate[]
  count: number
  onCandidateClick: (candidate: Candidate) => void
}

export function KanbanColumn({ stage, candidates, count, onCandidateClick }: KanbanColumnProps) {
  return (
    <div className="flex flex-col min-w-[200px] w-[200px] shrink-0">
      {/* Column header */}
      <div className="flex items-center gap-2 mb-3 px-1">
        <div className={cn('size-2 rounded-full', stage.color.replace('/20', '').replace('/30', ''))} />
        <span className="text-sm font-semibold text-foreground">{stage.label}</span>
        <span className="text-xs font-bold text-muted-foreground ml-auto tabular-nums">{count}</span>
      </div>
      {/* Column body */}
      <div className="flex flex-col gap-2 flex-1 overflow-y-auto max-h-[400px] pr-1 scrollbar-thin">
        {candidates.slice(0, 5).map((candidate) => (
          <CandidateCard
            key={candidate.id}
            candidate={candidate}
            onClick={onCandidateClick}
          />
        ))}
        {candidates.length === 0 && (
          <div className="flex items-center justify-center h-20 rounded-lg border border-dashed border-border/60 text-xs text-muted-foreground">
            No candidates
          </div>
        )}
      </div>
      {/* Add candidate button */}
      <Button variant="ghost" size="sm" className="flex items-center gap-1.5 mt-2 px-2 py-1.5 text-xs text-muted-foreground font-medium hover:text-primary hover:bg-primary/5 h-auto">
        <Plus className="size-3.5" /> Add Candidate
      </Button>
    </div>
  )
}
