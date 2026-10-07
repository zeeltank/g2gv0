/**
 * The switch for routing G2G's AI through the universal core (`darshana-ai-core`).
 *
 * OFF (the default, and anything other than the literal string "true"):
 *   every screen runs the implementation that was already there, untouched.
 * ON:
 *   the paths that have been migrated go through the G2G adapter / chat engine.
 *
 * It is a build-time `NEXT_PUBLIC_` variable on purpose — it is read in client code, and
 * rolling back is: unset it (or set it to anything else) and redeploy. No data migration,
 * no code revert. See `components/shell/gtg-app-shell.tsx` for the one migrated path.
 */
export function isAiCoreEnabled(): boolean {
  return process.env.NEXT_PUBLIC_AI_CORE_ENABLED === 'true';
}
