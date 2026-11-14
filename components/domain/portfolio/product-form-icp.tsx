'use client'

import { PageTabs, TabPanel } from '@/components/shared/scaffolds'
import { ICP_TABS, type IcpModel, type IcpStates } from '@/lib/portfolio/icp-state'
import { icpTouched } from '@/lib/product-icp-draft'
import { CHIP_BASE, CHIP_TONE } from '@/lib/org-accounts/tones'
import { ProductIcpSection } from './product-icp-section'

/**
 * The Ideal customer section: the three ICP models of today's Portfolio form, one tab each, saved together with the rest of the record. A model left empty
 * saves nothing. A problem found by the check before saving ("Nothing was saved") is shown on its own tab, which is opened for the person.
 */
export function IcpSection({ states, onChange, problems, busy, editing, active, onActive }: {
  states: IcpStates
  onChange: (model: IcpModel, patch: { form?: Partial<IcpStates[IcpModel]['form']>; lines?: Partial<IcpStates[IcpModel]['lines']> }) => void
  problems: Partial<Record<IcpModel, string[]>>
  busy: boolean
  /** The record already has an About, so its stored ICP was loaded. */
  editing: boolean
  active: IcpModel
  onActive: (model: IcpModel) => void
}) {
  const tabs = ICP_TABS.map((t) => ({
    id: t.key,
    label: (problems[t.key] ?? []).length > 0 ? `${t.label} (needs attention)` : t.label,
  }))

  return (
    <div className="space-y-3">
      <PageTabs tabs={tabs} active={active} onChange={(id) => onActive(id as IcpModel)} label="Customer models" idPrefix="icp-model" />
      {ICP_TABS.map((t) => (
        <TabPanel key={t.key} id={t.key} active={active} idPrefix="icp-model">
          <div className="space-y-3">
            <p className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span className={`${CHIP_BASE} ${icpTouched(states[t.key].form, states[t.key].lines) ? CHIP_TONE.positive : CHIP_TONE.muted}`}>
                {icpTouched(states[t.key].form, states[t.key].lines) ? 'Configured' : 'Not configured'}
              </span>
              {t.label}
            </p>
            <ProductIcpSection
              key={t.key}
              form={states[t.key].form}
              lines={states[t.key].lines}
              onForm={(patch) => onChange(t.key, { form: patch })}
              onLines={(patch) => onChange(t.key, { lines: patch })}
              disabled={busy}
              problems={problems[t.key] ?? []}
              editing={editing}
              model={t.key}
            />
          </div>
        </TabPanel>
      ))}
    </div>
  )
}
