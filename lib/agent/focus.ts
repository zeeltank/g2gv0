/**
 * Puts the focus back on the control that opened a small form. The control is taken from a ref or the click event, not from `document.activeElement`
 * (some browsers do not focus a button when it is clicked). One that has since left the page is skipped. Runs on the next turn, after the form has taken
 * itself out of the page, or the form's own clean-up would move the focus again.
 */
export function returnFocusTo(trigger: HTMLElement | null | undefined): void {
  setTimeout(() => {
    if (trigger?.isConnected) trigger.focus()
  }, 0)
}
