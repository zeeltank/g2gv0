import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, it } from 'node:test'

/**
 * One set of cards (S20): Convert Lead and a signal's Convert to opportunity are drawn from the SAME Organization, Person and Opportunity cards
 * (components/domain/crm/convert-cards.tsx), so the two pop-ups cannot drift apart. A source scan, because the point is that there is no second copy of the markup.
 */
const read = (file: string) => readFileSync(path.resolve(file), 'utf8')
const CARDS = 'components/domain/crm/convert-cards.tsx'
const LEAD = 'components/domain/crm/convert-lead-dialog.tsx'
const SIGNAL = 'components/domain/signals/convert-signal-dialog.tsx'

describe('the cards both conversion pop-ups share', () => {
  it('both pop-ups import the three cards from the one file', () => {
    for (const file of [LEAD, SIGNAL]) {
      const source = read(file)
      assert.match(source, /import \{[^}]*\bOrganizationCard\b[^}]*\} from '[^']*convert-cards'/, file)
      assert.match(source, /import \{[^}]*\bPersonCard\b[^}]*\} from '[^']*convert-cards'/, file)
      assert.match(source, /import \{[^}]*\bOpportunityCard\b[^}]*\} from '[^']*convert-cards'/, file)
      for (const card of ['<OrganizationCard', '<PersonCard', '<OpportunityCard']) assert.ok(source.includes(card), `${file} draws ${card}`)
    }
  })

  it('neither pop-up draws a card of its own: the fields, the switches and the picker exist in the shared file only', () => {
    const own = ['convert-org-name', 'convert-org-industry', 'convert-opp-amount', 'convert-opp-stage', 'convert-role', 'convert-link-existing', 'ConvertOrganizationPicker', 'CurrencySelect', 'data-details', 'function Card(', 'function SwitchRow(']
    for (const file of [LEAD, SIGNAL]) {
      const source = read(file)
      for (const piece of own) assert.equal(source.includes(piece), false, `${file} must not hold its own ${piece}`)
    }
    const cards = read(CARDS)
    for (const piece of own.filter((p) => !p.startsWith('function'))) assert.ok(cards.includes(piece), `the shared cards hold ${piece}`)
  })

  it('a signal\'s pop-up asks for what Convert Lead asks for, with the person optional', () => {
    const signal = read(SIGNAL)
    assert.ok(signal.includes('Add a person (optional)'))
    assert.ok(signal.includes('required'), 'the organization and the opportunity are always made')
    assert.equal(read(LEAD).includes('Add a person (optional)'), false, 'a lead keeps "Create person"')
  })
})
