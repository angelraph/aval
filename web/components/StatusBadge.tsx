const STYLES: Record<string, string> = {
  Issued: "bg-muted/15 text-muted",
  Funded: "bg-accent/15 text-accent",
  Honored: "bg-emerald-500/15 text-emerald-600",
  Expired: "bg-red-500/15 text-red-600",
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${STYLES[status] ?? STYLES.Issued}`}>
      {status}
    </span>
  );
}
