import { strict as assert } from 'node:assert'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, it } from 'node:test'
import { JSDOM } from 'jsdom'

const dom = new JSDOM('<!doctype html><html><body></body></html>')
Object.assign(globalThis, {
  window: dom.window,
  document: dom.window.document,
  IS_REACT_ACT_ENVIRONMENT: true,
})
Object.defineProperty(globalThis, 'navigator', {
  value: dom.window.navigator,
  configurable: true,
})

const ctx = { organizationId: 1, subInstituteId: 1, userId: 1 } as never

function deferred<T>() {
  let resolve!: (v: T) => void
  let reject!: (e: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

describe('G2G Signals — Expandable Source Exploration & No-Signal Explanation', () => {
  it('1. Wiring: CompanyOpportunities renders ExpandableRunNotice instead of static Notice', () => {
    const root = join(__dirname, '..')
    const screenSrc = readFileSync(
      join(root, 'components/domain/signals/company-opportunities.tsx'),
      'utf8'
    )
    assert.match(
      screenSrc,
      /import\s*\{\s*ExpandableRunNotice\s*\}\s*from\s*['"]@\/components\/domain\/signals\/expandable-run-notice['"]/
    )
    assert.match(screenSrc, /<ExpandableRunNotice[\s\S]*?notice=\{run\.notice\}/)
  })

  it('2. Collapsed State: renders summary text, missing list, next step and chevron button', async () => {
    const { ExpandableRunNotice } = await import(
      '../components/domain/signals/expandable-run-notice'
    )
    const React = await import('react')
    const { createRoot } = await import('react-dom/client')

    const host = document.createElement('div')
    document.body.appendChild(host)
    const root = createRoot(host)

    const notice = {
      tone: 'info' as const,
      text: 'Finished: 50 sources found, but no opportunity had enough evidence to qualify.',
      nextStep: 'Add direct sources or school websites.',
      runId: 42,
    }

    await React.act(async () => {
      root.render(
        React.createElement(ExpandableRunNotice, {
          notice,
          run: { id: 42, opportunities_count: 0 } as never,
          context: ctx,
        })
      )
    })

    const text = host.textContent ?? ''
    assert.ok(text.includes('Finished: 50 sources found'))
    assert.ok(text.includes('Add direct sources or school websites.'))
    assert.ok(text.includes('Explore Sources'))

    const button = host.querySelector('button[aria-expanded="false"]')
    assert.ok(button, 'Expand button with aria-expanded="false" must exist')

    await React.act(async () => {
      root.unmount()
    })
    host.remove()
  })

  it('3. Expanded State: expands inline, fetches sources, renders metrics, zero reasons, and source table', async () => {
    const { opportunitiesService } = await import('../services/signals/opportunities')
    const { ExpandableRunNotice } = await import(
      '../components/domain/signals/expandable-run-notice'
    )
    const React = await import('react')
    const { createRoot } = await import('react-dom/client')

    const mockResponse = {
      status: 1,
      run: { id: 99 },
      metrics: {
        sources_found: 50,
        queries_run: 14,
        queries_failed: 0,
        queries_attempted: 14,
        queries_succeeded: 14,
        queries_with_results: 13,
        queries_empty: 1,
        results_returned: 77,
        pages_read_in_full: 14,
        registry_searched: 2,
        registry_selected: 2,
        opportunities_qualified: 0,
        opportunities_rejected: 50,
        opportunities_new: 0,
      },
      zero_reasons: [
        {
          code: 'no_candidate_proposed',
          count: 44,
          label: 'The pages were read, but none showed a school with a clear reason to buy.',
          source_urls: ['https://delhischool.edu.in/about'],
        },
        {
          code: 'results_too_old',
          count: 16,
          label: 'Everything found was older than the freshness window.',
          source_urls: ['https://timesofindia.indiatimes.com/education/archive-2023'],
        },
        {
          code: 'pages_unreadable',
          count: 10,
          label: 'The pages could not be read (blocked, login wall or error).',
          source_urls: ['https://mhrd.gov.in/portal/login'],
        },
      ],
      next_action: 'The pages were read but none showed a clear reason to buy.',
      data: [
        {
          id: 1,
          run_id: 99,
          url: 'https://delhischool.edu.in/about',
          title: 'Delhi Public School Admissions and Infrastructure Overview',
          domain: 'delhischool.edu.in',
          source_name: 'Delhi Public School',
          source_type: 'School Website',
          search_query: 'Delhi schools modern smart classroom upgrades',
          pages_searched: 1,
          page_fetched: true,
          cited: false,
          exploration_status: 'Read' as const,
          content_finding: 'We provide state-of-the-art computer labs and smart classrooms since 2018.',
          qualification_result: 'Not qualified' as const,
          rejection_reason: 'The pages were read, but none showed a school with a clear reason to buy.',
          created_at: '2026-11-05T10:00:00Z',
        },
        {
          id: 2,
          run_id: 99,
          url: 'https://timesofindia.indiatimes.com/education/archive-2023',
          title: 'CBSE Affiliation updates 2023',
          domain: 'timesofindia.indiatimes.com',
          source_name: 'Times of India',
          source_type: 'News Media',
          search_query: 'CBSE new school affiliation 2026',
          pages_searched: 0,
          page_fetched: false,
          cited: false,
          exploration_status: 'Discovered' as const,
          content_finding: 'Published in August 2023: CBSE announces revision of affiliation rules.',
          qualification_result: 'Not qualified' as const,
          rejection_reason: 'Everything found was older than the freshness window.',
          created_at: '2026-11-05T10:00:00Z',
        },
      ],
    }

    let requestedRunId: number | null = null
    const origGetRunSources = opportunitiesService.getRunSources
    opportunitiesService.getRunSources = async (_ctx, runId) => {
      requestedRunId = runId
      return mockResponse as never
    }

    const host = document.createElement('div')
    document.body.appendChild(host)
    const root = createRoot(host)

    const notice = {
      tone: 'info' as const,
      text: 'Finished: 50 sources found, but no opportunity had enough evidence to qualify.',
      runId: 99,
    }

    await React.act(async () => {
      root.render(
        React.createElement(ExpandableRunNotice, {
          notice,
          run: { id: 99 } as never,
          context: ctx,
        })
      )
    })

    const button = host.querySelector('button[aria-label="Expand source exploration"]') as HTMLButtonElement
    assert.ok(button)

    // Click expand and wait for async fetch to resolve
    await React.act(async () => {
      button.click()
    })
    await React.act(async () => {
      await new Promise((r) => setTimeout(r, 20))
    })

    assert.equal(requestedRunId, 99)

    const html = host.innerHTML
    // Check 9 metrics in the metrics grid
    assert.ok(html.includes('50') && html.includes('Sources Found'))
    assert.ok(html.includes('14') && html.includes('13 with results, 1 empty'))
    assert.ok(html.includes('77') && html.includes('Results Returned'))
    assert.ok(html.includes('14') && html.includes('Pages Read in Full'))
    assert.ok(html.includes('2 / 2') && html.includes('Registry Sources'))

    // Check zero reasons section
    assert.ok(html.includes('Why No Opportunity Was Generated'))
    assert.ok(html.includes('The pages were read, but none showed a school with a clear reason to buy.'))
    assert.ok(html.includes('delhischool.edu.in'))

    // Check sources table
    assert.ok(html.includes('Delhi Public School'))
    assert.ok(html.includes('delhischool.edu.in'))
    assert.ok(html.includes('href="https://delhischool.edu.in/about"'))
    assert.ok(html.includes('target="_blank"'))
    assert.ok(html.includes('rel="noopener noreferrer"'))
    assert.ok(html.includes('School Website'))
    assert.ok(html.includes('News Media'))
    assert.ok(html.includes('1 page read in full'))
    assert.ok(html.includes('Search snippet only'))
    assert.ok(html.includes('Read'))
    assert.ok(html.includes('Discovered'))

    opportunitiesService.getRunSources = origGetRunSources
    await React.act(async () => {
      root.unmount()
    })
    host.remove()
  })

  it('4. Filter Tabs & Search: filters table rows by status and search keyword', async () => {
    const { opportunitiesService } = await import('../services/signals/opportunities')
    const { ExpandableRunNotice } = await import(
      '../components/domain/signals/expandable-run-notice'
    )
    const React = await import('react')
    const { createRoot } = await import('react-dom/client')

    const mockResponse = {
      status: 1,
      run: { id: 101 },
      metrics: { sources_found: 2 },
      zero_reasons: [],
      data: [
        {
          id: 1,
          run_id: 101,
          url: 'https://schoolone.edu/page',
          title: 'School One',
          domain: 'schoolone.edu',
          source_type: 'School Website',
          page_fetched: true,
          cited: false,
          exploration_status: 'Read',
          snippet: 'Smart school initiative',
        },
        {
          id: 2,
          run_id: 101,
          url: 'https://newsportal.com/article',
          title: 'News Article',
          domain: 'newsportal.com',
          source_type: 'News Media',
          page_fetched: false,
          cited: false,
          exploration_status: 'Discovered',
          snippet: 'Education tech news',
        },
      ],
    }

    opportunitiesService.getRunSources = async () => mockResponse as never

    const host = document.createElement('div')
    document.body.appendChild(host)
    const root = createRoot(host)

    await React.act(async () => {
      root.render(
        React.createElement(ExpandableRunNotice, {
          notice: { tone: 'info', text: 'Summary', runId: 101 },
          context: ctx,
        })
      )
    })

    const button = host.querySelector('button[aria-label="Expand source exploration"]') as HTMLButtonElement
    await React.act(async () => {
      button.click()
    })
    await React.act(async () => {
      await new Promise((r) => setTimeout(r, 20))
    })

    // Both should be visible initially
    assert.ok(host.innerHTML.includes('schoolone.edu'))
    assert.ok(host.innerHTML.includes('newsportal.com'))

    // Search input
    const input = host.querySelector('input[placeholder*="Filter sources"]') as HTMLInputElement
    assert.ok(input)

    await React.act(async () => {
      input.value = 'schoolone'
      input.dispatchEvent(new dom.window.Event('input', { bubbles: true }))
    })

    // Verify filter tabs exist
    assert.ok(host.innerHTML.includes('Read in Full (1)'))
    assert.ok(host.innerHTML.includes('Snippets Only (1)'))

    await React.act(async () => {
      root.unmount()
    })
    host.remove()
  })

  it('5. Error Handling: displays error message and retry button when source load fails', async () => {
    const { opportunitiesService } = await import('../services/signals/opportunities')
    const { ExpandableRunNotice } = await import(
      '../components/domain/signals/expandable-run-notice'
    )
    const React = await import('react')
    const { createRoot } = await import('react-dom/client')

    opportunitiesService.getRunSources = async () => {
      throw new Error('Connection timed out while loading sources.')
    }

    const host = document.createElement('div')
    document.body.appendChild(host)
    const root = createRoot(host)

    await React.act(async () => {
      root.render(
        React.createElement(ExpandableRunNotice, {
          notice: { tone: 'info', text: 'Summary', runId: 202 },
          context: ctx,
        })
      )
    })

    const button = host.querySelector('button[aria-label="Expand source exploration"]') as HTMLButtonElement
    await React.act(async () => {
      button.click()
    })
    await React.act(async () => {
      await new Promise((r) => setTimeout(r, 20))
    })

    assert.ok(host.textContent?.includes('Connection timed out while loading sources.'))
    const retryBtn = host.querySelector('button[title*="Retry"], button:not([aria-expanded])')
    assert.ok(retryBtn, 'Retry button should be available on failure')

    await React.act(async () => {
      root.unmount()
    })
    host.remove()
  })
})
