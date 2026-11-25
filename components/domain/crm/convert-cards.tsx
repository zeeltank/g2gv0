'use client'

import type { ReactNode } from 'react'
import { Building2, TrendingUp, UserPlus } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { SearchableSelect } from '@/components/ui/searchable-select'
import { Field, NativeSelect } from '@/components/shared/scaffolds'
import { CurrencySelect } from '@/components/domain/portfolio/currency-select'
import type { LaravelContext } from '@/lib/laravel-context'
import type { CrmPicklistValue } from '@/types/crm'
import { ConvertOrganizationPicker } from './convert-organization-picker'

/**
 * The three cards every conversion pop-up is made of: Organization, Person and Opportunity. Convert Lead (ConvertLeadDialog) and a signal's Convert to opportunity
 * (ConvertSignalDialog) both draw them from here, so the two pop-ups look, read and behave the same. A card only shows its values and reports changes: what the values
 * are, and what is sent, belongs to the pop-up that owns the form.
 */

/** A native drop-down's options: the picklist, and the value already held when the list no longer has it (so it is shown, not lost). */
export function convertOptionsOf(values: CrmPicklistValue[], held: string): Array<{ value: string; label: string }> {
  const options = values.map((p) => ({ value: p.value, label: p.label }))
  if (held !== '' && !options.some((o) => o.value === held)) options.push({ value: held, label: held })
  return options
}

/** One of the three cards: an icon, a title with its switch, and, when the switch is on, the choices that follow it, tinted and lined up under the title. */
export function ConvertCard({ icon, children, details, detailsKey, columns = false }: { icon: ReactNode; children: ReactNode; details?: ReactNode; detailsKey: string; columns?: boolean }) {
  return (
    <div className="rounded-lg border border-border p-3">
      <div className="flex items-start gap-3">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">{icon}</div>
        <div className="min-w-0 flex-1">{children}</div>
      </div>
      {details && (
        <div data-details={detailsKey} className={columns ? 'mt-3 grid grid-cols-1 gap-3 rounded-md bg-muted/50 p-2.5 sm:ml-[3.25rem] sm:grid-cols-2' : 'mt-3 space-y-3 rounded-md bg-muted/50 p-2.5 sm:ml-[3.25rem]'}>
          {details}
        </div>
      )}
    </div>
  )
}

export function ConvertSwitchRow({ id, label, checked, onChange, muted = false }: { id: string; label: string; checked: boolean; onChange: (on: boolean) => void; muted?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <Label htmlFor={id} className={muted ? 'cursor-pointer text-sm text-muted-foreground' : 'cursor-pointer'}>{label}</Label>
      <Switch id={id} checked={checked} onChange={(e) => onChange(e.target.checked)} />
    </div>
  )
}

type Option = { value: string; label: string }

/** A card whose thing is always made (a signal's opportunity): a title in place of the switch. */
const FixedTitle = ({ children }: { children: ReactNode }) => <p className="text-sm font-medium text-foreground">{children}</p>

