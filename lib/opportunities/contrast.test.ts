import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, it } from 'node:test'
import { color, dark, light, MIN, ratio, token } from '../theme-contrast'
import { FIELD_ERROR_TEXT, NOTICE_TONE, TEXT_ON_SURFACE } from './tones'

/**
 * What the opportunity screens gained with slice 11b must read at 4.5:1 or better, in the light theme and the dark one.
 *
 * Why this exists: the first Organisation 360 and agent screens used a status colour as text on a tint of itself (`text-success` on `bg-success/15`) and read
 * as low as 1.89:1; hundreds of jsdom tests could not see it, because jsdom computes no colour, and a real browser's axe run found it. The method is the same
 * here (and the same scan as lib/agent/contrast.test.ts, lib/leads/contrast.test.ts and lib/campaigns/contrast.test.ts, with this track's files in place of
 * theirs): ratios come from the REAL theme (app/globals.css: the `:root` block and the `.dark` block) and from the class strings in lib/opportunities/tones.ts.
 * Tests run from the repository root.
 */

describe('contrast of the opportunity screens\' new text', () => {
  for (const { name, classes } of TEXT_ON_SURFACE) {
    for (const [theme, vars] of [['light', light], ['dark', dark]] as const) {
      it(`${name} reads at ${MIN}:1 or better in the ${theme} theme`, () => {
        const text = color(`var(${token(classes, 'text')})`, vars)
        const surface = color(`var(${token(classes, 'bg')})`, vars)
        const value = ratio(text, surface)
        assert.ok(value >= MIN, `${name} (${classes}) is ${value.toFixed(2)}:1 in the ${theme} theme`)
      })
    }
  }

  it('the error under a field is a dark red that passes on a card in both themes (the shared Field\'s text-destructive does not)', () => {
    // Tailwind's palette values for the two classes FIELD_ERROR_TEXT names. If the class changes, this fails until the colour is checked.
    const palette: Record<string, string> = { 'red-700': '#b91c1c', 'red-300': '#fca5a5' }
    const [lightClass, darkClass] = FIELD_ERROR_TEXT.split(/\s+/)
    assert.ok(lightClass.startsWith('text-') && darkClass.startsWith('dark:text-'), FIELD_ERROR_TEXT)
    const lightColor = palette[lightClass.slice('text-'.length)]
    const darkColor = palette[darkClass.slice('dark:text-'.length)]
    assert.ok(lightColor && darkColor, `${FIELD_ERROR_TEXT} names colours this test knows`)
    assert.ok(ratio(color(lightColor, light), color(light['--card'], light)) >= MIN, 'light')
    assert.ok(ratio(color(darkColor, dark), color(dark['--card'], dark)) >= MIN, 'dark')
    assert.ok(ratio(color(light['--destructive'], light), color(light['--card'], light)) < MIN || ratio(color(light['--destructive'], light), color(light['--background'], light)) < MIN, 'the shared red really is the weaker one')
  })

  it('the refusal notice takes its status colour from the border only', () => {
    assert.match(NOTICE_TONE.error, /\bborder-destructive\b/)
    assert.match(NOTICE_TONE.error, /\btext-foreground\b/)
    assert.match(NOTICE_TONE.error, /\bbg-card\b/)
  })
})

const crm = (name: string) => path.resolve('components/domain/crm', name)

/** The lines of each edited file that belong to this track; the rest were there before and are not this track's to judge. */
const MODAL_MARKER = /\bOpportunityProductSelect\b|\bLossReasonSelect\b|[pP]roductOptions|[pP]roductValue|\blossReasons\b|\blossCode\b|\breasonError\b|productPayload|lossReasonPayload|chosenProduct|readRefusal|entersClosedLost|isClosedLost|lossReasonProblem|lossReasonView|data-opportunity-reason-fields|\bshowCampaign\b|\bmayPickCampaign\b|\bcampaignsRefused\b|data-opportunity-campaign-field|useSidebarNavigation|CRM_CAMPAIGNS_ACCESS_LINK/
const KANBAN_MARKER = /\bLossReasonDialog\b|\blossDialog\b|\bsubmitLoss\b|\bcancelLoss\b|\basking\b|\brefusal\b|\blossReasons\b|\bfocusAfterLoad\b|\bfindCard\b|\baskedId\b|data-opportunity-card|stageChangePayload|entersClosedLost|readRefusal|Opportunity pipeline board/
const LIST_MARKER = /\bproductSeen\b|data-opportunity-product|opportunityColumnCount|noteProductSeen/
const DETAIL_MARKER = /\bOpportunityProductLine\b|\bReasonLostCard\b/

/** A colour set in an inline `style={{ ... }}`. The text between `{{` and `}}` may hold a `${...}` template, so this stops at the closing `}}` and not at the first `}`. */
const INLINE_COLOUR = /style=\{\{(?:(?!\}\})[\s\S])*(color|background)/i
const STATUS_TEXT = /\btext-(success|warning|destructive|primary)\b(?!-)/
const STATUS_TINT = /\b(?:bg|border)-(?:success|warning|destructive|primary|muted-foreground)\/\d+/

