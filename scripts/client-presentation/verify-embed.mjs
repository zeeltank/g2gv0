// Proves the customer presentation plays INSIDE the real My Learning screen (no backend needed: the learning API is answered by the test).
//   node scripts/client-presentation/verify-embed.mjs [--base http://localhost:3210]
// Opens /module/lms/learning/my-learning?course_id=207 with a browser-only test session, mocks /api/lms/learning/*, then checks:
//  1. lesson 1 shows the deck in a frame (not the "opens in a new tab" card), with Full screen and New tab buttons
//  2. the frame loads the same-origin deck with embed=1 and the header reports "Slide n of 15"
//  3. stepping the deck calls the progress API once (lesson started), and reaching the last slide marks the lesson complete
//  4. lesson 2 (?mode=short) shows "Slide n of 5"
// Exit 1 on any failure. The session holds no token and the mocked responses hold no real data.
import { createRequire } from 'node:module'
import { readdirSync } from 'node:fs'

const arg = (n, d) => { const i = process.argv.indexOf('--' + n); return i < 0 ? d : process.argv[i + 1] }
const base = arg('base', 'http://localhost:3210')
const ORIGIN = new URL(base).origin
const require = createRequire('C:/Users/MILAN/Downloads/lms_k12/')
const { chromium } = require('playwright-core')
const exe = readdirSync(process.env.LOCALAPPDATA + '/ms-playwright').filter((d) => d.startsWith('chromium-') && !d.includes('headless')).map((d) => `${process.env.LOCALAPPDATA}/ms-playwright/${d}/chrome-win64/chrome.exe`)[0]

const fails = []; const notes = []
const ok = (c, m) => { if (!c) fails.push(m) }

const lesson = (id, title, url, status = 'not-started') => ({
  id, chapter_id: 237, title, description: 'x', filename: null, file_type: 'link', file_size: null, url, content_category: 'Interactive deck',
  sort_order: id - 274, show_hide: 1, status, last_position_seconds: null, time_spent_seconds: 0, completed_at: null, is_locked: false,
})
const state = { l1: 'not-started', l2: 'not-started' }
const calls = []
const detail = () => ({
  course: { id: 207, display_name: 'ScholarClone: What is your school not seeing?', display_image: null, subject_category: null, subject_type: 'Self-paced course', subject_code: null, short_name: null, jobrole: null, standard_id: 131, standard_name: null },
  enrollment: { id: 1, status: 'enrolled', start_date: '2026-11-23', end_date: null },
  chapters: [{ id: 237, chapter_name: 'Customer presentation (interactive)', chapter_desc: null, standard_id: 131, subject_id: 207, sort_order: 1, show_hide: 1, total_content: 2, completed_content: 0,
    content: [lesson(275, 'Full presentation', `${ORIGIN}/module/lms/learning/client-presentation/scholarclone`, state.l1), lesson(276, 'Five-slide version', `${ORIGIN}/module/lms/learning/client-presentation/scholarclone?mode=short`, state.l2)] }],
  total_content: 2, completed_content: 0, total_sessions: 0, attended_sessions: 0, progress_percent: 0, time_spent_seconds: 0, content_categories: ['Interactive deck'], certificate_available: false,
})

