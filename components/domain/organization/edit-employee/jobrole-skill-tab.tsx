'use client'

import React, { useState, useMemo } from "react";
import { CheckCircle2, Circle, GraduationCap, Wrench, ChevronRight, Check, AlertCircle, BookOpen, HeartHandshake, Users, Award, Briefcase, Tag } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * One classification statement - an s_skill_knowledge_ability row.
 *
 * The API now sends {id, item}; it used to send the prose alone, having
 * discarded the id in a pluck(). Both shapes are accepted so an older response
 * still renders, but only the id form can be saved - a label is not an
 * identity, and storing prose would orphan every confirmation the moment
 * somebody renamed a library item.
 */
export type ClassificationItem = string | { id: number; item: string };

export interface Skill {
  jobrole_skill_id?: number | string;
  jobrole?: string;
  skill_id: number | string;
  skill?: string;
  title?: string;
  category?: string;
  sub_category?: string;
  description?: string;
  proficiency_level?: string | number;
  knowledge?: ClassificationItem[];
  ability?: ClassificationItem[];
  attitude?: ClassificationItem[];
  behaviour?: ClassificationItem[];
  validated?: boolean;
}

export type ConfirmedItems = {
  knowledge?: number[];
  ability?: number[];
  attitude?: number[];
  behaviour?: number[];
};

interface JobroleSkillTabProps {
  employee?: any;
  skills: Skill[];
  /** What was previously confirmed, keyed by skill_id, to seed the ticks. */
  savedSelections?: Record<string, ConfirmedItems>;
  /** Persists the confirmations for one skill. Rejects with a readable message. */
  onSave?: (skillId: string | number, confirmed: ConfirmedItems) => Promise<any> | void;
}

const DIMENSIONS = ['knowledge', 'ability', 'attitude', 'behaviour'] as const;
type Dimension = (typeof DIMENSIONS)[number];

/** The id of a classification item, or null for a legacy prose-only entry. */
function itemId(item: ClassificationItem): number | null {
  return typeof item === 'object' && item !== null && typeof item.id === 'number' ? item.id : null;
}

function itemLabel(item: ClassificationItem): string {
  return typeof item === 'object' && item !== null ? item.item : String(item ?? '');
}