export function OrganizationCard({
  context, create, onCreate, required = false, title = 'Organization', note,
  useExisting, onUseExisting, existingId, existingName, onChoose, name, onName, industry, onIndustry, industryOptions,
}: {
  context: LaravelContext
  create: boolean
  onCreate: (on: boolean) => void
  /** The organization is always made or chosen (a signal's conversion): a title in place of the "Create organization" switch. */
  required?: boolean
  title?: string
  note?: ReactNode
  useExisting: boolean
  onUseExisting: (on: boolean) => void
  existingId: string
  existingName: string
  onChoose: (id: string, name: string) => void
  name: string
  onName: (value: string) => void
  industry: string
  onIndustry: (value: string) => void
  industryOptions: Option[]
}) {
  return (
    <ConvertCard
      detailsKey="organization"
      icon={<Building2 className="size-4" aria-hidden="true" />}
      details={create && (
        <>
          <ConvertSwitchRow id="convert-org-existing" label="Use an existing organization instead" muted checked={useExisting} onChange={onUseExisting} />
          {useExisting ? (
            <ConvertOrganizationPicker context={context} chosenId={existingId} chosenName={existingName} onChoose={onChoose} />
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="Organization name" required>
                {(c) => <Input {...c} name="convert-org-name" value={name} onChange={(e) => onName(e.target.value)} autoComplete="off" />}
              </Field>
              <Field label="Industry">
                {(c) => (
                  <NativeSelect {...c} name="convert-org-industry" value={industry} onChange={(e) => onIndustry(e.target.value)}>
                    <option value="">—</option>
                    {industryOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </NativeSelect>
                )}
              </Field>
            </div>
          )}
        </>
      )}
    >
      {required ? <FixedTitle>{title}</FixedTitle> : <ConvertSwitchRow id="convert-org" label="Create organization" checked={create} onChange={onCreate} />}
      {note}
    </ConvertCard>
  )
}

export function PersonCard({
  create, onCreate, createLabel = 'Create person', note, linkExisting, onLinkExisting, existingId, onExistingId, contacts, newPerson,
  showCompany, makePrimary, onMakePrimary, role, onRole, roleOptions,
}: {
  create: boolean
  onCreate: (on: boolean) => void
  /** The switch's words: "Create person" for a lead, "Add a person (optional)" for a signal. */
  createLabel?: string
  note?: ReactNode
  linkExisting: boolean
  onLinkExisting: (on: boolean) => void
  existingId: string
  onExistingId: (id: string) => void
  contacts: Array<{ id: string; label: string }>
  /** The fields of a NEW person, shown while no existing person is chosen (a lead's person comes from the lead itself, so it has none). */
  newPerson?: ReactNode
  /** The organization will exist, so the person can be its primary contact and have a role. */
  showCompany: boolean
  makePrimary: boolean
  onMakePrimary: (on: boolean) => void
  role: string
  onRole: (value: string) => void
  roleOptions: Option[]
}) {
  return (
    <ConvertCard
      detailsKey="person"
      icon={<UserPlus className="size-4" aria-hidden="true" />}
      details={create && (
        <>
          <ConvertSwitchRow id="convert-link-existing" label="Attach to an existing person instead" muted checked={linkExisting} onChange={onLinkExisting} />
          {linkExisting && (
            <SearchableSelect
              aria-label="Existing person"
              value={existingId}
              onChange={onExistingId}
              options={contacts.map((c) => ({ value: c.id, label: c.label }))}
              placeholder="Choose an existing contact…"
            />
          )}
          {!linkExisting && newPerson}
          {showCompany && (
            <div className="space-y-3 border-t border-border pt-3" data-person-company>
              <ConvertSwitchRow id="convert-primary" label="Primary contact of this company" checked={makePrimary} onChange={onMakePrimary} />
              <Field label="Role" hint={linkExisting ? 'For an existing person, this applies only if they already work at this company.' : undefined}>
                {(c) => (
                  <NativeSelect {...c} name="convert-role" value={role} onChange={(e) => onRole(e.target.value)}>
                    <option value="">—</option>
                    {roleOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </NativeSelect>
                )}
              </Field>
            </div>
          )}
        </>
      )}
    >
      <ConvertSwitchRow id="convert-contact" label={createLabel} checked={create} onChange={onCreate} />
      {note}
    </ConvertCard>
  )
}

export function OpportunityCard({
  create, onCreate, required = false, name, onName, amount, onAmount, currency, onCurrency, closeDate, onCloseDate, stage, onStage, stageOptions,
}: {
  create: boolean
  onCreate: (on: boolean) => void
  /** The opportunity is always made (a signal's conversion): a title in place of the "Create opportunity" switch. */
  required?: boolean
  name: string
  onName: (value: string) => void
  amount: string
  onAmount: (value: string) => void
  currency: string
  onCurrency: (code: string) => void
  closeDate: string
  onCloseDate: (value: string) => void
  stage: string
  onStage: (value: string) => void
  stageOptions: Option[]
}) {
  return (
    <ConvertCard
      detailsKey="opportunity"
      columns
      icon={<TrendingUp className="size-4" aria-hidden="true" />}
      details={create && (
        <>
          <div className="sm:col-span-2">
            <Field label="Opportunity name">
              {(c) => <Input {...c} name="convert-opp-name" value={name} onChange={(e) => onName(e.target.value)} autoComplete="off" />}
            </Field>
          </div>
          <Field label="Amount">
            {(c) => <Input {...c} name="convert-opp-amount" type="number" inputMode="decimal" min={0} step="any" value={amount} onChange={(e) => onAmount(e.target.value)} />}
          </Field>
          <Field label="Currency" hint="Your organization's default is used when you choose none.">
            {(c) => <CurrencySelect {...c} value={currency} onChange={onCurrency} />}
          </Field>
          <Field label="Expected close date">
            {(c) => <Input {...c} name="convert-opp-close" type="date" value={closeDate} onChange={(e) => onCloseDate(e.target.value)} />}
          </Field>
          <Field label="Stage">
            {(c) => (
              <NativeSelect {...c} name="convert-opp-stage" value={stage} onChange={(e) => onStage(e.target.value)}>
                <option value="">—</option>
                {stageOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </NativeSelect>
            )}
          </Field>
        </>
      )}
    >
      {required ? <FixedTitle>Opportunity</FixedTitle> : <ConvertSwitchRow id="convert-opportunity" label="Create opportunity" checked={create} onChange={onCreate} />}
      {!create && <p className="mt-0.5 text-xs text-muted-foreground">Starts a pipeline deal.</p>}
    </ConvertCard>
  )
}
