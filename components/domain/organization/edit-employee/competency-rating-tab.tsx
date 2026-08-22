'use client'

import React, { useState } from "react";
import { 
  Target, 
  BookOpen, 
  Wrench, 
  HeartHandshake, 
  Users,
  AlertCircle,
  Loader2
} from "lucide-react";
import { Button } from "@/components/ui/button";

export type CategoryType = "Skill" | "Knowledge" | "Ability" | "Attitude" | "Behaviour";

export interface RatingItem {
  id: string;
  title: string;
  description: string;
  /** The employee's assessed level. Null means unassessed - not zero. */
  current_level: number | null;
  /** What the role asks for. Shown as a target, never as their score. */
  required_level?: number | null;
  max_level: number;
}

interface CompetencyRatingTabProps {
  data: Record<CategoryType, RatingItem[]>;
  /** Writes one rating. Resolves on success, rejects with a readable message. */
  onSave?: (category: CategoryType, id: string, newLevel: number) => Promise<any> | void;
  isLoading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  /** Re-reads the ratings after a successful save. */
  onSaved?: () => Promise<void> | void;
}

const CategoryIcons: Record<CategoryType, React.ElementType> = {
  Skill: Target,
  Knowledge: BookOpen,
  Ability: Wrench,
  Attitude: HeartHandshake,
  Behaviour: Users,
};

