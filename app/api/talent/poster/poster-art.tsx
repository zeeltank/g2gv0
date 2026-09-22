import type { PosterContent, PosterFact, PosterPanel, PosterRole } from '@/lib/poster'

/**
 * The poster, drawn.
 *
 * ── SATORI CONSTRAINTS, NOT PREFERENCES ─────────────────────────────────────
 *
 * Satori implements a flexbox subset. No grid, no float, no `gap` shorthand in
 * some positions, no CSS variables, no Tailwind classes - `tw=` would compile
 * against Satori's own bundled palette rather than this app's, which would make
 * the PNG a different colour from the PDF. Every element below is an explicit
 * flex row or column with hex colours taken from the payload.
 *
 * Every `<img>` carries explicit width and height because Satori throws on an
 * image it cannot size; the dimensions are read from the file header in PHP.
 *
 * ── AND NO CONTENT RULES ────────────────────────────────────────────────────
 *
 * There is no truncation, no item cap and no fallback in this file. Those are
 * decided in PosterContentService so the PDF and the PNG cannot drift into
 * describing the same job differently. This turns finished strings into pixels.
 */

const TICK = '✓'

type Scale = {
  pad: number
  gap: number
  panelPad: number
  heading: number
  body: number
  chip: number
  label: number
  logo: number
}

/** Type and spacing scale per canvas. Layout only - never content. */
function scaleFor(width: number, height: number): Scale {
  if (width === 1200) {
    // Landscape is short: everything tightens, and the body carries less.
    return { pad: 48, gap: 18, panelPad: 20, heading: 20, body: 17, chip: 15, label: 11, logo: 44 }
  }
  if (height === 1080) {
    return { pad: 64, gap: 22, panelPad: 26, heading: 26, body: 21, chip: 18, label: 12, logo: 56 }
  }
  return { pad: 72, gap: 26, panelPad: 30, heading: 28, body: 22, chip: 19, label: 13, logo: 60 }
}

