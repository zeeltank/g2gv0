'use client'

import { useState } from 'react'
import { AlertCircle, Loader2, Radar } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import type { LaravelContext } from '@/lib/laravel-context'
import { apiErrorText } from '@/lib/api-messages'
import {
  opportunitiesService,
  type ConnectorMonitoringSettings,
  type DataConnectorInfo,
  type MonitoringContentType,
} from '@/services/signals/opportunities'

export interface ConnectorMonitoringDialogProps {
  context: LaravelContext
  open: boolean
  connector: DataConnectorInfo | null
  onClose: () => void
  onSaved: (updated: DataConnectorInfo) => void
}

const CONTENT_TYPES: { key: MonitoringContentType; label: string; hint: string }[] = [
  { key: 'own_posts', label: 'Own posts', hint: 'Videos, Shorts and posts of the connected account' },
  { key: 'comments', label: 'Comments', hint: 'What other people wrote under the newest posts' },
  { key: 'discovery', label: 'Discovery', hint: 'Public searches (YouTube) and other accounts you name (Instagram business accounts)' },
]

const DEFAULTS: ConnectorMonitoringSettings = {
  enabled: true,
  search_keywords: [],
  exclude_keywords: [],
  target_accounts: [],
  max_items: 60,
  search_limit: 10,
  comment_videos: 8,
  content_types: ['own_posts', 'comments', 'discovery'],
}

const lines = (text: string) => text.split('\n').map((line) => line.trim()).filter(Boolean)

/** Mounts a fresh form for each connector each time the dialog opens, so no reset-in-effect is needed. */
export function ConnectorMonitoringDialog(props: ConnectorMonitoringDialogProps) {
  if (!props.open || !props.connector) return null
  return <Body key={props.connector.id} {...props} connector={props.connector} />
}

