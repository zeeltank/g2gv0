import assert from 'node:assert/strict'
import { afterEach, describe, it } from 'node:test'
import { disposeAll, kit } from '../scaffolds/dom-test-kit'
import type { SignalReviewApi } from '../../services/signal-review/signal-review-service'
import type { SignalPromoteResponse, SignalRow } from '../../services/signal-review/signal-types'
import type { DecisionDialogProps, HistoryListProps, ReviewHistoryEntry } from '../../services/signal-review/types'
import { FORBIDDEN_TEXT, NETWORK_TEXT, NOT_FOUND_TEXT } from './decision-failure'
import { LEAD_FORBIDDEN_TEXT, NO_LEAD_ID_TEXT } from './lead-action'
import { routerHarness } from './router-harness'
import { historyEntry, REASONS, signalRow } from './signal-fixtures'

/**
 * The two additions to the Signal Review drawer: "Turn into a lead" and the Fit and score tab. The drawer runs with its real parts except the decision
 * dialog and the history list, which are stand-ins that record what they are given. A small host holds the signal in state and replaces it whenever the
 * drawer calls `onChanged`, as the list does, so what the person sees after an answer is what the screen would show.
 */

const LEAD_HREF = '/module/crm/marketing/leads/501'

/** Nothing there. Elements are never handed to assert.equal: a failure would make it print the whole page. */
const absent = (element: unknown, message?: string) => assert.ok(element === null || element === undefined, message ?? 'it is not on the page')

const created = (over: Partial<SignalPromoteResponse['data']> = {}): SignalPromoteResponse => ({ status: 1, data: { lead_id: '501', created: true, ...over } })

/** A signal that records everything the Fit and score tab can show. */
function richSignal(over: Partial<SignalRow> = {}): SignalRow {
  const base = signalRow()
  return signalRow({
    scores: { total: 24, buying_signal: 4, problem_fit: 4, product_fit: 3, accessibility: 3, urgency: 4, potential_value: 3, evidence_quality: 3 },
    score_reasoning: 'A live tender with a closing date and fourteen named schools.',
    confidence: 'High',
    claim_level: 'confirmed',
    candidate_need_codes: ['N05', 'N07'],
    relevant_offer_name: 'Scholar Core',
    matched_offers: [
      { offer_id: 'scholar-core', offer_name: 'Scholar Core', offer_category: 'Scholar', match_score: 78, rationale: 'Admissions and fees are named in the notice.', matched_need_codes: ['N05'] },
      { offer_id: 'scholar-lite', offer_name: 'Scholar Lite', match_score: null, rationale: null, matched_need_codes: [] },
    ],
    assessment: {
      ...base.assessment,
      fit: {
        total: 80,
        band: 'High',
        components: {
          product: { score: 20, max: 20, why: 'a stored part of the product' },
          icp: { score: 10, max: 15, why: 'a buyer type the ICP targets' },
          geography: { score: 8, max: 10, why: 'inside the places the ICP aims at' },
          evidence: { score: 18, max: 25, why: 'the quote was found in the page that was read' },
          intent: { score: 15, max: 20, why: 'buying intent: strong' },
          freshness: { score: 9, max: 10, why: '12 days old' },
        },
      },
    },
    ...over,
  })
}

interface Setup {
  signal?: SignalRow
  promote?: (id: number) => Promise<SignalPromoteResponse>
  history?: (call: number) => ReviewHistoryEntry[]
}

