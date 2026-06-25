import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  Copy,
  ExternalLink,
  Eye,
  EyeOff,
  GripVertical,
  Pencil,
  Star,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import type { App, Category } from "@/lib/db";
import { deleteApp, toggleFavorite, touchApp } from "@/lib/db";

type Props = {
  app: App;
  category?: Category;
  variant?: "grid" | "list";
  onEdit: () => void;
};

export function AppCard({ app, category, variant = "grid", onEdit }: Props) {
  const qc = useQueryClient();
  const [showPw, setShowPw] = useState(false);

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: app.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const favMut = useMutation({
    mutationFn: () => toggleFavorite(app.id, !app.is_favorite),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["apps"] }),
  });

  const delMut = useMutation({
    mutationFn: () => deleteApp(app.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["apps"] });
      toast.success("Aplicação eliminada");
    },
  });

  const copy = async (value: string | null, label: string) => {
    if (!value) return toast.error(`Sem ${label.toLowerCase()} guardado`);
    await navigator.clipboard.writeText(value);
    toast.success(`${label} copiado`);
  };

  const openApp = () => {
    touchApp(app.id).then(() => qc.invalidateQueries({ queryKey: ["apps"] }));
    window.open(app.url, "_blank", "noopener,noreferrer");
  };

  const initial = app.name.charAt(0).toUpperCase();

  if (variant === "list") {
    return (
      <div
        ref={setNodeRef}
        style={style}
        className={cn(
          "glass-panel group relative flex items-center gap-4 rounded-2xl p-3 transition-all duration-300",
          "hover:border-[color:var(--neon-purple)]/40 hover:shadow-[var(--glow-purple)]",
        )}
      >
        <button
          {...attributes}
          {...listeners}
          className="cursor-grab rounded p-1 text-muted-foreground opacity-0 transition-opacity hover:text-foreground group-hover:opacity-100 active:cursor-grabbing"
          aria-label="Arrastar"
        >
          <GripVertical className="h-4 w-4" />
        </button>

        {app.icon_url ? (
          <img
            src={app.icon_url}
            alt={app.name}
            className="h-10 w-10 shrink-0 rounded-lg border border-[color:var(--glass-border)] object-cover"
          />
        ) : (
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[image:var(--gradient-neon)] text-base font-bold text-primary-foreground shadow-[var(--glow-purple)]">
            {initial}
          </div>
        )}

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="truncate text-sm font-semibold tracking-tight">{app.name}</h3>
            {app.is_favorite && (
              <Star className="h-3.5 w-3.5 fill-[color:var(--neon-cyan)] text-[color:var(--neon-cyan)]" />
            )}
            {category && (
              <span
                className="rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider"
                style={{
                  color: category.color,
                  backgroundColor: `color-mix(in oklab, ${category.color} 18%, transparent)`,
                  border: `1px solid color-mix(in oklab, ${category.color} 35%, transparent)`,
                }}
              >
                {category.name}
              </span>
            )}
          </div>
          {app.description && (
            <p className="truncate text-xs text-muted-foreground">{app.description}</p>
          )}
        </div>

        <div className="hidden items-center gap-3 text-xs md:flex">
          <div className="flex items-center gap-1">
            <span className="font-mono text-muted-foreground">{app.username || "—"}</span>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => copy(app.username, "Login")}>
              <Copy className="h-3.5 w-3.5" />
            </Button>
          </div>
          <div className="flex items-center gap-1">
            <span className="font-mono text-muted-foreground">
              {app.password ? (showPw ? app.password : "••••••") : "—"}
            </span>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setShowPw((s) => !s)}>
              {showPw ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => copy(app.password, "Password")}>
              <Copy className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <Button onClick={openApp} variant="neon" size="sm">
            <ExternalLink className="mr-1.5 h-4 w-4" /> Abrir
          </Button>
          <Button variant="ghost" size="icon" onClick={() => favMut.mutate()} aria-label="Favorito">
            <Star className={cn("h-4 w-4", app.is_favorite && "fill-[color:var(--neon-cyan)] text-[color:var(--neon-cyan)]")} />
          </Button>
          <Button variant="ghost" size="icon" onClick={onEdit} aria-label="Editar">
            <Pencil className="h-4 w-4" />
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="Eliminar">
                <Trash2 className="h-4 w-4" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Eliminar "{app.name}"?</AlertDialogTitle>
                <AlertDialogDescription>
                  Esta acção é permanente e irá remover também as credenciais guardadas.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={() => delMut.mutate()}>Eliminar</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "glass-panel group relative flex flex-col gap-4 rounded-2xl p-5 transition-all duration-300",
        "hover:-translate-y-1 hover:border-[color:var(--neon-purple)]/40",
        "hover:shadow-[var(--glow-purple)]",
      )}
    >
      <button
        {...attributes}
        {...listeners}
        className="absolute right-2 top-2 cursor-grab rounded p-1 text-muted-foreground opacity-0 transition-opacity hover:text-foreground group-hover:opacity-100 active:cursor-grabbing"
        aria-label="Arrastar"
      >
        <GripVertical className="h-4 w-4" />
      </button>

      <div className="flex items-start gap-3">
        <div className="relative">
          {app.icon_url ? (
            <img
              src={app.icon_url}
              alt={app.name}
              className="h-12 w-12 rounded-xl border border-[color:var(--glass-border)] object-cover"
            />
          ) : (
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[image:var(--gradient-neon)] text-lg font-bold text-primary-foreground shadow-[var(--glow-purple)]">
              {initial}
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="truncate text-base font-semibold tracking-tight">{app.name}</h3>
            {app.is_favorite && (
              <Star className="h-3.5 w-3.5 fill-[color:var(--neon-cyan)] text-[color:var(--neon-cyan)]" />
            )}
          </div>
          {category && (
            <span
              className="mt-0.5 inline-block rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider"
              style={{
                color: category.color,
                backgroundColor: `color-mix(in oklab, ${category.color} 18%, transparent)`,
                border: `1px solid color-mix(in oklab, ${category.color} 35%, transparent)`,
              }}
            >
              {category.name}
            </span>
          )}
        </div>
      </div>

      {app.description && (
        <p className="line-clamp-2 text-sm text-muted-foreground">{app.description}</p>
      )}

      <div className="space-y-2 rounded-xl border border-[color:var(--glass-border)] bg-background/30 p-3 text-xs">
        <div className="flex items-center gap-2">
          <span className="w-16 shrink-0 text-muted-foreground">Login</span>
          <span className="flex-1 truncate font-mono">{app.username || "—"}</span>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => copy(app.username, "Login")}
          >
            <Copy className="h-3.5 w-3.5" />
          </Button>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-16 shrink-0 text-muted-foreground">Password</span>
          <span className="flex-1 truncate font-mono">
            {app.password ? (showPw ? app.password : "••••••••••") : "—"}
          </span>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => setShowPw((s) => !s)}
          >
            {showPw ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => copy(app.password, "Password")}
          >
            <Copy className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Button onClick={openApp} variant="neon" className="flex-1">
          <ExternalLink className="mr-1.5 h-4 w-4" /> Abrir App
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => favMut.mutate()}
          aria-label="Favorito"
        >
          <Star
            className={cn(
              "h-4 w-4",
              app.is_favorite && "fill-[color:var(--neon-cyan)] text-[color:var(--neon-cyan)]",
            )}
          />
        </Button>
        <Button variant="ghost" size="icon" onClick={onEdit} aria-label="Editar">
          <Pencil className="h-4 w-4" />
        </Button>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="ghost" size="icon" aria-label="Eliminar">
              <Trash2 className="h-4 w-4" />
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Eliminar "{app.name}"?</AlertDialogTitle>
              <AlertDialogDescription>
                Esta acção é permanente e irá remover também as credenciais guardadas.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={() => delMut.mutate()}>Eliminar</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      {app.last_accessed_at && (
        <p className="text-[10px] text-muted-foreground">
          Último acesso: {new Date(app.last_accessed_at).toLocaleString("pt-PT")}
        </p>
      )}
    </div>
  );
}