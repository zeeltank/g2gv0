'use client';

/**
 * Hosts one module's AI Stack inside a G2G screen — the nine shared tabs, switchable.
 *
 * This is the part of LMS_K12's Fees-style `module-category-page.tsx` the AI Stack uses:
 * its tab strip (same markup, same colours, the icon and the active dot) and its rule
 * that only the open tab renders, remembered in the URL so a refresh or the back button
 * lands on the same tab. The tab key is `aiTab`, not LMS_K12's `tab`, because several
 * G2G screens already use `?tab=` for their own tabs.
 *
 * The screens themselves come from `buildAiStackScreens(module)` unchanged.
 */

import { useCallback, useMemo, type ReactNode } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import type { LucideIcon } from 'lucide-react';

import { buildAiStackScreens } from './build-ai-stack-screens';
import type { AiStackModule } from './ai-stack-module';

/** One in-page screen. The same type as LMS_K12's `ModuleStaticScreen`. */
export type ModuleStaticScreen = {
  id: string;
  label: string;
  icon?: LucideIcon;
  render: () => ReactNode;
};

const TAB_PARAM = 'aiTab';

export function AiStackTabs({ module }: { module: AiStackModule }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const tabs = useMemo(() => buildAiStackScreens(module), [module]);
  const requested = searchParams.get(TAB_PARAM);
  const activeTab = tabs.find((tab) => tab.id === requested) ?? tabs[0] ?? null;

  const selectTab = useCallback(
    (tab: ModuleStaticScreen) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set(TAB_PARAM, tab.id);
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-5 overflow-x-auto border-b border-[#D9E3F1]">
        {tabs.map((tab) => {
          const isActive = activeTab?.id === tab.id;
          const Icon = tab.icon;

          return (
            <button
              key={tab.id}
              type="button"
              aria-current={isActive ? 'page' : undefined}
              onClick={() => selectTab(tab)}
              className={`-mb-px inline-flex shrink-0 items-center gap-2 border-b-2 pb-2 text-[14px] font-semibold transition ${
                isActive
                  ? 'border-[#5846EA] text-[#5846EA]'
                  : 'border-transparent text-[#5F7087] hover:text-[#334155]'
              }`}
            >
              {Icon ? <Icon size={16} /> : null}
              {tab.label}
              {Icon && isActive ? <span className="h-1.5 w-1.5 rounded-full bg-[#5846EA]" /> : null}
            </button>
          );
        })}
      </div>

      {activeTab ? <div key={activeTab.id}>{activeTab.render()}</div> : null}
    </div>
  );
}