async function setup(options: Setup = {}) {
  const k = await kit()
  const router = await routerHarness()
  // next/link reads `self` while it renders; the fake browser does not define it.
  Object.defineProperty(globalThis, 'self', { value: k.w, configurable: true, writable: true })
  const { SignalReviewDrawer } = await import('../../components/domain/crm/signal-review-drawer')

  const initial = options.signal ?? signalRow()
  const promoteCalls: number[] = []
  const historyCalls: number[] = []
  const changed: SignalRow[] = []
  let setHostSignal!: (next: SignalRow) => void
  const seen: { list: HistoryListProps | null } = { list: null }

  const service: Pick<SignalReviewApi, 'decide' | 'get' | 'history' | 'promote'> = {
    history: async (id) => { historyCalls.push(id); return { status: 1, data: options.history ? options.history(historyCalls.length) : [historyEntry({ id: 1 })] } },
    get: async () => ({ status: 1, data: initial }),
    decide: async () => ({ status: 1, data: { ...initial, review_status: 'Follow-up' }, review: historyEntry({ id: 99 }) }),
    promote: async (id) => { promoteCalls.push(id); return options.promote ? options.promote(id) : created() },
  }

  const FakeDialog = (props: DecisionDialogProps) => (props.open ? k.h('div', { role: 'dialog', 'aria-label': 'stand-in dialog' }, `mode:${props.mode}`) : null)
  const FakeHistory = (props: HistoryListProps) => {
    seen.list = props
    return k.h('div', { 'data-testid': 'history' }, props.loading ? 'history loading' : props.error ? `history error: ${props.error}` : `history entries: ${props.entries?.length ?? 'none'}`)
  }

  function Host() {
    const [signal, setSignal] = k.React.useState(initial)
    setHostSignal = setSignal
    return k.h(SignalReviewDrawer, {
      signal, open: true, service, reasons: REASONS,
      products: [{ value: 'scholar', label: 'Scholar', business_fit: 'scholar' }],
      onChanged: (next: SignalRow) => { changed.push(next); setSignal(next) },
      onClose: () => undefined,
      parts: { DecisionDialog: FakeDialog, HistoryList: FakeHistory },
    })
  }

  await k.render(router.wrap(k.h(Host)))
  await k.tick(5)

  const leadButton = () => k.withText('Turn into a lead') as HTMLButtonElement | null
  const leadLink = () => k.all('a').find((a) => a.textContent?.startsWith('Open lead')) ?? null
  const decisionButtons = () => k.all('[role="group"] button') as HTMLButtonElement[]
  const alerts = () => k.all('[role="alert"]').map((el) => el.textContent)
  const statuses = () => k.all('[role="status"]').map((el) => el.textContent)
  /** Presses "Turn into a lead" and answers the question. */
  const turnIntoLead = async () => {
    await k.click(leadButton()!)
    await k.tick()
    await k.click(k.withText('Create lead')!)
    await k.tick(5)
  }
  const tab = (label: string) => k.all('[role="tab"]').find((t) => t.textContent === label)!
  const selectedTabs = () => k.all('[role="tab"]').filter((t) => t.getAttribute('aria-selected') === 'true').map((t) => t.textContent)

  return { k, router, service, promoteCalls, historyCalls, changed, seen, leadButton, leadLink, decisionButtons, alerts, statuses, turnIntoLead, tab, selectedTabs, setSignal: (next: SignalRow) => k.act(async () => { setHostSignal(next) }) }
}

