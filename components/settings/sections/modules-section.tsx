'use client'

import { useState } from 'react'
import { Check, Loader2 } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
  ModuleConfiguration,
  type ModuleConfigurationHandle,
} from '@/components/settings/module-configuration'

/**
 * MODULES, inside Settings where it belongs.
 *
 * The same `ModuleConfiguration` component the setup wizard's step uses and the
 * standalone `/settings/module-configuration` page wraps — one component, now
 * three placements, and still one implementation. It was a SIBLING of Settings
 * rather than part of it, which is why `/settings` redirected to it: the hub had
 * nothing else in it to show.
 *
 * `/settings/module-configuration` stays a working URL. It is linked from the
 * wizard and from the module cards, and quietly breaking a bookmarked settings
 * page to tidy a route is not an improvement.
 */
export function ModulesSection() {
  /*
   * THE HANDLE IS STATE, NOT A REF.
   *
   * It was a ref, and that made the Save button dangerous. `ModuleConfiguration`
   * publishes its handle on mount - while `loading` is still true and the module
   * list is still empty - and a ref does not re-render the host when the handle
   * changes. So this footer never saw `loading` flip and its button was live
   * from the first paint.
   *
   * Clicking it then saved an EMPTY selection, and the endpoint treats the
   * payload as the complete set of modules that should be on. One early click
   * switched every optional module off for the whole organisation.
   */
  const [handle, setHandle] = useState<ModuleConfigurationHandle | null>(null)
  const [busy, setBusy] = useState(false)
  const [saved, setSaved] = useState<number | null>(null)

  const ready = handle !== null && !handle.loading && !handle.saving

  async function save() {
    if (!handle || !ready) return

    setBusy(true)
    setSaved(null)
    await handle.save()
    setBusy(false)
  }

  return (
    <div className="space-y-6">
      {saved !== null && (
        <Alert variant="success">
          <Check className="size-4" aria-hidden="true" />
          <AlertDescription>
            Saved. {saved} {saved === 1 ? 'module is' : 'modules are'} on, and the navigation has
            been updated.
          </AlertDescription>
        </Alert>
      )}

      <ModuleConfiguration onReady={setHandle} onSaved={setSaved} />

      <div className="flex justify-end border-t border-border pt-5">
        <Button onClick={save} disabled={busy || !ready}>
          {busy && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
          {busy ? 'Saving…' : handle?.loading ? 'Loading…' : 'Save modules'}
        </Button>
      </div>
    </div>
  )
}
