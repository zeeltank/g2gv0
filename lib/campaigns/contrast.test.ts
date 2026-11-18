import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, it } from 'node:test'
import { color, dark, light, MIN, ratio, token } from '../theme-contrast'
import { FUNNEL_BAR, GRAPHIC_ON_SURFACE, MIN_GRAPHIC, TEXT_ON_SURFACE } from './tones'

/**
 * What the campaign screens gained with slice 9 must read at 4.5:1 or better (text) and 3:1 or better (the funnel bar), in the light theme and the dark one.
 *
 * Why this exists: the first Organisation 360 and agent screens used a status colour as text on a tint of itself (`text-success` on `bg-success/15`) and read
 * as low as 1.89:1; hundreds of jsdom tests could not see it, because jsdom computes no colour, and a real browser's axe run found it. The method is the same
 * here (and the same scan as lib/agent/contrast.test.ts and lib/leads/contrast.test.ts, with this track's files in place of theirs): ratios come from the REAL
 * theme (app/globals.css: the `:root` block and the `.dark` block) and from the class strings in lib/campaigns/tones.ts. Tests run from the repository root.
 */

describe('contrast of the campaign screens\' new text', () => {
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
})

describe('contrast of the funnel bar', () => {
  for (const { name, fill, surface } of GRAPHIC_ON_SURFACE) {
    for (const [theme, vars] of [['light', light], ['dark', dark]] as const) {
      it(`${name} is seen at ${MIN_GRAPHIC}:1 or better in the ${theme} theme`, () => {
        const value = ratio(color(`var(${token(fill, 'bg')})`, vars), color(`var(${token(surface, 'bg')})`, vars))
        assert.ok(value >= MIN_GRAPHIC, `${name} (${fill} on ${surface}) is ${value.toFixed(2)}:1 in the ${theme} theme`)
      })
    }
  }

  it('checks the bar the component draws (the same classes)', () => {
    assert.deepEqual(GRAPHIC_ON_SURFACE.map((pair) => [pair.fill, pair.surface]), [[FUNNEL_BAR.fill, FUNNEL_BAR.track]])
    const source = readFileSync(path.resolve('components/domain/crm/campaign-parts.tsx'), 'utf8')
    assert.ok(source.includes('FUNNEL_BAR.track') && source.includes('FUNNEL_BAR.fill'), 'the component takes the bar\'s classes from tones.ts, so this test checks what is drawn')
  })
})

/**
 * The lines of the campaign form that belong to this track. `[pP]roduct...` because the state setters are `setProductValue` and `setProductOptions`: the
 * first version of this marker said `productValue` and so never read the line that seeds the Product box (a mutation of that line was not caught).
 */
const MODAL_MARKER = /\bCampaignProductSelect\b|[pP]roductValue|[pP]roductOptions|productPayload|chosenProduct/

/**
 * A colour set in an inline `style={{ ... }}`. The text between `{{` and `}}` may hold a `${...}` template, so this stops at the closing `}}` and not at the first
 * `}`: the first version used `[^}]*`, which a bar width written as a template string (`${percent}%`) hid everything after from it.
 */
const INLINE_COLOUR = /style=\{\{(?:(?!\}\})[\s\S])*(color|background)/i

describe('the new campaign components keep to those looks (a scan, because the bug was a class string)', () => {
  const crm = (name: string) => path.resolve('components/domain/crm', name)
  /** Files this track wrote whole: every line is scanned. */
  const mine = [crm('campaign-parts.tsx')]
  /** Files this track only added to: only the lines that use a new part are scanned (the rest were there before and are not this track's to judge). */
  const edited: Array<{ file: string; marker: RegExp }> = [
    { file: crm('campaign-list-view.tsx'), marker: /\bproductSeen\b|data-campaign-product|campaignColumnCount/ },
    { file: crm('campaign-detail-page.tsx'), marker: /\bCampaign(Funnel|Links)Section\b/ },
    { file: crm('create-campaign-modal.tsx'), marker: MODAL_MARKER },
    { file: path.resolve('components/domain/gtm/campaigns-detail.tsx'), marker: /data-gtm-|productLine|crmLine|crmHref/ },
    { file: crm('lead-parts.tsx'), marker: /data-lead-campaign|leadCampaignName|\bcampaign\b/ },
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
    for (const { file, marker } of edited) assert.ok(scan(file, marker, () => true).length > 0, `${path.basename(file)}: no line carries ${marker}`)
    assert.ok(readFileSync(mine[0], 'utf8').split(/\r?\n/).length > 50)
  })

  it('uses no status colour as TEXT (a link included: text-primary is 4.16:1 on a card in the dark theme), and no tint of one as a surface; an icon, which is aria-hidden, may be coloured', () => {
    const offences = everything((line) => {
      const textColour = /\btext-(success|warning|destructive|primary)\b(?!-)/.test(line)
      const tint = /\b(?:bg|border)-(?:success|warning|destructive|primary|muted-foreground)\/\d+/.test(line)
      return (textColour && !line.includes('aria-hidden')) || tint
    })
    assert.deepEqual(offences, [], 'the status colour is only a border or an icon; the words are text-foreground on a solid surface')
  })

  it('uses no shared Badge or StatusBadge (their variants are a status colour as text on a tint of itself: Badge navy was 4.31:1 in the real browser)', () => {
    const offences = everything((line) => /components\/ui\/(status-)?badge|<(Status)?Badge\b/.test(line))
    assert.deepEqual(offences, [])
  })

  it('draws no surface on a tint of the muted colour (text-muted-foreground on it was never measured)', () => {
    const offences = everything((line) => /\bbg-muted\/\d+/.test(line) && !/\bhover:bg-muted\/\d+/.test(line))
    assert.deepEqual(offences, [])
  })

  it('draws the funnel with the solid pair of tones.ts and no colour of its own', () => {
    const source = readFileSync(mine[0], 'utf8')
    assert.equal(/\b(bg|text|border)-(success|warning|destructive|amber|red|green|emerald|orange)\b/.test(source), false)
    assert.equal(INLINE_COLOUR.test(source), false, 'the only inline style is the bar\'s width')
  })

  it('the scans can fail: they flag the offences they are written for, and not the real code', () => {
    assert.equal(INLINE_COLOUR.test('<div style={{ width: `${percent}%`, background: \'green\' }} />'), true, 'a colour set after a template string in the same style')
    assert.equal(INLINE_COLOUR.test('<div style={{ color: \'red\' }} />'), true)
    assert.equal(INLINE_COLOUR.test('<div style={{ width: `${percent}%` }} />'), false, 'the bar\'s own style is fine')
    for (const line of ['const [productValue, setProductValue] = useState(\'\')', 'setProductOptions([])', 'productPayload(null, 1, false)', 'chosenProduct(productValue)']) {
      assert.equal(MODAL_MARKER.test(line), true, `the form marker reads: ${line}`)
    }
    assert.equal(MODAL_MARKER.test('<Label htmlFor="campaign-name">Campaign Name</Label>'), false, 'and leaves the lines of the form that were there before')
  })
})
