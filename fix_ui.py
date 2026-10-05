import re
with open('components/domain/signals/signals-feed-view.tsx', 'r', encoding='utf8') as f:
    c = f.read()

pattern = re.compile(r'\{\/\* Running Alert.*?Morning Opportunity Briefing', re.DOTALL)

repl = '''{/* Running Alert / Scan Status Banner */}
      {(status?.running || scanning) ? (
        <div className="flex items-center justify-between rounded-xl border border-primary/30 bg-primary/5 p-4 text-sm">
          <div className="flex items-center gap-3">
            <Loader2 className="size-5 animate-spin text-primary" />
            <div>
              <p className="font-semibold text-foreground">
                {status?.latest_run?.stage_message || 'Opportunity Discovery in Progress'}
              </p>
              <p className="text-xs text-muted-foreground">
                {status?.latest_run?.stage
                  ? Stage:  Â· Background job running independently Â· Safe to navigate away
                  : scanMessage || 'Live search queries are gathering public records and verifying factual evidence.'}
              </p>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={() => { loadFeed(); loadStatus(); }} className="gap-1">
            <RefreshCw className="size-3.5" />
            Refresh
          </Button>
        </div>
      ) : status?.latest_run?.status === 'failed' ? (
        <div className="flex items-center justify-between rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm">
          <div className="flex items-center gap-3">
            <AlertCircle className="size-5 text-destructive" />
            <div>
              <p className="font-semibold text-destructive">
                Research failed: {status.latest_run.error_message || 'The background job failed or timed out.'}
              </p>
              <p className="text-xs text-muted-foreground">
                {status.latest_run.error_code === 'timed_out' 
                  ? 'The background worker may not be running. In production, ensure "php artisan queue:work --queue=signals,default" is running.'
                  : 'Check the backend logs for more details on this failure.'}
              </p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={() => handleStartScan()} className="gap-1 border-destructive/30 text-destructive hover:bg-destructive/10">
            <RefreshCw className="size-3.5" />
            Retry Research
          </Button>
        </div>
      ) : scanMessage ? (
        <div className="flex items-center justify-between rounded-xl border border-border bg-muted/30 p-4 text-sm">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="size-5 text-green-500" />
            <div>
              <p className="font-semibold text-foreground">Research Completed</p>
              <p className="text-xs text-muted-foreground">{scanMessage}</p>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={() => setScanMessage(null)} className="gap-1">
            <XCircle className="size-3.5" />
            Dismiss
          </Button>
        </div>
      ) : null}

      {/* Morning Opportunity Briefing'''

c = pattern.sub(lambda m: repl, c, count=1)
with open('components/domain/signals/signals-feed-view.tsx', 'w', encoding='utf8') as f:
    f.write(c)
