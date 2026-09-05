#!/usr/bin/env node
/**
 * Finds controls a user can interact with that do nothing.
 *
 * ── WHY A SCANNER AND NOT A LIST ────────────────────────────────────────────
 *
 * "Not one item remains dead" cannot be proved by a hand-written list, because a
 * list is exactly what misses things. It also cannot be trusted from a one-off
 * audit: the last sweep produced 45 claims and its verification pass died, so 43
 * of them were never checked. This runs in a second, every time, and its output
 * is the same on every machine.
 *
 * ── FALSE POSITIVES ARE THE ONLY FAILURE THAT MATTERS ───────────────────────
 *
 * A missed dead control costs one more pass. A false positive sends someone to
 * "fix" working code, and after a few of those nobody trusts the tool. So every
 * rule here is deliberately conservative and each exemption is commented with
 * the real pattern it protects.
 *
 * Usage:
 *   node scripts/dead-controls.mjs                  # all talent + competency screens
 *   node scripts/dead-controls.mjs --json           # machine-readable
 *   node scripts/dead-controls.mjs path/to/file.tsx # one file
 *
 * Exits 1 when anything is found, so it can sit beside tsc/eslint/build.
 */

import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative, sep } from 'node:path'

const ROOT = process.cwd()

/** The ten Talent Management screens, plus the competency screens they hand off to. */
const SCAN_DIRS = [
  'components/domain/talent',
  'components/domain/competency',
]

const args = process.argv.slice(2)
const asJson = args.includes('--json')
const explicit = args.filter((a) => !a.startsWith('--'))

function walk(dir, out = []) {
  let entries
  try {
    entries = readdirSync(dir)
  } catch {
    return out
  }
  for (const entry of entries) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) walk(full, out)
    else if (entry.endsWith('.tsx')) out.push(full)
  }
  return out
}

const files = explicit.length
  ? explicit.map((f) => join(ROOT, f))
  : SCAN_DIRS.flatMap((d) => walk(join(ROOT, d)))

const findings = []
const add = (file, line, kind, control, evidence) =>
  findings.push({
    file: relative(ROOT, file).split(sep).join('/'),
    line,
    kind,
    control,
    evidence: evidence.trim().slice(0, 120),
  })

/**
 * The opening tag starting at `from`, with balanced braces so an inline arrow
 * body containing `>` does not end the tag early.
 */
function openingTag(src, from) {
  let depth = 0
  let quote = null
  for (let i = from; i < src.length; i++) {
    const c = src[i]
    if (quote) {
      if (c === quote && src[i - 1] !== '\\') quote = null
      continue
    }
    if (c === '"' || c === "'" || c === '`') quote = c
    else if (c === '{') depth++
    else if (c === '}') depth--
    else if (c === '>' && depth === 0) return src.slice(from, i + 1)
  }
  return src.slice(from, from + 400)
}

const lineOf = (src, index) => src.slice(0, index).split('\n').length

/**
 * Is this position inside a comment?
 *
 * Needed because the scanner otherwise reads its own evidence: a comment saying
 * a bar "used to be Progress value={60}" was reported as a hardcoded value, so
 * documenting a fix re-created the finding it described.
 */
function inComment(src, index) {
  const openBlock = src.lastIndexOf('/*', index)
  if (openBlock !== -1 && src.lastIndexOf('*/', index) < openBlock) return true
  const lineStart = src.lastIndexOf('\n', index) + 1
  const lineComment = src.indexOf('//', lineStart)
  return lineComment !== -1 && lineComment < index
}

/**
 * A control is WIRED when it carries any handler, or when its behaviour comes
 * from somewhere this scanner can see:
 *
 *  - onClick / onSelect / onChange / onCheckedChange / onValueChange / onPress
 *  - {...props} or {...rest}   — the handler is passed in by a parent
 *  - asChild                   — the child element carries the behaviour
 *  - type="submit"             — the form's onSubmit runs it
 *  - href / Link               — navigation IS the behaviour
 *  - disabled                  — deliberately inert, and visibly so
 */