describe('the new opportunity components keep to those looks (a scan, because the bug was a class string)', () => {
  /** Files this track wrote whole: every line is scanned. */
  const mine = [crm('opportunity-parts.tsx'), crm('opportunity-form-options.ts'), crm('campaign-options.ts')]
  /** Files this track only added to: only the lines that use a new part are scanned. */
  const edited: Array<{ file: string; marker: RegExp }> = [
    { file: crm('opportunity-kanban-view.tsx'), marker: KANBAN_MARKER },
    { file: crm('opportunity-list-view.tsx'), marker: LIST_MARKER },
    { file: crm('opportunity-detail-page.tsx'), marker: DETAIL_MARKER },
    { file: crm('create-opportunity-modal.tsx'), marker: MODAL_MARKER },
  ]

  const scan = (file: string, marker: RegExp | null, test: (line: string) => boolean) => {
    const offences: string[] = []
    readFileSync(file, 'utf8').split(/\r?\n/).forEach((line, index) => {
      if ((marker === null || marker.test(line)) && test(line)) offences.push(`${path.basename(file)}:${index + 1}: ${line.trim().slice(0, 140)}`)
    })
    return offences
  }
  const everything = (test: (line: string) => boolean) => [
    ...mine.flatMap((file) => scan(file, null, test)),
    ...edited.flatMap(({ file, marker }) => scan(file, marker, test)),
  ]

  it('the scan really reads the lines it is meant to (each marker finds something, so a rename cannot empty the scan)', () => {
    for (const { file, marker } of edited) assert.ok(scan(file, marker, () => true).length >= 2, `${path.basename(file)}: too few lines carry ${marker}`)
    assert.ok(readFileSync(mine[0], 'utf8').split(/\r?\n/).length > 100)
  })

  it('uses no status colour as TEXT (a link included), and no tint of one as a surface; an icon, which is aria-hidden, may be coloured', () => {
    const offences = everything((line) => (STATUS_TEXT.test(line) && !line.includes('aria-hidden')) || STATUS_TINT.test(line))
    assert.deepEqual(offences, [], 'the status colour is only a border; the words are text-foreground on a solid surface')
  })

  it('uses no shared Badge or StatusBadge (their variants are a status colour as text on a tint of itself)', () => {
    assert.deepEqual(everything((line) => /components\/ui\/(status-)?badge|<(Status)?Badge\b/.test(line)), [])
  })

  it('draws no surface on a tint of the muted colour', () => {
    assert.deepEqual(everything((line) => /\bbg-muted\/\d+/.test(line) && !/\bhover:bg-muted\/\d+/.test(line)), [])
  })

  it('writes no colour of its own in the parts: the error red and the refusal look come from tones.ts', () => {
    const source = readFileSync(mine[0], 'utf8')
    assert.equal(/\b(bg|text|border)-(success|warning|destructive|amber|red|green|emerald|orange)\b/.test(source), false)
    assert.equal(INLINE_COLOUR.test(source), false, 'no inline colour')
    assert.ok(source.includes('FIELD_ERROR_TEXT') && source.includes('NOTICE_TONE.error'), 'the component takes its classes from tones.ts, so the contrast test checks what is drawn')
  })

  it('asks nothing with the browser\'s own prompt, confirm or alert', () => {
    const offences = [...mine.map((file) => file), ...edited.map((entry) => entry.file)].filter((file) => file !== crm('opportunity-list-view.tsx')).flatMap((file) => scan(file, null, (line) => /\bwindow\.(prompt|alert|confirm)\(|\b(prompt|alert)\(/.test(line)))
    assert.deepEqual(offences, [], 'the board asks in a dialog; the list\'s existing bulk-delete confirm is not this track\'s')
  })

  it('the scans can fail: they flag the offences they are written for, and not the real code', () => {
    assert.equal(INLINE_COLOUR.test('<div style={{ width: `${percent}%`, background: \'green\' }} />'), true)
    assert.equal(INLINE_COLOUR.test('<div style={{ color: \'red\' }} />'), true)
    assert.equal(INLINE_COLOUR.test('<div style={{ width: `${percent}%` }} />'), false)
    assert.equal(STATUS_TEXT.test('<p className="text-xs text-destructive">'), true)
    assert.equal(STATUS_TEXT.test('<p className="text-xs text-muted-foreground">'), false)
    assert.equal(STATUS_TEXT.test('<div className="border-destructive text-foreground">'), false)
    assert.equal(STATUS_TINT.test('<div className="border-destructive/30 bg-destructive/5">'), true)
    assert.equal(STATUS_TINT.test('<div className="border-destructive bg-card">'), false)
    for (const line of ['const [productValue, setProductValue] = useState(\'\')', 'const productOptions = useProductOptions(context, isOpen)', 'lossReasonPayload(form.salesStage, lossCode, null, false)', '<LossReasonSelect reasons={lossReasons} />']) {
      assert.equal(MODAL_MARKER.test(line), true, `the form marker reads: ${line}`)
    }
    assert.equal(MODAL_MARKER.test('<Label htmlFor="opp-name">Opportunity Name *</Label>'), false, 'and leaves the lines of the form that were there before')
    assert.equal(KANBAN_MARKER.test('const [asking, setAsking] = useState<AskingAbout | null>(null)'), true)
    assert.equal(KANBAN_MARKER.test('<span className="truncate text-sm font-semibold text-foreground">{opportunity.name}</span>'), false)
  })
})
