'use client';

import { BookOpen, FileText, GraduationCap, ListChecks } from 'lucide-react';

import type { DocumentKind } from '../_lib/question-papers-api';

export const DOCUMENT_KINDS: Array<{
  value: DocumentKind;
  label: string;
  description: string;
  Icon: typeof FileText;
}> = [
  {
    value: 'question_paper',
    label: 'Question paper',
    description: 'PDF only. Questions are extracted and saved to the question bank in the background.',
    Icon: ListChecks,
  },
  {
    value: 'curriculum',
    label: 'Curriculum',
    description: 'Syllabus, curriculum maps and learning outcomes.',
    Icon: GraduationCap,
  },
  {
    value: 'general',
    label: 'General document',
    description: 'Circulars, letters, policies and everything else. Classified automatically.',
    Icon: FileText,
  },
  {
    value: 'textbook',
    label: 'Textbook',
    description: 'Books and chapters used for teaching.',
    Icon: BookOpen,
  },
];

export const KIND_LABEL: Record<DocumentKind, string> = Object.fromEntries(
  DOCUMENT_KINDS.map((kind) => [kind.value, kind.label]),
) as Record<DocumentKind, string>;

interface DocumentTypePickerProps {
  value: DocumentKind | null;
  onChange: (value: DocumentKind) => void;
  /** Which files the choice applies to, shown above the options. */
  heading: string;
}

/** Four options, one choice. Used for "all files" and again for a single file. */
export function DocumentTypePicker({ value, onChange, heading }: DocumentTypePickerProps) {
  return (
    <fieldset>
      <legend className="text-sm font-medium text-slate-800">{heading}</legend>
      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        {DOCUMENT_KINDS.map(({ value: kind, label, description, Icon }) => {
          const selected = value === kind;
          return (
            <label
              key={kind}
              className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 focus-within:ring-2 focus-within:ring-indigo-500/40 ${
                selected ? 'border-indigo-600 bg-indigo-50' : 'border-slate-200 hover:border-slate-300'
              }`}
            >
              <input
                type="radio"
                name="document-kind"
                value={kind}
                checked={selected}
                onChange={() => onChange(kind)}
                className="sr-only"
              />
              <Icon className={`mt-0.5 h-5 w-5 shrink-0 ${selected ? 'text-indigo-600' : 'text-slate-400'}`} aria-hidden />
              <span className="min-w-0">
                <span className="block text-sm font-medium text-slate-900">{label}</span>
                <span className="block text-xs text-slate-500">{description}</span>
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
