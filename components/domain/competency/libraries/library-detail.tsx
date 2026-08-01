'use client'

import { useState } from 'react'
import { Briefcase, Copy, Edit2, ExternalLink, Layers, ListChecks, Lock, Trash2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { StatusBadge } from '@/components/ui/status-badge'
import { SheetTitle } from '@/components/ui/sheet'
import { cn } from '@/lib/utils'
import type {
  JobroleDetail,
  KasaTabId,
  LibraryRow,
  SkillDetail,
} from '@/services/competency'

import { type LibraryTabConfig } from './library-config'

/** Empty, null and whitespace all render as one em dash rather than a blank cell. */
export function dash(value: unknown): string {
  if (value === null || value === undefined) return '—'
  const text = String(value).trim()
  return text === '' ? '—' : text
}

export function formatDate(value: unknown): string {
  if (!value) return '—'
  const date = new Date(String(value).replace(' ', 'T'))
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

function isUrl(value: string) {
  return /^https?:\/\//i.test(value)
}

function Field({ label, value }: { label: string; value: unknown }) {
  const text = dash(value)
  return (
    <div className="space-y-1">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
      {isUrl(text) ? (
        <a
          href={text}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm text-primary hover:underline inline-flex items-center gap-1 break-all"
        >
          {text}
          <ExternalLink className="w-3 h-3 shrink-0" />
        </a>
      ) : (
        <p className="text-sm text-foreground whitespace-pre-line break-words">{text}</p>
      )}
    </div>
  )
}

function SubTable({
  headers,
  rows,
  empty,
}: {
  headers: string[]
  rows: (string | number | null | undefined)[][]
  empty: string
}) {
  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground py-4">{empty}</p>
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-border">
      <table className="w-full text-sm">
        <thead className="bg-muted/40">
          <tr>
            {headers.map((header) => (
              <th key={header} className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={index} className="border-t border-border">
              {row.map((cell, cellIndex) => (
                <td key={cellIndex} className="px-3 py-2 align-top text-foreground">
                  {dash(cell)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

const KASA_ORDER: KasaTabId[] = ['knowledge', 'ability', 'attitude', 'behaviour']

interface LibraryDetailProps {
  config: LibraryTabConfig
  row: LibraryRow
  detail: unknown
  detailLoading: boolean
  /** False for platform-curated rows this tenant may only read. */
  canEdit: boolean
  onEdit: () => void
  onDelete: () => void
  onClone?: () => void
  cloning?: boolean
}

/**
 * The side panel behind a row click: every column of the record, plus the
 * associations that make a skill or a job role meaningful (mapped roles,
 * proficiency levels, KASA classification, tasks).
 */
export function LibraryDetail({
  config,
  row,
  detail,
  detailLoading,
  canEdit,
  onEdit,
  onDelete,
  onClone,
  cloning,
}: LibraryDetailProps) {
  const hasAssociations = config.id === 'skill' || config.id === 'jobrole'
  const [tab, setTab] = useState<'overview' | 'associations'>('overview')

  const skillDetail = config.id === 'skill' ? (detail as SkillDetail | null) : null
  const jobroleDetail = config.id === 'jobrole' ? (detail as JobroleDetail | null) : null

  const title = String(row[config.titleKey] ?? 'Untitled')
  const category = config.categoryKey ? row[config.categoryKey] : null
  const status = (row.approve_status ?? row.status) as string | null | undefined

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="border-b border-border p-6 space-y-3">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 space-y-1">
            <SheetTitle className="text-xl font-bold text-foreground break-words">{title}</SheetTitle>
            <div className="flex flex-wrap items-center gap-2">
              {category ? (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/40 px-2.5 py-1 text-xs font-medium text-muted-foreground">
                  <Layers className="w-3 h-3" />
                  {String(category)}
                </span>
              ) : null}
              {status ? <StatusBadge status={String(status)} label={String(status)} /> : null}
              {!canEdit && (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/40 px-2.5 py-1 text-xs font-medium text-muted-foreground">
                  <Lock className="w-3 h-3" />
                  Shared entry
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 pt-1">
          {canEdit ? (
            <>
              <Button variant="outline" onClick={onEdit} className="h-9 rounded-lg font-semibold gap-2">
                <Edit2 className="w-4 h-4" /> Edit
              </Button>
              <Button
                variant="outline"
                onClick={onDelete}
                className="h-9 rounded-lg font-semibold gap-2 text-destructive border-destructive/30 hover:bg-destructive/10"
              >
                <Trash2 className="w-4 h-4" /> Delete
              </Button>
            </>
          ) : (
            <p className="text-xs text-muted-foreground">
              Maintained centrally for every organisation. Copy it to make an editable version.
            </p>
          )}
          {onClone && (
            <Button variant="outline" onClick={onClone} disabled={cloning} className="h-9 rounded-lg font-semibold gap-2">
              <Copy className="w-4 h-4" /> {cloning ? 'Copying…' : 'Duplicate'}
            </Button>
          )}
        </div>
      </div>

      {/* Tabs (only where there is something to associate) */}
      {hasAssociations && (
        <div className="flex gap-1 border-b border-border px-6">
          {(['overview', 'associations'] as const).map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              className={cn(
                'px-3 py-3 text-sm font-semibold border-b-2 -mb-px transition-colors capitalize',
                tab === key
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground',
              )}
            >
              {key === 'associations' ? (config.id === 'skill' ? 'Mappings' : 'Tasks & Skills') : 'Overview'}
            </button>
          ))}
        </div>
      )}

      {/* Body */}
      <div className="flex-1 overflow-y-auto g2g-scrollbar p-6 space-y-5">
        {(!hasAssociations || tab === 'overview') && (
          <>
            {config.fields
              .filter((field) => !field.hideInDetail)
              .map((field) => (
                <Field key={field.key} label={field.label} value={row[field.key]} />
              ))}
            <div className="grid grid-cols-2 gap-4 pt-2 border-t border-border">
              <Field label="Created" value={formatDate(row.created_at)} />
              <Field label="Last Updated" value={formatDate(row.updated_at)} />
            </div>
          </>
        )}

        {hasAssociations && tab === 'associations' && (
          <>
            {detailLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-5 w-40" />
                <Skeleton className="h-24 w-full" />
                <Skeleton className="h-24 w-full" />
              </div>
            ) : config.id === 'skill' ? (
              <>
                <section className="space-y-2">
                  <h4 className="flex items-center gap-2 text-sm font-bold text-foreground">
                    <Briefcase className="w-4 h-4 text-primary" />
                    Mapped Job Roles ({skillDetail?.jobroles.length ?? 0})
                  </h4>
                  <SubTable
                    headers={['Job Role', 'Required Level', 'Track']}
                    rows={(skillDetail?.jobroles ?? []).map((link) => [
                      link.jobrole,
                      link.proficiency_level,
                      link.track,
                    ])}
                    empty="This skill is not mapped to any job role yet."
                  />
                </section>

                <section className="space-y-2">
                  <h4 className="text-sm font-bold text-foreground">
                    Proficiency Levels ({skillDetail?.proficiency.length ?? 0})
                  </h4>
                  <SubTable
                    headers={['Level', 'Description', 'Type']}
                    rows={(skillDetail?.proficiency ?? []).map((level) => [
                      level.proficiency_level,
                      level.description,
                      level.proficiency_type,
                    ])}
                    empty="No proficiency scale has been defined for this skill."
                  />
                </section>

                {KASA_ORDER.map((kind) => {
                  const items = skillDetail?.classification?.[kind] ?? []
                  if (items.length === 0) return null
                  return (
                    <section key={kind} className="space-y-2">
                      <h4 className="text-sm font-bold text-foreground capitalize">
                        {kind} ({items.length})
                      </h4>
                      <SubTable
                        headers={['Item', 'Category', 'Level']}
                        rows={items.map((item) => [
                          item.classification_item,
                          item.classification_category,
                          item.proficiency_level,
                        ])}
                        empty=""
                      />
                    </section>
                  )
                })}

                {(skillDetail?.applications.length ?? 0) > 0 && (
                  <section className="space-y-2">
                    <h4 className="text-sm font-bold text-foreground">
                      Applications ({skillDetail?.applications.length})
                    </h4>
                    <SubTable
                      headers={['Application', 'Level']}
                      rows={(skillDetail?.applications ?? []).map((item) => [
                        item.application,
                        item.proficiency_level,
                      ])}
                      empty=""
                    />
                  </section>
                )}
              </>
            ) : (
              <>
                <section className="space-y-2">
                  <h4 className="flex items-center gap-2 text-sm font-bold text-foreground">
                    <ListChecks className="w-4 h-4 text-primary" />
                    Tasks ({jobroleDetail?.tasks.length ?? 0})
                  </h4>
                  <SubTable
                    headers={['Critical Work Function', 'Task', 'Type']}
                    rows={(jobroleDetail?.tasks ?? []).map((task) => [
                      task.critical_work_function,
                      task.task,
                      task.task_type,
                    ])}
                    empty="No tasks have been recorded for this role yet."
                  />
                </section>

                <section className="space-y-2">
                  <h4 className="text-sm font-bold text-foreground">
                    Required Skills ({jobroleDetail?.skills.length ?? 0})
                  </h4>
                  <SubTable
                    headers={['Skill', 'Required Level']}
                    rows={(jobroleDetail?.skills ?? []).map((skill) => [
                      skill.skill,
                      skill.proficiency_level,
                    ])}
                    empty="No skills are mapped to this role yet."
                  />
                </section>

                {/* The knowledge / ability / attitude / behaviour side of the
                    role, which the legacy job description screen listed. */}
                {KASA_ORDER.map((kind) => {
                  const items = jobroleDetail?.kasa?.[kind] ?? []
                  if (items.length === 0) return null
                  return (
                    <section key={kind} className="space-y-2">
                      <h4 className="text-sm font-bold capitalize text-foreground">
                        {kind} ({items.length})
                      </h4>
                      <SubTable
                        headers={['Title', 'Category', 'Sub Category']}
                        rows={items.map((item) => [item.title, item.category, item.sub_category])}
                        empty=""
                      />
                    </section>
                  )
                })}
              </>
            )}
          </>
        )}
      </div>
    </div>
  )
}