function Wordmark({ content, scale }: { content: PosterContent; scale: Scale }) {
  const { brand, palette } = content

  return (
    <div style={{ display: 'flex', alignItems: 'center' }}>
      {brand.logo && brand.logo_width && brand.logo_height ? (
        <img
          src={brand.logo}
          width={Math.round((brand.logo_width / brand.logo_height) * scale.logo)}
          height={scale.logo}
          alt=""
        />
      ) : (
        /*
         * A missing logo is a normal state, not a failure: the organisation may
         * never have uploaded one, and the fetch is allowed to fail rather than
         * break a download. The slot keeps its size either way, so the masthead
         * does not jump.
         */
        <div
          style={{
            display: 'flex',
            width: scale.logo,
            height: scale.logo,
            borderRadius: 12,
            backgroundColor: palette.blue,
            color: '#ffffff',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: Math.round(scale.logo * 0.36),
            fontWeight: 700,
          }}
        >
          {brand.initials}
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', marginLeft: 16 }}>
        <div style={{ display: 'flex', fontSize: scale.body, fontWeight: 700, color: '#ffffff' }}>
          {brand.name}
        </div>
        {brand.website ? (
          <div style={{ display: 'flex', fontSize: scale.label, color: '#a9bce0', marginTop: 2 }}>
            {brand.website.replace(/^https?:\/\//, '')}
          </div>
        ) : null}
      </div>
    </div>
  )
}

function Facts({ facts, scale, palette }: { facts: PosterFact[]; scale: Scale; palette: PosterContent['palette'] }) {
  if (facts.length === 0) return null

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', marginTop: scale.gap }}>
      {facts.map((fact) => (
        <div
          key={fact.label}
          style={{
            display: 'flex',
            flexDirection: 'column',
            backgroundColor: palette.blue_soft,
            borderRadius: 12,
            padding: `${Math.round(scale.panelPad * 0.42)}px ${Math.round(scale.panelPad * 0.6)}px`,
            marginRight: 10,
            marginBottom: 10,
          }}
        >
          <div
            style={{
              display: 'flex',
              fontSize: scale.label,
              letterSpacing: 1.1,
              textTransform: 'uppercase',
              color: palette.muted,
              fontWeight: 700,
            }}
          >
            {fact.label}
          </div>
          <div
            style={{
              display: 'flex',
              fontSize: scale.chip,
              color: palette.navy,
              fontWeight: 700,
              marginTop: 4,
            }}
          >
            {fact.value}
          </div>
        </div>
      ))}
    </div>
  )
}

function Panel({
  panel,
  scale,
  palette,
  grow,
}: {
  panel: PosterPanel
  scale: Scale
  palette: PosterContent['palette']
  grow: boolean
}) {
  const primary = panel.style === 'primary'
  const accent = primary ? palette.blue : palette.green

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        flexGrow: grow ? 1 : 0,
        flexBasis: 'auto',
        backgroundColor: primary ? palette.blue_soft : palette.green_soft,
        borderRadius: 18,
        borderLeft: `6px solid ${accent}`,
        padding: scale.panelPad,
        marginBottom: Math.round(scale.gap * 0.75),
      }}
    >
      <div
        style={{
          display: 'flex',
          fontSize: scale.heading,
          fontWeight: 700,
          color: palette.navy,
          marginBottom: 16,
        }}
      >
        {panel.heading}
      </div>

      {panel.kind === 'chips' ? (
        <div style={{ display: 'flex', flexWrap: 'wrap' }}>
          {panel.items.map((item) => (
            <div
              key={item}
              style={{
                display: 'flex',
                backgroundColor: '#ffffff',
                border: `1px solid ${palette.line}`,
                borderRadius: 999,
                padding: '6px 14px',
                marginRight: 8,
                marginBottom: 8,
                fontSize: scale.chip,
                color: palette.navy,
              }}
            >
              {item}
            </div>
          ))}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {panel.items.map((item) => (
            <div key={item} style={{ display: 'flex', alignItems: 'flex-start', marginBottom: 10 }}>
              <div style={{ display: 'flex', color: accent, fontWeight: 700, fontSize: scale.body, marginRight: 12 }}>
                {TICK}
              </div>
              <div style={{ display: 'flex', flexGrow: 1, fontSize: scale.body, color: palette.ink, lineHeight: 1.4 }}>
                {item}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function RoleHead({ role, scale, palette }: { role: PosterRole; scale: Scale; palette: PosterContent['palette'] }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      {role.department ? (
        <div
          style={{
            display: 'flex',
            fontSize: scale.label,
            letterSpacing: 1.6,
            textTransform: 'uppercase',
            color: palette.muted,
            fontWeight: 700,
            marginBottom: 10,
          }}
        >
          {role.department}
        </div>
      ) : null}

      <div
        style={{
          display: 'flex',
          fontSize: role.title_size,
          fontWeight: 700,
          color: palette.navy,
          lineHeight: 1.1,
        }}
      >
        {role.title}
      </div>
    </div>
  )
}

function Cta({ content, scale }: { content: PosterContent; scale: Scale }) {
  const { palette, copy, apply_url: applyUrl } = content

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: palette.green,
        borderRadius: 16,
        padding: `${Math.round(scale.panelPad * 0.72)}px ${scale.panelPad}px`,
      }}
    >
      <div style={{ display: 'flex', fontSize: scale.heading, fontWeight: 700, color: '#ffffff' }}>
        {copy.cta}
      </div>
      <div style={{ display: 'flex', fontSize: scale.label + 2, color: '#e8fbee', marginLeft: 20 }}>
        {applyUrl.replace(/^https?:\/\//, '')}
      </div>
    </div>
  )
}

export function PosterArt({ content }: { content: PosterContent }) {
  const { palette, copy, format, layout, roles } = content
  const scale = scaleFor(format.width, format.height)
  const role = roles[0]
  const multi = layout === 'multi'

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        width: format.width,
        height: format.height,
        backgroundColor: palette.paper,
        fontFamily: 'DejaVu Sans',
      }}
    >
      {/* Masthead */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: palette.navy,
          padding: `${Math.round(scale.pad * 0.55)}px ${scale.pad}px ${Math.round(scale.pad * 0.45)}px`,
        }}
      >
        <Wordmark content={content} scale={scale} />

        <div
          style={{
            display: 'flex',
            fontSize: format.headline_size,
            fontWeight: 700,
            color: '#ffffff',
            letterSpacing: -1,
            marginTop: Math.round(scale.gap * 0.7),
          }}
        >
          {copy.headline}
        </div>

        <div
          style={{
            display: 'flex',
            fontSize: scale.chip,
            letterSpacing: 2.4,
            textTransform: 'uppercase',
            color: palette.blue_soft,
            fontWeight: 700,
            marginTop: 6,
          }}
        >
          {multi ? `${roles.length} open roles` : 'Join our team'}
        </div>
      </div>

      {/* Body */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          flexGrow: 1,
          padding: `${Math.round(scale.gap * 1.3)}px ${scale.pad}px ${Math.round(scale.pad * 0.62)}px`,
          /*
           * Content first, the call to action last and hard against the bottom
           * edge. Without this the CTA floated up into whatever space the
           * panels left and, on a long posting, printed ON TOP of them.
           */
          justifyContent: 'space-between',
        }}
      >
        {multi ? (
          <div style={{ display: 'flex', flexDirection: 'column', flexGrow: 1 }}>
            {roles.map((each) => (
              <div
                key={each.id}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  // Cards share the height: a multi-role poster holds only
                  // titles and chips, so without this they bunch at the top
                  // and leave a gap where the reader expects more roles.
                  flexGrow: 1,
                  justifyContent: 'center',
                  border: `1px solid ${palette.line}`,
                  borderLeft: `6px solid ${palette.blue}`,
                  borderRadius: 16,
                  padding: scale.panelPad,
                  marginBottom: scale.gap,
                }}
              >
                <RoleHead role={each} scale={scale} palette={palette} />
                <Facts facts={each.facts} scale={scale} palette={palette} />
              </div>
            ))}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <RoleHead role={role} scale={scale} palette={palette} />
            <Facts facts={role.facts} scale={scale} palette={palette} />

            {/*
              Panels arrive already filtered - an empty one is never sent, so a
              heading over nothing cannot be drawn. Landscape sets them side by
              side because it has width and no height; the taller canvases stack.
            */}
            <div
              style={{
                display: 'flex',
                flexDirection: format.width === 1200 ? 'row' : 'column',
                marginTop: scale.gap,
              }}
            >
              {role.panels.map((panel, index) => (
                <div
                  key={panel.heading}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    // Side by side only on landscape, which has width and no height.
                    flexGrow: format.width === 1200 ? 1 : 0,
                    flexBasis: format.width === 1200 ? 0 : 'auto',
                    marginRight: format.width === 1200 && index < role.panels.length - 1 ? scale.gap : 0,
                  }}
                >
                  <Panel panel={panel} scale={scale} palette={palette} grow={format.width === 1200} />
                </div>
              ))}
            </div>
          </div>
        )}

        <Cta content={content} scale={scale} />
      </div>
    </div>
  )
}
