'use client'

/**
 * THE COMPETENCY EDITOR — one component, two screens.
 *
 * Extracted from `cm-competency-library.tsx` so the employee drawer can open
 * the SAME editor the Competency Library uses, rather than growing a second
 * one beside it.
 *
 * ── WHY IT MUST NOT BE COPIED ───────────────────────────────────────────────
 *
 * Two of this form's rules live in how the SERVER writes, not in the markup,
 * and a second editor would have to re-implement both:
 *
 *   THE BUNDLE IS A REPLACE. `CompetencyLibraryCrudController::update` hard
 *   deletes `competency_kasba_item` rows and re-inserts (the table has no
 *   `deleted_at`), so the form must always send its COMPLETE item list. Send a
 *   partial one and the rest are silently gone.
 *
 *   A BLANK LEVEL DELETES ITS OVERRIDE. `writeLevels()` removes a row whose
 *   descriptor and indicators are both empty, returning that level to the
 *   organisation default. So all five rows are always sent, including the empty
 *   ones - that is what makes clearing a level possible at all.
 *
 * The copy that drifted from these would be the one nobody tested.
 */

import { useMemo, useState } from 'react'
import { ChevronDown } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import {
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import type {
  CompetencyLibraryItem,
  CompetencyLibraryPayload,
} from '@/services/competency/library'

export interface CompetencyFormProps {
  initial: CompetencyLibraryItem | null
  saving: boolean
  /**
   * The competency taxonomy: frameworks.
   *
   * This used to be `categories` / `subCategoriesOf` from the SKILL taxonomy -
   * `useTaxonomy('skill')`, i.e. `SELECT DISTINCT category FROM s_users_skills`.
   * A competency is not a skill and is not filed under one. The backend has
   * always known this ("a competency belongs to a FRAMEWORK, not a skill
   * taxonomy") and reads `category` back from the framework name, so the value
   * the user picked was silently thrown away on write.
   */
  frameworks: { id: number; name: string }[]
  /** Canonical library items per dimension, so an item resolves to an id. */
  itemOptionsByType: Record<string, { id: number; title: string }[]>
  departments: string[]
  onSubmit: (payload: CompetencyLibraryPayload) => Promise<{ ok: boolean; message: string }>
  onCancel: () => void
  onSaved: () => void
}

/** Free text that is long enough to want its own row in the form grid. */
const DETAIL_FIELDS: { key: keyof CompetencyLibraryPayload; label: string; help?: string; placeholder?: string }[] = [
  { key: 'bussiness_links', label: 'Business Link', placeholder: 'https://…' },
  { key: 'learning_resources', label: 'Learning Resources', placeholder: 'Courses, guides, internal material' },
  { key: 'assesment_method', label: 'Assessment Method', placeholder: 'e.g. Observation + MCQ' },
  { key: 'certification_qualifications', label: 'Certifications / Qualifications' },
  { key: 'experience_project', label: 'Experience / Projects' },
  { key: 'sop_practice_link', label: 'SOP / Practice Link' },
  { key: 'related_skills', label: 'Related Competencies', help: 'Comma separated.' },
  { key: 'custom_tags', label: 'Tags', help: 'Comma separated.' },
]

/**
 * Create / edit a competency.
 *
 * Carries the full column set. The five "Evidence & Resources" fields are what
 * the detail drawer's Attachments tab is built from - while they were only
 * editable on a separate screen, that tab could never show anything for a
 * competency created here.
 */
export function CompetencyForm({
  initial,
  saving,
  frameworks,
  itemOptionsByType,
  departments,
  onSubmit,
  onCancel,
  onSaved,
}: CompetencyFormProps) {
  const editing = Boolean(initial)

  // ── KASBA ITEMS — WHAT COMPETENCY DEFINITIONS USED TO OWN ────────────────
  // A competency is a BUNDLE OF CAPABILITY ITEMS across five dimensions, and
  // people are rated on the ITEMS, never on the competency itself. Without
  // these, creating from this screen produced a heading that measures nothing.
  //
  /*
   * EDITABLE NOW, AND RESOLVED BY ID.
   *
   * Two changes from what was here. First, this was create-only, so once a
   * competency existed its composition was frozen and there was no screen
   * anywhere that could correct it. Second, it captured only `item_label` -
   * free text - so nothing it wrote could ever be resolved to a library row.
   * That is why 66 of 266 items on live are still labels, and it is why the
   * employee drawer cannot rate Knowledge, Ability or Attitude: those items
   * have no id to rate against.
   *
   * `item_id` is now the target and `item_label` the fallback for something
   * genuinely not in the library yet. Neither is invented from the other -
   * the same rule the backend states.
   */
  const [items, setItems] = useState<{ kasba_type: string; item_id: string; item_label: string; weight: string }[]>(
    () =>
      (initial?.items ?? []).map((it: any) => ({
        kasba_type: String(it.kasba_type ?? 'knowledge'),
        item_id: it.item_id ? String(it.item_id) : '',
        item_label: String(it.item_label ?? ''),
        weight: String(it.weight ?? '1'),
      })),
  )
  /**
   * The dimensions this competency actually spans, read off its bundle.
   *
   * Replaces the "Type (KASA)" select. A competency is knowledge AND skill AND
   * ability as often as not, so the honest answer is a list derived from what
   * has been bundled — never a single value somebody had to pick.
   */
  const bundledDimensions = useMemo(() => {
    const seen = new Set<string>()
    for (const it of items) {
      const t = (it.kasba_type ?? '').trim()
      // A row with no library item and no label is a blank the author has not
      // filled in yet; counting it would claim a dimension they never chose.
      if (t && (it.item_id || it.item_label.trim())) seen.add(t)
    }
    return Array.from(seen).sort()
  }, [items])

  /**
   * THE COMPETENCY'S OWN L1-L5 SCALE.
   *
   * Always five rows in the editor, whether authored or not — the scale has
   * five levels regardless of how many somebody has bothered to describe. What
   * varies is whether a row overrides the organisation default or inherits it,
   * which `default_descriptor` carries so the field can show what it replaces.
   *
   * Seeded from `initial.levels`, which `show()` returns and `openEdit` has
   * already fetched. On create there is nothing to seed, so all five start
   * blank and inherit.
   */
  const [levels, setLevels] = useState<{ level: number; descriptor: string; indicators: string; default_descriptor: string | null }[]>(
    () => [1, 2, 3, 4, 5].map((level) => {
      const own = initial?.levels?.find((l) => l.level === level)
      return {
        level,
        descriptor: own?.descriptor ?? '',
        indicators: own?.indicators ?? '',
        default_descriptor: own?.default_descriptor ?? null,
      }
    }),
  )

  const [levelsOpen, setLevelsOpen] = useState(false)

  const setLevel = (level: number, key: 'descriptor' | 'indicators', value: string) =>
    setLevels((rows) => rows.map((r) => (r.level === level ? { ...r, [key]: value } : r)))

  /** How many levels this competency actually describes, for the section header. */
  const authoredLevelCount = levels.filter((l) => l.descriptor.trim() || l.indicators.trim()).length

  const addItem = () => setItems((x) => [...x, { kasba_type: 'knowledge', item_id: '', item_label: '', weight: '1' }])
  const setItem = (i: number, k: string, v: string) =>
    setItems((x) =>
      x.map((it, n) => {
        if (n !== i) return it
        const next = { ...it, [k]: v }
        // Switching dimension invalidates the chosen item - an id only means
        // something inside its own dimension's table.
        if (k === 'kasba_type') { next.item_id = ''; next.item_label = '' }
        // Picking a real item clears the free-text holding value, and vice versa.
        if (k === 'item_id' && v) next.item_label = ''
        return next
      }),
    )
  const removeItem = (i: number) => setItems((x) => x.filter((_, n) => n !== i))

  const [values, setValues] = useState<Record<string, string>>(() => ({
    name: initial?.name ?? '',
    framework_id: initial?.framework_id ? String(initial.framework_id) : '',
    competency_type: initial?.competency_type ?? '',
    department: initial?.department ?? '',
    proficiency_level: initial?.proficiency_level ?? '',
    status: initial?.approve_status?.trim() || 'Approved',
    description: initial?.description ?? '',
    ...Object.fromEntries(DETAIL_FIELDS.map((f) => [f.key, (initial?.[f.key as keyof CompetencyLibraryItem] as string) ?? ''])),
  }))
  const [showDetails, setShowDetails] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const set = (key: string, value: string) =>
    setValues((current) => {
      const next = { ...current, [key]: value }
      // A sub-category only means something under its parent.
      if (key === 'category') next.sub_category = ''
      return next
    })

  const withCurrent = (list: string[], current: string) =>
    current && !list.includes(current) ? [current, ...list] : list

  const frameworkOptions = [
    { label: 'No framework', value: '' },
    ...frameworks.map((f) => ({ label: f.name, value: String(f.id) })),
  ]
  const departmentOptions = [
    { label: 'Select department', value: '' },
    ...withCurrent(departments, values.department).map((d) => ({ label: d, value: d })),
  ]

  const handleSubmit = async () => {
    if (!values.name.trim()) {
      setError('Competency name is required.')
      return
    }
    setError(null)

    const text = (key: string) => values[key]?.trim() ?? ''
    const optional = (key: string) => (text(key) ? { [key]: text(key) } : {})

    // A row is an item if it names something - either a library row (item_id)
    // or, failing that, free text. A row with neither is a blank the user added
    // and abandoned; sending it would store an unnamed capability nobody can
    // rate.
    const filledItems = items
      .filter((it) => it.item_id.trim() !== '' || it.item_label.trim() !== '')
      .map((it) => ({
        kasba_type: it.kasba_type as 'knowledge' | 'ability' | 'skill' | 'behaviour' | 'attitude',
        ...(it.item_id.trim() ? { item_id: Number(it.item_id) } : {}),
        ...(it.item_label.trim() ? { item_label: it.item_label.trim() } : {}),
        weight: Number(it.weight) || 1,
      }))

    const payload: CompetencyLibraryPayload = {
      name: values.name.trim(),
      // Sent on edit too, now that update() syncs the composition. Omitting the
      // key leaves it untouched; sending it replaces it.
      ...(filledItems.length || editing ? { items: filledItems } : {}),
      /*
       * ALL FIVE ROWS ARE SENT, INCLUDING THE BLANK ONES — that is what makes
       * clearing work. The server deletes an override whose descriptor and
       * indicators are both blank, returning that level to the organisation
       * default. Sending only the filled rows would make a cleared level
       * indistinguishable from one nobody touched, so it could never be undone.
       */
      levels: levels.map((l) => ({
        level: l.level,
        descriptor: l.descriptor.trim(),
        indicators: l.indicators.trim(),
      })),
      // A competency is filed under a FRAMEWORK, which is its taxonomy. The
      // form used to send `category` from the SKILL taxonomy, which the backend
      // correctly discarded - so the field the user filled in went nowhere and
      // 209 of 226 competencies ended up with no framework at all.
      ...(values.framework_id ? { framework_id: Number(values.framework_id) } : {}),
      ...optional('department'),
      ...(values.competency_type ? { competency_type: values.competency_type } : {}),
      ...optional('description'),
      ...optional('proficiency_level'),
      // G-COMP-01: `status` is no longer sent. approve_status is server-owned -
      // the API ignores it, and sending a field the server discards is the
      // silent-data-loss pattern this audit exists to remove. Approval moves
      // through "Submit for Approval" and the approval queue.
      ...Object.fromEntries(
        DETAIL_FIELDS.map((f) => [f.key, text(f.key as string)]).filter(([, value]) => {
          // On edit send blanks too, so a field can be cleared.
          return editing || value !== ''
        }),
      ),
    }

    const result = await onSubmit(payload)
    if (result.ok) onSaved()
    else setError(result.message)
  }

  return (
    <>
      <DialogHeader className="p-6 pb-4 border-b border-primary/10 m-0">
        <DialogTitle className="text-xl font-bold text-foreground">
          {initial ? 'Edit Competency' : 'Create Competency'}
        </DialogTitle>
        <DialogDescription className="text-sm text-muted-foreground">
          {initial
            ? 'Update this competency. Evidence & resources feed the Attachments tab.'
            : 'Add a competency to the library. You can add its capability items after saving.'}
        </DialogDescription>
      </DialogHeader>

      <div className="p-6 flex flex-col gap-5 max-h-[65vh] overflow-y-auto g2g-scrollbar">
        <div className="space-y-2">
          <label className="text-sm font-semibold text-foreground">Competency Name<span className="text-destructive"> *</span></label>
          <Input value={values.name} onChange={(e) => set('name', e.target.value)} placeholder="Enter name" className="bg-background border-border" />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-semibold text-foreground">Framework</label>
          <Select
            value={values.framework_id}
            onChange={(v) => set('framework_id', v)}
            options={frameworkOptions}
            placeholder="Select framework"
            className="bg-background border-border h-9"
            aria-label="Framework"
          />
          <p className="text-xs text-muted-foreground">
            {frameworks.length === 0
              ? 'No frameworks yet — create one in Competency Studio. A competency filed under none will not appear in framework reporting.'
              : 'A competency is filed under a framework. This is its taxonomy — not the skill categories.'}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            {/*
              * DERIVED, NOT ASKED FOR.
              *
              * This was a "Type (KASA)" select offering the five KASBA
              * dimensions. A competency BUNDLES dimensions — measured on live,
              * 28 of 227 bundle two or three — so asking for one is a category
              * error. The bundle below already states them, one row per atom.
              *
              * The `competency_type` COLUMN is not a KASBA type either: it
              * holds a competency category (technical / clinical / functional /
              * leadership, plus 199 rows reading "migrated"). Existing values
              * are left untouched; the form simply stops overwriting a category
              * with a dimension.
              */}
            <label className="text-sm font-semibold text-foreground">Dimensions</label>
            <div className="flex h-9 items-center rounded-md border border-border bg-muted/30 px-3">
              {bundledDimensions.length === 0 ? (
                <span className="text-sm text-muted-foreground">Set by the KASBA items below</span>
              ) : (
                <span className="text-sm font-medium text-foreground truncate" title={bundledDimensions.join(' · ')}>
                  {bundledDimensions.join(' · ')}
                </span>
              )}
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-semibold text-foreground">Department</label>
            <Select value={values.department} onChange={(v) => set('department', v)} options={departmentOptions} placeholder="Select department" className="bg-background border-border h-9" aria-label="Department" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-sm font-semibold text-foreground">Proficiency Scale</label>
            <Input value={values.proficiency_level} onChange={(e) => set('proficiency_level', e.target.value)} placeholder="e.g. 1-5 Level Scale" className="bg-background border-border" />
          </div>
          {/*
            G-COMP-01: the Status dropdown was removed. It wrote straight to
            approve_status with no reviewer, which bypassed the whole approval
            workflow from an edit form. The server now owns that field, so
            leaving the control would show a dropdown that silently does
            nothing. Approval moves through Submit for Approval and the
            approval queue.
          */}
        </div>

        <div className="space-y-2">
          <label className="text-sm font-semibold text-foreground">Description</label>
          <textarea
            value={values.description}
            onChange={(e) => set('description', e.target.value)}
            className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary min-h-[90px] resize-none"
            placeholder="Enter description..."
          />
        </div>

        {/* Collapsed by default: eight optional fields would otherwise bury the
            five that identify the competency. */}
        <div className="rounded-xl border border-border">
          <button
            type="button"
            onClick={() => setShowDetails((open) => !open)}
            aria-expanded={showDetails}
            className="flex w-full items-center justify-between px-4 py-3 text-left"
          >
            <span>
              <span className="block text-sm font-semibold text-foreground">Evidence &amp; Resources</span>
              <span className="block text-xs text-muted-foreground">
                Learning material, assessment method, certifications — these fill the Attachments tab.
              </span>
            </span>
            <ChevronDown className={cn('w-4 h-4 text-muted-foreground transition-transform', showDetails && 'rotate-180')} />
          </button>

          {showDetails && (
            <div className="grid grid-cols-1 gap-4 border-t border-border p-4 md:grid-cols-2">
              {DETAIL_FIELDS.map((field) => (
                <div key={field.key} className="space-y-2">
                  <label className="text-sm font-semibold text-foreground">{field.label}</label>
                  <Input
                    value={values[field.key as string] ?? ''}
                    onChange={(e) => set(field.key as string, e.target.value)}
                    placeholder={field.placeholder}
                    className="bg-background border-border"
                  />
                  {field.help && <p className="text-xs text-muted-foreground">{field.help}</p>}
                </div>
              ))}
            </div>
          )}
        </div>

        {(
          <div className="space-y-3 rounded-lg border border-border bg-surface-muted/40 p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h4 className="text-sm font-semibold text-foreground">Capability items</h4>
                <p className="mt-1 text-xs text-muted-foreground">
                  What this competency is made of. People are rated on these, not on the competency
                  itself — so a competency with none cannot be measured.
                </p>
              </div>
              <Button variant="outline" onClick={addItem} className="h-8 shrink-0 px-3 text-xs font-semibold">
                Add item
              </Button>
            </div>

            {items.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                None yet. You can save without them and add them later, but this competency will not
                be measurable until you do.
              </p>
            ) : (
              <div className="flex flex-col gap-2">
                {items.map((it, i) => (
                  <div key={i} className="flex flex-wrap items-end gap-2">
                    <Select
                      value={it.kasba_type}
                      onChange={(v) => setItem(i, 'kasba_type', v)}
                      options={[
                        { label: 'Knowledge', value: 'knowledge' },
                        { label: 'Ability', value: 'ability' },
                        { label: 'Skill', value: 'skill' },
                        { label: 'Behaviour', value: 'behaviour' },
                        { label: 'Attitude', value: 'attitude' },
                      ]}
                      className="h-9 w-36 bg-background"
                      aria-label="Dimension"
                    />
                    {/*
                      * Pick the real library row. This was a free-text box, so
                      * everything it wrote landed as item_label with a NULL
                      * item_id - unresolvable, and unratable in the employee
                      * drawer. The text box survives below only for something
                      * genuinely not in the library yet.
                      */}
                    <Select
                      value={it.item_id}
                      onChange={(v) => setItem(i, 'item_id', v)}
                      options={[
                        { label: 'Not in the library yet…', value: '' },
                        ...(itemOptionsByType[it.kasba_type] ?? []).map((o) => ({
                          label: o.title,
                          value: String(o.id),
                        })),
                      ]}
                      placeholder="Choose an item"
                      className="h-9 min-w-[16rem] flex-1 bg-background"
                      aria-label="Library item"
                    />
                    {!it.item_id && (
                      <Input
                        value={it.item_label}
                        onChange={(e) => setItem(i, 'item_label', e.target.value)}
                        placeholder="Name it as free text (cannot be rated until mapped)"
                        className="h-9 min-w-[14rem] flex-1 bg-background"
                        aria-label="Item label"
                      />
                    )}
                    <Input
                      value={it.weight}
                      onChange={(e) => setItem(i, 'weight', e.target.value)}
                      placeholder="Weight"
                      className="h-9 w-20 bg-background"
                      aria-label="Weight"
                    />
                    <Button variant="outline" onClick={() => removeItem(i)} className="h-9 px-3 text-xs">
                      Remove
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* PROFICIENCY SCALE — collapsed by default.
            Five long fields expanded would bury the four things that actually
            create a competency: name, framework, dimensions, bundle. */}
        <div className="rounded-xl border border-border bg-background/50 p-4 space-y-3">
          <button
            type="button"
            onClick={() => setLevelsOpen((v) => !v)}
            className="flex w-full items-center justify-between gap-3 text-left"
          >
            <div className="min-w-0">
              <p className="text-sm font-semibold text-foreground">Proficiency Scale</p>
              <p className="text-xs text-muted-foreground">
                {authoredLevelCount === 0
                  ? 'Using the organisation default for all five levels.'
                  : `${authoredLevelCount} of 5 levels described for this competency.`}
              </p>
            </div>
            <span className="text-xs font-semibold text-primary shrink-0">
              {levelsOpen ? 'Hide' : 'Edit'}
            </span>
          </button>

          {levelsOpen && (
            <div className="space-y-3 pt-1">
              <p className="text-xs text-muted-foreground">
                What each level means <span className="font-semibold text-foreground">for this competency</span>.
                Leave a level blank to keep the organisation default — clearing a description restores it.
              </p>

              {levels.map((l) => {
                const authored = Boolean(l.descriptor.trim() || l.indicators.trim())
                return (
                  <div key={l.level} className="rounded-lg border border-border bg-background p-3 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-bold text-foreground">Level {l.level}</span>
                      <span className="text-[10px] font-semibold text-muted-foreground">
                        {authored ? 'Described here' : 'Inherited'}
                      </span>
                    </div>

                    <Input
                      value={l.descriptor}
                      onChange={(e) => setLevel(l.level, 'descriptor', e.target.value)}
                      placeholder={l.default_descriptor ?? 'What someone at this level can do'}
                      className="bg-background border-border text-sm"
                      aria-label={`Level ${l.level} descriptor`}
                    />

                    {/* The inherited text shown in full, not just as a
                        placeholder that vanishes the moment you type. */}
                    {!authored && l.default_descriptor && (
                      <p className="text-[11px] leading-relaxed text-muted-foreground">
                        Inherits: {l.default_descriptor}
                      </p>
                    )}

                    <Input
                      value={l.indicators}
                      onChange={(e) => setLevel(l.level, 'indicators', e.target.value)}
                      placeholder="Observable indicators (optional)"
                      className="bg-background border-border text-sm"
                      aria-label={`Level ${l.level} indicators`}
                    />
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {error && <p className="text-sm font-medium text-destructive">{error}</p>}
      </div>

      <DialogFooter className="p-6 pt-4 border-t border-primary/5 bg-muted/10 m-0">
        <Button variant="outline" onClick={onCancel} disabled={saving} className="h-9 px-6 rounded-lg font-bold border-border bg-background">
          Cancel
        </Button>
        <Button onClick={handleSubmit} disabled={saving} className="h-9 px-6 rounded-lg font-bold bg-primary text-primary-foreground hover:bg-primary/90">
          {saving ? 'Saving…' : initial ? 'Save Changes' : 'Create'}
        </Button>
      </DialogFooter>
    </>
  )
}
