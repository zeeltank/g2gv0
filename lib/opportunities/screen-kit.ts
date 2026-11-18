import { screenKit as leadsScreenKit, type Call, type Responder } from '../leads/screen-kit'

export type { Call, Responder }

/**
 * A whole opportunity screen in a fake browser. The method, the router stand-in, the signed-in session and the replaced `fetch` are the Leads screen's own
 * (lib/leads/screen-kit.ts, reused and not copied); the only thing added is the sidebar, which here holds the Opportunities row (the board, the table and the
 * page resolve their links through it) and, when asked, the Campaigns row too (the form reads the campaign list only for a person whose menu holds it).
 * Import after dom-test-kit (it needs the fake DOM) and from inside the test.
 */

const PROFILE = 16
const TENANT = 1

/** Sales & Marketing with Opportunities at the access link the real menu holds, and Campaigns when `withCampaigns`. */
export function menu(withCampaigns = false) {
  return [{
    id: 199, label: 'Sales & Marketing', icon: null, access_link: '/module/crm', page_type: null, sort_order: 1, parent_id: null,
    children: [
      { id: 210, label: 'Opportunities', icon: null, access_link: '/module/crm/sales/opportunities', page_type: 'page', sort_order: 1, parent_id: 199, children: [] },
      ...(withCampaigns ? [{ id: 200, label: 'Campaigns', icon: null, access_link: '/module/crm/marketing/campaigns', page_type: 'page', sort_order: 2, parent_id: 199, children: [] }] : []),
    ],
  }]
}

export async function screenKit(opts: { search?: string; pathname?: string; respond?: Responder; campaigns?: boolean } = {}) {
  const screen = await leadsScreenKit({ search: opts.search, pathname: opts.pathname ?? '/module/crm/sales/opportunities', respond: opts.respond })
  // The sidebar hook reads its first answer from the browser's own storage when it mounts, so this replaces the Leads menu before anything is mounted.
  screen.k.w.sessionStorage.setItem(`gtg-sidebar-cache-v3:${TENANT}:${PROFILE}`, JSON.stringify({ status_code: 200, message: 'ok', data: menu(opts.campaigns ?? false) }))
  return screen
}
