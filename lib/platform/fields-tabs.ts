/**
 * The tabs of the Field settings page and the addresses that lead to them.
 *
 * Pure and dependency-free (type-only imports) so the rules can be tested without a browser, and so a Next page file does not have to export them: a `page.tsx` may
 * export only its default component.
 *
 * WHY THERE ARE TABS AT ALL (26 Nov 2026, owner decision): the CRM "Master Fields" screen was merged into Field settings, the way Automation Rules was merged into
 * Workflows. Sales & Marketing (`crm`) therefore carries six tabs: the custom fields this page always had, plus the five master-data consoles that Master Fields held.
 * Every other module, and the central view, shows the custom fields alone with no tab bar, exactly as before.
 */

import type { DecentralizedModuleKey } from './access-links'

export type FieldsTabId = 'custom' | 'picklists' | 'tax-rates' | 'lead-scoring' | 'web-to-lead' | 'sla-policies'

export interface FieldsTab {
  id: FieldsTabId
  label: string
}

/** The tabs in the order they are drawn. Custom fields comes first because it is what the page was before the merge. */
export const FIELDS_TABS: readonly FieldsTab[] = [
  { id: 'custom', label: 'Custom fields' },
  { id: 'picklists', label: 'Picklist values' },
  { id: 'tax-rates', label: 'Tax rates' },
  { id: 'lead-scoring', label: 'Lead scoring & assignment' },
  { id: 'web-to-lead', label: 'Web-to-lead' },
  { id: 'sla-policies', label: 'SLA policies' },
]

/** Module-level constants, because `useUrlTab` takes its list as a dependency: the FIRST id is the tab a plain address opens. */
export const CRM_FIELDS_TAB_IDS: readonly FieldsTabId[] = FIELDS_TABS.map((tab) => tab.id)
export const CUSTOM_ONLY_TAB_IDS: readonly FieldsTabId[] = ['custom']

export interface FieldsTabRules {
  /** What `useUrlTab` accepts; the first one is the default. */
  ids: readonly FieldsTabId[]
  /** The tabs to draw, in drawing order. */
  tabs: readonly FieldsTab[]
  defaultTab: FieldsTabId
  /** False when only Custom fields exists: then there is nothing to switch between and no bar is drawn. */
  showTabBar: boolean
}

export function fieldsTabRules(moduleKey: DecentralizedModuleKey | null): FieldsTabRules {
  if (moduleKey === 'crm') {
    return { ids: CRM_FIELDS_TAB_IDS, tabs: FIELDS_TABS, defaultTab: 'custom', showTabBar: true }
  }

  return { ids: CUSTOM_ONLY_TAB_IDS, tabs: FIELDS_TABS.filter((tab) => tab.id === 'custom'), defaultTab: 'custom', showTabBar: false }
}

/** The Field settings address of Sales & Marketing, optionally on one tab (the redirect of the retired Master Fields screen uses `picklists`). */
export function fieldsHref(tab?: FieldsTabId): string {
  return `/platform-services/fields-configuration?module=crm${tab && tab !== 'custom' ? `&tab=${tab}` : ''}`
}
