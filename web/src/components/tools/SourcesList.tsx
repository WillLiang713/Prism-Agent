export interface SourceItem {
  title?: string;
  url: string;
}

export function SourcesList({ sources }: { sources: SourceItem[] }) {
  if (sources.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-wrap gap-2">
      {sources.map((source) => (
        <a
          key={source.url}
          href={source.url}
          target="_blank"
          rel="noreferrer"
          className="inline-flex max-w-full items-center rounded-full border border-border bg-muted px-3 py-1 text-xs text-mutedForeground hover:text-foreground"
        >
          <span className="truncate">{source.title || source.url}</span>
        </a>
      ))}
    </div>
  );
}