describe('Turn into a lead', () => {
  afterEach(disposeAll)

  it('offers the button beside the decisions, not among them', async () => {
    const { leadButton, decisionButtons, leadLink } = await setup()
    assert.ok(leadButton(), 'the button is there')
    assert.equal(leadButton()!.disabled, false)
    assert.deepEqual(decisionButtons().map((b) => b.textContent), ['Contacted', 'Reviewed', 'Not relevant…'])
    absent(leadLink())
  })

  it('shows "Lead created" with a link to the lead, and no button, when the signal already has a lead', async () => {
    const { k, leadButton, leadLink, promoteCalls } = await setup({ signal: signalRow({ promoted_lead_id: '501', promoted_lead_no: 'LD-00012', promoted_lead_status: 'New' }) })
    absent(leadButton(), 'a signal with a lead cannot be turned into a second one')
    absent(k.withText('Turn into a lead'))
    assert.ok(k.bodyText().includes('Lead created'))
    const link = leadLink()!
    assert.equal(link.getAttribute('href'), LEAD_HREF)
    assert.equal(link.textContent, 'Open lead LD-00012')
    assert.ok(k.bodyText().includes('status: New'))
    assert.deepEqual(promoteCalls, [])
  })

  it('links to the lead even when the server did not give its number', async () => {
    const { leadLink } = await setup({ signal: signalRow({ promoted_lead_id: '501' }) })
    assert.equal(leadLink()!.textContent, 'Open lead')
    assert.equal(leadLink()!.getAttribute('href'), LEAD_HREF)
  })

  it('asks first, in words that say what will happen, and sends nothing on Cancel', async () => {
    const { k, leadButton, promoteCalls } = await setup()
    await k.click(leadButton()!)
    await k.tick()
    const text = k.bodyText()
    assert.ok(text.includes('Turn this signal into a lead?'))
    assert.ok(text.includes('A lead is created in CRM from this signal'))
    assert.ok(text.includes('The signal’s history records it.'))
    assert.deepEqual(promoteCalls, [], 'nothing is sent while the question is open')
    await k.click(k.withText('Cancel')!)
    await k.tick(5)
    assert.deepEqual(promoteCalls, [], 'and nothing on Cancel')
    assert.ok(leadButton(), 'the button is still there')
    assert.equal(k.all('[role="status"]').length, 0)
  })

  it('on confirm: creates the lead once, puts it on the row, replaces the button with the link, reads the history again and says so', async () => {
    const { k, turnIntoLead, promoteCalls, changed, leadButton, leadLink, historyCalls, statuses, alerts, seen } = await setup({
      history: (call) => (call === 1 ? [historyEntry({ id: 1 })] : [historyEntry({ id: 7, decision: 'promoted', via: 'promote', note: 'Lead #501 created' }), historyEntry({ id: 1 })]),
    })
    await turnIntoLead()
    assert.deepEqual(promoteCalls, [1])
    assert.equal(changed.length, 1)
    assert.equal(changed[0].promoted_lead_id, '501')
    assert.equal(changed[0].title, 'District office invites bids for a school management system', 'the rest of the row is kept')
    assert.equal(changed[0].review_status, 'New', 'turning a signal into a lead does not decide on it')
    absent(leadButton())
    assert.equal(leadLink()!.getAttribute('href'), LEAD_HREF)
    assert.ok(k.bodyText().includes('Lead created'))
    assert.deepEqual(statuses(), ['Lead created in CRM. It is recorded in this signal’s history.'])
    assert.deepEqual(alerts(), [])
    assert.equal(historyCalls.length, 2, 'the server wrote a history line, so it is read again')
    assert.equal(seen.list?.entries?.[0].decision, 'promoted')
  })

  it('says it is working while the request runs, and the buttons wait', async () => {
    let finish!: (value: SignalPromoteResponse) => void
    const { k, turnIntoLead, decisionButtons, leadButton } = await setup({ promote: () => new Promise((resolve) => { finish = resolve }) })
    await turnIntoLead()
    const running = k.withText('Creating lead…') as HTMLButtonElement
    assert.ok(running, 'the button says it is working')
    assert.equal(running.disabled, true)
    assert.ok(decisionButtons().every((b) => b.disabled), 'the decisions wait too')

    await k.act(async () => { finish(created()) })
    await k.tick(5)
    absent(leadButton())
    assert.ok(decisionButtons().every((b) => !b.disabled), 'and are free again')
  })

  it('does not create a second lead on a second press while the first is running', async () => {
    let finish!: (value: SignalPromoteResponse) => void
    const { k, turnIntoLead, promoteCalls, leadButton } = await setup({ promote: () => new Promise((resolve) => { finish = resolve }) })
    await turnIntoLead()

    // A second press on whatever the button now is. If it started a second question, it is answered yes, as an impatient person would.
    await k.click(k.withText('Creating lead…')!)
    await k.tick()
    const second = k.withText('Create lead')
    if (second) await k.click(second)
    await k.tick(5)
    assert.deepEqual(promoteCalls, [1], 'one request, however many presses')

    await k.act(async () => { finish(created()) })
    await k.tick(5)
    assert.deepEqual(promoteCalls, [1])
    absent(leadButton())
  })

  it('treats a lead that was already there as the same lead, not as an error', async () => {
    const { turnIntoLead, leadLink, leadButton, alerts, statuses, historyCalls, changed } = await setup({ promote: async () => created({ created: false }) })
    await turnIntoLead()
    assert.deepEqual(alerts(), [])
    assert.deepEqual(statuses(), ['This signal already has a lead, so no second one was made.'])
    assert.equal(changed[0].promoted_lead_id, '501')
    absent(leadButton())
    assert.equal(leadLink()!.getAttribute('href'), LEAD_HREF)
    assert.equal(historyCalls.length, 1, 'the server wrote nothing, so the history is not read again')
  })

  it('on a 403: says leads (not decisions), stops offering the button, and leaves the decisions alone', async () => {
    const { k, turnIntoLead, leadButton, alerts, promoteCalls, decisionButtons, changed } = await setup({ promote: async () => { throw Object.assign(new Error('Forbidden'), { status: 403 }) } })
    await turnIntoLead()
    assert.deepEqual(alerts(), [LEAD_FORBIDDEN_TEXT])
    assert.equal(LEAD_FORBIDDEN_TEXT, 'You are not allowed to create leads from signals.')
    assert.ok(!k.bodyText().includes(FORBIDDEN_TEXT), 'the decision wording is not used for leads')
    assert.equal(leadButton()!.disabled, true)
    assert.ok(decisionButtons().every((b) => !b.disabled), 'the 403 was about leads')
    assert.equal(changed.length, 0)
    await k.click(leadButton()!)
    await k.tick()
    absent(k.withText('Create lead'))
    assert.deepEqual(promoteCalls, [1])
  })

  it('on a network failure: says so, keeps the button, and the same press can be tried again', async () => {
    let attempts = 0
    const { k, turnIntoLead, leadButton, alerts, statuses, promoteCalls, leadLink, changed } = await setup({
      promote: async () => { attempts += 1; if (attempts === 1) throw new TypeError('Failed to fetch'); return created() },
    })
    await turnIntoLead()
    assert.deepEqual(alerts(), [NETWORK_TEXT])
    assert.equal(changed.length, 0)
    assert.equal(leadButton()!.disabled, false, 'a retry is possible')
    absent(leadLink())

    await turnIntoLead()
    assert.deepEqual(promoteCalls, [1, 1])
    assert.deepEqual(alerts(), [], 'the old message goes when the retry starts')
    assert.equal(statuses().length, 1)
    assert.equal(leadLink()!.getAttribute('href'), LEAD_HREF)
    assert.ok(k.bodyText().includes('Lead created'))
  })

  it('on a 404: says the signal can no longer be found, and creates nothing', async () => {
    const { turnIntoLead, alerts, leadButton, changed } = await setup({ promote: async () => { throw Object.assign(new Error('Opportunity not found'), { status: 404 }) } })
    await turnIntoLead()
    assert.deepEqual(alerts(), [NOT_FOUND_TEXT])
    assert.equal(changed.length, 0)
    assert.ok(leadButton())
  })

  it('on an answer that names no lead: does not pretend one was made', async () => {
    const { turnIntoLead, alerts, changed, leadButton, historyCalls } = await setup({ promote: async () => ({ status: 1, data: {} } as unknown as SignalPromoteResponse) })
    await turnIntoLead()
    assert.deepEqual(alerts(), [NO_LEAD_ID_TEXT])
    assert.equal(changed.length, 0)
    assert.ok(leadButton())
    assert.equal(historyCalls.length, 1)
  })

  it('is offered for whichever tab is open', async () => {
    const { k, leadButton, tab } = await setup()
    await k.click(tab('Fit and score'))
    assert.ok(leadButton(), 'still in the footer on the second tab')
  })
})

