import { strict as assert } from 'node:assert'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, it } from 'node:test'
import { getRedirectStatusCodeFromError, getRedirectTypeFromError, getURLFromRedirectError } from 'next/dist/client/components/redirect'
import { isRedirectError } from 'next/dist/client/components/redirect-error'
import GtmOutreachRedirect from '../app/gtm/outreach/page'
import CrmOutreachApprovalsRedirect from '../app/module/crm/marketing/outreach-approvals/page'
import CrmSalesSmsNotifierRedirect from '../app/module/crm/sales/sms-notifier/page'
import CrmSupportSmsNotifierRedirect from '../app/module/crm/support/sms-notifier/page'
import { CRM_CONTENT } from '../hooks/content-map-crm'
import { toMessageSection, toOutreachView } from './signals/outreach-model'

/**
 * The four retired addresses of the Outreach merge (27 Nov 2026): GTM Outreach (`/gtm/outreach`), Outreach Approvals (`/module/crm/marketing/outreach-approvals`) and the two SMS Notifier
 * pages (`/module/crm/{sales,support}/sms-notifier`). They live on ONLY as redirect pages into the Messages view of the Outreach tab of Market Signals (a bookmark, a saved link or an
 * agent message still carries them), and nothing in the content map points at the screens that were folded. A page that redirects throws Next's redirect error, which carries the
 * address and the status.
 */

async function visit(page: () => unknown) {
  try {
    await page()
  } catch (error) {
    if (isRedirectError(error)) return { url: getURLFromRedirectError(error)!, status: getRedirectStatusCodeFromError(error), type: getRedirectTypeFromError(error) }
    throw error
  }
  return assert.fail('the page did not redirect')
}

const MESSAGES = '/signals/outreach?view=messages'
const SMS_LOG = '/signals/outreach?view=messages&section=sms'

const PAGES: Array<{ address: string; folder: string; page: () => unknown; target: string }> = [
  { address: '/gtm/outreach', folder: 'app/gtm/outreach', page: GtmOutreachRedirect, target: MESSAGES },
  { address: '/module/crm/marketing/outreach-approvals', folder: 'app/module/crm/marketing/outreach-approvals', page: CrmOutreachApprovalsRedirect, target: MESSAGES },
  { address: '/module/crm/sales/sms-notifier', folder: 'app/module/crm/sales/sms-notifier', page: CrmSalesSmsNotifierRedirect, target: SMS_LOG },
  { address: '/module/crm/support/sms-notifier', folder: 'app/module/crm/support/sms-notifier', page: CrmSupportSmsNotifierRedirect, target: SMS_LOG },
]

describe('the redirect pages of the retired Outreach addresses', () => {
  for (const { address, page, target } of PAGES) {
    it(`${address} sends a visit to ${target} as a temporary (307) redirect that replaces the history entry`, async () => {
      assert.deepEqual(await visit(page), { url: target, status: 307, type: 'replace' })
    })
  }

  it('sends Outreach and Outreach Approvals to the message queue, and both SMS Notifiers to the SMS log, and each target opens that very section', async () => {
    for (const { address, page } of PAGES) {
      const { url } = await visit(page)
      const target = new URL(url, 'https://example.test')
      assert.equal(target.pathname, '/signals/outreach', address)
      assert.equal(toOutreachView(target.searchParams.get('view')), 'messages', `${address}: the Messages view`)
      assert.equal(toMessageSection(target.searchParams.get('section')), address.includes('sms-notifier') ? 'sms' : 'queue', `${address}: the section it stands for`)
    }
  })

  it('takes no query string with it: the old screens\' filters mean nothing to the new ones', async () => {
    for (const { page } of PAGES) assert.equal((page as { length: number }).length, 0, 'the page reads no search parameters')
  })
})

describe('nothing is left of the four folded screens', () => {
  const root = path.resolve(__dirname, '..')

  it('maps none of the four addresses in the content map: a visit never reaches a screen that no longer exists', () => {
    const mapped = CRM_CONTENT.map((route) => route.accessLink)
    for (const { address } of PAGES) assert.equal(mapped.includes(address), false, address)
  })

  it('keeps the redirect pages as the only files in their folders, with no screen of their own', () => {
    for (const { folder } of PAGES) {
      assert.deepEqual(readdirSync(path.join(root, folder)), ['page.tsx'], folder)
      const source = readFileSync(path.join(root, folder, 'page.tsx'), 'utf8')
      assert.match(source, /redirect\(outreachHref\(/, folder)
      assert.doesNotMatch(source, /'use client'|ProtectedLayout|GtgAppShell/, folder)
    }
  })

  it('has deleted the three CRM screens and the GTM screen that the tab replaced, and has the Messages panel that holds their content', () => {
    for (const file of ['components/domain/gtm/outreach-view.tsx', 'components/domain/crm/outreach-approval-queue.tsx', 'components/domain/crm/outreach-approval-list-view.tsx', 'components/domain/crm/sms-log-list-view.tsx']) {
      assert.equal(existsSync(path.join(root, file)), false, `${file} is gone`)
    }
    for (const file of ['components/domain/signals/outreach/messages-panel.tsx', 'components/domain/signals/outreach/messages-sms-log.tsx']) {
      assert.equal(existsSync(path.join(root, file)), true, `${file} is there`)
    }
  })

  it('keeps what the retired screens shared with others: the Send SMS dialog, the bulk send dialogs, saved views, the GTM outreach service and the lead assistant\'s runOutreach', () => {
    for (const file of ['components/domain/crm/send-sms-dialog.tsx', 'components/domain/crm/crm-saved-views.tsx', 'components/domain/crm/crm-export-button.tsx']) {
      assert.equal(existsSync(path.join(root, file)), true, file)
    }
    assert.match(readFileSync(path.join(root, 'services/gtm/gtm.ts'), 'utf8'), /export const outreachService/)
    assert.match(readFileSync(path.join(root, 'services/crm/index.ts'), 'utf8'), /runOutreach:/)
    assert.match(readFileSync(path.join(root, 'types/crm.ts'), 'utf8'), /export interface OutreachDraft\b/)
  })
})
