import { Link } from "@tanstack/react-router";
import { AlertTriangle } from "lucide-react";
import { normalizeCountry, continentOf } from "@/lib/fm-continents";
import { cn } from "@/lib/utils";

interface Props {
  /** Country name or 3-letter code, in any variant. */
  name?: string | null;
  className?: string;
  /** Fallback text when no name is available. */
  fallback?: string;
  /** Show the original text as-is (not the canonical). */
  showOriginal?: boolean;
}

/**
 * Renders a country name as a link to `/paises/$name` using the canonical
 * country name. If the country cannot be resolved (unknown alias / no
 * continent), a small warning badge is rendered so mapping issues are
 * visually obvious throughout the app.
 */
export function CountryLink({ name, className, fallback = "—", showOriginal = false }: Props) {
  const raw = (name ?? "").trim();
  if (!raw) return <span className={cn("text-muted-foreground", className)}>{fallback}</span>;
  const canonical = normalizeCountry(raw);
  const resolved = Boolean(continentOf(canonical));
  const label = showOriginal ? raw : canonical;
  if (!resolved) {
    return (
      <span className={cn("inline-flex items-center gap-1 text-amber-500", className)} title={`País desconhecido: ${raw}`}>
        <AlertTriangle className="size-3" />
        <span>{label}</span>
      </span>
    );
  }
  return (
    <Link
      to="/paises/$name"
      params={{ name: canonical }}
      className={cn("hover:text-primary hover:underline", className)}
    >
      {label}
    </Link>
  );
}