'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  PanelLeftClose,
  PanelLeft,
  Search,
  Bell,
  ChevronDown,
  User,
  Settings,
  LogOut,
  ShieldCheck,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { ROLES, type Role } from '@/lib/gtg-roles'
import { useAuth } from '@/lib/gtg-auth'

function RoleSwitcher({
  role,
  onChange,
}: {
  role: Role
  onChange: (role: Role) => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const current = ROLES.find((r) => r.id === role)!

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex h-10 items-center gap-2 rounded-md border border-input bg-surface-muted px-3 text-sm font-medium text-foreground transition-colors duration-200 outline-none hover:bg-secondary focus-visible:ring-2 focus-visible:ring-ring"
      >
        <ShieldCheck className="size-4 text-muted-foreground" aria-hidden="true" />
        <span className="hidden sm:inline">Viewing as</span>
        <span className="font-semibold text-brand">{current.label}</span>
        <ChevronDown className="size-4 text-muted-foreground" aria-hidden="true" />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 z-50 mt-2 w-56 overflow-hidden rounded-lg border border-border bg-popover text-popover-foreground shadow-lg"
        >
          <div className="border-b border-border px-3 py-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Preview Role
            </p>
          </div>
          <div className="p-1">
            {ROLES.map((r) => (
              <button
                key={r.id}
                type="button"
                role="menuitemradio"
                aria-checked={r.id === role}
                onClick={() => {
                  onChange(r.id)
                  setOpen(false)
                }}
                className={cn(
                  'flex w-full items-center justify-between gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors duration-200 outline-none focus-visible:bg-secondary',
                  r.id === role
                    ? 'bg-secondary text-secondary-foreground'
                    : 'text-foreground hover:bg-secondary hover:text-secondary-foreground',
                )}
              >
                {r.label}
                {r.id === role && (
                  <span className="size-2 rounded-full bg-primary" aria-hidden="true" />
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function NotificationsMenu() {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Notifications"
        aria-haspopup="menu"
        aria-expanded={open}
        className="relative flex size-10 items-center justify-center rounded-md text-muted-foreground transition-colors duration-200 outline-none hover:bg-secondary hover:text-secondary-foreground focus-visible:ring-2 focus-visible:ring-ring"
      >
        <Bell className="size-5" aria-hidden="true" />
        <span className="absolute right-2 top-2 flex size-2 rounded-full bg-primary ring-2 ring-card" />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 z-50 mt-2 w-80 overflow-hidden rounded-lg border border-border bg-popover text-popover-foreground shadow-lg"
        >
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <span className="text-sm font-semibold">Notifications</span>
            <span className="rounded-sm bg-accent px-2 py-0.5 text-xs font-semibold text-accent-foreground">
              New
            </span>
          </div>
          <div className="flex flex-col items-center justify-center gap-2 px-4 py-10 text-center">
            <Bell className="size-6 text-muted-foreground" aria-hidden="true" />
            <p className="text-sm font-medium text-foreground">
              You&apos;re all caught up
            </p>
            <p className="text-xs text-muted-foreground">
              Notifications will appear here.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}

function UserProfileMenu() {
  const router = useRouter()
  const { user, logout } = useAuth()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  const handleLogout = () => {
    logout()
    router.push('/login')
  }

  const items = [
    { id: 'profile', label: 'My Profile', icon: User },
    { id: 'settings', label: 'Account Settings', icon: Settings },
  ]

  const userInitials = user?.name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase() || 'AM'

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex items-center gap-2 rounded-md py-1 pl-1 pr-2 transition-colors duration-200 outline-none hover:bg-secondary focus-visible:ring-2 focus-visible:ring-ring"
      >
        <span
          className="flex size-8 items-center justify-center rounded-full bg-brand text-xs font-semibold text-brand-foreground"
          aria-hidden="true"
        >
          {userInitials}
        </span>
        <span className="hidden flex-col items-start leading-tight md:flex">
          <span className="text-sm font-semibold text-foreground">
            {user?.name}
          </span>
          <span className="text-xs text-muted-foreground">{user?.role}</span>
        </span>
        <ChevronDown
          className="hidden size-4 text-muted-foreground md:block"
          aria-hidden="true"
        />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 z-50 mt-2 w-56 overflow-hidden rounded-lg border border-border bg-popover text-popover-foreground shadow-lg"
        >
          <div className="border-b border-border px-3 py-3">
            <p className="text-sm font-semibold text-foreground">{user?.name}</p>
            <p className="truncate text-xs text-muted-foreground">
              {user?.email}
            </p>
          </div>
          <div className="p-1">
            {items.map((item) => {
              const Icon = item.icon
              return (
                <button
                  key={item.id}
                  type="button"
                  role="menuitem"
                  className="flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium text-foreground transition-colors duration-200 outline-none hover:bg-secondary hover:text-secondary-foreground focus-visible:bg-secondary"
                >
                  <Icon className="size-4 text-muted-foreground" aria-hidden="true" />
                  {item.label}
                </button>
              )
            })}
          </div>
          <div className="border-t border-border p-1">
            <button
              type="button"
              role="menuitem"
              onClick={handleLogout}
              className="g2g-brand-gradient flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-sm font-semibold text-brand-foreground transition-opacity duration-200 outline-none hover:opacity-90 focus-visible:ring-2 focus-visible:ring-ring"
            >
              <LogOut className="size-4" aria-hidden="true" />
              Sign Out
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export function GtgHeader({
  collapsed,
  onToggleSidebar,
}: {
  collapsed: boolean
  onToggleSidebar: () => void
}) {
  const { user, switchRole } = useAuth()

  return (
    <header
      className="flex h-16 shrink-0 items-center gap-4 border-b border-border bg-card px-6 shadow-sm"
      role="banner"
    >
      <button
        type="button"
        onClick={onToggleSidebar}
        aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        className="flex size-10 items-center justify-center rounded-md text-muted-foreground transition-colors duration-200 outline-none hover:bg-secondary hover:text-secondary-foreground focus-visible:ring-2 focus-visible:ring-ring"
      >
        {collapsed ? (
          <PanelLeft className="size-5" aria-hidden="true" />
        ) : (
          <PanelLeftClose className="size-5" aria-hidden="true" />
        )}
      </button>

      <div className="relative flex w-full max-w-md items-center">
        <Search
          className="pointer-events-none absolute left-3 size-4 text-muted-foreground"
          aria-hidden="true"
        />
        <input
          type="search"
          aria-label="Global search"
          placeholder="Search…"
          className={cn(
            'h-10 w-full rounded-md border border-input bg-surface-muted pl-9 pr-3 text-[15px] text-foreground transition-colors duration-200 outline-none',
            'placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40',
          )}
        />
      </div>

      <div className="ml-auto flex items-center gap-2">
        <NotificationsMenu />
        {user && (
          <>
            <div className="mx-1 h-6 w-px bg-border" aria-hidden="true" />
            <RoleSwitcher role={user.role} onChange={switchRole} />
          </>
        )}
        <div className="mx-1 h-6 w-px bg-border" aria-hidden="true" />
        <UserProfileMenu />
      </div>
    </header>
  )
}
