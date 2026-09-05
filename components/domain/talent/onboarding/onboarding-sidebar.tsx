'use client'

/**
 * The right-hand column of the Onboarding & Employee Lifecycle Center: the
 * selected hire's profile, their requested documents, their key contacts and
 * the notes on them.
 *
 * Everything here belongs to ONE journey. When no journey is selected the cards
 * prompt for one instead of rendering placeholder data.
 */

import * as React from 'react'
import { Edit2, ExternalLink, FileText, Mail, Plus, UserPlus } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { StatusBadge } from '@/components/ui/status-badge'
import { cn } from '@/lib/utils'
import { Initials, documentStatusVariant, journeyStageVariant } from './onboarding-shared'
import type { OnbContact, OnbDocument, OnbJourney, OnbNote } from '@/services/talent/onboarding'

export function OnboardingSidebar({
  journey,
  documents,
  contacts,
  notes,
  loading,
  error,
  onRetry,
  onPickJourney,
  onEditJourney,
  onViewEmployee,
  onOpenDocuments,
  onOpenContacts,
  onOpenNotes,
}: {
  journey: OnbJourney | null
  documents: OnbDocument[]
  contacts: OnbContact[]
  notes: OnbNote[]
  loading: boolean
  error: string | null
  onRetry: () => void
  onPickJourney: () => void
  onEditJourney: () => void
  onViewEmployee: () => void
  onOpenDocuments: () => void
  onOpenContacts: () => void
  onOpenNotes: () => void
}) {
  if (loading) {
    return (
      <div className="flex flex-col gap-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <Card key={index} className="shadow-sm">
            <CardContent className="flex flex-col gap-3 p-5">
              <Skeleton className="h-14 w-full" />
              <Skeleton className="h-3 w-2/3" />
              <Skeleton className="h-3 w-1/2" />
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  if (error) {
    return (
      <Card className="border-destructive/30 bg-destructive/5 shadow-sm">
        <CardContent className="flex flex-col items-center gap-2 p-6 text-center">
          <p className="text-sm font-semibold text-destructive">Could not load this hire</p>
          <p className="text-xs text-muted-foreground">{error}</p>
          <Button variant="outline" size="sm" onClick={onRetry}>
            Retry
          </Button>
        </CardContent>
      </Card>
    )
  }

  if (!journey) {
    return (
      <Card className="shadow-sm">
        <CardContent className="flex flex-col items-center gap-3 p-8 text-center">
          <UserPlus className="size-8 text-muted-foreground/40" />
          <p className="text-sm font-semibold text-foreground">No hire selected</p>
          <p className="text-xs text-muted-foreground">
            Choose an onboarding journey to see their profile, documents and contacts.
          </p>
          {/* The card explains what this panel is for; the CONTROL is not repeated
              here. Browse and New live once above the tabs and once in the header
              dropdown, and a third copy in the sidebar is the duplication that
              made every tab of this screen look like a different form. */}
        </CardContent>
      </Card>
    )
  }

  return (
    <>
      {/* Profile */}
      <Card className="shadow-sm">
        <CardContent className="flex flex-col gap-4 p-5">
          <div className="flex items-start gap-4">
            <Initials value={journey.initials} className="size-16 text-xl" />
            <div className="flex flex-col items-start gap-1.5 pt-1">
              <h3 className="text-base font-bold text-foreground">{journey.name}</h3>
              <StatusBadge variant={journeyStageVariant(journey.stage)} size="sm">
                {journey.stage_label}
              </StatusBadge>
            </div>
          </div>

          <div className="flex flex-col gap-1.5 pt-2 text-xs text-muted-foreground">
            <span className="text-sm font-semibold text-foreground">{journey.position ?? 'Position not set'}</span>
            <span>
              {[journey.department, journey.location].filter(Boolean).join(' • ') || 'Department not set'}
            </span>
            <span>
              DOJ: {journey.joining_date_label ?? 'Not set'} • {journey.journey_code}
            </span>
            {journey.email && (
              <a href={`mailto:${journey.email}`} className="text-primary hover:underline">
                {journey.email}
              </a>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={onEditJourney}
              className="flex w-fit items-center gap-1 text-xs font-semibold text-primary hover:underline"
            >
              Edit journey <Edit2 className="size-3" />
            </button>
            {journey.employee_id && (
              <button
                type="button"
                onClick={onViewEmployee}
                className="flex w-fit items-center gap-1 text-xs font-semibold text-primary hover:underline"
              >
                View Employee Profile <ExternalLink className="size-3" />
              </button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Documents */}
      <Card className="flex flex-1 flex-col shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 p-4 pb-2">
          <CardTitle className="text-sm">Documents</CardTitle>
          <button
            type="button"
            onClick={onOpenDocuments}
            className="text-xs font-semibold text-primary hover:underline"
          >
            View all
          </button>
        </CardHeader>
        <CardContent className="flex flex-1 flex-col gap-3 p-4 pt-2">
          {documents.length === 0 && (
            <div className="flex flex-col items-center gap-2 py-4 text-center">
              <FileText className="size-5 text-muted-foreground/30" />
              <span className="text-xs text-muted-foreground">No documents requested yet.</span>
              <Button variant="ghost" size="sm" className="h-auto p-0 text-xs text-primary" onClick={onOpenDocuments}>
                Request one
              </Button>
            </div>
          )}

          {documents.slice(0, 5).map((document) => (
            <div key={document.id} className="flex items-center justify-between gap-2">
              <div className="flex min-w-0 items-center gap-2">
                <FileText className="size-3.5 shrink-0 text-muted-foreground" />
                {document.url ? (
                  <a
                    href={document.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="truncate text-xs font-medium text-foreground hover:underline"
                  >
                    {document.file_name ?? document.title}
                  </a>
                ) : (
                  <span className="truncate text-xs font-medium text-foreground">{document.title}</span>
                )}
              </div>
              <StatusBadge variant={documentStatusVariant(document.status)} size="sm" className="shrink-0">
                {document.status_label}
              </StatusBadge>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Key Contacts */}
      <Card className="flex flex-1 flex-col shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 p-4 pb-2">
          <CardTitle className="text-sm">Key Contacts</CardTitle>
          <button
            type="button"
            onClick={onOpenContacts}
            className="text-xs font-semibold text-primary hover:underline"
          >
            View all
          </button>
        </CardHeader>
        <CardContent className="flex flex-1 flex-col gap-4 p-4 pt-2">
          {contacts.length === 0 && (
            <div className="flex flex-col items-center gap-2 py-4 text-center">
              <span className="text-xs text-muted-foreground">No manager or buddy assigned.</span>
              <Button variant="ghost" size="sm" className="h-auto p-0 text-xs text-primary" onClick={onEditJourney}>
                Assign one
              </Button>
            </div>
          )}

          {contacts.map((contact) => (
            <div key={contact.id} className="flex items-start justify-between gap-2">
              <div className="flex min-w-0 flex-col gap-0.5">
                <span className="text-[10px] font-medium text-muted-foreground">{contact.role}</span>
                <span className="truncate text-xs font-semibold text-foreground">{contact.name}</span>
                {contact.email && (
                  <a
                    href={`mailto:${contact.email}`}
                    className="truncate text-[10px] text-primary hover:underline"
                  >
                    {contact.email}
                  </a>
                )}
              </div>
              <Button
                size="icon"
                variant="ghost"
                className={cn('h-auto p-1.5', !contact.email && 'pointer-events-none opacity-40')}
                asChild={Boolean(contact.email)}
                aria-label={`Email ${contact.name}`}
              >
                {contact.email ? (
                  <a href={`mailto:${contact.email}`}>
                    <Mail className="size-3.5" />
                  </a>
                ) : (
                  <Mail className="size-3.5" />
                )}
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Notes */}
      <Card className="flex flex-1 flex-col shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 p-4 pb-2">
          <CardTitle className="text-sm">Notes</CardTitle>
          <Button
            variant="ghost"
            size="sm"
            className="flex h-auto items-center gap-1 p-0 text-xs font-semibold text-primary hover:underline"
            onClick={onOpenNotes}
          >
            <Plus className="size-3" /> Add Note
          </Button>
        </CardHeader>
        <CardContent className="flex flex-1 flex-col gap-3 rounded-b-lg p-4 pt-2">
          {notes.length === 0 && (
            <div className="flex min-h-[100px] flex-1 flex-col items-center justify-center gap-2 rounded-lg bg-muted/10 text-center">
              <Edit2 className="size-6 text-muted-foreground/30" />
              <span className="text-xs text-muted-foreground">No notes added yet.</span>
            </div>
          )}

          {notes.slice(0, 3).map((note) => (
            <button
              key={note.id}
              type="button"
              onClick={onOpenNotes}
              className="flex flex-col gap-1 rounded-lg border border-border/50 p-2 text-left hover:bg-muted/30"
            >
              <span className="line-clamp-2 text-xs text-foreground">{note.note}</span>
              <span className="text-[10px] text-muted-foreground">
                {note.author_name} · {note.created_label}
              </span>
            </button>
          ))}

          {notes.length > 3 && (
            <button
              type="button"
              onClick={onOpenNotes}
              className="text-xs font-semibold text-primary hover:underline"
            >
              View all {notes.length} notes
            </button>
          )}
        </CardContent>
      </Card>
    </>
  )
}
