export function ToolEventCard({ event }: { event: Record<string, unknown> }) {
  const name = String(event.name || 'tool');
  const status = String(event.status || 'running');
  const summary = String(event.resultSummary || event.query || '');

  return (
    <div className="rounded-xl border border-border bg-card px-4 py-3 text-sm text-mutedForeground">
      <div className="flex items-center justify-between gap-3">
        <span className="font-normal text-foreground">{name}</span>
        <span className="rounded-full border border-border bg-muted px-2 py-0.5 text-xs uppercase tracking-wide">
          {status}
        </span>
      </div>
      {summary ? <p className="mt-2 whitespace-pre-wrap break-words">{summary}</p> : null}
    </div>
  );
}
