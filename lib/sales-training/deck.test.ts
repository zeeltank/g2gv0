import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

import { branchProblem, continueTarget, parseSalesDeck, salesTrainingKeyOf, SalesDeckError, type SalesDeck } from './deck'

const load = () => JSON.parse(readFileSync('public/sales-training/sales/deck.json', 'utf8'))

test('the G2G sales deck parses, stays within 30-40 slides, and every conversation answer opens a different slide', () => {
  const deck = parseSalesDeck(load())
  assert.equal(deck.product.key, 'sales')
  assert.ok(deck.slides.length >= 30 && deck.slides.length <= 40, 'slide count ' + deck.slides.length)
  const decisions = deck.slides.filter((s) => s.interaction?.kind === 'decision')
  assert.equal(decisions.length, 4)
  for (const d of decisions) {
    const i = d.interaction
    if (i?.kind !== 'decision') continue
    assert.equal(i.options.length, 4)
    assert.equal(new Set(i.options.map((o) => o.goto)).size, i.options.length, 'slide ' + d.n + ' answers share a destination')
  }
})

test('the roles slide offers every documented role; each role lists modules that open a talk track; the modules slide lists 11', () => {
  const deck = parseSalesDeck(load())
  const bySlide = new Map(deck.slides.map((s) => [s.n, s]))
  const nav: string[] = []
  const roles = deck.slides.find((s) => s.title === 'Roles')!
  const roleLinks = (roles.links ?? []).filter((l) => !nav.includes(l.label))
  assert.equal(roleLinks.length, 6)
  for (const name of ['HR Admin', 'Manager', 'Employee', 'Finance Admin', 'Principal', 'Super Admin / Admin']) assert.ok(roleLinks.some((l) => l.label.startsWith(name)), 'role missing: ' + name)
  assert.ok(!roleLinks.some((l) => /department head/i.test(l.label)), 'an undocumented role was added')
  for (const l of roleLinks) {
    const role = bySlide.get(l.goto ?? -1)!
    assert.ok(role.content.bullets.length >= 2, role.title + ' lists fewer than two modules')
    const moduleLinks = (role.links ?? []).filter((x) => role.content.bullets.some((b) => b.startsWith(bySlide.get(x.goto ?? -1)!.title + ':')))
    assert.equal(moduleLinks.length, role.content.bullets.length, role.title + ': every module line needs a link')
  }
  const modules = deck.slides.find((s) => s.title === 'Modules')!
  const modLinks = (modules.links ?? []).filter((l) => !nav.includes(l.label))
  assert.equal(modLinks.length, 11)
})

test('every module talk track links to a features slide, the roles that use it and a discovery question', () => {
  const deck = parseSalesDeck(load())
  const bySlide = new Map(deck.slides.map((s) => [s.n, s]))
  const modules = deck.slides.find((s) => s.title === 'Modules')!
  const talk = (modules.links ?? []).filter((l) => !false).map((l) => bySlide.get(l.goto ?? -1)!)
  for (const s of talk) {
    assert.ok((s.links ?? []).some((l) => l.label.startsWith('Feature: ') && bySlide.get(l.goto ?? -1)!.title.endsWith('features to demonstrate')), s.title + ': no features link')
    assert.ok((s.links ?? []).some((l) => l.label.startsWith('Used by: ')), s.title + ': no role links')
    assert.ok(s.content.bullets.some((b) => b.startsWith('Ask: ')), s.title + ': no discovery question')
    assert.ok(s.content.bullets.some((b) => b.startsWith('Why the customer needs it: ')), s.title + ': no why')
  }
})

test('every slide can be reached from slide 1 by following choices, buttons, links and Continue', () => {
  const deck = parseSalesDeck(load())
  const seen = new Set<number>([1])
  const queue = [1]
  while (queue.length) {
    const at = queue.shift()
    const s = deck.slides.find((x) => x.n === at)!
    const next: number[] = []
    const c = continueTarget(deck, s)
    if (c !== null) next.push(c)
    if (s.interaction?.kind === 'decision') next.push(...s.interaction.options.map((o) => o.goto))
    if (s.interaction?.kind === 'outcome') next.push(...s.interaction.actions.map((a) => a.goto))
    next.push(...(s.links ?? []).flatMap((l) => (l.goto === undefined ? [] : [l.goto])))
    for (const n of next) if (!seen.has(n)) { seen.add(n); queue.push(n) }
  }
  assert.deepEqual(deck.slides.filter((s) => !seen.has(s.n)).map((s) => s.n), [])
})

test('a deck that names a slide that does not exist is refused, in answers and in links', () => {
  const broken = JSON.parse(JSON.stringify(load())) as SalesDeck
  const d = broken.slides.find((s) => s.interaction?.kind === 'decision')!
  if (d.interaction?.kind === 'decision') d.interaction.options[0].goto = 9999
  assert.match(branchProblem(broken.slides) ?? '', /does not exist/)
  assert.throws(() => parseSalesDeck(broken), SalesDeckError)

  const brokenLink = JSON.parse(JSON.stringify(load())) as SalesDeck
  brokenLink.slides.find((s) => (s.links ?? []).length > 0)!.links![0].goto = 9999
  assert.match(branchProblem(brokenLink.slides) ?? '', /"[^"]+" opens slide 9999/)
})

test('Continue waits on a slide that needs a choice, and otherwise goes to the next slide', () => {
  const deck = parseSalesDeck(load())
  const decision = deck.slides.find((s) => s.interaction?.kind === 'decision')!
  assert.equal(continueTarget(deck, decision), null)
  assert.equal(continueTarget(deck, deck.slides[0]), 2) // Start lesson opens Roles; the cover also lists every section
  assert.ok((deck.slides[0].links ?? []).length >= 5, 'the cover must offer the five sections')
  const plain = { ...deck.slides[1], next: undefined, interaction: null }
  assert.equal(continueTarget(deck, plain), deck.slides[1].n + 1)
})

test('a lesson link is recognised as sales training on any host, and nothing else is', () => {
  assert.equal(salesTrainingKeyOf('/module/lms/learning/sales-training/sales'), 'sales')
  assert.equal(salesTrainingKeyOf('https://lms.example.com/module/lms/learning/sales-training/sales?x=1'), 'sales')
  assert.equal(salesTrainingKeyOf('http://localhost:3001/module/lms/learning/sales-training/g2g/'), 'sales')
  assert.equal(salesTrainingKeyOf('https://cdn.example.com/files/deck.pptx'), null)
  assert.equal(salesTrainingKeyOf('/module/lms/learning/sales-training'), null)
  assert.equal(salesTrainingKeyOf('/module/lms/learning/sales-training/other'), null)
  assert.equal(salesTrainingKeyOf(null), null)
})

test('the six top-navigation buttons open real slides and every slide belongs to one of them', () => {
  const deck = parseSalesDeck(load())
  assert.deepEqual((deck.nav ?? []).map((b) => b.label), ['Home', 'Roles', 'Modules', 'Business Problems', 'Solutions', 'Sales Scenarios'])
  for (const b of deck.nav ?? []) assert.ok(deck.slides.some((s) => s.n === b.goto), b.label + ' opens a missing slide')
  for (const s of deck.slides) assert.ok((deck.nav ?? []).some((b) => b.label === s.group), 'slide ' + s.n + ' has no navigation group')
})
