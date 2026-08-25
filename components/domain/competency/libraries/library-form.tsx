'use client'

import { useEffect, useMemo, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import {
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import type { LibraryMeta, LibraryPayload, LibraryRow } from '@/services/competency'

import { FORM_KEY_OVERRIDES, type LibraryFieldDef, type LibraryTabConfig } from './library-config'
import { useAuth } from '@/hooks/use-auth'
import { getLaravelContext } from '@/lib/laravel-context'
import { competencyLibraryService } from '@/services/competency/library'
import { roleRequirementsService } from '@/services/competency/role-requirements'
import { RoleCompetencyInlinePanel } from '@/domain/competency/role-competency-inline-panel'
import { SearchableSelect } from '@/components/ui/searchable-select'

interface LibraryFormProps {
  config: LibraryTabConfig
  /** null when creating. */
  initial: LibraryRow | null
  saving: boolean
  categories: string[]
  subCategoriesOf: (category: string) => string[]
  /** The tenant's live vocabularies, so departments and roles are picked not typed. */
  meta: LibraryMeta
  onSubmit: (payload: LibraryPayload) => Promise<{ ok: boolean; message: string; createdId?: number | null }>
  onCancel: () => void
  onSaved: () => void
}

/** Sentinel option that switches the picker into "type a new one" mode. */
const ADD_NEW = '__add_new__'

/** "29 departments in this organisation." — plural handling included. */
function countLabel(count: number, label: string): string {
  const noun = label.toLowerCase()
  if (count === 0) return `No ${noun} recorded for this organisation yet.`
  if (count === 1) return `1 ${noun} in this organisation.`
  return `${count} ${noun}s in this organisation.`
}

/**
 * A dropdown of what already exists, plus an explicit way to add something new.
 *
 * A plain text box - even one with autocomplete - never tells you what the
 * organisation already has, so the same department gets typed three different
 * ways. A plain dropdown shows you everything but then blocks the first
 * department that does not exist yet. This does both: the list is visible and
 * countable, and "Add a new one" is a deliberate choice rather than the
 * accidental default.
 */
function OpenChoice({
  id,
  label,
  value,
  options,
  placeholder,
  onChange,
}: {
  id: string
  label: string
  value: string
  options: string[]
  placeholder?: string
  onChange: (value: string) => void
}) {
  // A saved value that is no longer in the list still has to be editable, so
  // it opens in text mode rather than silently resetting to blank.
  const [typing, setTyping] = useState(() => Boolean(value) && !options.includes(value))

  if (typing) {
    return (
      <div className="space-y-1.5">
        <Input
          id={id}
          value={value}
          autoFocus
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder ?? `New ${label.toLowerCase()}`}
          className="bg-background border-border"
        />
        <button
          type="button"
          onClick={() => { setTyping(false); onChange('') }}
          className="text-xs font-medium text-primary hover:underline"
        >
          ← Choose from the existing {label.toLowerCase()} list
        </button>
      </div>
    )
  }

  return (
    <Select
      id={id}
      value={value}
      onChange={(next) => {
        if (next === ADD_NEW) { setTyping(true); onChange('') }
        else onChange(next)
      }}
      options={[
        { label: options.length ? `Select ${label.toLowerCase()}` : `No ${label.toLowerCase()} yet — add the first one`, value: '' },
        ...options.map((option) => ({ label: option, value: option })),
        { label: `+ Add a new ${label.toLowerCase()}…`, value: ADD_NEW },
      ]}
      className="bg-background border-border h-9"
      aria-label={label}
    />
  )
}

/** Every distinct value a `source` field should offer, from real tenant data. */
function sourceValues(
  meta: LibraryMeta,
  source: NonNullable<LibraryFieldDef['source']>,
  dependsOnValue?: string,
): string[] {
  if (source === 'departments') {
    // Two places record a department: the skills library and the role
    // catalogue. Offering the union is what stops the same department being
    // re-typed slightly differently depending on which tab you started from.
    const set = new Set(meta.departments.filter(Boolean))
    Object.keys(meta.jobroles_by_department).forEach((name) => set.add(name))
    return Array.from(set).sort()
  }
  if (source === 'jobroles') {
    /*
     * NARROWED TO ONE DEPARTMENT WHEN THE FORM HAS PICKED ONE.
     *
     * `jobroles_by_department` is already grouped - flattening it
     * unconditionally is what made the task form's role dropdown list every
     * role in the organisation, thousands of them on a large tenant, with no
     * way to tell two namesakes in different departments apart.
     */
    const groups = dependsOnValue
      ? { [dependsOnValue]: meta.jobroles_by_department[dependsOnValue] ?? [] }
      : meta.jobroles_by_department

    const set = new Set(
      Object.values(groups).flat().map((role) => role.jobrole).filter(Boolean),
    )
    return Array.from(set).sort()
  }
  return [...(meta[source] ?? [])].filter(Boolean).sort()
}

/**
 * The department a role sits in, found by name.
 *
 * Used when EDITING a task: the task itself stores no department (it does not
 * need one - the department is reachable through `jobrole_id`), so the filter
 * would open empty and show every role. This recovers it from the role that is
 * already selected, so an edit opens on the right department.
 *
 * Returns '' when the name is ambiguous across departments, which leaves the
 * filter open rather than guessing a department the task may not belong to.
 */
function departmentOfRole(meta: LibraryMeta, roleName: string): string {
  const wanted = roleName.trim().toLowerCase()
  if (!wanted) return ''

  const owners = Object.entries(meta.jobroles_by_department)
    .filter(([, roles]) => roles.some((r) => String(r.jobrole ?? '').trim().toLowerCase() === wanted))
    .map(([department]) => department)

  return owners.length === 1 ? owners[0] : ''
}

function initialValues(
  config: LibraryTabConfig,
  initial: LibraryRow | null,
  meta: LibraryMeta,
): Record<string, string> {
  const values: Record<string, string> = {}
  for (const field of config.fields) {
    const raw = initial?.[field.key]
    values[field.key] = raw === null || raw === undefined ? '' : String(raw)
  }

  /*
   * RECOVER A PARENT THAT THE ROW DOES NOT STORE.
   *
   * A task records its job role but NOT its department - and correctly so, since
   * the department is reachable through `jobrole_id`. But that means editing a
   * task would open with an empty Department filter and therefore every role in
   * the organisation listed beneath it, which is the exact problem the filter
   * exists to solve.
   *
   * `departmentOfRole` returns '' when the role name is ambiguous across
   * departments, which leaves the filter open rather than asserting a
   * department the task may not belong to.
   */
  for (const field of config.fields) {
    if (!field.dependsOn || values[field.dependsOn]) continue
    if (field.source === 'jobroles' && values[field.key]) {
      values[field.dependsOn] = departmentOfRole(meta, values[field.key])
    }
  }

  return values
}

/**
 * Create / edit form for any library tab.
 *
 * The field list comes from the tab config, so all eight tabs share one form
 * and a new column is one config entry rather than a new screen.
 */
export function LibraryForm({
  config,
  initial,
  saving,
  categories,
  subCategoriesOf,
  meta,
  onSubmit,
  onCancel,
  onSaved,
}: LibraryFormProps) {
  const { user } = useAuth()
  const [values, setValues] = useState<Record<string, string>>(() => initialValues(config, initial, meta))
  const [error, setError] = useState<string | null>(null)
  // JOB ROLE TAB ONLY. role_map keys on jobrole_id, so a role that does not
  // exist yet has nothing to map against: the picks are held here and written
  // straight after the role is created. Editing an existing role uses the live
  // panel instead.
  const [pickedComps, setPickedComps] = useState<number[]>([])
  const [roleLibrary, setRoleLibrary] = useState<{ id: number; name: string }[]>([])
  // AN EMPTY LIST AND A FAILED REQUEST ARE NOT THE SAME FACT. Swallowing the
  // error rendered "No competencies available" for a 401, a 403 and a genuinely
  // empty tenant alike, which sends you looking in the wrong place.
  const [roleLibraryError, setRoleLibraryError] = useState<string | null>(null)
  // Editing opens expanded: the value being changed is often one of the
  // specialised columns, and hiding it would look like data loss.
  const [showAdvanced, setShowAdvanced] = useState(() => Boolean(initial))

  const editing = Boolean(initial)
  const isJobRole = config.id === 'jobrole'

  useEffect(() => {
    if (!isJobRole || editing) return
    void competencyLibraryService
      .list(getLaravelContext(user))
      .then((res) => {
        setRoleLibrary((res.data ?? []).map((c) => ({ id: c.id, name: c.name })))
        setRoleLibraryError(null)
      })
      .catch((e: unknown) => {
        setRoleLibrary([])
        setRoleLibraryError(e instanceof Error ? e.message : 'Could not load the competency library.')
      })
  }, [isJobRole, editing, user])
  const editable = useMemo(() => config.fields.filter((field) => !field.readOnly), [config])
  const essentials = useMemo(() => editable.filter((field) => !field.advanced), [editable])
  const advanced = useMemo(() => editable.filter((field) => field.advanced), [editable])

  const categoryValue = config.categoryKey ? values[config.categoryKey] ?? '' : ''

  /**
   * The job role id behind a chosen role name, when there is exactly one.
   *
   * `meta.jobroles_by_department` carries `{ id, jobrole }`, so the browser has
   * had the id all along - `sourceValues` just flattens it to a name list and
   * throws it away. Sending the id is what stops a task detaching when its role
   * is renamed.
   *
   * Ambiguity is HELD, not guessed: 91 (tenant, role name) groups on live cover
   * 220 rows - "Vice President" exists eleven times in one organisation - so a
   * name can genuinely mean two roles. Returning null there lets the server
   * store the name with a NULL id rather than picking one at random, which is
   * the same rule its department resolver follows.
   */
  const resolveJobroleId = (name: string): string | null => {
    const wanted = name.trim().toLowerCase()
    if (!wanted) return null

    const matches = Object.values(meta.jobroles_by_department)
      .flat()
      .filter((role) => String(role.jobrole ?? '').trim().toLowerCase() === wanted)

    return matches.length === 1 ? String(matches[0].id) : null
  }

  const set = (key: string, value: string) => {
    setValues((current) => {
      const next = { ...current, [key]: value }
      // A sub-category only means something under its parent, so changing the
      // category clears it rather than leaving an orphaned pair.
      if (config.categoryKey && key === config.categoryKey && config.subCategoryKey) {
        next[config.subCategoryKey] = ''
      }
      /*
       * Changing a parent clears anything that depended on it.
       *
       * Without this, picking Nursing -> "Staff Nurse" and then switching to
       * Finance leaves "Staff Nurse" selected while the list beneath it shows
       * Finance roles - a value that is no longer in its own dropdown, and one
       * the user did not choose for the department now displayed.
       *
       * Driven off the config rather than hardcoded, so a future dependent
       * field is cleared without touching this function.
       */
      for (const dependent of config.fields) {
        if (dependent.dependsOn === key) {
          next[dependent.key] = ''
          // The role's id is derived from its name; clearing one must clear
          // the other or the task keeps a link to the role just abandoned.
          if (dependent.key === 'jobrole') {
            next.jobrole_id = ''
          }
        }
      }

      // Capture the id alongside the name the moment a role is picked.
      if (key === 'jobrole') {
        next.jobrole_id = resolveJobroleId(value) ?? ''
      }
      return next
    })
  }

  const optionsFor = (field: LibraryFieldDef): { label: string; value: string }[] => {
    if (field.taxonomy === 'category') {
      const list = categories
      // Keep the current value selectable even if the taxonomy has not loaded.
      const current = values[field.key]
      const merged = current && !list.includes(current) ? [current, ...list] : list
      return [{ label: `Select ${field.label.toLowerCase()}`, value: '' }, ...merged.map((c) => ({ label: c, value: c }))]
    }

    if (field.taxonomy === 'sub_category') {
      const list = categoryValue ? subCategoriesOf(categoryValue) : []
      const current = values[field.key]
      const merged = current && !list.includes(current) ? [current, ...list] : list
      return [{ label: categoryValue ? 'Select sub category' : 'Pick a category first', value: '' }, ...merged.map((c) => ({ label: c, value: c }))]
    }

    if (field.source) {
      // A dependent field narrows to its parent's value - the same rule as
      // sub_category under category, one level up the organisation tree.
      const parentValue = field.dependsOn ? (values[field.dependsOn] ?? '').trim() : ''
      const list = sourceValues(meta, field.source, parentValue || undefined)

      // A row saved before this value disappeared from the data must still be
      // editable, so whatever is already selected stays in the list.
      const current = values[field.key]
      const merged = current && !list.includes(current) ? [current, ...list] : list

      /*
       * The empty state has to say WHICH of the two reasons it is. A role list
       * that is empty because no department is chosen looks identical to one
       * that is empty because the department genuinely has no roles, and the
       * first is the user's next action while the second is a dead end.
       */
      const placeholder = field.dependsOn && !parentValue
        ? `Select a ${field.dependsOn} first`
        : merged.length
          ? `Select ${field.label.toLowerCase()}`
          : field.dependsOn
            ? `No ${field.label.toLowerCase()} in this ${field.dependsOn}`
            : `No ${field.label.toLowerCase()} available`

      return [
        { label: placeholder, value: '' },
        ...merged.map((option) => ({ label: option, value: option })),
      ]
    }

    return [
      { label: `Select ${field.label.toLowerCase()}`, value: '' },
      ...(field.options ?? []).map((option) => ({ label: option, value: option })),
    ]
  }

  function renderField(field: LibraryFieldDef) {
    const isWide = field.type === 'textarea'
    // A `source` field with an explicit select type is a closed list - the
    // value has to be one that already exists. An open one shows the same
    // list but lets you add a value that is genuinely new.
    const strictChoice = field.type === 'select' || Boolean(field.taxonomy)
    const openList = Boolean(field.source) && !strictChoice

    return (
      <div key={field.key} className={isWide ? 'md:col-span-2 space-y-2' : 'space-y-2'}>
        <label className="text-sm font-semibold text-foreground" htmlFor={`lib-${field.key}`}>
          {field.label}
          {field.required && <span className="text-destructive"> *</span>}
        </label>

        {field.type === 'textarea' ? (
          <Textarea
            id={`lib-${field.key}`}
            value={values[field.key] ?? ''}
            onChange={(event) => set(field.key, event.target.value)}
            placeholder={field.placeholder}
            className="bg-background border-border min-h-[90px]"
          />
        ) : openList ? (
          <OpenChoice
            id={`lib-${field.key}`}
            label={field.label}
            value={values[field.key] ?? ''}
            options={sourceValues(
              meta,
              field.source!,
              field.dependsOn ? (values[field.dependsOn] ?? '').trim() || undefined : undefined,
            )}
            placeholder={field.placeholder}
            onChange={(value) => set(field.key, value)}
          />
        ) : strictChoice ? (
          <Select
            id={`lib-${field.key}`}
            value={values[field.key] ?? ''}
            onChange={(value) => set(field.key, value)}
            options={optionsFor(field)}
            disabled={field.taxonomy === 'sub_category' && !categoryValue}
            className="bg-background border-border h-9"
            aria-label={field.label}
          />
        ) : (
          <Input
            id={`lib-${field.key}`}
            type={field.type === 'url' ? 'url' : 'text'}
            value={values[field.key] ?? ''}
            onChange={(event) => set(field.key, event.target.value)}
            placeholder={field.placeholder}
            className="bg-background border-border"
          />
        )}

        {/* Without this the dropdown is an empty box with no way forward. */}
        {field.taxonomy === 'category' && categories.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            No {field.label.toLowerCase()} defined yet — add one from the Taxonomy panel first.
          </p>
        ) : field.source ? (
          // Say how many this organisation actually has. A picker that hides
          // its size leaves people guessing whether the list is complete.
          <p className="text-xs text-muted-foreground">
            {countLabel(sourceValues(meta, field.source).length, field.label)}
            {field.help ? ` ${field.help}` : ''}
          </p>
        ) : (
          field.help && <p className="text-xs text-muted-foreground">{field.help}</p>
        )}
      </div>
    )
  }

  const handleSubmit = async () => {
    for (const field of editable) {
      if (field.required && !values[field.key]?.trim()) {
        // Pointing at a field the user cannot see is a dead end, so open the
        // disclosure when the missing one is hidden inside it.
        if (field.advanced) setShowAdvanced(true)
        setError(`${field.label} is required.`)
        return
      }
    }
    setError(null)

    const overrides = FORM_KEY_OVERRIDES[config.id] ?? {}
    const payload: LibraryPayload = {}

    for (const field of editable) {
      const value = (values[field.key] ?? '').trim()
      const original = initial?.[field.key]
      const originalText = original === null || original === undefined ? '' : String(original)

      // On edit only send what changed, so a partial form never blanks a column
      // it did not show. On create send everything that has a value.
      if (editing ? value === originalText : value === '') continue

      payload[overrides[field.key] ?? field.key] = value
    }

    /*
     * `jobrole_id` rides alongside `jobrole`, and is not a configured field.
     *
     * The loop above only walks `config.fields`, so the id has to be added
     * explicitly. It is sent whenever the name is being sent, including the
     * empty case: on edit, clearing the id matters as much as setting it, or a
     * role change would leave the previous role's id in place.
     */
    if ('jobrole' in payload) {
      payload.jobrole_id = values.jobrole_id ?? ''
    }

    if (editing && Object.keys(payload).length === 0) {
      setError('Nothing has changed yet.')
      return
    }

    const result = await onSubmit(payload)

    // THE ROLE IS CREATED FIRST, THEN MAPPED - it has no id until it exists.
    // A failure here must not read as a failed create: the role IS saved, so
    // say what did not happen rather than closing as if all of it worked.
    if (result.ok && isJobRole && !editing && pickedComps.length > 0) {
      const newId = result.createdId ?? null
      if (!newId) {
        setError('The job role was created, but no id came back, so the competencies were not mapped.')
        return
      }
      try {
        await roleRequirementsService.save(
          getLaravelContext(user),
          newId,
          // required_proficiency is mandatory and must be 1-5; 3 is mid scale
          // and stays editable on the role afterwards.
          pickedComps.map((id) => ({ competency_id: id, required_proficiency: 3, is_mandatory: true })),
        )
      } catch (e) {
        setError(
          e instanceof Error
            ? `The job role was created, but its competencies were not mapped: ${e.message}`
            : 'The job role was created, but its competencies were not mapped.',
        )
        return
      }
    }

    if (result.ok) onSaved()
    else setError(result.message)
  }

  return (
    <>
      <DialogHeader className="p-6 pb-4 border-b border-primary/10 m-0">
        <DialogTitle className="text-xl font-bold text-foreground">
          {editing ? `Edit ${config.singular}` : `Add ${config.singular}`}
        </DialogTitle>
        <DialogDescription className="text-sm text-muted-foreground">
          {editing
            ? 'Only the fields you change are saved.'
            : `Add a new entry to the ${config.plural.toLowerCase()} library.`}
        </DialogDescription>
      </DialogHeader>

      <div className="p-6 space-y-5 max-h-[65vh] overflow-y-auto g2g-scrollbar">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {essentials.map(renderField)}
        </div>

        {advanced.length > 0 && (
          <div className="rounded-lg border border-border/70">
            <button
              type="button"
              onClick={() => setShowAdvanced((open) => !open)}
              className="flex w-full items-center justify-between px-4 py-3 text-sm font-semibold text-foreground"
            >
              <span>
                More details
                <span className="ml-2 font-normal text-muted-foreground">
                  {advanced.length} optional field{advanced.length === 1 ? '' : 's'}
                </span>
              </span>
              <span className="text-muted-foreground">{showAdvanced ? '−' : '+'}</span>
            </button>
            {showAdvanced && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5 border-t border-border/70 p-4">
                {advanced.map(renderField)}
              </div>
            )}
          </div>
        )}

        {/* ── WHAT THIS ROLE REQUIRES ──────────────────────────────────────
            Merged in from the standalone Role Requirements screen. Set by the
            person defining the role, who knows what it demands, rather than on
            a matrix filled in months later.

            TWO MODES, because role_map keys on jobrole_id:
              edit   - the role exists, so the live panel reads/writes the API.
              create - nothing exists yet, so picks are held here and written
                       immediately after the role is created.
            ───────────────────────────────────────────────────────────────── */}
        {isJobRole && (
          <div className="flex flex-col gap-1.5 border-t border-border/70 pt-4">
            <span className="text-sm font-semibold text-foreground">What this role requires</span>
            <span className="mb-1 text-xs text-muted-foreground">
              The competencies this role demands. Gaps are measured against these.
            </span>

            {editing && initial ? (
              <RoleCompetencyInlinePanel jobroleId={Number(initial.id)} />
            ) : (
              <div className="flex flex-col gap-2">
                {pickedComps.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {pickedComps.map((id) => (
                      <span
                        key={id}
                        className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/40 px-2.5 py-1 text-xs"
                      >
                        {roleLibrary.find((c) => c.id === id)?.name ?? `#${id}`}
                        <button
                          type="button"
                          aria-label="Remove competency"
                          onClick={() => setPickedComps((current) => current.filter((x) => x !== id))}
                          className="text-muted-foreground transition hover:text-destructive"
                        >
                          &times;
                        </button>
                      </span>
                    ))}
                  </div>
                )}
                <SearchableSelect
                  options={roleLibrary
                    .filter((c) => !pickedComps.includes(c.id))
                    .map((c) => ({ label: c.name, value: String(c.id) }))}
                  value=""
                  onChange={(next) => {
                    const id = Number(next)
                    if (id && !pickedComps.includes(id)) setPickedComps((current) => [...current, id])
                  }}
                  placeholder={roleLibrary.length ? "Add a competency this role requires…" : roleLibraryError ? "Competency library could not be loaded" : "No competencies in this library yet"}
                  searchPlaceholder="Search competencies…"
                  emptyMessage="No competency matches that search"
                  disabled={!roleLibrary.length}
                  className="w-full"
                  aria-label="Add a competency this role requires"
                />
                {roleLibraryError ? (
                  <span className="text-xs text-destructive">{roleLibraryError}</span>
                ) : !roleLibrary.length ? (
                  <span className="text-xs text-muted-foreground">
                    This organisation has no competencies yet — create them in Competency Library
                    first, then they can be required here.
                  </span>
                ) : (
                  <span className="text-xs text-muted-foreground">
                    Saved at level 3 right after the role is created, and editable afterwards.
                  </span>
                )}
              </div>
            )}
          </div>
        )}

        {error && <p className="text-sm font-medium text-destructive">{error}</p>}
      </div>

      <DialogFooter className="p-6 pt-4 border-t border-primary/5 bg-muted/10 m-0">
        <Button
          variant="outline"
          onClick={onCancel}
          disabled={saving}
          className="h-9 px-6 rounded-lg font-bold border-border bg-background"
        >
          Cancel
        </Button>
        <Button
          onClick={handleSubmit}
          disabled={saving}
          className="h-9 px-6 rounded-lg font-bold bg-primary text-primary-foreground hover:bg-primary/90"
        >
          {saving ? 'Saving…' : editing ? 'Save Changes' : `Add ${config.singular}`}
        </Button>
      </DialogFooter>
    </>
  )
}