function Body({ context, open, connector, onClose, onSaved }: ConnectorMonitoringDialogProps & { connector: DataConnectorInfo }) {
  const current = connector.monitoring ?? DEFAULTS
  const [enabled, setEnabled] = useState(current.enabled)
  const [searchKeywords, setSearchKeywords] = useState(current.search_keywords.join('\n'))
  const [excludeKeywords, setExcludeKeywords] = useState(current.exclude_keywords.join('\n'))
  const [targetAccounts, setTargetAccounts] = useState(current.target_accounts.join('\n'))
  const [maxItems, setMaxItems] = useState(current.max_items)
  const [searchLimit, setSearchLimit] = useState(current.search_limit)
  const [commentPosts, setCommentPosts] = useState(current.comment_videos)
  const [contentTypes, setContentTypes] = useState<MonitoringContentType[]>(current.content_types)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isYouTube = connector.type === 'youtube'
  const isInstagram = connector.type === 'instagram_business'
  const hasComments = connector.type === 'youtube' || connector.type === 'facebook_page' || connector.type === 'instagram_business'

  const toggleType = (key: MonitoringContentType) =>
    setContentTypes((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (saving) return
    setSaving(true)
    setError(null)
    try {
      const res = await opportunitiesService.saveConnectorMonitoring(context, connector.id, {
        enabled,
        ...(isYouTube ? { search_keywords: lines(searchKeywords) } : {}),
        exclude_keywords: lines(excludeKeywords),
        ...(isInstagram ? { target_accounts: lines(targetAccounts) } : {}),
        max_items: maxItems,
        search_limit: searchLimit,
        comment_videos: commentPosts,
        content_types: contentTypes,
      })
      onSaved(res.data)
      onClose()
    } catch (err) {
      setError(apiErrorText(err, 'Failed to save the monitoring settings.'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(val) => { if (!val) onClose() }}>
      <DialogContent className="max-w-lg sm:rounded-2xl p-6 max-h-[90vh] overflow-y-auto">
        <DialogHeader className="space-y-1 pb-2 border-b border-border">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-primary/10 text-primary">
              <Radar className="size-4" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold text-foreground">What to monitor</DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground truncate max-w-xs">{connector.name}</DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {error && (
          <div className="flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive">
            <AlertCircle className="size-4 shrink-0 mt-0.5" />
            <p className="flex-1">{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <label className="flex items-center gap-2.5 p-3 rounded-lg border border-border bg-muted/20 cursor-pointer">
            <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} className="size-4" />
            <div>
              <span className="text-xs font-semibold text-foreground block">Monitoring on</span>
              <span className="text-[11px] text-muted-foreground">Off stops manual and scheduled syncs of this connector</span>
            </div>
          </label>

          <div className="space-y-1.5">
            <span className="text-xs font-medium text-foreground">What to read</span>
            <div className="space-y-1.5">
              {CONTENT_TYPES.filter((type) => type.key !== 'comments' || hasComments).map((type) => (
                <label key={type.key} className="flex items-start gap-2.5 text-xs cursor-pointer">
                  <input type="checkbox" checked={contentTypes.includes(type.key)} onChange={() => toggleType(type.key)} className="mt-0.5 size-4" />
                  <span><strong className="text-foreground">{type.label}</strong> <span className="text-muted-foreground">· {type.hint}</span></span>
                </label>
              ))}
            </div>
          </div>

          {isYouTube && (
            <div className="space-y-1">
              <label className="text-xs font-medium text-foreground" htmlFor="mon-search">Public searches for buyers (one per line, up to 8; 4 run per sync)</label>
              <textarea
                id="mon-search"
                value={searchKeywords}
                onChange={(e) => setSearchKeywords(e.target.value)}
                rows={4}
                placeholder="school management software India&#10;school ERP tender"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs"
              />
              <p className="text-[11px] text-muted-foreground">Each search uses 100 of the day&apos;s YouTube quota units. Leave empty to use the server defaults.</p>
            </div>
          )}

          {isInstagram && (
            <div className="space-y-1">
              <label className="text-xs font-medium text-foreground" htmlFor="mon-accounts">Other Instagram business accounts to read (usernames, one per line)</label>
              <textarea
                id="mon-accounts"
                value={targetAccounts}
                onChange={(e) => setTargetAccounts(e.target.value)}
                rows={3}
                placeholder="examplepublicschool"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs"
              />
              <p className="text-[11px] text-muted-foreground">Meta answers only for public Business or Creator accounts; any other account is skipped.</p>
            </div>
          )}

          <div className="space-y-1">
            <label className="text-xs font-medium text-foreground" htmlFor="mon-exclude">Ignore posts containing (one per line)</label>
            <textarea
              id="mon-exclude"
              value={excludeKeywords}
              onChange={(e) => setExcludeKeywords(e.target.value)}
              rows={3}
              placeholder="coaching&#10;play school"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs"
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1">
              <label className="text-[11px] font-medium text-foreground" htmlFor="mon-max">Max items per sync</label>
              <Input id="mon-max" type="number" min={1} max={200} value={maxItems} onChange={(e) => setMaxItems(Number(e.target.value))} className="bg-background" />
            </div>
            <div className="space-y-1">
              <label className="text-[11px] font-medium text-foreground" htmlFor="mon-limit">Results per search</label>
              <Input id="mon-limit" type="number" min={1} max={25} value={searchLimit} onChange={(e) => setSearchLimit(Number(e.target.value))} className="bg-background" />
            </div>
            <div className="space-y-1">
              <label className="text-[11px] font-medium text-foreground" htmlFor="mon-comments">Posts whose comments are read</label>
              <Input id="mon-comments" type="number" min={0} max={25} value={commentPosts} onChange={(e) => setCommentPosts(Number(e.target.value))} className="bg-background" />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={saving}>Cancel</Button>
            <Button type="submit" size="sm" disabled={saving}>
              {saving ? <Loader2 className="size-3.5 animate-spin" /> : null}
              Save
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
