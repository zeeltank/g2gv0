'use client'

/**
 * COMPETENCY COMPOSER — Slice 1, item 2.
 *
 * Composes a competency as a NAMED BUNDLE OF KASBA ITEMS (Q-A2), writing to
 * `competency` + `competency_kasba_item` through /api/competency/definitions.
 *
 * TWO THINGS THIS SCREEN IS REQUIRED TO SHOW, and they are the ones a tidy UI
 * would quietly drop:
 *
 *  1. TARGET vs HOLDING, VISIBLE WHILE COMPOSING. Every row says whether it is
 *     resolved BY KEY or held BY LABEL. If the user cannot see it here, the
 *     coverage number surprises them later and they cannot tell why.
 *
 *  2. NO PICKER WITHOUT A LIST BEHIND IT. Only `skill` has a canonical table
 *     today. Knowledge, ability, attitude and behaviour have none, so those rows
 *     offer FREE TEXT, LABELLED AS SUCH - never an empty dropdown, which would
 *     imply a list that does not exist.
 */

import { useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { KeyRound, Tag, Plus, Trash2, AlertTriangle } from 'lucide-react'
import {
  KASBA_TYPES,
  isResolvable,
  type KasbaType,
  type CompetencyDefinitionInput,
} from '@/services/competency/definitions'

interface SkillOption {
  id: number
  title: string
}

interface DraftItem {
  kasba_type: KasbaType
  item_id: number | null
  item_label: string
  weight: number
}

const blankItem = (): DraftItem => ({
  kasba_type: 'skill',
  item_id: null,
  item_label: '',
  weight: 1,
})

export function CmCompetencyComposer({
  optionsByType,
  onSubmit,
  canCreate,
}: {
  /**
   * The caller's OWN tenant's items, per dimension. An id from anywhere else is
   * dropped to a label by the server, which validates each `item_id` against
   * that dimension's own table inside the caller's tenant.
   *
   * WAS `skills: SkillOption[]` - one list, because only `skill` was thought to
   * have a canonical table. All five do, and hold 14,474 rows between the four
   * that were called label-only.
   */
  optionsByType: Partial<Record<KasbaType, SkillOption[]>>
  /**
   * The tenant's frameworks, for filing this competency under one.
   *
   * OPTIONAL, AND THE PICKER IS HIDDEN WHEN THE LIST IS EMPTY. A tenant with no
   * frameworks should not be shown an empty dropdown asking them to choose from
   * nothing — that reads as a broken control rather than as "you have not created
   * any yet". Same reason the capability screens say `empty_is_expected`.
   *
   * `framework_id` is nullable end to end: a competency not filed under a
   * framework is a normal competency, not an incomplete one.
   */
  frameworks?: { id: number; name: string }[]
  onSubmit: (input: CompetencyDefinitionInput) => Promise<void>
  /** HR/Admin. The server enforces it regardless (profile:admin,hr). */
  canCreate: boolean
}) {
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [frameworkId, setFrameworkId] = useState<string>('')
  const [items, setItems] = useState<DraftItem[]>([blankItem()])
  const [busy, setBusy] = useState(false)

  const update = (i: number, patch: Partial<DraftItem>) =>
    setItems((prev) => prev.map((it, n) => (n === i ? { ...it, ...patch } : it)))

  const heldCount = useMemo(
    () => items.filter((i) => i.item_id === null).length,
    [items],
  )

  const canSubmit =
    canCreate &&
    name.trim() !== '' &&
    items.length > 0 &&
    // A row naming NEITHER an id nor a label names nothing. The server refuses
    // it too; this is the same rule stated where the user can act on it.
    items.every((i) => i.item_id !== null || i.item_label.trim() !== '')

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <label className="text-sm font-semibold">Competency name <span className="text-destructive">*</span></label>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Regulatory Compliance" />
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-semibold">Code</label>
          <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="optional" />
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold">KASBA items</p>
          <Button variant="outline" size="sm" onClick={() => setItems((p) => [...p, blankItem()])} className="gap-1.5">
            <Plus className="h-3.5 w-3.5" /> Add item
          </Button>
        </div>

        {items.map((item, i) => {
          const resolvable = isResolvable(item.kasba_type)
          const resolved = item.item_id !== null

          return (
            <div key={i} className="rounded-xl border border-border p-3 space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={item.kasba_type}
                  onChange={(e) => {
                    const kind = e.target.value as KasbaType
                    // Switching to a dimension with no canonical table drops any
                    // id: it could not have meant anything there.
                    update(i, { kasba_type: kind, item_id: isResolvable(kind) ? item.item_id : null })
                  }}
                  className="h-9 rounded-lg border border-border bg-background px-2 text-sm capitalize"
                >
                  {KASBA_TYPES.map((k) => (
                    <option key={k} value={k}>{k}</option>
                  ))}
                </select>

                {/* THE STATE, VISIBLE WHILE COMPOSING - not a hidden field. */}
                {resolved ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                    <KeyRound className="h-3 w-3" /> Resolved by key
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-xs font-semibold text-amber-700 dark:text-amber-400">
                    <Tag className="h-3 w-3" /> Held as label
                  </span>
                )}

                <div className="ml-auto flex items-center gap-2">
                  <label className="text-xs text-muted-foreground">Weight</label>
                  <Input
                    type="number" min={0} step="0.1" value={item.weight}
                    onChange={(e) => update(i, { weight: Number(e.target.value) })}
                    className="h-9 w-20"
                  />
                  {items.length > 1 && (
                    <Button variant="ghost" size="icon" onClick={() => setItems((p) => p.filter((_, n) => n !== i))}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>

              {resolvable ? (
                <select
                  value={item.item_id ?? ''}
                  onChange={(e) => update(i, { item_id: e.target.value === '' ? null : Number(e.target.value) })}
                  className="h-9 w-full rounded-lg border border-border bg-background px-2 text-sm"
                >
                  <option value="">— choose one, or leave blank and label it below —</option>
                  {(optionsByType[item.kasba_type] ?? []).map((s) => (
                    <option key={s.id} value={s.id}>{s.title}</option>
                  ))}
                </select>
              ) : (
                /* NO EMPTY DROPDOWN. Reached only if a dimension is added to the
                   type list without a table behind it - the server drops such an
                   id to a label rather than storing it unverified, and the UI
                   says so instead of offering a picker with nothing in it. */
                <p className="text-xs text-muted-foreground">
                  <span className="font-semibold capitalize">{item.kasba_type}</span> items have no
                  central list yet, so this is recorded as a <span className="font-semibold">label</span>.
                </p>
              )}

              <Input
                value={item.item_label}
                onChange={(e) => update(i, { item_label: e.target.value })}
                placeholder={resolved ? 'Optional note' : 'Describe the item — it will be held as a label'}
              />
            </div>
          )
        })}
      </div>

      {heldCount > 0 && (
        <div role="note" className="flex items-start gap-2 rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-2">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
          <p className="text-xs leading-relaxed text-amber-900 dark:text-amber-200">
            <span className="font-semibold">{heldCount} of {items.length} items will be held as labels.</span>{' '}
            They are saved and usable, but they are <span className="font-semibold">not linked by key</span>, so they
            count as unresolved in capability coverage until a central list exists for their dimension.
          </p>
        </div>
      )}

      <Button
        disabled={!canSubmit || busy}
        onClick={async () => {
          setBusy(true)
          try {
            await onSubmit({
              name: name.trim(),
              code: code.trim() || null,
              // null, not omitted. The server treats null as "not filed under a
              // framework" and verifies any id against the caller's OWN tenant -
              // a bare exists rule would have accepted another organisation's.
              framework_id: frameworkId ? Number(frameworkId) : null,
              items: items.map((i) => ({
                kasba_type: i.kasba_type,
                item_id: i.item_id,
                item_label: i.item_label.trim() || null,
                weight: i.weight,
              })),
            })
          } finally {
            setBusy(false)
          }
        }}
      >
        {busy ? 'Saving…' : 'Create competency'}
      </Button>

      {!canCreate && (
        <p className="text-xs text-muted-foreground">
          Only HR and administrators can create competencies.
        </p>
      )}
    </div>
  )
}
