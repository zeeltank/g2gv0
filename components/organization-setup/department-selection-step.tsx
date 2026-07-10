'use client'

import { useState } from 'react'
import { Search, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { SearchInput } from '@/components/ui/search-input'
import { cn } from '@/lib/utils'

const departmentSuggestions: Record<string, string[]> = {
  'Information Technology': [
    'Engineering',
    'Product Management',
    'Quality Assurance',
    'DevOps',
    'UI/UX Design',
    'Human Resources',
    'Finance',
    'Sales',
    'Marketing',
    'Customer Support',
    'Administration',
  ],
  Manufacturing: [
    'Production',
    'Quality Control',
    'Maintenance',
    'Procurement',
    'Warehouse',
    'Human Resources',
    'Finance',
    'Sales',
  ],
  Healthcare: [
    'Clinical Operations',
    'Nursing',
    'Patient Support',
    'Compliance',
    'Human Resources',
    'Finance',
    'Administration',
  ],
}

interface DepartmentSelectionStepProps {
  industryType: string
  departmentSearch: string
  setDepartmentSearch: (value: string) => void
  selectedDepartments: string[]
  toggleDepartment: (department: string) => void
  customDepartment: string
  setCustomDepartment: (value: string) => void
  addCustomDepartment: () => void
  saveDepartments: () => void
}

export function DepartmentSelectionStep({
  industryType,
  departmentSearch,
  setDepartmentSearch,
  selectedDepartments,
  toggleDepartment,
  customDepartment,
  setCustomDepartment,
  addCustomDepartment,
  saveDepartments,
}: DepartmentSelectionStepProps) {
  const filteredDepartments = departmentSuggestions[industryType]?.filter((department) =>
    department.toLowerCase().includes(departmentSearch.toLowerCase()),
  ) ?? departmentSuggestions['Information Technology'].filter((department) =>
    department.toLowerCase().includes(departmentSearch.toLowerCase()),
  )

  return (
    <div className="space-y-5">
      <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h3 className="text-xl font-semibold text-foreground">
              Suggested Departments for {industryType}
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Select one or more departments to create your initial
              organization structure.
            </p>
          </div>
          <SearchInput
            value={departmentSearch}
            onChange={(event) =>
              setDepartmentSearch(event.target.value)
            }
            placeholder="Search departments"
            icon={<Search className="size-4" />}
          />
        </div>

        <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filteredDepartments.map((department) => (
            <label
              key={department}
              className={cn(
                'flex items-center gap-3 rounded-lg border border-border bg-background p-3 text-sm font-medium transition-colors',
                selectedDepartments.includes(department) &&
                  'border-primary bg-primary/5 text-primary',
              )}
            >
              <Checkbox
                checked={selectedDepartments.includes(department)}
                onChange={() => toggleDepartment(department)}
              />
              {department}
            </label>
          ))}
        </div>

        <div className="mt-5 flex flex-col gap-3 rounded-lg border border-dashed border-border bg-background p-4 sm:flex-row">
          <Input
            value={customDepartment}
            onChange={(event) =>
              setCustomDepartment(event.target.value)
            }
            placeholder="Add new department"
          />
          <Button
            type="button"
            variant="outline"
            onClick={addCustomDepartment}
          >
            <Plus className="size-4" />
            Add New Department
          </Button>
        </div>
      </div>

      <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
        <h3 className="text-lg font-semibold text-foreground">
          Selected Departments
        </h3>
        {selectedDepartments.length > 0 ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {selectedDepartments.map((department) => (
              <span
                key={department}
                className="rounded-full bg-primary/10 px-3 py-1 text-sm font-medium text-primary"
              >
                {department}
              </span>
            ))}
          </div>
        ) : (
          <p className="mt-2 text-sm text-muted-foreground">
            No departments selected yet.
          </p>
        )}
      </div>

      <div className="flex justify-end">
        <Button
          size="lg"
          disabled={selectedDepartments.length === 0}
          onClick={saveDepartments}
        >
          Save & Continue
        </Button>
      </div>
    </div>
  )
}
