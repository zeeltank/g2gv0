'use client'

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { cn } from '@/lib/utils'
import { Settings2 } from 'lucide-react'

export type ActionKey = 'view' | 'add' | 'edit' | 'delete' | 'dashboard' | 'mobile'

export interface ScreenPermission {
  id: string
  name: string
  actions: Record<ActionKey, boolean>
}

export interface ModulePermission {
  id: string
  name: string
  screens: ScreenPermission[]
}

type Props = {
  permissions: ModulePermission[]
  animateKey: number
  onActionToggle: (moduleId: string, screenId: string, action: ActionKey) => void
  onScreenToggleAll: (moduleId: string, screenId: string, value: boolean) => void
  onModuleToggleAll: (moduleId: string, action: ActionKey, value: boolean) => void
}

export function RolePermissionsMatrix({
  permissions,
  animateKey,
  onActionToggle,
  onScreenToggleAll,
  onModuleToggleAll,
}: Props) {
  return (
    <div key={animateKey} className="flex-1 overflow-y-auto bg-surface p-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <Accordion type="multiple" defaultValue={permissions.map((module) => module.id)} className="space-y-4">
        {permissions.map((module) => (
          <AccordionItem
            key={module.id}
            value={module.id}
            className="overflow-hidden rounded-xl border bg-card px-0 shadow-sm transition-all duration-300 data-[state=open]:border-primary/20 hover:shadow-md"
          >
            <AccordionTrigger className="cursor-pointer bg-muted/10 px-6 py-4 transition-colors duration-300 hover:no-underline hover:bg-muted/30 group">
              <div className="flex items-center gap-3 text-left">
                <div className="shrink-0 rounded-md bg-primary/10 p-2 transition-colors duration-300 group-hover:bg-primary/20">
                  <Settings2 className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-foreground">{module.name}</h3>
                  <p className="mt-0.5 text-xs font-normal text-muted-foreground">
                    {module.screens.length} Screens
                  </p>
                </div>
              </div>
            </AccordionTrigger>

            <AccordionContent className="px-0 pb-0 pt-0">
              <div className="w-full overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="border-y bg-muted/10 text-xs uppercase text-muted-foreground">
                    <tr>
                      <th className="px-6 py-3 font-semibold">Screen / Feature</th>
                      <th className="w-24 px-4 py-3 font-semibold text-center">
                        <div className="flex flex-col items-center gap-2">
                          <span>View</span>
                          <Checkbox
                            className="cursor-pointer"
                            checked={module.screens.length > 0 && module.screens.every((screen) => screen.actions.view)}
                            onCheckedChange={(checked) => onModuleToggleAll(module.id, 'view', !!checked)}
                          />
                        </div>
                      </th>
                      <th className="w-24 px-4 py-3 font-semibold text-center">
                        <div className="flex flex-col items-center gap-2">
                          <span>Add</span>
                          <Checkbox
                            className="cursor-pointer"
                            checked={module.screens.length > 0 && module.screens.every((screen) => screen.actions.add)}
                            onCheckedChange={(checked) => onModuleToggleAll(module.id, 'add', !!checked)}
                          />
                        </div>
                      </th>
                      <th className="w-24 px-4 py-3 font-semibold text-center">
                        <div className="flex flex-col items-center gap-2">
                          <span>Edit</span>
                          <Checkbox
                            className="cursor-pointer"
                            checked={module.screens.length > 0 && module.screens.every((screen) => screen.actions.edit)}
                            onCheckedChange={(checked) => onModuleToggleAll(module.id, 'edit', !!checked)}
                          />
                        </div>
                      </th>
                      <th className="w-24 px-4 py-3 font-semibold text-center">
                        <div className="flex flex-col items-center gap-2">
                          <span>Delete</span>
                          <Checkbox
                            className="cursor-pointer"
                            checked={module.screens.length > 0 && module.screens.every((screen) => screen.actions.delete)}
                            onCheckedChange={(checked) => onModuleToggleAll(module.id, 'delete', !!checked)}
                          />
                        </div>
                      </th>
                      <th className="w-28 border-l px-4 py-3 font-semibold text-center">
                        <div className="flex flex-col items-center gap-2">
                          <span>Dashboard</span>
                          <Checkbox
                            className="cursor-pointer"
                            checked={module.screens.length > 0 && module.screens.every((screen) => screen.actions.dashboard)}
                            onCheckedChange={(checked) => onModuleToggleAll(module.id, 'dashboard', !!checked)}
                          />
                        </div>
                      </th>
                      <th className="w-24 px-4 py-3 font-semibold text-center">
                        <div className="flex flex-col items-center gap-2">
                          <span>Mobile</span>
                          <Checkbox
                            className="cursor-pointer"
                            checked={module.screens.length > 0 && module.screens.every((screen) => screen.actions.mobile)}
                            onCheckedChange={(checked) => onModuleToggleAll(module.id, 'mobile', !!checked)}
                          />
                        </div>
                      </th>
                      <th className="w-32 border-l px-6 py-3 text-right font-semibold">Quick Select</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/50">
                    {module.screens.map((screen) => {
                      const isAllSelected = ['view', 'add', 'edit', 'delete', 'dashboard', 'mobile'].every(
                        (action) => screen.actions[action as ActionKey],
                      )

                      return (
                        <tr key={screen.id} className="transition-colors hover:bg-muted/30">
                          <td className="px-6 py-4 font-medium text-foreground">{screen.name}</td>
                          <td className="px-4 py-4 text-center">
                            <Checkbox
                              checked={screen.actions.view}
                              onCheckedChange={() => onActionToggle(module.id, screen.id, 'view')}
                              className="inline-block cursor-pointer transition-transform hover:scale-110 active:scale-95"
                            />
                          </td>
                          <td className="px-4 py-4 text-center">
                            <Checkbox
                              checked={screen.actions.add}
                              onCheckedChange={() => onActionToggle(module.id, screen.id, 'add')}
                              className="inline-block cursor-pointer transition-transform hover:scale-110 active:scale-95"
                            />
                          </td>
                          <td className="px-4 py-4 text-center">
                            <Checkbox
                              checked={screen.actions.edit}
                              onCheckedChange={() => onActionToggle(module.id, screen.id, 'edit')}
                              className="inline-block cursor-pointer transition-transform hover:scale-110 active:scale-95"
                            />
                          </td>
                          <td className="px-4 py-4 text-center">
                            <Checkbox
                              checked={screen.actions.delete}
                              onCheckedChange={() => onActionToggle(module.id, screen.id, 'delete')}
                              className="inline-block cursor-pointer transition-transform hover:scale-110 active:scale-95"
                            />
                          </td>
                          <td className="border-l bg-muted/5 px-4 py-4 text-center">
                            <Checkbox
                              checked={screen.actions.dashboard}
                              onCheckedChange={() => onActionToggle(module.id, screen.id, 'dashboard')}
                              className="inline-block cursor-pointer transition-transform hover:scale-110 active:scale-95"
                            />
                          </td>
                          <td className="bg-muted/5 px-4 py-4 text-center">
                            <Checkbox
                              checked={screen.actions.mobile}
                              onCheckedChange={() => onActionToggle(module.id, screen.id, 'mobile')}
                              className="inline-block cursor-pointer transition-transform hover:scale-110 active:scale-95"
                            />
                          </td>
                          <td className="border-l px-6 py-4 text-right">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => onScreenToggleAll(module.id, screen.id, !isAllSelected)}
                              className="h-7 cursor-pointer text-xs transition-all duration-200 hover:bg-primary/10 hover:text-primary active:scale-95"
                            >
                              {isAllSelected ? 'Deselect All' : 'Select All'}
                            </Button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </div>
  )
}