describe('the drawer tabs', () => {
  afterEach(disposeAll)

  it('opens on Overview, with the existing content, and builds only that tab', async () => {
    const { k, selectedTabs } = await setup({ signal: richSignal() })
    assert.equal(k.one('[role="tablist"]')?.getAttribute('aria-label'), 'Signal details')
    assert.deepEqual(k.all('[role="tab"]').map((t) => t.textContent), ['Overview', 'Fit and score'])
    assert.deepEqual(selectedTabs(), ['Overview'])
    const text = k.bodyText()
    assert.ok(text.includes('Why it matters'))
    assert.ok(text.includes('Evidence'))
    assert.ok(text.includes('History'))
    assert.ok(!text.includes('Fit with the product'))
    assert.ok(!text.includes('Needs and matched offers'))
  })

  it('moves between tabs with the arrow keys, Home and End, and the focus goes with the selection', async () => {
    const { k, tab, selectedTabs } = await setup({ signal: richSignal() })
    await k.act(async () => { tab('Overview').focus() })

    await k.press('ArrowRight')
    assert.deepEqual(selectedTabs(), ['Fit and score'])
    assert.ok(k.w.document.activeElement === tab('Fit and score'), 'the focus moved with the selection')
    assert.ok(k.bodyText().includes('Fit with the product'))
    assert.ok(!k.bodyText().includes('Why it matters'), 'the first tab’s content is gone')

    await k.press('ArrowLeft')
    assert.deepEqual(selectedTabs(), ['Overview'])
    assert.ok(k.w.document.activeElement === tab('Overview'), 'the focus moved with the selection')
    assert.ok(k.bodyText().includes('Why it matters'))

    await k.press('End')
    assert.deepEqual(selectedTabs(), ['Fit and score'])
    await k.press('Home')
    assert.deepEqual(selectedTabs(), ['Overview'])
    await k.press('ArrowLeft')
    assert.deepEqual(selectedTabs(), ['Fit and score'], 'it wraps round')
  })

  it('is a real tab pattern: one tab in the tab order, each tab linked to its panel', async () => {
    const { k, tab } = await setup({ signal: richSignal() })
    assert.deepEqual(k.all('[role="tab"]').map((t) => t.getAttribute('tabindex')), ['0', '-1'])
    await k.click(tab('Fit and score'))
    assert.deepEqual(k.all('[role="tab"]').map((t) => t.getAttribute('tabindex')), ['-1', '0'])
    for (const t of k.all('[role="tab"]')) {
      const panel = k.w.document.getElementById(t.getAttribute('aria-controls')!)
      assert.ok(panel, `${t.textContent} controls a panel that exists`)
      assert.equal(panel!.getAttribute('role'), 'tabpanel')
      assert.equal(panel!.getAttribute('aria-labelledby'), t.id)
    }
  })

  it('keeps the tab out of the page address', async () => {
    const { k, tab, router } = await setup({ signal: richSignal() })
    await k.click(tab('Fit and score'))
    await k.press('ArrowLeft', tab('Fit and score'))
    await k.click(tab('Fit and score'))
    assert.deepEqual(router.written, [], 'nothing was written to the address')
    assert.equal(k.w.location.search, '')
  })

  it('keeps the decision buttons in the footer on both tabs', async () => {
    const { k, tab, decisionButtons } = await setup({ signal: richSignal() })
    const onOverview = decisionButtons().map((b) => b.textContent)
    await k.click(tab('Fit and score'))
    assert.deepEqual(decisionButtons().map((b) => b.textContent), onOverview)
    assert.deepEqual(onOverview, ['Contacted', 'Reviewed', 'Not relevant…'])
  })

  it('does not read the history again when the tab is left and come back to', async () => {
    const { k, tab, historyCalls, seen } = await setup({ signal: richSignal() })
    await k.click(tab('Fit and score'))
    await k.click(tab('Overview'))
    await k.tick(5)
    assert.equal(historyCalls.length, 1)
    assert.equal(seen.list?.entries?.length, 1)
    assert.ok(k.bodyText().includes('history entries: 1'))
  })

  it('opens the next signal on Overview', async () => {
    const { k, tab, selectedTabs, setSignal } = await setup({ signal: richSignal() })
    await k.click(tab('Fit and score'))
    assert.deepEqual(selectedTabs(), ['Fit and score'])
    await setSignal(richSignal({ id: 2, title: 'Another signal' }))
    await k.tick(5)
    assert.deepEqual(selectedTabs(), ['Overview'])
  })
})

