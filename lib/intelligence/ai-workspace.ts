'use client'

/**
 * Client for the page the assistant is opened on - `GET /api/ai/workspace/context`.
 *
 * The backend resolves the page (a `tblmenumaster_g2g` row) to the module it belongs to and
 * returns the questions worth asking there: curated `ai_suggestions` and the starter questions
 * of that module's real data sources. Tenant and role come from the token, never from here.
 */

import type { PageSnapshot } from '@/lib/page-context/dom-snapshot'

import { aiRequest } from './client'

export interface PageSuggestion {
  id: string
  label: string
  prompt: string
  /** `page` (read off the screen), `curated` (an ai_suggestions row) or `data` (a data source the module reads). */
  origin: 'page' | 'curated' | 'data'
  data_source: string | null
}

export interface PageContext {
  /** The page's module, or null when the page belongs to no module with an AI Stack. */
  module: { key: string; label: string; root_key: string; root_label: string } | null
  page: { id: number; title: string; breadcrumb: string[]; route: string | null } | null
  suggestions: PageSuggestion[]
  /** `page` when the questions come from what is on screen, `module` when only the module is known. */
  scope?: 'page' | 'module' | 'tab' | 'none'
}

export function fetchPageContext(input: {
  menuId?: number | null
  route?: string | null
  /** What the browser read off the page; the backend rebuilds and caps it before use. */
  pageData?: PageSnapshot | null
  /** On a module's AI Stack: the module and the tab the user has open. */
  aiStack?: { module: string; tab: string } | null
}): Promise<PageContext> {
  return aiRequest<PageContext>('/workspace/context', 'POST', {
    menu_id: input.menuId ?? undefined,
    route: input.route ?? undefined,
    page_data: input.pageData ?? undefined,
    ai_stack_module: input.aiStack?.module,
    ai_stack_tab: input.aiStack?.tab,
  })
}
