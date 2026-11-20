'use client'

import React, { useEffect, useMemo, useState } from 'react'
import {
  Check,
  CheckCircle2,
  Clock,
  Copy,
  Eye,
  Mail,
  MessageCircle,
  MessageSquareText,
  Phone,
  RefreshCw,
  Search,
  Trash2,
  XCircle,
  AlertCircle,
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { toast } from '@/components/ui/toast'
import {
  clearStoredDispatches,
  deleteStoredDispatch,
  DISPATCH_UPDATED_EVENT,
  extractPhoneAndName,
  getStoredDispatches,
  SEEDED_SAMPLE_DISPATCHES,
  type StoredDispatchRow,
} from '@/lib/communication/dispatch-store'

interface Props {
  moduleKey?: string | null
}

export function CommunicationDeliveryLog({ moduleKey }: Props) {
  const [dispatches, setDispatches] = useState<StoredDispatchRow[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedChannel, setSelectedChannel] = useState<string>('all')
  const [selectedStatus, setSelectedStatus] = useState<string>('all')
  const [selectedRow, setSelectedRow] = useState<StoredDispatchRow | null>(null)
  const [copiedId, setCopiedId] = useState<number | null>(null)

  const loadData = () => {
    const stored = getStoredDispatches(moduleKey ?? undefined)
    const combined = [...stored]
    const existingIds = new Set(stored.map((s) => s.id))
    for (const item of SEEDED_SAMPLE_DISPATCHES) {
      if (!existingIds.has(item.id)) {
        combined.push(item)
      }
    }
    setDispatches(combined)
  }

  useEffect(() => {
    loadData()

    const handleUpdate = () => {
      loadData()
    }

    window.addEventListener(DISPATCH_UPDATED_EVENT, handleUpdate)
    return () => window.removeEventListener(DISPATCH_UPDATED_EVENT, handleUpdate)
  }, [moduleKey])

  const handleCopyContact = (text: string, id: number, e: React.MouseEvent) => {
    e.stopPropagation()
    navigator.clipboard.writeText(text)
    setCopiedId(id)
    toast(`${text} copied to clipboard.`)
    setTimeout(() => setCopiedId(null), 2000)
  }

  const handleClearLog = () => {
    clearStoredDispatches(moduleKey ?? undefined)
    loadData()
    toast('Delivery log cleared.')
  }

  const filteredDispatches = useMemo(() => {
    return dispatches.filter((d) => {
      const { phone, name } = extractPhoneAndName(d.recipient)
      const isEmailRow = d.channel === 'email'
      const destination = d.mobile_number || (isEmailRow ? d.recipient : phone)

      const matchesSearch =
        !searchQuery ||
        (destination && destination.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (phone && phone.includes(searchQuery)) ||
        (d.recipient && d.recipient.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (name && name.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (d.recipient_name && d.recipient_name.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (d.subject && d.subject.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (d.message_body && d.message_body.toLowerCase().includes(searchQuery.toLowerCase()))

      const matchesChannel =
        selectedChannel === 'all' || d.channel.toLowerCase() === selectedChannel.toLowerCase()
      const matchesStatus =
        selectedStatus === 'all' || d.status.toLowerCase() === selectedStatus.toLowerCase()

      return matchesSearch && matchesChannel && matchesStatus
    })
  }, [dispatches, searchQuery, selectedChannel, selectedStatus])

  const metrics = useMemo(() => {
    const total = dispatches.length
    const delivered = dispatches.filter((d) => d.status === 'sent').length
    const pending = dispatches.filter((d) => d.status === 'queued').length
    const failed = dispatches.filter((d) => d.status === 'failed').length
    return { total, delivered, pending, failed }
  }, [dispatches])

  return (
    <div className="space-y-6">
      {/* Top Header & Clear Action */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-b border-border pb-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-foreground">
            Multi-Channel Delivery Audit Log
          </h2>
          <p className="text-sm text-muted-foreground">
            Track real-time delivery status, error logs, and recipient verification across Email, SMS and WhatsApp.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={loadData}
            className="gap-1.5 text-xs font-semibold"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            <span>Refresh</span>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClearLog}
            className="gap-1.5 text-xs text-muted-foreground hover:text-destructive"
          >
            <Trash2 className="h-3.5 w-3.5" />
            <span>Clear Log</span>
          </Button>
        </div>
      </div>

      {/* KPI Metric Cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Card className="border-border shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Total Dispatched
              </span>
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Clock className="h-4 w-4" />
              </div>
            </div>
            <p className="mt-2 text-2xl font-bold text-foreground">{metrics.total}</p>
            <span className="text-[11px] text-muted-foreground">Across all delivery channels</span>
          </CardContent>
        </Card>

        <Card className="border-emerald-500/20 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-400">
                Delivered / Sent
              </span>
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="h-4 w-4" />
              </div>
            </div>
            <p className="mt-2 text-2xl font-bold text-emerald-700 dark:text-emerald-400">
              {metrics.delivered}
            </p>
            <span className="text-[11px] text-emerald-700/80 dark:text-emerald-400/80">Confirmed gateway dispatch</span>
          </CardContent>
        </Card>

        <Card className="border-amber-500/20 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-amber-800 dark:text-amber-400">
                Queued / Pending
              </span>
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/15 text-amber-600 dark:text-amber-400">
                <Clock className="h-4 w-4" />
              </div>
            </div>
            <p className="mt-2 text-2xl font-bold text-amber-700 dark:text-amber-400">
              {metrics.pending}
            </p>
            <span className="text-[11px] text-amber-700/80 dark:text-amber-400/80">Awaiting gateway processing</span>
          </CardContent>
        </Card>

        <Card className="border-destructive/20 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-destructive">
                Delivery Errors
              </span>
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-destructive/15 text-destructive">
                <XCircle className="h-4 w-4" />
              </div>
            </div>
            <p className="mt-2 text-2xl font-bold text-destructive">{metrics.failed}</p>
            <span className="text-[11px] text-destructive/80">Gateway rejection or invalid contact</span>
          </CardContent>
        </Card>
      </div>

      {/* Filter and Search Controls */}
      <Card className="border-border shadow-sm">
        <CardContent className="p-4 space-y-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            {/* Search Input */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by recipient name, phone, email, subject, or message text..."
                className="pl-9 text-xs"
              />
            </div>

            {/* Channel Filter */}
            <div className="flex items-center gap-2">
              <select
                value={selectedChannel}
                onChange={(e) => setSelectedChannel(e.target.value)}
                className="rounded-lg border border-border bg-card px-3 py-2 text-xs font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="all">All Channels</option>
                <option value="whatsapp">WhatsApp</option>
                <option value="sms">SMS Gateway</option>
                <option value="email">Email (SMTP)</option>
              </select>

              {/* Status Filter */}
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="rounded-lg border border-border bg-card px-3 py-2 text-xs font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="all">All Statuses</option>
                <option value="sent">Sent / Delivered</option>
                <option value="queued">Queued / Pending</option>
                <option value="failed">Failed / Refused</option>
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Delivery Log Table */}
      <Card className="border-border shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-border bg-muted/30 uppercase tracking-wider text-muted-foreground text-[11px] font-semibold">
              <tr>
                <th className="px-4 py-3">Timestamp</th>
                <th className="px-4 py-3">Recipient & Destination</th>
                <th className="px-4 py-3">Channel</th>
                <th className="px-4 py-3">Subject / Event</th>
                <th className="px-4 py-3">Message Preview</th>
                <th className="px-4 py-3">Delivery Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {filteredDispatches.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                    No communication records found matching your filters.
                  </td>
                </tr>
              ) : (
                filteredDispatches.map((item) => {
                  const isEmailRow = item.channel === 'email'
                  const isWaRow = item.channel === 'whatsapp'
                  const isSmsRow = item.channel === 'sms'
                  const { phone, name } = extractPhoneAndName(item.recipient)
                  const destination = item.mobile_number || (isEmailRow ? item.recipient : phone)

                  return (
                    <tr
                      key={item.id}
                      onClick={() => setSelectedRow(item)}
                      className="cursor-pointer transition hover:bg-muted/40"
                    >
                      <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">
                        {item.sent_at
                          ? new Date(item.sent_at).toLocaleString([], {
                              dateStyle: 'short',
                              timeStyle: 'short',
                            })
                          : new Date(item.created_at).toLocaleString([], {
                              dateStyle: 'short',
                              timeStyle: 'short',
                            })}
                      </td>

                      <td className="px-4 py-3">
                        <div className="flex flex-col">
                          <span className="font-semibold text-foreground">
                            {item.recipient_name || name}
                          </span>
                          <div className="flex items-center gap-1 font-mono text-[11px] text-muted-foreground">
                            <span>{destination}</span>
                            {destination && (
                              <button
                                type="button"
                                onClick={(e) => handleCopyContact(destination, item.id, e)}
                                className="opacity-60 hover:opacity-100 transition"
                                title="Copy contact"
                              >
                                {copiedId === item.id ? (
                                  <Check className="h-3 w-3 text-emerald-600" />
                                ) : (
                                  <Copy className="h-3 w-3" />
                                )}
                              </button>
                            )}
                          </div>
                        </div>
                      </td>

                      <td className="px-4 py-3 whitespace-nowrap">
                        {isWaRow && (
                          <Badge
                            variant="outline"
                            className="gap-1 border-emerald-500/30 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300 font-semibold"
                          >
                            <MessageCircle className="h-3 w-3" />
                            WhatsApp
                          </Badge>
                        )}
                        {isSmsRow && (
                          <Badge
                            variant="outline"
                            className="gap-1 border-sky-500/30 bg-sky-500/10 text-sky-800 dark:text-sky-300 font-semibold"
                          >
                            <MessageSquareText className="h-3 w-3" />
                            SMS
                          </Badge>
                        )}
                        {isEmailRow && (
                          <Badge
                            variant="outline"
                            className="gap-1 border-indigo-500/30 bg-indigo-500/10 text-indigo-800 dark:text-indigo-300 font-semibold"
                          >
                            <Mail className="h-3 w-3" />
                            Email
                          </Badge>
                        )}
                      </td>

                      <td className="px-4 py-3">
                        <div className="max-w-[180px] truncate font-medium text-foreground">
                          {item.subject || item.event_key}
                        </div>
                      </td>

                      <td className="px-4 py-3">
                        <p className="max-w-[260px] truncate text-muted-foreground">
                          {item.message_body || '—'}
                        </p>
                      </td>

                      <td className="px-4 py-3 whitespace-nowrap">
                        {item.status === 'sent' && (
                          <Badge
                            variant="outline"
                            className="gap-1 border-emerald-500/30 bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 font-semibold"
                          >
                            <Check className="h-3 w-3" />
                            Delivered
                          </Badge>
                        )}
                        {item.status === 'queued' && (
                          <Badge
                            variant="outline"
                            className="gap-1 border-amber-500/30 bg-amber-500/15 text-amber-700 dark:text-amber-400 font-semibold"
                          >
                            <Clock className="h-3 w-3" />
                            Queued
                          </Badge>
                        )}
                        {item.status === 'failed' && (
                          <Badge
                            variant="outline"
                            className="gap-1 border-destructive/30 bg-destructive/15 text-destructive font-semibold"
                          >
                            <XCircle className="h-3 w-3" />
                            Failed
                          </Badge>
                        )}
                      </td>

                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation()
                            setSelectedRow(item)
                          }}
                          className="h-7 w-7 p-0"
                          title="View Details"
                        >
                          <Eye className="h-3.5 w-3.5" />
                        </Button>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Details Modal */}
      {selectedRow && (
        <Dialog open={Boolean(selectedRow)} onOpenChange={(open) => { if (!open) setSelectedRow(null) }}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <span>Dispatch Record #{selectedRow.id}</span>
                <Badge variant="outline" className="text-xs uppercase font-mono">
                  {selectedRow.channel}
                </Badge>
              </DialogTitle>
              <DialogDescription>
                Detailed audit and gateway response metrics for this dispatch.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-2 text-xs">
              <div className="grid grid-cols-2 gap-3 rounded-lg border border-border bg-muted/20 p-3">
                <div>
                  <span className="font-semibold text-muted-foreground uppercase text-[10px]">Recipient:</span>
                  <p className="font-medium text-foreground">{selectedRow.recipient_name}</p>
                </div>
                <div>
                  <span className="font-semibold text-muted-foreground uppercase text-[10px]">Destination:</span>
                  <p className="font-mono text-primary">{selectedRow.mobile_number || selectedRow.recipient}</p>
                </div>
                <div>
                  <span className="font-semibold text-muted-foreground uppercase text-[10px]">Status:</span>
                  <p className="font-semibold capitalize text-foreground">{selectedRow.status}</p>
                </div>
                <div>
                  <span className="font-semibold text-muted-foreground uppercase text-[10px]">Dispatch Time:</span>
                  <p className="text-muted-foreground">
                    {new Date(selectedRow.sent_at || selectedRow.created_at).toLocaleString()}
                  </p>
                </div>
              </div>

              {selectedRow.subject && (
                <div>
                  <span className="font-semibold text-muted-foreground uppercase text-[10px]">Subject:</span>
                  <p className="font-medium text-foreground mt-0.5">{selectedRow.subject}</p>
                </div>
              )}

              <div>
                <span className="font-semibold text-muted-foreground uppercase text-[10px]">Message Body:</span>
                <div className="mt-1 rounded-lg border border-border bg-card p-3 text-foreground whitespace-pre-wrap leading-relaxed max-h-48 overflow-y-auto">
                  {selectedRow.message_body || '—'}
                </div>
              </div>

              {selectedRow.last_error && (
                <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-destructive">
                  <div className="flex items-center gap-1.5 font-semibold">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    <span>Gateway Error Reason:</span>
                  </div>
                  <p className="mt-1 leading-relaxed">{selectedRow.last_error}</p>
                </div>
              )}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setSelectedRow(null)}>
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}