describe('the Fit and score tab', () => {
  afterEach(disposeAll)

  const openFit = async (signal: SignalRow) => {
    const s = await setup({ signal })
    await s.k.click(s.tab('Fit and score'))
    return s
  }
  const scoreRows = (k: Awaited<ReturnType<typeof setup>>['k']) => k.all('ul[aria-label="The parts of the score"] li').map((li) => li.textContent)

  it('shows what the server recorded: the score and its parts, the fit and its parts, the reasoning, the needs and the matched offers', async () => {
    const { k } = await openFit(richSignal())
    const text = k.bodyText()

    assert.ok(text.includes('24'), 'the total score')
    assert.ok(text.includes('total score'))
    assert.deepEqual(scoreRows(k), ['Buying signal4', 'Problem fit4', 'Product fit3', 'Accessibility3', 'Urgency4', 'Potential value3', 'Evidence quality3'])
    assert.ok(text.includes('A live tender with a closing date and fourteen named schools.'))

    assert.ok(text.includes('80 of 100'))
    assert.ok(text.includes('band: High'))
    assert.ok(text.includes('20 of 20'))
    assert.ok(text.includes('18 of 25'))
    assert.ok(text.includes('A stored part of the product'))
    assert.ok(text.includes('The quote was found in the page that was read'))

    assert.ok(text.includes('Scholar'))
    assert.ok(text.includes('matched offer: Scholar Core'))
    assert.ok(text.includes('Confirmed: the source itself says this'))
    assert.ok(text.includes('High'), 'the confidence')
    assert.ok(text.includes('N05, N07'))

    assert.ok(text.includes('Scholar Core'))
    assert.ok(text.includes('Match score 78'))
    assert.ok(text.includes('Admissions and fees are named in the notice.'))
    assert.ok(text.includes('Shared needs: N05'))
    assert.ok(text.includes('Scholar Lite'))
    assert.ok(text.includes('Match score not recorded'))
    assert.ok(text.includes('No reason was stored for this match.'))
  })

  it('says plainly when a part was not recorded, and fills nothing in', async () => {
    const { k } = await openFit(signalRow({
      scores: { total: 24, buying_signal: 4 }, assessment: null, score_reasoning: null, strength_reason: null, confidence: null, claim_level: null,
      candidate_need_codes: [], matched_offers: [], business_fit: null, product_master_name: null, relevant_offer_name: null,
    }))
    const text = k.bodyText()

    assert.deepEqual(scoreRows(k), ['Buying signal4', 'Problem fitNot recorded', 'Product fitNot recorded', 'AccessibilityNot recorded', 'UrgencyNot recorded', 'Potential valueNot recorded', 'Evidence qualityNot recorded'])
    assert.ok(text.includes('The parts marked “Not recorded” were not stored with this signal.'))
    assert.ok(text.includes('No reasoning was recorded for the score.'))
    assert.ok(text.includes('No fit assessment was recorded for this signal.'))
    assert.ok(text.includes('No product offer was matched to this signal.'))
    assert.ok(text.includes('No product'))
    // Business fit, Fit total, How sure, Confidence and Need codes are each "Not recorded" in the definition lists.
    const dl = k.all('dl').map((d) => d.textContent ?? '')
    assert.ok(dl[0].includes('Business fitNot recorded'))
    assert.ok(dl[0].includes('Fit totalNot recorded'))
    assert.ok(dl[0].includes('How sureNot recorded'))
    assert.ok(dl[0].includes('ConfidenceNot recorded'))
    assert.ok(dl[1].includes('Need codesNot recorded'))
  })

  it('says a signal that was never scored was not scored, and shows no score number', async () => {
    const { k } = await openFit(signalRow({ scores: null }))
    assert.ok(k.bodyText().includes('This signal was not scored.'))
    assert.equal(k.all('ul[aria-label="The parts of the score"]').length, 0)
    assert.ok(!k.bodyText().includes('total score'))
  })

  it('says when only the total was recorded', async () => {
    const { k } = await openFit(signalRow({ scores: { total: 24 } }))
    assert.ok(k.bodyText().includes('Only the total was recorded; the parts it is made of were not.'))
    assert.equal(scoreRows(k).filter((row) => row?.endsWith('Not recorded')).length, 7)
  })

  it('invents no strength word and no band: the band is the server\'s or nothing', async () => {
    const withoutBand = richSignal()
    withoutBand.assessment = { ...withoutBand.assessment!, fit: { ...withoutBand.assessment!.fit!, band: undefined } }
    const { k } = await openFit(withoutBand)
    const text = k.bodyText()
    assert.ok(text.includes('80 of 100'), 'the number is still shown')
    assert.ok(!text.includes('band:'), 'no band when the server sent none')
    assert.ok(!/\b(Strong|Weak)\b/.test(text), 'no made-up label')
  })

  it('claims no maximum for the score, which has no scale in the data', async () => {
    const { k } = await openFit(richSignal())
    const score = k.one('#sr-score-heading')!.parentElement!.textContent!
    assert.ok(!/\bof \d+/.test(score), `the score section carries no "of N": ${score}`)
    assert.ok(!score.includes('out of'))
  })

  it('shows only the fit total when its parts were not recorded', async () => {
    const signal = richSignal()
    signal.assessment = { ...signal.assessment!, fit: { total: 61, band: 'Medium' } }
    const { k } = await openFit(signal)
    const text = k.bodyText()
    assert.ok(text.includes('61'))
    assert.ok(!text.includes('61 of'), 'no maximum is claimed without the parts')
    assert.ok(text.includes('band: Medium'))
    assert.ok(text.includes('The parts of this fit were not recorded.'))
  })
})