const WIRED = /\bon(Click|Select|Change|CheckedChange|ValueChange|Press|Submit|Toggle|OpenChange)\s*=|\{\.\.\.\w+\}|\basChild\b|type\s*=\s*["']submit["']|\bhref\s*=|\bdisabled\b/

/**
 * Immediately inside a Trigger that forwards behaviour to its child.
 *
 * `<DialogTrigger asChild><Button>Open</Button></DialogTrigger>` is fully wired
 * and was the single biggest source of false positives in the earlier audit.
 */
function insideTriggerAsChild(src, index) {
  const before = src.slice(Math.max(0, index - 400), index)
  return /<\w*Trigger[^>]*\basChild\b[^>]*>\s*$/.test(before)
}

/**
 * A focusable anchor for a Tooltip or Popover, which is not a dead control.
 *
 * `<Tooltip content="..."><button aria-label="About this screen">…</button></Tooltip>`
 * has no onClick ON PURPOSE: the button exists so the tooltip can be reached by
 * keyboard as well as hover. Flagging it would push someone to "fix" correct
 * accessibility by adding a handler that does nothing.
 */
function insideTooltip(src, index) {
  const before = src.slice(Math.max(0, index - 600), index)
  const open = before.lastIndexOf('<Tooltip')
  if (open === -1) return false
  return !before.slice(open).includes('</Tooltip>')
}

/** Inside a <form> that has an onSubmit, so a bare submit button is wired. */
function insideSubmittingForm(src, index) {
  const before = src.slice(0, index)
  const formOpen = before.lastIndexOf('<form')
  if (formOpen === -1) return false
  const formClose = before.lastIndexOf('</form>')
  if (formClose > formOpen) return false
  return /onSubmit\s*=/.test(openingTag(src, formOpen))
}

for (const file of files) {
  const src = readFileSync(file, 'utf8')

  // ── 1. Buttons and menu items with nothing behind them ──────────────────
  const CONTROLS = /<(Button|button|DropdownMenuItem|SelectItem|TabsTrigger|MenuItem|CommandItem)\b/g
  for (const m of src.matchAll(CONTROLS)) {
    if (inComment(src, m.index)) continue
    const tag = openingTag(src, m.index)
    if (WIRED.test(tag)) continue
    if (insideTriggerAsChild(src, m.index)) continue
    if (insideSubmittingForm(src, m.index)) continue
    if (insideTooltip(src, m.index)) continue

    // A TabsTrigger/SelectItem with a `value` is wired by its parent's
    // onValueChange; the parent is checked separately by rule 3.
    if (/^<(TabsTrigger|SelectItem)/.test(tag) && /\bvalue\s*=/.test(tag)) continue

    const line = lineOf(src, m.index)
    // The visible label, for a human reading the report.
    const after = src.slice(m.index, m.index + 500)
    const label = (after.match(/>\s*([^<>{}\n]{2,60}?)\s*</) || [])[1] || m[1]
    add(file, line, 'no-handler', label.trim(), tag)
  }

  // ── 2. State that is written and never read ─────────────────────────────
  // useState whose setter is called but whose value appears nowhere else.
  const STATE = /const\s*\[\s*(\w+)\s*,\s*(set\w+)\s*\]\s*=\s*useState/g
  for (const m of src.matchAll(STATE)) {
    const [, value, setter] = m
    const uses = (src.match(new RegExp(`\\b${value}\\b`, 'g')) || []).length
    const sets = (src.match(new RegExp(`\\b${setter}\\b`, 'g')) || []).length
    // 1 = the declaration itself. Anything more is a genuine read.
    if (uses <= 1 && sets > 1) {
      add(file, lineOf(src, m.index), 'orphan-state', value,
        `${value} is set by ${setter} but never read`)
    }
  }

  /* ── 3. A view mode that can be selected but never rendered ──────────────
   *
   * The real case is the Offboarding History toggle: `setViewLayout('history')`
   * is wired to a button, `viewLayout === 'history'` appears only in the
   * button's own className to show it as active, and no branch renders anything
   * for it. Clicking it empties the page.
   *
   * ── WHAT THIS RULE MUST NOT FLAG, LEARNED THE HARD WAY ─────────────────
   *
   *   setCategory('all') inside clearAll()  — a filter RESET, not a view. The
   *     value is read at `if (category === 'all') return null`.
   *   if (state === 'error') { return (...) } — an early-return branch. The
   *     first version required `&&` or `?` on the same line and missed these.
   *
   * So the test is narrow: the mode is dead only when EVERY comparison against
   * it sits inside a className/cn() styling expression. One comparison anywhere
   * else means something reads it, and the rule stays silent.
   */
  const MODES = /set(\w+)\(\s*'([a-z_-]+)'\s*\)/g
  const seen = new Set()
  for (const m of src.matchAll(MODES)) {
    if (inComment(src, m.index)) continue
    const [, name, mode] = m
    const stateVar = name.charAt(0).toLowerCase() + name.slice(1)
    const key = `${stateVar}:${mode}`
    if (seen.has(key)) continue
    seen.add(key)

    // Only meaningful for a variable that is compared against string literals.
    if (!new RegExp(`\\b${stateVar}\\s*===\\s*'`).test(src)) continue

    const comparisons = [...src.matchAll(new RegExp(`\\b${stateVar}\\s*===\\s*'${mode}'`, 'g'))]
    if (comparisons.length === 0) continue

    /*
     * Styling context means the comparison sits INSIDE a className value or a
     * cn() call — not merely on a line that also has a className attribute.
     *
     * That distinction matters: `<span className="...">{type === 'all' ? ...}`
     * has a className on the same line, but the comparison is rendering TEXT,
     * which is a genuine read. Walk back to the nearest unbalanced opening
     * bracket and ask what introduced it.
     */
    const stylingOnly = comparisons.every((c) => {
      let depth = 0
      for (let i = c.index - 1; i >= 0 && c.index - i < 600; i--) {
        const ch = src[i]
        if (ch === '}' || ch === ')') depth++
        else if (ch === '{' || ch === '(') {
          if (depth === 0) {
            const intro = src.slice(Math.max(0, i - 24), i)
            return /className\s*=\s*$|\bcn$/.test(intro)
          }
          depth--
        }
      }
      return false
    })

    if (stylingOnly) {
      add(file, lineOf(src, m.index), 'unreachable-view', `${stateVar} = '${mode}'`,
        `${stateVar} can be set to '${mode}', but every comparison is styling only`)
    }
  }

  // ── 4. Invented data presented as live ──────────────────────────────────
  // A literal number inside a progress/value/percent prop. Excludes 0 and 100,
  // which are legitimate bounds, and max/min which are scales, not readings.
  const HARDCODED = /\b(value|progress|percent|percentage|score)\s*=\s*\{\s*(\d{1,3})\s*\}/g
  for (const m of src.matchAll(HARDCODED)) {
    if (inComment(src, m.index)) continue
    const n = Number(m[2])
    if (n === 0 || n === 100) continue
    add(file, lineOf(src, m.index), 'hardcoded-data', `${m[1]}={${m[2]}}`, m[0])
  }
}

findings.sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line)

if (asJson) {
  console.log(JSON.stringify({ total: findings.length, findings }, null, 2))
} else {
  const byFile = new Map()
  for (const f of findings) {
    if (!byFile.has(f.file)) byFile.set(f.file, [])
    byFile.get(f.file).push(f)
  }
  for (const [file, items] of byFile) {
    console.log(`\n${file}  (${items.length})`)
    for (const i of items) {
      console.log(`  ${String(i.line).padStart(5)}  ${i.kind.padEnd(17)} ${i.control}`)
    }
  }
  console.log(
    findings.length
      ? `\n${findings.length} dead control(s) across ${byFile.size} file(s), ${files.length} scanned.`
      : `\nNo dead controls. ${files.length} files scanned.`,
  )
}

process.exit(findings.length ? 1 : 0)