export function JobroleSkillTab({ employee, skills = [], savedSelections = {}, onSave }: JobroleSkillTabProps) {
  const getSkillId = (s: Skill) => String(s.jobrole_skill_id || s.skill_id || s.title || s.skill);

  const [selectedSkillId, setSelectedSkillId] = useState<string | null>(
    skills && skills.length > 0 ? getSkillId(skills[0]) : null
  );

  const [validationState, setValidationState] = useState<Record<string, boolean>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');

  // Fast memoized lookup to avoid re-fetching or re-searching
  const selectedSkill = useMemo(() => {
    if (!skills || skills.length === 0) return null;
    return skills.find(s => getSkillId(s) === selectedSkillId) || skills[0];
  }, [skills, selectedSkillId]);

  /*
   * Ticks are keyed on the ITEM's id, not its position in the list.
   *
   * The index-based key was fine while nothing was stored, because nothing
   * outlived the tab. Now that confirmations persist, position is the wrong
   * identity: reorder or edit the library and every stored tick would point at
   * a different statement.
   */
  const toggleValidation = (type: string, itemKey: number | string, value: boolean) => {
    if (!selectedSkill) return;
    const idKey = getSkillId(selectedSkill);
    setSaveMessage('');
    setValidationState(prev => ({
      ...prev,
      [`${idKey}-${type}-${itemKey}`]: value
    }));
  };

  // Seed the ticks from what was saved for this skill, so re-opening the
  // drawer shows the assessment instead of a blank slate every time.
  React.useEffect(() => {
    const seeded: Record<string, boolean> = {};
    for (const skill of skills) {
      const key = getSkillId(skill);
      const saved = savedSelections[String(skill.skill_id)] ?? savedSelections[key];
      if (!saved) continue;
      for (const dimension of DIMENSIONS) {
        for (const id of saved[dimension] ?? []) {
          seeded[`${key}-${dimension}-${id}`] = true;
        }
      }
    }
    setValidationState(seeded);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [skills, savedSelections]);

  /** The confirmed ids for the selected skill, per dimension. */
  const confirmedForSelected = (): ConfirmedItems => {
    if (!selectedSkill) return {};
    const key = getSkillId(selectedSkill);
    const confirmed: ConfirmedItems = {};

    for (const dimension of DIMENSIONS) {
      const items = (selectedSkill[dimension] ?? []) as ClassificationItem[];
      // Only id-bearing items can be stored; a legacy prose entry has no
      // identity to record, so it is left out rather than guessed at.
      const ids = items
        .map((item) => itemId(item))
        .filter((id): id is number => id !== null)
        .filter((id) => validationState[`${key}-${dimension}-${id}`] === true);

      confirmed[dimension] = ids;
    }

    return confirmed;
  };

  async function saveConfirmations() {
    if (!onSave || !selectedSkill) return;
    setIsSaving(true);
    setSaveMessage('');
    try {
      await onSave(selectedSkill.skill_id, confirmedForSelected());
      setSaveMessage('Saved.');
    } catch (cause) {
      setSaveMessage(cause instanceof Error ? cause.message : 'Could not save.');
    } finally {
      setIsSaving(false);
    }
  }

  const setOverallProficiency = (value: boolean) => {
    if (!selectedSkill) return;
    const idKey = getSkillId(selectedSkill);
    setValidationState(prev => ({
      ...prev,
      [`${idKey}-overall`]: value
    }));
  };

  // Empty state handling as specified in requirements
  if (!skills || skills.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-[400px] text-muted-foreground space-y-4 animate-in fade-in zoom-in duration-300">
        <div className="p-4 rounded-full bg-muted/50 border">
          <GraduationCap className="size-8 opacity-50 text-primary" />
        </div>
        <p className="text-sm font-medium text-foreground">No skills available for this job role.</p>
        <p className="text-xs text-muted-foreground">This employee profile currently has no assigned job role skills in the system.</p>
      </div>
    );
  }

  const skillTitle = selectedSkill?.title || selectedSkill?.skill || 'Unnamed Skill';
  const skillJobRole = selectedSkill?.jobrole || employee?.jobRole || 'N/A';
  const currentSkillKey = selectedSkill ? getSkillId(selectedSkill) : '';

  return (
    <div className="flex flex-col md:flex-row gap-6 h-full overflow-hidden animate-in fade-in slide-in-from-right-4 duration-500 relative">
      
      {/* Sidebar: Clickable Skills List */}
      <div className="w-full md:w-80 shrink-0 flex flex-col gap-3 overflow-y-auto pr-2 pb-16 border-r border-border/40">
        <div className="flex items-center justify-between mb-1">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Required Skills ({skills.length})</h3>
        </div>

        {skills.map((s) => {
          const sId = getSkillId(s);
          const isSelected = sId === (selectedSkill ? getSkillId(selectedSkill) : '');
          const isProficient = validationState[`${sId}-overall`] === true;
          const name = s.title || s.skill || 'Unnamed Skill';

          return (
            <button
              key={sId}
              type="button"
              onClick={() => setSelectedSkillId(sId)}
              className={`flex items-start justify-between p-3.5 rounded-xl transition-all border text-left cursor-pointer ${
                isSelected 
                  ? 'bg-primary/10 border-primary/40 shadow-sm ring-1 ring-primary/20' 
                  : 'bg-surface border-border/40 hover:border-primary/30 hover:bg-surface-muted'
              }`}
            >
              <div className="flex items-start gap-3 overflow-hidden">
                {isProficient ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
                ) : (
                  <Circle className="w-5 h-5 text-muted-foreground/30 shrink-0 mt-0.5" />
                )}
                <div className="flex flex-col overflow-hidden gap-1">
                  <span className={`text-sm leading-snug ${isSelected ? 'font-semibold text-primary' : 'font-medium text-foreground'}`}>
                    {name}
                  </span>
                  {s.category && (
                    <span className="text-[11px] text-muted-foreground inline-flex items-center gap-1">
                      <Tag className="w-3 h-3" /> {s.category}
                    </span>
                  )}
                </div>
              </div>
              {s.proficiency_level && (
                <span className={`text-xs px-2 py-0.5 rounded-md font-semibold shrink-0 ml-2 ${
                  isSelected ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
                }`}>
                  Lvl {s.proficiency_level}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Main Content Area: Instant Details Panel */}
      <div className="flex-1 overflow-y-auto pb-20 pr-2">
        {selectedSkill ? (
          <div className="flex flex-col gap-6 max-w-4xl">
            
            {/* Detailed Header Card */}
            <div className="bg-surface border rounded-2xl p-6 shadow-sm relative overflow-hidden">
              <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full -translate-y-1/2 translate-x-1/3 blur-3xl pointer-events-none" />
              
              <div className="relative z-10 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-4 border-b pb-4">
                  <div>
                    <div className="flex items-center gap-2 text-xs font-semibold text-primary uppercase tracking-wider mb-1">
                      <Briefcase className="w-3.5 h-3.5" /> {skillJobRole}
                    </div>
                    <h2 className="text-2xl font-bold text-foreground">{skillTitle}</h2>
                  </div>

                  {selectedSkill.proficiency_level && (
                    <div className="flex items-center gap-2 bg-primary/10 border border-primary/20 px-4 py-2 rounded-xl">
                      <Award className="w-5 h-5 text-primary" />
                      <div>
                        <div className="text-[10px] uppercase font-semibold text-muted-foreground">Proficiency Level</div>
                        <div className="text-sm font-bold text-primary">Level {selectedSkill.proficiency_level}</div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Metadata badges (Category & Sub category) */}
                <div className="flex flex-wrap gap-2">
                  {selectedSkill.category && (
                    <span className="inline-flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-semibold bg-muted text-foreground border border-border/50">
                      <Tag className="w-3.5 h-3.5 text-primary" /> Category: {selectedSkill.category}
                    </span>
                  )}
                  {selectedSkill.sub_category && (
                    <span className="inline-flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-semibold bg-muted text-muted-foreground border border-border/50">
                      Sub-Category: {selectedSkill.sub_category}
                    </span>
                  )}
                </div>

                {/* Description */}
                {selectedSkill.description && (
                  <div className="bg-background/60 p-4 rounded-xl border border-border/50 text-sm text-foreground/90 leading-relaxed">
                    <span className="font-semibold text-foreground">Description: </span>
                    {selectedSkill.description}
                  </div>
                )}

                {/* Overall Proficiency Toggle */}
                <div className="flex items-center justify-between bg-background p-4 rounded-xl border border-border/50">
                  <span className="text-sm font-medium text-foreground">Are you proficient in this skill?</span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setOverallProficiency(true)}
                      className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-all duration-200 cursor-pointer active:scale-95 ${
                        validationState[`${currentSkillKey}-overall`] === true 
                          ? 'bg-emerald-500 text-white shadow-md' 
                          : 'bg-muted text-muted-foreground hover:bg-muted/80'
                      }`}
                    >
                      Yes
                    </button>
                    <button
                      type="button"
                      onClick={() => setOverallProficiency(false)}
                      className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-all duration-200 cursor-pointer active:scale-95 ${
                        validationState[`${currentSkillKey}-overall`] === false 
                          ? 'bg-destructive text-white shadow-md' 
                          : 'bg-muted text-muted-foreground hover:bg-muted/80'
                      }`}
                    >
                      No
                    </button>
                  </div>
                </div>

              </div>
            </div>

            {/* Bulleted Lists Grid for Knowledge, Ability, Attitude, Behaviour */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              {/* Knowledge Section */}
              <div className="flex flex-col gap-3 bg-surface border rounded-2xl p-5 shadow-xs">
                <div className="flex items-center gap-2 text-primary font-semibold pb-2 border-b">
                  <GraduationCap className="w-5 h-5" />
                  <h3>Knowledge</h3>
                </div>
                {selectedSkill.knowledge && selectedSkill.knowledge.length > 0 ? (
                  <ul className="space-y-2.5 pt-1">
                    {selectedSkill.knowledge.map((item, index) => {
                      const key = itemId(item) ?? index;
                      const isYes = validationState[`${currentSkillKey}-knowledge-${key}`] === true;
                      const isNo = validationState[`${currentSkillKey}-knowledge-${key}`] === false;

                      return (
                        <li key={index} className="flex items-start justify-between gap-3 text-sm p-2.5 rounded-lg bg-background border border-border/40">
                          <span className="text-foreground/90 flex-1 leading-snug">• {itemLabel(item)}</span>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <button
                              type="button"
                              onClick={() => toggleValidation('knowledge', key, true)}
                              className={`p-1 rounded text-xs font-semibold transition-colors ${
                                isYes ? 'bg-emerald-500 text-white' : 'bg-muted text-muted-foreground hover:bg-muted/80'
                              }`}
                            >
                              <Check className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => toggleValidation('knowledge', key, false)}
                              className={`p-1 rounded text-xs font-semibold transition-colors ${
                                isNo ? 'bg-destructive text-white' : 'bg-muted text-muted-foreground hover:bg-muted/80'
                              }`}
                            >
                              ×
                            </button>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <p className="text-xs text-muted-foreground italic py-2">No specific knowledge items listed.</p>
                )}
              </div>

              {/* Ability Section */}
              <div className="flex flex-col gap-3 bg-surface border rounded-2xl p-5 shadow-xs">
                <div className="flex items-center gap-2 text-primary font-semibold pb-2 border-b">
                  <Wrench className="w-5 h-5" />
                  <h3>Ability</h3>
                </div>
                {selectedSkill.ability && selectedSkill.ability.length > 0 ? (
                  <ul className="space-y-2.5 pt-1">
                    {selectedSkill.ability.map((item, index) => {
                      const key = itemId(item) ?? index;
                      const isYes = validationState[`${currentSkillKey}-ability-${key}`] === true;
                      const isNo = validationState[`${currentSkillKey}-ability-${key}`] === false;

                      return (
                        <li key={index} className="flex items-start justify-between gap-3 text-sm p-2.5 rounded-lg bg-background border border-border/40">
                          <span className="text-foreground/90 flex-1 leading-snug">• {itemLabel(item)}</span>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <button
                              type="button"
                              onClick={() => toggleValidation('ability', key, true)}
                              className={`p-1 rounded text-xs font-semibold transition-colors ${
                                isYes ? 'bg-emerald-500 text-white' : 'bg-muted text-muted-foreground hover:bg-muted/80'
                              }`}
                            >
                              <Check className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => toggleValidation('ability', key, false)}
                              className={`p-1 rounded text-xs font-semibold transition-colors ${
                                isNo ? 'bg-destructive text-white' : 'bg-muted text-muted-foreground hover:bg-muted/80'
                              }`}
                            >
                              ×
                            </button>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <p className="text-xs text-muted-foreground italic py-2">No specific ability items listed.</p>
                )}
              </div>

              {/* Attitude Section */}
              <div className="flex flex-col gap-3 bg-surface border rounded-2xl p-5 shadow-xs">
                <div className="flex items-center gap-2 text-primary font-semibold pb-2 border-b">
                  <HeartHandshake className="w-5 h-5" />
                  <h3>Attitude</h3>
                </div>
                {selectedSkill.attitude && selectedSkill.attitude.length > 0 ? (
                  <ul className="space-y-2.5 pt-1">
                    {selectedSkill.attitude.map((item, index) => {
                      const key = itemId(item) ?? index;
                      const isYes = validationState[`${currentSkillKey}-attitude-${key}`] === true;
                      const isNo = validationState[`${currentSkillKey}-attitude-${key}`] === false;

                      return (
                        <li key={index} className="flex items-start justify-between gap-3 text-sm p-2.5 rounded-lg bg-background border border-border/40">
                          <span className="text-foreground/90 flex-1 leading-snug">• {itemLabel(item)}</span>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <button
                              type="button"
                              onClick={() => toggleValidation('attitude', key, true)}
                              className={`p-1 rounded text-xs font-semibold transition-colors ${
                                isYes ? 'bg-emerald-500 text-white' : 'bg-muted text-muted-foreground hover:bg-muted/80'
                              }`}
                            >
                              <Check className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => toggleValidation('attitude', key, false)}
                              className={`p-1 rounded text-xs font-semibold transition-colors ${
                                isNo ? 'bg-destructive text-white' : 'bg-muted text-muted-foreground hover:bg-muted/80'
                              }`}
                            >
                              ×
                            </button>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <p className="text-xs text-muted-foreground italic py-2">No specific attitude items listed.</p>
                )}
              </div>

              {/* Behaviour Section */}
              <div className="flex flex-col gap-3 bg-surface border rounded-2xl p-5 shadow-xs">
                <div className="flex items-center gap-2 text-primary font-semibold pb-2 border-b">
                  <Users className="w-5 h-5" />
                  <h3>Behaviour</h3>
                </div>
                {selectedSkill.behaviour && selectedSkill.behaviour.length > 0 ? (
                  <ul className="space-y-2.5 pt-1">
                    {selectedSkill.behaviour.map((item, index) => {
                      const key = itemId(item) ?? index;
                      const isYes = validationState[`${currentSkillKey}-behaviour-${key}`] === true;
                      const isNo = validationState[`${currentSkillKey}-behaviour-${key}`] === false;

                      return (
                        <li key={index} className="flex items-start justify-between gap-3 text-sm p-2.5 rounded-lg bg-background border border-border/40">
                          <span className="text-foreground/90 flex-1 leading-snug">• {itemLabel(item)}</span>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <button
                              type="button"
                              onClick={() => toggleValidation('behaviour', key, true)}
                              className={`p-1 rounded text-xs font-semibold transition-colors ${
                                isYes ? 'bg-emerald-500 text-white' : 'bg-muted text-muted-foreground hover:bg-muted/80'
                              }`}
                            >
                              <Check className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => toggleValidation('behaviour', key, false)}
                              className={`p-1 rounded text-xs font-semibold transition-colors ${
                                isNo ? 'bg-destructive text-white' : 'bg-muted text-muted-foreground hover:bg-muted/80'
                              }`}
                            >
                              ×
                            </button>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <p className="text-xs text-muted-foreground italic py-2">No specific behaviour items listed.</p>
                )}
              </div>

            </div>

            {/*
              * The save this tab never had.
              *
              * Ten ✓/× buttons wrote to component state and nothing else, so
              * every assessment recorded here was discarded the moment the tab
              * unmounted - and the green ticks in the sidebar were pure
              * session decoration.
              */}
            {onSave && (
              <div className="sticky bottom-0 -mx-1 mt-4 flex items-center justify-between gap-3 border-t bg-background/90 px-1 py-3 backdrop-blur-md">
                <p className="text-xs text-muted-foreground">
                  {saveMessage || `Confirmations are recorded against ${skillTitle}.`}
                </p>
                <Button size="sm" onClick={() => void saveConfirmations()} disabled={isSaving}>
                  {isSaving ? 'Saving...' : 'Save assessment'}
                </Button>
              </div>
            )}

          </div>
        ) : null}
      </div>

    </div>
  );
}
