/* Independent validation of the saved .pptx (reads the XML, not the build graph). node validate.js */
const fs = require('fs')
const path = require('path')
const JSZip = require('jszip')
const FILE = path.join(__dirname, '..', 'G2G-Sales-Training-Interactive.pptx')
const graph = JSON.parse(fs.readFileSync(path.join(__dirname, 'graph.json'), 'utf8'))

;(async () => {
  const zip = await JSZip.loadAsync(fs.readFileSync(FILE))
  const total = Object.keys(zip.files).filter((f) => /^ppt\/slides\/slide\d+\.xml$/.test(f)).length
  const errors = []
  const out = {} // slide -> {jumps:[{to,order}], back:boolean}
  for (let i = 1; i <= total; i++) {
    const xml = await zip.file(`ppt/slides/slide${i}.xml`).async('string')
    const rels = await zip.file(`ppt/slides/_rels/slide${i}.xml.rels`).async('string')
    const relMap = {}
    for (const m of rels.matchAll(/<Relationship Id="([^"]+)"[^>]*Target="([^"]+)"/g)) relMap[m[1]] = m[2]
    const jumps = []
    let back = false
    for (const m of xml.matchAll(/<a:hlinkClick r:id="([^"]*)" action="([^"]+)"/g)) {
      if (m[2].includes('lastslideviewed')) { back = true; continue }
      const t = relMap[m[1]]
      const mm = t && t.match(/slide(\d+)\.xml$/)
      if (!mm) { errors.push(`slide ${i}: link ${m[1]} has no slide target`); continue }
      const to = +mm[1]
      if (to < 1 || to > total) errors.push(`slide ${i}: link to missing slide ${to}`)
      jumps.push(to)
    }
    out[i] = { jumps, back }
  }
  // reachability from slide 1
  const seen = new Set([1]); const q = [1]
  while (q.length) { const c = q.shift(); for (const t of out[c].jumps) if (!seen.has(t)) { seen.add(t); q.push(t) } }
  for (let i = 1; i <= total; i++) if (!seen.has(i)) errors.push(`slide ${i} (${graph[i - 1].id}) unreachable from Home`)
  // every slide can get home / has forward links
  for (let i = 2; i <= total; i++) if (!out[i].jumps.includes(1)) errors.push(`slide ${i}: no Home link`)
  for (let i = 2; i <= total; i++) if (!out[i].back) errors.push(`slide ${i}: no Back (last-slide-viewed) button`)
  // branching quality
  const byNum = Object.fromEntries(graph.map((n) => [n.num, n]))
  let decisions = 0, feedbacks = 0
  for (const n of graph) {
    const j = new Set(out[n.num].jumps)
    if (n.type === 'dec') {
      decisions++
      const opts = n.links.filter((l) => ['best', 'partial', 'poor'].includes(l.role))
      const dests = new Set(opts.map((l) => l.to))
      if (opts.length !== 3) errors.push(`${n.id}: expected 3 options, got ${opts.length}`)
      if (dests.size !== opts.length) errors.push(`${n.id}: options share a destination (fake branching)`)
      const roles = new Set(opts.map((l) => l.role))
      if (roles.size !== 3) errors.push(`${n.id}: ratings are not best/partial/poor`)
      for (const l of opts) if (!j.has(l.to)) errors.push(`${n.id}: option link missing in XML to ${l.to}`)
    }
    if (n.type === 'fb') {
      feedbacks++
      if (!n.links.some((l) => l.role === 'return') || !n.links.some((l) => l.role === 'continue')) errors.push(`${n.id}: missing Continue or Return to decision`)
    }
    if (n.type === 'rec') {
      const d = new Set(n.links.filter((l) => ['recover', 'double-down'].includes(l.role)).map((l) => l.to))
      if (d.size !== 2) errors.push(`${n.id}: recovery options do not diverge`)
    }
  }
  // per-product: all endings reachable, distinct destinations from each decision
  const products = [...new Set(graph.map((n) => n.product).filter(Boolean))]
  const report = []
  for (const p of products) {
    const ids = graph.filter((n) => n.product === p)
    const outs = ids.filter((n) => n.type === 'out').map((n) => n.id.split(':').pop())
    const lost = ids.filter((n) => n.type === 'lost').length
    const decs = ids.filter((n) => n.type === 'dec').length
    // shortest path to each ending from the start decision
    const startNum = ids.find((n) => n.id === `${p}:d0S`).num
    const dist = { [startNum]: 0 }; const qq = [startNum]
    while (qq.length) { const c = qq.shift(); for (const t of out[c].jumps) if (byNum[t].product === p && !(t in dist) && !['hub', 'map', 'persona'].includes(byNum[t].type)) { dist[t] = dist[c] + 1; qq.push(t) } }
    const endings = ids.filter((n) => ['out', 'lost'].includes(n.type)).map((n) => `${n.id.split(':').slice(1).join(':')}${n.num in dist ? '' : ' (UNREACHABLE)'}`)
    ids.filter((n) => ['out', 'lost'].includes(n.type) && !(n.num in dist)).forEach((n) => errors.push(`${n.id}: ending not reachable from scenario start`))
    const bestPath = ids.find((n) => n.id === `${p}:out:won`)
    report.push(`${p}: slides ${ids.length}, decision slides ${decs}, lost endings ${lost}, outcomes ${outs.join('/')}; clicks start->WON ${dist[bestPath.num]} (fastest), endings reachable: ${endings.filter((e) => !e.includes('UNREACH')).length}/${endings.length}`)
  }
  console.log(`slides: ${total}; decision slides: ${decisions}; feedback slides: ${feedbacks}`)
  report.forEach((r) => console.log(r))
  if (errors.length) { console.log(`\n${errors.length} PROBLEMS`); errors.slice(0, 40).forEach((e) => console.log(' - ' + e)); process.exit(1) }
  console.log('\nOK: all links resolve, all slides reachable, Home/Back everywhere, branching options diverge, all endings reachable.')
})()
