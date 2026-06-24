import React, { useState } from "react";
import { 
  Target, 
  BookOpen, 
  Wrench, 
  HeartHandshake, 
  Users,
  AlertCircle
} from "lucide-react";
import { Button } from "@/components/ui/button";

export type CategoryType = "Skill" | "Knowledge" | "Ability" | "Attitude" | "Behaviour";

export interface RatingItem {
  id: string;
  title: string;
  description: string;
  current_level: number | null;
  max_level: number;
}

interface CompetencyRatingTabProps {
  data: Record<CategoryType, RatingItem[]>;
  onSave?: (category: CategoryType, id: string, newLevel: number) => void;
}

const CategoryIcons: Record<CategoryType, React.ElementType> = {
  Skill: Target,
  Knowledge: BookOpen,
  Ability: Wrench,
  Attitude: HeartHandshake,
  Behaviour: Users,
};

export function CompetencyRatingTab({ data, onSave }: CompetencyRatingTabProps) {
  const [activeCategory, setActiveCategory] = useState<CategoryType>("Skill");
  const [ratings, setRatings] = useState<Record<string, number>>({});

  const handleRate = (id: string, level: number) => {
    setRatings((prev) => ({ ...prev, [id]: level }));
    if (onSave) onSave(activeCategory, id, level);
  };

  const currentItems = data[activeCategory] || [];
  const Icon = CategoryIcons[activeCategory];

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
            <p>No items found for {activeCategory}.</p>
          </div>
        ) : (
          <div className="bg-surface border border-border/40 rounded-2xl overflow-hidden shadow-sm">
            {currentItems.map((item, index) => {
              const currentRating = ratings[item.id] || item.current_level || 0;
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
                    <h4 className="font-bold text-foreground text-sm mb-1">{item.title}</h4>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {item.description}
                    </p>
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
      <div className="absolute bottom-0 left-0 right-0 p-4 bg-background/80 backdrop-blur-md border-t flex items-center justify-between z-10">
        <p className="text-xs text-muted-foreground hidden sm:flex items-center gap-1.5">
          <AlertCircle className="w-3.5 h-3.5" /> Please review all items carefully before saving your changes.
        </p>
        <div className="flex gap-3 w-full sm:w-auto">
          <Button variant="outline" className="font-semibold text-xs h-9 flex-1 sm:flex-none">Reset Category</Button>
          <Button className="font-semibold shadow-md text-xs h-9 flex-1 sm:flex-none">Save Ratings</Button>
        </div>
      </div>

    </div>
  );
}
