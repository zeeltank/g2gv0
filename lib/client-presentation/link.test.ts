import assert from 'node:assert/strict'
import { test } from 'node:test'

import { clientPresentationLinkOf, clientPresentationPage } from './link'

const LIVE = 'https://g2gv0.vercel.app/module/lms/learning/client-presentation/scholarclone'

test('the full and the five-slide lesson links are recognised, whatever the host', () => {
  assert.deepEqual(clientPresentationLinkOf(LIVE), { key: 'scholarclone', mode: 'full' })
  assert.deepEqual(clientPresentationLinkOf(LIVE + '?mode=short'), { key: 'scholarclone', mode: 'short' })
  assert.deepEqual(clientPresentationLinkOf('http://localhost:3210/module/lms/learning/client-presentation/scholarclone/'), { key: 'scholarclone', mode: 'full' })
  assert.deepEqual(clientPresentationLinkOf(LIVE + '?embed=1&mode=short#x'), { key: 'scholarclone', mode: 'short' })
})

test('anything else is left alone: other products, other lesson links, the old sales training, empty values', () => {
  assert.equal(clientPresentationLinkOf(null), null)
  assert.equal(clientPresentationLinkOf(undefined), null)
  assert.equal(clientPresentationLinkOf(''), null)
  assert.equal(clientPresentationLinkOf('https://example.com/page'), null)
  assert.equal(clientPresentationLinkOf('/module/lms/learning/sales-training/scholarclone'), null)
  assert.equal(clientPresentationLinkOf('/module/lms/learning/client-presentation/unknown-product'), null)
  assert.equal(clientPresentationLinkOf('/module/lms/learning/client-presentation/scholarclone/extra'), null)
  assert.equal(clientPresentationLinkOf('https://evil.test/?u=/module/lms/learning/client-presentation/scholarclone'), null)
})

test('the frame address is always same-origin and carries embed and mode', () => {
  const full = { key: 'scholarclone', mode: 'full' } as const
  const short = { key: 'scholarclone', mode: 'short' } as const
  assert.equal(clientPresentationPage(full), '/module/lms/learning/client-presentation/scholarclone')
  assert.equal(clientPresentationPage(full, true), '/module/lms/learning/client-presentation/scholarclone?embed=1')
  assert.equal(clientPresentationPage(short, true), '/module/lms/learning/client-presentation/scholarclone?mode=short&embed=1')
})