export function CompetencyRatingTab({ data, onSave, isLoading = false, error, onRetry, onSaved }: CompetencyRatingTabProps) {
  const [activeCategory, setActiveCategory] = useState<CategoryType>("Skill");
  /** Only what the user has changed in this session, keyed by item id. */
  const [staged, setStaged] = useState<Record<string, number>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");

  /*
   * Clicking a dot STAGES a rating; the footer button writes it.
   *
   * It used to fire the save immediately AND render a footer "Save Ratings"
   * button that had no onClick at all - so the visible button did nothing
   * while an invisible write went out on every click. That write was also
   * broken (wrong field name, wrong id space) and unawaited, so the dot lit up
   * on a rating that was never stored. One writer now, and it is the button
   * that says it saves.
   */
  const handleRate = (id: string, level: number) => {
    setSaveMessage("");
    setStaged((prev) => ({ ...prev, [id]: level }));
  };

  const currentItems = data[activeCategory] || [];

  /** Staged items in this category only - Reset and Save are per-category. */
  const stagedHere = currentItems.filter((item) => staged[item.id] !== undefined);

  function resetCategory() {
    setSaveMessage("");
    setStaged((prev) => {
      const next = { ...prev };
      for (const item of currentItems) delete next[item.id];
      return next;
    });
  }

  async function saveRatings() {
    if (!onSave || stagedHere.length === 0) return;

    setIsSaving(true);
    setSaveMessage("");

    const failures: string[] = [];

    // Sequential rather than parallel: these are assessments of one person,
    // and a half-applied batch is easier to reason about when the failures are
    // reported per item rather than as one rejected Promise.all.
    for (const item of stagedHere) {
      try {
        await onSave(activeCategory, item.id, staged[item.id]);
      } catch (cause) {
        failures.push(`${item.title}: ${cause instanceof Error ? cause.message : "refused"}`);
      }
    }

    const saved = stagedHere.length - failures.length;

    if (failures.length === 0) {
      setSaveMessage(`Saved ${saved} rating${saved === 1 ? "" : "s"}.`);
      resetCategory();
      await onSaved?.();
    } else {
      setSaveMessage(
        `${saved} of ${stagedHere.length} saved. ${failures.join(" · ")}`,
      );
    }

    setIsSaving(false);
  }
  const Icon = CategoryIcons[activeCategory];

  if (isLoading) {
    return <div className="flex h-[420px] items-center justify-center rounded-xl border border-border bg-muted/20 text-sm text-muted-foreground"><Loader2 className="mr-2 h-5 w-5 animate-spin text-primary" /> Loading competency data...</div>;
  }

  if (error) {
    return (
      <div className="flex h-[420px] flex-col items-center justify-center gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-6 text-center">
        <p className="text-sm text-destructive">{error}</p>
        {onRetry && <Button variant="outline" size="sm" onClick={onRetry}>Retry</Button>}
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col overflow-hidden animate-in fade-in slide-in-from-right-4 duration-500 pt-4">
      
      {/* Category Navigation (Segmented Control) */}
      <div className="shrink-0 mb-6 px-2">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2 bg-surface p-1.5 rounded-xl border border-border/50 shadow-sm">
          {(Object.keys(CategoryIcons) as CategoryType[]).map((cat) => {
            const CatIcon = CategoryIcons[cat];
            const isActive = activeCategory === cat;

            return (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`flex items-center justify-center w-full gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all whitespace-nowrap cursor-pointer ${
                  isActive 
                    ? "bg-primary text-white shadow-sm" 
                    : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                }`}
              >
                <CatIcon className="w-4 h-4" />
                {cat}
              </button>
            );
          })}
        </div>
      </div>

      {/* Rating List Area */}
      <div className="flex-1 overflow-y-auto pb-20 px-2">
        {currentItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground bg-surface border border-dashed rounded-2xl">
            <AlertCircle className="w-8 h-8 mb-3 opacity-50" />
            <p>No competency data available</p>
          </div>
        ) : (
          <div className="bg-surface border border-border/40 rounded-2xl overflow-hidden shadow-sm">
            {currentItems.map((item, index) => {
              // Staged beats stored; stored beats nothing. `?? ` not `||`, so
              // a stored 0 is not silently read as "unrated".
              const currentRating = staged[item.id] ?? item.current_level ?? 0;
              const isStaged = staged[item.id] !== undefined;
              const isLast = index === currentItems.length - 1;
              
              return (
                <div 
                  key={item.id} 
                  className={`flex flex-col lg:flex-row items-start lg:items-center justify-between p-5 hover:bg-muted/20 transition-colors ${
                    !isLast ? 'border-b border-border/40' : ''
                  }`}
                >
                  {/* Item Details */}
                  <div className="flex-1 pr-8 mb-4 lg:mb-0">
                    <h4 className="font-bold text-foreground text-sm mb-1">
                      {item.title}
                      {isStaged && (
                        <span className="ml-2 rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-600">
                          unsaved
                        </span>
                      )}
                    </h4>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {item.description}
                    </p>
                    {/* The role's requirement, labelled as such. This number
                        used to be rendered as the employee's own rating. */}
                    {item.required_level ? (
                      <p className="mt-1 text-xs text-muted-foreground">
                        Role requires level {item.required_level}
                      </p>
                    ) : null}
                  </div>

                  {/* Minimalist Dot Rating */}
                  <div className="shrink-0 flex items-center gap-6">
                    <div className="flex gap-2">
                      {[1, 2, 3, 4, 5].map((level) => {
                        const isSelected = level <= currentRating;
                        return (
                          <button
                            key={level}
                            onClick={() => handleRate(item.id, level)}
                            className="group relative w-8 h-8 flex items-center justify-center outline-none focus-visible:ring-2 rounded-full focus-visible:ring-primary cursor-pointer"
                            aria-label={`Rate ${level} out of 5`}
                          >
                            <div 
                              className={`w-3.5 h-3.5 rounded-full transition-all duration-300 group-hover:scale-125 ${
                                isSelected 
                                  ? "bg-primary shadow-[0_0_8px_rgba(var(--primary),0.4)]" 
                                  : "bg-border hover:bg-primary/30"
                              }`}
                            />
                            {/* Hover tooltip for level */}
                            <span className="absolute -top-6 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity text-[10px] font-bold text-muted-foreground">
                              {level}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                    <div className="w-16 text-right">
                      {currentRating > 0 ? (
                        <span className="inline-flex items-center justify-center px-2.5 py-1 rounded-md bg-primary/10 text-primary text-xs font-bold">
                          Lvl {currentRating}
                        </span>
                      ) : (
                        <span className="inline-flex items-center justify-center px-2.5 py-1 rounded-md bg-muted text-muted-foreground text-xs font-medium">
                          Unrated
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Action Footer (Sticky) */}
      <div className="absolute bottom-0 left-0 right-0 z-10 flex items-center justify-between gap-3 border-t bg-background/80 p-4 backdrop-blur-md">
        <p className="hidden items-center gap-1.5 text-xs text-muted-foreground sm:flex">
          <AlertCircle className="h-3.5 w-3.5" />
          {saveMessage
            ? saveMessage
            : stagedHere.length > 0
              ? `${stagedHere.length} unsaved change${stagedHere.length === 1 ? '' : 's'} in ${activeCategory}.`
              : 'Click a dot to rate, then save.'}
        </p>
        <div className="flex w-full gap-3 sm:w-auto">
          <Button
            variant="outline"
            className="h-9 flex-1 text-xs font-semibold sm:flex-none"
            onClick={resetCategory}
            disabled={stagedHere.length === 0 || isSaving}
          >
            Reset Category
          </Button>
          <Button
            className="h-9 flex-1 text-xs font-semibold shadow-md sm:flex-none"
            onClick={() => void saveRatings()}
            disabled={stagedHere.length === 0 || isSaving}
          >
            {isSaving ? (
              <>
                <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> Saving...
              </>
            ) : (
              `Save Ratings${stagedHere.length > 0 ? ` (${stagedHere.length})` : ''}`
            )}
          </Button>
        </div>
      </div>

    </div>
  );
}
