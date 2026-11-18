'use client';

import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react';
import { cn } from '@/lib/utils';

type ToastTone = 'success' | 'error' | 'info';

type ToastItem = {
  id: number;
  tone: ToastTone;
  title: string;
  description?: string;
};

type Listener = (toasts: ToastItem[]) => void;

let toasts: ToastItem[] = [];
let listeners: Listener[] = [];
let nextId = 1;

function emit() {
  for (const listener of listeners) listener(toasts);
}

function push(tone: ToastTone, title: string, description?: string) {
  const id = nextId++;
  toasts = [...toasts, { id, tone, title, description }];
  emit();
  window.setTimeout(() => dismiss(id), tone === 'error' ? 6500 : 4200);
}

function dismiss(id: number) {
  toasts = toasts.filter((item) => item.id !== id);
  emit();
}

export const toast = {
  success: (title: string, description?: string) => push('success', title, description),
  error: (title: string, description?: string) => push('error', title, description),
  info: (title: string, description?: string) => push('info', title, description),
};

const toneStyles: Record<ToastTone, { wrap: string; icon: React.ReactNode }> = {
  success: { wrap: 'border-emerald-200 bg-white', icon: <CheckCircle2 className="h-5 w-5 text-emerald-600" /> },
  error: { wrap: 'border-rose-200 bg-white', icon: <AlertCircle className="h-5 w-5 text-rose-600" /> },
  info: { wrap: 'border-blue-200 bg-white', icon: <Info className="h-5 w-5 text-blue-600" /> },
};

export function Toaster() {
  const [items, setItems] = useState<ToastItem[]>([]);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const listener: Listener = (next) => setItems([...next]);
    listeners.push(listener);
    listener(toasts);
    return () => {
      listeners = listeners.filter((existing) => existing !== listener);
    };
  }, []);

  if (!mounted) return null;

  return createPortal(
    <div aria-live="polite" className="pointer-events-none fixed bottom-4 right-4 z-[120] flex w-full max-w-sm flex-col gap-2">
      {items.map((item) => {
        const style = toneStyles[item.tone];
        return (
          <div
            key={item.id}
            className={cn(
              'pointer-events-auto flex items-start gap-3 rounded-xl border p-4 shadow-lg shadow-slate-900/5 animate-in slide-in-from-bottom-2',
              style.wrap,
            )}
          >
            {style.icon}
            <div className="flex-1">
              <p className="text-sm font-semibold text-slate-900">{item.title}</p>
              {item.description && <p className="mt-0.5 text-sm text-slate-500">{item.description}</p>}
            </div>
            <button
              type="button"
              onClick={() => dismiss(item.id)}
              aria-label="Dismiss notification"
              className="rounded-md p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        );
      })}
    </div>,
    document.body,
  );
}
