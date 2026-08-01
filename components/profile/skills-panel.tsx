'use client'

import { useState } from 'react'
import { type EmployeeSkill } from '@/services/hrms/employee'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Info, ArrowLeft } from 'lucide-react'

interface SkillsPanelProps {
  skills: EmployeeSkill[]
}

function SkillDetail({ skill }: { skill: EmployeeSkill }) {
  const listItems = (items: string[] | undefined, label: string) => {
    if (!items || items.length === 0) return null
    return (
      <div className="space-y-1">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </p>
        <ul className="list-disc pl-5 space-y-1 text-sm text-foreground">
          {items.map((item, idx) => (
            <li key={idx}>{item}</li>
          ))}
        </ul>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Skill Title
        </p>
        <p className="text-sm font-medium text-foreground">
          {skill.title || skill.skill}
        </p>
      </div>

      <Separator />

      <div className="grid grid-cols-2 gap-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Job Role
          </p>
          <p className="text-sm font-medium text-foreground">{skill.jobrole}</p>
        </div>
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Proficiency Level
          </p>
          <p className="text-sm font-medium text-foreground">
            {skill.proficiency_level ?? 'N/A'}
          </p>
        </div>
      </div>

      <Separator />

      <div className="grid grid-cols-2 gap-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Category
          </p>
          <p className="text-sm font-medium text-foreground">
            {skill.category ?? 'N/A'}
          </p>
        </div>
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Sub Category
          </p>
          <p className="text-sm font-medium text-foreground">
            {skill.sub_category ?? 'N/A'}
          </p>
        </div>
      </div>

      {skill.description && (
        <>
          <Separator />
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Description
            </p>
            <p className="text-sm text-foreground">{skill.description}</p>
          </div>
        </>
      )}

      {listItems(skill.knowledge, 'Knowledge')}
      {listItems(skill.ability, 'Ability')}
      {listItems(skill.behaviour, 'Behaviour')}
      {listItems(skill.attitude, 'Attitude')}
    </div>
  )
}

export function SkillsPanel({ skills }: SkillsPanelProps) {
  const [selectedSkillId, setSelectedSkillId] = useState<number | null>(null)

  const selectedSkill = skills.find((s) => s.jobrole_skill_id === selectedSkillId) ?? null

  if (skills.length === 0) {
    return (
      <div className="flex-1">
        <Card className="p-6">
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Info className="mb-3 h-10 w-10 text-muted-foreground" />
            <p className="text-sm font-medium text-foreground">
              No skills available for this job role.
            </p>
          </div>
        </Card>
      </div>
    )
  }

  return (
    <div className="flex gap-6">
      {/* Skills List */}
      <div className="w-72 shrink-0">
        <Card className="overflow-hidden">
          <div className="p-3">
            <div className="h-[calc(100vh-200px)] overflow-y-auto">
              <div className="flex flex-col gap-1">
                {skills.map((skill) => {
                  const isSelected = skill.jobrole_skill_id === selectedSkillId
                  return (
                    <button
                      key={skill.jobrole_skill_id}
                      type="button"
                      onClick={() => setSelectedSkillId(skill.jobrole_skill_id)}
                      className={`flex w-full items-start gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition-colors outline-none ${
                        isSelected
                          ? 'bg-warning/10 text-warning'
                          : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                      }`}
                    >
                      <span className="mt-0.5 shrink-0">
                        <Badge
                          variant={isSelected ? 'warning' : 'outline'}
                          className="text-xs"
                        >
                          {skill.skill_id}
                        </Badge>
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">
                          {skill.skill}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">
                          {skill.jobrole}
                        </p>
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* Skill Detail Panel */}
      <div className="flex-1">
        {selectedSkill ? (
          <Card className="p-6">
            <div className="mb-4 flex items-center gap-2">
              <button
                type="button"
                onClick={() => setSelectedSkillId(null)}
                className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
              >
                <ArrowLeft className="h-4 w-4" />
                Back to list
              </button>
            </div>
            <SkillDetail skill={selectedSkill} />
          </Card>
        ) : (
          <Card className="p-6">
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Info className="mb-3 h-10 w-10 text-muted-foreground" />
              <p className="text-sm font-medium text-foreground">
                Select a skill to view details
              </p>
            </div>
          </Card>
        )}
      </div>
    </div>
  )
}