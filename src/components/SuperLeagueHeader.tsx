import type { LucideIcon } from "lucide-react";

export function SuperLeagueHeader({ icon: Icon, title, description }: { icon: LucideIcon; title: string; description: string }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-primary">
          Super League
        </span>
      </div>
      <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
        <Icon className="size-6 text-primary" /> {title}
      </h1>
      <p className="text-sm text-muted-foreground max-w-3xl rounded-lg border border-border bg-muted/40 p-3 leading-relaxed">
        {description}
      </p>
    </div>
  );
}
