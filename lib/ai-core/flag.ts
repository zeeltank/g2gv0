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

/**
 * The switch for module-scoped chat.
 *
 * ON: while the user is inside a module that has an AI Stack, the shell chat asks the
 * backend's `/ask` with that module's key (validated server-side, policy-enforced, grounded
 * in that module's data only). OFF (default): the chat behaves exactly as before.
 *
 * Same rollback as `isAiCoreEnabled`: unset it and rebuild.
 */
export function isModuleChatEnabled(): boolean {
  return process.env.NEXT_PUBLIC_MODULE_CHAT_ENABLED === 'true';
}

/**
 * The switch for approvals on chat actions.
 *
 * ON: every write action proposed from the chat is sent for approval after Confirm and runs only
 * once an administrator other than the requester approves it. OFF (default): Confirm runs the
 * action immediately, exactly as before. Needs the module chat flag as well (actions are only
 * offered there).
 */
export function isChatActionApprovalEnabled(): boolean {
  return process.env.NEXT_PUBLIC_CHAT_ACTION_APPROVALS === 'true';
}

/**
 * The switch for the twelve-stage chat lifecycle.
 *
 * ON (with module chat): every message in a module goes to the backend lifecycle, which returns the
 * trace, the evidence it read, suggestions, any proposed action and any generated report, and the
 * chat renders them. Actions and "open <page>" requests are recognised there, not in the browser.
 * OFF (default): the chat behaves exactly as before. The backend must have AI_LIFECYCLE_ENABLED on.
 */
export function isChatLifecycleEnabled(): boolean {
  return process.env.NEXT_PUBLIC_CHAT_LIFECYCLE_ENABLED === 'true';
}
