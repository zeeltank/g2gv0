/**
 * Puts the focus back on the control that opened a drawer or a question.
 *
 * Radix returns the focus only to a <Trigger> component, and these dialogs are opened by state, so without this the focus falls to the top of the page when
 * one closes and a keyboard user has to tab from the start. Take the control from the click event (`event.currentTarget`), not from `document.activeElement`:
 * some browsers do not focus a button when it is clicked. A control that has since left the page (its row was removed) is skipped; the caller then
 * chooses where the focus goes instead.
 *
 * Runs on the next turn, after the dialog has taken itself out of the page, or the dialog's own clean-up would move the focus again.
 */
export function returnFocusTo(trigger: HTMLElement | null | undefined): void {
  setTimeout(() => {
    if (trigger?.isConnected) trigger.focus()
  }, 0)
}