const browser = await chromium.launch({ executablePath: exe, headless: true })
const ctx = await browser.newContext({ viewport: { width: 1600, height: 1000 } })
await ctx.addCookies([{ name: 'gtg-session', value: '1', domain: new URL(base).hostname, path: '/' }])
await ctx.addInitScript(() => {
  localStorage.setItem('userData', JSON.stringify({ user_id: 1, token: 'local-test-session', sub_institute_id: 6, syear: 2026, user_profile_name: 'Admin', client_id: 6 }))
  localStorage.setItem('gtg-session', JSON.stringify({ user: { id: 1, email: 'test@local', name: 'Local test', role: 'admin', profileName: 'Admin', subInstituteId: 6, syear: 2026 }, isAuthenticated: true, isLoading: false }))
})
const page = await ctx.newPage()
const errs = []
page.on('pageerror', (e) => errs.push('PAGEERROR ' + String(e).slice(0, 200)))
await page.route('**/api/lms/learning/**', async (route) => {
  const req = route.request(); const u = new URL(req.url())
  if (req.method() === 'POST') {
    let body = {}; try { body = req.postDataJSON() ?? {} } catch { /* form data */ }
    calls.push({ path: u.pathname, body })
    if (/\/progress$/.test(u.pathname) && String(body.status ?? '') === 'completed') { if (String(body.content_id) === '275') state.l1 = 'completed'; else state.l2 = 'completed' }
    return route.fulfill({ json: { status: true, data: { total_content: 2, completed_content: 0, progress_percent: 0 } } })
  }
  if (/\/courses\/207$/.test(u.pathname)) return route.fulfill({ json: { status: true, data: detail() } })
  if (/\/courses$/.test(u.pathname)) return route.fulfill({ json: { status: true, data: [{ id: 207, display_name: 'ScholarClone: What is your school not seeing?', display_image: null, subject_category: null, subject_type: 'Self-paced course', standard_id: 131, standard_name: null, enrollment_id: 1, enrollment_status: 'enrolled', start_date: '2026-11-23', end_date: null, total_content: 2, completed_content: 0, total_sessions: 0, attended_sessions: 0, progress_percent: 0 }] } })
  return route.fulfill({ json: { status: true, data: [] } })
})

await page.goto(`${base}/module/lms/learning/my-learning?course_id=207`, { waitUntil: 'domcontentloaded', timeout: 90000 })
// 1. the deck is in a frame, not the "opens in a new tab" card
await page.locator('[data-testid="client-presentation-launcher"]').or(page.getByText('This lesson opens in a new tab')).first().waitFor({ timeout: 90000 })
ok(await page.locator('[data-testid="client-presentation-launcher"]').count() === 1, 'lesson 1 did not show the in-page presentation')
ok(await page.locator('text=This lesson opens in a new tab').count() === 0, 'lesson 1 still shows the "opens in a new tab" card')
ok(await page.getByRole('button', { name: /Full screen/ }).count() > 0, 'no Full screen button')
ok(await page.getByRole('button', { name: /New tab/ }).count() > 0, 'no New tab button')
// 2. the frame
const iframe = page.locator('[data-testid="client-presentation-launcher"] iframe')
const src = await iframe.getAttribute('src')
ok(/^\/module\/lms\/learning\/client-presentation\/scholarclone\?embed=1$/.test(src ?? ''), `frame src is not the same-origin embed address: ${src}`)
await page.waitForSelector('text=/Slide \\d+ of 15/', { timeout: 60000 })
notes.push('1-2 lesson 1 plays inside My Learning; header: ' + (await page.locator('text=/Slide \\d+ of \\d+/').first().textContent()))
const frame = page.frameLocator('[data-testid="client-presentation-launcher"] iframe')
await frame.locator('.cp-scene').first().waitFor({ timeout: 60000 })
// 3. step through to the last slide: the first step starts the lesson, the end completes it
await frame.locator('.cp-root').click({ position: { x: 300, y: 300 } })
for (let i = 0; i < 90; i++) { await page.keyboard.press('ArrowRight'); await page.waitForTimeout(60) }
await page.waitForTimeout(1500)
const progressCalls = calls.filter((c) => /\/progress$/.test(c.path))
ok(progressCalls.length >= 1, 'the lesson was never marked started')
ok(progressCalls.some((c) => String(c.body.status ?? '') === 'completed'), 'reaching the last slide did not mark the lesson complete: ' + JSON.stringify(progressCalls.map((c) => c.body)).slice(0, 300))
notes.push(`3 progress calls: ${progressCalls.length}; statuses: ${[...new Set(progressCalls.map((c) => c.body.status))].join(',')}`)
// 4. lesson 2 is the five-slide version
await page.getByRole('button', { name: 'Next', exact: true }).last().click()
await page.waitForSelector('text=/Slide \\d+ of 5/', { timeout: 60000 }).then(() => notes.push('4 lesson 2 header shows "of 5"')).catch(() => ok(false, 'lesson 2 did not show "Slide n of 5"'))
await page.screenshot({ path: process.env.EMBED_SHOT || 'embed-check.png' })
await browser.close()
for (const n of notes) console.log('note  ' + n)
for (const e of errs) console.log('warn  ' + e)
for (const f of fails) console.log('FAIL  ' + f)
console.log(fails.length ? `\n${fails.length} failure(s)` : '\nall checks passed')
process.exit(fails.length ? 1 : 0)
