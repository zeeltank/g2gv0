import { strict as assert } from 'node:assert'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, it } from 'node:test'
import { sourceLinkProblem, sourcePlatform, SOURCE_LINK_MAX } from './source-link'
import { emptyManualForm, validateManual, type ManualForm } from './manual-opportunity'

const read = (p: string) => readFileSync(join(__dirname, '..', p), 'utf8').split(String.fromCharCode(13, 10)).join(String.fromCharCode(10))

// The same real-world shapes the server's tests use, so the two sides agree on what is accepted.
const ACCEPTED: Array<[string, string, string]> = [
  ['LinkedIn post', 'https://www.linkedin.com/posts/acme-plastics_expansion-activity-7123456789012345678-AbCd?utm_source=share&utm_medium=member_desktop', 'LinkedIn'],
  ['LinkedIn feed update', 'https://www.linkedin.com/feed/update/urn:li:activity:7123456789012345678/', 'LinkedIn'],
  ['LinkedIn profile', 'https://in.linkedin.com/in/jane-doe-1a2b3c', 'LinkedIn'],
  ['LinkedIn company page', 'https://www.linkedin.com/company/acme-plastics/', 'LinkedIn'],
  ['Facebook post', 'https://www.facebook.com/AcmePlastics/posts/pfbid02abcDEF123', 'Facebook'],
  ['Facebook permalink', 'https://m.facebook.com/permalink.php?story_fbid=123456&id=987654', 'Facebook'],
  ['Facebook page', 'https://www.facebook.com/AcmePlastics', 'Facebook'],
  ['Facebook video short link', 'https://fb.watch/abc123XYZ/', 'Facebook'],
  ['Instagram post', 'https://www.instagram.com/p/CxYz123AbC/?igsh=MWx4', 'Instagram'],
  ['Instagram profile', 'https://www.instagram.com/acme.plastics/', 'Instagram'],
  ['X post', 'https://x.com/acmeplastics/status/1712345678901234567?s=20', 'X (Twitter)'],
  ['Twitter post', 'https://twitter.com/acmeplastics/status/1712345678901234567', 'X (Twitter)'],
  ['X profile', 'https://x.com/acmeplastics', 'X (Twitter)'],
  ['YouTube video', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=42s', 'YouTube'],
  ['YouTube short link', 'https://youtu.be/dQw4w9WgXcQ?si=abc', 'YouTube'],
  ['YouTube channel', 'https://www.youtube.com/@AcmePlastics', 'YouTube'],
  ['company website', 'https://www.acmeplastics.co.in/about-us/news', 'acmeplastics.co.in'],
  ['news article', 'https://economictimes.indiatimes.com/industry/acme-opens-plant/articleshow/12345.cms', 'economictimes.indiatimes.com'],
  ['blog', 'https://blog.acmeplastics.com/2026/11/new-plant', 'blog.acmeplastics.com'],
  ['job portal', 'https://www.naukri.com/job-listings-erp-manager-acme-plastics-surat-5-to-8-years-021126001234', 'naukri.com'],
  ['plain http', 'http://acmeplastics.com/tender?id=77', 'acmeplastics.com'],
  ['upper-case scheme and host', 'HTTPS://WWW.Example.COM/Path', 'example.com'],
  ['non-latin path (copied from a page)', 'https://example.com/समाचार/acme-plant', 'example.com'],
]

const REFUSED: Array<[string, string]> = [
  ['javascript scheme', 'javascript:alert(1)'],
  ['javascript scheme with a platform look', 'javascript://www.linkedin.com/%0Aalert(1)'],
  ['data scheme', 'data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg=='],
  ['file scheme', 'file:///etc/passwd'],
  ['ftp scheme', 'ftp://files.example.com/a.pdf'],
  ['mailto', 'mailto:someone@example.com'],
  ['protocol-relative', '//www.linkedin.com/posts/x'],
  ['no scheme', 'www.linkedin.com/posts/x'],
  ['only the scheme', 'https://'],
  ['localhost', 'http://localhost/admin'],
  ['ipv4 address', 'http://192.168.1.10/x'],
  ['ipv6 address', 'http://[::1]/x'],
  ['credentials in the link', 'https://user:secret@example.com/a'],
  ['a space in it', 'https://example.com/a b'],
  ['not a link', 'not a url'],
  ['empty', ''],
  ['only spaces', '   '],
  ['too long', `https://example.com/${'a'.repeat(SOURCE_LINK_MAX + 100)}`],
]

const good = (over: Partial<ManualForm> = {}): ManualForm => ({
  ...emptyManualForm(), company_name: 'Acme Plastics', summary: 'Opening a second plant and hiring a plant IT head.', source_url: 'https://www.linkedin.com/posts/acme-1', ...over,
})

describe('A source link from any platform or website', () => {
  for (const [name, url, platform] of ACCEPTED) {
    it(`accepts ${name} and names it ${platform}`, () => {
      assert.equal(sourceLinkProblem(url), null)
      assert.equal(sourcePlatform(url), platform)
      assert.deepEqual(validateManual(good({ source_url: url }), '2026-11-02'), {}, 'the form takes it')
    })
  }

  for (const [name, url] of REFUSED) {
    it(`refuses ${name}`, () => {
      assert.ok(sourceLinkProblem(url), `should be refused: ${url}`)
      assert.equal(sourcePlatform(url), null, 'and has no platform')
      assert.ok(validateManual(good({ source_url: url }), '2026-11-02').source_url, 'the form says why')
    })
  }

  it('says which of the five named platforms it is, whatever the subdomain, and never for a look-alike', () => {
    assert.equal(sourcePlatform('https://fr.linkedin.com/in/x'), 'LinkedIn')
    assert.equal(sourcePlatform('https://m.youtube.com/watch?v=x'), 'YouTube')
    assert.equal(sourcePlatform('https://mobile.twitter.com/x'), 'X (Twitter)')
    assert.equal(sourcePlatform('https://notlinkedin.com/x'), 'notlinkedin.com')
    assert.equal(sourcePlatform('https://linkedin.com.evil.example.com/x'), 'linkedin.com.evil.example.com')
  })

  it('the link stays required, and the company and summary stay required', () => {
    assert.ok(validateManual(good({ source_url: '' }), null).source_url)
    assert.ok(validateManual(good({ company_name: '' }), null).company_name)
    assert.ok(validateManual(good({ summary: '' }), null).summary)
  })
})

describe('Nothing LinkedIn-specific is left, and nothing opens the link', () => {
  it('the form, the dialog and the validation name no particular platform as a rule', () => {
    for (const file of ['lib/manual-opportunity.ts', 'lib/source-link.ts']) {
      const code = read(file).split('\n').filter((l) => !l.trim().startsWith('*') && !l.trim().startsWith('//') && !l.trim().startsWith('/*')).join('\n')
      assert.doesNotMatch(code.replace(/'linkedin\.com': 'LinkedIn', 'lnkd\.in': 'LinkedIn',/, ''), /linkedin/i, `${file} has no LinkedIn-only rule`)
    }
    assert.doesNotMatch(read('components/domain/signals/manual-opportunity-dialog.tsx'), /placeholder="https:\/\/www\.linkedin/, 'the example is no longer LinkedIn')
  })

  it('the link is only ever text sent to the save request: no fetch, no navigation, no iframe', () => {
    for (const file of ['lib/source-link.ts', 'lib/manual-opportunity.ts', 'components/domain/signals/manual-opportunity-dialog.tsx']) {
      assert.doesNotMatch(read(file), /\bfetch\(|window\.open|location\.href|<iframe|<img[^>]*source_url/, `${file} does not open the link`)
    }
  })

  it('the platform is shown in the dialog (as a hint under the link) and on the saved card', () => {
    assert.match(read('components/domain/signals/manual-opportunity-dialog.tsx'), /sourcePlatform\(form\.source_url\)/)
    assert.match(read('components/domain/signals/manual-opportunity-dialog.tsx'), /Source: \{platform\}/)
    assert.match(read('components/domain/signals/scholar-signals-view.tsx'), /from \$\{sourcePlatform\(o\.source_url\)\}/)
  })
})
