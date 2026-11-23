# 08 Motion decision: GSAP added, scoped to the client presentation

Date 2026-11-23. Requested by the owner ("use advanced technology for the interactivity like GSAP, Framer").

**Decision.** `gsap` 3.15.1 and `@gsap/react` 2.1.2 are added to `package.json` (exact versions). They are imported only from `components/domain/lms/client-presentation/motion/gsap.ts`. The app's existing rule (CSS transitions only; `framer-motion` is an approved, scoped divergence for the task screens, see `lib/motion/variants.ts`) is therefore widened once more, for this module only. Nothing else in the app imports GSAP.

**Licence.** GSAP, including SplitText, DrawSVG and Flip, is free for commercial use under Webflow's standard "no charge" licence since 2025 ([announcement](https://webflow.com/blog/gsap-becomes-free), [licence](https://gsap.com/community/standard-license/)). I did not read the full licence text; the owner or counsel should read it before client use.

**Who animates what.** GSAP = choreography inside a scene (timelines, text reveals, line drawing). `framer-motion` (already installed, 14.0.0) = interface state (scene presence, accordion rows, button hover). No element is animated by both. Every motion must reveal, connect or compare something; the story file records what each one means.

**Reduced motion.** When the viewer's system asks for reduced motion, every scene shows its finished state at once (`motion/use-beat-timeline.ts`); this is verified in `scripts/client-presentation/verify.mjs`.

**Bundle.** GSAP core, SplitText, DrawSVG and Flip load only on the client-presentation route (client component, route-level code). Not measured in a production build yet (not verified).
