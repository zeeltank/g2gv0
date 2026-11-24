/**
 * One place that loads GSAP and registers the plugins the client presentation uses.
 * GSAP (with SplitText, DrawSVG and Flip) is free for commercial use under Webflow's "no charge" licence since 2025;
 * this is a recorded, scoped divergence from the app's CSS-transition convention (docs/client-presentation/08-motion-decision.md).
 *
 * Division of labour, so nothing is animated by two engines at once:
 *   GSAP   = choreography inside a scene: timelines, text reveals, line drawing, shared-element flips.
 *   Motion = interface state: scene enter/exit presence, expanding rows, the chooser chips.
 */
import { useGSAP } from '@gsap/react'
import { gsap } from 'gsap'
import { DrawSVGPlugin } from 'gsap/DrawSVGPlugin'
import { Flip } from 'gsap/Flip'
import { MorphSVGPlugin } from 'gsap/MorphSVGPlugin'
import { SplitText } from 'gsap/SplitText'

let registered = false

export function setupGsap(): void {
  if (registered) return
  gsap.registerPlugin(useGSAP, SplitText, DrawSVGPlugin, Flip, MorphSVGPlugin)
  registered = true
}

setupGsap()

export { DrawSVGPlugin, Flip, MorphSVGPlugin, SplitText, gsap, useGSAP }
